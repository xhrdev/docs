# Via a browser (Playwright)

Use this when the site needs a real browser anyway — a SPA, a login flow, or
content you can't get from raw HTML. If all you want is a clearance cookie,
[HTTP clients](/integrate-http-clients) are far cheaper.

This page is Playwright driving **Chrome**, which is the supported browser and
the one to start with. [Lightpanda](/integrate-lightpanda) is the same shape at
a fraction of the memory, once you're running this at volume.

## Why go through the browser

The point isn't that solving works better here — it's **who sends the
submission**. In this approach Chrome owns the actual request: the native
interstitial POST, the captcha GET, or the Akamai sensor XHR. That means it
carries a genuine Chrome TLS fingerprint and the browser's own cookie jar,
which some sites check independently of the challenge itself.

That property is the reason to accept the cost. See
[solving ≠ staying unblocked](/integrate#solving-is-not-the-same-as-staying-unblocked).

## DataDome

Attach to a Playwright page, let the helper watch for a challenge, and it
resolves once DataDome returns an accepted cookie. It handles the
interstitial → captcha escalation for you.

```typescript
import { chromium } from 'playwright';
import { solve } from '#src/datadome/solver.js';

const browser = await chromium.launch();
const context = await browser.newContext({ proxy: { server: proxy } });
const page = await context.newPage();

const result = await solve(page, { proxy, solverApiKey, solverUrl, url });
// -> { cookie, responseStatus, url }

// the page is now cleared; carry on driving it normally
await page.goto('https://www.grainger.com/category/…');
```

Under the hood it watches for the challenge, asks your container for the
sensor values via `POST /dd/solve`, and hands the result back to the page so
Chrome performs the submission.

Runnable version: `src/datadome/grainger.ts` in
[xhrdev/examples](https://github.com/xhrdev/examples).

## Akamai — the WebSocket session

Akamai works differently. Rather than one request/response, the solver keeps a
**stateful session** open and streams you one sensor submission per round,
each of which you relay through the browser and report back on.

```typescript
import { solve } from '#src/akamai/solver.js';

// note the `ws://` scheme and the full path — unlike the DataDome client,
// this one takes the socket URL, not a base URL
const solverUrl = `ws://${host}:3000/akamai/session`;

await solve(page, { proxy, solverApiKey, solverUrl, timeout: 120_000, url });
```

It intercepts the Akamai script, opens a session **per origin**, and relays
submissions until the cookie is accepted. Per-origin matters: a login flow
spanning `business.comcast.com` and `login.xfinity.com` runs two sessions at
once, each with its own rounds — only the origin you actually need has to reach
`~0~`.

Runnable versions: [`src/akamai/sensor/comcast.ts`](https://github.com/xhrdev/examples/blob/master/src/akamai/sensor/comcast.ts)
(two origins through an OAuth redirect chain) and
[`src/akamai/sensor/ca-edd.ts`](https://github.com/xhrdev/examples/blob/master/src/akamai/sensor/ca-edd.ts)
(the same, then an actual login).

### Reading `_abck`

The cookie value ends in a segment that tells you where you stand:

| Value | Meaning |
|---|---|
| `~-1~` | not accepted — keep sending sensors |
| `~0~` | **accepted** — you're through |

```
[https://login.xfinity.com] Cookie update: round=5 rval=-1 accepted=false _abck=~-1~
[https://login.xfinity.com] Cookie update: round=6 rval=0  accepted=true  _abck=~0~
[https://login.xfinity.com] Cookie accepted (round 6)
```

Acceptance normally takes several rounds. **Rounds 1–5 ending in `~-1~` are the
protocol working as intended, not a failure** — don't wrap the solve in a retry
loop that restarts the session just before it would have succeeded.

### The protocol

If you're implementing this yourself rather than using the example helper:

1. **Launch a browser** and navigate to the target URL.
2. **Capture the challenge** — intercept the Akamai sensor script source, grab
   the page HTML, and collect current cookies.
3. **Connect** to `ws://host:3000/akamai/session`.
4. **Send `init`** with the captured script, HTML, cookies, and URL.
5. **Relay each `submission`** as a real XHR/fetch in the browser, and reply
   with `submission_response` carrying the status, body, and updated cookies.
6. **Watch for `cookie_update`** with `accepted: true` — the `_abck` cookie is
   now valid.
7. **Close the socket** and continue browsing with the accepted cookies.

Full message schemas, session TTL, and submission timeouts are in the
[Akamai sensor API reference](/api-akamai-sensor#websocket-session).

::: warning Some properties run a second channel
The steps above cover Akamai's `_abck` sensor. A property that also serves a
bundle script whose `src` carries a UUID `v=` runs [SBSD](/api-akamai-sbsd)
alongside it, and solving one without the other does not get you through. The
bundle is not always at `/.well-known/sbsd` — see
[finding the bundle](/api-akamai-sbsd#finding-the-bundle). SBSD is a single
request rather than a session, and your page's own POSTs carry the result —
see the [SBSD reference](/api-akamai-sbsd).
:::

::: tip Session limits
A session expires after **5 minutes** of inactivity (each
`submission_response` resets the timer), and each individual `submission` must
be answered within **30 seconds**.
:::

## Keeping the identity consistent

The browser and the profile you send the solver have to agree. If you launch
Chrome with one user agent and tell the solver something else, the solve gets
rejected in a way that doesn't point at the cause.

The examples share a single `profile.ts` between the browser launch options
and the solver payload for exactly this reason — worth copying that structure.

## Gotchas

- **`Resulting promise was garbage collected`** — a frame navigated out from
  under an in-flight submission. Harmless when another origin still reaches
  `~0~`; the examples log it and carry on.
- **Stuck at `~-1~` forever** — usually the identity, not the solver. The
  profile has to match the browser actually making the requests.
- **`sbsd`** — some properties use Akamai's SBSD challenge rather than the
  classic sensor. `/akamai/solve` takes `mode: "abck" | "sbsd"` and
  auto-detects when you omit it.
- **`500` with `queue_full` or `queue_wait_timeout`** — the container is
  saturated. It runs 8 concurrent solves with a queue depth of 32 by default;
  past that, run more containers behind a load balancer.

## Cost

Be realistic about what this costs relative to the HTTP path: a browser
process per session, plus the page loads. If you're running this at volume,
pool contexts rather than launching a browser per job, reserve the browser
approach for the targets that actually need it, and look at
[Lightpanda](/integrate-lightpanda).

## Next

- [Via a browser (Lightpanda)](/integrate-lightpanda) — the same shape, ~70MB
- [Via HTTP (Node, Python)](/integrate-http-clients) — the cheaper path
- [Akamai API reference](/api-akamai) · [DataDome API reference](/api-datadome)
