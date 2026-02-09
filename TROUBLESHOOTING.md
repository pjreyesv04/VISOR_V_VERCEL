# 🔧 Guía de Solución de Problemas - VISOR

## 📋 Tabla de Contenidos

1. [Problemas de Autenticación](#problemas-de-autenticación)
2. [Errores de RLS (Row Level Security)](#errores-de-rls)
3. [Pérdida de Sesión](#pérdida-de-sesión)
4. [Usuarios sin Perfil](#usuarios-sin-perfil)
5. [Problemas de Rendimiento](#problemas-de-rendimiento)
6. [Diagnóstico del Sistema](#diagnóstico-del-sistema)
7. [Soluciones de Emergencia](#soluciones-de-emergencia)

---

## 🔐 Problemas de Autenticación

### ❌ "No se encontró el perfil de usuario"

**Causa:** Las políticas RLS están bloqueando el acceso al perfil del usuario.

**Solución:**

```sql
-- Ejecutar en Supabase SQL Editor
\i sql/fix_rls_definitivo.sql
```

O manualmente:

```sql
-- 1. Verificar que RLS esté habilitado
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'user_profiles';

-- 2. Si está deshabilitado, ejecutar el script completo
\i sql/fix_rls_definitivo.sql
```

---

### ❌ "Invalid login credentials"

**Causas posibles:**
1. Contraseña incorrecta
2. Usuario no existe
3. Email no confirmado

**Solución:**

```sql
-- 1. Verificar que el usuario existe
SELECT email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'usuario@email.com';

-- 2. Confirmar email (solo en desarrollo)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'usuario@email.com';

-- 3. Resetear contraseña (opción vía SQL - NO RECOMENDADO)
-- Mejor usar Supabase Dashboard → Authentication → Users → Reset Password
```

**Resetear contraseña vía Dashboard:**
1. Ir a [Supabase Dashboard](https://app.supabase.com)
2. Authentication → Users
3. Buscar el usuario
4. Click "..." → "Send Password Recovery" o "Edit User" → Cambiar contraseña

---

### ❌ El sistema carga directamente sin pedir credenciales

**Causa:** La sesión anterior sigue activa en localStorage.

**Solución rápida:**

```javascript
// Abrir DevTools (F12) → Console → Ejecutar:
localStorage.clear()
location.reload()
```

**Solución permanente:** Agregar botón de "Cerrar Sesión" visible en el navbar.

---

## 🛡️ Errores de RLS

### 🚨 "row-level security policy violation"

**Causa:** Las políticas RLS están mal configuradas o son demasiado restrictivas.

**Diagnóstico:**

```sql
-- Ver políticas actuales
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- Verificar si RLS está habilitado
SELECT rowsecurity FROM pg_tables WHERE tablename = 'user_profiles';
```

**Solución definitiva:**

```bash
# Ejecutar en Supabase SQL Editor
\i sql/fix_rls_definitivo.sql
```

**Solución temporal (SOLO DESARROLLO):**

```sql
-- ⚠️ ADVERTENCIA: Esto deshabilita la seguridad
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
```

**IMPORTANTE:** Nunca dejar RLS deshabilitado en producción.

---

### 🔄 Recursión infinita en políticas RLS

**Síntoma:** Consultas muy lentas o timeout al obtener perfil.

**Causa:** Políticas que verifican `user_profiles` dentro de `user_profiles` sin usar `LIMIT 1`.

**Solución:**

```sql
-- ❌ MALO (causa recursión)
CREATE POLICY "admin_read_all"
ON user_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ✅ BUENO (con LIMIT 1)
CREATE POLICY "admin_read_all"
ON user_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    LIMIT 1
  )
);
```

---

## ⏱️ Pérdida de Sesión

### 🔴 El sistema cierra sesión a los pocos segundos

**Causas posibles:**
1. RLS bloqueando acceso al perfil
2. Timer de inactividad mal configurado
3. Token expirando prematuramente

**Diagnóstico:**

```javascript
// Habilitar debug mode
localStorage.setItem('AUTH_DEBUG', 'true')
// Recargar la página y revisar logs en Console (F12)
```

**Solución 1 - Verificar RLS:**

```sql
\i sql/diagnostic_auth_system.sql
```

**Solución 2 - Ajustar timeout:**

Editar `src/contexts/AuthContext.jsx`:

```javascript
// Cambiar de 10 minutos a 2 horas (temporalmente)
const INACTIVITY_TIMEOUT = 120 * 60 * 1000;
```

**Solución 3 - Deshabilitar timeout (desarrollo):**

```javascript
// En src/contexts/AuthContext.jsx
// Comentar las líneas 105-130 (useEffect del inactivity timer)
```

---

### 🔄 "Token refresh failed"

**Causa:** El refresh token expiró o es inválido.

**Solución:**

```javascript
// Limpiar localStorage y forzar re-login
localStorage.clear()
sessionStorage.clear()
location.href = '/login'
```

---

## 👤 Usuarios sin Perfil

### 🚨 Usuario autenticado pero sin perfil en `user_profiles`

**Diagnóstico:**

```sql
-- Ver usuarios sin perfil
SELECT u.email, u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE user_id = u.id
);
```

**Solución:**

```sql
-- Crear perfiles faltantes
INSERT INTO user_profiles (user_id, nombre, role, activo)
SELECT 
  u.id,
  u.email,
  'auditor',
  true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE user_id = u.id
);
```

---

### 🔄 El trigger `handle_new_user()` no funciona

**Diagnóstico:**

```sql
-- Verificar si existe el trigger
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Verificar si existe la función
SELECT proname 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

**Solución:**

```sql
-- Recrear trigger y función
\i sql/setup_user_profiles.sql
```

---

## ⚡ Problemas de Rendimiento

### 🐌 Login muy lento (más de 3 segundos)

**Causas:**
1. Políticas RLS sin optimizar
2. Demasiadas consultas en `fetchProfile()`
3. Timeout muy corto

**Solución:**

```javascript
// En src/contexts/AuthContext.jsx
// Aumentar timeout
const PROFILE_FETCH_TIMEOUT = 10000; // 10 segundos
```

**Optimizar políticas RLS:**

```sql
-- Asegurarse que todas las políticas usan LIMIT 1
\i sql/fix_rls_definitivo.sql
```

---

### 📊 Dashboard carga lento

**Causa:** Demasiadas consultas o consultas sin índices.

**Solución:**

```sql
-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_supervisiones_auditor_id 
ON supervisiones(auditor_id);

CREATE INDEX IF NOT EXISTS idx_supervisiones_estado 
ON supervisiones(estado);

CREATE INDEX IF NOT EXISTS idx_supervisiones_fecha 
ON supervisiones(fecha DESC);

CREATE INDEX IF NOT EXISTS idx_respuestas_supervision_id 
ON respuestas(supervision_id);
```

---

## 🔍 Diagnóstico del Sistema

### Ejecutar diagnóstico completo

```sql
-- En Supabase SQL Editor
\i sql/diagnostic_auth_system.sql
```

Este script verifica:
- ✅ Estado de RLS
- ✅ Políticas configuradas
- ✅ Usuarios y perfiles
- ✅ Distribución de roles
- ✅ Integridad de datos
- ✅ Triggers y funciones
- ✅ Problemas detectados con soluciones

---

### Habilitar logs de debug

**En el navegador:**

```javascript
// Abrir DevTools (F12) → Console
localStorage.setItem('AUTH_DEBUG', 'true')
// Recargar la página
```

**Deshabilitar:**

```javascript
localStorage.removeItem('AUTH_DEBUG')
```

**Logs disponibles:**
- 🔍 DEBUG: Información detallada de cada paso
- ℹ️ INFO: Eventos importantes
- ⚠️ WARN: Advertencias no críticas
- ❌ ERROR: Errores que requieren atención
- ✅ SUCCESS: Operaciones exitosas

---

## 🚨 Soluciones de Emergencia

### 🔥 EMERGENCIA: Nadie puede iniciar sesión

**Solución rápida:**

```sql
-- 1. Deshabilitar RLS temporalmente
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 2. Verificar usuarios
SELECT u.email, up.nombre, up.role, up.activo
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id;

-- 3. Confirmar todos los emails (solo desarrollo)
UPDATE auth.users SET email_confirmed_at = NOW();

-- 4. Crear perfiles faltantes
INSERT INTO user_profiles (user_id, nombre, role, activo)
SELECT u.id, u.email, 'auditor', true
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = u.id);

-- 5. Re-habilitar RLS correctamente
\i sql/fix_rls_definitivo.sql
```

---

### 🔥 EMERGENCIA: Sistema en producción con RLS deshabilitado

**⚠️ RIESGO DE SEGURIDAD CRÍTICO**

```sql
-- Ejecutar INMEDIATAMENTE
\i sql/fix_rls_definitivo.sql

-- Verificar que funcionó
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ Seguro' ELSE '❌ VULNERABLE' END as estado
FROM pg_tables 
WHERE tablename = 'user_profiles';
```

---

### 🔥 EMERGENCIA: Eliminaste al último admin

```sql
-- Promover un usuario a admin
UPDATE user_profiles 
SET role = 'admin' 
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'tu_email@email.com'
);

-- Verificar
SELECT nombre, role FROM user_profiles WHERE role = 'admin';
```

---

## 📞 Contacto y Soporte

### Archivos clave para diagnóstico:

1. **`sql/fix_rls_definitivo.sql`** - Solución definitiva de RLS
2. **`sql/diagnostic_auth_system.sql`** - Diagnóstico completo
3. **`src/contexts/AuthContext.jsx`** - Lógica de autenticación
4. **`TROUBLESHOOTING.md`** - Este archivo

### Logs importantes:

```javascript
// En el navegador (F12 → Console)
// Buscar mensajes que contengan:
// - "AUTH ERROR"
// - "AUTH WARN"
// - "RLS"
// - "profile"
```

### Comandos útiles:

```sql
-- Ver todas las tablas
\dt

-- Ver estructura de una tabla
\d user_profiles

-- Ver todas las políticas
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

-- Ver todos los usuarios
SELECT * FROM auth.users;

-- Ver todos los perfiles
SELECT * FROM user_profiles;
```

---

## ✅ Checklist pre-producción

Antes de desplegar a producción, verificar:

- [ ] RLS está **HABILITADO** en `user_profiles`
- [ ] Al menos **2 usuarios admin** activos
- [ ] Todos los usuarios tienen perfil
- [ ] Trigger `handle_new_user()` funciona
- [ ] Políticas RLS optimizadas con `LIMIT 1`
- [ ] Diagnóstico `sql/diagnostic_auth_system.sql` sin errores
- [ ] Tests de login con usuarios admin, auditor, viewer
- [ ] Timeout de inactividad configurado (10-30 minutos)
- [ ] Logs de debug **DESHABILITADOS** en producción
- [ ] Backup de base de datos realizado

---

**Última actualización:** Febrero 9, 2026  
**Versión:** 1.0.0
