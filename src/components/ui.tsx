import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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

/** Código OTP de 6 dígitos, una casilla por dígito: al escribir salta a la siguiente,
 *  Retroceso vuelve a la anterior y pegar el código completo lo reparte solo. */
export function CampoOtp({ etiqueta, valor, onChange, autoFocus }: { etiqueta: string; valor: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const LARGO = 6;
  const casillas = useRef<(HTMLInputElement | null)[]>([]);
  const digitos = valor.padEnd(LARGO, " ").split("").slice(0, LARGO);

  const poner = (texto: string, desde: number) => {
    const nuevos = texto.replace(/\D/g, "");
    if (!nuevos) return;
    const base = digitos.slice();
    let i = desde;
    for (const d of nuevos) {
      if (i >= LARGO) break;
      base[i++] = d;
    }
    onChange(base.join("").replace(/ /g, "").slice(0, LARGO));
    casillas.current[Math.min(i, LARGO - 1)]?.focus();
  };

  const alTeclear = (ev: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (ev.key === "Backspace") {
      ev.preventDefault();
      const base = digitos.slice();
      if (base[i] !== " ") base[i] = " ";
      else if (i > 0) {
        base[i - 1] = " ";
        casillas.current[i - 1]?.focus();
      }
      onChange(base.join("").trimEnd());
    } else if (ev.key === "ArrowLeft" && i > 0) casillas.current[i - 1]?.focus();
    else if (ev.key === "ArrowRight" && i < LARGO - 1) casillas.current[i + 1]?.focus();
  };

  return (
    <div className="campo" role="group" aria-label={etiqueta}>
      <span>{etiqueta}</span>
      <div className="otp">
        {digitos.map((d, i) => (
          <input
            key={i}
            ref={(el) => { casillas.current[i] = el; }}
            className="otp-casilla"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Dígito ${i + 1} de ${LARGO}`}
            value={d.trim()}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => poner(e.target.value.slice(-LARGO), i)}
            onPaste={(e) => { e.preventDefault(); poner(e.clipboardData.getData("text"), i); }}
            onKeyDown={(e) => alTeclear(e, i)}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
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
