import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, textoError, type WhatsAppAvisos, type WhatsAppCodigo, type WhatsAppNumero } from "../api";
import { useStepUp } from "../stepup";
import { Cargando, Errores, Exito, useCarga } from "../components/ui";
import { fechaHora } from "../format";

// El WhatsApp es un acceso rapido para pedir servicios y ver su estado; la cuenta (datos,
// seguridad, factura) se maneja aqui. Vincular pide step-up: un numero vinculado pide
// servicios a nombre del condominio.

export function WhatsApp() {
  const numeros = useCarga(() => api.get<WhatsAppNumero[]>("/whatsapp"), []);
  const [exito, setExito] = useState<string | null>(null);

  return (
    <>
      <h1>WhatsApp</h1>
      <p className="suave">
        Vincula tu WhatsApp para pedir un servicio y consultar tus solicitudes y pedidos desde una conversación, sin entrar al
        portal. Los datos de la cuenta, la seguridad y la factura se siguen manejando aquí.
      </p>
      <Exito mensaje={exito} />
      <Cargando error={numeros.error} cargando={numeros.cargando} />
      {numeros.datos && (
        <>
          <Vinculados
            numeros={numeros.datos}
            alCambiar={(msg) => {
              setExito(msg);
              numeros.recargar();
            }}
          />
          <Vincular
            alVincular={() => {
              setExito("Listo, tu WhatsApp quedó vinculado.");
              numeros.recargar();
            }}
            vinculados={numeros.datos.length}
          />
          {numeros.datos.length > 0 && <Avisos />}
        </>
      )}
    </>
  );
}

