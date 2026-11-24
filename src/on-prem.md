# On-prem

xhr.dev is **on-prem only**. You run the solver as a container on your own
infrastructure, and it talks directly to the target sites and proxies you
configure — never through infrastructure xhr.dev operates. Your traffic,
cookies, and target-site data stay inside your network.

There was once a hosted proxy. There isn't now, and the only solver we run is
the [trial box](#the-hosted-trial-box) we lend to prospects during an
evaluation.

## Network posture

The container is designed to run on a box with **no general internet access**.
That isn't only a deployment recommendation — the application enforces it on
itself.

### The runtime runs under a restrictive permission model

The runtime starts under [Node's permission model][perm], and keeps only what
a solve actually needs. Verifiably, in the shipped image, the process:

- **cannot spawn a subprocess or a shell** — `child_process` fails with
  `ERR_ACCESS_DENIED`,
- **cannot write to the filesystem at all**, and
- **can read only its own unpacked payload** — not your filesystem, not your
  mounted secrets. Reading `/etc/passwd` fails with `ERR_ACCESS_DENIED`.

Those permissions are granted at startup by the launcher and cannot be widened
by anything that runs afterwards, including the challenge script.

::: warning What this does *not* constrain
It does not restrict outbound network destinations, and we would rather say so
than imply otherwise. The runtime is started with `--allow-net=0.0.0.0:3000`,
which names the port it serves you on — but Node's `--allow-net` is a boolean
and takes no address allowlist, so read that as intent rather than as
enforcement. It is also one permission covering both listening and connecting:
a process that serves you an API cannot give up outbound without giving up the
ability to bind its own port. So the runtime either has network or it does not.

What it actually *does* with it is narrower than that permission suggests. A
DataDome solve makes no outbound request at all: `iframeData` is required
because the container cannot fetch the challenge document itself (omitting it
returns `400`), and a `proxy` in the body is accepted and ignored — an
unroutable one returns the same prepared submission as none. The outbound path
that does get used is Akamai's server-side solve, which fetches the sensor
script from the target (it never submits the payload; you do that) — and
which routes that through the `proxy` you name, defaulting to
`127.0.0.1:8080` if you name none.

So "it never phones home" is not something a runtime flag can prove to you.
What can prove it is your own network, which is why the check below is
behavioural rather than a config dump. Egress rules on the host, or an
`--internal` docker network, are what actually bound where this process can
reach — and unlike a flag, you control and can audit them.
:::

::: tip Verify it yourself, behaviourally
Don't take our word for it, and don't settle for reading a config either — make
the container prove it. Run it with egress restricted to your proxy and nothing
else:

```bash
# no default route to the internet; only your proxy is reachable
docker network create --internal xhrdev-net
docker run -d --name xhrdev --network xhrdev-net ... ghcr.io/xhrdev-<your-org>/xhrdev:latest
```

Solves keep working. Then point a packet capture or your egress firewall logs
at it for as long as you like: the only outbound flows are to the proxy you
configured.

That's a stronger artifact for a security review than any policy document or
config dump, because it's an observed property of the running system rather
than a claim about it. It's also the reason this passes review at shops that
can't route traffic through a vendor's proxy at all.
:::

[perm]: https://nodejs.org/api/permissions.html

### The sandbox has no network at all

One layer further in: the anti-bot vendor's obfuscated challenge script is
untrusted code, and it runs in a sandbox whose network surfaces are patched
rather than real. `XMLHttpRequest`, WebRTC, and Workers are reimplemented and
answered in-process, so the challenge script cannot open a socket even in
principle — its "requests" never leave the process, let alone the box.

### What that means for your firewall

Lock the box down. The container needs:

| Direction | Destination | Why |
|---|---|---|
| inbound | port `3000`, from your scrapers only | the API |
| outbound | your proxy | fetching the Akamai sensor script from the target |

Nothing else — no DNS to xhr.dev, no registry access at runtime, no NTP
dependency unless you've opted into
[time-source hardening](/deployment#hardening-licence-expiry-checks-on-ecs).
Egress restricted to your proxy pool is a supported, tested configuration.

::: warning The network is the only access control
There is no per-request authentication and no API key — the licence gates
startup, not requests. **Anything that can reach port 3000 can use the
solver.** That's the trade for having no auth to misconfigure, and it means
reachability is your whole access-control story. See [Security](/security).
:::

### Run the container locked down

The runtime confines itself, but it runs on your infrastructure and the
container boundary is yours. We ship and test against this flag set, and
recommend you deploy with it:

```bash
docker run -d \
  --name xhrdev \
  --restart unless-stopped \
  --cap-drop=ALL \
  --security-opt no-new-privileges:true \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m \
  --pids-limit 512 \
  --memory 6g \
  --cpus 3 \
  --dns 1.1.1.1 --dns 8.8.8.8 \
  -p 3000:3000 \
  -v ./licence:/run/licence:ro \
  ghcr.io/xhrdev-<your-org>/xhrdev:latest
```

| Flag | What it buys you |
|---|---|
| `--cap-drop=ALL` | Nothing here needs a Linux capability; it binds `:3000` as an unprivileged uid. |
| `--security-opt no-new-privileges` | Closes the setuid route to more privilege. |
| `--read-only` | The image filesystem cannot be modified, so nothing can be left behind that survives a restart. |
| `--tmpfs /tmp` with `noexec,nosuid` | Provides the scratch space the runtime needs without allowing a binary to be staged in it. |
| `--pids-limit`, `--memory`, `--cpus` | A runaway workload degrades this container rather than the host. Size to your box — `--cpus` must not exceed the cores actually available. |
| `--dns` | Keeps the container off your VPC resolver, which on AWS, GCP and OCI often shares an address with the instance metadata service. |

Two more worth doing at the network layer, which Docker flags can't express:

- **Block egress to `169.254.169.254`.** On the major clouds that address
  serves instance credentials to anything that can reach it. If your resolver
  lives there too, allow UDP/TCP 53 and drop the rest.
- **Stop the container connecting to the host itself** and to the rest of your
  private range. It only ever needs your proxy and your targets.

None of this changes how the solver behaves — every gate in our release
pipeline runs against a container started this way.

## Licence, not phone-home

A signed licence file unlocks the container at startup: it verifies the
Ed25519 signature over your licence and checks the `expires_at` deadline,
entirely locally. There's no licence server to call, which is why the
egress-restricted deployment above works at all: run it with no route to us
and licensing still functions.

If the licence is missing, expired, or tampered with, the container exits
immediately with `{"event":"launcher_failed"}` and a non-zero code. It fails
closed, not open.

See [Deployment](/deployment) for delivery and renewal.

## What it solves

- **Akamai Bot Manager** — sensor challenges (`_abck` / `bm-sz`) and SBSD.
  Direct HTTP solve, or a streaming WebSocket session for browser-automation
  setups. [API reference](/api-akamai)
- **DataDome** — captcha and interstitial challenges, via a single-shot
  HTTP call. [API reference](/api-datadome)

Don't see what you need? [Message us](mailto:info@xhr.dev).

## The hosted trial box

The one exception to all of the above. During an evaluation we'll point you at
a solver we run, so you can try the API before deploying anything. It sits
behind a reverse proxy that requires an `x-api-key` header on `/akamai/*` and
`/dd/*` (`/hc` stays open), and the key is issued with the trial and revoked
when it ends.

That key exists because the box is on the public internet. **It has no
equivalent in a self-hosted deployment** — your own container has no API key
and ignores the header. It's also the only configuration in which any of your
traffic touches a machine we operate; the moment you deploy your own
container, that stops.

The [OpenAPI spec](/openapi.yml) carries both: the trial server with
`ApiKeyAuth`, and your own container with no security requirement.

## Next

- [Deployment](/deployment) — pulling the image and running it
- [Security](/security) — the full trust model
- [How to integrate](/integrate)
