import { useEffect, useState, type ReactNode } from "react";
import { textoError } from "../api";

export function Errores({ mensaje }: { mensaje: string | null }) {
  return mensaje ? (
    <div className="aviso error" role="alert">
      {mensaje}
    </div>
  ) : null;
}

export function Exito({ mensaje }: { mensaje: string | null }) {
  return mensaje ? (
    <div className="aviso exito" role="status">
      {mensaje}
    </div>
  ) : null;
}

/** Un "?" que explica algo al pasar el cursor, al enfocarlo con el teclado o al
 *  tocarlo en el celular. */
export function Info({ texto }: { texto: string }) {
  return (
    <span className="info" tabIndex={0} role="note" aria-label={texto}>
      <span aria-hidden="true" className="info-icono">?</span>
      <span className="info-texto" role="tooltip">{texto}</span>
    </span>
  );
}

export function Campo({ etiqueta, ayuda, info, children }: { etiqueta: string; ayuda?: string; info?: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>
        {etiqueta}
        {info && <Info texto={info} />}
      </span>
      {children}
      {ayuda && <small className="suave">{ayuda}</small>}
    </label>
  );
}

export function Insignia({ tono, children }: { tono: "gris" | "azul" | "verde" | "rojo" | "ambar"; children: ReactNode }) {
  return <span className={`insignia ${tono}`}>{children}</span>;
}

/** Carga un recurso al montar (o cuando cambia `clave`) y expone su estado. */
export function useCarga<T>(cargar: () => Promise<T>, clave: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    cargar()
      .then((d) => vigente && (setDatos(d), setError(null)))
      .catch((e) => vigente && setError(textoError(e)))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...clave, version]);

  return { datos, error, cargando, recargar: () => setVersion((v) => v + 1), poner: setDatos };
}

export function Cargando({ error, cargando }: { error: string | null; cargando: boolean }) {
  if (error) return <Errores mensaje={error} />;
  if (cargando) return <p className="suave">Cargando…</p>;
  return null;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="vacio">{children}</p>;
}
