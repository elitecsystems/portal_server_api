import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, textoError, type CatalogosFiscales, type ItemCatalogo } from "../api";
import { Campo, Errores, Exito, useCarga } from "../components/ui";
import { Publico } from "../components/Layout";
import { Mapa, type Punto } from "../components/Mapa";
import { Turnstile } from "../components/Turnstile";
import { ReenviarVerificacion } from "./Acceso";

const FISCALES_VACIOS = { rfc: "", razon_social: "", regimen_fiscal: "", codigo_postal_fiscal: "", uso_cfdi: "G03", correo_facturacion: "" };

function SelectCatalogo({ lista, valor, onChange, requerido }: { lista: ItemCatalogo[]; valor: string; onChange: (v: string) => void; requerido: boolean }) {
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} required={requerido}>
      <option value="">Elige…</option>
      {lista.map((i) => (
        <option key={i.codigo} value={i.codigo}>{i.codigo} — {i.nombre}</option>
      ))}
    </select>
  );
}

/** Registro abierto: cualquiera crea su cuenta, pero la cuenta nace SIN condominios. Un administrador de la empresa
 *  revisa lo que se declara aqui y la une a un condominio (o crea uno). Por eso NO se ofrece una lista de condominios:
 *  el nombre es texto libre y el portal nunca revela quienes son clientes. */
