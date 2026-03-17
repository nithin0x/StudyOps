import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false,
    cors: false,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: false,
    cors: false,
  },
  plugins: [react()],
});
