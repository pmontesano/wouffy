"""
Endpoints de perfil de usuario.
Incluye geocodificación automática al guardar dirección.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query

from db import db
from dependencies import get_current_user
from models import User, UserProfile, UserProfileUpdate, UserRole
from services.geocoding import geocode_address

router = APIRouter(tags=["profile"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_base_location(profile_doc) -> str:
    if not profile_doc:
        return ""
    parts = [p for p in [profile_doc.get("address_text"), profile_doc.get("city")] if p]
    return ", ".join(parts)


def _parse_profile_dates(profile: dict) -> dict:
    for k in ("created_at", "updated_at"):
        if isinstance(profile.get(k), str):
            profile[k] = datetime.fromisoformat(profile[k])
    return profile


def _address_changed(update_data: dict, existing_profile: Optional[dict]) -> bool:
    """Devuelve True si cambió address_text o city respecto al perfil existente."""
    if not existing_profile:
        return True
    for field in ("address_text", "city"):
        if field in update_data and update_data[field] != existing_profile.get(field):
            return True
    return False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/me/profile", response_model=UserProfile)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})

    if not profile:
        profile_doc = {
            "profile_id": f"profile_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "full_name": current_user.name,
            "phone": None,
            "address_text": None,
            "city": None,
            "avatar_url": current_user.picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.user_profiles.insert_one(profile_doc)
        profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})

    return UserProfile(**_parse_profile_dates(profile))


@router.put("/me/profile", response_model=UserProfile)
async def update_my_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
):
    existing_profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})

    update_data = profile_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # -------------------------------------------------------------------------
    # Geocodificación automática
    # Regla: si el usuario no mandó lat/lng explícitos Y la dirección cambió,
    # intentamos geocodificar la nueva dirección.
    # Si falla, no bloqueamos el guardado (degradación silenciosa).
    # -------------------------------------------------------------------------
    explicit_lat = "latitude" in update_data
    explicit_lng = "longitude" in update_data

    if not (explicit_lat and explicit_lng):
        # Determinar la dirección final que se va a guardar
        new_address = update_data.get("address_text") or (existing_profile or {}).get("address_text")
        new_city = update_data.get("city") or (existing_profile or {}).get("city")

        if _address_changed(update_data, existing_profile) and (new_address or new_city):
            coords = await geocode_address(new_address, new_city)
            if coords:
                update_data["latitude"] = coords[0]
                update_data["longitude"] = coords[1]

    if not existing_profile:
        profile_doc = {
            "profile_id": f"profile_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "full_name": update_data.get("full_name", current_user.name),
            "phone": update_data.get("phone"),
            "address_text": update_data.get("address_text"),
            "city": update_data.get("city"),
            "avatar_url": update_data.get("avatar_url", current_user.picture),
            "latitude": update_data.get("latitude"),
            "longitude": update_data.get("longitude"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": update_data["updated_at"],
        }
        await db.user_profiles.insert_one(profile_doc)
    else:
        await db.user_profiles.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data},
        )

    profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})

    # Sincronizar ubicación base al perfil del paseador si es WALKER
    if current_user.role == UserRole.WALKER:
        await db.walker_profiles.update_one(
            {"user_id": current_user.user_id},
            {
                "$set": {
                    "base_location_text": _build_base_location(profile),
                    "latitude": profile.get("latitude"),
                    "longitude": profile.get("longitude"),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )

    return UserProfile(**_parse_profile_dates(profile))


# ---------------------------------------------------------------------------
# Endpoint de geocodificación para el frontend
# ---------------------------------------------------------------------------

@router.get("/geocode")
async def geocode(
    q: str = Query(..., description="Dirección a geocodificar (ej: 'Av. Santa Fe 1234, Buenos Aires')"),
    city: Optional[str] = Query(None),
):
    """
    Geocodifica una dirección usando OpenStreetMap Nominatim.
    Retorna lat/lng si encuentra resultados, o null si no.

    Uso desde el frontend:
      GET /api/geocode?q=Av. Corrientes 1234&city=Buenos Aires
    """
    # Si q ya tiene ciudad y el campo city es extra, combinar
    address_part = q
    coords = await geocode_address(address_part, city)

    if not coords:
        return {"found": False, "latitude": None, "longitude": None, "query": q}

    return {
        "found": True,
        "latitude": coords[0],
        "longitude": coords[1],
        "query": q,
    }
