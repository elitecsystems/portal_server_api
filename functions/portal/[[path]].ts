// Pages Function: reenvia /portal/* de clientes.elitecsystems.mx al tunel de la
// API. Para el navegador sigue siendo un solo origen, asi que la cookie
// __Host- con SameSite=Strict y el chequeo de Origin quedan intactos.
// -> vault/decisiones/0111
//
// El destino es el hostname por el que la API sirve /portal/* (PORTAL_API_HOST
// en el .env de la API). Se puede cambiar sin tocar codigo con la variable
// PORTAL_API_ORIGIN del proyecto de Pages.

interface Env {
  PORTAL_API_ORIGIN?: string;
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
  return fetch(new Request(destino, request), { redirect: "manual" });
};
