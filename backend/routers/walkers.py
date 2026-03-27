"""
Endpoints de paseadores (walkers).
Incluye listado público y gestión del perfil propio.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from db import db
from dependencies import get_current_user
from models import User, UserRole, WalkerProfile, WalkerProfileCreate

router = APIRouter(tags=["walkers"])

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_walker_dates(w: dict) -> dict:
    for k in ("created_at", "updated_at"):
        if isinstance(w.get(k), str):
            w[k] = datetime.fromisoformat(w[k].replace("Z", "+00:00"))
    return w


def _validate_availability_times(start: Optional[str], end: Optional[str]) -> None:
    if start is None and end is None:
        return
    if (start is None) != (end is None):
        raise HTTPException(
            status_code=422,
            detail="Debés indicar tanto hora de inicio como hora de fin.",
        )
    if not _TIME_RE.match(start):
        raise HTTPException(status_code=422, detail="Hora de inicio inválida. Usá formato HH:mm (ej: 09:00).")
    if not _TIME_RE.match(end):
        raise HTTPException(status_code=422, detail="Hora de fin inválida. Usá formato HH:mm (ej: 18:00).")
    if start >= end:
        raise HTTPException(status_code=422, detail="La hora de inicio debe ser anterior a la hora de fin.")


def _build_base_location(profile_doc) -> str:
    if not profile_doc:
        return ""
    parts = [p for p in [profile_doc.get("address_text"), profile_doc.get("city")] if p]
    return ", ".join(parts)


# ---------------------------------------------------------------------------
# Rutas — orden importante: /me/profile ANTES de /{walker_id}
# ---------------------------------------------------------------------------

@router.get("/walkers/me/profile", response_model=WalkerProfile)
async def get_my_walker_profile(current_user: User = Depends(get_current_user)):
    walker = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not walker:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")
    return WalkerProfile(**_parse_walker_dates(walker))


@router.post("/walkers/me/profile", response_model=WalkerProfile)
async def create_walker_profile(
    profile: WalkerProfileCreate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden crear perfil de paseador")

    existing = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes un perfil de paseador")

    _validate_availability_times(profile.available_start_time, profile.available_end_time)

    if profile.max_dogs < 1 or profile.max_dogs > 20:
        raise HTTPException(status_code=422, detail="La capacidad máxima debe estar entre 1 y 20 perros.")

    user_profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})

    walker_doc = {
        "walker_id": f"walker_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "photo_url": current_user.picture,
        **profile.model_dump(),
        "allowed_sizes": [s.value if hasattr(s, "value") else s for s in profile.allowed_sizes],
        "base_location_text": _build_base_location(user_profile),
        "latitude": user_profile.get("latitude") if user_profile else None,
        "longitude": user_profile.get("longitude") if user_profile else None,
        "rating_avg": 5.0,
        "rating_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.walker_profiles.insert_one(walker_doc)

    walker = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    return WalkerProfile(**_parse_walker_dates(walker))


@router.put("/walkers/me/profile", response_model=WalkerProfile)
async def update_walker_profile(
    profile: WalkerProfileCreate,
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden actualizar perfil de paseador")

    _validate_availability_times(profile.available_start_time, profile.available_end_time)

    if profile.max_dogs < 1 or profile.max_dogs > 20:
        raise HTTPException(status_code=422, detail="La capacidad máxima debe estar entre 1 y 20 perros.")

    user_profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    update_data = profile.model_dump()
    update_data["allowed_sizes"] = [s.value if hasattr(s, "value") else s for s in profile.allowed_sizes]
    update_data["base_location_text"] = _build_base_location(user_profile)
    update_data["latitude"] = user_profile.get("latitude") if user_profile else None
    update_data["longitude"] = user_profile.get("longitude") if user_profile else None
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.walker_profiles.update_one(
        {"user_id": current_user.user_id},
        {"$set": update_data},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")

    walker = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    return WalkerProfile(**_parse_walker_dates(walker))


@router.get("/walkers", response_model=List[WalkerProfile])
async def get_walkers(
    min_rating: Optional[float] = None,
    max_price: Optional[float] = None,
    pet_size: Optional[str] = None,      # Filtrar walkers que aceptan este tamaño
):
    query: dict = {}
    if min_rating is not None:
        query["rating_avg"] = {"$gte": min_rating}
    if max_price is not None:
        query["price_per_hour"] = {"$lte": max_price}
    if pet_size is not None:
        # Solo walkers que aceptan el tamaño requerido
        query["allowed_sizes"] = {"$in": [pet_size.upper()]}

    walkers = await db.walker_profiles.find(query, {"_id": 0}).to_list(100)
    return [WalkerProfile(**_parse_walker_dates(w)) for w in walkers]


@router.get("/walkers/{walker_id}", response_model=WalkerProfile)
async def get_walker(walker_id: str):
    walker = await db.walker_profiles.find_one({"walker_id": walker_id}, {"_id": 0})
    if not walker:
        raise HTTPException(status_code=404, detail="Paseador no encontrado")
    return WalkerProfile(**_parse_walker_dates(walker))
