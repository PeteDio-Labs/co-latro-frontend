import { defineConfig } from "vite";

// Dev proxy: the browser only ever calls same-origin /api, which Vite forwards to the
// Express backend on :3020 — so CORS never enters the picture in development.
export default defineConfig({
  server: {
    host: true, // bind 0.0.0.0 so phones/other devices on the LAN can reach the dev server
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3020",
        changeOrigin: true,
      },
    },
  },
});
