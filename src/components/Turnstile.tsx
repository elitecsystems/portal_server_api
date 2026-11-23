import { useEffect, useRef } from "react";

// Cloudflare Turnstile: el desafio que separa a una persona de un bot en el registro (gratis, sin puzzles de
// imagenes). La llave publica va en VITE_TURNSTILE_SITE_KEY. Sin llave (desarrollo local) no se dibuja nada y se
// manda un token de relleno: la API solo lo acepta si corre con TURNSTILE_DESACTIVADO=1; en produccion, sin llave
// el registro simplemente no pasa, que es lo seguro.

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opciones: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
export const TOKEN_SIN_TURNSTILE = "sin-turnstile";

let cargando: Promise<void> | null = null;
function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!cargando) {
    cargando = new Promise((resolver, rechazar) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => resolver();
      s.onerror = () => {
        cargando = null;
        rechazar(new Error("No se pudo cargar la verificación."));
      };
      document.head.appendChild(s);
    });
  }
  return cargando;
}

/** `onToken(null)` cuando el token vence o falla: el formulario no debe mandar uno viejo. `reiniciar` cambia para
 *  pedir un desafio nuevo (un token sirve una sola vez, asi que tras un intento fallido hay que renovarlo). */
export function Turnstile({ onToken, reiniciar }: { onToken: (t: string | null) => void; reiniciar: number }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const alToken = useRef(onToken);
  alToken.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) {
      alToken.current(TOKEN_SIN_TURNSTILE);
      return;
    }
    let vivo = true;
    cargarScript()
      .then(() => {
        if (!vivo || !contenedor.current || !window.turnstile) return;
        if (widget.current) window.turnstile.remove(widget.current);
        widget.current = window.turnstile.render(contenedor.current, {
          sitekey: SITE_KEY,
          language: "es",
          callback: (t: string) => alToken.current(t),
          "expired-callback": () => alToken.current(null),
          "error-callback": () => alToken.current(null),
        });
      })
      .catch(() => alToken.current(null));
    return () => {
      vivo = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [reiniciar]);

  return SITE_KEY ? <div ref={contenedor} style={{ margin: "12px 0" }} /> : null;
}
