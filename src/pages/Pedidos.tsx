import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api, ApiError, textoError,
  type CatalogosFiscales, type Condominio, type DatosFiscales, type FacturaServicio, type Pedido, type PedidoDetalle, type ServicioPedido,
} from "../api";
import { dinero, ESTADO_PAGO, ESTADO_PEDIDO, fecha, fechaHora } from "../format";
import { Campo, Cargando, Errores, Insignia, Vacio, useCarga } from "../components/ui";

const tono = (e: string) =>
  e === "cerrado" ? "verde" : e === "cancelado" ? "gris" : e === "creado" ? "ambar" : "azul";

export function ListaPedidos() {
  const { datos, error, cargando } = useCarga(() => api.get<Pedido[]>("/pedidos?limite=100"), []);
  return (
    <>
      <h1>Mis pedidos</h1>
      <Cargando error={error} cargando={cargando} />
      {datos && datos.length === 0 && <Vacio>Todavía no hay pedidos. Cuando la empresa acepte una solicitud, aparecerá aquí.</Vacio>}
      {datos?.map((p) => (
        <Link key={p.numero_pedido} to={`/pedidos/${p.numero_pedido}`} style={{ textDecoration: "none", color: "inherit" }}>
          <article className="tarjeta">
            <div className="fila">
              <strong>Pedido #{p.numero_pedido} · {p.condominio_nombre}</strong>
              <Insignia tono={tono(p.estado)}>{ESTADO_PEDIDO[p.estado] ?? p.estado}</Insignia>
            </div>
            <p className="suave" style={{ margin: "4px 0" }}>{p.tipos_servicio.map((t) => t.tipo_servicio_nombre).join(", ")} · {fecha(p.created_at)}</p>
            <p style={{ margin: 0 }}>{p.servicio_solicitado.length > 140 ? p.servicio_solicitado.slice(0, 140) + "…" : p.servicio_solicitado}</p>
          </article>
        </Link>
      ))}
    </>
  );
}

