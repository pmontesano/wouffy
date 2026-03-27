"""
Endpoints de autenticación: sesión OAuth, logout, rol.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from pymongo.errors import PyMongoError

from db import db
from dependencies import get_current_user
from models import RoleUpdate, User

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger(__name__)


@router.post("/session")
async def exchange_session(x_session_id: str = Header(..., alias="X-Session-ID")):
    """
    Intercambia X-Session-ID con demobackend y persiste usuario + sesión en MongoDB.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": x_session_id},
                timeout=15.0,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=400,
                detail=f"OAuth demobackend HTTP {e.response.status_code}. Probá iniciar sesión de nuevo.",
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo contactar al servicio OAuth: {str(e)}",
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Respuesta OAuth inválida (no es JSON).")

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Respuesta OAuth con formato inesperado.")

    required = ("email", "name", "session_token")
    missing = [k for k in required if data.get(k) in (None, "")]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Datos de sesión incompletos del proveedor OAuth (faltan: {', '.join(missing)}).",
        )

    session_token = data["session_token"]
    user_id = f"user_{uuid.uuid4().hex[:12]}"

    try:
        existing_user = await db.users.find_one({"email": data["email"]}, {"_id": 0})

        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": data["name"], "picture": data.get("picture")}},
            )
        else:
            user_doc = {
                "user_id": user_id,
                "email": data["email"],
                "name": data["name"],
                "picture": data.get("picture"),
                "role": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.users.insert_one(user_doc)

        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        session_doc = {
            "session_id": str(uuid.uuid4()),
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.user_sessions.insert_one(session_doc)

        user_data = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    except PyMongoError as e:
        log.warning("MongoDB en /auth/session: %s", e)
        raise HTTPException(
            status_code=503,
            detail=(
                "No se pudo guardar la sesión: MongoDB no está disponible o MONGO_URL es incorrecta. "
                "Levantá Mongo (p. ej. docker compose up -d) y reiniciá el backend."
            ),
        )

    if not user_data:
        raise HTTPException(status_code=500, detail="Usuario no encontrado tras crear sesión.")

    if isinstance(user_data["created_at"], str):
        user_data["created_at"] = datetime.fromisoformat(user_data["created_at"])

    try:
        user_obj = User(**user_data)
    except ValidationError as e:
        log.warning("Validación User en /auth/session: %s", e)
        raise HTTPException(status_code=422, detail="Datos de usuario inconsistentes en base.")

    payload = user_obj.model_dump(mode="json")
    payload["session_token"] = session_token

    is_production = os.environ.get("ENVIRONMENT", "development").lower() == "production"
    response = JSONResponse(content=payload)
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    return response


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    token = session_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "", 1)
    if token:
        await db.user_sessions.delete_many({"session_token": token})

    response = JSONResponse(content={"message": "Sesión cerrada"})
    response.delete_cookie(key="session_token", path="/")
    return response


@router.patch("/role")
async def update_role(role_update: RoleUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"role": role_update.role.value}},
    )

    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if isinstance(user_doc["created_at"], str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])

    return User(**user_doc)
