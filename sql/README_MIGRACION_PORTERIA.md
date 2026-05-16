# Migracion De Base De Datos Para Nuevas Funciones De Porteria

Este documento explica como haremos los ajustes de base de datos para las nuevas funciones de porteria **sin borrar el esquema actual**.

## Regla principal

**No necesitas eliminar el esquema actual para continuar.**

La recomendacion es trabajar con **migraciones incrementales**, porque asi:

- no pierdes usuarios de autenticacion ya creados;
- no pierdes roles ni permisos actuales;
- no pierdes datos de residentes, visitantes o historicos ya registrados;
- puedes probar paso a paso y detectar errores mas facil.

## Cuando si valdria la pena borrar todo

Solo tendria sentido reiniciar completamente la base si:

- quieres empezar desde cero sin conservar datos;
- el esquema actual ya quedo inconsistente por pruebas manuales;
- prefieres reconstruir todo desde un proyecto Supabase nuevo.

Si decides hacer un reinicio total, es mejor crear **un proyecto nuevo de Supabase para pruebas**, no destruir el actual directamente.

## Estrategia que vamos a usar

Vamos a agregar archivos SQL nuevos dentro de esta carpeta `sql/` y los ejecutarás en orden.

La idea es:

1. hacer respaldo;
2. ejecutar migracion de estructuras nuevas;
3. ejecutar migracion de permisos y politicas;
4. validar datos;
5. probar la app.

## Paso a paso recomendado

### Paso 1. Respaldar la base actual

Antes de ejecutar cualquier cambio:

1. entra a Supabase;
2. abre el `SQL Editor`;
3. guarda copia de los scripts actuales que ya ejecutaste;
4. si tienes datos importantes, exporta tablas o crea un backup.

## Paso 2. No elimines tablas actuales

Por ahora:

- no elimines tablas;
- no borres politicas RLS;
- no borres funciones actuales;
- no borres usuarios de `auth.users`.

Los cambios nuevos se montaran encima del modelo actual.

## Paso 3. Ejecutar migraciones nuevas en orden

Cuando empiece la implementacion de esta fase, te voy a entregar archivos SQL nuevos con nombres similares a estos:

- `sql/01_porteria_fase1_estructura.sql`
- `sql/02_porteria_fase1_politicas.sql`
- `sql/03_porteria_fase1_datos_iniciales.sql`

La regla sera ejecutarlos **en ese orden exacto**.

### Archivos ya creados en esta fase

Por ahora ya puedes usar estos:

- `sql/01_porteria_fase1_estructura.sql`
- `sql/02_porteria_fase1_validacion.sql`

Orden actual:

1. ejecutar `01_porteria_fase1_estructura.sql`
2. si termina bien, ejecutar `02_porteria_fase1_validacion.sql`
3. revisar especialmente apartamentos con telefonos pero sin numero principal

## Paso 4. Si una migracion falla

Si al ejecutar una migracion aparece un error:

1. no sigas con la siguiente;
2. copia el error completo;
3. dime el nombre del archivo y la linea donde fallo;
4. corregimos primero eso antes de continuar.

## Paso 5. Validaciones despues de migrar

Despues de ejecutar las migraciones, probaremos como minimo:

- busqueda de residente;
- busqueda de visitante;
- anuncio de visitante;
- ingreso y salida de residente;
- ingreso y salida de visitante;
- numero principal por apartamento;
- llamada registrada;
- WhatsApp manual registrado;
- historial;
- pedidos.

## Cambios funcionales que esta fase debe soportar

Esta fase prepara la base para:

- numero principal por apartamento;
- alertas cuando no exista numero principal;
- registro de llamadas;
- registro de acciones de WhatsApp;
- control de ingreso y salida para residentes;
- flujo de visitantes con estados `anunciado`, `ingreso`, `no ingreso`, `salida`;
- historial general de residentes y visitantes;
- pedidos en porteria;
- notificacion manual por WhatsApp;
- edicion y eliminacion de movimientos segun permisos.

## Mensajes aprobados por el cliente

### Pedidos

Hola, te informamos desde porteria que tienes un pedido recibido a tu nombre. Se encuentra disponible en porteria para su recogida.

### Visitantes

Hola, desde porteria te informamos que el vehiculo de placa {PLACA} se encuentra anunciado para la Torre {TORRE}, Apartamento {APARTAMENTO}.

### Mensaje general

Hola, te contactamos desde porteria de Registro de Vehiculos Davinci.

## Nota tecnica importante

En este momento el proyecto **no tiene en disco** un archivo base `sql/parking_schema.sql` utilizable en este workspace.

Por eso la estrategia correcta es:

- reconstruir las migraciones necesarias desde el estado real del frontend y repositorios actuales;
- generar scripts nuevos de migracion;
- no asumir que existe un schema maestro confiable.

## Siguiente paso

El siguiente paso es que yo te genere la **primera migracion real** de esta fase, empezando por:

- tablas/campos para numero principal;
- historicos de residentes;
- anuncios de visitantes;
- logs de contacto;
- pedidos.

Despues te la dejo en esta misma carpeta `sql/` para que la ejecutes paso a paso.
