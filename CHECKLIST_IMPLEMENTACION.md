# ✅ Checklist de Implementación - Flujo Post-Login Wouffy

## 📋 CONTEXTO
- [x] Login/registro existe y funciona
- [x] Frontend: React con react-router-dom v7
- [x] Backend: Python FastAPI con venv
- [x] DB: MongoDB (persistencia real)
- [x] Todo en español (labels, mensajes, UI)
- [x] Flujo de **paseos (walks)** con scheduling, estados y timeline (ver secciones más abajo)

> **Agentes:** continuidad técnica y archivos clave → sección [Memoria para agentes (continuidad)](#memoria-para-agentes-continuidad) al final de este documento. Carpeta `memory/`: [`AGENT_CONTEXT.md`](memory/AGENT_CONTEXT.md) apunta aquí.

## 🎯 OBJETIVO
- [x] 1) Ver su "Cuenta / Perfil" → `/app/account`
- [x] 2) Ver su lista de Mascotas → `/app/pets`
- [x] 3) Crear/editar/eliminar mascotas → Todos los endpoints funcionan
- [x] 4) Asociar mascotas al usuario autenticado automáticamente → `ownerUserId` desde token
- [x] 5) Poder seleccionar una mascota por defecto → `PATCH /api/me/pets/:petId/default`

## 💾 MODELO DE DATOS

### User (ya existía)
- [x] id (user_id string)
- [x] email
- [x] name
- [x] role (OWNER/WALKER)
- [x] created_at

### UserProfile (nuevo)
- [x] profile_id
- [x] user_id (FK)
- [x] full_name
- [x] phone (opcional)
- [x] address_text (opcional)
- [x] city (opcional)
- [x] avatar_url (opcional)
- [x] created_at
- [x] updated_at

### Pet (nuevo)
- [x] pet_id
- [x] owner_user_id (FK → User.user_id)
- [x] name
- [x] species (DOG/CAT/OTHER)
- [x] size (S/M/L)
- [x] date_of_birth (opcional, formato YYYY-MM-DD)
- [x] notes (opcional)
- [x] photo_url (opcional)
- [x] is_default (boolean)
- [x] created_at
- [x] updated_at

## ⚖️ REGLAS DE NEGOCIO
- [x] Solo usuarios con rol OWNER pueden crear/gestionar mascotas
- [x] ownerUserId SIEMPRE se toma del usuario autenticado (no del body)
- [x] Solo 1 mascota puede tener isDefault=true por usuario
- [x] Si seteo una como default, se desmarcan las demás automáticamente
- [x] Pet.name requerido
- [x] species requerido
- [x] size requerido si species=DOG
- [x] Respuestas de error: 401 (no auth), 403 (rol incorrecto), 404 (no existe), 422 (validación)

## 🔌 API ENDPOINTS

### Auth (ya existía)
- [x] POST /api/auth/session → Intercambio de sesión
- [x] GET /api/auth/me → Info del usuario autenticado
- [x] POST /api/auth/logout → Cerrar sesión
- [x] PATCH /api/auth/role → Actualizar rol

### Account/Profile (nuevo)
- [x] GET /api/me → Alias de /api/auth/me ✨ NUEVO
- [x] GET /api/me/profile → Retorna UserProfile (auto-crea si no existe)
- [x] PUT /api/me/profile → Upsert (crear o actualizar) UserProfile

### Pets (nuevo) - Solo OWNER
- [x] GET /api/me/pets → Lista de mascotas del usuario
- [x] POST /api/me/pets → Crear mascota (primera se marca default automáticamente)
- [x] GET /api/me/pets/:petId → Detalle (solo si pertenece al user)
- [x] PUT /api/me/pets/:petId → Editar mascota
- [x] DELETE /api/me/pets/:petId → Borrar (reasigna default si era la default)
- [x] PATCH /api/me/pets/:petId/default → Setear como default (desmarca otras)

## 🎨 FRONTEND (React Router)

### Rutas nuevas
- [x] /app/account → Mi cuenta (editar perfil)
- [x] /app/pets → Mis mascotas (listado)
- [x] /app/pets/new → Crear mascota
- [x] /app/pets/:petId/edit → Editar mascota

### Comportamiento
- [x] Después de login exitoso, redirigir a `/app/account` ✨ ACTUALIZADO
- [x] Navbar con enlace "Mi Cuenta" (desktop + mobile)
- [x] En /app/account:
  - [x] Mostrar datos básicos del usuario
  - [x] Form para editar perfil completo
  - [x] Estados: loading, error, success toast
  - [x] Link a "Mis Mascotas"
- [x] En /app/pets:
  - [x] Listado en cards visuales
  - [x] Foto (placeholder si no hay)
  - [x] Nombre, especie, tamaño
  - [x] Badge "Predeterminada" con estrella
  - [x] Botón "Agregar mascota"
  - [x] Acciones: Editar, Borrar, "Marcar como default"
- [x] En /app/pets/new y edit:
  - [x] Form con validación
  - [x] Al guardar, volver a /app/pets
  - [x] Toast de éxito/error

### Componentes UI
- [x] Cards con gradientes y sombras
- [x] Iconos por especie (Dog/Cat de lucide-react)
- [x] Animaciones con framer-motion
- [x] Botones pill-shaped
- [x] Todo en español

## 🔐 AUTORIZACIÓN

### Frontend
- [x] ProtectedRoute: Si no hay sesión, redirigir a /login
- [x] Axios con withCredentials: true
- [x] Interceptor axios para 401 global → logout automático ✨ NUEVO

### Backend
- [x] Middleware get_current_user con FastAPI Depends
- [x] Validación de token en Cookie o Authorization header
- [x] Validación de rol para endpoints de mascotas
- [x] Errores claros con códigos HTTP correctos

## 📊 VALIDACIONES IMPLEMENTADAS

### Backend
- [x] Pet.name no vacío
- [x] Pet.species válido (DOG/CAT/OTHER)
- [x] Pet.size requerido si species=DOG
- [x] Solo OWNER puede acceder a endpoints de mascotas
- [x] Solo puedo ver/editar/borrar MIS mascotas
- [x] Solo 1 mascota default por usuario

### Frontend
- [x] Validación de campos requeridos
- [x] Mensajes de error claros en español
- [x] Confirmación antes de borrar
- [x] Loading states en todas las operaciones

## 🎁 EXTRAS IMPLEMENTADOS

### Mejoras adicionales
- [x] Auto-creación de perfil en primera llamada a GET /api/me/profile
- [x] Primera mascota se marca como default automáticamente
- [x] Al borrar mascota default, se reasigna a otra automáticamente
- [x] Preview de foto en formulario de mascota
- [x] Diseño consistente con el resto de Wouffy (colores verde mint y naranja peach)
- [x] Responsive design (funciona en móvil y desktop)

## ⚠️ NOTAS OPCIONALES NO IMPLEMENTADAS

- [ ] react-hook-form + zod (se usó validación manual que funciona igual)
- [ ] Seed data de mascotas demo (no necesario, se pueden crear fácilmente)
- [ ] Layout específico /app con navbar dedicado (se usa el navbar global de Wouffy)

---

## 🐕 WALKS / PASEOS (implementado)

### Modelo Walk (unificado)
- [x] `walk_id`, `owner_user_id`, `walker_profile_id`, `pet_id`, estados `WalkStatus`
- [x] `scheduled_start_at` (en DB legacy: `date_time_start` se mapea al leer)
- [x] `actual_start_at`, `actual_end_at`, `notes`, `created_at`, `updated_at`
- [x] `finalization_source` opcional: `WALKER` (cierre manual) | `SYSTEM` (cierre por tiempo vencido)
- [x] Listas enriquecidas: `WalkListItem` con `walk` + `pet` + `estimated_duration_minutes` / `start_address_text` (fallback legacy)

### Estados y transiciones
- [x] Cadena: REQUESTED → ACCEPTED → WALKER_ON_THE_WAY → ARRIVED → IN_PROGRESS → COMPLETED
- [x] Terminales: CANCELLED, REJECTED
- [x] PATCH: `accept`, `reject`, `cancel`, `on-the-way`, `arrived`, `start`, `complete`
- [x] Solo el walker asignado avanza estados operativos; validación de estado previo

