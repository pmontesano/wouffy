"""
Todos los modelos Pydantic y enums de Wouffy.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

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
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address_text: Optional[str] = None
    city: Optional[str] = None
    avatar_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime


class RoleUpdate(BaseModel):
    role: UserRole


# ---------------------------------------------------------------------------
# Pet
# ---------------------------------------------------------------------------

class PetModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    pet_id: str = Field(default_factory=lambda: f"pet_{uuid.uuid4().hex[:12]}")
    owner_user_id: str
    name: str
    species: PetSpecies
    size: PetSize
    date_of_birth: Optional[str] = None  # YYYY-MM-DD
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime


class PetCreate(BaseModel):
    name: str
    species: PetSpecies
    size: PetSize
    date_of_birth: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class PetUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[PetSpecies] = None
    size: Optional[PetSize] = None
    date_of_birth: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Walker
# ---------------------------------------------------------------------------

class WalkerProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    walker_id: str = Field(default_factory=lambda: f"walker_{uuid.uuid4().hex[:12]}")
    user_id: str
    display_name: str
    photo_url: Optional[str] = None
    bio: str
    experience_years: int
    service_area_text: str
    base_location_text: Optional[str] = None
    price_per_hour: float
    rating_avg: float = 5.0
    rating_count: int = 0
    availability_days: List[str] = []
    available_start_time: Optional[str] = None  # "09:00"
    available_end_time: Optional[str] = None    # "18:00"
    availability_hours: str = ""               # legacy — solo lectura
    # Nuevos campos de negocio
    max_dogs: int = 5                          # Capacidad máxima por franja
    allowed_sizes: List[PetSize] = [PetSize.S, PetSize.M, PetSize.L]  # Tallas aceptadas
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class WalkerProfileCreate(BaseModel):
    display_name: str
    bio: str
    experience_years: int
    service_area_text: str
    price_per_hour: float
    availability_days: List[str] = []
    available_start_time: Optional[str] = None
    available_end_time: Optional[str] = None
    max_dogs: int = 5
    allowed_sizes: List[PetSize] = [PetSize.S, PetSize.M, PetSize.L]


# ---------------------------------------------------------------------------
# Walk
# ---------------------------------------------------------------------------

class Walk(BaseModel):
    """Modelo unificado; scheduled_start_at es el campo canónico."""
    model_config = ConfigDict(extra="ignore")
    walk_id: str = Field(default_factory=lambda: f"walk_{uuid.uuid4().hex[:12]}")
    owner_user_id: str
    walker_profile_id: Optional[str] = None
    pet_id: str
    status: WalkStatus = WalkStatus.REQUESTED
    scheduled_start_at: datetime
    actual_start_at: Optional[datetime] = None
    actual_end_at: Optional[datetime] = None
    notes: Optional[str] = None
    finalization_source: Optional[str] = None  # "WALKER" | "SYSTEM"
    created_at: datetime
    updated_at: datetime


class WalkCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    pet_id: str
    walker_profile_id: str
    scheduled_start_at: Optional[datetime] = None
    notes: Optional[str] = None
    estimated_duration_minutes: Optional[int] = None
    start_address_text: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def legacy_scheduled_start(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("scheduled_start_at") is None and data.get("date_time_start") is not None:
                return {**data, "scheduled_start_at": data["date_time_start"]}
        return data

    @model_validator(mode="after")
    def scheduled_start_required(self) -> "WalkCreate":
        if self.scheduled_start_at is None:
            raise ValueError("scheduled_start_at es requerido")
        return self


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


class WalkListItem(BaseModel):
    walk: Walk
    pet: Optional[PetModel] = None
    estimated_duration_minutes: Optional[int] = None
    start_address_text: Optional[str] = None


class WalkDetailResponse(BaseModel):
    walk: Walk
    pet: PetModel
    walker: Optional[WalkerProfile] = None


class WalkTransitionBody(BaseModel):
    notes: Optional[str] = None


class WalkTimelineEventItem(BaseModel):
    event_type: str
    created_at: str
    metadata: dict


class WalkRatingCreate(BaseModel):
    """Rating que el dueño deja al walker al completar un paseo."""
    rating: int = Field(..., ge=1, le=5, description="Puntaje de 1 a 5")
    comment: Optional[str] = Field(None, max_length=500)


class WalkRating(BaseModel):
    model_config = ConfigDict(extra="ignore")
    rating_id: str
    walk_id: str
    walker_id: str
    owner_user_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime
