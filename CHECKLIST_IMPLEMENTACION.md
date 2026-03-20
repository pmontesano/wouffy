# ✅ Checklist de Implementación - Flujo Post-Login Wouffy

## 📋 CONTEXTO
- [x] Login/registro existe y funciona
- [x] Frontend: React con react-router-dom v7
- [x] Backend: Python FastAPI con venv
- [x] DB: MongoDB (persistencia real)
- [x] Todo en español (labels, mensajes, UI)

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

## 🚀 ESTADO FINAL

✅ **IMPLEMENTACIÓN COMPLETA Y FUNCIONAL**

Todos los requisitos principales han sido implementados y probados. El flujo post-login está completamente funcional con:
- Perfil de usuario editable
- Gestión completa de mascotas
- Validaciones correctas
- UI/UX profesional
- Todo en español
- Seguridad y autorización correctas

---

## Análisis de estado (revisión del checklist)

### Completado según el documento

Todo lo marcado con `[x]` en las secciones anteriores está considerado **hecho**: contexto, objetivos post-login (cuenta, mascotas, CRUD, default), modelo User/UserProfile/Pet, reglas de negocio, endpoints de auth/perfil/mascotas, rutas y UI de `/app/account` y `/app/pets`, autorización front/back, validaciones, extras (auto-perfil, primera mascota default, reasignación al borrar, preview de foto, diseño responsive, etc.).

### Pendiente u opcional (explícito en este archivo)

| Ítem | Notas |
|------|--------|
| **react-hook-form + zod** | Marcado como no implementado a propósito; se usa validación manual que cumple el mismo rol. |
| **Seed data de mascotas demo** | No incluido; las mascotas se crean a mano o vía UI. |
| **Layout dedicado `/app` con navbar propio** | No hecho; se reutiliza el navbar global de la app. |

### Detalle de modelo (documentación vs código)

El modelo **Pet** en código usa **`date_of_birth`** (opcional); la edad se puede mostrar calculada en el frontend (ver `TESTING.md`).

### Resumen

Los **requisitos principales** del checklist están cubiertos. Lo **único pendiente** listado aquí son mejoras opcionales (librerías de formulario, seeds, layout `/app`) y el ajuste de documentación del campo de edad/fecha de nacimiento.
