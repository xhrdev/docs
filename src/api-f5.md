# F5 / Shape API Reference

Solves F5/Shape challenges. The endpoint is mounted under `/f5`
(`http://host:3000/f5/...`).

Like DataDome and unlike Akamai's sensor channel, F5 solving is **single-shot
HTTP** — one request, one answer, no WebSocket session.

> All providers are described in one machine-readable spec:
> [download openapi.yml](/openapi.yml) · [browse interactively](https://docs.xhr.dev/api.html).

`POST /f5/solve` takes the two script bodies the protected page served you and
a description of the request you want decorated, and returns the **header bag
the VM set on that request**. You then send the request yourself, with those
headers on it.

::: info Authentication
None. The container is licence-gated at startup, not per-request — there's no
API key on this endpoint. The boundary is the network you run it on. See
[Authentication](/integrate#authentication).
:::

::: warning The solver makes no outbound request
There is no `proxy` field on this endpoint, and that is not an omission. A
solve fetches nothing: the launcher body, the VM body and the token body
all have to arrive in the request body, and the result is a
record of headers rather than a sent request.

So the proxy that matters is the one **you** use. Fetch the page, fetch the VM
script, and send the decorated request through one pinned session.
:::

## `POST /f5/solve`

### Request body

Field names are snake_case.

| Field | Type | Required |
|---|---|---|
| `page_url` | absolute `http(s)` URL | yes |
| `launcher_body` | base64 — the launcher served inline from `page_url` | yes |
| `vm_url` | absolute `http(s)` URL the VM body was served from | yes |
| `vm_body` | base64 — the VM script body | no — omit it when one body is both launcher and VM, see [below](#what-you-have-to-capture-yourself) |
| `request_url` | absolute `http(s)` URL — the request to decorate | yes |
| `request_method` | HTTP method token, e.g. `POST` | yes |
| `request_body` | string, verbatim — **not** base64 | no — absent means `""` |
| `profile_id` | string | no |
| `js_profile` | `JsProfilePayload` | no |
| `timeout` | integer ms, `1`–`120000` | no — default `20000` |
| `snapshot_points_ms` | array of integer ms offsets, max 8 | no — see [Series](#asking-for-a-series) |
| `token_url` | absolute `http(s)` URL | yes — see [Supplying a token](#supplying-a-token) |
| `token_body` | base64 of the response body for `token_url`, non-empty | yes |

A minimal request:

```json
{
  "page_url": "https://www.example.com/checkout",
  "launcher_body": "<base64 of the inline launcher>",
  "vm_url": "https://www.example.com/assets/vm.js",
  "vm_body": "<base64 of the VM script>",
  "request_url": "https://www.example.com/api/order",
  "request_method": "POST",
  "request_body": "{\"sku\":\"A1\"}",
  "token_url": "https://www.example.com/api/session?id=…",
  "token_body": "<base64 of the response body>",
  "profile_id": "chrome-151-macos"
}
```

#### What you have to capture yourself

The solver has no HTTP client, so everything it reads comes from you:

1. Load the protected page and keep the **inline launcher** it serves →
   `launcher_body`.
2. Follow the script the launcher pulls and keep its body → `vm_body`, and the
   URL it came from → `vm_url`.
3. Decide which request you want decorated — the one the site's own script
   would have put the headers on → `request_url`, `request_method`,
   `request_body`.

4. Make the request the VM makes for its session token, and keep the response
   body → `token_body`, and the URL → `token_url`. See
   [Supplying a token](#supplying-a-token).

If the deployment serves **one** body that acts as both launcher and VM, send it
once, as `launcher_body`, and leave `vm_body` out. Absent means fused. (Sending
the same base64 in both fields is still understood.)

#### Two encoding rules that bite

`launcher_body`, `vm_body` and `token_body` are **canonical base64** and are
checked by round-trip, not by a character class. base64url, unpadded input, or
anything with stray characters is refused by name with a `400` rather than
silently decoded to a truncated prefix — a short VM body would otherwise
compile and fail as an ordinary `SyntaxError` naming nothing.

`request_body` is **not** base64 — it reaches the VM exactly as you send it.
Leave it out, or send `""`, for a request with no body; `request_method` already
says whether one is expected.

### Response

```json
{
  "correlationId": "a1b2c3d4",
  "headers": {
    "x-abcd-a": "...",
    "x-abcd-b": "...",
    "x-abcd-c": "...",
    "x-abcd-d": "...",
    "x-abcd-f": "...",
    "x-abcd-z": "..."
  },
  "letters": ["a", "b", "c", "d", "f", "z"],
  "prefix": "x-abcd",
  "scope": "session",
  "tokenSupply": "delivered"
}
```

| Field | Meaning |
|---|---|
| `headers` | Header name → value, spelled exactly as the VM spelled the name. Copy them onto your request verbatim. |
| `letters` | Which of the six attested letters (`a`,`b`,`c`,`d`,`f`,`z`) this solve produced. A short list is a real answer, not an error. |
| `prefix` | The family prefix as this deployment spells it, with no assumed `x-`. `null` when the VM set no attested header at all. |
| `scope` | `session` or `target` — see [Retrying](#retrying). |
| `tokenSupply` | `delivered` or `unmatched` — see [Supplying a token](#supplying-a-token). |
| `correlationId` | Quote this in a support ticket; it ties your response to the server-side log. |
| `payloads` | Present only when you asked for a series. |
| `series_checks` | Present only when you asked for a series. |
| `series_observer_cost` | Present only when you asked for a series. |

The prefix and header names above are illustrative — read them off `prefix` and
the keys of `headers` rather than hard-coding them, because they vary by
deployment.

::: tip A partial answer is still an answer
The contract is that every letter is either produced with a value the VM set,
or refused with a named reason — never invented. Six headers of which two were
composed by us would be worse than four honest ones, so a solve that returns
four returns four.
:::

## Supplying a token

F5 deployments have the VM fetch a server-issued value mid-collection and echo
it into its payload. The solver can't make that request, so you make it
yourself and hand over the response. Both fields are **required**:

```json
{
  "token_url": "https://www.example.com/api/session?id=…",
  "token_body": "<base64 of the response body>"
}
```

A solve without a token would put a placeholder where a real session carries
the value, so it is refused with `400` rather than run. `token_body` must be
non-empty, decode to UTF-8 and be at most **64 KiB**.

::: info Only the origin and pathname of `token_url` are used
The query string carries your session's identity. It's discarded at the API
boundary and reaches neither the solve nor the log. The URL is parsed for a
string comparison and is **never dereferenced** — nothing fetches it.

That's also why matching is on origin + pathname: a whole-URL match would find
nothing, since our URL and your browser's differ in the query by construction.
:::

#### Read `tokenSupply`

The response tells you whether your body was used:

- `delivered` — the VM requested that origin + pathname and was given your body.
- `unmatched` — the VM never requested it. Your `token_url` is wrong, or this
  deployment doesn't make that request; the solve ran without your body.

Treat `unmatched` as a failed integration, not a result. Without this field a
wrong `token_url` produces a completely ordinary-looking solve and you'd have no
way to learn the parameter did nothing.

::: warning Tokens are per-session
A token body issued to one session is not a neutral input to another. Fetch it
in the same session as the page, the launcher and the VM, and send the request
you decorate through that session too.
:::

## Asking for a series

`snapshot_points_ms` fires the decorated request once at each wall-ms offset,
**inside one run**, and returns one payload per point in `payloads`:

```json
{ "snapshot_points_ms": [0, 150, 400] }
```

Rules the validator enforces:

- 1–8 points.
- Non-negative integers, **strictly increasing**. Two equal points name one
  place in the run; that's refused here rather than driven and refused after.
- The last point must be **less than** `timeout`, since the run waits it out in
  wall time. Otherwise you'd get a timeout, which reads as a slow subject
  rather than an unsatisfiable request.

Each entry of `payloads` carries the headers for that emission plus where in
the run it came from:

| Field | Meaning |
|---|---|
| `index` | Fire order, 0-based. Not an ordinal the VM knows about. |
| `headers`, `letters`, `prefix` | As the top level, but for this emission. |
| `requested_at_ms` | The offset you asked for. |
| `observed_at_ms` | Wall-ms at which it actually fired. |
| `subject_handler_calls` | **Order and compare on this.** |
| `observed_handler_calls` | The raw progress reading at this emission. |
| `handler_calls_after_emit` | The reading immediately after it returned. |
| `displaced_handler_calls` | How much of this point's reading was spent by the series' own earlier emissions. `0` on `payloads[0]`. |

::: warning Asking for more points moves the later ones
Every emission is synchronous and costs the run real progress, so points are
not free samples — they slow the subject down, measurably. A dense series
reaches a given wall-ms offset with the subject *further behind* than a sparse
one does, and the payload at that offset is correspondingly less complete.

`displaced_handler_calls` per point and `series_observer_cost` for the whole
series exist so you can see it happening. Ask for the fewest points that answer
your question — three or four is a normal ask.

This is also why `subject_handler_calls`, not `observed_handler_calls`, is the
field to order on: the raw reading counts our own emissions as well as the
subject's work, so across differently shaped series it can invert. The two
agree only on `payloads[0]`.
:::

::: info There is no "give me payload #2"
The VM carries no emission ordinal — a payload exists only because a request
was decorated — so the only thing that can be asked for is "fire again at T",
and the only honest answer is "here's what came out, and here's where it
landed".

And all the points come from **one run**, which is why they arrive together.
One index per call would mean a fresh run per call, and pasting three such
answers together would look like a session and would not be one.
:::

When a series was requested, the top-level `headers` and `letters` **are**
`payloads[0]`. They are not a separate solve, and they are not what a
no-series request would have returned. Send `payloads` in order and ignore the
top-level bag.

`series_checks` lists which cross-snapshot checks ran, so "checked and held" is
never confused with "never checked". A `200` with the field present means every
check listed passed; a series that failed one is a failed solve and answers
with an error. The verdicts themselves aren't on the wire.

## Errors

Every failure carries a stable `code` you can branch on, plus `correlationId`.

```json
{
  "code": "f5.solve.failed",
  "error": "F5 solve error",
  "correlationId": "a1b2c3d4",
  "scope": "session"
}
```

| Code | Status | Meaning |
|---|---|---|
| `f5.request.invalid` | `400` | Your request didn't satisfy the parameter contract. `error` names the field. |
| `f5.solve.timeout` | `500` | The solve didn't finish inside `timeout`. Retryable. |
| `f5.solve.failed` | `500` | No usable headers. Check `scope`. |

`f5.request.invalid` is the only code whose `error` text is specific — it
describes **your** request, which is the only thing you can act on. Every other
code carries static text; the cause is in the server log under
`correlationId`. Don't parse the prose or branch on it, and don't expect the
solver's internal reasoning on the wire — ask an operator to pull the log line.

### Retrying

`scope` appears on `f5.solve.failed` and answers one question: can a later
attempt change this?

- **`session`** — no. Stop; don't loop. This is also the default when no scope
  was measured, because failing closed costs one attempt rather than an
  infinite retry.
- **`target`** — the refusal is about the request you asked to decorate. A
  different request may succeed.

## Limits

| | |
|---|---|
| Request body | 16 MB (app-wide) |
| `timeout` | `1`–`120000` ms, default `20000` |
| `snapshot_points_ms` | at most 8 points |
| `token_body` | at most 64 KiB decoded |

The default timeout is a safety net, not a pacing mechanism — a solve runs to
quiescence on its own and normally finishes well inside it. A ~317 KB VM body
is ~423 KB once base64'd, comfortably inside the body limit.

## See also

- [How to integrate](/integrate) · [Via the API](/integrate-api)
- [Akamai](/api-akamai) · [DataDome](/api-datadome)
