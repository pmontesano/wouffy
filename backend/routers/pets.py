"""
Endpoints de mascotas (solo rol OWNER).
"""
from __future__ import annotations

import os
import shutil
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from db import db
from dependencies import get_current_user
from models import PetCreate, PetModel, PetSpecies, PetUpdate, User, UserRole

router = APIRouter(prefix="/me/pets", tags=["pets"])


def _require_owner(current_user: User) -> None:
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Solo usuarios con rol OWNER pueden gestionar mascotas")


def _parse_pet_dates(pet: dict) -> dict:
    for k in ("created_at", "updated_at"):
        if isinstance(pet.get(k), str):
            pet[k] = datetime.fromisoformat(pet[k].replace("Z", "+00:00"))
    return pet


@router.get("", response_model=List[PetModel])
async def get_my_pets(current_user: User = Depends(get_current_user)):
    _require_owner(current_user)
    pets = await db.pets.find({"owner_user_id": current_user.user_id}, {"_id": 0}).to_list(100)
    return [PetModel(**_parse_pet_dates(p)) for p in pets]


@router.post("", response_model=PetModel)
async def create_pet(pet_create: PetCreate, current_user: User = Depends(get_current_user)):
    _require_owner(current_user)

    if pet_create.species == PetSpecies.DOG and not pet_create.size:
        raise HTTPException(status_code=422, detail="El tamaño es requerido para perros")

    pet_doc = {
        "pet_id": f"pet_{uuid.uuid4().hex[:12]}",
        "owner_user_id": current_user.user_id,
        **pet_create.model_dump(),
        "is_default": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.pets.insert_one(pet_doc)

    # Primera mascota → default automático
    pet_count = await db.pets.count_documents({"owner_user_id": current_user.user_id})
    if pet_count == 1:
        await db.pets.update_one({"pet_id": pet_doc["pet_id"]}, {"$set": {"is_default": True}})

    pet = await db.pets.find_one({"pet_id": pet_doc["pet_id"]}, {"_id": 0})
    return PetModel(**_parse_pet_dates(pet))


@router.get("/{pet_id}", response_model=PetModel)
async def get_pet(pet_id: str, current_user: User = Depends(get_current_user)):
    _require_owner(current_user)
    pet = await db.pets.find_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")
    return PetModel(**_parse_pet_dates(pet))


@router.put("/{pet_id}", response_model=PetModel)
async def update_pet(pet_id: str, pet_update: PetUpdate, current_user: User = Depends(get_current_user)):
    _require_owner(current_user)

    pet = await db.pets.find_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")

    update_data = pet_update.model_dump(exclude_unset=True)

    species = update_data.get("species", pet.get("species"))
    size = update_data.get("size", pet.get("size"))
    if species == PetSpecies.DOG and not size:
        raise HTTPException(status_code=422, detail="El tamaño es requerido para perros")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.pets.update_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"$set": update_data})

    updated_pet = await db.pets.find_one({"pet_id": pet_id}, {"_id": 0})
    return PetModel(**_parse_pet_dates(updated_pet))


@router.delete("/{pet_id}")
async def delete_pet(pet_id: str, current_user: User = Depends(get_current_user)):
    _require_owner(current_user)

    pet = await db.pets.find_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")

    was_default = pet.get("is_default", False)
    result = await db.pets.delete_one({"pet_id": pet_id, "owner_user_id": current_user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")

    if was_default:
        remaining = await db.pets.find({"owner_user_id": current_user.user_id}, {"_id": 0}).to_list(1)
        if remaining:
            await db.pets.update_one({"pet_id": remaining[0]["pet_id"]}, {"$set": {"is_default": True}})

    return {"message": "Mascota eliminada correctamente"}


@router.patch("/{pet_id}/default", response_model=PetModel)
async def set_default_pet(pet_id: str, current_user: User = Depends(get_current_user)):
    _require_owner(current_user)

    pet = await db.pets.find_one({"pet_id": pet_id, "owner_user_id": current_user.user_id}, {"_id": 0})
    if not pet:
        raise HTTPException(status_code=404, detail="Mascota no encontrada")

    await db.pets.update_many({"owner_user_id": current_user.user_id}, {"$set": {"is_default": False}})
    await db.pets.update_one(
        {"pet_id": pet_id},
        {"$set": {"is_default": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    updated_pet = await db.pets.find_one({"pet_id": pet_id}, {"_id": 0})
    return PetModel(**_parse_pet_dates(updated_pet))


# --- Upload foto de mascota ---
@router.post("/photo", tags=["uploads"])
async def upload_pet_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _require_owner(current_user)

    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=422, detail="Solo se permiten imágenes JPG, PNG o WEBP")

    file_size = 0
    chunk_size = 1024 * 1024
    for chunk in iter(lambda: file.file.read(chunk_size), b""):
        file_size += len(chunk)
        if file_size > 5 * 1024 * 1024:
            raise HTTPException(status_code=422, detail="El archivo es demasiado grande. Máximo 5MB")

    file.file.seek(0)

    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4().hex[:12]}.{file_extension}"

    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "pets")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    photo_url = f"/api/uploads/pets/{unique_filename}"
    return {"photo_url": photo_url, "message": "Foto subida correctamente"}
