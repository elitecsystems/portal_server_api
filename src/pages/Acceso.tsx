import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError, textoError, type Cuenta } from "../api";
import { useAuth } from "../auth";
import { Campo, Errores, Exito, useCarga } from "../components/ui";
import { Publico } from "../components/Layout";
import { tokenDelFragmento } from "../format";

export function Login() {
  const { cuenta, entrar, cargando } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sinVerificar, setSinVerificar] = useState(false);
  const aviso = (loc.state as { aviso?: string } | null)?.aviso ?? null;

  if (!cargando && cuenta) return <Navigate to="/" replace />;

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEnviando(true);
    setError(null);
    setSinVerificar(false);
    try {
      entrar(await api.post<Cuenta>("/login", { correo, password }));
      nav("/", { replace: true });
    } catch (e) {
      // Contrasena correcta, correo sin confirmar (decisiones/0104): no es un
      // error de credenciales, falta un paso.
      setSinVerificar(e instanceof ApiError && e.requiere === "verificar_correo");
      setError(textoError(e));
      setEnviando(false);
    }
  };

  return (
    <Publico titulo="Entrar">
      <Exito mensaje={aviso} />
      <Errores mensaje={error} />
      {sinVerificar && <ReenviarVerificacion correo={correo} password={password} />}
      <form onSubmit={enviar}>
        <Campo etiqueta="Correo">
          <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoFocus />
        </Campo>
        <Campo etiqueta="Contraseña">
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Campo>
        <button disabled={enviando} style={{ width: "100%" }}>{enviando ? "Entrando…" : "Entrar"}</button>
      </form>
      <p style={{ marginTop: 16 }}><Link to="/olvide">Olvidé mi contraseña</Link></p>
      <p className="suave">¿Todavía no tienes cuenta? Tu cuenta la da de alta la empresa y recibirás una invitación por correo.</p>
    </Publico>
  );
}

/** El correo de verificacion no llego o se perdio: pedir otro (pide las credenciales
 *  para que nadie pueda mandar correos a un correo ajeno). */
function ReenviarVerificacion({ correo, password }: { correo: string; password: string }) {
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado">("listo");
  const [error, setError] = useState<string | null>(null);

  const reenviar = async () => {
    setEstado("enviando");
    setError(null);
    try {
      await api.post("/correo/reenviar-verificacion", { correo, password });
      setEstado("enviado");
    } catch (e) {
      setError(textoError(e));
      setEstado("listo");
    }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <Errores mensaje={error} />
      {estado === "enviado" ? (
        <Exito mensaje="Te enviamos otro correo. Revisa también la carpeta de spam; el enlace anterior ya no sirve." />
      ) : (
        <button type="button" className="secundario" disabled={estado === "enviando"} onClick={() => void reenviar()}>
          {estado === "enviando" ? "Enviando…" : "Reenviar correo de verificación"}
        </button>
      )}
    </div>
  );
}

export function Olvide() {
  const [correo, setCorreo] = useState("");
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await api.post("/password/olvide", { correo });
      setListo(true);
    } catch (e) {
      setError(textoError(e));
    }
    setEnviando(false);
  };

  return (
    <Publico titulo="Restablecer contraseña">
      {listo ? (
        <>
          <Exito mensaje="Si ese correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva." />
          <Link to="/login">Volver a entrar</Link>
        </>
      ) : (
        <form onSubmit={enviar}>
          <Errores mensaje={error} />
          <Campo etiqueta="Correo de tu cuenta">
            <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required autoFocus />
          </Campo>
          <button disabled={enviando}>Enviar enlace</button>
          <p><Link to="/login">Cancelar</Link></p>
        </form>
      )}
    </Publico>
  );
}

