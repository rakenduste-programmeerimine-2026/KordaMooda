import type { MetadataRoute } from "next";

/** Lets phones add the app to the home screen and open it without the browser bars (#20). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KordaMööda",
    short_name: "KordaMööda",
    description: "Näitab koos elavatele inimestele kohe, kelle kord iga kodutöö on.",
    lang: "et",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F5FA",
    theme_color: "#F5F5FA",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // The icon fills its square edge to edge, so it also works where phones crop it round.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
