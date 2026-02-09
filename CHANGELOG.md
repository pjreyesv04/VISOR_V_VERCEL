# Changelog

Todos los cambios notables en este proyecto se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.0.0] - 2026-02-09

### Agregado
- ✨ Sistema completo de gestión de supervisiones
- ✨ Módulo de autenticación con Supabase Auth
- ✨ Sistema de auditoría con registro de cambios
- ✨ Control de acceso basado en roles (Admin, Auditor, Viewer)
- ✨ Formularios dinámicos para parámetros de supervisión
- ✨ Captura de firmas digitales
- ✨ Carga y gestión de evidencias
- ✨ Generación de reportes en PDF
- ✨ Exportación de datos a Excel
- ✨ Dashboard con métricas y filtros
- ✨ Administración de RIS (Redes de Salud)
- ✨ Administración de Establecimientos
- ✨ Administración de Parámetros
- ✨ Administración de Usuarios
- ✨ Filtrado de supervisiones por rol de usuario
- ✨ Tabla audit_logs para trazabilidad completa

### Características de Seguridad
- 🔒 Autenticación segura con Supabase
- 🛡️ Row Level Security (RLS) en PostgreSQL
- 🔐 Registro completo de cambios por usuario
- 👁️ Auditors solo ven sus propias supervisiones
- ✅ Alertas cuando se registran cambios

### Mejoras de UI/UX
- 📝 Botones de acción movidos al final del formulario
- 📅 Corrección de visualización de fechas
- 🎨 Interfaz limpia y responsiva con Bootstrap
- 🔔 Notificaciones con React Hot Toast
- ⌨️ Navegación intuitiva con React Router

### Documentación
- 📖 README completo con instrucciones de instalación
- 📝 Guía de configuración de base de datos
- 📋 Estructura de proyecto documentada
- 🔐 Información sobre seguridad y roles

### Dependencias Principales
- React 18.3.1
- Vite 5.4.2
- Supabase @supabase/supabase-js 2.95.3
- Bootstrap 5.3.8
- jsPDF 4.1.0
- React Router 7.13.0

---

## Roadmap Futuro

### v1.1.0 (Próximas Mejoras)
- [ ] Autenticación multi-factor (MFA)
- [ ] Sincronización offline
- [ ] Más opciones de exportación (CSV, Word)
- [ ] Búsqueda avanzada
- [ ] Notificaciones por email

### v1.2.0
- [ ] Integración con sistemas de salud externos
- [ ] API REST pública
- [ ] Aplicación móvil

---

Para más información sobre cambios específicos, consulta el repositorio de Git.
