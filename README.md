# V.I.S.O.R

## Vigilancia, Inspección y Supervisión de Operatividad y Registros

**Versión 1.0.0**

Sistema integral de gestión de supervisiones y auditoría para instituciones de salud. V.I.S.O.R proporciona herramientas para realizar, documentar y auditar supervisiones de establecimientos de salud con generación de reportes, trazabilidad completa y control de acceso basado en roles.

---

## 🎯 Características Principales

### Gestión de Supervisiones
- 📋 Creación y edición de actas de supervisión con formularios dinámicos
- 📸 Captura de firmas digitales de supervisores, digitadores y médicos jefes
- 📷 Carga y gestión de evidencias y documentación
- 📊 Parámetros de supervisión configurables por institución
- 🏥 Gestión de establecimientos y redes de salud (RIS)

### Sistema de Auditoría
- 🔐 Registro completo de todos los cambios (audit logs)
- 👤 Control de acceso basado en roles: Admin, Auditor, Viewer
- 🔍 Auditoría de quién realizó qué cambios y cuándo
- 📝 Trazabilidad completa de supervisiones

### Reportes y Exportación
- 📄 Generación de reportes en PDF con firmas digitales
- 📊 Análisis y visualización de datos de supervisiones
- 📈 Dashboard de métricas por período y establecimiento
- 💾 Exportación de datos a Excel

### Seguridad
- 🔒 Autenticación con Supabase Auth
- 🛡️ Row Level Security (RLS) en la base de datos
- 👁️ Control de visibilidad: Auditors ven solo sus supervisiones
- ✅ Validación de cambios con alertas de auditoría

---

## 🏗️ Arquitectura

### Frontend
- **React 18.3.1** - UI library
- **Vite 5.4.2** - Build tool y dev server
- **React Router 7.13.0** - Routing
- **Bootstrap 5.3.8** - CSS framework
- **React Hot Toast 2.6.0** - Notifications

### Backend
- **Supabase** - Backend as a Service (PostgreSQL + Auth)
- **@supabase/supabase-js 2.95.3** - Cliente de Supabase

### Librerías Adicionales
- **jsPDF + jsPDF-AutoTable** - Generación de PDFs
- **react-signature-canvas** - Captura de firmas
- **Recharts** - Gráficos interactivos
- **XLSX** - Exportación a Excel

---

## 📦 Instalación

### Requisitos Previos
- Node.js v16.0.0 o superior
- npm o yarn
- Cuenta en Supabase

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tuusuario/v.i.s.o.r.git
cd v.i.s.o.r/spvs-auditores
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**

Crear archivo `.env.local` en la raíz del proyecto:
```env
VITE_SUPABASE_URL=https://coxrhjgmjokqyjhmmhfx.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_publica_aqui
```

4. **Ejecutar servidor de desarrollo**
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

---

## 🗄️ Base de Datos - Configuración Inicial

### Crear Tabla de Auditoría

Ejecutar el siguiente SQL en la consola de **Supabase SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervision_id UUID NOT NULL REFERENCES supervisiones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_supervision_id ON audit_logs(supervision_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

---

## 👤 Usuarios y Roles

V.I.S.O.R utiliza tres roles principales:

| Rol | Permisos |
|-----|----------|
| **Admin** | Acceso completo, gestión de usuarios y parámetros |
| **Auditor** | Crea superviciones, ve solo las suyas |
| **Viewer** | Solo lectura de todas las supervisiones |

---

## 🖥️ Funcionalidades Principales

### 1. Dashboard
- Vista general de supervisiones
- Filtros por fecha, RIS y estado
- Métricas de actividad

### 2. Formulario de Supervisión
- Parámetros dinámicos (Si/No con observaciones)
- Firmas digitales de autoridades
- Carga de evidencias
- Registro automático de cambios

### 3. Administración
- Gestión de RIS (Redes de Salud)
- Gestión de Establecimientos
- Gestión de Parámetros
- Gestión de Usuarios

---

## 📁 Estructura del Proyecto

```
spvs-auditores/
├── src/
│   ├── components/       # Componentes React
│   ├── contexts/         # React Context
│   ├── hooks/            # Custom hooks
│   ├── lib/              # Utilidades
│   ├── pages/            # Páginas principales
│   └── styles/           # Estilos CSS
├── sql/                  # Scripts SQL
└── package.json
```

---

## 🚀 Construcción para Producción

```bash
npm run build
```

---

## 📄 Licencia

Bajo licencia MIT. Ver archivo `LICENSE`.

---

## 📞 Soporte

Para soporte o consultas, contacta al equipo de desarrollo.

---

**V.I.S.O.R v1.0.0** - © 2026