/** Restablecer contrasena: token del fragmento (llega por correo) + contrasena nueva. */
export function Restablecer() {
  const nav = useNavigate();
  const token = useRef<string | null | undefined>(undefined);
  if (token.current === undefined) token.current = tokenDelFragmento();
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!token.current) {
    return (
      <Publico titulo="Contraseña nueva">
        <Errores mensaje="El enlace está incompleto. Ábrelo de nuevo desde el correo." />
        <Link to="/login">Ir a entrar</Link>
      </Publico>
    );
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (password !== repetir) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    setError(null);
    try {
      await api.post("/password/restablecer", { token: token.current, password });
      nav("/login", { replace: true, state: { aviso: "Contraseña actualizada. Entra con la nueva." } });
    } catch (e) {
      setError(textoError(e));
      setEnviando(false);
    }
  };

  return (
    <Publico titulo="Contraseña nueva">
      <Errores mensaje={error} />
      <form onSubmit={enviar}>
        <Campo etiqueta="Contraseña nueva" ayuda="Mínimo 10 caracteres.">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </Campo>
        <Campo etiqueta="Repite la contraseña">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={200} value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        </Campo>
        <button disabled={enviando} style={{ width: "100%" }}>{enviando ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </Publico>
  );
}

/** Enlace que la empresa manda a mano: quien lo abre llena sus propios datos y
 *  AQUI nace su cuenta, con acceso a los condominios que la empresa eligio. */
