# Carpeta `assets/`

## Qué contiene

Recursos visuales estáticos del proyecto.

## Archivos

- `logo-placeholder.png`
  - logo principal de la aplicación
  - se usa en:
    - login
    - topbar
  - el CSS ya está preparado para mostrarlo completo dentro de un contenedor rectangular

- `login-background-placeholder.png`
  - fondo del inicio de sesión
  - se usa en `styles/pages.css`
  - recibe filtro para modo oscuro automático o manual

- `guard-background-placeholder.png`
  - fondo principal de portería
  - se usa en `styles/pages.css`
  - también cambia con filtro según tema

## Cómo funciona

Los assets no tienen lógica propia. La app los carga por rutas estáticas:

- `/assets/logo-placeholder.png`
- `/assets/login-background-placeholder.png`
- `/assets/guard-background-placeholder.png`

## Recomendaciones

- conserva los mismos nombres si quieres reemplazarlos sin tocar código
- usa imágenes optimizadas para web
- si cambias proporciones del logo, revisa `styles/components.css` y `styles/pages.css`
