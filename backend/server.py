"""
Wouffy Backend — Entry point.

Arquitectura:
  db.py           → conexión MongoDB + setup de índices
  models.py       → todos los modelos Pydantic y enums
  dependencies.py → dependencias FastAPI (get_current_user)
  routers/
    auth.py       → /api/auth/*  + /api/me (alias)
    profile.py    → /api/me/profile
    pets.py       → /api/me/pets
    walkers.py    → /api/walkers
    walks.py      → /api/walks
  services/
    scheduling.py → validaciones de horario
    walk_service.py → lógica de estados del paseo
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from db import client, setup_indexes
from routers import auth, profile, pets, walkers, walks

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

def _cors_allow_origins() -> List[str]:
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if not raw or raw == "*":
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    parts = [o.strip() for o in raw.split(",") if o.strip()]
    if "*" in parts:
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    return parts


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Wouffy API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_allow_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

api_router = APIRouter(prefix="/api")

# Auth + alias /me
api_router.include_router(auth.router)
api_router.add_api_route("/me", auth.get_me, methods=["GET"], tags=["auth"])

# Perfil de usuario
api_router.include_router(profile.router)

# Mascotas (incluye /me/pets/photo)
api_router.include_router(pets.router)
# Mantener la ruta legacy de upload
api_router.add_api_route(
    "/upload/pet-photo",
    pets.upload_pet_photo,
    methods=["POST"],
    tags=["uploads"],
)

# Walkers (el orden de rutas ya está resuelto dentro del router)
api_router.include_router(walkers.router)

# Paseos
api_router.include_router(walks.router)

app.include_router(api_router)

# ---------------------------------------------------------------------------
# Archivos estáticos (uploads)
# ---------------------------------------------------------------------------

uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    logger.info("Creando índices MongoDB...")
    try:
        await setup_indexes()
        logger.info("Índices creados correctamente.")
    except Exception as e:
        logger.warning("No se pudieron crear los índices: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
