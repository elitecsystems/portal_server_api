import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import QRCode from "qrcode";
import { api, textoError, type Estado2fa } from "../api";
import { useAuth } from "../auth";
import { useStepUp } from "../stepup";
import { Campo, CampoOtp, Cargando, Errores, Exito, useCarga } from "../components/ui";

export function Seguridad() {
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso ?? null;
  const { dosFA, refrescar2fa } = useAuth();
  const { datos, error, cargando, recargar } = useCarga(() => api.get<Estado2fa>("/2fa"), []);
  const [codigosNuevos, setCodigosNuevos] = useState<string[] | null>(null);
  // Si llego aqui SIN 2FA es el primer paso de una cuenta nueva (o de una a la que se le
  // reseteo): al terminar hay que dejarla seguir, y no antes de que guarde sus codigos.
  const esPrimerPaso = useRef(dosFA === false);

  return (
    <>
      <h1>{esPrimerPaso.current ? "Paso 1: protege tu cuenta" : "Seguridad de la cuenta"}</h1>
      {/* El aviso "primero activa..." deja de tener sentido apenas se activa. */}
      {aviso && !codigosNuevos && !datos?.configurado && <div className="aviso ambar">{aviso}</div>}
      <Cargando error={error} cargando={cargando} />
      {datos && !datos.configurado && (
        <Configurar2fa
          alTerminar={(codigos) => {
            setCodigosNuevos(codigos);
            recargar();
            void refrescar2fa();
          }}
        />
      )}
      {codigosNuevos && <CodigosRecuperacion codigos={codigosNuevos} />}
      {esPrimerPaso.current && codigosNuevos && (
        <div className="acciones">
          <Link className="boton" to="/">Ya guardé mis códigos, continuar</Link>
        </div>
      )}
      {datos?.configurado && (
        <>
          <section className="tarjeta">
            <h2>Verificación en dos pasos</h2>
            <p>
              <strong>Activa.</strong> Te quedan {datos.codigos_recuperacion_restantes} códigos de recuperación.
            </p>
            <p className="suave">
              Si cambias de teléfono y ya no tienes acceso a tu aplicación de verificación, la empresa puede restablecerla
              por ti.
            </p>
            <RegenerarCodigos alGenerar={(c) => { setCodigosNuevos(c); recargar(); }} />
          </section>
          <CambiarPassword />
          <CambiarCorreoAcceso />
        </>
      )}
    </>
  );
}

function Configurar2fa({ alTerminar }: { alTerminar: (codigos: string[]) => void }) {
  const [password, setPassword] = useState("");
  const [inicio, setInicio] = useState<{ secreto: string; uri: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (inicio) void QRCode.toDataURL(inicio.uri, { margin: 1, width: 220 }).then(setQr);
  }, [inicio]);

  const iniciar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      setInicio(await api.post("/2fa/iniciar", { password }));
    } catch (e) {
      setError(textoError(e));
    }
    setEnviando(false);
  };

  const confirmar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (codigo.length !== 6) return setError("Escribe los 6 dígitos del código OTP.");
    setEnviando(true);
    setError(null);
    try {
      const r = await api.post<{ codigos_recuperacion: string[] }>("/2fa/confirmar", { codigo: codigo.trim() });
      alTerminar(r.codigos_recuperacion);
    } catch (e) {
      setError(textoError(e));
      setEnviando(false);
    }
  };

  return (
    <section className="tarjeta">
      <h2>Activa la verificación en dos pasos</h2>
      <p className="suave">
        Es necesaria para cambiar correos, datos fiscales o tu contraseña. Necesitas una aplicación de verificación en tu
        teléfono (Google Authenticator, Microsoft Authenticator, Authy…).
      </p>
      <Errores mensaje={error} />
      {!inicio ? (
        <form onSubmit={iniciar}>
          <Campo etiqueta="Tu contraseña actual">
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Campo>
          <button disabled={enviando}>Comenzar</button>
        </form>
      ) : (
        <form onSubmit={confirmar}>
          <p>1. Escanea este código con tu aplicación:</p>
          {qr && <img className="qr" src={qr} width={220} height={220} alt="Código QR para tu aplicación de verificación" />}
          <p className="suave">¿No puedes escanear? Escribe esta clave a mano: <code>{inicio.secreto}</code></p>
          <p>2. Escribe el código de 6 dígitos que muestra la aplicación:</p>
          <CampoOtp etiqueta="Código OTP de 6 dígitos" valor={codigo} onChange={setCodigo} />
          <button disabled={enviando}>Activar</button>
        </form>
      )}
    </section>
  );
}

