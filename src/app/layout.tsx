import type { Metadata, Viewport } from "next";

import "./globals.css";

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
  themeColor: "#f7f6fb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
