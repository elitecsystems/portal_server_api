import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, textoError, type Condominio, type Modalidad, type Sistema, type Solicitud } from "../api";
import { fechaHora } from "../format";
import { Campo, Cargando, Errores, Insignia, Vacio, useCarga } from "../components/ui";

// El tope de la API para la descripcion que se corrige al contestar una revision.
const MAX_DESCRIPCION = 6000;

const ETIQUETA_MODALIDAD: Record<Modalidad, string> = { correctivo: "Correctivo", preventivo: "Preventivo" };

// La pregunta abierta cambia con la modalidad: algo falla, o se quiere prevenir.
const PREGUNTA_DETALLE: Record<Modalidad, { etiqueta: string; ayuda: string }> = {
  correctivo: { etiqueta: "¿Qué falla?", ayuda: "Cuéntanos qué está fallando y dónde dentro del condominio." },
  preventivo: { etiqueta: "¿Qué tipo de prevención requiere?", ayuda: "Por ejemplo: revisión general, limpieza, lubricación o ajuste." },
};

/** Los sistemas de una solicitud ("CCTV (correctivo), Portones (preventivo)"). Las anteriores a
 *  los sistemas no los tienen: se muestran con los tipos de servicio que se marcaron. */
function resumenSistemas(s: Solicitud): string {
  if (s.sistemas.length > 0) return s.sistemas.map((x) => `${x.nombre} (${ETIQUETA_MODALIDAD[x.modalidad].toLowerCase()})`).join(", ");
  return s.tipos_servicio.map((t) => t.nombre).join(", ");
}

export function EstadoSolicitud({ s }: { s: Solicitud["estado"] }) {
  if (s === "pendiente") return <Insignia tono="azul">Recibida</Insignia>;
  if (s === "en_revision") return <Insignia tono="ambar">Falta información</Insignia>;
  if (s === "convertida") return <Insignia tono="verde">Aceptada</Insignia>;
  return <Insignia tono="rojo">Rechazada</Insignia>;
}

