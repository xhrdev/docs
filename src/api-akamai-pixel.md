# Akamai Pixel API Reference

The pixel collector is Akamai's third script. Alongside the
[`_abck` sensor](/api-akamai-sensor) and the [SBSD bundle](/api-akamai-sbsd), a
property can inject a small deferred script into the page, and that script POSTs
one form-encoded body back to the origin. The response re-issues `ak_bmsc`.

`POST /akamai/pixel/generate` runs that script for you and returns **the POST it
would have sent**. You send it yourself.

> All providers are described in one machine-readable spec:
> [download openapi.yml](/openapi.yml) · [browse interactively](https://docs.xhr.dev/api.html).

::: info Authentication
None. The container is licence-gated at startup, not per-request — there's no
API key on this endpoint. The boundary is the network you run it on. See
[Authentication](/integrate#authentication).
:::

## Is this the channel you need?

Look at the document. Akamai injects an inline script, immediately followed by a
deferred one served from the property's own origin:

```html
<script>…="1234567890"</script>
<script src="/akam/13/6f2b9c1d" defer></script>
```

If you see an `/akam/<n>/<hex>` script, the property runs the pixel collector.
It is independent of the other two channels and is commonly present alongside
them.

## How it works

Like [SBSD](/api-akamai-sbsd) and [DataDome](/api-datadome), this is a single
request and a **browser bridge**: the solver computes the body, and your client
sends it, on its own connection, through its own cookie jar.

1. Fetch the document and keep its HTML.
2. Fetch the collector script from the `src` the document names.
3. `POST /akamai/pixel/generate` with both.
4. Send the returned `request` — method, URL, body, `Content-Type` — through the
   same session that fetched the page.
5. Keep the `ak_bmsc` cookie the response sets, in that same jar.

::: warning The solver sends nothing
There is no `proxy` field. The request is **not** sent to the origin from the
container; it is returned to you. That is also why it has to travel through your
own cookie jar: the cookie it earns belongs to your session.
:::

## `POST /akamai/pixel/generate`

### Request body

```json
{
  "document": {
    "url": "https://www.example.com/checkout",
    "html": "<the document as served>",
    "cookieHeader": "ak_bmsc=…; bm_sz=…"
  },
  "script": {
    "url": "https://www.example.com/akam/13/6f2b9c1d",
    "source": "<the collector as served>"
  },
  "profile": { "id": "chrome-151-macos" }
}
```

| Field | Type | Notes |
|---|---|---|
| `document.url` | string | The document's URL. Absolute `https`. Max 8 KiB. |
| `document.html` | string | The document as served. Max 8 MiB. |
| `document.cookieHeader` | string | Optional. `document.cookie` — the JavaScript-visible jar, not the HTTP header. Max 64 KiB. |
| `script.url` | string | The collector's **absolute** URL, as the document names it. Absolute `https`, **on the document's own origin**. |
| `script.source` | string | The collector as served. Max 2 MiB. |
| `profile.id` | string | `chrome-<version>-<os>`, registered on the container. |
| `seed` | string | Optional. Max 256 bytes. Send the same value across requests that describe one device. |

`script.url` has to be a script the document actually loads. A document with no
`<script>` element for that URL is refused (`script-not-in-document`).

### Response `200`

```json
{
  "ok": true,
  "request": {
    "method": "POST",
    "url": "https://www.example.com/akam/13/pixel_6f2b9c1d",
    "contentType": "application/x-www-form-urlencoded",
    "body": "…"
  },
  "receipt": {
    "profileId": "chrome-151-macos",
    "atMs": 812,
    "scriptsRun": 2,
    "faults": { "total": 0, "errors": 0, "rejections": 0, "unattributed": 0, "first": null }
  }
}
```

| Field | Meaning |
|---|---|
| `request` | What to send: `method`, `url`, `contentType` (`null` when the script set none) and `body`. Send it as given. |
| `receipt.profileId` | The profile the body was produced under. |
| `receipt.atMs` | How long, in milliseconds, the collector took to produce it. |
| `receipt.scriptsRun` | How many of the document's scripts executed. |
| `receipt.faults` | Counts of script errors seen while it ran, with the first one described. A non-zero count on an otherwise good response is worth logging. |

The collector deliberately waits a fraction of a second before it sends, so
expect `atMs` in the high hundreds of milliseconds rather than tens.

### Errors

Every failure is `{ "ok": false, "error": { "code", "message" } }`.

| Status | `error.code` | Meaning |
|---|---|---|
| `400` | `pixel_*` | Your request didn't satisfy the contract. `message` names the field. The codes are `pixel_body_not_object`, `pixel_document_invalid`, `pixel_document_url_invalid`, `pixel_document_html_invalid`, `pixel_document_cookie_invalid`, `pixel_script_invalid`, `pixel_script_url_invalid`, `pixel_script_cross_origin`, `pixel_script_source_invalid`, `pixel_profile_invalid`, `pixel_seed_invalid`. |
| `422` | `script-not-in-document` | No `<script>` in `document.html` loads `script.url`. |
| `422` | `no-request` | The collector ran but produced no request. |
| `429` | `queue-full` | The solve queue is at capacity. `Retry-After: 1`. |
| `503` | `generation-unavailable` | Capacity didn't free up before the deadline. `Retry-After: 1`. |
| `504` | `generation-timeout` | The collector didn't finish in time. |
| `507` | `generation-memory-limit` | The collector exceeded its memory allowance. |
| `500` | `generation-failed` | The collector could not be run. |

A `422` may carry `receipt.faults` describing script errors seen before it gave
up.

`429` and `503` mean the container is saturated, as for the other Akamai
endpoints: see [solve admission](/api-akamai#solve-admission).

## Limits

| | |
|---|---|
| Request body | 16 MB (app-wide) |
| `document.html` | 8 MiB |
| `script.source` | 2 MiB |
| `document.cookieHeader` | 64 KiB |
| URLs | 8 KiB each |
| Per-request deadline | 15 s, including any wait in the queue |

## See also

- [Akamai overview](/api-akamai) · [Sensor](/api-akamai-sensor) · [SBSD](/api-akamai-sbsd)
- [How to integrate](/integrate)
