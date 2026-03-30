"""
Conexión compartida a MongoDB.
Importar `db` desde cualquier módulo del backend.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_mongo_url: str = os.environ["MONGO_URL"]
_db_name: str = os.environ["DB_NAME"]

client: AsyncIOMotorClient = AsyncIOMotorClient(_mongo_url)
db: AsyncIOMotorDatabase = client[_db_name]


async def setup_indexes() -> None:
    """
    Crea índices críticos en MongoDB al arrancar el servidor.
    Idempotente: si el índice ya existe, no hace nada.
    """
    # --- walks ---
    await db.walks.create_index([("walker_profile_id", 1), ("status", 1)])
    await db.walks.create_index([("owner_user_id", 1), ("status", 1)])
    await db.walks.create_index([("pet_id", 1), ("status", 1)])
    await db.walks.create_index([("scheduled_start_at", 1)])

    # --- pets ---
    await db.pets.create_index([("owner_user_id", 1)])

    # --- walker_profiles ---
    await db.walker_profiles.create_index([("user_id", 1)], unique=True)
    await db.walker_profiles.create_index([("rating_avg", -1)])
    await db.walker_profiles.create_index([("price_per_hour", 1)])

    # --- user_sessions ---
    await db.user_sessions.create_index([("session_token", 1)], unique=True)
    await db.user_sessions.create_index([("expires_at", 1)])

    # --- users ---
    await db.users.create_index([("email", 1)], unique=True)

    # --- walk_events ---
    await db.walk_events.create_index([("walk_id", 1), ("created_at", 1)])

    # --- walk_ratings ---
    await db.walk_ratings.create_index([("walk_id", 1)], unique=True)
    await db.walk_ratings.create_index([("walker_id", 1)])

    # --- walk_locations ---
    await db.walk_locations.create_index([("walk_id", 1), ("recorded_at", 1)])
