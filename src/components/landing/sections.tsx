import {
  ArrowRight,
  Bot,
  Calculator,
  Camera,
  Check,
  ChartNoAxesCombined,
  FileSpreadsheet,
  MessageCircle,
  NotebookPen,
  Package,
  ScanBarcode,
  ShoppingCart,
  Smartphone,
} from "lucide-react";
import Link from "next/link";

import {
  AiPreview,
  AnalysisPreview,
  CashPreview,
  DayPreview,
  DevicesPreview,
  SaleFlowPreview,
  StockPreview,
} from "@/components/landing/product-previews";
import { landingLinks } from "@/components/landing/links";
import { LandingSupportLink } from "@/components/support/landing-support-link";
import { XProfileLink } from "@/components/support/x-profile-link";
import { getXProfile } from "@/lib/social";

const container = "mx-auto w-full max-w-[1160px] px-4 sm:px-6 lg:px-8";

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-brand">{children}</p>;
}

function SectionTitle({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return <h2 id={id} className={`font-display text-[clamp(1.75rem,4.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink ${className}`}>{children}</h2>;
}

// Aviso de Beta, secundario: el CTA principal sigue siendo "Empezar gratis".
function BetaNote() {
  return <p className="mt-3 text-sm text-muted">Beta gratuita. Tu opinión nos ayuda a mejorar.</p>;
}

function StartButtons({ secondaryLabel = "Ingresar" }: { secondaryLabel?: string }) {
  return (
    <div className="flex flex-col gap-2 min-[400px]:flex-row">
      <Link href="/crear-cuenta" className="button-brand min-h-13 px-6 text-base">Empezar gratis <ArrowRight className="size-5" aria-hidden="true" /></Link>
      <Link href="/iniciar-sesion" className="button-secondary min-h-13 px-6 text-base">{secondaryLabel}</Link>
    </div>
  );
}

export function Hero() {
  return (
    <section className={`${container} grid gap-10 pb-14 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14 lg:pb-20 lg:pt-20`} aria-labelledby="hero-title">
      <div>
        <Kicker>Gestión para comercios</Kicker>
        <h1 id="hero-title" className="mt-3 font-display text-[clamp(2.25rem,7vw,3.6rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink">
          Tu negocio en orden.<br />
          <span className="text-brand">Tus decisiones, más claras.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted">Ventas, stock, caja, gastos y análisis en un solo lugar. Desde el celular o la computadora.</p>
        <div className="mt-7"><StartButtons /></div>
        <BetaNote />
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          {["Sin instalar nada", "Escáner con la cámara", "Pensado para el mostrador"].map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5"><Check className="size-4 text-success" aria-hidden="true" />{item}</li>
          ))}
        </ul>
      </div>
      <div className="mx-auto w-full max-w-lg lg:max-w-none">
        <DayPreview />
      </div>
    </section>
  );
}

const situations = [
  { icon: NotebookPen, text: "Las ventas quedan anotadas en un cuaderno o no quedan." },
  { icon: Package, text: "Te enterás de que falta algo cuando el cliente ya lo está pidiendo." },
  { icon: MessageCircle, text: "Los gastos están entre tickets, transferencias y mensajes de WhatsApp." },
  { icon: Calculator, text: "Saber cuánto te quedó a fin de mes lleva una tarde de cuentas." },
];