function CodigosRecuperacion({ codigos }: { codigos: string[] }) {
  return (
    <section className="tarjeta">
      <h2>Tus códigos de recuperación</h2>
      <div className="aviso ambar">
        Guárdalos ahora en un lugar seguro. <strong>No volverán a mostrarse.</strong> Cada uno sirve una sola vez si pierdes
        acceso a tu aplicación.
      </div>
      <div className="codigos">
        {codigos.map((c) => (
          <code key={c}>{c}</code>
        ))}
      </div>
      <button className="secundario" onClick={() => void navigator.clipboard?.writeText(codigos.join("\n"))}>
        Copiar todos
      </button>
    </section>
  );
}

function RegenerarCodigos({ alGenerar }: { alGenerar: (c: string[]) => void }) {
  const stepUp = useStepUp();
  const [error, setError] = useState<string | null>(null);
  const generar = async () => {
    if (!confirm("Los códigos actuales dejarán de servir. ¿Generar nuevos?")) return;
    setError(null);
    try {
      const r = await stepUp(() => api.post<{ codigos_recuperacion: string[] }>("/2fa/codigos-recuperacion"));
      alGenerar(r.codigos_recuperacion);
    } catch (e) {
      setError(textoError(e));
    }
  };
  return (
    <>
      <Errores mensaje={error} />
      <button className="secundario" onClick={() => void generar()}>Generar códigos nuevos</button>
    </>
  );
}

function CambiarCorreoAcceso() {
  const stepUp = useStepUp();
  const [correo, setCorreo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setOk(null);
    setError(null);
    try {
      await stepUp(() => api.post("/correo-acceso/cambiar", { correo }));
      setOk("Te enviamos un enlace de confirmación al correo nuevo. Hasta que lo abras, sigues entrando con el actual.");
      setCorreo("");
    } catch (e) {
      setError(textoError(e));
    }
  };

  return (
    <section className="tarjeta">
      <h2>Correo de acceso</h2>
      <p className="suave">Es el correo con el que entras al portal. Al actual le avisaremos del cambio, con un enlace para revertirlo.</p>
      <Errores mensaje={error} />
      <Exito mensaje={ok} />
      <form onSubmit={enviar}>
        <Campo etiqueta="Correo nuevo">
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required maxLength={254} />
        </Campo>
        <button>Enviar enlace de confirmación</button>
      </form>
    </section>
  );
}

function CambiarPassword() {
  const stepUp = useStepUp();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setOk(null);
    if (nueva !== repetir) return setError("Las contraseñas nuevas no coinciden.");
    setError(null);
    try {
      await stepUp(() => api.post("/password/cambiar", { password_actual: actual, password_nueva: nueva }));
      setOk("Contraseña actualizada. Cerramos tus otras sesiones abiertas.");
      setActual("");
      setNueva("");
      setRepetir("");
    } catch (e) {
      setError(textoError(e));
    }
  };

  return (
    <section className="tarjeta">
      <h2>Cambiar contraseña</h2>
      <Errores mensaje={error} />
      <Exito mensaje={ok} />
      <form onSubmit={enviar}>
        <Campo etiqueta="Contraseña actual">
          <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Contraseña nueva" ayuda="Mínimo 10 caracteres.">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={200} value={nueva} onChange={(e) => setNueva(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Repite la contraseña nueva">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={200} value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        </Campo>
        <button>Cambiar contraseña</button>
      </form>
    </section>
  );
}
