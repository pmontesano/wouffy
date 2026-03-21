import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os
from dotenv import load_dotenv
from pathlib import Path
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def create_demo_users():
    print("🔧 Creando usuarios de demostración...")
    
    # Usuario OWNER demo
    owner_user_id = "demo_owner_001"
    owner_session_token = f"demo_session_owner_{uuid.uuid4().hex[:12]}"
    
    # Eliminar si existe
    await db.users.delete_many({"user_id": owner_user_id})
    await db.user_sessions.delete_many({"user_id": owner_user_id})
    
    # Crear usuario OWNER
    owner_user = {
        "user_id": owner_user_id,
        "email": "demo.owner@wouffy.com",
        "name": "Demo Owner",
        "picture": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
        "role": "OWNER",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(owner_user)
    
    # Crear sesión para OWNER
    owner_session = {
        "session_id": str(uuid.uuid4()),
        "user_id": owner_user_id,
        "session_token": owner_session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(owner_session)
    
    print(f"✅ Usuario OWNER creado:")
    print(f"   Email: demo.owner@wouffy.com")
    print(f"   Session Token: {owner_session_token}")
    
    # Usuario WALKER demo
    walker_user_id = "demo_walker_001"
    walker_session_token = f"demo_session_walker_{uuid.uuid4().hex[:12]}"
    
    # Eliminar si existe
    await db.users.delete_many({"user_id": walker_user_id})
    await db.user_sessions.delete_many({"user_id": walker_user_id})
    
    # Crear usuario WALKER
    walker_user = {
        "user_id": walker_user_id,
        "email": "demo.walker@wouffy.com",
        "name": "Demo Walker",
        "picture": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
        "role": "WALKER",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(walker_user)
    
    # Crear sesión para WALKER
    walker_session = {
        "session_id": str(uuid.uuid4()),
        "user_id": walker_user_id,
        "session_token": walker_session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(walker_session)
    
    # Crear perfil de walker para el usuario demo
    walker_profile = {
        "walker_id": "demo_walker_profile_001",
        "user_id": walker_user_id,
        "display_name": "Demo Walker",
        "photo_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
        "bio": "Paseador de demostración para testing. Amo a los animales y tengo mucha experiencia.",
        "experience_years": 5,
        "service_area_text": "Todas las zonas de Buenos Aires",
        "base_location_text": "Palermo, Buenos Aires",
        "price_per_hour": 750.0,
        "rating_avg": 4.9,
        "rating_count": 50,
        "availability_days": ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
        "availability_hours": "9:00 - 18:00",
        "latitude": -34.5889,
        "longitude": -58.4194,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.walker_profiles.insert_one(walker_profile)
    
    print(f"✅ Usuario WALKER creado:")
    print(f"   Email: demo.walker@wouffy.com")
    print(f"   Session Token: {walker_session_token}")
    print(f"   Walker Profile ID: demo_walker_profile_001")
    
    # Mascota demo del owner (pet_id estable para seeds)
    demo_pet_id = "pet_demo_owner_001"
    await db.pets.delete_many({"pet_id": demo_pet_id})
    now_iso = datetime.now(timezone.utc).isoformat()
    pet_doc = {
        "pet_id": demo_pet_id,
        "owner_user_id": owner_user_id,
        "name": "Rocky",
        "species": "DOG",
        "size": "M",
        "notes": "Muy juguetón y sociable",
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    await db.pets.insert_one(pet_doc)

    await db.walks.delete_many({"owner_user_id": owner_user_id})

    walk_1 = {
        "walk_id": f"walk_demo_{uuid.uuid4().hex[:12]}",
        "owner_user_id": owner_user_id,
        "walker_profile_id": "walker_001",
        "pet_id": demo_pet_id,
        "scheduled_start_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        "estimated_duration_minutes": 60,
        "start_address_text": "Av. Santa Fe 1234, Palermo",
        "notes": "Preferiblemente por la tarde",
        "status": "REQUESTED",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    await db.walks.insert_one(walk_1)
    
    walk_2 = {
        "walk_id": f"walk_demo_{uuid.uuid4().hex[:12]}",
        "owner_user_id": owner_user_id,
        "walker_profile_id": "demo_walker_profile_001",
        "pet_id": demo_pet_id,
        "scheduled_start_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        "estimated_duration_minutes": 30,
        "start_address_text": "Av. Libertador 5678, Belgrano",
        "notes": "Por favor traer correa corta",
        "status": "REQUESTED",
        "created_at": now_iso,
        "updated_at": now_iso
    }
    await db.walks.insert_one(walk_2)
    
    print(f"✅ 2 solicitudes de paseo de demostración creadas (con pet_id y scheduled_start_at)")
    
    print("\n" + "="*60)
    print("📋 INSTRUCCIONES PARA TESTING:")
    print("="*60)
    print("\n🔐 Para testear como OWNER:")
    print(f"   Abrí la consola del navegador (F12) y ejecutá:")
    print(f"   document.cookie = 'session_token={owner_session_token}; path=/; max-age=2592000'")
    print(f"   Luego recargá la página y ya estarás autenticado como OWNER")
    
    print("\n🚶 Para testear como WALKER:")
    print(f"   Abrí la consola del navegador (F12) y ejecutá:")
    print(f"   document.cookie = 'session_token={walker_session_token}; path=/; max-age=2592000'")
    print(f"   Luego recargá la página y ya estarás autenticado como WALKER")
    
    print("\n🧹 Para cerrar sesión:")
    print("   document.cookie = 'session_token=; path=/; max-age=0'")
    print("   Luego recargá la página")
    
    print("\n" + "="*60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_demo_users())
