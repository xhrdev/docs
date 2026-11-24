# Via Claude

Most xhr.dev integrations are the same shape: an existing scraper or connector
already exists, it works everywhere except the one target sitting behind Akamai
or DataDome, and someone has to wire the solver in. That's a well-specified
job, and a coding agent does it well **if you give it the right context up
front** — which is mostly a matter of pointing it at the right four files.

This page gives you a prompt to paste, a skill to install, and the short list
of things agents reliably get wrong here.

## Point it at the machine-readable docs first

This site publishes an [llms.txt](https://llmstxt.org) bundle, so an agent can
read the whole thing in one fetch rather than crawling pages:

| URL | What it is |
|---|---|
| <https://docs.xhr.dev/llms.txt> | index of every page, with descriptions |
| <https://docs.xhr.dev/llms-full.txt> | every page's full text, concatenated |
| <https://docs.xhr.dev/openapi.yml> | the API contract, machine-readable |

Every page also has a **Copy as Markdown** button at the top, if you'd rather
paste one page into a chat.

## The prompt

Adapt the target, the vendor, and the paths; leave the rest. It's written to
front-load exactly the context an agent needs to not guess.

::: details Copy this
```text
I want you to add an integration and tools for CA EDD (California Employment
Development Department). We're adding a few tools under this connection.

CA EDD sits behind Akamai bot defence, which blocks our Playwright login. We
have a vendor with an Akamai solver called xhr.dev.

Read these before writing any code:
  - https://docs.xhr.dev/llms-full.txt  (all of the docs in one fetch; if you
    prefer pages: the Akamai API reference and "Via a browser (Playwright)")
  - https://github.com/xhrdev/examples — read the repo README *and*
    src/akamai/README.md, not just the API docs. The vendor-directory READMEs
    carry the protocol details and the failure modes.
  - https://github.com/xhrdev/examples/blob/master/src/akamai/sensor/ca-edd.ts —
    the runnable example for this exact target
  - https://github.com/xhrdev/examples/blob/master/src/akamai/sensor/solver.ts —
    the client we need to import: `import { solve } from '#src/akamai/sensor/solver.js'`

The solver is a container we run ourselves — there's no SaaS endpoint, no
account, and no API key. It's reachable at ws://$host:3000/akamai/session.
(If you see `x-api-key` in their examples, that's for their hosted trial box,
not for a self-hosted container. Don't build auth around it.)

Then: add a CA EDD connection that uses the xhr.dev solver to get past Akamai,
and the tools underneath it. Follow the existing connection/tool patterns in
this repo rather than inventing a new one.

Constraints that are not negotiable, because getting them wrong produces
errors that look like something else entirely:
  - The browser identity and the profile we send the solver must be the same
    object. One user agent, set once, shared between the Playwright launch
    options and the solver payload.
  - Egress from the same IP for the whole flow. Pin the proxy session; a pool
    that rotates mid-flow voids the cookie we just earned.
  - Don't retry a stuck solve by restarting it. Rounds 1–5 ending in `~-1~`
    are the protocol working. Read the `_abck` suffix.

Before you start, tell me how you plan to vendor solver.ts — pull it at build
time or check it in — and why.
```
:::

### Why it's shaped that way

- **It names the READMEs, not just the API docs.** The
  [Akamai](https://github.com/xhrdev/examples/blob/master/src/akamai/README.md)
  and
  [DataDome](https://github.com/xhrdev/examples/blob/master/src/datadome/README.md)
  walkthroughs in the examples repo carry the protocol and the failure modes.
  An agent that reads only the endpoint contract writes something that compiles
  and never reaches `~0~`.
- **It names the exact example file.** There's probably one for your target or
  something close to it, and copying a working script beats deriving one.
- **It states the two rules as constraints.** Identity consistency and IP
  stability are the cause of nearly every "the solve failed" report, and
  neither produces an error message that points at itself. See
  [the two rules](/integrate#two-rules-that-decide-whether-this-works).
- **It asks a question before code.** Vendoring `solver.ts` is a real decision
  with no default answer, and it's cheaper to make it before the diff exists.

## The skill

If you're using Claude Code, install this as a skill so the context arrives
automatically whenever bot defence comes up, instead of being pasted each time.

Save it as `.claude/skills/xhrdev/SKILL.md` in your repo (or
`~/.claude/skills/xhrdev/SKILL.md` for every repo):

::: details `.claude/skills/xhrdev/SKILL.md`
````markdown
---
name: xhrdev
description: >-
  Use when work touches Akamai Bot Manager or DataDome bot defence — a target
  returns 403 with `var dd={…}`, an `_abck` cookie stays at `~-1~`, a
  Playwright login is blocked by a challenge, or someone mentions xhr.dev,
  a challenge solver, or a clearance cookie.
---

# Integrating xhr.dev

xhr.dev is a self-hosted anti-bot challenge solver. It runs as a Docker
container **inside our own infrastructure** — there is no SaaS endpoint, no
account, and no API key. It is licence-gated at startup, not per-request, so
there is no auth to build. Requests go to our own host, typically
`http://$host:3000`.

Do not add an API-key mechanism. The `x-api-key` in xhr.dev's examples repo
is for their hosted trial box, which sits behind a reverse proxy; a
self-hosted container ignores the header.

## Before writing code

Fetch these. Do not work from memory of them.

- `https://docs.xhr.dev/llms-full.txt` — all of the docs in one fetch
- `https://github.com/xhrdev/examples` — the README, **and** the vendor
  README for whichever vendor applies (`src/akamai/README.md` or
  `src/datadome/README.md`). The vendor READMEs carry the protocol details
  and the failure modes; the API reference alone is not enough.
- The example closest to the target, e.g. `src/akamai/sensor/ca-edd.ts`.

## Pick the integration shape

| Situation | Use |
|---|---|
| We only need a clearance cookie | HTTP clients — 4 requests, no browser. Cheapest by a wide margin; the default. |
| The site needs a real browser anyway (SPA, login flow) | Playwright bridge — `solve(page, {…})` |
| Browser needed, but at volume | Lightpanda — same shape, ~70MB binary; read the Lightpanda docs page first, it has sharp edges |

Do not reach for the browser because it "sounds more robust". Reach for it
when the site forces you to.

## The endpoints

| Endpoint | Purpose |
|---|---|
| `GET /hc` | health check — `{"status":"ok"}` |
| `GET /stats` | solve counts and success rates |
| `POST /dd/solve` | DataDome — returns a **prepared submission**, never submits |
| `POST /akamai/solve` | Akamai — solve from a URL |
| `WS /akamai/session` | Akamai — stateful session for browser-driven solving |

No authentication on any of them. If a request 401s, something in front of
the container is rejecting it — a proxy or gateway we put there — not the
solver.

## Rules that are not negotiable

1. **Submit from the IP you'll browse from.** Vendors bind the clearance
   cookie to whichever IP submitted it. `/dd/solve` returns a prepared
   submission rather than sending one for exactly this reason — make that
   request yourself, over a **pinned** proxy session. A pool that rotates
   mid-flow returns a cookie that is already void.
2. **One identity, one place.** The `profile` / `js_profile` sent to the
   solver must match the headers actually on the wire — user agent,
   `sec-ch-ua`, platform, language, timezone. Share a single profile object
   between the browser launch options and the solver payload. Changing one
   without the other is the most common failure, and the resulting error
   looks nothing like its cause.
3. **Solving is not the same as staying unblocked.** A solve can succeed and
   the site can still refuse you — that's TLS fingerprint or IP reputation,
   not the solver. Datacenter IPs are frequently rejected regardless of a
   valid cookie.

## Akamai specifics

- `_abck` ending in `~-1~` means not accepted; `~0~` means through. Rounds
  1–5 at `~-1~` are **normal** — do not add a retry loop around them.
- The WebSocket session is per-origin. A login flow spanning two domains runs
  two sessions; only the origin you actually need has to reach `~0~`.
- Session idles out after 5 minutes; each `submission` needs a
  `submission_response` within 30 seconds.
- `Resulting promise was garbage collected` — a frame navigated out from
  under an in-flight submission. Harmless if another origin reaches `~0~`.

## DataDome specifics

- `rt: "c"` is a captcha (payload in the query string — send **GET**);
  `rt: "i"` is an interstitial (send **POST**). Branch on whether the
  prepared submission has a `body`.
- An interstitial often escalates to a captcha. Handle both.
- `t: "bv"` is a banned visitor — `422`, nothing to solve. Rotate the exit IP.
- `/captcha/check` returns a full `Set-Cookie` string. Split on `;`, keep the
  value.

## Diagnosing

| Symptom | Cause |
|---|---|
| `no challenge to solve` | the site let this IP through — try a residential proxy |
| fresh 403 right after a successful solve | cookie earned on a different IP — check session pinning and that we sent the submission |
| solver returns 400 | the profile and the headers disagree — change both together |
| solver returns 500 `queue_full` | container saturated — run more containers |
| `_abck` stuck at `~-1~` forever | identity mismatch, not the solver |
````
:::

Restart Claude Code after adding it, and check it's loaded with `/skills`.

## What agents get wrong here

Four failure modes, all of which produce working-looking code:

1. **Assuming a SaaS.** Agents pattern-match "vendor" to "API key + hosted
   endpoint" and write a client for `https://api.xhr.dev`, or build an
   API-key config path because they saw `x-api-key` in the examples repo.
   There is no hosted endpoint and no key: the solver is a container you run,
   the URL is your own host, and the header is trial-box-only.
2. **Letting the solver submit.** It reads as the tidy design and it silently
   produces cookies that are void from your address — a fresh 403 that looks
   exactly like a failed solve. Neither `/dd/solve` nor
   `/akamai/solve` submits for you, for this reason; you send the returned
   submission yourself.
3. **Two sources of truth for the identity.** An agent writes a nice `PROFILE`
   constant for the solver payload and then, three files away, launches Chrome
   with whatever user agent it had in mind. Ask for one object, shared.
4. **Retrying rounds 1–5.** `~-1~` looks like failure and isn't, so an agent
   wraps the solve in a retry loop that restarts the session just before it
   would have succeeded.

## Reviewing the diff

Worth checking by hand before you merge:

- One profile object, referenced from both the browser launch and the solver
  payload. Grep for the user-agent string — it should appear once.
- The call to your solver is **not** routed through the scraping proxy. With
  Node's built-in `fetch` this means `NO_PROXY` covering the solver's host;
  with undici, no `dispatcher` on that one call. A datacenter proxy will not
  tunnel to your solver's port, so getting this wrong fails the solve outright.
- The proxy session is pinned for the whole flow, not per request.
- No API-key plumbing was invented. A self-hosted container has no auth; if
  the diff added a key config, that's the trial box leaking into the design.
- No secrets in the prompt or in committed config — proxy credentials in
  particular.

## Next

- [How to integrate](/integrate) — pick an approach first
- [Via a browser (Playwright)](/integrate-browser) · [Via HTTP (Node, Python)](/integrate-http-clients)
- [Akamai API reference](/api-akamai) · [DataDome API reference](/api-datadome)