export function Invitacion() {
  const token = useRef<string | null | undefined>(undefined);
  if (token.current === undefined) token.current = tokenDelFragmento();
  const consulta = useCarga(
    () => (token.current ? api.post<{ condominios: string[] }>("/invitaciones/consultar", { token: token.current }) : Promise.reject(new ApiError(410, "El enlace está incompleto."))),
    [],
  );
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [creada, setCreada] = useState<string | null>(null);

  if (creada) {
    return (
      <Publico titulo="Revisa tu correo">
        <Exito mensaje="Tu cuenta quedó creada." />
        <p>
          Te enviamos un correo a <strong>{creada}</strong> con un enlace para confirmar que es tuyo. Ábrelo y después podrás
          entrar con tu contraseña.
        </p>
        <p className="suave">Si no lo ves en unos minutos, revisa spam. ¿Escribiste mal el correo? Pide a la empresa un enlace nuevo.</p>
        <ReenviarVerificacion correo={creada} password={password} />
        <Link to="/login">Ir a entrar</Link>
      </Publico>
    );
  }

  if (consulta.cargando) return <Publico titulo="Crea tu cuenta"><p className="suave">Verificando el enlace…</p></Publico>;
  if (consulta.error || !consulta.datos) {
    return (
      <Publico titulo="Crea tu cuenta">
        <Errores mensaje={consulta.error ?? "El enlace no es válido. Pide uno nuevo a la empresa."} />
        <Link to="/login">Ir a entrar</Link>
      </Publico>
    );
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (password !== repetir) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    setError(null);
    try {
      const cuenta = await api.post<Cuenta>("/invitaciones/aceptar", {
        token: token.current,
        nombre,
        correo,
        telefono: telefono.trim() || undefined,
        password,
      });
      setCreada(cuenta.correo);
    } catch (e) {
      setError(textoError(e));
      setEnviando(false);
    }
  };

  return (
    <Publico titulo="Crea tu cuenta">
      <p>
        Elitec Systems te da acceso al portal de clientes para:
      </p>
      <ul>
        {consulta.datos.condominios.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <Errores mensaje={error} />
      <form onSubmit={enviar}>
        <Campo etiqueta="Tu nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={200} autoComplete="name" autoFocus />
        </Campo>
        <Campo etiqueta="Correo" ayuda="Te enviaremos un correo para confirmar que es tuyo. Con él entrarás al portal.">
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required maxLength={254} autoComplete="username" />
        </Campo>
        <Campo etiqueta="Teléfono (opcional)">
          <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={40} autoComplete="tel" />
        </Campo>
        <Campo etiqueta="Contraseña" ayuda="Mínimo 10 caracteres.">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Repite la contraseña">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={200} value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        </Campo>
        <button disabled={enviando} style={{ width: "100%" }}>{enviando ? "Creando…" : "Crear cuenta"}</button>
      </form>
    </Publico>
  );
}

/** Los cuatro enlaces de correo (confirmar/revertir contacto y acceso). Publicos:
 *  quien abre el enlace puede no tener sesion. Un token malo da siempre 410. */
const ENLACES = {
  "verificar-correo": { ruta: "/correo/verificar", titulo: "Confirmar tu correo", ok: "Correo confirmado. Ya puedes entrar con tu contraseña." },
  "confirmar-correo-contacto": { ruta: "/correo-contacto/confirmar", titulo: "Confirmar correo de contacto", ok: "Listo: el correo de contacto quedó confirmado." },
  "revertir-correo-contacto": { ruta: "/correo-contacto/revertir", titulo: "Revertir cambio de correo de contacto", ok: "Revertimos el cambio: el correo de contacto volvió al anterior." },
  "confirmar-correo-acceso": { ruta: "/correo-acceso/confirmar", titulo: "Confirmar correo de acceso", ok: "Listo: tu correo de acceso quedó actualizado." },
  "revertir-correo-acceso": { ruta: "/correo-acceso/revertir", titulo: "Revertir cambio de correo de acceso", ok: "Revertimos el cambio de correo de acceso." },
} as const;

export function EnlaceCorreo({ tipo }: { tipo: keyof typeof ENLACES }) {
  const cfg = ENLACES[tipo];
  const esReversa = tipo.startsWith("revertir");
  const token = useRef<string | null | undefined>(undefined);
  if (token.current === undefined) token.current = tokenDelFragmento();
  const [estado, setEstado] = useState<"espera" | "enviando" | "ok" | "error">(token.current ? "espera" : "error");
  const [error, setError] = useState<string | null>(token.current ? null : "El enlace está incompleto.");
  // El enlace es de UN solo uso: la peticion sale una vez por visita. React en
  // desarrollo (StrictMode) monta el efecto dos veces; sin este candado la segunda
  // llamada recibia 410 y pisaba en pantalla el exito de la primera.
  const yaEnviado = useRef(false);

  // Confirmar corre solo; revertir pide un clic: bloquea la cuenta que hizo el
  // cambio, y no debe dispararse por una vista previa del enlace.
  useEffect(() => {
    if (!esReversa && token.current) void ejecutar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ejecutar() {
    if (yaEnviado.current) return;
    yaEnviado.current = true;
    setEstado("enviando");
    try {
      await api.post(cfg.ruta, { token: token.current });
      setEstado("ok");
    } catch (e) {
      // Un enlace ya usado y uno vencido dan el mismo 410. Si ya confirmaste el
      // correo, lo que falta es entrar.
      setError(
        e instanceof ApiError && e.status === 410 && tipo === "verificar-correo"
          ? `${textoError(e)} Si ya confirmaste tu correo, solo entra con tu contraseña.`
          : textoError(e),
      );
      setEstado("error");
    }
  }

  return (
    <Publico titulo={cfg.titulo}>
      {estado === "enviando" && <p className="suave">Procesando…</p>}
      {estado === "ok" && (
        <>
          <Exito mensaje={cfg.ok} />
          {esReversa && <p>Por seguridad, la cuenta que hizo el cambio quedó bloqueada; la recupera el administrador de la empresa.</p>}
        </>
      )}
      {estado === "error" && <Errores mensaje={error} />}
      {estado === "espera" && esReversa && (
        <>
          <p>Si no fuiste tú quien pidió este cambio, revértelo. La cuenta que lo pidió quedará bloqueada y solo el administrador de la empresa puede recuperarla.</p>
          <button onClick={() => void ejecutar()}>No fui yo, revertir el cambio</button>
        </>
      )}
      <p style={{ marginTop: 16 }}><Link to="/login">Ir al portal</Link></p>
    </Publico>
  );
}
