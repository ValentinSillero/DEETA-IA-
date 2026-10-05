# Reglas de desarrollo de DEETA

- DEETA es un SaaS multiempresa: todo acceso a datos debe validar en el servidor la sesión, la membresía y el rol correspondiente.
- Nunca aceptar un identificador de negocio enviado por el navegador como fuente de autorización.
- Diseñar primero para celular y comprobar que la interfaz siga siendo clara y usable en escritorio.
- Priorizar una interfaz extremadamente sencilla; evitar términos técnicos para comerciantes.
- Mantener el código separado por componentes, rutas, autenticación, acceso a datos, validaciones y lógica de negocio.
- Preparar la arquitectura para crecer sin agregar funcionalidades fuera del sprint actual.
- No romper funcionalidades existentes ni cambiar contratos sin revisar sus consumidores.
- Mantener secretos únicamente en variables de entorno y validar siempre los datos en el servidor.
- Mantener el aislamiento entre negocios como una propiedad verificable y cubierta por pruebas.
- Ejecutar lint, TypeScript, pruebas y build antes de finalizar una tarea.
- Mantener todos los flujos responsive, con estados de carga, éxito, error y vacío claros.
- Todo producto pertenece a un negocio y toda consulta debe acotarse mediante la membresía autenticada.
- Nunca modificar `currentStock` desde formularios descriptivos: cada cambio debe ser atómico y generar un movimiento.
- Guardar dinero en centavos enteros y formatearlo para la interfaz; no usar coma flotante para persistencia.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
