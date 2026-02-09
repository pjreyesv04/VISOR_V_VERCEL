# 🚀 Inicio Rápido - V.I.S.O.R

## En 5 Minutos

### 1. **Prerequisitos**
- Node.js v16+ instalado
- Acceso a Supabase (opcional para desarrollo)

### 2. **Instalación**

```bash
cd spvs-auditores
npm install
npm run dev
```

Abre `http://localhost:5173` en tu navegador.

### 3. **Variables de Entorno**

Crea `.env.local`:
```env
VITE_SUPABASE_URL=tu_url_aqui
VITE_SUPABASE_ANON_KEY=tu_clave_aqui
```

### 4. **Base de Datos**

- Ve a **Supabase Console**
- Ve a **SQL Editor**
- Copia de `sql/audit_logs.sql` y ejecuta
- Ejecuta también `SETUP_AUDIT_TABLE.sql`

### 5. **Login de Prueba**

```
Email: admin@supervision.com
Password: Admin2026
```

---

## Comandos Útiles

```bash
# Desarrollo
npm run dev          # Inicia servidor con hot reload

# Validación
npm run lint         # Valida código con ESLint

# Producción
npm run build        # Construye para producción
npm run preview      # Previsualizadel build
```

---

## Estructura Rápida

```
src/
├── pages/          # Páginas principales
├── components/     # Componentes React
├── contexts/       # React Context (Auth)
├── hooks/          # Custom hooks
├── lib/            # Utilidades
└── styles/         # Estilos globales
```

---

## Próximos Pasos

1. Revisa [README.md](./README.md) para documentación completa
2. Lee [CONTRIBUTING.md](./CONTRIBUTING.md) si quieres contribuir
3. Consulta [CHANGELOG.md](./CHANGELOG.md) para historial

---

**¡Listo para comenzar!** 🎉