export function DetallePedido() {
  const numero = useParams().numero!;
  const { datos: p, error, cargando, recargar } = useCarga(() => api.get<PedidoDetalle>(`/pedidos/${numero}`), [numero]);
  return (
    <>
      <p><Link to="/pedidos">← Mis pedidos</Link></p>
      <Cargando error={error} cargando={cargando} />
      {p && (
        <>
          <section className="tarjeta">
            <div className="fila">
              <h1 style={{ margin: 0 }}>Pedido #{p.numero_pedido}</h1>
              <Insignia tono={tono(p.estado)}>{ESTADO_PEDIDO[p.estado] ?? p.estado}</Insignia>
            </div>
            <dl className="datos" style={{ marginTop: 12 }}>
              <dt>Condominio</dt><dd>{p.condominio_nombre}</dd>
              <dt>Solicitado</dt><dd style={{ whiteSpace: "pre-wrap" }}>{p.servicio_solicitado}</dd>
              <dt>Quién reporta</dt><dd>{p.quien_reporta || "—"}</dd>
              <dt>Teléfono</dt><dd>{p.telefono_reporta || "—"}</dd>
              <dt>Creado</dt><dd>{fechaHora(p.created_at)}</dd>
            </dl>
          </section>
          <section className="tarjeta">
            <h2>Servicios del pedido</h2>
            <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
              {p.tipos_servicio.map((t) => (
                <li key={t.tipo_servicio_id}>
                  {t.tipo_servicio_nombre} {t.resuelto ? <Insignia tono="verde">Resuelto</Insignia> : <Insignia tono="gris">Pendiente</Insignia>}
                </li>
              ))}
            </ul>
          </section>
          {p.servicios.length > 0 && (
            <section className="tarjeta">
              <h2>Servicios cerrados</h2>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr><th>Servicio</th><th>Cierre</th><th>Pago</th><th className="num">Total</th><th className="num">Pagado</th><th className="num">Saldo</th></tr>
                  </thead>
                  <tbody>
                    {p.servicios.map((s) => (
                      <tr key={s.numero_orden}>
                        <td>{s.tipo_servicio_nombre}{s.resolucion === "parcial" && <span className="suave"> (parcial)</span>}</td>
                        <td>{fecha(s.cerrado_at)}</td>
                        <td>{ESTADO_PAGO[s.estado_pago] ?? s.estado_pago}</td>
                        <td className="num">{dinero(s.monto_total)}</td>
                        <td className="num">{dinero(s.monto_pagado)}</td>
                        <td className="num">{dinero(s.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {p.servicios.length > 0 && <FacturaCard p={p} alCambiar={recargar} />}
        </>
      )}
    </>
  );
}

/** La factura se pide desde aqui, servicio por servicio (reemplaza al formulario publico
 *  de facturacion). No se le dice al cliente si "corresponde" facturar: eso lo decide la
 *  empresa (decisiones/0070); lo unico que se exige son los datos fiscales del condominio. */
function FacturaCard({ p, alCambiar }: { p: PedidoDetalle; alCambiar: () => void }) {
  const condominio = useCarga(() => api.get<Condominio>(`/condominios/${p.condominio_id}`), [p.condominio_id]);
  const tieneFiscales = condominio.datos?.tiene_datos_fiscales;
  const catalogos = useCarga(() => api.get<CatalogosFiscales>("/catalogos-fiscales"), []);
  const fiscales = useCarga(
    () => (tieneFiscales ? api.get<DatosFiscales>(`/condominios/${p.condominio_id}/datos-fiscales`) : Promise.resolve(null)),
    [p.condominio_id, tieneFiscales],
  );
  const [abierto, setAbierto] = useState<number | null>(null);
  const [uso, setUso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [faltanFiscales, setFaltanFiscales] = useState(false);

  const abrir = (s: ServicioPedido) => {
    setAbierto(s.numero_orden);
    setUso(fiscales.datos?.uso_cfdi ?? "");
    setErr(null);
  };

  const pedir = async (ev: FormEvent, s: ServicioPedido) => {
    ev.preventDefault();
    setErr(null);
    setEnviando(true);
    try {
      await api.post<FacturaServicio>(`/pedidos/${p.numero_pedido}/servicios/${s.numero_orden}/factura`, { uso_cfdi: uso });
      setAbierto(null);
      alCambiar();
    } catch (e) {
      setFaltanFiscales(e instanceof ApiError && e.requiere === "datos_fiscales");
      setErr(textoError(e));
    } finally {
      setEnviando(false);
    }
  };

  const sinFiscales = tieneFiscales === false || faltanFiscales;
  const enlaceFiscales = <Link to={`/condominios/${p.condominio_id}`}>Capturar datos fiscales</Link>;

  return (
    <section className="tarjeta">
      <h2>Factura</h2>
      <p className="suave" style={{ marginTop: 0 }}>Pide aquí la factura de cada servicio. Usaremos los datos fiscales de tu condominio.</p>
      <Cargando error={condominio.error} cargando={condominio.cargando} />
      {sinFiscales && <div className="aviso ambar">Tu condominio todavía no tiene datos fiscales. {enlaceFiscales} para poder pedir la factura.</div>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {p.servicios.map((s) => (
          <li key={s.numero_orden} style={{ padding: "8px 0", borderTop: "1px solid var(--borde)" }}>
            <div className="fila">
              <span>{s.tipo_servicio_nombre} <span className="suave">· {fecha(s.cerrado_at)}</span></span>
              {s.factura ? (
                s.factura.emitida
                  ? <Insignia tono="verde">Factura emitida</Insignia>
                  : <Insignia tono="azul">Factura solicitada el {fecha(s.factura.solicitada_en)}</Insignia>
              ) : abierto === s.numero_orden ? null : (
                <button className="secundario" onClick={() => abrir(s)} disabled={tieneFiscales === undefined || sinFiscales}>
                  Pedir factura
                </button>
              )}
            </div>
            {!s.factura && abierto === s.numero_orden && (
              <form onSubmit={(ev) => pedir(ev, s)}>
                <Errores mensaje={err} />
                {catalogos.error && <Errores mensaje={`No se pudo cargar la lista de usos de CFDI. ${catalogos.error}`} />}
                {!catalogos.error && !catalogos.datos && <p className="suave">Cargando…</p>}
                {catalogos.datos && (
                  <Campo etiqueta="Uso de CFDI" ayuda="Para qué vas a usar la factura. Es del comprobante, y puede ser distinto en cada servicio.">
                    <select value={uso} onChange={(e) => setUso(e.target.value)} required>
                      <option value="">Elige…</option>
                      {catalogos.datos.usos_cfdi.map((i) => (
                        <option key={i.codigo} value={i.codigo}>{i.codigo} — {i.nombre}</option>
                      ))}
                    </select>
                  </Campo>
                )}
                <div className="acciones">
                  <button type="button" className="secundario" onClick={() => setAbierto(null)}>Cancelar</button>
                  <button disabled={enviando || !uso}>{enviando ? "Enviando…" : "Pedir factura"}</button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
