# Integración automática Facturación -> Control de Pedidos

## Objetivo
Los remitos con `estado = Pendiente` de la tabla `remitos` del sistema de facturación
se copian automáticamente a Firebase Realtime Database (`remitos`) usando la misma
estructura histórica que generaba el importador de Táctica.

## Configuración
Agregar al `.env` local y a las variables del hosting de Control de Pedidos:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Usar los mismos valores que ya tiene `sistema-facturacion`.

## Comportamiento
- Sincronización inmediata al iniciar sesión.
- Nueva consulta cada 60 segundos mientras la pestaña está visible.
- Al volver a la pestaña, fuerza una sincronización inmediata.
- Solo consulta remitos `Pendiente`.
- Deduplica por `numeroRemito` para no recrear pedidos cargados manualmente.
- Para nuevos remitos usa una clave Firebase determinística basada en el ID de Supabase.
- Nunca sobreescribe un remito que ya exista en Control de Pedidos.

## Traducción de campos
Supabase Facturación -> Firebase Control

- `numero` -> `numeroRemito`
- `fechaCreacion` -> `fechaEmision`
- `empresa.razonSocial` -> `cliente`
- `empresa.telefonoCelular/telefonoFijo` -> `telefono`
- `items[]` -> `articulos[{ codigo, cantidad, detalle }]`
- `observaciones` -> `aclaraciones`
- `requiereArmado` -> `produccion`
- `envioPorTransporte` / `empresa.transporteNombre` -> `esTransporte`
- fijo -> `estado = null`
- fijo -> `estadoPreparacion = "Pendiente"`
- fijo -> `rangoDespacho = ""`
- fijo -> `notificado = false`

Se agregan metadatos no disruptivos:
- `origen = "sistema_facturacion"`
- `remitoFacturacionId`
- `sincronizadoAutomaticamente = true`
- `cantidadBultos`
