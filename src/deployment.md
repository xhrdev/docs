# Deployment

xhr.dev ships as a single Docker image. It runs entirely inside your
infrastructure — there is no call back to xhr.dev at runtime, and no traffic,
proxy credentials, or target-site data ever leaves your environment.

> **Multi-platform.** The image supports both ARM64 (Apple Silicon, ARM
> Linux) and x86-64 hosts. Docker pulls the correct architecture
> automatically.

## Prerequisites

Onboarding gives you three things:

1. **An invite to a private GitHub organisation** — `xhrdev-<your-org>`,
   created for you. Accept it before anything else; the image is published
   there and isn't public.
2. **`licence.json`** — your licence (customer ID, enabled features, validity
   window).
3. **`licence.sig`** — a cryptographic signature over the licence.

The container verifies the licence pair **locally, at startup** — there is no
network call to an xhr.dev licence server, and the runtime is not permitted
to make one (see [Network posture](/on-prem#network-posture)). If the licence
is missing, expired, or tampered with, the container exits immediately with
`{"event":"launcher_failed"}` and a non-zero exit code. When your licence
nears expiry, xhr.dev sends updated `licence.json` / `licence.sig` files —
no image rebuild or redeploy of anything but those two files is needed.

Don't have a licence yet? [Contact us](mailto:info@xhr.dev) or
[book a call](https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2uDlsqLG_VZLl3s3ri_-YIXD3xXi5WzY21o0dFuk6Gq4HhcXwJBxUz-1K6kMGxTEf4oIPny-nV).

## Pulling the image

The image is **private**, published to your own organisation's GitHub
Container Registry namespace. Accept the org invite first, then authenticate
to `ghcr.io` with a GitHub personal access token that has the `read:packages`
scope:

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <your-github-username> --password-stdin

docker pull ghcr.io/xhrdev-<your-org>/xhrdev:latest
```

Substitute the namespace xhr.dev gave you — it's `xhrdev-` followed by your
organisation name, and every example below uses
`ghcr.io/xhrdev-<your-org>/xhrdev:latest` for it.

::: warning `denied` / `manifest unknown` on pull
Almost always one of three things, in this order: you haven't accepted the org
invite; your token is missing `read:packages`; or you're pulling
`ghcr.io/xhrdev/…` rather than your own `ghcr.io/xhrdev-<your-org>/…`
namespace. `docker login` succeeding proves the token is valid, not that it
can see the package.
:::

CI and orchestrators need the same credential. On Kubernetes that's an
`imagePullSecret` of type `kubernetes.io/dockerconfigjson`; on ECS, a
repository credential in Secrets Manager.

## Running

### Option A — volume mount (recommended)

Create a directory containing both licence files:

```
licence/
├── licence.json
└── licence.sig
```

Then mount it into the container:

```bash
docker run -d \
  --name xhrdev \
  --restart unless-stopped \
  --cap-drop=ALL \
  --security-opt no-new-privileges:true \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  --pids-limit 512 \
  -p 3000:3000 \
  -v ./licence:/run/licence:ro \
  ghcr.io/xhrdev-<your-org>/xhrdev:latest
```

The flags after `--restart` are containment rather than configuration — see
[Run the container locked down](/on-prem#run-the-container-locked-down) for
what each one buys you, and for the resource caps to size to your own host.
The solver runs with or without them; we would rather you ran it with them.

### Option B — environment variables

Useful for AWS Secrets Manager, Kubernetes Secrets, or any setup where a
mounted volume is inconvenient:

```bash
docker run -d \
  --name xhrdev \
  --restart unless-stopped \
  --cap-drop=ALL \
  --security-opt no-new-privileges:true \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  --pids-limit 512 \
  -p 3000:3000 \
  -e LICENCE_JSON_CONTENT="$(cat licence.json)" \
  -e LICENCE_SIG_BASE64="$(base64 licence.sig)" \
  ghcr.io/xhrdev-<your-org>/xhrdev:latest
```

### Option C — Docker Compose

```yaml
services:
  xhrdev:
    image: ghcr.io/xhrdev-<your-org>/xhrdev:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./licence:/run/licence:ro
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=64m
    pids_limit: 512
```

```bash
docker compose up -d
```

### Health check

```bash
curl http://localhost:3000/hc
# {"status":"ok"}
```

The image also declares a Docker-native `HEALTHCHECK` — `docker ps` shows
`(healthy)` once the solver is ready to accept requests.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `LICENCE_JSON_CONTENT` | — | Licence JSON inline (alternative to volume mount) |
| `LICENCE_SIG_BASE64` | — | Licence signature, base64-encoded (alternative to volume mount) |
| `TIME_SOURCE_PRIORITY`, `REQUIRE_TIME_SOURCE`, `ALLOW_SYSTEM_CLOCK_FALLBACK` | see below | ECS licence-expiry hardening — see [Production notes](#hardening-licence-expiry-checks-on-ecs) |

The API itself requires no proxy configuration to be set at the container
level — proxies are passed **per-request** (`proxy` / `proxy_url` fields in
the [Akamai](/api-akamai) and [DataDome](/api-datadome) APIs), so different
requests can use different upstream proxies against the same running
container.

## Renewing a licence

Licences have an expiry window. Before it lapses, xhr.dev sends you a new
`licence.json` / `licence.sig` pair. Replace the files in your mounted
`./licence` directory (or update the `LICENCE_JSON_CONTENT` /
`LICENCE_SIG_BASE64` secret values) and restart the container — no image
pull or rebuild required:

```bash
docker restart xhrdev
```

## How the image is licensed

The solver logic ships protected, and unlocks only against a valid licence.
What that means for running it:

- **The check is local and offline.** Startup verifies the signature over
  your licence and its `issued_at` / `expires_at` window without contacting
  xhr.dev — there is no licence server, and the runtime isn't permitted to
  reach one (see [Network posture](/on-prem#network-posture)).
- **It fails closed.** A missing, expired, or tampered licence exits
  immediately with `{"event":"launcher_failed"}` and a non-zero code, rather
  than starting in a degraded state.
- **The image is the same for every customer.** Only the licence differs,
  which is why renewal is a file swap and a restart rather than a new pull.

See [Security](/security) for the trust model.

## Production notes

### Hardening licence-expiry checks on ECS

Licence expiry checks trust your container's clock by default. On AWS/ECS
deployments, xhr.dev recommends pinning that check to ECS task metadata
instead:

```bash
-e TIME_SOURCE_PRIORITY=ecs \
-e REQUIRE_TIME_SOURCE=ecs \
-e ALLOW_SYSTEM_CLOCK_FALLBACK=false
```

If you're not on ECS, leave these unset — the defaults are appropriate for
most deployments. [Contact us](mailto:info@xhr.dev) if you're deploying
somewhere else and want an equivalent hardened setup.

### Licence delivery via secrets manager

Set `LICENCE_JSON_CONTENT` and `LICENCE_SIG_BASE64`; the launcher falls back
to the mounted file paths when those env vars are absent.
