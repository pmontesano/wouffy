from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Header, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, ValidationError
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
from enum import Enum

import shutil
from pymongo.errors import PyMongoError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


def _cors_allow_origins() -> List[str]:
    """
    Con allow_credentials=True el navegador no acepta Access-Control-Allow-Origin: *.
    Si CORS_ORIGINS no está definido o es *, usamos orígenes explícitos del CRA en local.
    """
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if not raw or raw == "*":
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    parts = [o.strip() for o in raw.split(",") if o.strip()]
    if "*" in parts:
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    return parts


# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# CORS lo antes posible (FastAPI): con credenciales no puede usarse *; debe ir antes de las rutas.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_allow_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enums
class UserRole(str, Enum):
    OWNER = "OWNER"
    WALKER = "WALKER"

class WalkStatus(str, Enum):
    REQUESTED = "REQUESTED"
    ACCEPTED = "ACCEPTED"
    WALKER_ON_THE_WAY = "WALKER_ON_THE_WAY"
    ARRIVED = "ARRIVED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"

class PetSize(str, Enum):
    S = "S"
    M = "M"
    L = "L"

class PetSpecies(str, Enum):
    DOG = "DOG"
    CAT = "CAT"
    OTHER = "OTHER"

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Optional[UserRole] = None
    created_at: datetime

class UserProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    profile_id: str = Field(default_factory=lambda: f"profile_{uuid.uuid4().hex[:12]}")
    user_id: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address_text: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address_text: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None

class PetModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    pet_id: str = Field(default_factory=lambda: f"pet_{uuid.uuid4().hex[:12]}")
    owner_user_id: str
    name: str
    species: PetSpecies
    size: PetSize
    date_of_birth: Optional[str] = None  # Formato: YYYY-MM-DD
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime

class PetCreate(BaseModel):
    name: str
    species: PetSpecies
    size: PetSize
    date_of_birth: Optional[str] = None  # Formato: YYYY-MM-DD
    notes: Optional[str] = None
    photo_url: Optional[str] = None

class PetUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[PetSpecies] = None
    size: Optional[PetSize] = None
    date_of_birth: Optional[str] = None  # Formato: YYYY-MM-DD
    notes: Optional[str] = None
    photo_url: Optional[str] = None

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
    walker_user_id: Optional[str] = None
    walker_profile_id: str
    pet_id: str
    pet_name: Optional[str] = None
    pet_size: Optional[PetSize] = None
    pet_notes: Optional[str] = None
    date_time_start: datetime
    estimated_duration_minutes: int
    actual_start_at: Optional[datetime] = None
    actual_end_at: Optional[datetime] = None
    start_address_text: str
    notes: Optional[str] = None
    status: WalkStatus = WalkStatus.REQUESTED
    created_at: datetime
    updated_at: datetime

class WalkCreate(BaseModel):
    pet_id: str
    walker_profile_id: str
    date_time_start: datetime
    estimated_duration_minutes: int
    start_address_text: str
    notes: Optional[str] = None

class WalkLocationPoint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    point_id: str = Field(default_factory=lambda: f"point_{uuid.uuid4().hex[:12]}")
    walk_id: str
    latitude: float
    longitude: float
    recorded_at: datetime

class WalkLocationCreate(BaseModel):
    latitude: float
    longitude: float

class WalkEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str = Field(default_factory=lambda: f"event_{uuid.uuid4().hex[:12]}")
    walk_id: str
    type: str  # REQUESTED, ACCEPTED, WALKER_ON_THE_WAY, ARRIVED, STARTED, COMPLETED, CANCELLED
    message: Optional[str] = None
    created_at: datetime

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
async def exchange_session(x_session_id: str = Header(..., alias="X-Session-ID")):
    """
    Intercambia X-Session-ID con demobackend y persiste usuario + sesión en MongoDB.
    Los 500 suelen ser Mongo caído o respuesta OAuth sin email/name/session_token.
    """
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    log = logging.getLogger(__name__)

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
                {
                    "$set": {
                        "name": data["name"],
                        "picture": data.get("picture"),
                    }
                },
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
            detail="No se pudo guardar la sesión: MongoDB no está disponible o MONGO_URL es incorrecta. "
            "Levantá Mongo (p. ej. docker compose up -d) y reiniciá el backend.",
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

