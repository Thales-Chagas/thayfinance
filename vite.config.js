import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Com domínio próprio (www.thayfinance.com) o app mora na raiz, igual no PC.
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // service worker próprio (src/sw.js): precache + notificações push
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webp}"],
      },
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "Thayfinance",
        short_name: "Thayfinance",
        description: "Controle financeiro — Thayfinance",
        lang: "pt-BR",
        theme_color: "#059669",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        // Segurar o ícone do app (Android) mostra estes atalhos
        shortcuts: [
          { name: "Nova despesa", short_name: "Despesa", url: "/?acao=nova-despesa", icons: [{ src: "pwa-192.png", sizes: "192x192", type: "image/png" }] },
          { name: "Nova receita", short_name: "Receita", url: "/?acao=nova-receita", icons: [{ src: "pwa-192.png", sizes: "192x192", type: "image/png" }] },
        ],
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
