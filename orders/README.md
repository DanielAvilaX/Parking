# Carpeta `orders/`

## Qué contiene

La entrada HTML del módulo de pedidos de portería.

## Archivo

- `index.html`
  - usa `js/pages/orders.page.js`

## Qué resuelve

- creación de pedidos en portería
- filtrado por estado, torre, apartamento y fecha
- contacto telefónico al apartamento
- notificación manual por WhatsApp
- actualización del número principal del apartamento
- cambio de estado a `notificado` o `entregado`
- edición y eliminación de pedidos

## Estados operativos

- `in_porteria_unnotified`
- `notified_in_porteria`
- `delivered`

## Dependencias principales

- `js/pages/orders.page.js`
- `js/services/order.service.js`
- `js/services/contact.service.js`
- `js/services/apartment-contact.service.js`