export function Situations() {
  return (
    <section className="border-y border-line bg-surface" aria-labelledby="situaciones-title">
      <div className={`${container} grid gap-8 py-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14 lg:py-20`}>
        <div>
          <Kicker>¿Te suena?</Kicker>
          <SectionTitle id="situaciones-title" className="mt-2">Si tu negocio hoy funciona con cuaderno, calculadora y WhatsApp, DEETA está pensado para vos.</SectionTitle>
          <p className="mt-4 max-w-md leading-7 text-muted">No es que lo estés haciendo mal: es que la información está repartida en muchos lugares y lleva tiempo juntarla.</p>
        </div>
        <ul className="self-center border-t border-line">
          {situations.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-4 border-b border-line py-4">
              <Icon className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
              <p className="text-[1.05rem] leading-7">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const comparison = [
  ["Anotás cada venta a mano.", "Cada venta queda registrada, con su medio de pago."],
  ["Revisás el stock a ojo.", "El stock se descuenta solo y te avisa cuando queda poco."],
  ["Los gastos están desparramados.", "Gastos y caja quedan en el mismo lugar."],
  ["A fin de mes hacés cuentas.", "Ves ventas, margen, gastos y resultado cuando quieras."],
] as const;

export function BeforeAfter() {
  return (
    <section className={`${container} py-14 lg:py-20`} aria-labelledby="antes-title">
      <SectionTitle id="antes-title" className="max-w-2xl">Lo mismo que ya hacés, pero ordenado.</SectionTitle>
      <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="hidden grid-cols-2 border-b border-line text-sm font-semibold sm:grid">
          <p className="px-5 py-3 text-muted">Antes</p>
          <p className="border-l border-line bg-surface-2 px-5 py-3 text-ink">Con DEETA</p>
        </div>
        <ul>
          {comparison.map(([before, after]) => (
            <li key={before} className="grid border-b border-line last:border-b-0 sm:grid-cols-2">
              <p className="px-5 pb-1 pt-4 text-muted sm:py-4"><span className="mr-1.5 text-xs font-semibold sm:hidden">Antes:</span>{before}</p>
              <p className="flex items-start gap-2.5 px-5 pb-4 pt-1 font-semibold sm:border-l sm:border-line sm:bg-surface-2/60 sm:py-4"><Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />{after}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const steps = [
  { title: "Cargás tus productos", text: "Uno por uno, importando tu Excel o CSV, o escaneando el código de barras con la cámara.", icons: [Package, FileSpreadsheet, ScanBarcode] },
  { title: "Empezás a vender", text: "Buscás o escaneás, armás el carrito y cobrás en efectivo, transferencia o tarjeta. El stock se actualiza solo.", icons: [ShoppingCart, Camera] },
  { title: "Entendés tu negocio", text: "Ventas, margen, gastos y resultado estimado explicados en palabras simples. Y si tenés una duda, le preguntás a DEETA AI.", icons: [ChartNoAxesCombined, Bot] },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-y border-line bg-surface" aria-labelledby="como-title">
      <div className={`${container} py-14 lg:py-20`}>
        <Kicker>Cómo funciona</Kicker>
        <SectionTitle id="como-title" className="mt-2 max-w-xl">Tres pasos para empezar.</SectionTitle>
        <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0">
          {steps.map((step, index) => (
            <li key={step.title} className="relative md:border-l md:border-line md:px-6 md:first:border-l-0 md:first:pl-0">
              <span className="figure block text-5xl leading-none text-line-strong">{index + 1}</span>
              <h3 className="mt-4 text-xl font-bold">{step.title}</h3>
              <p className="mt-2 leading-7 text-muted">{step.text}</p>
              <div className="mt-4 flex gap-2 text-muted" aria-hidden="true">
                {step.icons.map((Icon, iconIndex) => <Icon key={iconIndex} className="size-5" />)}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FeatureRow({ kicker, title, text, points, visual, reverse = false, id }: { kicker: string; title: string; text: string; points: string[]; visual: React.ReactNode; reverse?: boolean; id?: string }) {
  return (
    <article id={id} className="grid scroll-mt-20 gap-8 py-12 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <Kicker>{kicker}</Kicker>
        <h3 className="mt-2 font-display text-[clamp(1.5rem,3.5vw,2rem)] font-extrabold leading-[1.15] tracking-[-0.02em]">{title}</h3>
        <p className="mt-3 max-w-lg text-lg leading-8 text-muted">{text}</p>
        <ul className="mt-5 grid gap-2">
          {points.map((point) => <li key={point} className="flex items-start gap-2.5"><Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />{point}</li>)}
        </ul>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>{visual}</div>
    </article>
  );
}

export function Features() {
  return (
    <section id="funciones" className={`${container} scroll-mt-20 pt-14 lg:pt-20`} aria-labelledby="funciones-title">
      <Kicker>Funciones</Kicker>
      <SectionTitle id="funciones-title" className="mt-2 max-w-2xl">Lo que necesitás para el día a día, y nada que te complique.</SectionTitle>
      <div className="divide-y divide-line">
        <FeatureRow
          kicker="Ventas"
          title="Cobrá rápido, aunque haya fila."
          text="Buscás el producto o lo escaneás con la cámara del celular, lo sumás al carrito y cobrás. DEETA calcula el vuelto y descuenta el stock."
          points={["Escáner con la cámara, sin lectores especiales", "Efectivo, transferencia o tarjeta", "Historial de cada venta, con comprobante interno"]}
          visual={<SaleFlowPreview />}
        />
        <FeatureRow
          reverse
          kicker="Productos y stock"
          title="Dejá de enterarte de que falta mercadería cuando el cliente ya está esperando."
          text="Sabé qué tenés, qué se está terminando y qué conviene reponer. Cada venta e ingreso queda registrado como un movimiento."
          points={["Stock mínimo y avisos de poco stock", "Importación desde Excel o CSV", "Sugerencias de reposición según lo que vendés"]}
          visual={<StockPreview />}
        />
        <FeatureRow
          kicker="Caja y gastos"
          title="Cerrá la caja sabiendo si cuadra."
          text="Abrís con el efectivo inicial, DEETA suma las ventas y resta los gastos en efectivo, y al cerrar te muestra si coincide con lo que contaste."
          points={["Diferencia clara: coincide, faltan o sobran", "Gastos por categoría: luz, alquiler, transporte y más", "Todo queda en el historial"]}
          visual={<CashPreview />}
        />
        <FeatureRow
          reverse
          kicker="Análisis"
          title="No necesitás ser contador para entender tu negocio."
          text="Ventas, margen bruto, gastos y resultado estimado: los mismos términos de siempre, explicados en una frase que se entiende."
          points={["Comparación con el período anterior", "Productos que más venden y más ganancia dejan", "Mercadería con poco movimiento"]}
          visual={<AnalysisPreview />}
        />
      </div>
    </section>
  );
}

const questions = ["¿Qué producto vendo más?", "¿Qué debería reponer?", "¿Qué gastos aumentaron?", "¿Por qué vendí más pero me quedó menos?"];

export function AiSection() {
  return (
    <section id="deeta-ai" className="scroll-mt-20 border-y border-line bg-surface" aria-labelledby="ai-title">
      <div className={`${container} grid gap-10 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:py-20`}>
        <div>
          <Kicker>DEETA AI</Kicker>
          <SectionTitle id="ai-title" className="mt-2">Preguntale directamente a DEETA por tu negocio.</SectionTitle>
          <p className="mt-4 max-w-lg text-lg leading-8 text-muted">Escribís con tus palabras y DEETA responde con los datos que registraste: ventas, gastos, margen, stock y caja. Te muestra los números y qué conviene revisar.</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {questions.map((question) => <li key={question} className="rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold">{question}</li>)}
          </ul>
          <p className="mt-5 text-sm leading-6 text-muted">Solo usa la información de tu negocio. No reemplaza el asesoramiento de tu contador.</p>
        </div>
        <AiPreview />
      </div>
    </section>
  );
}

const businesses = ["Kioscos", "Almacenes", "Despensas", "Ferreterías", "Dietéticas", "Panaderías", "Tiendas de ropa", "Distribuidoras"];

export function Audience() {
  return (
    <section id="para-quien" className={`${container} scroll-mt-20 grid gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-20`} aria-labelledby="quien-title">
      <div className="min-w-0">
        <Kicker>Para quién es</Kicker>
        <SectionTitle id="quien-title" className="mt-2">Empezá simple. Crecé sin cambiar de sistema.</SectionTitle>
        <p className="mt-4 max-w-lg text-lg leading-8 text-muted">DEETA está pensado para comercios que venden productos y necesitan controlar ventas, stock y caja, sin un sistema pesado ni capacitaciones largas.</p>
        <ul className="mt-6 flex flex-wrap gap-x-2 gap-y-2" aria-label="Tipos de negocio">
          {businesses.map((business) => <li key={business} className="rounded-md bg-surface-2 px-3 py-1.5 text-sm font-semibold">{business}</li>)}
          <li className="px-1 py-1.5 text-sm text-muted">y otros comercios minoristas.</li>
        </ul>
      </div>
      <div id="desde-donde-estes" className="min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand"><Smartphone className="size-4" aria-hidden="true" /> Celular y computadora</p>
        <h3 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em]">Tu negocio desde donde estés.</h3>
        <p className="mt-2 leading-7 text-muted">Usalo en el mostrador con el celular y revisá los números tranquilo en la computadora. No hay que instalar nada y los datos son los mismos en todos lados.</p>
        <div className="mt-6"><DevicesPreview /></div>
      </div>
    </section>
  );
}

const differences = [
  ["Profesional, sin ser complicado", "Los términos correctos, explicados en palabras simples."],
  ["Pensado primero para el celular", "Botones grandes, pantallas claras y rápido en el mostrador."],
  ["La cámara como escáner", "Leé códigos de barras sin comprar un lector."],
  ["Números que se entienden", "Cada cifra viene con una explicación de qué significa."],
  ["DEETA AI integrado", "Preguntas en lenguaje común, respuestas con tus datos."],
  ["Todo en un solo lugar", "Ventas, stock, caja, gastos y análisis conectados entre sí."],
] as const;

export function Difference() {
  return (
    <section className="border-y border-line bg-ink text-white" aria-labelledby="diferencia-title">
      <div className={`${container} py-14 lg:py-20`}>
        <p className="text-sm font-semibold text-accent">Por qué DEETA</p>
        <h2 id="diferencia-title" className="mt-2 max-w-2xl font-display text-[clamp(1.75rem,4.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-[-0.025em]">Un sistema profesional que habla simple.</h2>
        <dl className="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {differences.map(([title, text]) => (
            <div key={title} className="border-t border-white/15 py-5">
              <dt className="font-semibold">{title}</dt>
              <dd className="mt-1 leading-7 text-white/70">{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={`${container} py-16 lg:py-24`} aria-labelledby="cta-title">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <Kicker>Podés empezar gratis</Kicker>
          <SectionTitle id="cta-title" className="mt-2 max-w-2xl">Empezá a ordenar tu negocio con DEETA.</SectionTitle>
          <p className="mt-4 max-w-xl text-lg leading-8 text-muted">Creá tu cuenta, cargá tus primeros productos y conocé cómo funciona con tu negocio. Sin tarjeta y sin instalar nada.</p>
        </div>
        <div>
          <StartButtons secondaryLabel="Ya tengo cuenta" />
          <BetaNote />
        </div>
      </div>
    </section>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className={`${container} grid gap-8 pb-24 pt-10 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:pb-10`}>
        <div>
          <p className="font-display text-lg font-extrabold">DEETA</p>
          <p className="mt-1 max-w-xs text-sm leading-6 text-muted">Ventas, stock, caja, gastos y análisis para comercios, en un solo lugar.</p>
        </div>
        <nav aria-label="Producto">
          <p className="text-sm font-semibold">Producto</p>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            {landingLinks.map((link) => <li key={link.href}><a href={link.href} className="inline-flex min-h-9 items-center hover:text-ink">{link.label}</a></li>)}
          </ul>
        </nav>
        <nav aria-label="Acceso">
          <p className="text-sm font-semibold">Acceso</p>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            <li><Link href="/crear-cuenta" className="inline-flex min-h-9 items-center hover:text-ink">Crear cuenta</Link></li>
            <li><Link href="/iniciar-sesion" className="inline-flex min-h-9 items-center hover:text-ink">Ingresar</Link></li>
          </ul>
        </nav>
        <nav aria-label="Ayuda y legales">
          <p className="text-sm font-semibold">DEETA</p>
          <ul className="mt-2 grid gap-1 text-sm text-muted">
            <li><LandingSupportLink className="min-h-9 font-normal hover:text-ink" icon={false}>Contacto</LandingSupportLink></li>
            {getXProfile() && <li><XProfileLink className="hover:text-ink" /></li>}
            <li><Link href="/terminos" className="inline-flex min-h-9 items-center hover:text-ink">Términos</Link></li>
            <li><Link href="/privacidad" className="inline-flex min-h-9 items-center hover:text-ink">Privacidad</Link></li>
          </ul>
        </nav>
      </div>
      <div className={`${container} border-t border-line py-4 pb-24 text-xs text-muted sm:pb-4`}>© {new Date().getFullYear()} DEETA · Beta</div>
    </footer>
  );
}