### Eventos / timeline
- [x] `create_walk_event(db, walk_id, event_type, metadata, actor=…)` en `walk_service`
- [x] GET `/api/walks/{walk_id}/events` — timeline; eventos legacy (`type`/`message`) normalizados al leer
- [x] `walk_finalized` con metadata (`reason: stale_in_progress_timeout`, `expected_end_at`, `detected_at`, `actor: SYSTEM`)

### Cierre automático (staleness)
- [x] `maybe_finalize_stale_walk`: si IN_PROGRESS y ya pasó ventana inicio+duración (+ gracia 5 min) → COMPLETED con `finalization_source=SYSTEM`
- [x] Se ejecuta al listar/detalle/eventos para corregir datos colgados

### API walks (resumen)
- [x] POST `/api/walks`, GET `/walks/me`, GET `/walks/incoming`, GET `/walks/{id}`, GET `/walks/{id}/events`
- [x] PATCH transiciones (walker/owner según regla)
- [x] Validación **Smart Scheduling** en POST (módulo `scheduling.py`)

### Archivos backend
| Área | Archivo |
|------|---------|
| Rutas walks | `backend/server.py` |
| Dominio walk | `backend/services/walk_service.py` |
| Scheduling | `backend/services/scheduling.py` |
| Seeds demo | `backend/create_demo_users.py` |

### Archivos frontend
| Área | Archivo |
|------|---------|
| Solicitar paseo + UX scheduling | `frontend/src/pages/CreateWalkRequest.js` |
| Mis solicitudes / solicitudes walker | `frontend/src/pages/MyWalks.js`, `WalkerRequests.js` |
| Helpers slots / lead time | `frontend/src/utils/walkScheduling.js` |
| Tests helpers | `frontend/src/utils/walkScheduling.test.js` |
| Labels estado (completado vs finalizado) | `frontend/src/utils/api.js` |

---

## ⏰ SMART SCHEDULING v1 (Solicitar paseo)

### Reglas de negocio
- [x] `MIN_BOOKING_LEAD_TIME_MINUTES = 60`
- [x] Horario operativo inicio de paseo: 08:00–20:00 (validación fin del paseo **no** incluida en este scope)
- [x] Slots cada 30 minutos en UI
- [x] Backend: constantes en `scheduling.py`; TZ `WALK_SCHEDULING_TZ` (default Argentina)

### Comportamiento UI
- [x] Fecha min/max; si “hoy” no tiene slots, min puede ser mañana
- [x] Horas dependen de la fecha; al cambiar fecha se recalcula hora (auto primer slot o reset)
- [x] Mensajes: anticipación 1 h, sin horarios hoy, seleccionar fecha primero
- [x] CTA deshabilitada si datos incompletos o horario inválido
- [x] Resumen con fecha/hora/dirección resumida

### Tests
- [x] `yarn test --testPathPattern=walkScheduling` (helpers)

### Pendiente (fuera de scope explícito)
- [ ] Validar que **fin** del paseo quede dentro de franja operativa
- [ ] Disponibilidad real por walker / solapes
- [ ] Tracking en mapa en vivo

---

## ✅ TESTING

Para probar:
1. Autenticarse como OWNER usando token demo:
```javascript
document.cookie = 'session_token=demo_session_owner_a3c7011e637c; path=/; max-age=2592000'
```

2. Navegar a `/app/account` para ver perfil

3. Click en "Ver Mascotas" o ir a `/app/pets`

4. Crear, editar, eliminar y marcar mascotas como default

5. Verificar que los endpoints funcionan:
```bash
# Ver mi perfil
curl -X GET "https://paseo-live.preview.emergentagent.com/api/me/profile" \
  -H "Authorization: Bearer demo_session_owner_a3c7011e637c"

# Ver mis mascotas
curl -X GET "https://paseo-live.preview.emergentagent.com/api/me/pets" \
  -H "Authorization: Bearer demo_session_owner_a3c7011e637c"
```

## 🚀 ESTADO DEL PROYECTO

✅ **Flujo post-login (cuenta + mascotas):** implementado según secciones iniciales de este checklist.

✅ **Flujo de paseos (walks):** modelo unificado, máquina de estados, eventos, cierre automático por tiempo, listas con mascota, Smart Scheduling v1 en “Solicitar paseo” + validación equivalente en backend.

