# How to integrate

Everything below talks to the container you're already running (see
[Deployment](/deployment)). There's no SaaS endpoint and no account —
requests go to your own host, e.g. `http://localhost:3000`.

## Pick a path

There are really only two decisions: **do you need a browser**, and if so,
**which one**. Pick on what the rest of your job needs, not on which sounds
more robust.

| | Cost | TLS fingerprint | Use when |
|---|---|---|---|
| [**Via the API**](/integrate-api) | ~4 HTTP requests | yours | you're in a language we don't ship an example for |
| [**Via HTTP (Node, Python)**](/integrate-http-clients) | ~4 HTTP requests | yours | you just need the clearance cookie |
| [**Via a browser (Playwright)**](/integrate-browser) | a full Chrome per session | Chrome's, genuinely | the site needs a browser anyway |
| [**Via a browser (Lightpanda)**](/integrate-lightpanda) | a ~70MB binary per session | Chrome's, via a local proxy | you need a browser at volume |
| [**Via Claude**](/integrate-claude) | — | — | you want an agent to write the integration |

**If all you want is a cookie, don't use a browser.** The HTTP path is
dramatically cheaper — four requests and a few hundred milliseconds — and it's
what most integrations should take. Reach for a browser when you were going to
drive one regardless: the site is a SPA, needs a login flow, or renders
content you can't get from raw HTML.

Between the two browsers, start with **Playwright and Chrome**. Lightpanda is
the same shape at a fraction of the memory, but it needs a re-originating
proxy in front of it and has several failure modes that don't look like
themselves — [its page](/integrate-lightpanda) covers them.

## Calling the API

Every approach is plain HTTP (plus a WebSocket, for Akamai in the browser
flow) against your container:

| Endpoint | What it does |
|---|---|
| `GET /hc` | Health check — `{"status":"ok"}` |
| `GET /stats` | Solve counts and success rates, for your own monitoring |
| `POST /dd/solve` | Solve a DataDome captcha or interstitial |
| `POST /akamai/solve` | Solve an Akamai sensor challenge from a URL |
| `WS /akamai/session` | Streaming Akamai session for browser-driven solving |
| `POST /akamai/sbsd/generate-session` | Issue an SBSD ledger for one live document |
| `POST /akamai/pixel/generate` | Produce the POST Akamai's pixel collector would send |
| `POST /f5/solve` | Solve an F5/Shape challenge → attested headers for one request |

Full contracts: [Akamai](/api-akamai) · [DataDome](/api-datadome) ·
[F5 / Shape](/api-f5) · [OpenAPI spec](/openapi.yml). See [Via the API](/integrate-api) for the raw
request-by-request flow in curl.

If you're in TypeScript, the [SDK](/sdk) gives you typed request and response
shapes for these endpoints (types only — you still make the calls yourself).

### Authentication

There is none, and there's no API key to obtain. The container is
**licence-gated at startup, not per-request** — once it's running, anything
that can reach port 3000 can use it.

That's deliberate: the security boundary is the network, not a header. The
container is designed to run on a box whose egress you've locked down (see
[Network posture](/on-prem#network-posture)), reachable only from your own
scrapers. Put it on a private subnet or behind firewall rules and you're done.

::: tip Why the examples send `x-api-key`
Scripts in [xhrdev/examples](https://github.com/xhrdev/examples) thread an
optional `solver_api_key` through as an `x-api-key` header. That's for the
**hosted trial box** we lend to prospects during an evaluation, which sits
behind a reverse proxy that checks the header. Your own deployment ignores it
— leave `solver_api_key` unset and the examples send nothing.
:::

## Two rules that decide whether this works

Almost every "the solve failed" report comes down to one of these.

### 1. Submit from the IP you'll browse from

Anti-bot vendors bind the clearance cookie to whichever IP submitted it. If
the solver submits on your behalf, you get a cookie that's valid *for the
container* and void from your scraper — a fresh 403 on the very next request,
which looks exactly like a failed solve.

`/dd/solve` is built around this: it returns a prepared submission rather than
sending one, so you make the request from the address you'll browse from. See
[why you send the submission](/integrate-http-clients#why-you-send-the-submission).

### 2. Keep the identity consistent

The `profile` / `js_profile` you send the solver has to match the headers you
actually put on the wire — user agent, `sec-ch-ua`, platform, language,
timezone. These get cross-checked. Changing a user agent in one place and not
the other is the single most common way to get a solve rejected, and the error
it produces looks nothing like the cause.

## Solving is not the same as staying unblocked

Worth setting expectations: the solve can succeed and the site can still
refuse you afterwards. Clearance cookies get you past the challenge; whether
the site then honours the cookie depends on separate signals — chiefly your
TLS fingerprint and IP reputation.

If you're solving successfully but still getting blocked:

- **Datacenter IPs** are frequently rejected regardless of a valid cookie. Try
  a residential pool.
- **Non-browser TLS fingerprints** are visible to the site even when the
  cookie is good. This is a different problem from solving, and it's the main
  reason to use the [browser approach](/integrate-browser) despite the cost.

## Next

- [Via the API](/integrate-api) — the raw endpoints, in curl
- [Via HTTP (Node, Python)](/integrate-http-clients) — undici, axios, fetch, requests, httpx
- [Via a browser (Playwright)](/integrate-browser) · [Via a browser (Lightpanda)](/integrate-lightpanda)
- [Via Claude](/integrate-claude) — a prompt and a skill for agent-written integrations
- [SDK](/sdk)
