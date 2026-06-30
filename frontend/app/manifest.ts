import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Noor Safar",
    short_name: "Noor Safar",
    description: "Quran, Hadith, Salah times, Qibla, duas, and khutba tools for travel.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0d221f",
    theme_color: "#255a4e",
    icons: [
      { src: "/logo-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
