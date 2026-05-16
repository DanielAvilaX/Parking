# Carpeta `styles/`

## Qué contiene

La capa visual compartida del proyecto.

## Archivos

- `base.css`
  - define tokens visuales globales
  - colores, tipografías, radios, sombras, transiciones
  - variables para claro/oscuro
  - fondo base y utilidades generales

- `components.css`
  - define componentes reutilizables
  - topbar, botones, paneles, badges, tablas, modales, toasts, grids, tarjetas y formularios

- `pages.css`
  - layout de páginas concretas
  - portada de login
  - animación de cortina
  - fondos del login y de portería
  - reglas de dashboards, formularios y layouts secundarios

## Cómo funciona

La estrategia de estilos es:

1. `base.css` define el sistema de diseño
2. `components.css` construye componentes reutilizables
3. `pages.css` adapta el layout según la página

## Detalles importantes

- el logo se muestra en rectángulo horizontal
- los fondos cambian con filtros entre claro y oscuro
- el sistema usa `data-theme` en `document.documentElement`
- el tema se actualiza desde `js/core/theme.js`
