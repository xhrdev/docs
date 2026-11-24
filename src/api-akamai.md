# Akamai API Reference

Akamai Bot Manager scores every request, and it does so on **independent
channels**. Which ones a property runs is a per-property choice, so the API is
split the same way:

| Channel | Endpoint | What it is |
|---|---|---|
| [Sensor (`_abck`)](/api-akamai-sensor) | `POST /akamai/solve`, `WS /akamai/session` | The classic obfuscated sensor script, solved over a stateful session |
| [SBSD](/api-akamai-sbsd) | `POST /akamai/sbsd/generate-session` | A bundle script the page POSTs back to, answered with a one-shot ledger |
| [Pixel](/api-akamai-pixel) | `POST /akamai/pixel/generate` | A small deferred collector script at `/akam/<n>/<hex>`, answered with the one POST it would send |

All endpoints are mounted under `/akamai` on your running container
(`http://host:3000/akamai/...`).

> `/akamai`, `/dd` and `/f5` are described in one machine-readable spec:
> [download openapi.yml](/openapi.yml) · [browse interactively](https://docs.xhr.dev/api.html).
> The WebSocket session isn't representable in OpenAPI 3.0, so it's documented
> only on the [sensor page](/api-akamai-sensor#websocket-session).

## Which one do I need?

Look at the page, not at the docs.

- The HTML carries a script at a long random-looking path
  (`/78jHEHB-.../6LncB`) → the **sensor** channel.
- The HTML carries a script whose `src` has a UUID `v=` → the **SBSD** channel.
  That query, not the path, is what identifies it: some properties serve the
  bundle from `/.well-known/sbsd` and others from an obfuscated path next to
  the sensor script. See [finding the bundle](/api-akamai-sbsd#finding-the-bundle).
- A deferred script at `/akam/<n>/<hex>` → the **pixel** collector. It is
  independent of the other two and often present beside them.
- Several → several. This is common on large properties.

If you only see `_abck`, start with the [sensor API](/api-akamai-sensor): it is
the simpler integration and it is what most targets need.

## What they have in common

All of them are **browser bridges**. The solver computes the payloads; your browser
sends them, so every request travels on the real connection with its real TLS
fingerprint and the page's own cookie jar. None of them fetches the target
server-side on your behalf. (`POST /akamai/solve` is the exception, and exists
for setups with no browser at all — see the
[sensor page](/api-akamai-sensor#post-akamai-solve).)

They also depend on the identity you declare matching the browser actually
making the requests. That is the single most common cause of a solve that never
lands: nothing errors, the rounds simply count up forever.

::: info Authentication
None. The container is licence-gated at startup, not per-request — there's no
API key on any of these endpoints. The boundary is the network you run it on.
See [Authentication](/integrate#authentication).
:::

## Solve admission

All channels are admitted through the same internal queue: by default 8
concurrent, a queue depth of 32, and a 10s max queue wait. When the queue is
full, `/solve` rejects with `outcome: "aborted"`, `outcome_reason:
"queue_full"` (`500`), the SBSD endpoint answers `503`, and the pixel endpoint
answers `429` or `503`. All mean the same
thing — the container is saturated; run more of them behind a load balancer.

`GET /akamai/queue-metrics` shows live numbers before you scale up.

## Profiles

Every channel takes a `profile.id` in `chrome-<version>-<os>` form, e.g.
`chrome-151-macos`, and the profile has to be registered on the container you
are pointing at. Current releases register `chrome-146-macos`, `chrome-149-macos`,
`chrome-151-macos`, `chrome-154-macos` and `chrome-154-windows11`. To find out
which yours does, send a deliberately unknown id and read the `Available: [...]`
list back off the `400`.

The default, used when you name none, is `chrome-154-macos`. It was
`chrome-146-macos` on earlier releases, so a caller that omits `profile.id` gets
a different identity after upgrading. Name the one you mean.

`chrome-154-windows11` is the only non-macOS profile. Send it with a
Windows-shaped `js_profile` (`os: "windows11"`); a macOS `js_profile` under a
Windows id is refused as a relabelled copy rather than served.

## Worked examples

- [`src/akamai/sensor`](https://github.com/xhrdev/examples/blob/master/src/akamai/sensor/README.md)
  — the `_abck` lane, driven from Playwright and from Lightpanda
- [`src/akamai/sbsd`](https://github.com/xhrdev/examples/blob/master/src/akamai/sbsd/README.md)
  — SBSD, on a property that runs both channels at once
