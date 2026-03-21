# Wouffy

Plataforma web para **conectar dueños de mascotas con paseadores**: perfiles, mascotas, búsqueda de paseadores y solicitudes de paseos. La interfaz y los mensajes están en **español**.

## Stack

| Parte | Tecnología |
|--------|------------|
| Frontend | React 19, Create React App + CRACO, Tailwind CSS, componentes Radix/shadcn, React Router 7, Axios |
| Backend | Python, FastAPI, Motor (MongoDB async), Pydantic |
| Datos | MongoDB |

## Requisitos previos

- **Node.js** (LTS recomendado) y **Yarn** 1.x (`packageManager` en `frontend/package.json`)
- **Python** 3.10+ (recomendado para coincidir con el entorno del proyecto)
- **MongoDB** accesible (local `mongod`, Docker o [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))

### MongoDB en local (elegí una opción)

#### Opción A — Docker (recomendado)

1. Instalá [Docker Desktop](https://www.docker.com/products/docker-desktop/) si no lo tenés y **abrilo** hasta que figure “running”.
2. Desde la raíz del repo:

```bash
./scripts/start-mongo.sh
```

(o `docker compose up -d`)

3. En `backend/.env` debe estar `MONGO_URL=mongodb://localhost:27017` (ya viene en `.env.example`).
4. **Reiniciá el backend** (uvicorn) para que tome la conexión.

#### Opción B — MongoDB Atlas (sin Docker)

1. En [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) creá un cluster **gratis** (M0).
2. **Database Access**: usuario y contraseña de aplicación.
3. **Network Access**: agregá `0.0.0.0/0` temporalmente para desarrollo (o tu IP fija).
4. **Connect → Drivers**: copiá la URI (sustituí `<password>`).
5. Pegala en `backend/.env` como `MONGO_URL=...` y reiniciá el backend.

#### Opción C — Homebrew

Solo si tu Xcode / Command Line Tools están actualizados: `brew tap mongodb/brew && brew install mongodb-community@7.0` y `brew services start mongodb-community@7.0`.

## Configuración del backend

1. Entrá al directorio del backend e instalá dependencias en un entorno virtual:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Copiá las variables de entorno y editá los valores:

```bash
cp .env.example .env
```

Variables necesarias:

| Variable | Descripción |
|----------|-------------|
| `MONGO_URL` | URI de MongoDB (ej. `mongodb://localhost:27017`) |
| `DB_NAME` | Nombre de la base de datos |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma. **No uses `*`** mientras el frontend envía credenciales: el navegador lo bloquea. Si lo dejás vacío, el backend usa `localhost:3000` y `127.0.0.1:3000` por defecto. |

3. Levantá la API con **uvicorn** (desde `backend/`, con el venv activado):

```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

La API queda en `http://localhost:8000` y las rutas bajo el prefijo **`/api`** (por ejemplo `http://localhost:8000/api/auth/me`).

Documentación interactiva de FastAPI: `http://localhost:8000/docs`.

## Configuración del frontend

1. Instalá dependencias (desde la raíz del repo):

```bash
cd frontend
yarn install
```

2. Opcional: copiá variables de entorno del frontend:

```bash
cp .env.example .env
```

En **desarrollo** (`yarn start`) las llamadas van a **`/api`** en el mismo origen (`localhost:3000`) y el archivo **`frontend/src/setupProxy.js`** reenvía todo `/api/*` a FastAPI en **`http://127.0.0.1:8000`** (incluye GET, PATCH, PUT, DELETE). Así **no hay CORS** entre puertos. No necesitás `REACT_APP_BACKEND_URL` en local. Opcional: `REACT_APP_PROXY_TARGET` si el backend corre en otro host/puerto.

En **producción** (`yarn build`), definí `REACT_APP_BACKEND_URL` con la URL pública del API (sin barra final).

3. Iniciá el servidor de desarrollo:

```bash
yarn start
```

La app abre en **`http://localhost:3000`** (puerto típico de Create React App).

## Flujo completo en local

1. Arrancá **MongoDB**.
2. En una terminal: backend (`uvicorn` como arriba).
3. En otra terminal: frontend (`yarn start`).
4. En **`frontend/`**: `yarn install` (necesario si se añadieron dependencias como `http-proxy-middleware` para el proxy).
5. Abrí el navegador en `http://localhost:3000`.

### Datos en MongoDB (local vs producción)

- **Producción** ya tiene usuarios y paseadores en la base remota.
- **Local** empezás con una base **vacía** (o solo lo que generó tu login). Por eso **`GET /api/walkers` puede devolver `[]`**: no hay documentos en la colección `walker_profiles` hasta que cargues datos de prueba.

Para insertar **paseadores demo** (misma lista que usa `seed_data.py`):

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
python seed_data.py
```

Reiniciá el frontend si cambiaste dependencias; el backend puede seguir en marcha.

### Autenticación en desarrollo

El login usa **Emergent** (redirección a `auth.emergentagent.com` y vuelta a `/auth/callback` o `/auth` con `session_id` en el **hash** o en **query**). El backend intercambia ese id con `demobackend.emergentagent.com` y crea la sesión en MongoDB.

En **HTTP local** (`localhost:3000` → `localhost:8000`) las cookies **no bastan**: distinto origen y cookies `Secure` no se guardan bien. Por eso, tras el login:

- La API devuelve **`session_token`** en el JSON de `POST /api/auth/session`, el frontend lo guarda en **`sessionStorage`** y envía **`Authorization: Bearer`** en las siguientes peticiones.
- Con `ENVIRONMENT=development` en `backend/.env`, la cookie también se emite con `secure=false` y `samesite=lax` por si el navegador la acepta.

Para pruebas sin OAuth, podés usar tokens demo de `TESTING.md` si existen en tu base.

Las peticiones Axios usan `withCredentials: true` y el origen del frontend debe estar en `CORS_ORIGINS`.

## Scripts útiles

| Ubicación | Comando | Descripción |
|-----------|---------|-------------|
| `backend/` | `python seed_data.py` | Inserta paseadores demo en MongoDB (local) |
| `frontend/` | `yarn start` | Servidor de desarrollo (CRACO) |
| `frontend/` | `yarn build` | Build de producción |
| `frontend/` | `yarn test` | Tests (Jest / CRA) |
| `backend/` | `uvicorn server:app --reload --host 0.0.0.0 --port 8000` | API en caliente |

## Nota sobre dependencias Python

El archivo `requirements.txt` no incluye el paquete privado `emergentintegrations` (no se usa en `server.py` y no está publicado en PyPI). Si en el futuro lo necesitás para otro entorno, volvé a añadirlo según la documentación de esa plataforma.

## Documentación adicional

- [`CHECKLIST_IMPLEMENTACION.md`](CHECKLIST_IMPLEMENTACION.md) — checklist de implementación y análisis de estado (abajo en ese archivo).
- [`TESTING.md`](TESTING.md) — usuarios demo y pruebas manuales en el entorno de preview.

## Licencia y estructura del repo

```
Wouffy/
├── backend/          # FastAPI (server.py, uploads, scripts de seed/demo)
├── frontend/         # React SPA
├── TESTING.md
└── CHECKLIST_IMPLEMENTACION.md
```
