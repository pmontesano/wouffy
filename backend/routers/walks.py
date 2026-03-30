"""
Endpoints del flujo de paseos (Walk lifecycle).
Incluye: crear, listar, transiciones de estado y ratings.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException

from db import db
from dependencies import get_current_user
from models import (
    PetModel,
    PetSize,
    User,
    UserRole,
    Walk,
    WalkCreate,
    WalkDetailResponse,
    WalkListItem,
    WalkRating,
    WalkRatingCreate,
    WalkStatus,
    WalkTimelineEventItem,
    WalkTransitionBody,
    WalkerProfile,
)
from services.scheduling import (
    validate_walk_scheduling,
    validate_walk_conflicts,
    validate_walker_availability,
    BUSY_STATUSES,
)
from services.walk_service import (
    assert_walk_status,
    assert_walker_assigned,
    can_owner_cancel,
    create_walk_event,
    event_to_timeline_item,
    get_walk_for_authenticated_user,
    maybe_finalize_stale_walk,
    walk_doc_for_model,
)

router = APIRouter(prefix="/walks", tags=["walks"])


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _walk_from_doc(doc: dict) -> Walk:
    return Walk(**walk_doc_for_model(doc))


def _pet_model_from_doc(pet_doc: dict) -> PetModel:
    pd = dict(pet_doc)
    for k in ("created_at", "updated_at"):
        if isinstance(pd.get(k), str):
            pd[k] = datetime.fromisoformat(pd[k].replace("Z", "+00:00"))
    return PetModel(**pd)


def _walker_profile_from_doc(w: dict) -> WalkerProfile:
    wd = dict(w)
    for k in ("created_at", "updated_at"):
        if isinstance(wd.get(k), str):
            wd[k] = datetime.fromisoformat(wd[k].replace("Z", "+00:00"))
    return WalkerProfile(**wd)


async def _build_walk_list_items(walks_raw: list) -> List[WalkListItem]:
    if not walks_raw:
        return []
    pet_ids = list({w["pet_id"] for w in walks_raw if w.get("pet_id")})
    pets = await db.pets.find({"pet_id": {"$in": pet_ids}}, {"_id": 0}).to_list(200)
    pet_map = {p["pet_id"]: p for p in pets}
    items: List[WalkListItem] = []
    for raw in walks_raw:
        raw = await maybe_finalize_stale_walk(db, dict(raw))
        walk = _walk_from_doc(raw)
        pet_doc = pet_map.get(raw.get("pet_id"))
        pet = _pet_model_from_doc(pet_doc) if pet_doc else None
        items.append(
            WalkListItem(
                walk=walk,
                pet=pet,
                estimated_duration_minutes=raw.get("estimated_duration_minutes") or raw.get("duration_minutes"),
                start_address_text=raw.get("start_address_text") or raw.get("address_text"),
            )
        )
    return items


def _transition_metadata(body: WalkTransitionBody) -> dict:
    return {"notes": body.notes} if body.notes else {}


async def _get_walker_profile_for_user(user_id: str) -> Optional[dict]:
    return await db.walker_profiles.find_one({"user_id": user_id}, {"_id": 0})


async def _validate_walker_capacity(
    walker_doc: dict,
    scheduled_start_at: datetime,
    estimated_duration_minutes: int,
) -> None:
    """
    Verifica que el walker no supere su capacidad máxima (max_dogs) en la franja horaria.
    Cuenta la cantidad de perros ya asignados en walks activos que se solapan.
    """
    max_dogs: int = walker_doc.get("max_dogs") or 5
    walker_id: str = walker_doc["walker_id"]

    if scheduled_start_at.tzinfo is None:
        new_start = scheduled_start_at.replace(tzinfo=timezone.utc)
    else:
        new_start = scheduled_start_at.astimezone(timezone.utc)
    new_end = new_start + timedelta(minutes=estimated_duration_minutes)

    # Obtener walks activos del walker en estados que ocupan agenda
    active_walks = await db.walks.find(
        {
            "walker_profile_id": walker_id,
            "status": {"$in": list(BUSY_STATUSES)},
        },
        {"_id": 0, "scheduled_start_at": 1, "date_time_start": 1, "estimated_duration_minutes": 1},
    ).to_list(500)

    dogs_in_slot = 0
    for w in active_walks:
        start_raw = w.get("scheduled_start_at") or w.get("date_time_start")
        if not start_raw:
            continue
        try:
            w_start = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00"))
            if w_start.tzinfo is None:
                w_start = w_start.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue

        w_dur = w.get("estimated_duration_minutes") or 60
        w_end = w_start + timedelta(minutes=int(w_dur))

        # ¿Se solapa?
        if new_start < w_end and new_end > w_start:
            dogs_in_slot += 1  # Cada walk activo solapado = 1 perro

    if dogs_in_slot >= max_dogs:
        raise HTTPException(
            status_code=409,
            detail=f"El paseador ya tiene su capacidad máxima de perros ({max_dogs}) en ese horario.",
        )


def _validate_pet_size_allowed(walker_doc: dict, pet_size: str) -> None:
    """
    Verifica que el tamaño de la mascota esté entre los que acepta el walker.
    Si allowed_sizes está vacío (walkers legacy), no valida.
    """
    allowed: list = walker_doc.get("allowed_sizes") or []
    if not allowed:
        return  # backward compat: sin restricción configurada
    if pet_size not in allowed:
        size_labels = {"S": "pequeños", "M": "medianos", "L": "grandes"}
        pet_label = size_labels.get(pet_size, pet_size)
        raise HTTPException(
            status_code=422,
            detail=f"Este paseador no acepta perros {pet_label}.",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=Walk)
async def create_walk(walk_create: WalkCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden crear solicitudes de paseo")

    # Validar que la mascota pertenece al dueño
    pet = await db.pets.find_one(
        {"pet_id": walk_create.pet_id, "owner_user_id": current_user.user_id}, {"_id": 0}
    )
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")

    # Validar que el walker existe
    walker = await db.walker_profiles.find_one({"walker_id": walk_create.walker_profile_id}, {"_id": 0})
    if not walker:
        raise HTTPException(status_code=404, detail="Paseador no encontrado")

    # Validar tamaño de mascota aceptado por el walker
    _validate_pet_size_allowed(walker, pet.get("size", ""))

    # Validar scheduling y disponibilidad
    validate_walk_scheduling(walk_create.scheduled_start_at)
    validate_walker_availability(walker, walk_create.scheduled_start_at)

    duration = walk_create.estimated_duration_minutes or 60

    # Validar conflictos de calendario (sin solapamientos)
    await validate_walk_conflicts(
        db,
        walker_profile_id=walk_create.walker_profile_id,
        pet_id=walk_create.pet_id,
        scheduled_start_at=walk_create.scheduled_start_at,
        estimated_duration_minutes=duration,
    )

    # Validar capacidad máxima del walker
    await _validate_walker_capacity(walker, walk_create.scheduled_start_at, duration)

    now = datetime.now(timezone.utc).isoformat()
    ssa = walk_create.scheduled_start_at
    ssa_iso = ssa.isoformat() if isinstance(ssa, datetime) else str(ssa)

    walk_doc: dict = {
        "walk_id": f"walk_{uuid.uuid4().hex[:12]}",
        "owner_user_id": current_user.user_id,
        "pet_id": walk_create.pet_id,
        "walker_profile_id": walk_create.walker_profile_id,
        "scheduled_start_at": ssa_iso,
        "notes": walk_create.notes,
        "status": WalkStatus.REQUESTED.value,
        "created_at": now,
        "updated_at": now,
    }
    if walk_create.estimated_duration_minutes is not None:
        walk_doc["estimated_duration_minutes"] = walk_create.estimated_duration_minutes
    if walk_create.start_address_text is not None:
        walk_doc["start_address_text"] = walk_create.start_address_text

    await db.walks.insert_one(walk_doc)
    await create_walk_event(db, walk_doc["walk_id"], "walk_requested", actor="OWNER")

    walk = await db.walks.find_one({"walk_id": walk_doc["walk_id"]}, {"_id": 0})
    return _walk_from_doc(walk)


@router.get("/me", response_model=List[WalkListItem])
async def get_my_walks(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden ver sus solicitudes")
    walks = await db.walks.find({"owner_user_id": current_user.user_id}, {"_id": 0}).to_list(100)
    return await _build_walk_list_items(walks)


@router.get("/incoming", response_model=List[WalkListItem])
async def get_incoming_walks(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden ver solicitudes entrantes")
    walker_profile = await _get_walker_profile_for_user(current_user.user_id)
    if not walker_profile:
        return []
    walks = await db.walks.find(
        {"walker_profile_id": walker_profile["walker_id"]}, {"_id": 0}
    ).to_list(100)
    return await _build_walk_list_items(walks)


@router.get("/{walk_id}/events", response_model=List[WalkTimelineEventItem])
async def get_walk_events(walk_id: str, current_user: User = Depends(get_current_user)):
    role = current_user.role.value if current_user.role else ""
    wp = None
    if current_user.role == UserRole.WALKER:
        prof = await _get_walker_profile_for_user(current_user.user_id)
        wp = prof["walker_id"] if prof else None

    walk_doc = await get_walk_for_authenticated_user(
        db, walk_id, user_id=current_user.user_id, role=role, walker_profile_id=wp
    )
    if not walk_doc:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    walk_doc = await maybe_finalize_stale_walk(db, walk_doc)

    events = (
        await db.walk_events.find({"walk_id": walk_id}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(500)
    )
    return [WalkTimelineEventItem(**event_to_timeline_item(ev)) for ev in events]


@router.get("/{walk_id}", response_model=WalkDetailResponse)
async def get_walk_detail(walk_id: str, current_user: User = Depends(get_current_user)):
    role = current_user.role.value if current_user.role else ""
    wp = None
    if current_user.role == UserRole.WALKER:
        prof = await _get_walker_profile_for_user(current_user.user_id)
        wp = prof["walker_id"] if prof else None

    walk_doc = await get_walk_for_authenticated_user(
        db, walk_id, user_id=current_user.user_id, role=role, walker_profile_id=wp
    )
    if not walk_doc:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    walk_doc = await maybe_finalize_stale_walk(db, walk_doc)

    pet_doc = await db.pets.find_one({"pet_id": walk_doc["pet_id"]}, {"_id": 0})
    if not pet_doc:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")

    walker_doc = None
    wpid = walk_doc.get("walker_profile_id")
    if wpid:
        walker_doc = await db.walker_profiles.find_one({"walker_id": wpid}, {"_id": 0})

    return WalkDetailResponse(
        walk=_walk_from_doc(walk_doc),
        pet=_pet_model_from_doc(pet_doc),
        walker=_walker_profile_from_doc(walker_doc) if walker_doc else None,
    )


# ---------------------------------------------------------------------------
# Transiciones de estado (Walker)
# ---------------------------------------------------------------------------

@router.patch("/{walk_id}/accept", response_model=Walk)
async def accept_walk(walk_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden aceptar solicitudes")

    walker_profile = await _get_walker_profile_for_user(current_user.user_id)
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")

    walk = await db.walks.find_one(
        {"walk_id": walk_id, "walker_profile_id": walker_profile["walker_id"]}, {"_id": 0}
    )
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    assert_walk_status(walk, WalkStatus.REQUESTED.value)

    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.ACCEPTED.value, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await create_walk_event(db, walk_id, "walk_accepted", actor="WALKER")

    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    return _walk_from_doc(updated_walk)


@router.patch("/{walk_id}/reject", response_model=Walk)
async def reject_walk(walk_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden rechazar solicitudes")

    walker_profile = await _get_walker_profile_for_user(current_user.user_id)
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")

    walk = await db.walks.find_one(
        {"walk_id": walk_id, "walker_profile_id": walker_profile["walker_id"]}, {"_id": 0}
    )
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    assert_walk_status(walk, WalkStatus.REQUESTED.value)

    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.REJECTED.value, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await create_walk_event(db, walk_id, "walk_rejected", actor="WALKER")

    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    return _walk_from_doc(updated_walk)


@router.patch("/{walk_id}/cancel", response_model=Walk)
async def cancel_walk(walk_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden cancelar solicitudes")

    walk = await db.walks.find_one(
        {"walk_id": walk_id, "owner_user_id": current_user.user_id}, {"_id": 0}
    )
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    if not can_owner_cancel(walk["status"]):
        raise HTTPException(
            status_code=400,
            detail="Solo se puede cancelar en estado REQUESTED o ACCEPTED",
        )

    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.CANCELLED.value, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await create_walk_event(db, walk_id, "walk_cancelled", actor="OWNER")

    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    return _walk_from_doc(updated_walk)


@router.patch("/{walk_id}/on-the-way", response_model=Walk)
async def walk_on_the_way(
    walk_id: str,
    body: Optional[WalkTransitionBody] = Body(default=None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo el paseador asignado puede actualizar el estado")

    walker_profile = await _get_walker_profile_for_user(current_user.user_id)
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")

    walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    assert_walker_assigned(walk, walker_profile["walker_id"])
    assert_walk_status(walk, WalkStatus.ACCEPTED.value)

    body = body or WalkTransitionBody()
    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.WALKER_ON_THE_WAY.value, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await create_walk_event(db, walk_id, "walker_on_the_way", _transition_metadata(body), actor="WALKER")

    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    return _walk_from_doc(updated_walk)


@router.patch("/{walk_id}/arrived", response_model=Walk)
async def walk_arrived(
    walk_id: str,
    body: Optional[WalkTransitionBody] = Body(default=None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo el paseador asignado puede actualizar el estado")

    walker_profile = await _get_walker_profile_for_user(current_user.user_id)
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")

    walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    assert_walker_assigned(walk, walker_profile["walker_id"])
    assert_walk_status(walk, WalkStatus.WALKER_ON_THE_WAY.value)

    body = body or WalkTransitionBody()
    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.ARRIVED.value, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await create_walk_event(db, walk_id, "walker_arrived", _transition_metadata(body), actor="WALKER")

    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    return _walk_from_doc(updated_walk)


@router.patch("/{walk_id}/start", response_model=Walk)
async def walk_start(
    walk_id: str,
    body: Optional[WalkTransitionBody] = Body(default=None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo el paseador asignado puede iniciar el paseo")

    walker_profile = await _get_walker_profile_for_user(current_user.user_id)
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")

    walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    assert_walker_assigned(walk, walker_profile["walker_id"])
    assert_walk_status(walk, WalkStatus.ARRIVED.value)

    body = body or WalkTransitionBody()
    now = datetime.now(timezone.utc).isoformat()
    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.IN_PROGRESS.value, "actual_start_at": now, "updated_at": now}},
    )
    await create_walk_event(db, walk_id, "walk_started", _transition_metadata(body), actor="WALKER")

    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    return _walk_from_doc(updated_walk)


@router.patch("/{walk_id}/complete", response_model=Walk)
async def walk_complete(
    walk_id: str,
    body: Optional[WalkTransitionBody] = Body(default=None),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo el paseador asignado puede finalizar el paseo")

    walker_profile = await _get_walker_profile_for_user(current_user.user_id)
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")

    walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")

    assert_walker_assigned(walk, walker_profile["walker_id"])
    assert_walk_status(walk, WalkStatus.IN_PROGRESS.value)

    body = body or WalkTransitionBody()
    now = datetime.now(timezone.utc).isoformat()
    await db.walks.update_one(
        {"walk_id": walk_id},
        {
            "$set": {
                "status": WalkStatus.COMPLETED.value,
                "actual_end_at": now,
                "updated_at": now,
                "finalization_source": "WALKER",
            }
        },
    )
    await create_walk_event(db, walk_id, "walk_completed", _transition_metadata(body), actor="WALKER")

    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    return _walk_from_doc(updated_walk)


# ---------------------------------------------------------------------------
# Ratings
# ---------------------------------------------------------------------------

@router.post("/{walk_id}/rate", response_model=WalkRating)
async def rate_walk(
    walk_id: str,
    rating_data: WalkRatingCreate,
    current_user: User = Depends(get_current_user),
):
    """
    El dueño califica al walker después de completar un paseo.
    Reglas:
    - Solo el dueño del paseo puede calificar.
    - El paseo debe estar COMPLETED.
    - Solo se puede calificar una vez por paseo.
    """
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo el dueño puede calificar un paseo")

    # Verificar que el paseo pertenece al dueño
    walk = await db.walks.find_one(
        {"walk_id": walk_id, "owner_user_id": current_user.user_id}, {"_id": 0}
    )
    if not walk:
        raise HTTPException(status_code=404, detail="Paseo no encontrado")

    if walk["status"] != WalkStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail="Solo se puede calificar un paseo completado",
        )

    # Verificar que no fue calificado antes
    existing_rating = await db.walk_ratings.find_one({"walk_id": walk_id}, {"_id": 0})
    if existing_rating:
        raise HTTPException(status_code=409, detail="Este paseo ya fue calificado")

    walker_id = walk.get("walker_profile_id")
    if not walker_id:
        raise HTTPException(status_code=400, detail="El paseo no tiene paseador asignado")

    now = datetime.now(timezone.utc)
    rating_doc = {
        "rating_id": f"rating_{uuid.uuid4().hex[:12]}",
        "walk_id": walk_id,
        "walker_id": walker_id,
        "owner_user_id": current_user.user_id,
        "rating": rating_data.rating,
        "comment": rating_data.comment,
        "created_at": now.isoformat(),
    }

    await db.walk_ratings.insert_one(rating_doc)

    # Actualizar rating promedio del walker usando todos sus ratings
    all_ratings = await db.walk_ratings.find(
        {"walker_id": walker_id}, {"_id": 0, "rating": 1}
    ).to_list(10000)

    total = sum(r["rating"] for r in all_ratings)
    count = len(all_ratings)
    new_avg = round(total / count, 2)

    await db.walker_profiles.update_one(
        {"walker_id": walker_id},
        {"$set": {"rating_avg": new_avg, "rating_count": count, "updated_at": now.isoformat()}},
    )

    await create_walk_event(
        db,
        walk_id,
        "walk_rated",
        {"rating": rating_data.rating, "comment": rating_data.comment},
        actor="OWNER",
    )

    rating_doc["created_at"] = now
    return WalkRating(**rating_doc)


# ---------------------------------------------------------------------------
# GPS Tracking
# ---------------------------------------------------------------------------

# Estados en los que se acepta envío de ubicación
_TRACKABLE_STATUSES = {
    WalkStatus.WALKER_ON_THE_WAY.value,
    WalkStatus.ARRIVED.value,
    WalkStatus.IN_PROGRESS.value,
}


class LocationPoint(dict):
    """Esquema simple — no necesita Pydantic porque no se expone como response_model."""


from pydantic import BaseModel as _BM

class LocationPayload(_BM):
    latitude: float
    longitude: float


class RoutePoint(_BM):
    latitude: float
    longitude: float
    recorded_at: str


class RouteResponse(_BM):
    walk_id: str
    status: str
    points: List[RoutePoint]
    actual_start_at: Optional[str] = None
    actual_end_at: Optional[str] = None


@router.post("/{walk_id}/location", status_code=201)
async def post_location(
    walk_id: str,
    payload: LocationPayload,
    current_user: User = Depends(get_current_user),
):
    """
    El walker envía su posición GPS actual durante el paseo.
    Solo el walker asignado puede llamar este endpoint.
    Solo se acepta cuando el paseo está en estado activo.
    """
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo el paseador puede enviar su ubicación")

    walker_profile = await _get_walker_profile_for_user(current_user.user_id)
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")

    walk = await db.walks.find_one(
        {"walk_id": walk_id, "walker_profile_id": walker_profile["walker_id"]}, {"_id": 0}
    )
    if not walk:
        raise HTTPException(status_code=404, detail="Paseo no encontrado")

    if walk["status"] not in _TRACKABLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede enviar ubicación en estado '{walk['status']}'",
        )

    now = datetime.now(timezone.utc)
    point_doc = {
        "walk_id": walk_id,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "recorded_at": now.isoformat(),
    }
    await db.walk_locations.insert_one(point_doc)

    # Actualizar última posición conocida en el documento del walk (para acceso rápido)
    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {
            "last_lat": payload.latitude,
            "last_lng": payload.longitude,
            "last_location_at": now.isoformat(),
        }},
    )

    return {"ok": True, "recorded_at": now.isoformat()}


@router.get("/{walk_id}/route", response_model=RouteResponse)
async def get_route(
    walk_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve todos los puntos GPS del paseo ordenados por tiempo.
    Accesible tanto por el walker asignado como por el dueño del paseo.
    """
    role = current_user.role.value if current_user.role else ""
    wp = None
    if current_user.role == UserRole.WALKER:
        prof = await _get_walker_profile_for_user(current_user.user_id)
        wp = prof["walker_id"] if prof else None

    walk = await get_walk_for_authenticated_user(
        db, walk_id, user_id=current_user.user_id, role=role, walker_profile_id=wp
    )
    if not walk:
        raise HTTPException(status_code=404, detail="Paseo no encontrado")

    points_cursor = db.walk_locations.find(
        {"walk_id": walk_id}, {"_id": 0, "latitude": 1, "longitude": 1, "recorded_at": 1}
    ).sort("recorded_at", 1)
    points_raw = await points_cursor.to_list(10000)

    return RouteResponse(
        walk_id=walk_id,
        status=walk["status"],
        actual_start_at=walk.get("actual_start_at"),
        actual_end_at=walk.get("actual_end_at"),
        points=[RoutePoint(**p) for p in points_raw],
    )
