# Akamai Sensor API Reference

The classic `_abck` channel: Akamai's obfuscated sensor script, and the
telemetry it is supposed to produce. All endpoints are mounted under `/akamai`
on your running container (`http://host:3000/akamai/...`).

> Akamai's other channel is [SBSD](/api-akamai-sbsd), which has its own
> endpoint. A property can run either or both — see the
> [Akamai overview](/api-akamai).

> Both `/akamai` and `/dd` are described in one machine-readable spec:
> [download openapi.yml](/openapi.yml) · [browse interactively](https://docs.xhrdev.com/api.html).
> The WebSocket session below isn't representable in OpenAPI 3.0, so it's
> documented only here.

There are two ways to drive a solve, depending on your architecture:

| Endpoint | Use when... |
|---|---|
| `POST /akamai/solve` | You just want to hand over a URL + browser profile and let the solver do the fetching, solving, and submission. |
| `WS /akamai/session` | You're driving a real browser (Playwright/Puppeteer) and want each sensor request relayed through that browser's own network stack and cookie jar. |

All error responses include an `error: string` field. Validation failures
return `400`; solve-time failures return `500`.

::: info Authentication
None. The container is licence-gated at startup, not per-request — there's no
API key on any of these endpoints. The boundary is the network you run it on.
See [Authentication](/integrate#authentication).
:::

## Solve admission

Solves share the container's [admission queue](/api-akamai#solve-admission).
When it is full, `/solve` rejects with `outcome: "aborted"`, `outcome_reason:
"queue_full"` (`500`); when a request waits past the max, `outcome: "timeout"`,
`outcome_reason: "queue_wait_timeout"` (`500`).

## `POST /akamai/solve`

End-to-end solve starting from a URL: fetches the page, extracts the sensor
script, runs it in the sandbox, and returns the built sensor submission. The
solver never submits to the origin itself — you send it from your own IP.

### Request body

| Field | Type | Required | Notes |
|---|---|---|---|
| `url` | string | yes | Target URL to solve for |
| `profile` | `ProfileSnapshot` | yes | See below |
| `js_profile` | `JsProfilePayload` | yes | Browser fingerprint data |
| `script` | `{ html, js, url }` | no | Skip the live fetch; all three sub-fields required together |
| `cookies` | `Record<string,string>` | no | Seed cookies, only used with `script` |
| `proxy` | string | no — **but see below** | Outbound proxy URL. Honoured, unlike DataDome's |
| `mode` | `"abck" \| "sbsd"` | no | Forces mode; otherwise auto-detected from the script |
| `maxSensors` | number | no | Cap on sensor beacons sent |
| `submit` | boolean | no | Legacy and being removed. The solver always behaves as `submit: false`; don't send it |
| `timeout` | number, ms | no (default `20000`) | Overall deadline |
| `acceptCookieName` | string | no (default `_abck`) | Cookie checked for acceptance |
| `request_id`, `attempt_id`, `correlation_id` | string | no | Provide all three or none — freezes an identity used to validate later submissions |
| `readiness_state` | `"created"\|"ready"\|"solving"\|"completed"\|"aborted"` | no | Only valid state transitions are accepted |
| `spider` | string | no | Free-form label surfaced in metrics |
| `interaction` | `"emitter" \| "passive"` | no (default `emitter`) | `passive` drives no synthetic input. See [Interaction](#interaction) |
| `deadline_budget_ms` | number, ms | no | Overrides `timeout` when both are sent |
| `bm_lso_policy` | `"withhold" \| "refresh" \| "passthrough"` | no (default `withhold`) | `sbsd` mode only: what is done with the `bm_lso` cookie. See [below](#intercepted-request-and-queue-metadata) |
| `intercepted_request` | object | no | The request your interceptor caught; each submission is checked against it. See [below](#intercepted-request-and-queue-metadata) |
| `queue_metadata` | object | no | Your own queue's numbers, echoed into the server log. See [below](#intercepted-request-and-queue-metadata) |

::: warning Omitting `proxy` does not mean "go direct"
Unlike [DataDome's](/api-datadome), this `proxy` is real: an Akamai solve
fetches the sensor script from the target (it never submits the payload), so
it has an outbound path and uses it.

What is surprising is the default. With no `proxy` in the body the container
does not go direct; it tries **`127.0.0.1:8080`**, and on a box with nothing
listening there the solve fails immediately with
`Akamai solve error: connect ECONNREFUSED 127.0.0.1:8080`. Sending a real
proxy is what makes it work:

```
proxy: "http://127.0.0.1:1"   -> 500  connect ECONNREFUSED 127.0.0.1:1
(omitted)                     -> 500  connect ECONNREFUSED 127.0.0.1:8080
proxy: "http://<real proxy>"  -> 200  outcome: "solved"
```

So treat `proxy` as required in practice for this endpoint, and remember the
cookie it earns is bound to whatever exit IP you named — which has to be the
one you then browse from.
:::

#### Intercepted request and queue metadata

`intercepted_request` lets a setup that intercepts the page's own request tell
the solver what it caught:

| Field | Type | Notes |
|---|---|---|
| `url` | string | **Required.** Absolute URL. |
| `method` | string | **Required.** |
| `headers` | object | Optional. String values only; names are lower-cased. |
| `content_type` | string | Optional. |
| `body` | object | Optional: `raw` (string), `size` (number ≥ 0), `sha256` (string), `truncated` (boolean). |
| `captured_at_ms` | number ≥ 0 | Optional. |
| `matched_reason` | string | Optional. |

When it is present, a submission whose method or target differs from `method`
and `url` fails the solve with a correlation-mismatch error instead of being
sent. That is the point: it stops a solve answering a request you did not mean.

`queue_metadata` carries `candidate_id` (positive integer), `enqueued_at_ms`
(number ≥ 0) and `queue_depth_at_enqueue` (integer ≥ 0). It changes nothing about
the solve; it is written to the server log so you can line your own queue up
with the container's. Any malformed value in either object is a `400`.

`bm_lso_policy` applies only to `mode: "sbsd"`. `withhold` (the default) drops
the `bm_lso` cookie, `refresh` re-stamps it to the current time, and
`passthrough` leaves it as it was. An unrecognised value is a `400`.

#### Interaction

Only you know whether the visit you are describing is passive, so it is a
request field and not something the server infers.

- `emitter` — the default. The sandbox drives pointer input for as long as the
  solve lasts.
- `passive` — no input at all.

An unrecognised value is a `400`, never a silent fallback to the default.
`passive` is for the `abck` mode only; sending it with `mode: "sbsd"` is refused
up front, because a solve with no input can't produce the bodies an SBSD solve
needs. `passive` is also not a promise of a cookie: with no input the sensor
posts less, so `emitter` stays the default.

`ProfileSnapshot`:

```json
{
  "id": "chrome-146-macos",
  "chromeFullVersion": "146.0.7680.81",
  "os": "macos",
  "timezone": "America/New_York",
  "timezoneOffsetMinutes": -300,
  "tlsClientHello": "chrome_146",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "httpHeaderTemplates": { "form": [], "iframe": [], "image": [], "xhr": [] }
}
```

`profile.id` must match the `chrome-<version>-<os>` format, e.g.
`chrome-146-macos`. If `js_profile.chromeVersion` / `js_profile.os` are also
present, they must not conflict with `profile.id`.

`js_profile` carries fingerprint data used to make the sensor payload match a
real browser: `audioContext`, `hardware.{canvas, emptyCanvas, fonts,
webgl.{image, params, renderer, vendor}}`, `hardwareConcurrency`,
`deviceMemory`, `screen.*`, `perf`, `os`, `chromeVersion`, `timezone`, etc.

### Success response `200`

(`submit: false` is the only behaviour; the `accepted` / `cookie_header` / `sensors_sent` fields of the legacy submitting response are no longer returned.)

```json
{
  "success": true,
  "mode": "abck",
  "outcome": "…",
  "submission": {
    "method": "POST",
    "url": "https://target.example.com/…",
    "body": "{\"sensor_data\":\"…\"}",
    "content_type": "text/plain;charset=UTF-8",
    "request_headers": { "…": "…" },
    "cookies_before": { "_abck": "…" }
  },
  "validation_events": [ … ]
}
```

The response is a **capture** envelope: the built sensor `submission` (method,
url, body, headers) is returned without being sent to the origin, so you can
submit it yourself.

### Error responses

- **`400`** — validation failure (missing/malformed `url`, `profile`,
  `js_profile`, invalid `profile.id` format, malformed `script`, partial
  identity bundle, `js_profile` / `profile.id` conflict, invalid
  `readiness_state`, etc.). Body: `{ "success": false, "error": "..." }`.
- **`500`** — solve failed. Common `outcome` / `outcome_reason` pairs:
  - `"aborted"` / `"queue_full"` — solve queue at capacity
  - `"timeout"` / `"queue_wait_timeout"` — waited too long for a queue slot
  - `"timeout"` / `"deadline_exceeded"` — exceeded `timeout`
  - `"aborted"` / `"signal_aborted"` — client disconnected
  - not accepted after the sensor budget was exhausted (`abck` mode), or
    `maxSensors` not reached (`sbsd` mode)

## WebSocket session — `/akamai/session` {#websocket-session}

```
ws://host:3000/akamai/session
```

For browser-automation setups where you want the target's own browser
context (real TLS stack, real cookie jar) to make each sensor request,
rather than having the solver make it server-side.

### Protocol

**1. Client sends `init`**

```jsonc
{
  "type": "init",
  "url": "https://target.com/page",       // page URL where the challenge was captured
  "scriptUrl": "https://target.com/...",   // Akamai challenge script URL
  "script": "<full script source>",        // Akamai JS source code
  "html": "<sanitized page HTML>",         // page HTML, scripts stripped
  "cookies": { "_abck": "...", "...": "..." },
  "proxy": "http://user:pass@host:port",   // optional, "none" if not used
  "profileId": "chrome-146-macos",         // required
  "interaction": "emitter",                // optional, "emitter" (default) or "passive"
  "subresources": []                       // optional, the page's own scripts: see below
}
```

Required: `type`, `url`, `script`, `html`, `profileId`.

`interaction` is the same field as on `/akamai/solve`, with the same rules.
`subresources` has the shape and rules described for
[SBSD](/api-akamai-sbsd#running-the-page-s-own-scripts): you fetch the page's
scripts and pass them in, and the session runs them. `POST /akamai/solve` does
not accept it. A bad `subresources` list is answered with an `error` message
(carrying its `code`) and the socket is closed with `1008`. A bad `interaction`
value is answered with an `error` message too, but the socket stays open so you
can send a corrected `init`.

**2. Server sends `submission`** (one per sensor round)

```jsonc
{
  "type": "submission",
  "id": "sub-1",          // echo this back
  "method": "POST",
  "url": "https://target.com/...",
  "body": "sensor_data=...",
  "headers": { "Content-Type": "..." }
}
```

Relay this as a real XHR/fetch through the browser.

**3. Client sends `submission_response`**

```jsonc
{
  "type": "submission_response",
  "id": "sub-1",           // matches the submission ID
  "status": 200,
  "body": "<response body>",
  "cookies": { "_abck": "...", "...": "..." }
}
```

**4. Server sends `cookie_update` and `status` after each round**

```jsonc
{ "type": "cookie_update", "cookies": { "_abck": "..." }, "round": 1, "rval": 2, "accepted": false }
{ "type": "status", "state": "running", "round": 1 }
```

**5. Success** — when `_abck` is accepted:

```jsonc
{ "type": "cookie_update", "cookies": { "_abck": "..." }, "accepted": true }
{ "type": "status", "state": "accepted" }
```

Close the socket and continue browsing with the now-valid cookies.

**6. Errors**

```jsonc
{ "type": "error", "message": "..." }
```

### Session limits

- **Session TTL**: 5 minutes of inactivity. Each `submission_response`
  resets the timer.
- **Submission timeout**: each `submission` must get a
  `submission_response` within 30 seconds, or it times out.
