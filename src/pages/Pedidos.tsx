import { Link, useParams } from "react-router-dom";
import { api, type Pedido, type PedidoDetalle } from "../api";
import { dinero, ESTADO_PAGO, ESTADO_PEDIDO, fecha, fechaHora } from "../format";
import { Cargando, Insignia, Vacio, useCarga } from "../components/ui";

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
  const { datos: p, error, cargando } = useCarga(() => api.get<PedidoDetalle>(`/pedidos/${numero}`), [numero]);
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
        </>
      )}
    </>
  );
}
