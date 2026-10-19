export const dinero = (v: string | number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v));

export const fecha = (iso: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(iso));

export const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export const ESTADO_PEDIDO: Record<string, string> = {
  creado: "Recibido",
  asignado: "Asignado",
  en_sitio: "Técnico en sitio",
  en_progreso: "En progreso",
  parcial: "Parcialmente resuelto",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

export const ESTADO_PAGO: Record<string, string> = {
  no_aplica: "No aplica",
  pendiente: "Pendiente",
  parcial: "Pago parcial",
  completo: "Pagado",
};

let tokenLeido: { ruta: string; token: string } | null = null;

/** Token de un enlace (#token=...). Se lee una vez y se borra de la barra de
 *  direcciones; se recuerda por ruta porque React (StrictMode en dev) puede
 *  renderizar dos veces y la segunda ya no veria el fragmento. */
export function tokenDelFragmento(): string | null {
  const ruta = window.location.pathname;
  const t = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
  if (t) {
    tokenLeido = { ruta, token: t };
    history.replaceState(null, "", ruta + window.location.search);
  }
  return tokenLeido && tokenLeido.ruta === ruta ? tokenLeido.token : null;
}

/** Coordenada de un texto: "lat, lon" (clic derecho en Google Maps -> copiar
 *  coordenadas) o un link largo de Google Maps. Mismo criterio que el escritorio. */
export function parsearCoordenada(texto: string): { lat: number; lng: number } | null {
  const t = texto.trim();
  if (!t) return null;
  let m = t.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) m = t.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (!m) m = t.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (!m) m = t.match(/[?&](?:q|query|ll|center|destination)=(-?\d{1,3}\.\d+)(?:%2C|,)\s*(-?\d{1,3}\.\d+)/i);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}
