import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, textoError, type Condominio } from "../api";
import { useAuth } from "../auth";
import { Campo, Cargando, Errores, Info, useCarga } from "../components/ui";
import { Mapa, type Punto } from "../components/Mapa";
import { parsearCoordenada } from "../format";

// Que es cada telefono, para quien llena el formulario. (Pedido por la empresa:
// aclarar a quien se refiere cada uno al pasar el cursor.)
export const AYUDA_TELEFONO = {
  telefono_fijo:
    "El teléfono fijo del condominio: la caseta o la oficina, el número al que se puede llamar en horario normal.",
  telefono_administrador:
    "El teléfono de la persona o empresa que administra el condominio: quien da acceso y autoriza el trabajo.",
  telefono_junta:
    "El teléfono de la junta o del comité de vecinos (presidente o tesorero), para cuando la administración no está disponible.",
} as const;

// Telefono de contacto (`telefono_recibo`): comentado por ahora, es prioridad de
// implementacion. -> decisiones/0106, pendientes/futuras-implementaciones
// const AYUDA_TELEFONO_CONTACTO = "...";

type Valores = {
  calle: string;
  numero_exterior: string;
  colonia: string;
  codigo_postal: string;
  telefono_fijo: string;
  telefono_administrador: string;
  telefono_junta: string;
};

const CAMPOS_TEXTO = ["calle", "numero_exterior", "colonia", "codigo_postal", "telefono_fijo", "telefono_administrador", "telefono_junta"] as const;

const desde = (c: Condominio): Valores =>
  Object.fromEntries(CAMPOS_TEXTO.map((k) => [k, c[k] ?? ""])) as Valores;

/** Completar (o corregir) los datos de un condominio: direccion, pin, telefonos y
 *  correo de contacto. Es lo que hay que tener antes de poder pedir un servicio. */
