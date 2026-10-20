import type { Metadata, Viewport } from "next";
import { Inter, Schibsted_Grotesk } from "next/font/google";

import "./globals.css";

const ui = Inter({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const heading = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "DEETA — Tu negocio, siempre con vos",
    template: "%s | DEETA",
  },
  description: "Administrá y entendé tu negocio desde cualquier lugar.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/deeta-icon.png", type: "image/png", sizes: "1280x1280" }],
    shortcut: "/brand/deeta-icon.png",
    apple: [{ url: "/brand/deeta-icon.png", type: "image/png", sizes: "1280x1280" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom bloqueado (decisión de producto).
  maximumScale: 1,
  userScalable: false,
  // Con el teclado abierto el área visible se achica y lo que va fijo abajo
  // (la pregunta de DEETA AI, el carrito) queda encima del teclado. No afecta el zoom.
  interactiveWidget: "resizes-content",
  themeColor: "#f6f5f9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${ui.variable} ${heading.variable}`}>
      <body>{children}</body>
    </html>
  );
}
