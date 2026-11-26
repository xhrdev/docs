# Security

xhr.dev is deployed entirely on **your** infrastructure. This page describes
the trust model that follows from that, and how the container itself is
protected.

## Nothing is sent to xhr.dev

xhr.dev runs as a Docker container inside your own network. The container
never connects to xhr.dev at runtime:

- **Licence verification is offline.** Startup verifies the signature over
  your licence and validates the `issued_at` / `expires_at` window — a local
  cryptographic check, not a network call to a licence server.
- **No telemetry, no analytics, no error reporting.** The container does not
  phone home. It has no dependency on any third-party monitoring or
  analytics service.
- **Logging is local only.** The container logs to stdout (whatever log
  driver you attach). Nothing is shipped to xhr.dev.
- **Proxies are yours.** Outbound proxy configuration (`proxy` /
  `proxy_url`) is supplied per-request by you; xhr.dev never routes your
  traffic through infrastructure it controls.
- **The one outbound path goes to your target, not to us.** DataDome and F5
  solves make no outbound request. An Akamai solve connects to the target
  site, through the proxy you name, only to fetch the sensor script; it never
  submits. The runtime
  doesn't itself restrict outbound destinations, so if you need that
  guarantee enforce it with egress rules, as described in
  [Network posture](/on-prem#network-posture).

In short: xhr.dev, the company, has no visibility into your traffic, your
target sites, your proxies, or the data your bots handle once the container
is deployed.

::: info The hosted evaluation services are not this
Everything on this page describes a licensed container on your
infrastructure. The hosted trial solver we lend to prospects
is run by us: requests to it reach our systems, behind an API key checked
by a reverse proxy, with operational logs restricted to a small set of
maintainers. See the [Privacy Policy](/privacy) and
[Subprocessors](/subprocessors).
:::

## Licence / image protection

The solver logic ships protected so the image can't be reused or inspected
without a valid licence. Two properties matter for your threat model:

- **Verification is a local signature check**, not a network call. Nothing
  about licensing requires the container to reach xhr.dev — see
  [Licence verification is offline](#nothing-is-sent-to-xhr-dev)
  above.
- **It fails closed.** A missing, expired, or tampered licence or payload
  exits immediately with a generic `launcher_failed` event rather than
  starting in a degraded state.

We don't publish the protection mechanism. If your security team needs to
assess it for an approval, [contact us](mailto:hello@xhrdev.com) and we'll walk
through it with them directly, under NDA if you'd prefer.

## Network exposure

- The container listens on a single port (`3000` by default) for the
  `/akamai`, `/dd`, `/f5`, and `/hc` HTTP/WebSocket API. It's your responsibility
  to put it behind whatever network boundary is appropriate for your
  environment (private network, firewall rules, reverse proxy with auth,
  etc.) — by default the container does not add authentication of its own in
  front of the API.
- There is no per-request authentication and no API key. The licence gates
  startup, not requests, so **anything that can reach port 3000 can use the
  solver** — treat network reachability as the whole access-control story.
- `GET /hc` is a plain liveness check (`{"status":"ok"}`) and carries no
  sensitive information.

## Source & build integrity

- Code is hosted on GitHub with two-factor authentication required for
  access.
- Dependencies are kept current via Dependabot.
- The image is built from a reproducible pipeline, and the private key used
  to sign licences never enters the image, the build environment, or version
  control.

## Questions

For anything not covered here — architecture review, a security
questionnaire, or a call with your security team —
[contact us](mailto:hello@xhrdev.com).
