# SDK

`@xhrdev/sdk` gives you **TypeScript types** for the on-prem API — the request
and response shapes for every endpoint, generated from the same
[OpenAPI spec](/openapi.yml) the docs are built from.

::: info Types, not a client
It deliberately isn't an HTTP client. You're calling your own container over
plain HTTP with no auth scheme to wrap, so there's nothing meaningful for a
client wrapper to do. Use `fetch`, `axios`, `undici` —
whatever you already have — and let the SDK type it. See
[Via HTTP (Node, Python)](/integrate-http-clients).
:::

## Installation

```bash
npm install --save-dev @xhrdev/sdk
```

Types only, so it belongs in `devDependencies`.

## Typed requests and responses

```typescript
import type {
  AkamaiSolveRequest,
  AkamaiSolveResponse,
  DatadomeSolveRequest,
  DatadomeSolveResponse,
} from '@xhrdev/sdk';
```

Wrap your own call however you like:

```typescript
import type { DatadomeSolveRequest } from '@xhrdev/sdk';

const SOLVER = process.env.SOLVER_URL ?? 'http://localhost:3000';

async function solveDataDome(body: DatadomeSolveRequest) {
  const res = await fetch(`${SOLVER}/dd/solve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`solver returned HTTP ${res.status}: ${await res.text()}`);
  }

  // A prepared submission — send it yourself from your own IP.
  return res.json();
}
```

The same for Akamai:

```typescript
import type { AkamaiSolveRequest, AkamaiSolveResponse } from '@xhrdev/sdk';

async function solveAkamai(
  body: AkamaiSolveRequest
): Promise<AkamaiSolveResponse> {
  const res = await fetch(`${SOLVER}/akamai/solve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
```

## Health and stats

```typescript
import type { Stats } from '@xhrdev/sdk';

const stats: Stats = await (await fetch(`${SOLVER}/stats`)).json();
```

## Raw OpenAPI types

Every path, operation, and component is reachable if you need something the
named exports don't cover:

```typescript
import { sdk } from '@xhrdev/sdk';

type ApiPaths = sdk.paths;
type ApiOperations = sdk.operations;
type ApiComponents = sdk.components;

type SolveOperation = sdk.operations['postAkamaiSolve'];
type ProfileSnapshot = sdk.components['schemas']['ProfileSnapshot'];
```

## The spec itself

```typescript
import { openApiSpec, getOpenApiSpec } from '@xhrdev/sdk';

console.log(openApiSpec); // the spec as a YAML string
```

You can also [download `openapi.yml`](/openapi.yml) directly or
[browse it interactively](https://docs.xhrdev.com/api.html) — useful for
generating a client in a language the SDK doesn't cover.

## Covered endpoints

| Endpoint | Types |
|---|---|
| `GET /hc` | — |
| `GET /stats` | `Stats` |
| `POST /akamai/solve` | `AkamaiSolveRequest`, `AkamaiSolveResponse` |
| `POST /dd/solve` | `DatadomeSolveRequest`, `DatadomeSolveResponse` |

The Akamai WebSocket session (`/akamai/session`) isn't in the spec — OpenAPI
3.0 can't express a WebSocket protocol. Its message schemas are documented in
the [Akamai API reference](/api-akamai-sensor#websocket-session).

## Next

- [Via HTTP (Node, Python)](/integrate-http-clients)
- [Akamai API reference](/api-akamai) · [DataDome API reference](/api-datadome)