export function Registro() {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [yaFueCliente, setYaFueCliente] = useState<boolean | null>(null);
  const [nombreCondominio, setNombreCondominio] = useState("");
  const [fraccionamiento, setFraccionamiento] = useState("");
  const [calle, setCalle] = useState("");
  const [colonia, setColonia] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [pin, setPin] = useState<Punto | null>(null);
  const [conFiscales, setConFiscales] = useState(false);
  const [fiscales, setFiscales] = useState(FISCALES_VACIOS);
  const [token, setToken] = useState<string | null>(null);
  const [reiniciar, setReiniciar] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const catalogos = useCarga(() => api.get<CatalogosFiscales>("/registro/catalogos-fiscales"), []);

  const setF = (k: keyof typeof FISCALES_VACIOS) => (e: { target: { value: string } }) => setFiscales({ ...fiscales, [k]: e.target.value });

  if (enviado) {
    return (
      <Publico titulo="Revisa tu correo">
        <Exito mensaje="Recibimos tu solicitud." />
        <p>
          Si el correo <strong>{correo}</strong> es nuevo, te enviamos un enlace para confirmarlo. Después de confirmarlo y de
          entrar, la empresa revisará tu solicitud y te dará acceso a tu condominio.
        </p>
        <p className="suave">Si no lo ves en unos minutos, revisa spam. Si ya tenías cuenta, entra con ella o restablece tu contraseña.</p>
        <ReenviarVerificacion correo={correo} password={password} />
        <Link to="/login">Ir a entrar</Link>
      </Publico>
    );
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (password !== repetir) return setError("Las contraseñas no coinciden.");
    if (yaFueCliente === null) return setError("Dinos si tu condominio ya ha sido cliente de Elitec.");
    if (yaFueCliente === false && !pin) return setError("Coloca el pin del condominio en el mapa.");
    if (!token) return setError("Espera a que termine la verificación e inténtalo de nuevo.");
    setEnviando(true);
    try {
      await api.post("/registro", {
        nombre, correo, telefono, password,
        ya_fue_cliente: yaFueCliente,
        nombre_condominio: nombreCondominio,
        fraccionamiento: yaFueCliente && fraccionamiento.trim() ? fraccionamiento : undefined,
        calle: yaFueCliente === false ? calle : undefined,
        colonia: yaFueCliente === false && colonia.trim() ? colonia : undefined,
        codigo_postal: yaFueCliente === false && codigoPostal.trim() ? codigoPostal : undefined,
        latitud: yaFueCliente === false ? pin?.lat : undefined,
        longitud: yaFueCliente === false ? pin?.lng : undefined,
        ...(conFiscales ? fiscales : {}),
        turnstile_token: token,
      });
      setEnviado(true);
    } catch (e) {
      setError(textoError(e));
      setToken(null);
      setReiniciar((n) => n + 1);
      setEnviando(false);
    }
  };

  return (
    <Publico titulo="Crea tu cuenta">
      <p className="suave">
        Tu solicitud la revisa una persona de Elitec antes de darte acceso. ¿Ya tienes cuenta? <Link to="/login">Entra</Link>.
      </p>
      <Errores mensaje={error} />
      <form onSubmit={enviar}>
        <h2>Tus datos</h2>
        <Campo etiqueta="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={200} autoFocus /></Campo>
        <Campo etiqueta="Correo"><input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required maxLength={254} /></Campo>
        <Campo etiqueta="Teléfono" ayuda="Para confirmar contigo tu solicitud.">
          <input type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} required minLength={8} maxLength={40} />
        </Campo>
        <Campo etiqueta="Contraseña" ayuda="Mínimo 10 caracteres.">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Repite la contraseña">
          <input type="password" autoComplete="new-password" minLength={10} maxLength={200} value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        </Campo>

        <h2>Tu condominio</h2>
        <Campo etiqueta="¿Tu condominio ya ha sido cliente de Elitec?">
          <label style={{ display: "block" }}><input type="radio" name="cliente" checked={yaFueCliente === true} onChange={() => setYaFueCliente(true)} /> Sí, ya nos han dado servicio</label>
          <label style={{ display: "block" }}><input type="radio" name="cliente" checked={yaFueCliente === false} onChange={() => setYaFueCliente(false)} /> No, es la primera vez</label>
        </Campo>
        {yaFueCliente !== null && (
          <Campo etiqueta="Nombre del condominio" ayuda="Escríbelo tal como lo conocen. Si no estás seguro, pon tu mejor aproximación.">
            <input value={nombreCondominio} onChange={(e) => setNombreCondominio(e.target.value)} required maxLength={200} />
          </Campo>
        )}
        {yaFueCliente === true && (
          <Campo etiqueta="Fraccionamiento (si aplica)">
            <input value={fraccionamiento} onChange={(e) => setFraccionamiento(e.target.value)} maxLength={200} />
          </Campo>
        )}
        {yaFueCliente === false && (
          <>
            <Campo etiqueta="Calle y número"><input value={calle} onChange={(e) => setCalle(e.target.value)} required maxLength={200} /></Campo>
            <Campo etiqueta="Colonia"><input value={colonia} onChange={(e) => setColonia(e.target.value)} maxLength={200} /></Campo>
            <Campo etiqueta="Código postal"><input value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} inputMode="numeric" maxLength={5} pattern="\d{5}" /></Campo>
            <p className="suave">Haz clic en el mapa para colocar el pin en la entrada del condominio; puedes arrastrarlo para afinarlo.</p>
            <Mapa valor={pin} onChange={setPin} />
          </>
        )}

        {yaFueCliente !== null && (
          <>
            <h2>Datos fiscales</h2>
            <p className="suave">Opcionales ahora; los necesitarás para pedir tu primer servicio. Si ya los tienes a la mano, captúralos y le ahorras un paso a la empresa.</p>
            <label style={{ display: "block", marginBottom: 12 }}>
              <input type="checkbox" checked={conFiscales} onChange={(e) => setConFiscales(e.target.checked)} /> Capturar mis datos fiscales ahora
            </label>
            {conFiscales && (
              <>
                {catalogos.error && <Errores mensaje={`No se pudieron cargar las listas del SAT. ${catalogos.error}`} />}
                <Campo etiqueta="RFC"><input value={fiscales.rfc} onChange={setF("rfc")} required maxLength={13} style={{ textTransform: "uppercase" }} /></Campo>
                <Campo etiqueta="Razón social"><input value={fiscales.razon_social} onChange={setF("razon_social")} required maxLength={254} /></Campo>
                <Campo etiqueta="Régimen fiscal">
                  <SelectCatalogo requerido lista={catalogos.datos?.regimenes_fiscales ?? []} valor={fiscales.regimen_fiscal} onChange={(v) => setFiscales({ ...fiscales, regimen_fiscal: v })} />
                </Campo>
                <Campo etiqueta="Código postal fiscal"><input value={fiscales.codigo_postal_fiscal} onChange={setF("codigo_postal_fiscal")} required inputMode="numeric" maxLength={5} pattern="\d{5}" /></Campo>
                <Campo etiqueta="Uso de CFDI">
                  <SelectCatalogo requerido lista={catalogos.datos?.usos_cfdi ?? []} valor={fiscales.uso_cfdi} onChange={(v) => setFiscales({ ...fiscales, uso_cfdi: v })} />
                </Campo>
                <Campo etiqueta="Correo de facturación"><input type="email" value={fiscales.correo_facturacion} onChange={setF("correo_facturacion")} required maxLength={254} /></Campo>
              </>
            )}
          </>
        )}

        <Turnstile onToken={setToken} reiniciar={reiniciar} />
        <button disabled={enviando} style={{ width: "100%" }}>{enviando ? "Enviando…" : "Enviar solicitud"}</button>
      </form>
    </Publico>
  );
}
