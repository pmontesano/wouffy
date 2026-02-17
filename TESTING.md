# Wouffy - Pet Walker Marketplace MVP

¡Bienvenido a Wouffy! Una plataforma tipo "Rappi/Uber" para conectar dueños de mascotas con paseadores profesionales.

## 🚀 Acceso Rápido

**URL de la aplicación:** https://wouffy-walks.preview.emergentagent.com

## 🔐 Testing con Usuarios Demo

Como el flujo de autenticación con Google requiere interacción humana real, hemos creado usuarios de demostración para que puedas probar todas las funcionalidades.

### Opción 1: Testear como DUEÑO (OWNER)

1. Abrí la aplicación: https://wouffy-walks.preview.emergentagent.com
2. Abrí la consola del navegador (presiona `F12`)
3. En la pestaña "Console", pegá este comando y presiona Enter:
```javascript
document.cookie = 'session_token=demo_session_owner_a3c7011e637c; path=/; max-age=2592000'
```
4. Recargá la página (`F5` o `Ctrl+R`)
5. ¡Ya estás autenticado como OWNER!

**Funcionalidades disponibles como OWNER:**
- ✅ Buscar paseadores con mapa interactivo y filtros
- ✅ Ver perfiles detallados de paseadores
- ✅ Solicitar paseos (fecha, hora, duración, mascota)
- ✅ Ver tus solicitudes de paseo
- ✅ Cancelar solicitudes pendientes

### Opción 2: Testear como PASEADOR (WALKER)

1. **Primero cerrá sesión si estás logueado:**
```javascript
document.cookie = 'session_token=; path=/; max-age=0'
```
   Luego recargá la página

2. Abrí la consola del navegador (`F12`)
3. En la pestaña "Console", pegá este comando:
```javascript
document.cookie = 'session_token=demo_session_walker_28c9a5b1d911; path=/; max-age=2592000'
```
4. Recargá la página
5. ¡Ya estás autenticado como WALKER!

**Funcionalidades disponibles como WALKER:**
- ✅ Ver perfil de paseador (ya creado)
- ✅ Editar perfil de paseador
- ✅ Ver solicitudes de paseo entrantes
- ✅ Aceptar solicitudes de paseo
- ✅ Rechazar solicitudes de paseo

### 🧹 Para cerrar sesión

```javascript
document.cookie = 'session_token=; path=/; max-age=0'
```
Luego recargá la página.

---

**¡Disfrutá probando Wouffy!** 🐕 🐾
