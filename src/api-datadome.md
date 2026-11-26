# DataDome API Reference

Solves DataDome captcha (`rt: "c"`) and interstitial (`rt: "i"`) challenges.
Both endpoints are mounted under `/dd` (`http://host:3000/dd/...`).

Unlike Akamai, DataDome solving is **single-shot HTTP** — there's no
WebSocket session. Each request fully resolves one challenge and returns.

> Both `/akamai` and `/dd` are described in one machine-readable spec:
> [download openapi.yml](/openapi.yml) · [browse interactively](https://docs.xhrdev.com/api.html).

`POST /dd/solve` takes a DataDome challenge payload (the `dd` object) and
cookie that you've already extracted from the target site, and returns
either a prepared submission or the solved clearance cookie. See
[Via HTTP (Node, Python)](/integrate-http-clients) for the full request-by-request
flow.

Every error response carries a stable `code`, a `correlationId`, and an
`error` string. Branch on `code` — see [Error responses](#error-responses).

::: info Authentication
None. The container is licence-gated at startup, not per-request — there's no
API key on this endpoint. The boundary is the network you run it on. See
[Authentication](/integrate#authentication).
:::

## `POST /dd/solve`

### Request body

| Field | Type | Required |
|---|---|---|
| `url` | absolute `http(s)` URL | yes |
| `dd` | `DDChallenge` (see below) | yes |
| `ddCookie` | string — the `datadome` cookie value | yes |
| `profile` | `ProfileSnapshot` | yes |
| `js_profile` | `JsProfilePayload` | yes |
| `proxy` | string | no — **ignored, see below** |
| `os` | `'ubuntu'\|'windows'\|'windows10'\|'windows11'\|'macos'` | no — otherwise derived from `js_profile.os` / `profile.os` |
| `script_id` | string | no |
| `timeout` | integer ms, `1`–`120000` | no — default `20000` (captcha) / `8000` (interstitial) |
| `iframeData` | `{ html, url, captchaLayout?, stylesheetAssets?, externalScripts?, finalNavigationResponseBodySizes? }` | **yes** — you fetch the challenge document; the solver cannot |
| `spider` | string | no |

`js_profile.battery` is optional — send all four fields (`charging`,
`chargingTime`, `dischargingTime`, `level`) or omit the object entirely, since
a partial battery reading isn't useful. `chargingTime` / `dischargingTime` are
`null` for `Infinity`, matching the browser API they mirror.

`iframeData.externalScripts` is **required for new-style challenge
documents**, which load the challenge logic from a separate script instead of
inlining it — the solver has no way to fetch it itself. Each entry is
`{ url, body }`: `url` must be an `https` URL on `captcha-delivery.com`, `body`
is the script as fetched, and there's a limit of 4 entries at up to 4 MiB
each. A new-style document without this fails `dd.script.missing`. Find the
script tags the same way you'd find stylesheets — they're `<script src="…">`
elements pointing at `captcha-delivery.com` in the challenge document — fetch
each one over the same proxy session and hand over the body.

`DDChallenge` (`dd`):

```json
{
  "cid": "string",
  "hsh": "string",
  "rt": "c",
  "s": 1,
  "ir": 12345,
  "t": "fe",
  "b": 1,
  "e": "..."
}
```

`rt` must be `"c"` (captcha) or `"i"` (interstitial) — anything else returns
`400 dd.task.unsupported`. `t: "bv"` returns `422 dd.ip.banned`.

::: warning `proxy` is accepted and not used
The field is still in the schema, and sending it changes nothing. A solve
makes **no outbound request**: everything it reads has to arrive in this
request body, which is why `iframeData` exists and why the response is a
prepared submission rather than a cookie.

Verified two ways. Sending `proxy: "http://127.0.0.1:1"` — an address nothing
can dial — alongside an otherwise valid body returns `200` and a prepared
submission identical to one sent with no `proxy` at all. And omitting
`iframeData` returns `400 "You must provide the 'iframeData' parameter"`
rather than the solver going and fetching the document itself.

So the proxy that matters is the one **you** use, for the requests you make:
the blocked request, the challenge document, and the submission. Pin that
session and send all three through it.
:::

### Success response `200`

A **prepared submission** — a request for you to make:

```json
{
  "body": "<solved payload string>",
  "origin": "https://geo.captcha-delivery.com",
  "referer": "<iframe url>",
  "url": "<submit url>"
}
```

| Field | Notes |
|---|---|
| `body` | **optional** — present for an interstitial (`rt: "i"`), absent for a captcha (`rt: "c"`), whose payload is already in the `url` query string |
| `origin` | always `https://geo.captcha-delivery.com`; anything else means the protocol moved and is worth failing on |
| `referer` | the challenge document URL — send it as the `Referer` header |
| `url` | where to send it |

Send it yourself, over the same proxy session you intend to browse from.
Captcha solves carry their payload in the query string (send `GET`);
interstitials post a body (send `POST`) — branch on whether `body` is present.
DataDome answers with the clearance cookie.

::: info Why the solver doesn't submit for you
DataDome binds the clearance cookie to **whichever IP submitted it**, and
checks that client's TLS fingerprint. If the container submitted on your
behalf, the cookie it earned would be valid for the container and void from
wherever your scraper actually runs — a fresh 403 on your very next request,
looking exactly like a failed solve.

So the solver always returns the submission rather than sending it. There's no
`submit` option to get this wrong.
:::

### Error responses

Every failure carries a stable `code` you can branch on, plus a
`correlationId` that ties it to the server-side log line.

```json
{
  "code": "dd.solve.failed",
  "error": "DD solve error",
  "correlationId": "a1b2c3d4"
}
```

| Code | Status | Meaning |
|---|---|---|
| `dd.request.invalid` | `400` | Your request didn't satisfy the parameter contract. `error` names the field. |
| `dd.task.unsupported` | `400` | A well-formed request for a challenge type this solver doesn't run — an `rt` that is neither `"c"` nor `"i"`. |
| `dd.ip.banned` | `422` | The challenge carries `t: "bv"`. Rotate to a different exit IP; there's nothing to solve. |
| `dd.script.missing` | `422` | The challenge document is new-style and needs `iframeData.externalScripts`, which wasn't sent (or didn't include the script the document references). |
| `dd.script.unsupported` | `422` | The challenge document loads an external script this solver can't run — anything other than a classic `defer` script on `captcha-delivery.com`. Supplying more scripts doesn't help. |
| `dd.solve.timeout` | `500` | The solve didn't finish inside `timeout`. Retryable. |
| `dd.solve.failed` | `500` | The solve failed. The cause is in the server log under `correlationId`. |

`dd.request.invalid` is the only code whose `error` text is specific — it
describes **your** request, which is the only thing you can act on. Its checks
include: missing `url` / `dd` / `ddCookie` / `profile` / `js_profile`; `dd`
shape (`cid`/`hsh` non-empty strings, `s` a finite number); `url` must be
`http(s)`; `timeout` out of range; and for `iframeData` with `rt: "c"`, an
iframe URL that must be the canonical
`https://geo.captcha-delivery.com/captcha/` URL with matching `cid` / `hash` /
`s` / `ir` query params.

::: warning Don't parse the prose
Every other code carries **static** text chosen by the code — never an
exception message. A solve failure is `"DD solve error"` whatever went wrong,
and a timeout is `"DD solve timed out"`; the cause lives server-side under
`correlationId`, so quote that in a support ticket rather than screen-scraping
the string.

The one text worth matching is `dd.ip.banned`'s `"IP is banned"`, which is kept
byte-identical to what shipped before codes existed. If you match it today,
keep working — but move to `code` when you can.
:::
