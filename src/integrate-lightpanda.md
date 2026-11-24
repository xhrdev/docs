# Via a browser (Lightpanda)

[Lightpanda](https://lightpanda.io) is a headless browser with no renderer and
no graphics stack — a ~70MB binary that starts in milliseconds and holds a page
in a few MB. It speaks CDP and runs V8, so Playwright attaches to it with
`connectOverCDP` and most of an existing script carries over.

The reason to care is cost. The
[Playwright approach](/integrate-browser) is the expensive one on this site;
Lightpanda is the same shape at a fraction of the memory and startup time,
which is what makes browser-driven solving viable at volume.

::: warning This is the sharp-edges path
Chrome is the supported browser and the one to reach for first. Lightpanda
works — both examples below solve against live sites — but it needed four
non-obvious things to be true, each of which failed *silently* and looked like
something else. They're all handled by the helpers in the examples repo. Read
this page before assuming a failure is the solver.
:::

## The runnable examples

| Script | Vendor | What it shows |
|---|---|---|
| [`src/akamai/sensor/comcast-lightpanda.ts`](https://github.com/xhrdev/examples/blob/master/src/akamai/sensor/comcast-lightpanda.ts) | Akamai sensor | `comcast.ts` with Lightpanda in place of Chrome — the WebSocket session, unchanged |
| [`src/akamai/sbsd/hilton-lightpanda.ts`](https://github.com/xhrdev/examples/blob/master/src/akamai/sbsd/hilton-lightpanda.ts) | Akamai SBSD | both lanes — the SBSD ledger and `_abck` — on one Lightpanda page |
| [`src/akamai/sbsd/aircanada-lightpanda.ts`](https://github.com/xhrdev/examples/blob/master/src/akamai/sbsd/aircanada-lightpanda.ts) | Akamai SBSD | SBSD alone, where the site's own script keeps the sensor lane |
| [`src/datadome/grainger-lightpanda.ts`](https://github.com/xhrdev/examples/blob/master/src/datadome/grainger-lightpanda.ts) | DataDome | the **HTTP flow**, with the browser doing only the parts that need a browser |

```bash
npm run comcast:lightpanda
npm run hilton:lightpanda
npm run aircanada:lightpanda
npm run grainger:lightpanda
```

`npm install` downloads the binary to `target/` for you; to fetch it again by
hand, `npm run lightpanda:download`.

## The connection has to be re-originated

This is the load-bearing detail, and it's true for both vendors.

Lightpanda cannot talk to your proxy directly. Point it straight at one and
DataDome answers `rt:"c"` with `t:"bv"` — *banned visitor* — before a line of
JavaScript runs, where the same proxy IP a second later gets a plain `t:"fe"`
from an undici client. It isn't the user agent: undici sending
`User-Agent: Lightpanda/1.0` over that proxy still gets `t:"fe"`. It's the
connection itself, and nothing inside the browser can change it —
`--user-agent` rejects any value containing "Mozilla", and
`Emulation.setUserAgentOverride` is ignored on the wire.

So the examples put a local MITM proxy
([`src/mitm.ts`](https://github.com/xhrdev/examples/blob/master/src/mitm.ts))
in front of the browser: it terminates TLS and re-makes each request with
undici — the same client the browser-free examples use. With that in place the
ban is gone.

```typescript
import { start } from '#src/lightpanda.js';

const session = await start({ identity: IDENTITY, log, proxy });
// session.page   — a Playwright page, attached over CDP
// session.mitm   — the local proxy in front of it
// await session.stop()
```

`start()` sets the two flags that make it work — `--ca-cert`, so the proxy's
self-signed certificate is trusted, and
`--insecure-disable-tls-host-verification`, because one certificate serves
every host. They apply to that one browser process, which only ever talks to
the local proxy. Pass `reoriginate: false` to see the `bv` for yourself.

Two details of that proxy matter if you're writing your own:

- A request with **no `accept-encoding`** can get a captcha where the same
  request with one gets an interstitial. `undici.request` sends none,
  `undici.fetch` does — so the proxy uses `fetch`.
- **Lightpanda sends no `sec-fetch-*` headers.** The proxy adds them, without
  which some targets serve their own error page rather than the real one.

## The identity lives in the proxy

Because the user agent can't be set from inside the browser, the MITM is the
only place the identity can be set — and it has to be **the profile the solver
was told about**, not the proxy's default:

```typescript
const IDENTITY = {
  'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};
```

Telemetry claiming Chrome 146 under headers claiming 149 is scored as a
mismatch, and `_abck` sits at `~-1~` for as many rounds as you care to give it.
Same rule as everywhere else — see
[keep the identity consistent](/integrate#_2-keep-the-identity-consistent) —
just with a different place to set it.

## Akamai

`solve()` needs no CDP session, so it drives a Lightpanda page unchanged. Two
options exist for this browser specifically:

```typescript
import { solve } from '#src/akamai/solver.js';
import { start } from '#src/lightpanda.js';

const session = await start({ identity: IDENTITY, log, proxy });

await solve(session.page, {
  // Playwright's `route.fetch` never returns against Lightpanda. It runs in
  // Playwright's request context, which syncs cookies with the browser, and
  // once that stops answering every later route.fetch waits out its timeout —
  // the sensor script included, so no session ever opens. The MITM fetches it
  // instead: same dispatcher, same exit IP, same headers.
  fetchResponse: session.mitm.fetch,
  // Lightpanda is slower than Chrome under interception, and the defaults
  // (30s / 15s) run out before a script-heavy page settles.
  loadStateTimeout: 60_000,
  navigationTimeout: 90_000,
  proxy,
  solverUrl,
  url,
});
```

It solves. `_abck` reaches `~0~` on round 5 — the same round Chrome takes:

```
[https://login.xfinity.com] Cookie update: round=5 rval=0 accepted=true _abck=~0~
[https://login.xfinity.com] Cookie accepted (round 5)
RESULT: SUCCESS - Akamai solved, reached /login
```

One more thing `solve()` handles on that path: **cookies are applied by hand**.
`route.fulfill` carries one `set-cookie` header and Akamai's document response
sets four. Lose `_abck` and the session opens without the cookie the protocol
advances — Akamai then returns the *same* `_abck` to every submission and the
rounds count up forever. Each session logs `cookies=[…]` by name for exactly
this reason: compare it with a Chrome run and the missing one is right there.

## DataDome

DataDome goes the other way. The browser bridge
([`src/datadome/solver.ts`](https://github.com/xhrdev/examples/blob/master/src/datadome/solver.ts))
opens a CDP session per page, which crashes on Lightpanda — so
`grainger-lightpanda.ts` is the **HTTP flow** with the browser doing only what
needs a browser:

1. Navigate to the target, and be challenged.
2. Read `var dd = {…}` and the challenge iframe out of the live DOM.
3. `POST /dd/solve` from Node — direct, not through the proxy.
4. Submit from **inside the challenge frame** with `fetch()`, so it carries the
   browser's own connection, headers, and cookies.
5. Set the clearance cookie and navigate again.

Step 4 is the part worth keeping whatever the browser: DataDome binds the
cookie to the IP that submitted it, and every request Lightpanda makes goes
through the proxy it was started with.

::: tip Take the challenge document from the proxy, not the DOM
The solver needs the bytes DataDome served — not the DOM after Lightpanda has
parsed and run it, which is a different and much larger document. `start()`'s
`onResponse` callback gives you the proxy's view:

```typescript
const documents = new Map<string, string>();
const { page, stop } = await start({
  onResponse: ({ body, url }) => {
    if (url.includes(GEO_HOST) && /\/(?:captcha|interstitial)\//.test(url)) {
      documents.set(url, body);
    }
  },
  proxy,
});
```
:::

## Three things that differ from Chrome and bite immediately

Handled by `src/lightpanda.ts`, but worth knowing if you're writing your own:

- **Never reuse the page Lightpanda starts with.** Attaching to it leaves
  Playwright waiting forever on the first navigation. Always
  `context.newPage()`.
- **`context.newCDPSession()` crashes the process.** Lightpanda's reply to
  `Target.attachToTarget` trips an assertion inside Playwright, which is an
  uncatchable throw, not a rejected promise. So no CDP-level user-agent
  override, device metrics, or identity bridge.
- **`page.content()` and `frame.content()` never return.** Read the DOM through
  `evaluate` instead — `outerHtml(frame)` in the examples repo.

And two that look like bugs and aren't:

- **`Target page, context or browser has been closed`, on everything at once.**
  Lightpanda caps CDP messages at 1MB by default and *drops the connection*
  rather than rejecting an oversized one. Playwright fulfills an intercepted
  request by sending the whole body back over CDP, base64'd, so a single 1MB
  analytics bundle ends the session. `start()` passes
  `--cdp-max-message-size 32MB`.
- **One process, one proxy.** The proxy is a process-level flag rather than a
  per-context option, so a session that needs its own exit IP needs its own
  process — which is what `start()` gives you, along with its own CDP port.

## Reliability

Both examples solve reliably against their live targets. How well that holds
for you depends mostly on your proxy pool, which is the variable we can't test
on your behalf — so measure it on yours before committing to it at volume. The
examples repo ships a load-test runner for exactly that:

```bash
node --env-file=.env src/loadtest.ts \
  --script=src/datadome/grainger-lightpanda --iterations=30
```

Keep a retry either way. A failed attempt costs a few seconds, and browser
solves are more sensitive to exit-IP quality than the
[HTTP path](/integrate-http-clients) is.

## Next

- [Via a browser (Playwright)](/integrate-browser) — the supported path
- [Via HTTP (Node, Python)](/integrate-http-clients) — cheaper still, if you
  don't need a browser at all
- [Akamai API reference](/api-akamai) · [DataDome API reference](/api-datadome)
