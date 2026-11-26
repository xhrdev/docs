# @xhrdev/sdk

<img src="https://raw.githubusercontent.com/xhrdev/media/refs/heads/master/logos/logo-wordmark.png" alt="sdk" style="width: 100%" />

TypeScript types for the xhr.dev on-prem API.

[docs](https://docs.xhrdev.com/)

This package ships **types only** — request/response shapes for the HTTP API
exposed by your self-hosted `xhrdev` container. It is not an HTTP client:
there's no auth/proxy scheme to wrap, since you're calling `http://<your
host>:3000` directly. See [Getting Started](https://docs.xhrdev.com/) for
`curl`/Node/Python request examples.

## Installation

```bash
npm install --save-dev @xhrdev/sdk
```

## Usage

### Type Imports

```typescript
import type {
  AkamaiSolveRequest,
  AkamaiSolveResponse,
  DatadomeSolveRequest,
  DatadomeSolveResponse,
} from '@xhrdev/sdk';
```

```typescript
import type { AkamaiSolveRequest, AkamaiSolveResponse } from '@xhrdev/sdk';

async function solveAkamai(
  body: AkamaiSolveRequest
): Promise<AkamaiSolveResponse> {
  const res = await fetch('http://localhost:3000/akamai/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
```

### OpenAPI Specification

```typescript
import { openApiSpec, getOpenApiSpec } from '@xhrdev/sdk';

console.log(openApiSpec); // the spec as a YAML string
const spec = getOpenApiSpec();
```

### Raw OpenAPI Types

```typescript
import { sdk } from '@xhrdev/sdk';

type ApiPaths = sdk.paths;
type ApiOperations = sdk.operations;
type ApiComponents = sdk.components;

type AkamaiSolveOperation = sdk.operations['postAkamaiSolve'];
```

## API Endpoints

- **GET** `/hc` — health check
- **POST** `/akamai/solve` — solve an Akamai challenge from a URL
- **WS** `/akamai/session` — streaming solve session for browser-automation setups (see [Akamai API reference](https://docs.xhrdev.com/api-akamai))
- **POST** `/dd/solve` — solve a DataDome challenge from an extracted payload

Full reference: [Akamai](https://docs.xhrdev.com/api-akamai),
[DataDome](https://docs.xhrdev.com/api-datadome).

## Authentication

None at the API layer — the container has no built-in auth in front of
`/akamai` and `/dd`. It's licence-gated at startup (see
[Deployment](https://docs.xhrdev.com/deployment)); put it behind your own
network boundary or reverse-proxy auth as appropriate for your environment.
