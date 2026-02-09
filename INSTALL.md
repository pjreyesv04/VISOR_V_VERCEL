# 📦 Guía de Instalación Detallada - V.I.S.O.R

## Requisitos del Sistema

| Requisito | Versión Mínima | Recomendado |
|-----------|-----------------|------------|
| Node.js | 16.0.0 | 18.0.0+ |
| npm | 8.0.0 | 9.0.0+ |
| Sistema Operativo | Windows/macOS/Linux | Cualquiera |

---

## Windows

### 1. Instalar Node.js

1. Descarga de [nodejs.org](https://nodejs.org/)
2. Elige la versión LTS (Long Term Support)
3. Ejecuta el instalador `.msi`
4. Sigue los pasos por defecto

**Verificar instalación:**
```bash
node --version
npm --version
```

### 2. Clonar el Repositorio

```bash
git clone https://github.com/tuusuario/v.i.s.o.r.git
cd v.i.s.o.r/spvs-auditores
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Configurar Variables de Entorno

1. Copia `.env.example` a `.env.local`
2. Abre `.env.local` con tu editor favorito
3. Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

### 5. Iniciar Desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

---

## macOS

### 1. Instalar Node.js

**Opción A: Descarga Directa**
- Visita [nodejs.org](https://nodejs.org/)
- Descarga el instalador `.pkg` para macOS
- Ejecuta y sigue los pasos

**Opción B: Usando Homebrew** (Recomendado)
```bash
brew install node
```

**Verificar instalación:**
```bash
node --version
npm --version
```

### 2. Clonar y Configurar

```bash
# Clonar
git clone https://github.com/tuusuario/v.i.s.o.r.git
cd v.i.s.o.r/spvs-auditores

# Instalar dependencias
npm install

# Copiar env
cp .env.example .env.local

# Editar con tu editor favorito
nano .env.local
# o
code .env.local
```

### 3. Iniciar

```bash
npm run dev
```

---

## Linux (Ubuntu/Debian)

### 1. Instalar Node.js

```bash
# Actualizar package manager
sudo apt update
sudo apt upgrade

# Instalar Node.js
sudo apt install nodejs npm

# Verificar
node --version
npm --version
```

**Para versiones más recientes:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clonar y Configurar

```bash
git clone https://github.com/tuusuario/v.i.s.o.r.git
cd v.i.s.o.r/spvs-auditores
npm install
cp .env.example .env.local
nano .env.local  # Editar variables
```

### 3. Iniciar

```bash
npm run dev
```

---

## Configurar Supabase

### Paso 1: Crear Cuenta

1. Visita [supabase.com](https://supabase.com)
2. Haz clic en "Start your project"
3. Regístrate o inicia sesión

### Paso 2: Crear Proyecto

1. Haz clic en "New Project"
2. Elige tu organización
3. Nombre: `visor` o similar
4. Región: Más cercana a ti
5. Contraseña: Crea una segura
6. Espera a que se cree (2-3 minutos)

### Paso 3: Obtener Credenciales

1. Ve a **Settings** → **API**
2. Copia `Project URL` → `VITE_SUPABASE_URL`
3. Copia `anon public` key → `VITE_SUPABASE_ANON_KEY`
4. Pega en `.env.local`

### Paso 4: Crear Tablas

1. Ve a **SQL Editor**
2. Haz clic en "New Query"
3. Copia el contenido de `SETUP_AUDIT_TABLE.sql`
4. Pega y haz clic en **Run**

### Paso 5: Crear Usuario Admin

1. Ve a **Authentication** → **Users**
2. Haz clic en "Add user"
3. Email: `admin@supervision.com`
4. Contraseña: `Admin2026`
5. Haz clic en "Create user"

---

## Verificar Instalación

### Checks de Sistema

```bash
# Node.js
node -v              # Debe mostrar v16+

# npm
npm -v               # Debe mostrar 8+

# Git
git --version        # Para clonar repositorios
```

### Checks de Proyecto

```bash
# Desde la carpeta spvs-auditores

# Instalar dependencias
npm install

# Verificar linting
npm run lint

# Construir para producción
npm run build

# Revisar archivo dist/
ls dist/  # Debe existir
```

---

## Solucionar Problemas

### "npm: command not found"
- Node.js/npm no está instalado correctamente
- Reinicia la terminal después de instalar
- Verifica el PATH en variables de entorno

### "Module not found"
```bash
# Limpia node_modules y reinstala
rm -rf node_modules package-lock.json
npm install
```

### "VITE_SUPABASE_URL is undefined"
- Verifica que `.env.local` exista
- Comprueba que tienes ambas variables
- Reinicia `npm run dev`

### "Cannot connect to Supabase"
- Verifica credenciales en `.env.local`
- Comprueba que Supabase está online
- Verifica que el usuario existe en Supabase

### Puerto 5173 en uso
```bash
# Usa otro puerto
npm run dev -- --port 3000
```

---

## Siguiente Paso

¡Listo! Ahora:

1. Sigue la [QUICKSTART.md](./QUICKSTART.md) para primeros pasos
2. Lee [README.md](./README.md) para documentación completa
3. Consulta [CHANGELOG.md](./CHANGELOG.md) para el historial

---

## Soporte

Si encuentras problemas:

1. Revisa los logs de error
2. Consulta la consola de navegador (F12)
3. Abre un issue en GitHub
4. Contacta al equipo de desarrollo

---

**¡Bienvenido a V.I.S.O.R!** 🎉
