"""Walk normalization, permissions, and timeline events."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase


def parse_datetime_value(v: Any) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        return datetime.fromisoformat(v.replace("Z", "+00:00"))
    return None


def normalize_walk_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Copy Mongo walk doc; map legacy date_time_start → scheduled_start_at."""
    d = {k: v for k, v in doc.items() if k != "_id"}
    if d.get("scheduled_start_at") is None and d.get("date_time_start") is not None:
        d["scheduled_start_at"] = d["date_time_start"]
    return d


def walk_doc_for_model(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Dict suitable for Pydantic Walk."""
    d = normalize_walk_doc(raw)
    for key in (
        "scheduled_start_at",
        "actual_start_at",
        "actual_end_at",
        "created_at",
        "updated_at",
    ):
        if key in d and d[key] is not None:
            d[key] = parse_datetime_value(d[key])
    st = d.get("status")
    if st is not None and hasattr(st, "value"):
        d["status"] = st.value
    return d


async def create_walk_event(
    db: AsyncIOMotorDatabase,
    walk_id: str,
    event_type: str,
    metadata: Optional[Dict[str, Any]] = None,
    *,
    actor: Optional[str] = None,
) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    meta: Dict[str, Any] = dict(metadata or {})
    meta.setdefault("timestamp", ts)
    if actor:
        meta["actor"] = actor
    doc = {
        "event_id": f"event_{uuid.uuid4().hex[:12]}",
        "walk_id": walk_id,
        "event_type": event_type,
        "metadata": meta,
        "created_at": ts,
    }
    await db.walk_events.insert_one(doc)


def event_to_timeline_item(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize legacy events (type/message) and new schema (event_type/metadata)."""
    created = doc.get("created_at")
    if isinstance(created, datetime):
        created_s = created.isoformat()
    else:
        created_s = created or ""
    et = doc.get("event_type") or doc.get("type") or "unknown"
    meta = doc.get("metadata")
    if meta is None or not isinstance(meta, dict):
        msg = doc.get("message")
        meta = {"message": msg} if msg else {}
    return {
        "event_type": et,
        "created_at": created_s,
        "metadata": meta,
    }


async def get_walk_if_owner(
    db: AsyncIOMotorDatabase, walk_id: str, owner_user_id: str
) -> Optional[Dict[str, Any]]:
    return await db.walks.find_one(
        {"walk_id": walk_id, "owner_user_id": owner_user_id}, {"_id": 0}
    )


async def get_walk_if_assigned_walker(
    db: AsyncIOMotorDatabase, walk_id: str, walker_profile_id: str
) -> Optional[Dict[str, Any]]:
    return await db.walks.find_one(
        {"walk_id": walk_id, "walker_profile_id": walker_profile_id},
        {"_id": 0},
    )


async def get_walk_for_authenticated_user(
    db: AsyncIOMotorDatabase,
    walk_id: str,
    *,
    user_id: str,
    role: str,
    walker_profile_id: Optional[str],
) -> Optional[Dict[str, Any]]:
    if role == "OWNER":
        return await get_walk_if_owner(db, walk_id, user_id)
    if role == "WALKER" and walker_profile_id:
        return await get_walk_if_assigned_walker(db, walk_id, walker_profile_id)
    return None


def assert_walker_assigned(walk: Dict[str, Any], walker_profile_id: str) -> None:
    if walk.get("walker_profile_id") != walker_profile_id:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")


def assert_walk_status(walk: Dict[str, Any], expected: str) -> None:
    st = walk.get("status")
    if st != expected:
        raise HTTPException(
            status_code=400,
            detail=f"Estado inválido para esta acción (actual: {st}, requerido: {expected})",
        )


def can_owner_cancel(status: str) -> bool:
    return status in ("REQUESTED", "ACCEPTED")


def get_walk_duration_minutes(doc: Dict[str, Any]) -> int:
    v = doc.get("estimated_duration_minutes") or doc.get("duration_minutes")
    if v is None:
        return 60
    try:
        return max(1, int(v))
    except (TypeError, ValueError):
        return 60


def compute_expected_walk_end(doc: Dict[str, Any]) -> Optional[datetime]:
    """Fin esperado del paseo: actual_start + duración, o scheduled + duración."""
    duration = get_walk_duration_minutes(doc)
    actual_start = parse_datetime_value(doc.get("actual_start_at"))
    scheduled = parse_datetime_value(doc.get("scheduled_start_at")) or parse_datetime_value(
        doc.get("date_time_start")
    )
    if actual_start:
        if actual_start.tzinfo is None:
            actual_start = actual_start.replace(tzinfo=timezone.utc)
        return actual_start + timedelta(minutes=duration)
    if scheduled:
        if scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=timezone.utc)
        return scheduled + timedelta(minutes=duration)
    return None


async def maybe_finalize_stale_walk(
    db: AsyncIOMotorDatabase, walk_doc: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Si el paseo sigue IN_PROGRESS pero ya pasó la ventana (inicio + duración + gracia),
    lo marca COMPLETED con finalization_source=SYSTEM y actual_end_at en el fin esperado.
    """
    if walk_doc.get("status") != "IN_PROGRESS":
        return walk_doc

    expected_end = compute_expected_walk_end(walk_doc)
    if expected_end is None:
        return walk_doc

    now = datetime.now(timezone.utc)
    grace = timedelta(minutes=5)
    if now <= expected_end + grace:
        return walk_doc

    walk_id = walk_doc["walk_id"]
    end_iso = expected_end.isoformat()
    now_iso = now.isoformat()

    await db.walks.update_one(
        {"walk_id": walk_id},
        {
            "$set": {
                "status": "COMPLETED",
                "actual_end_at": end_iso,
                "updated_at": now_iso,
                "finalization_source": "SYSTEM",
            }
        },
    )
    await create_walk_event(
        db,
        walk_id,
        "walk_finalized",
        {
            "reason": "stale_in_progress_timeout",
            "expected_end_at": end_iso,
            "detected_at": now_iso,
        },
        actor="SYSTEM",
    )
    updated = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    return updated if updated else walk_doc
