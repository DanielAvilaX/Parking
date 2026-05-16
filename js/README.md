# Carpeta `js/`

## Propósito

Contiene toda la lógica del frontend organizada por capas.

## Subcarpetas

- [config/README.md](./config/README.md)
- [core/README.md](./core/README.md)
- [data/README.md](./data/README.md)
- [pages/README.md](./pages/README.md)
- [services/README.md](./services/README.md)
- [ui/README.md](./ui/README.md)

## Flujo general de la arquitectura

1. una página HTML carga su controlador desde `pages/`
2. el controlador valida sesión y monta la topbar
3. el controlador pide datos o ejecuta acciones mediante `services/`
4. `services/` aplica reglas de negocio y usa `data/`
5. `data/` consulta Supabase
6. `ui/` renderiza modales, toasts o elementos compartidos
7. `core/` aporta utilidades transversales

## Convenciones del proyecto

- `config/`: parámetros de despliegue
- `core/`: base reusable sin conocimiento de dominio
- `data/`: acceso directo a tablas y RPC
- `services/`: dominio y procesos
- `pages/`: comportamiento por vista
- `ui/`: componentes compartidos de interfaz
