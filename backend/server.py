from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Header, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    OWNER = "OWNER"
    WALKER = "WALKER"

class WalkStatus(str, Enum):
    REQUESTED = "REQUESTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"

class PetSize(str, Enum):
    S = "S"
    M = "M"
    L = "L"

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Optional[UserRole] = None
    created_at: datetime

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class WalkerProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    walker_id: str = Field(default_factory=lambda: f"walker_{uuid.uuid4().hex[:12]}")
    user_id: str
    display_name: str
    photo_url: Optional[str] = None
    bio: str
    experience_years: int
    service_area_text: str
    base_location_text: str
    price_per_hour: float
    rating_avg: float = 5.0
    rating_count: int = 0
    availability_days: List[str] = []
    availability_hours: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    updated_at: datetime

class WalkerProfileCreate(BaseModel):
    display_name: str
    bio: str
    experience_years: int
    service_area_text: str
    base_location_text: str
    price_per_hour: float
    availability_days: List[str] = []
    availability_hours: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class Pet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    pet_id: str = Field(default_factory=lambda: f"pet_{uuid.uuid4().hex[:12]}")
    owner_user_id: str
    name: str
    size: PetSize
    notes: Optional[str] = None
    created_at: datetime

class Walk(BaseModel):
    model_config = ConfigDict(extra="ignore")
    walk_id: str = Field(default_factory=lambda: f"walk_{uuid.uuid4().hex[:12]}")
    owner_user_id: str
    walker_profile_id: str
    pet_id: Optional[str] = None
    pet_name: Optional[str] = None
    pet_size: Optional[PetSize] = None
    pet_notes: Optional[str] = None
    date_time_start: datetime
    duration_minutes: int
    address_text: str
    notes: Optional[str] = None
    status: WalkStatus = WalkStatus.REQUESTED
    created_at: datetime
    updated_at: datetime

class WalkCreate(BaseModel):
    walker_profile_id: str
    date_time_start: datetime
    duration_minutes: int
    address_text: str
    notes: Optional[str] = None
    pet_name: str
    pet_size: PetSize
    pet_notes: Optional[str] = None

class RoleUpdate(BaseModel):
    role: UserRole

