import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// Vite cache clearing removed - use `npm run clean` if needed

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        injectionPoint: "self.__WB_MANIFEST",
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2}',
          'icons/weather/**/*.svg' // Иконки погоды
        ]
      },
      includeAssets: [
        "favicon.svg", 
        "icons/sprite.svg", 
        "icons/icon-192x192.png", 
        "icons/icon-512x512.png", 
        "icons/weather/*.svg", // Иконки погоды
        "robots.txt"
      ],
      manifest: {
        id: "/",
        name: "Crocodile",
        short_name: "Crocodile",
        description:
          "Новости без лишней чешуи. Без алгоритмов, трекеров и рекламы.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F8F9FA",
        theme_color: "#6366F1",
        orientation: "portrait-primary",
        lang: "ru",
        categories: ["news", "magazines"],
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["js-big-decimal"],
  },
  css: {
    devSourcemap: true,
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    cssCodeSplit: true,
  },
  server: {
    port: 3000,
    hmr: {
      // Use WebSockets for HMR
      protocol: "ws",
      host: "localhost",
      port: 3000,
    },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const browserId = req.headers['x-browser-id'];
            if (browserId) proxyReq.setHeader('x-browser-id', browserId);
          });
        },
      },
      "/uploads": "http://localhost:5000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
});
