# Via the API

The lowest layer. Everything else on this site — the HTTP client examples, the
Playwright bridge, the SDK — is a wrapper over the endpoints below. If you're
integrating from a language we don't ship an example for, start here.

There's no SaaS endpoint and no account. Requests go to the container you're
running (see [Deployment](/deployment)), e.g. `http://localhost:3000`.

## The endpoints

| Endpoint | What it does |
|---|---|
| `GET /hc` | Health check — `{"status":"ok"}` |
| `GET /stats` | Solve counts and success rates, for your own monitoring |
| `POST /dd/solve` | Solve a DataDome captcha or interstitial → a prepared submission |
| `POST /akamai/solve` | Solve an Akamai sensor challenge from a URL |
| `WS /akamai/session` | Streaming Akamai session for browser-driven solving |
| `POST /f5/solve` | Solve an F5/Shape challenge → attested headers for one request |

Full contracts: [Akamai](/api-akamai) · [DataDome](/api-datadome) ·
[F5 / Shape](/api-f5) · [OpenAPI spec](/openapi.yml)
([browse](https://docs.xhr.dev/api.html)).

## Authentication

None. There's no API key, no token, and no account — the container is
licence-gated at startup, not per-request, so anything that can reach port 3000
can use it.

```bash
curl http://$host:3000/stats   # that's the whole thing
```

The boundary is the network. Run it on a host whose egress you control and
whose port 3000 only your own scrapers can reach — see
[Network posture](/on-prem#network-posture).

::: tip Why the examples send `x-api-key`
Scripts in [xhrdev/examples](https://github.com/xhrdev/examples) thread an
optional `solver_api_key` through as an `x-api-key` header. That's for the
**hosted trial box** we lend to prospects during an evaluation, which sits
behind a reverse proxy that checks the header before forwarding. Nothing in
the container itself reads it. Leave `solver_api_key` unset against your own
deployment and the examples send nothing.
:::

## The DataDome flow in curl

Four requests. Only step 3 touches your container; steps 1, 2 and 4 go to the
target and to DataDome, through your proxy.

```bash
target=https://www.seloger.com/
geo=https://geo.captcha-delivery.com
proxy=http://user-sessid-42:pass@proxy.example.com:8000   # session-pinned

# 1. Trip the challenge. DataDome answers 403 with an inline `var dd = {…}`.
#    It's single-quoted, so swap the quotes to make it JSON.
curl -sx "$proxy" -H "user-agent: $ua" "$target" >blocked.html
dd=$(sed -n "s/.*var dd=\({[^}]*}\).*/\1/p" blocked.html | tr "'" '"')
[ -n "$dd" ] || { echo 'no challenge to solve'; exit 0; }

# 2. Rebuild the URL DataDome's c.js would have requested, and fetch it.
#    `dd.cookie` — not `dd.cid` — is what goes in the `cid` parameter.
doc_url=$(jq -rn --argjson dd "$dd" --arg geo "$geo" --arg ref "$target" '
  ($dd.rt | if . == "c" then "/captcha/" else "/interstitial/" end) as $path
  | [ "initialCid=\($dd.cid|@uri)", "hash=\($dd.hsh|@uri)",
      "cid=\($dd.cookie|@uri)", "t=\($dd.t // "fe"|@uri)",
      "referer=\($ref|@uri)", "s=\($dd.s // 0)",
      (if $dd.e then "e=\($dd.e|@uri)" else empty end), "dm=cd" ]
  | $geo + $path + "?" + join("&")')
curl -sx "$proxy" -H "referer: $target" -H 'sec-fetch-dest: iframe' \
  "$doc_url" >document.html

# 3. Ask the solver to build the submission. Direct — not through the proxy.
#    --rawfile keeps half a megabyte of HTML off the command line.
jq -n --argjson dd "$dd" --arg url "$target" --arg docUrl "$doc_url" \
      --arg proxy "$proxy" --rawfile html document.html \
  '{ url: $url, proxy: $proxy, ddCookie: $dd.cookie,
     dd: { cid: $dd.cid, hsh: $dd.hsh, rt: $dd.rt, s: ($dd.s // 0) },
     iframeData: { html: $html, url: $docUrl },
     profile: { id: "chrome-149-macos", "…": "…" }, js_profile: { "…": "…" } }' \
  >solve.json

curl -s -X POST "http://$host:3000/dd/solve" \
  -H 'content-type: application/json' \
  ${solver_api_key:+-H "x-api-key: $solver_api_key"} \
  --data-binary @solve.json >prepared.json

# 4. Submit it YOURSELF, over the same pinned proxy session.
#    GET when `body` is absent (captcha), POST when present (interstitial).
curl -sx "$proxy" \
  -H "origin: $(jq -r .origin prepared.json)" \
  -H "referer: $(jq -r .referer prepared.json)" \
  -H 'content-type: application/x-www-form-urlencoded; charset=UTF-8' \
  "$(jq -r .url prepared.json)"
# {"cookie":"datadome=…; Max-Age=31536000; Domain=.seloger.com; …"}
```

The response is a full `Set-Cookie` string; split on `;` and keep the value.
Then replay step 1 with `cookie: datadome=<value>` and you get the real page.

A complete, runnable version of exactly this —
[`dev-resources/curl`](https://github.com/xhrdev/examples/blob/master/dev-resources/curl)
— lives in the examples repo. It is the clearest place to see the raw HTTP.

::: warning curl's TLS fingerprint is not Chrome's
This never stops the solve — the solver only ever sees the challenge you hand
it — but it changes what the *site* is willing to give you afterwards. Sites
vary: some serve curl the real page once it has a clearance cookie, some
re-challenge it immediately, and some refuse before there's anything to solve
(the challenge document comes back as a block page and the solver reports
`IP is banned`).

If a site rejects curl, that's the fingerprint talking, not the solver. Use a
real client, or a curl build that impersonates Chrome. See
[solving ≠ staying unblocked](/integrate#solving-is-not-the-same-as-staying-unblocked).
:::

## The Akamai flow in curl

Akamai's `POST /akamai/solve` is one call — hand it a URL and a profile and it
fetches the script and solves, returning the submission for you to send:

```bash
curl -X POST "http://$host:3000/akamai/solve" \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://target.example.com/login",
    "proxy": "'"$proxy"'",
    "profile": { "id": "chrome-146-macos", "…": "…" },
    "js_profile": { "…": "…" }
  }'
```

```json
{ "success": true, "mode": "abck", "submission": { "method": "POST", "url": "…", "body": "…", "request_headers": { "…": "…" } }, "…": "…" }
```

The response is the built sensor submission, **not sent** — you make that
request yourself from your own IP, the same property `/dd/solve` has. (The
legacy `submit` field is ignored; the solver never submits.)

The stateful [WebSocket session](/api-akamai-sensor#websocket-session)
is the other option, and it's what you want when a real browser is driving.

## Backpressure

Each container admits 8 concurrent solves with a queue depth of 32 and a 10s
max queue wait. Past that, solves fail with `outcome_reason: "queue_full"` or
`"queue_wait_timeout"` (both `500`). Treat either as the signal to scale out
horizontally — run more containers behind a load balancer.

## Monitoring

`GET /stats` reports counts and rates only — no URLs, payloads, or proxy
details — so it's safe to scrape into your own monitoring:

```bash
curl "http://$host:3000/stats"
```

```json
{
  "memory": { "heapTotal": 0, "heapUsed": 0, "rss": 0 },
  "pid": 7,
  "solves": {
    "attempts": 210, "resolved": 205, "successful": 198, "failed": 7,
    "abandoned": 5, "successRate": 0.9658, "successPercent": 96.58,
    "failurePercent": 3.42, "abandonedPercent": 2.38,
    "bySolver": { "akamai": { "…": "…" }, "datadome": { "…": "…" } },
    "byType": { "captcha": { "…": "…" }, "interstitial": { "…": "…" },
                "sensor": { "…": "…" }, "capture": { "…": "…" } },
    "byProfile": { "chrome-146-macos": { "…": "…" } }
  },
  "ts": "2026-08-16T12:00:00.000Z",
  "uptimeSeconds": 86400
}
```

Two definitions worth knowing before you alert on this:

- **`attempts` is everything; `resolved` is what the solver finished.**
  `abandoned` means the caller went away mid-solve — a disconnected socket or
  an expired idle session.
- **The success rates are over `resolved`, not `attempts`.** A client that
  hangs up early therefore can't drag your success rate down and make a
  caller-side timeout look like a solver defect. `abandonedPercent` is the one
  rate computed over `attempts`.

Rate fields are `null` until something has resolved.

## Generating a client

The [OpenAPI spec](/openapi.yml) covers `/hc`, `/stats`, `/akamai/solve`, and
`/dd/solve`, so any generator will give you a client in your language. The Akamai WebSocket session isn't in it — OpenAPI 3.0
can't express a WebSocket protocol — and is documented by hand in the
[Akamai API reference](/api-akamai-sensor#websocket-session).

## Next

- [Via HTTP (Node, Python)](/integrate-http-clients) — the same flow with a real client
- [Akamai](/api-akamai) · [DataDome](/api-datadome) · [F5 / Shape](/api-f5) API reference
- [SDK](/sdk) — typed request/response shapes for TypeScript
