// Pages Function: reenvia /portal/* de clientes.elitecsystems.mx al tunel de la
// API. Para el navegador sigue siendo un solo origen, asi que la cookie
// __Host- con SameSite=Strict y el chequeo de Origin quedan intactos.
// -> vault/decisiones/0111
//
// El destino es el hostname por el que la API sirve /portal/* (PORTAL_API_HOST
// en el .env de la API). Se puede cambiar sin tocar codigo con la variable
// PORTAL_API_ORIGIN del proyecto de Pages.
//
// IP del visitante: para la API la peticion llega del Worker, asi que su
// CF-Connecting-IP no es la del visitante y el rate limit contaria a todos los
// clientes juntos. Esta Function la reenvia en X-Portal-Client-IP, acompanada
// de PORTAL_PROXY_SECRET (variable de tipo Secret del proyecto de Pages, el
// mismo valor que en el .env de la API): sin el secreto la API no cree esa IP,
// porque el hostname del tunel es publico. Los dos headers que mande el
// navegador se descartan primero: nunca pasan tal cual.

interface Env {
  PORTAL_API_ORIGIN?: string;
  PORTAL_PROXY_SECRET?: string;
}

const API_ORIGIN_POR_DEFECTO = "https://portal.elitecsystems.mx";

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const entrada = new URL(request.url);
  const destino = new URL(
    entrada.pathname + entrada.search,
    env.PORTAL_API_ORIGIN || API_ORIGIN_POR_DEFECTO,
  );

  // Request nueva con el mismo metodo, cuerpo y cabeceras (cookies y Origin
  // incluidos). fetch() fija el Host al del destino. "manual": una redireccion
  // de la API le llega tal cual al navegador.
  const base = new Request(destino, request);
  const cabeceras = new Headers(base.headers);
  cabeceras.delete("X-Portal-Client-IP");
  cabeceras.delete("X-Portal-Proxy-Secret");
  const ipVisitante = request.headers.get("CF-Connecting-IP");
  if (env.PORTAL_PROXY_SECRET && ipVisitante) {
    cabeceras.set("X-Portal-Client-IP", ipVisitante);
    cabeceras.set("X-Portal-Proxy-Secret", env.PORTAL_PROXY_SECRET);
  }
  return fetch(new Request(base, { headers: cabeceras }), { redirect: "manual" });
};
