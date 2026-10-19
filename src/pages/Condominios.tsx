import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, textoError, type CatalogosFiscales, type Condominio, type DatosFiscales, type ItemCatalogo } from "../api";
// import { dinero, fecha } from "../format";   // solo los usa SaldoCard (comentada)
import { useStepUp } from "../stepup";
import { Campo, Cargando, Errores, Exito, Info, Insignia, Vacio, useCarga } from "../components/ui";
import { AYUDA_TELEFONO } from "./Completar";

export function Inicio() {
  const nav = useNavigate();
  const { datos, error, cargando } = useCarga(() => api.get<Condominio[]>("/condominios"), []);

  // Alta estricta (decisiones/0105): al entrar, el primer condominio incompleto
  // se completa antes de hacer cualquier otra cosa.
  const primeroIncompleto = datos?.find((c) => !c.perfil_completo);
  // Una sola vez por sesion del navegador: si no, el enlace "volver" de la pantalla de
  // completar los dejaria en un bucle.
  useEffect(() => {
    if (!primeroIncompleto) return;
    try {
      if (sessionStorage.getItem("completar-redirigido")) return;
      sessionStorage.setItem("completar-redirigido", "1");
    } catch {
      /* sin sessionStorage se redirige igual: peor es no pedirlo */
    }
    nav(`/condominios/${primeroIncompleto.id}/completar`, { replace: true });
  }, [primeroIncompleto, nav]);

  return (
    <>
      <div className="fila">
        <h1>Mis condominios</h1>
        <Link className="boton" to="/solicitudes/nueva">Pedir un servicio</Link>
      </div>
      <Cargando error={error} cargando={cargando} />
      {datos && datos.length === 0 && <Vacio>Tu cuenta todavía no tiene condominios asociados. Contacta a la empresa.</Vacio>}
      <div className="rejilla">
        {datos?.map((c) => (
          <Link key={c.id} to={`/condominios/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <article className="tarjeta" style={{ marginBottom: 0 }}>
              <h2>{c.nombre}</h2>
              <p className="suave">{[c.calle, c.numero_exterior, c.colonia].filter(Boolean).join(" ") || "Sin dirección registrada"}</p>
              {!c.perfil_completo && <Insignia tono="ambar">Faltan datos</Insignia>}
            </article>
          </Link>
        ))}
      </div>
    </>
  );
}

export function CondominioDetalle() {
  const id = Number(useParams().id);
  const { datos, error, cargando } = useCarga(() => api.get<Condominio>(`/condominios/${id}`), [id]);
  return (
    <>
      <p><Link to="/">← Mis condominios</Link></p>
      <Cargando error={error} cargando={cargando} />
      {datos && (
        <>
          <h1>{datos.nombre}</h1>
          {/* Saldo: comentado hasta que exista el inventario de servicios con precio.
              → decisiones/0106, pendientes/futuras-implementaciones
          <SaldoCard id={id} />
          */}
          <DatosCard c={datos} />
          <CorreoContacto c={datos} />
          <FiscalesCard c={datos} />
        </>
      )}
    </>
  );
}

/* Saldo del condominio: comentado hasta que exista el inventario de servicios con precio
   (sin precios el saldo depende de montos tecleados a mano). El endpoint
   GET /portal/condominios/{id}/saldo sigue en la API. → decisiones/0106

function SaldoCard({ id }: { id: number }) {
  const { datos, error, cargando } = useCarga(() => api.get<Saldo>(`/condominios/${id}/saldo`), [id]);
  return (
    <section className="tarjeta">
      <h2>Saldo</h2>
      <Cargando error={error} cargando={cargando} />
      {datos && (
        <>
          <p style={{ fontSize: "1.6rem", margin: "0 0 4px" }}>{dinero(datos.saldo_total)}</p>
          {datos.servicios_sin_monto > 0 && (
            <p className="suave">
              {datos.servicios_sin_monto} servicio(s) cerrado(s) todavía sin monto definido; se incluirán cuando la empresa lo fije.
            </p>
          )}
          {datos.servicios.length === 0 ? (
            <p className="suave">No tienes adeudos.</p>
          ) : (
            <div className="tabla-scroll">
              <table className="tabla">
                <thead>
                  <tr><th>Pedido</th><th>Servicio</th><th>Cerrado</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th></tr>
                </thead>
                <tbody>
                  {datos.servicios.map((s) => (
                    <tr key={s.numero_orden}>
                      <td>{s.numero_pedido ? <Link to={`/pedidos/${s.numero_pedido}`}>#{s.numero_pedido}</Link> : "—"}</td>
                      <td>{s.tipo_servicio_nombre}</td>
                      <td>{fecha(s.cerrado_at)} <span className="suave">({s.dias} d)</span></td>
                      <td className="num">{dinero(s.monto_total)}</td>
                      <td className="num">{dinero(s.monto_pagado)}</td>
                      <td className="num">{dinero(s.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
*/

// Telefono de contacto (telefono_recibo): comentado por ahora. → decisiones/0106
const TELEFONOS: [keyof typeof AYUDA_TELEFONO, string][] = [
  ["telefono_fijo", "Teléfono fijo"],
  ["telefono_administrador", "Teléfono de administración"],
  ["telefono_junta", "Teléfono de la junta"],
  // ["telefono_recibo", "Teléfono de contacto"],
];

const FALTANTE: Record<string, string> = {
  calle: "la calle", numero_exterior: "el número exterior", colonia: "la colonia", codigo_postal: "el código postal",
  ubicacion: "el pin en el mapa", correo_contacto: "el correo de contacto",
};

function DatosCard({ c }: { c: Condominio }) {
  const tienePin = c.latitud != null && c.longitud != null;
  return (
    <section className="tarjeta">
      <div className="fila">
        <h2>Dirección y teléfonos</h2>
        <Link className="boton secundario" to={`/condominios/${c.id}/completar`}>{c.perfil_completo ? "Editar" : "Completar"}</Link>
      </div>
      {!c.perfil_completo && (
        <div className="aviso ambar">
          Para pedir servicios falta: {c.faltantes.map((f) => FALTANTE[f] ?? f).join(", ")}.
        </div>
      )}
      <dl className="datos">
        <dt>Calle</dt><dd>{c.calle || "—"}</dd>
        <dt>Número exterior</dt><dd>{c.numero_exterior || "—"}</dd>
        <dt>Colonia</dt><dd>{c.colonia || "—"}</dd>
        <dt>Código postal</dt><dd>{c.codigo_postal || "—"}</dd>
        <dt>Ubicación</dt>
        <dd>
          {tienePin ? (
            <a href={`https://www.google.com/maps?q=${c.latitud},${c.longitud}`} target="_blank" rel="noreferrer noopener">Ver el pin en Google Maps</a>
          ) : "—"}
        </dd>
        {TELEFONOS.map(([k, et]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{et}<Info texto={AYUDA_TELEFONO[k]} /></dt>
            <dd>{c[k] || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CorreoContacto({ c }: { c: Condominio }) {
  const stepUp = useStepUp();
  const [nuevo, setNuevo] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    try {
      await stepUp(() => api.post(`/condominios/${c.id}/correo-contacto`, { correo: nuevo }));
      setOk("Te enviamos un enlace de confirmación al correo nuevo. El cambio se aplica cuando lo abras.");
      setAbierto(false);
      setNuevo("");
    } catch (e) {
      setError(textoError(e));
    }
  };

  return (
    <section className="tarjeta">
      <div className="fila">
        <h2>Correo de contacto</h2>
        {!abierto && <button className="secundario" onClick={() => { setAbierto(true); setOk(null); }}>Cambiar</button>}
      </div>
      <p>{c.correo_recibo || <span className="suave">Sin correo registrado. La empresa lo necesita para atender tus pedidos.</span>}</p>
      <Exito mensaje={ok} />
      <Errores mensaje={error} />
      {abierto && (
        <form onSubmit={enviar}>
          <Campo etiqueta="Correo nuevo" ayuda="Pediremos confirmar tu identidad y mandaremos un enlace a ese correo.">
            <input type="email" value={nuevo} onChange={(e) => setNuevo(e.target.value)} required maxLength={254} />
          </Campo>
          <div className="acciones">
            <button type="button" className="secundario" onClick={() => setAbierto(false)}>Cancelar</button>
            <button>Enviar enlace</button>
          </div>
        </form>
      )}
    </section>
  );
}

const VACIOS = { rfc: "", razon_social: "", regimen_fiscal: "", codigo_postal_fiscal: "", uso_cfdi: "", correo_facturacion: "" };

/** "601 — General de Ley Personas Morales": la clave y su nombre del catalogo. */
const conNombre = (lista: ItemCatalogo[] | undefined, codigo: string) => {
  const nombre = lista?.find((i) => i.codigo === codigo)?.nombre;
  return nombre ? `${codigo} — ${nombre}` : codigo;
};

/** Dropdown de un catalogo del SAT. Si el valor guardado ya no esta en la lista (un
 *  dato viejo) se conserva como opcion, para no perderlo al corregir otro campo. */
function SelectCatalogo({ lista, valor, onChange }: { lista: ItemCatalogo[]; valor: string; onChange: (v: string) => void }) {
  const fueraDeLista = valor !== "" && !lista.some((i) => i.codigo === valor);
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} required>
      <option value="">Elige…</option>
      {fueraDeLista && <option value={valor}>{valor} (valor actual)</option>}
      {lista.map((i) => (
        <option key={i.codigo} value={i.codigo}>{i.codigo} — {i.nombre}</option>
      ))}
    </select>
  );
}

function FiscalesCard({ c }: { c: Condominio }) {
  const stepUp = useStepUp();
  // Las listas completas del SAT (regimenes y usos de CFDI) salen de la base.
  const catalogos = useCarga(() => api.get<CatalogosFiscales>("/catalogos-fiscales"), []);
  const { datos, cargando, poner, error } = useCarga(
    () => (c.tiene_datos_fiscales ? api.get<DatosFiscales>(`/condominios/${c.id}/datos-fiscales`) : Promise.resolve(null)),
    [c.id],
  );
  const [editando, setEditando] = useState(false);
  const [vals, setVals] = useState(VACIOS);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const empezar = () => {
    setVals(datos ? { rfc: datos.rfc, razon_social: datos.razon_social, regimen_fiscal: datos.regimen_fiscal, codigo_postal_fiscal: datos.codigo_postal_fiscal, uso_cfdi: datos.uso_cfdi, correo_facturacion: datos.correo_facturacion } : VACIOS);
    setEditando(true);
    setOk(null);
  };

  const guardar = async (ev: FormEvent) => {
    ev.preventDefault();
    setErr(null);
    try {
      poner(await stepUp(() => api.post<DatosFiscales>(`/condominios/${c.id}/datos-fiscales`, vals)));
      setEditando(false);
      setOk("Datos fiscales guardados para este condominio.");
    } catch (e) {
      setErr(textoError(e));
    }
  };

  const set = (k: keyof typeof VACIOS) => (e: React.ChangeEvent<HTMLInputElement>) => setVals({ ...vals, [k]: e.target.value });

  return (
    <section className="tarjeta">
      <div className="fila">
        <h2>Datos fiscales</h2>
        {!editando && <button className="secundario" onClick={empezar}>{datos ? "Corregir" : "Capturar"}</button>}
      </div>
      <Cargando error={error} cargando={cargando} />
      <Exito mensaje={ok} />
      <Errores mensaje={err} />
      {!editando && datos && (
        <>
          {datos.nivel === "fraccionamiento" && (
            <div className="aviso ambar">Estos datos son compartidos con tu fraccionamiento. Si los capturas aquí, aplicarán solo a este condominio.</div>
          )}
          <dl className="datos">
            <dt>RFC</dt><dd>{datos.rfc}</dd>
            <dt>Razón social</dt><dd>{datos.razon_social}</dd>
            <dt>Régimen fiscal</dt><dd>{conNombre(catalogos.datos?.regimenes_fiscales, datos.regimen_fiscal)}</dd>
            <dt>C.P. fiscal</dt><dd>{datos.codigo_postal_fiscal}</dd>
            <dt>Uso de CFDI</dt><dd>{conNombre(catalogos.datos?.usos_cfdi, datos.uso_cfdi)}</dd>
            <dt>Correo de facturación</dt><dd>{datos.correo_facturacion}</dd>
          </dl>
        </>
      )}
      {!editando && !datos && !cargando && !error && <p className="suave">Sin datos fiscales registrados.</p>}
      {editando && catalogos.error && <Errores mensaje={`No se pudieron cargar las listas del SAT. ${catalogos.error}`} />}
      {editando && !catalogos.error && !catalogos.datos && <p className="suave">Cargando listas del SAT…</p>}
      {editando && catalogos.datos && (
        <form onSubmit={guardar}>
          <p className="suave">Se guarda como un registro nuevo para este condominio; el anterior queda en el historial.</p>
          <Campo etiqueta="RFC"><input value={vals.rfc} onChange={set("rfc")} required maxLength={13} style={{ textTransform: "uppercase" }} /></Campo>
          <Campo etiqueta="Razón social"><input value={vals.razon_social} onChange={set("razon_social")} required /></Campo>
          <Campo etiqueta="Régimen fiscal">
            <SelectCatalogo lista={catalogos.datos.regimenes_fiscales} valor={vals.regimen_fiscal} onChange={(v) => setVals({ ...vals, regimen_fiscal: v })} />
          </Campo>
          <Campo etiqueta="Código postal fiscal"><input value={vals.codigo_postal_fiscal} onChange={set("codigo_postal_fiscal")} required inputMode="numeric" maxLength={5} /></Campo>
          <Campo etiqueta="Uso de CFDI">
            <SelectCatalogo lista={catalogos.datos.usos_cfdi} valor={vals.uso_cfdi} onChange={(v) => setVals({ ...vals, uso_cfdi: v })} />
          </Campo>
          <Campo etiqueta="Correo de facturación"><input type="email" value={vals.correo_facturacion} onChange={set("correo_facturacion")} required /></Campo>
          <div className="acciones">
            <button type="button" className="secundario" onClick={() => setEditando(false)}>Cancelar</button>
            <button>Guardar</button>
          </div>
        </form>
      )}
    </section>
  );
}
