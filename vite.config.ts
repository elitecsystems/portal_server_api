import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo el navegador abre http://clientes.localhost:5173 y Vite reenvia
// /portal/* a la API. El middleware de host de la API (app/main.py) exige que el
// Host y el Origin sean los de PORTAL_CLIENTES_URL, asi que el proxy los fija a
// ese valor, que debe ser el mismo PORTAL_CLIENTES_URL del .env de la API (tambien
// es la base de los enlaces de los correos de invitacion).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_TARGET || "http://127.0.0.1:8000";
  const portalUrl = new URL(env.PORTAL_CLIENTES_URL || "http://clientes.localhost:5173");
  return {
    plugins: [react()],
    server: {
      // Node en Windows no resuelve *.localhost; el navegador si. Se escucha en
      // loopback y se abre http://clientes.localhost:5173.
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/portal": {
          target: apiTarget,
          changeOrigin: false,
          headers: { Host: portalUrl.host, Origin: portalUrl.origin },
        },
      },
    },
  };
});