@api_router.get("/auth/me")
async def get_me(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(session_token, authorization)
    return current_user

# Alias para compatibilidad
@api_router.get("/me")
async def get_me_alias(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    current_user = await get_current_user(session_token, authorization)
    return current_user

@api_router.post("/auth/logout")
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

# Profile Endpoints
@api_router.get("/me/profile", response_model=UserProfile)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if not profile:
        # Si no existe, crear uno vacío
        profile_doc = {
            "profile_id": f"profile_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "full_name": current_user.name,
            "phone": None,
            "address_text": None,
            "city": None,
            "avatar_url": current_user.picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_profiles.insert_one(profile_doc)
        profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    if isinstance(profile["created_at"], str):
        profile["created_at"] = datetime.fromisoformat(profile["created_at"])
    if isinstance(profile["updated_at"], str):
        profile["updated_at"] = datetime.fromisoformat(profile["updated_at"])
    
    return UserProfile(**profile)

@api_router.put("/me/profile", response_model=UserProfile)
async def update_my_profile(profile_update: UserProfileUpdate, current_user: User = Depends(get_current_user)):
    existing_profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    
    update_data = profile_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if not existing_profile:
        # Crear nuevo perfil
        profile_doc = {
            "profile_id": f"profile_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "full_name": update_data.get("full_name", current_user.name),
            "phone": update_data.get("phone"),
            "address_text": update_data.get("address_text"),
            "city": update_data.get("city"),
            "avatar_url": update_data.get("avatar_url", current_user.picture),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_profiles.insert_one(profile_doc)
    else:
        # Actualizar perfil existente
        await db.user_profiles.update_one(
            {"user_id": current_user.user_id},
            {"$set": update_data}
        )
    
    profile = await db.user_profiles.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if isinstance(profile["created_at"], str):
        profile["created_at"] = datetime.fromisoformat(profile["created_at"])
    if isinstance(profile["updated_at"], str):
        profile["updated_at"] = datetime.fromisoformat(profile["updated_at"])
    
    return UserProfile(**profile)

# Upload Endpoints
@api_router.post("/upload/pet-photo")
async def upload_pet_photo(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden subir fotos")
    
    # Validar tipo de archivo
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=422, detail="Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG o WEBP")
    
    # Validar tamaño (máximo 5MB)
    file_size = 0
    chunk_size = 1024 * 1024  # 1MB
    for chunk in iter(lambda: file.file.read(chunk_size), b''):
        file_size += len(chunk)
        if file_size > 5 * 1024 * 1024:  # 5MB
            raise HTTPException(status_code=422, detail="El archivo es demasiado grande. Máximo 5MB")
    
    file.file.seek(0)  # Reset file pointer
    
    # Generar nombre único para el archivo
    file_extension = file.filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4().hex[:12]}.{file_extension}"
    
    # Guardar archivo
    upload_dir = os.path.join(os.path.dirname(__file__), "uploads", "pets")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Retornar URL relativa
    photo_url = f"/api/uploads/pets/{unique_filename}"
    
    return {"photo_url": photo_url, "message": "Foto subida correctamente"}

# Pet Endpoints
@api_router.get("/me/pets", response_model=List[PetModel])
async def get_my_pets(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden gestionar mascotas")
    
    pets = await db.pets.find({"owner_user_id": current_user.user_id}, {"_id": 0}).to_list(100)
    
    for pet in pets:
        if isinstance(pet["created_at"], str):
            pet["created_at"] = datetime.fromisoformat(pet["created_at"])
        if isinstance(pet["updated_at"], str):
            pet["updated_at"] = datetime.fromisoformat(pet["updated_at"])
    
    return pets

@api_router.post("/me/pets", response_model=PetModel)
async def create_pet(pet_create: PetCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden crear mascotas")
    
    # Validación: si es perro, size es requerido
    if pet_create.species == PetSpecies.DOG and not pet_create.size:
        raise HTTPException(status_code=422, detail="El tamaño es requerido para perros")
    
    pet_doc = {
        "pet_id": f"pet_{uuid.uuid4().hex[:12]}",
        "owner_user_id": current_user.user_id,
        **pet_create.model_dump(),
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.pets.insert_one(pet_doc)
    
    # Si es la primera mascota, marcarla como default
    pet_count = await db.pets.count_documents({"owner_user_id": current_user.user_id})
    if pet_count == 1:
        await db.pets.update_one(
            {"pet_id": pet_doc["pet_id"]},
            {"$set": {"is_default": True}}
        )
    
    pet = await db.pets.find_one({"pet_id": pet_doc["pet_id"]}, {"_id": 0})
    if isinstance(pet["created_at"], str):
        pet["created_at"] = datetime.fromisoformat(pet["created_at"])
    if isinstance(pet["updated_at"], str):
        pet["updated_at"] = datetime.fromisoformat(pet["updated_at"])
    
    return PetModel(**pet)

@api_router.get("/me/pets/{pet_id}", response_model=PetModel)
async def get_pet(pet_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden ver mascotas")
    
    pet = await db.pets.find_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")
    
    if isinstance(pet["created_at"], str):
        pet["created_at"] = datetime.fromisoformat(pet["created_at"])
    if isinstance(pet["updated_at"], str):
        pet["updated_at"] = datetime.fromisoformat(pet["updated_at"])
    
    return PetModel(**pet)

@api_router.put("/me/pets/{pet_id}", response_model=PetModel)
async def update_pet(pet_id: str, pet_update: PetUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden editar mascotas")
    
    pet = await db.pets.find_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")
    
    update_data = pet_update.model_dump(exclude_unset=True)
    
    # Validación: si cambia a perro, size es requerido
    species = update_data.get("species", pet.get("species"))
    size = update_data.get("size", pet.get("size"))
    if species == PetSpecies.DOG and not size:
        raise HTTPException(status_code=422, detail="El tamaño es requerido para perros")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.pets.update_one(
        {"pet_id": pet_id, "owner_user_id": current_user.user_id},
        {"$set": update_data}
    )
    
    updated_pet = await db.pets.find_one({"pet_id": pet_id}, {"_id": 0})
    if isinstance(updated_pet["created_at"], str):
        updated_pet["created_at"] = datetime.fromisoformat(updated_pet["created_at"])
    if isinstance(updated_pet["updated_at"], str):
        updated_pet["updated_at"] = datetime.fromisoformat(updated_pet["updated_at"])
    
    return PetModel(**updated_pet)

@api_router.delete("/me/pets/{pet_id}")
async def delete_pet(pet_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden eliminar mascotas")
    
    pet = await db.pets.find_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")
    
    was_default = pet.get("is_default", False)
    
    result = await db.pets.delete_one({"pet_id": pet_id, "owner_user_id": current_user.user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")
    
    # Si era default, marcar otra como default
    if was_default:
        remaining_pets = await db.pets.find({"owner_user_id": current_user.user_id}, {"_id": 0}).to_list(1)
        if remaining_pets:
            await db.pets.update_one(
                {"pet_id": remaining_pets[0]["pet_id"]},
                {"$set": {"is_default": True}}
            )
    
    return {"message": "Mascota eliminada correctamente"}

@api_router.patch("/me/pets/{pet_id}/default", response_model=PetModel)
async def set_default_pet(pet_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden gestionar mascotas")
    
    pet = await db.pets.find_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")
    
    # Desmarcar todas las mascotas como default
    await db.pets.update_many(
        {"owner_user_id": current_user.user_id},
        {"$set": {"is_default": False}}
    )
    
    # Marcar esta como default
    await db.pets.update_one(
        {"pet_id": pet_id},
        {"$set": {"is_default": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    updated_pet = await db.pets.find_one({"pet_id": pet_id}, {"_id": 0})
    if isinstance(updated_pet["created_at"], str):
        updated_pet["created_at"] = datetime.fromisoformat(updated_pet["created_at"])
    if isinstance(updated_pet["updated_at"], str):
        updated_pet["updated_at"] = datetime.fromisoformat(updated_pet["updated_at"])
    
    return PetModel(**updated_pet)

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

# Helper function para crear eventos de paseo
async def create_walk_event(walk_id: str, event_type: str, message: Optional[str] = None):
    event_doc = {
        "event_id": f"event_{uuid.uuid4().hex[:12]}",
        "walk_id": walk_id,
        "type": event_type,
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.walk_events.insert_one(event_doc)

# Walk Endpoints
@api_router.post("/walks", response_model=Walk)
async def create_walk(walk_create: WalkCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden crear solicitudes de paseo")
    
    # Fetch pet details
    pet = await db.pets.find_one({"pet_id": walk_create.pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")

    walk_doc = {
        "walk_id": f"walk_{uuid.uuid4().hex[:12]}",
        "owner_user_id": current_user.user_id,
        **walk_create.model_dump(),
        "pet_name": pet["name"],
        "pet_size": pet["size"],
        "pet_notes": pet.get("notes"),
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
async def get_my_walks(current_user: User = Depends(get_current_user)):
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
async def get_incoming_walks(current_user: User = Depends(get_current_user)):
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

# Servir archivos estáticos (uploads)
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=uploads_dir), name="uploads")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()