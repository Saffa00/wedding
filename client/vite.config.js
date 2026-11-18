import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest", // our own Workbox service worker: src/sw.js
      srcDir: "src",
      filename: "sw.js",
      registerType: "prompt", // the user chooses when to update, so a scan is never interrupted
      injectRegister: false, // registration is handled by <PwaUpdatePrompt />
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ico}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        id: "/",
        name: "Berchelle Check-in",
        short_name: "Berchelle",
        description: "Berchelle invitations and QR guest check-in.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FBF8F1",
        theme_color: "#0B4D3A",
        categories: ["lifestyle", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Scan invitation", short_name: "Scan", url: "/usher/scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
    }),
  ],
});
