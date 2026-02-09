# Guía de Contribución

Gracias por tu interés en contribuir a V.I.S.O.R. Este documento te guiará a través del proceso.

## Código de Conducta

Por favor, sé respetuoso y constructivo en todas las interacciones con otros contribuidores.

## ¿Cómo Contribuir?

### 1. Reportar Bugs

Si encuentras un bug:

1. **Verifica que no haya sido reportado** buscando en los issues existentes
2. **Incluye los siguientes detalles:**
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento observado
   - Comportamiento esperado
   - Tu entorno (SO, navegador, versión de Node.js)
   - Screenshots o logs si es relevante

### 2. Sugerir Mejoras

Las sugerencias de nuevas características son bienvenidas:

1. **Abre un issue** con el título `[FEATURE] Tu idea`
2. **Describe:**
   - Qué problema resuelve tu idea
   - Cómo te gustaría que funcionara
   - Ejemplos de casos de uso

### 3. Hacer un Pull Request

#### Preparación

```bash
# 1. Fork el repositorio en GitHub
# 2. Clona tu fork
git clone https://github.com/TU-USUARIO/v.i.s.o.r.git
cd v.i.s.o.r/spvs-auditores

# 3. Crea una rama para tu característica
git checkout -b feature/nombre-descriptivo

# 4. Instala dependencias
npm install

# 5. Realiza los cambios
```

#### Durante el Desarrollo

```bash
# Ejecuta el servidor de desarrollo
npm run dev

# Verifica el linting
npm run lint

# Construye el proyecto
npm run build
```

#### Commits

- Usa mensajes claros y descriptivos
- Sigue el formato: `tipo(alcance): descripción`
- Ejemplos:
  - `feat(audit): agregar registro de cambios`
  - `fix(auth): corregir error de login`
  - `docs(readme): actualizar instrucciones`
  - `style: formatear código`

#### Push y Pull Request

```bash
# Push a tu rama
git push origin feature/nombre-descriptivo

# Abre un Pull Request en GitHub
# Completa la plantilla de PR con:
# - Descripción del cambio
# - Issue relacionado (si existe)
# - Checklist de la PR
```

## Estándares de Código

### ES Lint

El proyecto usa ESlint. Asegúrate de:

```bash
npm run lint
```

### Convenciones

- **Componentes**: PascalCase (ej: `SupervisionForm.jsx`)
- **Archivos**: kebab-case para utilidades (ej: `supabase-client.js`)
- **Variables**: camelCase
- **Constantes**: UPPER_CASE
- **Comentarios**: En español o inglés (consistente en el archivo)

### Estructura de Componentes

```jsx
import { useState } from "react";

export default function MiComponente({ prop1, prop2 }) {
  const [state, setState] = useState(null);

  const handleClick = () => {
    // Lógica
  };

  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

## Datos

- **Desarrollo**: Usa la base de datos de desarrollo en Supabase
- **No hagas commit** de archivos `.env` con credenciales reales
- Las contraseñas deben estar en `.env.local` (ignorado por git)

## Pruebas

Aunque no hay suite de tests automatizadas, por favor:

1. **Prueba tu cambio localmente**
2. **Verifica que no rompes funcionalidades existentes**
3. **Prueba en diferentes navegadores** si es relevante

## Documentación

- Actualiza el `README.md` si tus cambios lo requieren
- Agrega comentarios a código complejo
- Documenta nuevos componentes y funciones
- Actualiza `CHANGELOG.md` con tus cambios

## Preguntas o Dudas?

- Abre una **Discussion** en GitHub
- Contacta al equipo de desarrollo
- Revisa problemas similares existentes

## Proceso de Revisión

1. Un maintainer revisará tu PR
2. Podría solicitar cambios o clarificaciones
3. Una vez aprobado, será mergeado
4. Tu nombre aparecerá en los créditos

## Agradecimiento

¡Gracias por contribuir a hacer V.I.S.O.R mejor! 🎉

---

## Licencia

Al contribuir, aceptas que tu código será licenciado bajo la Licencia MIT del proyecto.
