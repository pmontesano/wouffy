"""
Validación de fecha/hora para solicitar paseos (Smart Scheduling v1).
Fuente de verdad en backend; constantes centralizadas.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

MIN_BOOKING_LEAD_TIME_MINUTES = 60
BUSINESS_OPEN_HOUR = 8
BUSINESS_CLOSE_HOUR = 20
TIME_SLOT_INTERVAL_MINUTES = 30

# Zona horaria del negocio para ventana operativa (Argentina por defecto).
_APP_TZ_NAME = os.environ.get("WALK_SCHEDULING_TZ", "America/Argentina/Buenos_Aires")
APP_TIMEZONE = ZoneInfo(_APP_TZ_NAME)


def validate_walk_scheduling(scheduled_start_at: datetime) -> None:
    """
    Rechaza con HTTP 422 si:
    - la fecha/hora está en el pasado (respecto de UTC),
    - falta anticipación mínima (MIN_BOOKING_LEAD_TIME_MINUTES),
    - el inicio local no está en la franja operativa en APP_TIMEZONE.
    """
    if scheduled_start_at.tzinfo is None:
        scheduled_utc = scheduled_start_at.replace(tzinfo=timezone.utc)
    else:
        scheduled_utc = scheduled_start_at.astimezone(timezone.utc)

    now = datetime.now(timezone.utc)
    if scheduled_utc < now:
        raise HTTPException(
            status_code=422,
            detail="La fecha y hora del paseo no puede estar en el pasado.",
        )

    min_allowed = now + timedelta(minutes=MIN_BOOKING_LEAD_TIME_MINUTES)
    if scheduled_utc < min_allowed:
        raise HTTPException(
            status_code=422,
            detail="El paseo debe solicitarse con al menos 60 minutos de anticipación.",
        )

    local = scheduled_utc.astimezone(APP_TIMEZONE)
    minutes_of_day = local.hour * 60 + local.minute
    open_min = BUSINESS_OPEN_HOUR * 60
    close_min = BUSINESS_CLOSE_HOUR * 60
    if minutes_of_day < open_min or minutes_of_day > close_min:
        raise HTTPException(
            status_code=422,
            detail="El horario seleccionado está fuera del horario disponible.",
        )


_WEEKDAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def validate_walker_availability(walker_doc: dict, scheduled_start_at: datetime) -> None:
    """
    Verifica que el horario esté dentro de la disponibilidad configurada del walker:
    - día de la semana en available_days
    - hora dentro de available_start_time–available_end_time

    Si el walker no tiene disponibilidad estructurada configurada, no valida (backward compat).
    """
    available_days: list = walker_doc.get("availability_days") or []
    start_time: Optional[str] = walker_doc.get("available_start_time")
    end_time: Optional[str] = walker_doc.get("available_end_time")

    if not available_days and not start_time:
        return  # Sin configuración estructurada: skip

    if scheduled_start_at.tzinfo is None:
        scheduled_utc = scheduled_start_at.replace(tzinfo=timezone.utc)
    else:
        scheduled_utc = scheduled_start_at.astimezone(timezone.utc)
    local_dt = scheduled_utc.astimezone(APP_TIMEZONE)

    if available_days:
        day_name = _WEEKDAY_NAMES[local_dt.weekday()]  # weekday(): 0=Lun … 6=Dom
        if day_name not in available_days:
            raise HTTPException(
                status_code=422,
                detail="El paseador no está disponible en el día seleccionado.",
            )

    if start_time and end_time:
        time_hhmm = local_dt.strftime("%H:%M")
        if time_hhmm < start_time or time_hhmm > end_time:
            raise HTTPException(
                status_code=422,
                detail="El paseador no está disponible en ese horario.",
            )


# Estados que ocupan la agenda de un walker o mascota.
BUSY_STATUSES = {"REQUESTED", "ACCEPTED", "WALKER_ON_THE_WAY", "ARRIVED", "IN_PROGRESS"}


def _parse_dt(v) -> datetime | None:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _walk_end(doc: dict, new_duration: int) -> datetime | None:
    """Fin del walk existente: usa su duración propia o fallback 60."""
    start = _parse_dt(doc.get("scheduled_start_at") or doc.get("date_time_start"))
    if start is None:
        return None
    dur = doc.get("estimated_duration_minutes") or doc.get("duration_minutes") or 60
    try:
        dur = max(1, int(dur))
    except (TypeError, ValueError):
        dur = 60
    return start + timedelta(minutes=dur)


def _overlaps(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    return start_a < end_b and end_a > start_b


async def validate_walk_conflicts(
    db: AsyncIOMotorDatabase,
    *,
    walker_profile_id: str,
    pet_id: str,
    scheduled_start_at: datetime,
    estimated_duration_minutes: int,
) -> None:
    """
    Rechaza con HTTP 409 si el walker o la mascota ya tienen un paseo activo
    que se solapa con el nuevo rango [scheduled_start_at, scheduled_start_at + duración].
    """
    if scheduled_start_at.tzinfo is None:
        new_start = scheduled_start_at.replace(tzinfo=timezone.utc)
    else:
        new_start = scheduled_start_at.astimezone(timezone.utc)
    new_end = new_start + timedelta(minutes=estimated_duration_minutes)

    existing = await db.walks.find(
        {"status": {"$in": list(BUSY_STATUSES)}},
        {"_id": 0, "walk_id": 1, "walker_profile_id": 1, "pet_id": 1,
         "scheduled_start_at": 1, "date_time_start": 1,
         "estimated_duration_minutes": 1, "duration_minutes": 1},
    ).to_list(1000)

    for doc in existing:
        ex_start = _parse_dt(doc.get("scheduled_start_at") or doc.get("date_time_start"))
        ex_end = _walk_end(doc, estimated_duration_minutes)
        if ex_start is None or ex_end is None:
            continue
        if not _overlaps(new_start, new_end, ex_start, ex_end):
            continue

        if doc.get("walker_profile_id") == walker_profile_id:
            raise HTTPException(
                status_code=409,
                detail="El paseador ya tiene un paseo asignado en ese horario.",
            )
        if doc.get("pet_id") == pet_id:
            raise HTTPException(
                status_code=409,
                detail="La mascota ya tiene un paseo programado en ese horario.",
            )
