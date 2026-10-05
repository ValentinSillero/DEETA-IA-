import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DEETA — Gestión para tu negocio",
    short_name: "DEETA",
    description: "Administrá y entendé tu negocio desde cualquier lugar.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f6fb",
    theme_color: "#f7f6fb",
    icons: [
      {
        src: "/brand/deeta-icon.png",
        sizes: "1280x1280",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