function Vinculados({ numeros, alCambiar }: { numeros: WhatsAppNumero[]; alCambiar: (msg: string) => void }) {
  const [error, setError] = useState<string | null>(null);

  const desvincular = async (n: WhatsAppNumero) => {
    if (!window.confirm(`¿Desvincular ${n.telefono}? Dejará de poder usar el bot con tu cuenta.`)) return;
    setError(null);
    try {
      await api.delete(`/whatsapp/${n.id}`);
      alCambiar("Número desvinculado.");
    } catch (e) {
      setError(textoError(e));
    }
  };

  return (
    <section className="tarjeta">
      <h2>Números vinculados</h2>
      <Errores mensaje={error} />
      {numeros.length === 0 ? (
        <p className="suave">Todavía no tienes ningún número vinculado.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "grid", gap: 10 }}>
          {numeros.map((n) => (
            <li key={n.id} className="fila">
              <span>
                <strong>{n.telefono}</strong> <span className="suave">· desde {fechaHora(n.vinculado_at)}</span>
              </span>
              <button className="secundario" onClick={() => void desvincular(n)}>
                Desvincular
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Vincular({ alVincular, vinculados }: { alVincular: () => void; vinculados: number }) {
  const stepUp = useStepUp();
  const [codigo, setCodigo] = useState<WhatsAppCodigo | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [vencido, setVencido] = useState(false);

  useEffect(() => {
    setQr(null);
    if (codigo) void QRCode.toDataURL(codigo.wa_link, { margin: 1, width: 240 }).then(setQr);
  }, [codigo]);

  // Mientras el codigo esta visible se revisa si ya se vinculo, y se avisa cuando vence.
  useEffect(() => {
    if (!codigo) return;
    setVencido(false);
    const antes = vinculados;
    const revisar = window.setInterval(() => {
      void api
        .get<WhatsAppNumero[]>("/whatsapp")
        .then((lista) => {
          if (lista.length > antes) {
            setCodigo(null);
            alVincular();
          }
        })
        .catch(() => undefined);
      if (Date.now() >= new Date(codigo.expira_at).getTime()) setVencido(true);
    }, 3000);
    return () => window.clearInterval(revisar);
    // `vinculados` y `alVincular` cambian al recargar; solo importa el codigo que se muestra
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo]);

  const generar = async () => {
    setGenerando(true);
    setError(null);
    try {
      setCodigo(await stepUp(() => api.post<WhatsAppCodigo>("/whatsapp/vincular")));
    } catch (e) {
      setError(textoError(e));
    }
    setGenerando(false);
  };

  return (
    <section className="tarjeta">
      <h2>Vincular un WhatsApp</h2>
      <Errores mensaje={error} />
      {!codigo ? (
        <>
          <p className="suave">
            Te pediremos tu contraseña y un código OTP. Después escanearás un código QR con el celular que quieras vincular.
          </p>
          <button disabled={generando} onClick={() => void generar()}>
            {generando ? "Generando…" : "Vincular un WhatsApp"}
          </button>
        </>
      ) : (
        <>
          <p>
            1. Escanea este código con la cámara del celular donde tienes WhatsApp. Se abrirá una conversación con el mensaje
            ya escrito.
          </p>
          {qr && <img className="qr" src={qr} width={240} height={240} alt="Código QR para abrir WhatsApp con el mensaje de vinculación" />}
          <p>
            2. Envía el mensaje tal cual, sin cambiarlo: <code>VINCULAR {codigo.codigo}</code>
          </p>
          <p className="suave">
            ¿Ya estás en el celular? <a href={codigo.wa_link} target="_blank" rel="noopener noreferrer">Abre WhatsApp desde aquí</a>.
            El código sirve una sola vez y vence {fechaHora(codigo.expira_at)}.
          </p>
          {vencido && <div className="aviso ambar">El código venció. Genera uno nuevo.</div>}
          <div className="acciones">
            <button className="secundario" onClick={() => setCodigo(null)}>
              Cancelar
            </button>
            <button className="secundario" disabled={generando} onClick={() => void generar()}>
              Generar otro código
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Avisos() {
  const avisos = useCarga(() => api.get<WhatsAppAvisos[]>("/whatsapp/avisos"), []);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);

  const cambiar = async (a: WhatsAppAvisos, campo: "mis_solicitudes" | "otras_solicitudes" | "servicio_cerrado") => {
    setError(null);
    setGuardado(null);
    try {
      await api.put("/whatsapp/avisos", {
        condominio_id: a.condominio_id,
        mis_solicitudes: a.mis_solicitudes,
        otras_solicitudes: a.otras_solicitudes,
        servicio_cerrado: a.servicio_cerrado,
        [campo]: !a[campo],
      });
      setGuardado("Preferencias guardadas.");
      avisos.recargar();
    } catch (e) {
      setError(textoError(e));
    }
  };

  return (
    <section className="tarjeta">
      <h2>Avisos por WhatsApp</h2>
      <p className="suave">Elige, por condominio, de qué te avisamos en tu WhatsApp.</p>
      <Errores mensaje={error} />
      <Exito mensaje={guardado} />
      <Cargando error={avisos.error} cargando={avisos.cargando} />
      {avisos.datos?.map((a) => (
        <fieldset key={a.condominio_id} style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
          <legend style={{ fontSize: ".95rem", fontWeight: 600, marginBottom: 6 }}>{a.condominio_nombre}</legend>
          <div className="grupo-checks">
          <label className="check">
            <input type="checkbox" checked={a.mis_solicitudes} onChange={() => void cambiar(a, "mis_solicitudes")} />
            Cuando cambie el estado de las solicitudes que yo haga
          </label>
          <label className="check">
            <input type="checkbox" checked={a.otras_solicitudes} onChange={() => void cambiar(a, "otras_solicitudes")} />
            Cuando cambie el estado de las solicitudes que hagan otras cuentas de este condominio
          </label>
          <label className="check">
            <input type="checkbox" checked={a.servicio_cerrado} onChange={() => void cambiar(a, "servicio_cerrado")} />
            Cuando el técnico cierre un servicio de este condominio
          </label>
          </div>
        </fieldset>
      ))}
    </section>
  );
}
