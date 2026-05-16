# Carpeta `guard/`

## Qué contiene

Entradas HTML de portería operativa.

## Cómo funciona

Estas pantallas están pensadas para operación rápida del guarda, pero también pueden ser usadas por administrador cuando el flujo lo permite.

## Archivos

- `index.html`
  - buscador operativo por placa
  - usa `js/pages/guard-search.page.js`
  - es la pantalla más importante del sistema
  - desde aquí se consultan placas, se anuncian visitantes, se registran ingresos/salidas, se llama, se abre WhatsApp y se registran novedades

- `register-resident.html`
  - alta rápida de residentes
  - usa `js/pages/guard-register-resident.page.js`
  - permite crear un residente nuevo o asociar una nueva placa a un residente ya existente en el apartamento

- `register-visitor.html`
  - alta rápida de visitantes
  - usa `js/pages/guard-register-visitor.page.js`
  - muestra contexto del apartamento antes de guardar

## Flujo principal

1. el guarda digita una placa
2. la app identifica si pertenece a residente, visitante o no registrado
3. según el caso, se muestran acciones contextuales
4. si no existe, se redirige a registro de residente o visitante

## Dependencias principales

- `js/pages/guard-search.page.js`
- `js/pages/guard-register-resident.page.js`
- `js/pages/guard-register-visitor.page.js`
- `js/services/resident.service.js`
- `js/services/visitor.service.js`
- `js/services/contact.service.js`
