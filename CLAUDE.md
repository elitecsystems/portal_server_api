# gestion_pedidos_portal — front del portal de clientes (etapa 2)

SPA en Vite + React + TypeScript. Consume `/portal/*` de la API (`../gestion_pedidos`).

## El contexto del proyecto vive en el vault

`../vault/` — **empezá leyendo `../vault/MAPA.md`**. Para este repo importa sobre todo
`../vault/pendientes/portal-de-clientes.md` (sección "Contrato con el front").

## Cómo correrlo

```
npm install
cp .env.example .env
npm run dev      # http://clientes.localhost:5173, proxy de /portal a la API
npm run build    # typecheck + dist/
```

El proxy de Vite fija `Host` y `Origin` al valor de `PORTAL_CLIENTES_URL`, porque el
middleware de host de la API (`app/main.py`) los exige. La API debe estar corriendo.

## Dos reglas que no cambian

1. **Claude Code nunca comitea.** Camilo hace todos los `add`/`commit`/`push`.
2. **El código commiteado gana** contra cualquier documento.
