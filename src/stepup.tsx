import { createContext, useCallback, useContext, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, textoError } from "./api";
import { Campo, Errores } from "./components/ui";

// Acciones sensibles: la API contesta 403 con `requiere`. Aqui se decide a que
// pantalla mandar al usuario y se reintenta la accion despues.
// 403 y no 401 a proposito: 401 cierra la sesion, 403 solo pide un paso mas.

type Ejecutar = <T>(accion: () => Promise<T>) => Promise<T>;
const Ctx = createContext<Ejecutar>(null as never);
export const useStepUp = () => useContext(Ctx);

export function StepUpProvider({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const espera = useRef<{ ok: () => void; no: (e: unknown) => void } | null>(null);

  const pedirReautenticacion = () =>
    new Promise<void>((ok, no) => {
      espera.current = { ok, no };
      setAbierto(true);
    });

  const ejecutar: Ejecutar = useCallback(
    async (accion) => {
      try {
        return await accion();
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 403) throw e;
        if (e.requiere === "configurar_2fa") {
          nav("/seguridad", { state: { aviso: e.message } });
          throw new ApiError(0, "Configura la verificación en dos pasos para continuar.");
        }
        if (e.requiere === "reautenticar") {
          await pedirReautenticacion();
          return await accion();
        }
        throw e;
      }
    },
    [nav],
  );

  const cerrar = (error?: unknown) => {
    setAbierto(false);
    if (error) espera.current?.no(error);
    else espera.current?.ok();
    espera.current = null;
  };

  return (
    <Ctx.Provider value={ejecutar}>
      {children}
      {abierto && (
        <ModalReautenticar onListo={() => cerrar()} onCancelar={() => cerrar(new ApiError(0, "Acción cancelada."))} />
      )}
    </Ctx.Provider>
  );
}

function ModalReautenticar({ onListo, onCancelar }: { onListo: () => void; onCancelar: () => void }) {
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.post("/reautenticar", { password, codigo: codigo.trim() });
      onListo();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 423
          ? "La cuenta quedó bloqueada por demasiados códigos equivocados. Contacta a la empresa."
          : textoError(e),
      );
      setEnviando(false);
    }
  };

  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-labelledby="titulo-reauth">
      <form className="modal tarjeta" onSubmit={enviar}>
        <h2 id="titulo-reauth">Confirma tu identidad</h2>
        <p className="suave">
          Para esta acción pedimos tu contraseña y un código de tu aplicación de verificación. Vale 5 minutos.
        </p>
        <Errores mensaje={error} />
        <Campo etiqueta="Contraseña">
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </Campo>
        <Campo etiqueta="Código de 6 dígitos o de recuperación">
          <input autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} required minLength={6} maxLength={20} />
        </Campo>
        <div className="acciones">
          <button type="button" className="secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button disabled={enviando}>{enviando ? "Verificando…" : "Confirmar"}</button>
        </div>
      </form>
    </div>
  );
}
