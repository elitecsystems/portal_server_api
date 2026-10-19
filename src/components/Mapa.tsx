import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconoUrl from "leaflet/dist/images/marker-icon.png";
import icono2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import sombraUrl from "leaflet/dist/images/marker-shadow.png";

// Los bundlers rompen la ruta por defecto de las imagenes del marcador.
const iconoPin = L.icon({
  iconUrl: iconoUrl,
  iconRetinaUrl: icono2xUrl,
  shadowUrl: sombraUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

export type Punto = { lat: number; lng: number };

// Zapopan, Jalisco: de donde sale la empresa. Solo es el centro inicial.
const CENTRO_INICIAL: Punto = { lat: 20.7213, lng: -103.3918 };

/** Mapa con un pin que se coloca con un clic y se arrastra para afinarlo.
 *  OpenStreetMap + Leaflet: no necesita clave ni facturacion (decisiones/0105). */
export function Mapa({ valor, onChange }: { valor: Punto | null; onChange: (p: Punto) => void }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const alCambiar = useRef(onChange);
  alCambiar.current = onChange;

  // Se crea una sola vez.
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const inicio = valor ?? CENTRO_INICIAL;
    const m = L.map(contenedor.current).setView([inicio.lat, inicio.lng], valor ? 17 : 12);
    // OpenStreetMap exige un Referer en cada tile (su politica de uso): sin el
    // devuelve "403 Access blocked". Solo el origen, nunca la ruta.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "origin",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => alCambiar.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El pin sigue al valor (clic, arrastre o coordenada pegada).
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!valor) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      const marcador = L.marker([valor.lat, valor.lng], { draggable: true, icon: iconoPin }).addTo(m);
      marcador.on("dragend", () => {
        const { lat, lng } = marcador.getLatLng();
        alCambiar.current({ lat, lng });
      });
      pin.current = marcador;
    } else {
      pin.current.setLatLng([valor.lat, valor.lng]);
    }
    if (!m.getBounds().contains([valor.lat, valor.lng])) m.setView([valor.lat, valor.lng], Math.max(m.getZoom(), 16));
  }, [valor]);

  return <div ref={contenedor} className="mapa" role="application" aria-label="Mapa para colocar el pin del condominio" />;
}