export function ListaSolicitudes() {
  const { datos, error, cargando } = useCarga(() => api.get<Solicitud[]>("/solicitudes?limite=100"), []);
  return (
    <>
      <div className="fila">
        <h1>Mis solicitudes</h1>
        <Link className="boton" to="/solicitudes/nueva">Nueva solicitud</Link>
      </div>
      <p className="suave">Cada solicitud la revisa la empresa antes de convertirse en un pedido.</p>
      <Cargando error={error} cargando={cargando} />
      {datos && datos.length === 0 && <Vacio>Aún no has hecho solicitudes.</Vacio>}
      {datos?.map((s) => (
        <Link key={s.id} to={`/solicitudes/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <article className="tarjeta">
            <div className="fila">
              <strong>{s.condominio_nombre}</strong>
              <EstadoSolicitud s={s.estado} />
            </div>
            <p className="suave" style={{ margin: "4px 0" }}>{resumenSistemas(s)} · {fechaHora(s.created_at)}</p>
            <p style={{ margin: 0 }}>{s.servicio_solicitado.length > 140 ? s.servicio_solicitado.slice(0, 140) + "…" : s.servicio_solicitado}</p>
          </article>
        </Link>
      ))}
    </>
  );
}

/** La empresa pidio mas informacion: se contesta aqui y la solicitud vuelve a la
 *  bandeja. Se puede, ademas, corregir la descripcion. -> decisiones/0110 */
function ResponderRevision({ s, alResponder }: { s: Solicitud; alResponder: (nueva: Solicitud) => void }) {
  const [respuesta, setRespuesta] = useState("");
  const [descripcion, setDescripcion] = useState(s.servicio_solicitado);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const cuerpo: { respuesta: string; servicio_solicitado?: string } = { respuesta };
      if (descripcion.trim() && descripcion.trim() !== s.servicio_solicitado) cuerpo.servicio_solicitado = descripcion;
      alResponder(await api.post<Solicitud>(`/solicitudes/${s.id}/responder`, cuerpo));
    } catch (e) {
      setError(textoError(e));
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} style={{ marginTop: 16 }}>
      <h2>Responde para continuar</h2>
      <Errores mensaje={error} />
      <Campo etiqueta="Tu respuesta" ayuda="Contesta lo que te piden arriba.">
        <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} required maxLength={2000} />
      </Campo>
      <Campo etiqueta="Descripción de lo que necesitas" ayuda="Si hace falta, corrígela o complétala. Lo que habías escrito queda guardado.">
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required maxLength={MAX_DESCRIPCION} />
      </Campo>
      <div className="acciones">
        <button disabled={enviando}>{enviando ? "Enviando…" : "Enviar respuesta"}</button>
      </div>
    </form>
  );
}

export function DetalleSolicitud() {
  const id = useParams().id!;
  const { datos: s, error, cargando, poner } = useCarga(() => api.get<Solicitud>(`/solicitudes/${id}`), [id]);
  return (
    <>
      <p><Link to="/solicitudes">← Mis solicitudes</Link></p>
      <Cargando error={error} cargando={cargando} />
      {s && (
        <section className="tarjeta">
          <div className="fila">
            <h1 style={{ margin: 0 }}>{s.condominio_nombre}</h1>
            <EstadoSolicitud s={s.estado} />
          </div>
          {s.estado === "convertida" && s.numero_pedido && (
            <div className="aviso exito" style={{ marginTop: 12 }}>
              La empresa la aceptó: es el pedido <Link to={`/pedidos/${s.numero_pedido}`}>#{s.numero_pedido}</Link>.
            </div>
          )}
          {s.estado === "en_revision" && s.ultima_revision && (
            <div className="aviso ambar" style={{ marginTop: 12 }}>
              <strong>La empresa necesita más información:</strong>
              <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{s.ultima_revision.comentario}</p>
            </div>
          )}
          {s.estado === "pendiente" && s.ultima_revision?.respuesta && (
            <div className="aviso exito" style={{ marginTop: 12 }}>
              Enviaste tu respuesta el {fechaHora(s.ultima_revision.respondida_at!)}; la empresa la está revisando.
            </div>
          )}
          {s.estado === "rechazada" && (
            <div className="aviso error" style={{ marginTop: 12 }}>
              <strong>No se aceptó.</strong> {s.motivo_rechazo}
            </div>
          )}
          <dl className="datos" style={{ marginTop: 12 }}>
            <dt>{s.sistemas.length > 0 ? "Sistemas" : "Servicios"}</dt><dd>{resumenSistemas(s)}</dd>
            <dt>Descripción</dt><dd style={{ whiteSpace: "pre-wrap" }}>{s.servicio_solicitado}</dd>
            <dt>Quién reporta</dt><dd>{s.quien_reporta || "—"}</dd>
            <dt>Teléfono</dt><dd>{s.telefono_reporta || "—"}</dd>
            <dt>Enviada</dt><dd>{fechaHora(s.created_at)}</dd>
            {s.resuelta_at && (<><dt>Resuelta</dt><dd>{fechaHora(s.resuelta_at)}</dd></>)}
          </dl>
          {s.estado === "en_revision" && <ResponderRevision s={s} alResponder={poner} />}
        </section>
      )}
    </>
  );
}

export function NuevaSolicitud() {
  const nav = useNavigate();
  const condos = useCarga(() => api.get<Condominio[]>("/condominios"), []);
  const sistemas = useCarga(() => api.get<Sistema[]>("/sistemas"), []);
  // El id lo genera el front: si el envio se repite (red inestable), la API
  // reconoce la misma solicitud y no la duplica.
  const [id] = useState(() => crypto.randomUUID());
  const [condominio, setCondominio] = useState("");
  // Por cada sistema marcado: su modalidad y la respuesta abierta (que falla / que prevencion).
  const [seleccion, setSeleccion] = useState<Record<number, { modalidad: Modalidad | ""; detalle: string }>>({});
  const [quien, setQuien] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [incompleto, setIncompleto] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const elegido = condominio || (condos.datos?.length === 1 ? String(condos.datos[0].id) : "");
  // Un condominio sin sus datos completos no puede pedir (decisiones/0105): se avisa
  // antes de que llene el formulario. El servidor lo vuelve a exigir.
  const elegidoIncompleto = condos.datos?.find((c) => String(c.id) === elegido && !c.perfil_completo) ?? null;
  const alternar = (id: number) =>
    setSeleccion((previa) => {
      if (id in previa) {
        const { [id]: _quitado, ...resto } = previa;
        return resto;
      }
      return { ...previa, [id]: { modalidad: "", detalle: "" } };
    });
  const cambiar = (id: number, cambio: Partial<{ modalidad: Modalidad; detalle: string }>) =>
    setSeleccion((previa) => ({ ...previa, [id]: { ...previa[id], ...cambio } }));

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!elegido) return setError("Elige el condominio.");
    // En el orden del catalogo, no en el que se fueron marcando.
    const pedidos = (sistemas.datos ?? []).filter((x) => x.id in seleccion);
    if (pedidos.length === 0) return setError("Marca al menos un sistema.");
    const sinModalidad = pedidos.find((x) => !seleccion[x.id].modalidad);
    if (sinModalidad) return setError(`Indica si lo de ${sinModalidad.nombre} es correctivo o preventivo.`);
    setEnviando(true);
    setError(null);
    setBloqueo(null);
    setIncompleto(false);
    try {
      await api.post("/solicitudes", {
        id,
        condominio_id: Number(elegido),
        sistemas: pedidos.map((x) => ({
          sistema_id: x.id,
          modalidad: seleccion[x.id].modalidad,
          detalle: seleccion[x.id].detalle,
        })),
        quien_reporta: quien.trim() || undefined,
        telefono_reporta: telefono.trim() || undefined,
      });
      nav(`/solicitudes/${id}`, { replace: true });
    } catch (e) {
      // Corte por saldo: el mensaje manda a contactar a la empresa, no es reintentable.
      if (e instanceof ApiError && e.requiere === "regularizar_saldo") setBloqueo(e.message);
      else if (e instanceof ApiError && e.requiere === "completar_perfil") setIncompleto(true);
      else setError(textoError(e));
      setEnviando(false);
    }
  };

  return (
    <>
      <p><Link to="/solicitudes">← Mis solicitudes</Link></p>
      <h1>Nueva solicitud</h1>
      <Cargando error={condos.error || sistemas.error} cargando={condos.cargando || sistemas.cargando} />
      {(incompleto || elegidoIncompleto) && (
        <div className="aviso ambar" role="alert">
          <strong>Antes de pedir un servicio, completa los datos de tu condominio.</strong> Necesitamos la dirección, el pin en el mapa,
          un teléfono y el correo de contacto.{" "}
          <Link to={`/condominios/${elegido}/completar`}>Completar ahora</Link>
        </div>
      )}
      {bloqueo && (
        <div className="aviso ambar" role="alert">
          <strong>No podemos recibir una solicitud nueva por ahora.</strong> {bloqueo} Comunícate con la empresa para regularizar tu saldo.
        </div>
      )}
      {condos.datos && sistemas.datos && (
        <form className="tarjeta" onSubmit={enviar}>
          <Errores mensaje={error} />
          <Campo etiqueta="Condominio">
            <select value={elegido} onChange={(e) => setCondominio(e.target.value)} required>
              <option value="">Elige…</option>
              {condos.datos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
            <legend style={{ fontSize: ".9rem", fontWeight: 500, marginBottom: 4 }}>¿Qué sistema requiere servicio?</legend>
            <div className="grupo-checks">
              {sistemas.datos.map((x) => {
                const elegido = seleccion[x.id];
                return (
                  <div key={x.id}>
                    <label className="check">
                      <input type="checkbox" checked={!!elegido} onChange={() => alternar(x.id)} /> {x.nombre}
                    </label>
                    {elegido && (
                      <div className="sistema-detalle">
                        <div className="grupo-checks" role="radiogroup" aria-label={`Tipo de servicio para ${x.nombre}`}>
                          {(["correctivo", "preventivo"] as const).map((m) => (
                            <label key={m} className="check">
                              <input
                                type="radio"
                                name={`modalidad-${x.id}`}
                                checked={elegido.modalidad === m}
                                onChange={() => cambiar(x.id, { modalidad: m })}
                                required
                              />{" "}
                              {ETIQUETA_MODALIDAD[m]}
                            </label>
                          ))}
                        </div>
                        {elegido.modalidad && (
                          <Campo etiqueta={PREGUNTA_DETALLE[elegido.modalidad].etiqueta} ayuda={PREGUNTA_DETALLE[elegido.modalidad].ayuda}>
                            <textarea value={elegido.detalle} onChange={(e) => cambiar(x.id, { detalle: e.target.value })} required maxLength={500} />
                          </Campo>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>
          <Campo etiqueta="Quién reporta" ayuda="Si lo dejas vacío usamos el nombre de tu cuenta.">
            <input value={quien} onChange={(e) => setQuien(e.target.value)} maxLength={200} />
          </Campo>
          <Campo etiqueta="Teléfono de contacto" ayuda="Si lo dejas vacío usamos el de tu cuenta.">
            <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={40} />
          </Campo>
          <div className="acciones">
            <button disabled={enviando || elegidoIncompleto !== null}>{enviando ? "Enviando…" : "Enviar solicitud"}</button>
          </div>
        </form>
      )}
    </>
  );
}