### Pendiente u opcional (explícito)

| Ítem | Notas |
|------|--------|
| **react-hook-form + zod** | Opcional; hay validación manual. |
| **Seed data de mascotas demo** | Opcional; `create_demo_users.py` cubre usuarios/walks demo; mascotas se pueden crear en UI. |
| **Layout dedicado `/app` con navbar propio** | No hecho; navbar global. |
| **Walks** | Ver tabla “Pendiente (fuera de scope)” en Smart Scheduling y sección walks. |

### Detalle de modelo

- **Pet:** `date_of_birth` opcional en código.
- **Walk:** lectura tolera documentos legacy (`date_time_start`, `duration_minutes`, etc.).

---

## 🧠 Memoria para agentes (continuidad)

Este bloque resume **qué existe** y **cómo seguir** sin releer todo el historial del chat.

### Arquitectura rápida
- **Auth:** cookie `session_token` y/o `Authorization: Bearer` desde `sessionStorage` (`wouffy_session_token` en dev). Ver `frontend/src/utils/api.js` y `AuthContext`.
- **Walks:** el backend es **fuente de verdad**; el front solo filtra UX (slots, fechas). Siempre validar scheduling en `POST /api/walks`.
- **Zona horaria:** reglas de negocio de horario (08–20) y lead time en backend usan `APP_TIMEZONE` (`WALK_SCHEDULING_TZ`). El front genera slots en **hora local del navegador**; usuarios fuera de AR pueden discrepar hasta que se unifique TZ en el cliente.

### Dónde tocar qué

| Cambio deseado | Dónde mirar primero |
|----------------|---------------------|
| Reglas de reserva (lead, franja, intervalo) | `backend/services/scheduling.py` + `frontend/src/utils/walkScheduling.js` (mantener alineados) |
| Estados del paseo / transiciones | `backend/services/walk_service.py` + rutas PATCH en `server.py` |
| Eventos timeline | `create_walk_event`, colección `walk_events`, normalización en `event_to_timeline_item` |
| Stale IN_PROGRESS → COMPLETED | `maybe_finalize_stale_walk` (metadata del evento `walk_finalized`) |
| UI solicitar paseo | `CreateWalkRequest.js` |
| Labels “Paseo completado” vs “Paseo finalizado” | `finalization_source` + `getWalkStatusLabel` en `api.js` |

### Comandos útiles
```bash
# Tests scheduling (frontend)
cd frontend && yarn test --watchAll=false --testPathPattern=walkScheduling

# Sintaxis backend
cd backend && python3 -m py_compile server.py services/walk_service.py services/scheduling.py
```

### Seeds / demo
- `backend/create_demo_users.py` — owner/walker demo, mascota `pet_demo_owner_001`, walks con `scheduled_start_at` y `pet_id`.
- `backend/seed_data.py` — listado de walkers mock (no walks).

### Próximos pasos sugeridos (producto)
1. Pantalla detalle de paseo para owner/walker consumiendo `GET /api/walks/{id}` + `GET /api/walks/{id}/events` (timeline).
2. Validar **fin** del paseo dentro de ventana operativa (requiere acordar regla con duración).
3. Disponibilidad por walker / anti-solapes (modelo y queries).
4. Unificar TZ frontend con `WALK_SCHEDULING_TZ` si hay usuarios fuera de Argentina.

### Qué no hacer sin spec nuevo
- Tracking en mapa en tiempo real (fue explícitamente fuera de scope en iteraciones anteriores).
- Confiar solo en validación del front para fechas/horas de walks.

---

## Análisis de estado (revisión del checklist)

### Completado según el documento

Incluye: contexto, objetivos post-login (cuenta, mascotas, CRUD, default), modelo User/UserProfile/Pet, reglas de negocio, endpoints de auth/perfil/mascotas, rutas y UI de `/app/account` y `/app/pets`, autorización, **y además** el dominio de walks (modelo, estados, eventos, scheduling, UI de solicitud, seeds alineados).

### Resumen

Los requisitos principales del checklist **histórico** y las extensiones de **walks + scheduling** documentadas arriba están cubiertas en código. Lo pendiente son mejoras opcionales listadas en tablas y la sección “Próximos pasos sugeridos”.
