// Cliente HTTP del portal. La sesion es una cookie HttpOnly: el front no ve ni
// guarda ningun token. Todo va a /portal/* en el mismo origen.

export type Requiere = "configurar_2fa" | "reautenticar" | "regularizar_saldo" | "verificar_correo" | "completar_perfil";

export class ApiError extends Error {
  status: number;
  requiere?: Requiere;
  constructor(status: number, message: string, requiere?: Requiere) {
    super(message);
    this.status = status;
    this.requiere = requiere;
  }
}

function mensajeDe(detail: unknown, status: number): { mensaje: string; requiere?: Requiere } {
  if (typeof detail === "string") return { mensaje: detail };
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : ""))
      .filter(Boolean);
    return { mensaje: msgs.join(" ") || "Revisa los datos capturados." };
  }
  if (detail && typeof detail === "object" && "mensaje" in detail) {
    const d = detail as { mensaje: string; requiere?: Requiere };
    return { mensaje: d.mensaje, requiere: d.requiere };
  }
  return {
    mensaje:
      status >= 500
        ? "El servidor tuvo un problema. Intenta de nuevo en unos segundos."
        : "No se pudo completar la operación.",
  };
}

let alSesionInvalida: () => void = () => {};
export function onSesionInvalida(fn: () => void) {
  alSesionInvalida = fn;
}

async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`/portal${ruta}`, {
      method: metodo,
      credentials: "same-origin",
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ApiError(0, "No hay conexión con el servidor.");
  }
  if (resp.ok) {
    const texto = await resp.text();
    return (texto ? JSON.parse(texto) : undefined) as T;
  }
  let detail: unknown;
  try {
    detail = (await resp.json()).detail;
  } catch {
    detail = undefined;
  }
  const { mensaje, requiere } = mensajeDe(detail, resp.status);
  // 401 = sesion invalida. 403 NO: es "falta un paso" (step-up / saldo).
  if (resp.status === 401 && !ruta.startsWith("/login")) alSesionInvalida();
  throw new ApiError(resp.status, mensaje, resp.status === 403 ? requiere : undefined);
}

export const api = {
  get: <T>(r: string) => pedir<T>("GET", r),
  post: <T>(r: string, b?: unknown) => pedir<T>("POST", r, b ?? {}),
  patch: <T>(r: string, b: unknown) => pedir<T>("PATCH", r, b),
};

export const textoError = (e: unknown) => (e instanceof ApiError ? e.message : "Ocurrió un error inesperado.");

// ---- tipos (espejo de app/schemas.py) --------------------------------------

export type Cuenta = { id: number; correo: string; nombre: string; telefono: string | null };
export type Estado2fa = { configurado: boolean; reautenticada: boolean; codigos_recuperacion_restantes: number };
export type Condominio = {
  id: number;
  nombre: string;
  calle: string | null;
  numero_exterior: string | null;
  colonia: string | null;
  codigo_postal: string | null;
  telefono_fijo: string | null;
  telefono_administrador: string | null;
  telefono_junta: string | null;
  telefono_recibo: string | null;
  correo_recibo: string | null;
  latitud: string | null;
  longitud: string | null;
  // Lo que falta para poder pedir servicios: calle, numero_exterior, colonia,
  // codigo_postal, ubicacion, telefono, correo_contacto (decisiones/0105).
  perfil_completo: boolean;
  faltantes: string[];
  tiene_datos_fiscales: boolean;
  updated_at: string;
};
export type DatosFiscales = {
  rfc: string;
  razon_social: string;
  regimen_fiscal: string;
  codigo_postal_fiscal: string;
  uso_cfdi: string;
  correo_facturacion: string;
  nivel: "condominio" | "fraccionamiento";
  created_at: string;
};
export type ItemCatalogo = { codigo: string; nombre: string };
export type CatalogosFiscales = { regimenes_fiscales: ItemCatalogo[]; usos_cfdi: ItemCatalogo[] };
export type TipoServicio = { id: number; nombre: string };
export type Solicitud = {
  id: string;
  condominio_id: number;
  condominio_nombre: string;
  tipos_servicio: TipoServicio[];
  servicio_solicitado: string;
  quien_reporta: string | null;
  telefono_reporta: string | null;
  estado: "pendiente" | "en_revision" | "convertida" | "rechazada";
  motivo_rechazo: string | null;
  numero_pedido: number | null;
  // Lo ultimo que pidio la empresa y lo que se contesto (decisiones/0110).
  ultima_revision: { comentario: string; created_at: string; respuesta: string | null; respondida_at: string | null } | null;
  created_at: string;
  resuelta_at: string | null;
};
export type Pedido = {
  numero_pedido: number;
  condominio_id: number;
  condominio_nombre: string;
  tipos_servicio: { tipo_servicio_id: number; tipo_servicio_nombre: string; posicion: number; resuelto: boolean }[];
  servicio_solicitado: string;
  quien_reporta: string | null;
  telefono_reporta: string | null;
  estado: string;
  created_at: string;
};
export type ServicioPedido = {
  numero_orden: number;
  tipo_servicio_nombre: string;
  resolucion: "total" | "parcial" | null;
  cerrado_at: string;
  estado_pago: string;
  monto_total: string;
  monto_pagado: string;
  saldo: string;
};
export type PedidoDetalle = Pedido & { servicios: ServicioPedido[] };
export type Saldo = {
  condominio_id: number;
  saldo_total: string;
  servicios_sin_monto: number;
  dias_del_mas_antiguo: number | null;
  servicios: {
    numero_pedido: number | null;
    numero_orden: number;
    tipo_servicio_nombre: string;
    cerrado_at: string;
    dias: number;
    estado_pago: string;
    monto_total: string;
    monto_pagado: string;
    saldo: string;
  }[];
};
