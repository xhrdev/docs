# Akamai SBSD API Reference

SBSD is Akamai's second scoring channel. A property that uses it serves a
bundle script, and that bundle POSTs its own bodies back to the path it was
served from — separately from, and in addition to, the
[`_abck` sensor](/api-akamai-sensor). Where the bundle lives varies by
property; see [finding the bundle](#finding-the-bundle).

> Both `/akamai` and `/dd` are described in one machine-readable spec:
> [download openapi.yml](/openapi.yml) · [browse interactively](https://docs.xhrdev.com/api.html).

## How it differs from the sensor channel

The sensor channel is a conversation. SBSD is a single request:

| | Sensor (`_abck`) | SBSD |
|---|---|---|
| Transport | WebSocket, `/akamai/session` | One POST, `/akamai/sbsd/generate-session` |
| Shape | Rounds until the cookie is accepted | A ledger of bodies, issued once |
| Bound to | The origin | **One document**, for five minutes |
| Your job | Relay each submission through the browser | Rewrite the page's own carrier POSTs |

You do not send anything new. The page already POSTs to the bundle's own path;
your integration intercepts those requests and swaps the body for the next row
of the ledger. Ordering is FIFO and is not negotiable.

## Finding the bundle

Some properties serve the bundle from `/.well-known/sbsd`. Many do not — the
common alternative is an obfuscated per-property path, sitting alongside the
`_abck` sensor script under the same random-looking prefix, with nothing in
either path naming the channel:

```
/78jHEHB-.../6LncB                       the _abck sensor
/.well-known/sbsd/953343??v=<uuid>       the SBSD bundle

/bJ21n/.../fQUZPAE/Q01H/JFVIT0YB         the _abck sensor
/bJ21n/.../K0ciPAE/NQdp/VyRmPU8Y?v=<uuid>   the SBSD bundle
```

So detect the bundle rather than assuming a path. What identifies it, wherever
it is served from, is the UUID `v=` on its `src` — that value seeds the
bundle's codec rather than versioning a file, so an ordinary `?v=3.5.6`
cache-buster does not look like it. The carrier POSTs then go to that same
pathname, usually with a different query string or none at all.

Two consequences worth planning for:

- **A site that looks unprotected at its apex may not be.** Region choosers and
  marketing shells are frequently unprotected in front of a protected
  application. Detect on the document you actually want.
- **`bundle.scriptSrc` is the raw `src`, query included.** Reconstructing a
  tidy URL and dropping the `?v=` produces a ledger the page cannot use.

## `POST /akamai/sbsd/generate-session`

Issues a ledger for the document described in the request.

### Request body

State what the server cannot derive. Everything else has a default computed
from the document and the profile in the same request, so a browser
integration's body is short:

```json
{
  "bundle": {
    "scriptSrc": "/.well-known/sbsd?v=6c1f0a52-3a51-4f0e-9c8d-1d0a3b7f9e42",
    "source": "<the bundle source as served>"
  },
  "document": {
    "url": "https://www.hilton.com/en/",
    "html": "<the document as served>",
    "cookieHeader": "bm_s=YAAQ...; bm_so=...",
    "runtime": { "sessionStorage": { "akBmTabId": "murv5og0k2rq7t1c" } }
  },
  "profile": { "id": "chrome-151-macos" }
}
```

That is a complete request. **No key outside the shapes described here is
accepted** — an unknown one is a `400` rather than being ignored.

| Field | Type | Notes |
|---|---|---|
| `bundle.scriptSrc` | string | The raw `src` attribute, query string included — the `?v=` is not decoration. Must resolve to the document's own HTTPS origin and carry a pathname. Max 8 KiB. |
| `bundle.source` | string | The bundle source as served. Max 2 MiB. |
| `document.url` | string | The live document's URL. HTTPS, no credentials, no fragment. |
| `document.html` | string | The document as served. |
| `document.cookieHeader` | string | `document.cookie` — despite the name, the JavaScript-visible jar, not the HTTP header. Omit it on a first visit that has none. |
| `document.runtime.sessionStorage.akBmTabId` | string \| `null` | `sessionStorage.ak_bm_tab_id`, exactly as the page holds it. `null` or absent asks the server to mint one. See [below](#akbmtabid-is-the-one-reading-you-have-to-take). |
| `profile.id` | string | `chrome-<version>-<os>`, and registered on the container. |
| `inputSchedule` | `"mixed"` \| `"pointer-only"` \| `"none"` | Optional. Which synthetic input the generation drives. Default `mixed`. See [Input schedule](#input-schedule). |
| `subresources` | array | Optional. The page's own scripts, fetched by you. See [Running the page's own scripts](#running-the-page-s-own-scripts). |

`document.html` has no size cap of its own. The whole request is bounded at
16 MB, and that is checked before the request takes a queue slot — a 2.7 MB
search results page is fine.

#### `akBmTabId` is the one reading you have to take

It is the only member of `document.runtime` a default cannot stand in for. With
none supplied the server mints an id, and it mints a fresh one per request — so
a session that generates more than one ledger describes a different tab each
time, while the real page holds a single id for its whole lifetime. Read it off
the page and send it.

It only exists once the bundle has run, which is why
[the first carrier has to be held](#hold-the-first-carrier).

Send the value the page holds, untouched. The id has a fixed shape — the time it
was minted, in eight base36 digits, followed by a base36 fraction — and the
server refuses one that doesn't look like something the bundle would produce: a
made-up string, an all-digit id, or one whose time is in the future is a `400`.
When you have none, send `null` or leave the field out rather than inventing
one.

#### What the server fills in

Send any of these to override the default; send none of them and you get a
value derived from the document and profile you did send.

| Field | Default |
|---|---|
| `schema` | `"akamai-sbsd-ledger-request/v3"` — the only accepted value |
| `document.epochMs` | One second before arrival. Send `performance.timeOrigin`, rounded, if you tracked it. |
| `document.resourceEntries` | The buffer this document's own subresources would produce. Max 2048 entries and 2 MiB serialized. |
| `document.runtime.connectionInfo` | A `navigator.connection` reading for the profile |
| `document.runtime.memoryInfo` | A `performance.memory` reading for the profile |
| `document.runtime.speechSynthesisVoices` | The profile's local voice counts |
| `document.runtime.functionToString` | Pristine native `Function.prototype.toString` |
| `document.runtime.historyLength` | `1` |
| `document.runtime.domResourceInventory` | Extracted from `document.html` — see below |
| `profile.chromeFullVersion` | The version the named profile declares. Still validated when sent, so an out-of-date caller is told rather than ignored. |
| `profile.overrides` | The identity the stored profile declares |

::: tip Leave `domResourceInventory` out
Supplying it is what asks the sandbox to reconcile the DOM against your list.
For a browser caller the HTML you sent *is* the DOM, so that reconciliation is
an identity operation: it costs a parse and a diff and changes nothing. Send it
only if your `html` is not the document the page is actually running.
:::

#### If you send more than the minimum

Readings are compared against each other, so take them in **one** `evaluate`
call — spread across three round-trips they describe a page that never existed.
A partial `document.runtime` is fine: members resolve individually, so sending
`memoryInfo` does not oblige you to send the other six.

`functionToString` is `Function.prototype.toString` as the page sees it,
stringified through a pristine child realm so a wrapper on the page cannot
describe itself as native.

`profile.overrides` carries `deviceMemory`, `hardwareConcurrency`, `languages`,
`screen`, `timezone` and `timezoneOffsetMinutes`.

::: warning If you send `profile.overrides`, declare the identity — don't measure it
You usually do not need it. Naming a `profile.id` implies the identity that
profile declares, which is the same one the sensor channel uses. Send overrides
only to claim something different, and then send declared values.

Playwright's `Emulation.setDeviceMetricsOverride` leaves `screen.availLeft` and
`screen.availTop` at `0`, and `availHeight` equal to `height`. On macOS that is
impossible: the menu bar is always there. A payload built from those readings
describes a browser that cannot exist, and nothing errors — `_abck` simply
never leaves `~-1~`, which is the same symptom as a dozen unrelated causes.
:::

#### Input schedule

The generation drives synthetic input into the page before it answers.
`inputSchedule` picks which:

| Value | Meaning |
|---|---|
| `mixed` | The default. |
| `pointer-only` | The same, without keystrokes. |
| `none` | No input. Refused with `422` and `error.code` `input-schedule-incomplete` **unless you also send `subresources`**: without input the bundle posts its fingerprint body and no input-stream body, so a ledger can't complete. |

Only you know whether the visit you are describing involved typing, so the
server doesn't infer it. An unrecognised value is a `400`, never a silent
fallback to the default.

#### Running the page's own scripts

By default the page's other scripts stay inert. Send `subresources` to have the
document's own scripts run instead:

```json
"subresources": [
  { "url": "https://www.example.com/static/app.js", "contentType": "application/javascript", "body": "…" }
]
```

You fetch them; the server never does. Every inline script runs, and every
external `<script src>` whose URL is in the list runs with the body you gave.
Any other URL answers `404`, never the network. **`[]` is not "nothing"** — it
turns the feature on with no external scripts served, so the document's inline
scripts still run.

| Rule | |
|---|---|
| `url` | Absolute `https`. Each URL once — two bodies for one URL is a `400`, not a pick. |
| `contentType`, `body` | Strings. |
| Stylesheets | Refused. |
| Count | At most 256 entries. |
| Size | At most 16 MiB of bodies in total. |
| Other keys | Not accepted on an entry. |

A list that fails any rule is refused whole, with a specific `error.code`:
`subresources_not_array`, `subresources_too_many`, `subresources_too_large`,
`subresource_invalid_entry`, `subresource_invalid_url`,
`subresource_invalid_content_type`, `subresource_invalid_body`,
`subresource_duplicate_url` or `subresource_css_refused`. When it is accepted,
`receipt.pageScripts` reports how many script errors the page raised and how many
of its requests were served versus unanswered.

The WebSocket session's `init` message takes the same field, with the same
rules.

### Success response `200`

```json
{
  "schema": "akamai-sbsd-ledger/v1",
  "complete": true,
  "ok": true,
  "expectedCap": 3,
  "ordering": "sensor-emission-fifo",
  "runNonce": "b6278f3f-8160-4df7-ab42-b2aeb3bce4c6",
  "ledgerId": "b6278f3f-8160-4df7-ab42-b2aeb3bce4c6",
  "generatedAtEpochMs": 1772376021395,
  "submissions": [
    {
      "index": 0,
      "body": "...",
      "bytes": 965,
      "method": "POST",
      "resolvedUrl": "https://www.hilton.com/.well-known/sbsd",
      "url": "/.well-known/sbsd",
      "sha256": "...",
      "surface": "xhr"
    }
  ],
  "binding": { "…": "digests of the inputs this ledger was computed from" },
  "receipt": { "…": "what the generator resolved for each surface" }
}
```

Send `submissions` in `index` order, one per carrier POST. `complete: true` is
the only ledger safe to use.

### Rows are capacity, not a promise

`expectedCap` says how many rows the ledger carries. The page emits as many
carriers as it emits. If it emits more than you have rows for, **fail closed** —
abort the extra request. Letting the native body through hands Akamai a payload
from an uninstrumented page alongside yours, which is worse than sending
nothing.

### The ledger is bound to one document

The bodies are computed from the snapshot you sent: that HTML, those cookies,
those resource timings, those runtime readings. They are not portable.
Replaying a ledger against a second document, a second tab or a later load is a
mismatch, and the server refuses a snapshot more than **five minutes** old (or
more than a short window in the future).

Generate per document, use in order, discard.

### Hold the first carrier

`document.runtime.sessionStorage.akBmTabId` only exists once the bundle has
run. So the carrier POST that triggers generation is also the one that has to
wait for it — hold it, generate, then release it with row 0 as its body.

If your page emits carriers concurrently, memoize the in-flight *promise* rather
than the result. Two carriers that each start a request produce two ledgers, the
second replaces the first, and the page ends up submitting row 0 of one snapshot
followed by rows 1–2 of another.

### Error responses

All non-`200` responses carry `complete: false` and an `error` object with a
`code` and a `message`.

- **`400`** — validation failure: a missing required field, an unknown key, a
  wrong `schema`, a bundle over its size cap, a `scriptSrc` that doesn't
  resolve to the document's origin, an `epochMs` outside the freshness window,
  a `chromeFullVersion` that disagrees with `profile.id`, runtime readings that
  contradict each other. A request over 16 MB is rejected before it reaches
  validation.
- **`422`** — the generator declined to produce a complete ledger for this
  snapshot. `receipt` and `observedCount` say what it could not reconcile; the
  usual answer is a snapshot taken before the bundle had run.
- **`500`** — the container's own configuration or a malformed internal result.
- **`503`** — the deadline expired while waiting for
  [queue capacity](/api-akamai#solve-admission).
- **`504`** — generation did not complete before the deadline.

## Running it without a browser

A browser is the normal integration and the one the
[worked example](#worked-example) shows, but it is no longer a requirement of
the endpoint. Nothing in the request needs a live realm any more: the readings
that used to — `performance.memory`, `navigator.connection`,
`speechSynthesis` — are all derived server-side now.

A browserless flow is four steps, and it has been measured working end to end:
fetch the document, fetch the bundle, ask for a ledger, then POST each
`submissions[i].body` to `submissions[i].resolvedUrl` yourself, in `index`
order. Omit `akBmTabId` — a page that never ran the bundle has none, and one
ledger's worth of carriers all share the id the server mints.

**The catch is the transport, not the channel.** You still have to get the
document, and a protected property will refuse a client whose TLS and HTTP/2
fingerprint is your HTTP library's — often with a `403` before any bundle is
served, so there is no challenge to solve. This works where your client is one
the property already accepts. If it is not, that is the problem to fix first,
and it is the same problem on every channel.

Lightpanda still cannot drive the browser flow, but no longer for a payload
reason: the rows have to reach the page's own carrier POSTs, which needs
request interception.

::: tip Headless is fine
The channel has no headed requirement. Individual properties do — some refuse
a headless Chrome outright, whatever the payloads look like — but that is a
target's policy, not this endpoint's.
:::

## Worked example

[`src/akamai/sbsd`](https://github.com/xhrdev/examples/blob/master/src/akamai/sbsd/README.md)
in the examples repo drives both channels against hilton.com, aa.com and
aircanada.com. hilton and aa run both channels — SBSD gates the first document
and the `_abck` sensor gates everything after it — while aircanada is scored on
SBSD alone.
