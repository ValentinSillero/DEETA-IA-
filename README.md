# DEETA

DEETA es un SaaS mobile-first de gestión comercial. Incluye autenticación, negocios, productos, stock, ventas, cajas, gastos, rentabilidad y un asistente de consultas de solo lectura sobre los datos del comercio. Predicciones avanzadas y contabilidad formal permanecen fuera del alcance actual.

## Stack

- Next.js 16 con App Router y TypeScript
- React 19
- Tailwind CSS 4
- PostgreSQL en Neon
- Drizzle ORM y Drizzle Kit
- Better Auth con email y contraseña
- Zod para validación del lado servidor
- Vitest para pruebas de reglas críticas
- `BarcodeDetector` cuando el navegador cubre los formatos requeridos, con `@zxing/browser` como alternativa compatible
- Server-Sent Events (SSE) para el lector remoto celular → computadora

## Requisitos

- Node.js 20.9 o posterior (se recomienda la versión LTS vigente)
- npm
- Una base PostgreSQL en Neon

## Instalación

```bash
npm install
```

Copiá `.env.example` como `.env.local` y completá:

```env
DATABASE_URL="postgresql://usuario:contraseña@host/base?sslmode=require"
BETTER_AUTH_SECRET="un-secreto-aleatorio-de-al-menos-32-caracteres"
BETTER_AUTH_URL="http://localhost:3000"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.4-mini"
DEETA_AI_TIMEOUT_MS="15000"
DEETA_AI_REQUESTS_PER_MINUTE="8"
DEETA_AI_MONTHLY_LIMIT="100"
```

Podés generar el secreto con:

```bash
npx auth@latest secret
```

No publiques `.env.local` ni uses los valores de ejemplo en producción.

## Base de datos

La migración inicial está versionada en `drizzle/`. Aplicala sobre la base configurada:

```bash
npm run db:migrate
```

Cuando el esquema cambie, generá una migración nueva con:

```bash
npm run db:generate
```

El modelo contiene las tablas de autenticación de Better Auth, `business`, `business_member`, `product`, `stock_movement`, `sale`, `sale_item`, `income` y `cash_session`. La membresía guarda los roles `OWNER`, `ADMIN` y `EMPLOYEE`; quien crea el comercio queda como `OWNER`.

La migración `0001_motionless_doctor_strange.sql` agrega productos, precios en centavos, códigos de barras únicos por negocio, movimientos de stock e índices de búsqueda. En Neon habilita la extensión estándar `pg_trgm` para acelerar búsquedas parciales por nombre y código.

La migración `0002_freezing_warbird.sql` agrega ventas, snapshots de sus ítems, ingresos y sesiones de caja. Solo puede existir una caja abierta por negocio.

La migración `0003_perpetual_serpent_society.sql` agrega sesiones temporales de emparejamiento y eventos idempotentes del lector remoto. Los tokens se guardan únicamente como hash; el QR sin conectar vence a los cinco minutos y la conexión activa a las ocho horas. La sesión se revoca al cobrar, desconectar o cerrar la venta en la computadora.

Las migraciones `0004_previous_vampiro.sql` y `0005_jazzy_joshua_kane.sql` agregan categorías y gastos, estado de cancelación, relación opcional con caja y zona horaria por negocio. Los negocios existentes reciben categorías iniciales; los nuevos las crean durante el alta. La caja esperada puede ser negativa cuando las salidas de efectivo superan el saldo calculado, sin ocultar el gasto real.

La migración `0006_flawless_nova.sql` agrega conversaciones, mensajes y medición de uso de DEETA AI. No modifica ventas, productos, stock, caja ni autenticación.

## Ejecución local

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

Recorrido esperado: crear cuenta → crear negocio → crear producto → abrir caja → crear una venta → revisar ventas y stock → cerrar caja.

Para probar Sprint 4: asociá un código desde el formulario de producto, usá **Escanear producto** en una venta o **Ingresar mercadería con cámara** en Productos. En una venta de escritorio, **Usar celular como escáner** genera un QR temporal. El celular debe tener una sesión de DEETA perteneciente al mismo negocio.

La cámara web requiere HTTPS en producción. `http://localhost` es considerado un contexto seguro por los navegadores modernos para desarrollo local; una IP local servida por HTTP no lo es. Si la cámara no está disponible o se rechaza el permiso, todos los flujos conservan entrada y búsqueda manual.

El transporte remoto usa SSE: el celular confirma cada lectura mediante una acción autenticada y la computadora recibe eventos persistidos sin recargar. `EventSource` reconecta automáticamente usando el identificador secuencial del último evento. Esta elección evita sumar infraestructura WebSocket o un servicio externo al despliegue actual. No se agregaron variables de entorno para el escáner.

Las ventas por transferencia y tarjeta se permiten sin caja abierta porque no modifican el efectivo físico. Una venta en efectivo exige caja abierta. Para conservar un cierre ya declarado, una venta en efectivo no puede cancelarse después del cierre de su caja.

### Si aparece “Falta conectar la base de datos”

La aplicación ya no muestra un error técnico cuando faltan variables: la portada abre y explica qué
configuración está pendiente. Para habilitar registro, login, dashboard, productos, ventas y caja:

1. Copiá `.env.example` como `.env.local`.
2. Reemplazá los valores de ejemplo por una conexión PostgreSQL/Neon real y un secreto seguro.
3. Ejecutá `npm run db:migrate`.
4. Reiniciá `npm run dev`.

No uses la URL de ejemplo como si fuera una base real: solo documenta el formato esperado.

## Verificaciones

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

La prueba integrada de venta, stock, ingreso, caja, cancelación y aislamiento usa datos temporales y los elimina al terminar. En PowerShell se ejecuta, con Neon configurado, mediante:

```powershell
$env:RUN_DB_TESTS="1"; npm test -- src/data/sales.integration.test.ts
```

La prueba integrada del escáner verifica códigos iguales entre empresas, rechazo del duplicado dentro de una empresa, pairing válido/vencido, aislamiento, idempotencia, stock por movimiento y revocación atómica al cobrar:

```powershell
$env:RUN_DB_TESTS="1"; npm test -- src/data/scanner.integration.test.ts
```

La prueba integrada financiera cubre costo histórico, margen, gastos en efectivo y transferencia, caja, cancelaciones y aislamiento multiempresa:

```powershell
$env:RUN_DB_TESTS="1"; npm test -- src/data/expenses.integration.test.ts
```

La prueba integrada de DEETA AI cubre aislamiento entre negocios, productos más vendidos y rentables, reposición, falta de datos, seguimiento conversacional, prompt injection, proveedor caído y rate limiting:

```powershell
$env:RUN_DB_TESTS="1"; npm test -- src/data/ai-tools.integration.test.ts
```

## Estructura

```text
src/
├── actions/       # Mutaciones validadas del lado servidor
├── app/           # Rutas, layouts, estados de carga y error
├── components/    # Formularios, navegación y piezas visuales
├── data/          # Acceso a datos acotado por la membresía autenticada
├── db/            # Conexión Neon y esquema Drizzle
└── lib/           # Auth, sesión, validaciones y reglas de autorización
```

## Seguridad multiempresa

Las páginas privadas vuelven a validar la sesión en el servidor. Las consultas resuelven el negocio mediante `business_member.user_id`; los formularios nunca envían ni aceptan un `businessId` para autorizar cambios. Las mutaciones comprueban sesión, membresía y rol antes de escribir. La restricción única de membresía mantiene un solo negocio por usuario en este sprint, mientras que el modelo permite varios usuarios por negocio.

Los cambios de cantidad se realizan con una única sentencia transaccional que bloquea el producto, comprueba membresía y rol, evita stock negativo, actualiza `current_stock` y crea el movimiento. Editar el nombre, precios u otros datos descriptivos nunca modifica el stock.

Confirmar una venta ejecuta una única operación atómica en PostgreSQL: bloquea y valida los productos, guarda venta e ítems, descuenta stock, crea movimientos, registra el ingreso y actualiza la caja cuando el pago es en efectivo. Los importes se persisten en centavos enteros. Las cancelaciones preservan el historial, revierten el ingreso y devuelven stock con movimientos `RETURN`.

## Gastos y resultado estimado

Un gasto en efectivo se asocia a la caja abierta y reduce `expected_cash_cents` dentro de la misma sentencia atómica. Sin caja abierta se registra igualmente, con una advertencia y sin inventar una apertura. Transferencias, tarjetas y otros medios no alteran el efectivo físico. Cancelar conserva el registro; si la caja asociada continúa abierta, restaura su efectivo esperado.

El análisis se calcula en PostgreSQL y siempre queda acotado por la membresía autenticada:

```text
Margen bruto = ventas completadas - Σ(unit_cost_cents histórico × cantidad)
Resultado estimado = margen bruto - gastos activos
```

Las ventas y gastos cancelados se excluyen. Para “Este mes”, la comparación usa el mismo número de días del mes anterior; “Mes anterior” compara meses completos. Los cortes diarios usan `business.timezone`, con `America/Argentina/Buenos_Aires` como valor inicial. El resultado es una estimación basada en la información registrada en DEETA, no una ganancia contable o impositiva oficial.

## DEETA AI

DEETA AI usa OpenAI Responses API mediante una única capa de proveedor. El modelo predeterminado es `gpt-5.4-mini` y puede cambiarse con `OPENAI_MODEL`. Si no existe `OPENAI_API_KEY`, la pantalla informa que el asistente no está disponible y todos los demás módulos continúan funcionando.

El modelo nunca recibe acceso SQL ni un `businessId`. Solo puede solicitar herramientas de lectura predefinidas para resúmenes financieros, stock a reponer, líderes de productos, productos con poco movimiento, gastos, caja y rendimiento de un producto. Cada herramienta vuelve a resolver el negocio desde el usuario autenticado y su membresía `OWNER` o `ADMIN`.

Los mensajes se conservan por conversación para seguimientos breves. Se envían al proveedor solo los últimos diez mensajes y los datos mínimos devueltos por las herramientas. Cada solicitud registra proveedor, modelo, cantidad de herramientas, tokens informados, estado y fecha. Los límites por minuto y por mes son configurables. DEETA no guarda la API key ni otros secretos en la base de datos.