# Auth Helper
async def get_current_user(
    session_token: Optional[str] = Cookie(None), 
    authorization: Optional[str] = Header(None)
) -> User:
    token = session_token
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Sesión inválida")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Sesión expirada")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if isinstance(user_doc["created_at"], str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    return User(**user_doc)

# Auth Endpoints
@api_router.post("/auth/session")
async def exchange_session(x_session_id: str = Header(...)):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": x_session_id},
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error obteniendo datos de sesión: {str(e)}")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": data["name"],
                "picture": data.get("picture")
            }}
        )
    else:
        user_doc = {
            "user_id": user_id,
            "email": data["email"],
            "name": data["name"],
            "picture": data.get("picture"),
            "role": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    user_data = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if isinstance(user_data["created_at"], str):
        user_data["created_at"] = datetime.fromisoformat(user_data["created_at"])
    
    response = JSONResponse(content=user_data)
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    return response

@api_router.get("/auth/me")
async def get_me(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(session_token, authorization)
    return current_user

@api_router.post("/auth/logout")
async def logout(session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response = JSONResponse(content={"message": "Sesión cerrada"})
    response.delete_cookie(key="session_token", path="/")
    return response

@api_router.patch("/auth/role")
async def update_role(role_update: RoleUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"role": role_update.role.value}}
    )
    
    user_doc = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if isinstance(user_doc["created_at"], str):
        user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    
    return User(**user_doc)

# Walker Endpoints
@api_router.get("/walkers", response_model=List[WalkerProfile])
async def get_walkers(
    location: Optional[str] = None,
    min_rating: Optional[float] = None,
    max_price: Optional[float] = None
):
    query = {}
    if min_rating:
        query["rating_avg"] = {"$gte": min_rating}
    if max_price:
        query["price_per_hour"] = {"$lte": max_price}
    
    walkers = await db.walker_profiles.find(query, {"_id": 0}).to_list(100)
    
    for walker in walkers:
        if isinstance(walker["created_at"], str):
            walker["created_at"] = datetime.fromisoformat(walker["created_at"])
        if isinstance(walker["updated_at"], str):
            walker["updated_at"] = datetime.fromisoformat(walker["updated_at"])
    
    return walkers

@api_router.get("/walkers/{walker_id}", response_model=WalkerProfile)
async def get_walker(walker_id: str):
    walker = await db.walker_profiles.find_one({"walker_id": walker_id}, {"_id": 0})
    if not walker:
        raise HTTPException(status_code=404, detail="Paseador no encontrado")
    
    if isinstance(walker["created_at"], str):
        walker["created_at"] = datetime.fromisoformat(walker["created_at"])
    if isinstance(walker["updated_at"], str):
        walker["updated_at"] = datetime.fromisoformat(walker["updated_at"])
    
    return WalkerProfile(**walker)

@api_router.get("/walkers/me/profile", response_model=WalkerProfile)
async def get_my_walker_profile(current_user: User = Depends(get_current_user)):
    walker = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not walker:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")
    
    if isinstance(walker["created_at"], str):
        walker["created_at"] = datetime.fromisoformat(walker["created_at"])
    if isinstance(walker["updated_at"], str):
        walker["updated_at"] = datetime.fromisoformat(walker["updated_at"])
    
    return WalkerProfile(**walker)

@api_router.post("/walkers/me/profile", response_model=WalkerProfile)
async def create_walker_profile(profile: WalkerProfileCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden crear perfil de paseador")
    
    existing = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya tienes un perfil de paseador")
    
    walker_doc = {
        "walker_id": f"walker_{uuid.uuid4().hex[:12]}",
        "user_id": current_user.user_id,
        "photo_url": current_user.picture,
        **profile.model_dump(),
        "rating_avg": 5.0,
        "rating_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.walker_profiles.insert_one(walker_doc)
    
    walker = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if isinstance(walker["created_at"], str):
        walker["created_at"] = datetime.fromisoformat(walker["created_at"])
    if isinstance(walker["updated_at"], str):
        walker["updated_at"] = datetime.fromisoformat(walker["updated_at"])
    
    return WalkerProfile(**walker)

@api_router.put("/walkers/me/profile", response_model=WalkerProfile)
async def update_walker_profile(profile: WalkerProfileCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden actualizar perfil de paseador")
    
    update_data = profile.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.walker_profiles.update_one(
        {"user_id": current_user.user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")
    
    walker = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if isinstance(walker["created_at"], str):
        walker["created_at"] = datetime.fromisoformat(walker["created_at"])
    if isinstance(walker["updated_at"], str):
        walker["updated_at"] = datetime.fromisoformat(walker["updated_at"])
    
    return WalkerProfile(**walker)

# Walk Endpoints
@api_router.post("/walks", response_model=Walk)
async def create_walk(walk_create: WalkCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden crear solicitudes de paseo")
    
    walk_doc = {
        "walk_id": f"walk_{uuid.uuid4().hex[:12]}",
        "owner_user_id": current_user.user_id,
        **walk_create.model_dump(),
        "status": WalkStatus.REQUESTED.value,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if isinstance(walk_doc["date_time_start"], datetime):
        walk_doc["date_time_start"] = walk_doc["date_time_start"].isoformat()
    
    await db.walks.insert_one(walk_doc)
    
    walk = await db.walks.find_one({"walk_id": walk_doc["walk_id"]}, {"_id": 0})
    if isinstance(walk["date_time_start"], str):
        walk["date_time_start"] = datetime.fromisoformat(walk["date_time_start"])
    if isinstance(walk["created_at"], str):
        walk["created_at"] = datetime.fromisoformat(walk["created_at"])
    if isinstance(walk["updated_at"], str):
        walk["updated_at"] = datetime.fromisoformat(walk["updated_at"])
    
    return Walk(**walk)

@api_router.get("/walks/me", response_model=List[Walk])
async def get_my_walks(current_user: User = None):
    current_user = await get_current_user()
    
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden ver sus solicitudes")
    
    walks = await db.walks.find({"owner_user_id": current_user.user_id}, {"_id": 0}).to_list(100)
    
    for walk in walks:
        if isinstance(walk["date_time_start"], str):
            walk["date_time_start"] = datetime.fromisoformat(walk["date_time_start"])
        if isinstance(walk["created_at"], str):
            walk["created_at"] = datetime.fromisoformat(walk["created_at"])
        if isinstance(walk["updated_at"], str):
            walk["updated_at"] = datetime.fromisoformat(walk["updated_at"])
    
    return walks

@api_router.get("/walks/incoming", response_model=List[Walk])
async def get_incoming_walks(current_user: User = None):
    current_user = await get_current_user()
    
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden ver solicitudes entrantes")
    
    walker_profile = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not walker_profile:
        return []
    
    walks = await db.walks.find({"walker_profile_id": walker_profile["walker_id"]}, {"_id": 0}).to_list(100)
    
    for walk in walks:
        if isinstance(walk["date_time_start"], str):
            walk["date_time_start"] = datetime.fromisoformat(walk["date_time_start"])
        if isinstance(walk["created_at"], str):
            walk["created_at"] = datetime.fromisoformat(walk["created_at"])
        if isinstance(walk["updated_at"], str):
            walk["updated_at"] = datetime.fromisoformat(walk["updated_at"])
    
    return walks

@api_router.patch("/walks/{walk_id}/accept", response_model=Walk)
async def accept_walk(walk_id: str, current_user: User = None):
    current_user = await get_current_user()
    
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden aceptar solicitudes")
    
    walker_profile = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")
    
    walk = await db.walks.find_one({"walk_id": walk_id, "walker_profile_id": walker_profile["walker_id"]}, {"_id": 0})
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")
    
    if walk["status"] != WalkStatus.REQUESTED.value:
        raise HTTPException(status_code=400, detail="Solo se pueden aceptar solicitudes en estado REQUESTED")
    
    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.ACCEPTED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    if isinstance(updated_walk["date_time_start"], str):
        updated_walk["date_time_start"] = datetime.fromisoformat(updated_walk["date_time_start"])
    if isinstance(updated_walk["created_at"], str):
        updated_walk["created_at"] = datetime.fromisoformat(updated_walk["created_at"])
    if isinstance(updated_walk["updated_at"], str):
        updated_walk["updated_at"] = datetime.fromisoformat(updated_walk["updated_at"])
    
    return Walk(**updated_walk)

@api_router.patch("/walks/{walk_id}/reject", response_model=Walk)
async def reject_walk(walk_id: str, current_user: User = None):
    current_user = await get_current_user()
    
    if current_user.role != UserRole.WALKER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol WALKER pueden rechazar solicitudes")
    
    walker_profile = await db.walker_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not walker_profile:
        raise HTTPException(status_code=404, detail="Perfil de paseador no encontrado")
    
    walk = await db.walks.find_one({"walk_id": walk_id, "walker_profile_id": walker_profile["walker_id"]}, {"_id": 0})
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")
    
    if walk["status"] != WalkStatus.REQUESTED.value:
        raise HTTPException(status_code=400, detail="Solo se pueden rechazar solicitudes en estado REQUESTED")
    
    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.REJECTED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    if isinstance(updated_walk["date_time_start"], str):
        updated_walk["date_time_start"] = datetime.fromisoformat(updated_walk["date_time_start"])
    if isinstance(updated_walk["created_at"], str):
        updated_walk["created_at"] = datetime.fromisoformat(updated_walk["created_at"])
    if isinstance(updated_walk["updated_at"], str):
        updated_walk["updated_at"] = datetime.fromisoformat(updated_walk["updated_at"])
    
    return Walk(**updated_walk)

@api_router.patch("/walks/{walk_id}/cancel", response_model=Walk)
async def cancel_walk(walk_id: str, current_user: User = None):
    current_user = await get_current_user()
    
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden cancelar solicitudes")
    
    walk = await db.walks.find_one({"walk_id": walk_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    if not walk:
        raise HTTPException(status_code=404, detail="Solicitud de paseo no encontrada")
    
    await db.walks.update_one(
        {"walk_id": walk_id},
        {"$set": {"status": WalkStatus.CANCELLED.value, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_walk = await db.walks.find_one({"walk_id": walk_id}, {"_id": 0})
    if isinstance(updated_walk["date_time_start"], str):
        updated_walk["date_time_start"] = datetime.fromisoformat(updated_walk["date_time_start"])
    if isinstance(updated_walk["created_at"], str):
        updated_walk["created_at"] = datetime.fromisoformat(updated_walk["created_at"])
    if isinstance(updated_walk["updated_at"], str):
        updated_walk["updated_at"] = datetime.fromisoformat(updated_walk["updated_at"])
    
    return Walk(**updated_walk)

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()