export function Completar() {
  const id = Number(useParams().id);
  const { cuenta } = useAuth();
  const { datos, error, cargando, recargar } = useCarga(() => api.get<Condominio>(`/condominios/${id}`), [id]);
  const [vals, setVals] = useState<Valores | null>(null);
  const [pin, setPin] = useState<Punto | null>(null);
  const [pegado, setPegado] = useState("");
  const [modoCorreo, setModoCorreo] = useState<"cuenta" | "otro">("cuenta");
  const [correoOtro, setCorreoOtro] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ pendienteCorreo: string | null } | null>(null);

  useEffect(() => {
    if (datos && !vals) {
      setVals(desde(datos));
      if (datos.latitud != null && datos.longitud != null) setPin({ lat: Number(datos.latitud), lng: Number(datos.longitud) });
    }
  }, [datos, vals]);

  if (!datos || !vals) return <><Cargando error={error} cargando={cargando} /></>;
  const pideCorreo = !datos.correo_recibo; // primera vez: si ya tiene, se cambia desde la ficha, con 2FA

  if (resultado) {
    return (
      <>
        <h1>{datos.nombre}</h1>
        <section className="tarjeta">
          <div className="aviso exito">Guardamos los datos de tu condominio.</div>
          {resultado.pendienteCorreo && (
            <div className="aviso ambar">
              Te enviamos un enlace a <strong>{resultado.pendienteCorreo}</strong>. Mientras no lo abras no podrás pedir servicios: el
              correo de contacto es adonde llegan tus recibos y códigos.
            </div>
          )}
          <h2>Una recomendación</h2>
          <p>
            Carga también tus <strong>datos fiscales</strong> ahora: los necesitarás para pedir una factura. No es obligatorio para
            pedir servicios y puedes hacerlo cuando quieras; para guardarlos te pediremos activar la verificación en dos pasos.
          </p>
          <div className="acciones">
            <Link className="boton secundario" to={`/condominios/${id}`}>Cargar datos fiscales</Link>
            <Link className="boton" to="/">Ir a mis condominios</Link>
          </div>
        </section>
      </>
    );
  }

  const set = (k: keyof Valores) => (e: React.ChangeEvent<HTMLInputElement>) => setVals({ ...vals, [k]: e.target.value });

  const alPegar = (texto: string) => {
    setPegado(texto);
    const p = parsearCoordenada(texto);
    if (p) setPin(p);
  };

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    setErr(null);
    for (const [k, nombre] of [["calle", "la calle"], ["numero_exterior", "el número exterior"], ["colonia", "la colonia"]] as const) {
      if (!vals[k].trim()) return setErr(`Escribe ${nombre}.`);
    }
    if (!/^\d{5}$/.test(vals.codigo_postal.trim())) return setErr("El código postal son 5 dígitos.");
    if (!pin) return setErr("Marca en el mapa dónde está el condominio: haz clic para colocar el pin.");
    const correo = modoCorreo === "cuenta" ? cuenta?.correo ?? "" : correoOtro.trim();
    if (pideCorreo && !correo) return setErr("Escribe el correo de contacto.");

    setEnviando(true);
    try {
      // null borra un dato; solo se mandan los campos que cambiaron.
      const cuerpo: Record<string, string | number | null> = { updated_at: datos.updated_at };
      for (const k of CAMPOS_TEXTO) {
        const nuevo = vals[k].trim() || null;
        if (nuevo !== (datos[k] ?? null)) cuerpo[k] = nuevo;
      }
      const lat = Number(pin.lat.toFixed(6));
      const lng = Number(pin.lng.toFixed(6));
      if (lat !== Number(datos.latitud) || lng !== Number(datos.longitud)) {
        cuerpo.latitud = lat;
        cuerpo.longitud = lng;
      }
      if (Object.keys(cuerpo).length > 1) await api.patch<Condominio>(`/condominios/${id}`, cuerpo);

      let pendienteCorreo: string | null = null;
      if (pideCorreo) {
        const r = await api.post<{ aplicado: boolean }>(`/condominios/${id}/correo-contacto`, { correo });
        if (!r.aplicado) pendienteCorreo = correo;
      }
      setResultado({ pendienteCorreo });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setErr("Alguien más modificó este condominio mientras lo editabas. Recarga la página e inténtalo de nuevo.");
        recargar();
      } else {
        setErr(textoError(e));
      }
      setEnviando(false);
    }
  };

  return (
    <>
      <p><Link to="/">← Mis condominios</Link></p>
      <h1>{datos.perfil_completo ? "Datos de" : "Completa los datos de"} {datos.nombre}</h1>
      {!datos.perfil_completo && (
        <div className="aviso ambar">
          Para pedir servicios necesitamos saber dónde está tu condominio y cómo localizarte. Solo te lo pedimos una vez.
        </div>
      )}
      <Errores mensaje={err} />
      <form onSubmit={guardar}>
        <section className="tarjeta paso">
          <h2>1. Dirección</h2>
          <Campo etiqueta="Calle"><input value={vals.calle} onChange={set("calle")} maxLength={120} autoComplete="street-address" required /></Campo>
          <Campo etiqueta="Número exterior"><input value={vals.numero_exterior} onChange={set("numero_exterior")} maxLength={120} required /></Campo>
          <Campo etiqueta="Colonia"><input value={vals.colonia} onChange={set("colonia")} maxLength={120} required /></Campo>
          <Campo etiqueta="Código postal"><input value={vals.codigo_postal} onChange={set("codigo_postal")} inputMode="numeric" maxLength={5} required autoComplete="postal-code" /></Campo>
        </section>

        <section className="tarjeta paso">
          <h2>2. Ubicación en el mapa</h2>
          <p className="suave">Haz clic en el mapa para colocar el pin en la entrada del condominio; puedes arrastrarlo para afinarlo.</p>
          <Mapa valor={pin} onChange={setPin} />
          <Campo etiqueta="¿Ya la tienes en Google Maps?" ayuda="Pega las coordenadas (clic derecho en Google Maps → copiar) o el enlace largo del mapa y el pin se coloca solo.">
            <input value={pegado} onChange={(e) => alPegar(e.target.value)} placeholder="20.676848, -103.349812" />
          </Campo>
          {pin ? (
            <p className="suave">
              Pin en {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)} ·{" "}
              <a href={`https://www.google.com/maps?q=${pin.lat},${pin.lng}`} target="_blank" rel="noreferrer noopener">Verlo en Google Maps</a>
            </p>
          ) : (
            <p className="suave">Todavía no has colocado el pin.</p>
          )}
        </section>

        <section className="tarjeta paso">
          <h2>3. Teléfonos</h2>
          <Campo etiqueta="Teléfono fijo" info={AYUDA_TELEFONO.telefono_fijo}>
            <input type="tel" value={vals.telefono_fijo} onChange={set("telefono_fijo")} maxLength={40} autoComplete="tel" />
          </Campo>
          <Campo etiqueta="Teléfono de administración" info={AYUDA_TELEFONO.telefono_administrador}>
            <input type="tel" value={vals.telefono_administrador} onChange={set("telefono_administrador")} maxLength={40} />
          </Campo>
          <Campo etiqueta="Teléfono de la junta" info={AYUDA_TELEFONO.telefono_junta}>
            <input type="tel" value={vals.telefono_junta} onChange={set("telefono_junta")} maxLength={40} />
          </Campo>
          {/* Teléfono de contacto (telefono_recibo): comentado por ahora, es prioridad de
              implementación. → decisiones/0106, pendientes/futuras-implementaciones
          <Campo etiqueta="Teléfono de contacto" info={AYUDA_TELEFONO_CONTACTO}>
            <input type="tel" value={vals.telefono_recibo} onChange={set("telefono_recibo")} maxLength={40} />
          </Campo>
          */}
        </section>

        {pideCorreo && (
          <section className="tarjeta paso">
            <h2>4. Correo de contacto <Info texto="Es adonde la empresa manda los códigos QR de cada servicio, los resúmenes y los recibos. Puede ser distinto del correo con el que entras al portal." /></h2>
            <div className="radios" role="radiogroup" aria-label="Correo de contacto">
              <label>
                <input type="radio" name="correo" checked={modoCorreo === "cuenta"} onChange={() => setModoCorreo("cuenta")} />
                <span>El mismo con el que me registré (<strong>{cuenta?.correo}</strong>)</span>
              </label>
              <label>
                <input type="radio" name="correo" checked={modoCorreo === "otro"} onChange={() => setModoCorreo("otro")} />
                <span>Otro correo</span>
              </label>
            </div>
            {modoCorreo === "otro" && (
              <Campo etiqueta="Correo de contacto" ayuda="Le enviaremos un enlace para confirmar que es suyo; hasta que lo abra no podrás pedir servicios.">
                <input type="email" value={correoOtro} onChange={(e) => setCorreoOtro(e.target.value)} maxLength={254} required />
              </Campo>
            )}
          </section>
        )}

        <div className="acciones">
          <button disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </>
  );
}
