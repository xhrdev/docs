# Via HTTP (Node, Python)

No browser. Your code makes the requests, hands the captured challenge to the
solver, and sends the solved submission itself. This is the cheapest way to
integrate and what most projects should use.

Five interchangeable versions of the same flow, so you can copy whichever
matches your stack — **undici**, **axios**, and Node's built-in **fetch** below,
plus **requests**, **httpx**, and a standard-library-only **urllib** version
[in Python](#other-languages). If your language isn't here, the raw HTTP is on
[Via the API](/integrate-api).

The examples below use **DataDome** and target grainger.com, mirroring the
runnable versions in
[xhrdev/examples](https://github.com/xhrdev/examples) (`src/datadome/`).

::: info Shared helpers in these snippets
To keep the three client examples comparable, they call the same small
helpers the examples repo factors into `src/datadome/http-utils.ts`:

| Helper | What it does |
|---|---|
| `parseBlockPage(html)` | pulls the `var dd = {…}` literal out of a 403 body; returns `null` when you weren't challenged |
| `challengeDocumentUrl(dd, targetUrl)` | builds the `geo.captcha-delivery.com` challenge document URL |
| `solveRequestBody({…})` | assembles the `/dd/solve` payload shown below |
| `readClearanceCookie(body)` | pulls the cookie value out of DataDome's `Set-Cookie` string |
| `navigationHeaders()` / `documentHeaders()` / `submissionHeaders()` | the header sets for each request |
| `PROFILE` | the browser identity, shared with the solve payload |

None of them are library code — they're ~100 lines you'd write once and
own. Copy them from the examples repo rather than retyping.
:::

## The flow

Four requests, whichever client you use:

```
1.  GET  https://www.grainger.com/               -> 403 + var dd={…} + datadome cookie
2.  GET  geo.captcha-delivery.com/captcha/…      -> challenge document HTML
3.  POST <solver>/dd/solve                       -> a prepared submission
4.  GET  geo.captcha-delivery.com/captcha/check? -> {"cookie":"datadome=…"}

    then: GET https://www.grainger.com/ + cookie -> 200, the real page
```

Step 3 is the only call to your container. Steps 1, 2 and 4 go to the target
and to DataDome, through your proxy.

## Recognising a challenge

A blocked response is a 403 whose body carries an inline `dd` object:

```html
<script>var dd={'rt':'c','cid':'AHrlqAAAAAM…','hsh':'97DAF2A1CB…','t':'fe',
                's':51825,'e':'9cd1f431…','host':'geo.captcha-delivery.com',
                'cookie':'YWlkQoc1fsbfX4s8…'}</script>
```

Those fields are the challenge. `cookie` is the same value DataDome set in the
`datadome` response cookie, and it's what you pass as `ddCookie`.

`rt` tells you which type you got:

| `rt` | type | how it's solved |
|---|---|---|
| `c` | **captcha** | a puzzle page — GET `/captcha/check` with the payload in the query string |
| `i` | **interstitial** | a "verifying your browser" page — POST a payload |

An interstitial often escalates to a captcha when DataDome is unconvinced.
Handle both.

## Why you send the submission

`/dd/solve` never submits for you. It returns a **prepared submission** — a
request for you to make:

```json
{
  "body": "<solved payload string>",
  "origin": "https://geo.captcha-delivery.com",
  "referer": "<challenge document url>",
  "url": "<submit url>"
}
```

Captcha solves carry their payload in the query string (send `GET`);
interstitials post a body (send `POST`). Branch on whether `body` is present.

## The solve request

New-style challenge documents load their logic from a separate script rather
than inlining it, and the solver can't fetch that itself — you extract the
`<script src="…">` tags pointing at `captcha-delivery.com` out of
`documentHtml`, fetch each one over the same proxy session, and pass the
results as `externalScripts` (an empty array if the document is old-style and
doesn't have any):

```typescript
const externalScripts = await collectExternalScripts({ documentHtml, documentUrl, dispatcher });

const solveBody = {
  url: targetUrl,
  dd: {
    cid: dd.cid,
    hsh: dd.hsh,
    rt: dd.rt,
    s: dd.s ?? 0,
    ...(dd.t === undefined ? {} : { t: dd.t }),
    ...(dd.e === undefined ? {} : { e: dd.e }),
    ...(dd.b === undefined ? {} : { b: dd.b }),
  },
  ddCookie: dd.cookie,
  iframeData: {
    html: documentHtml,
    url: documentUrl,
    // Required for new-style challenge documents, which load the challenge
    // logic from a separate script instead of inlining it. Find <script
    // src="…"> tags pointing at captcha-delivery.com in documentHtml, fetch
    // each one the same way you fetched the document, and hand over the
    // body. Omitting this for a document that needs it fails dd.script.missing.
    ...(externalScripts.length ? { externalScripts } : {}),
  },
  proxy,
  timeout: 30_000,
  profile: {
    id: 'chrome-146-macos',
    chromeFullVersion: PROFILE.chromeFullVersion,
    httpHeaderTemplates: { form: [], iframe: [], image: [], xhr: [] },
    os: PROFILE.os,
    timezone: PROFILE.timezone,
    timezoneOffsetMinutes: PROFILE.timezoneOffsetMinutes,
    tlsClientHello: '',
    userAgent: PROFILE.userAgent,
  },
  js_profile: {
    brands: PROFILE.brands,
    chromeFullVersion: PROFILE.chromeFullVersion,
    chromeVersion: PROFILE.chromeVersion,
    deviceMemory: PROFILE.deviceMemory,
    hardwareConcurrency: PROFILE.hardwareConcurrency,
    languages: PROFILE.languages,
    os: PROFILE.os,
    platformVersion: PROFILE.platformVersion,
    screen: PROFILE.screen,
    timezone: PROFILE.timezone,
    timezoneOffsetMinutes: PROFILE.timezoneOffsetMinutes,
    vendor: PROFILE.vendor,
  },
};
```

::: warning Keep the identity consistent
The `profile` / `js_profile` you send here must match the headers you actually
put on the wire — user agent, `sec-ch-ua`, platform, language, timezone.
DataDome cross-checks them, and a mismatch produces an error that looks
nothing like its cause.
:::

Full field reference: [DataDome API](/api-datadome).

## undici

The reference implementation. `undici`'s `fetch` is the same one Node exposes
globally, but its types expose `dispatcher` — which is how you set a
per-request proxy.

```typescript
import { fetch, ProxyAgent } from 'undici';

const dispatcher = new ProxyAgent(proxy);

// 1. Trip the challenge.
const blocked = await fetch(targetUrl, {
  dispatcher,
  headers: navigationHeaders(),
});
const dd = parseBlockPage(await blocked.text());
if (!dd) return null; // went straight through — no challenge

// 2. Fetch the challenge document the solver needs to read.
const documentUrl = challengeDocumentUrl(dd, targetUrl);
const document = await fetch(documentUrl, {
  dispatcher,
  headers: documentHeaders(targetUrl),
});
const documentHtml = await document.text();

// 3. Ask the solver to build the submission.
//    Note: no dispatcher, this call goes direct to your container.
const solve = await fetch(`${solverUrl}/dd/solve`, {
  method: 'POST',
  body: JSON.stringify(solveRequestBody({ dd, documentHtml, documentUrl, proxy, targetUrl })),
  headers: {
    'content-type': 'application/json',
    ...(solverApiKey ? { 'x-api-key': solverApiKey } : {}),
  },
  signal: AbortSignal.timeout(30_000),
});
if (!solve.ok) {
  throw new Error(`solver returned HTTP ${solve.status}: ${await solve.text()}`);
}
const prepared = await solve.json();

// 4. Submit it yourself, over the same proxy session.
const submitted = await fetch(prepared.url, {
  ...(prepared.body === undefined ? {} : { body: prepared.body }),
  dispatcher,
  headers: submissionHeaders(prepared),
  method: prepared.body === undefined ? 'GET' : 'POST',
});
const cookie = readClearanceCookie(await submitted.text());

// Prove it: the request that 403'd now returns the real page.
const verified = await fetch(targetUrl, {
  dispatcher,
  headers: { ...navigationHeaders(), cookie: `datadome=${cookie}` },
});
```

## axios

Same four requests. Two axios specifics are worth copying exactly.

```typescript
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { createCookieAgent } from 'http-cookie-agent/http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { CookieJar } from 'tough-cookie';

// The jar has to live in the agent, not in the axios config.
const HttpsProxyCookieAgent = createCookieAgent(HttpsProxyAgent);

const jar = new CookieJar();
const client = wrapper(
  axios.create({
    httpsAgent: new HttpsProxyCookieAgent(proxy, { cookies: { jar } }),
    // Let the agent own the tunnel; axios's own proxy handling rewrites the
    // request line and breaks CONNECT.
    proxy: false,
    // We need to read the 403 body, not throw on it.
    validateStatus: () => true,
  })
);

const blocked = await client.get<string>(targetUrl, {
  headers: navigationHeaders(),
  responseType: 'text',
});
const dd = parseBlockPage(blocked.data);

// ... step 2 as above, via `client` ...

// Step 3 goes to your own solver, so use bare `axios` — not the proxy client.
const solve = await axios.post(`${solverUrl}/dd/solve`, solveBody, {
  headers: { 'content-type': 'application/json' },
  timeout: 30_000,
  validateStatus: () => true,
});
```

::: tip Two axios gotchas
- **`httpsAgent` + `proxy: false`.** Axios's `proxy` option rewrites the
  request line, which breaks HTTPS through a CONNECT proxy.
- **The cookie jar must be inside the agent.** Passing `jar` alongside a plain
  `HttpsProxyAgent` throws `does not support for use with other
  http(s).Agent` — wrap the proxy agent with `createCookieAgent` so one object
  both tunnels and stores cookies.
:::

The jar is what makes this version convenient: `datadome` is set on the block
response and again on the solve, and the jar carries it for you rather than
making you thread a `Cookie` header through by hand.

## Node's built-in fetch

No dependencies at all. The tradeoff is that proxy configuration is
per-process rather than per-request.

```bash
node --use-env-proxy --env-file=.env your-script.ts
```

Node's `fetch` takes its proxy from `HTTP_PROXY` / `HTTPS_PROXY` rather than a
per-request option, and only reads them when started with `--use-env-proxy`
(or `NODE_USE_ENV_PROXY=1`).

```typescript
process.env.HTTPS_PROXY = proxy;
process.env.HTTP_PROXY = proxy;
// Required: send the solver call direct, not through the proxy.
process.env.NO_PROXY = new URL(solverUrl).hostname;

// then the same four requests, using global fetch with no dispatcher
const blocked = await fetch(targetUrl, { headers: navigationHeaders() });
```

::: warning `NO_PROXY` is required, not tidiness
A datacenter proxy will not tunnel to your solver's port, so without
`NO_PROXY` covering the solver's host, step 3 simply fails. Node matches
`NO_PROXY` on the bare host, so an IP works as well as a name.
:::

The only real limitation is that one process can't use two proxies at once.
If you run a process per job, that makes no practical difference.

## Which client to pick

All three are the same four requests — copy whichever matches what you already
use. Summary of the differences that actually bite:

| Client | Proxy | Cookies | Watch out for |
|---|---|---|---|
| **undici** | per-request `dispatcher` | manual | nothing much — this is the simplest |
| **axios** | `httpsAgent` + `proxy: false` | jar, inside the agent | `createCookieAgent`, and don't proxy the solver call |
| **built-in fetch** | `HTTP_PROXY` env + `--use-env-proxy` | manual | `NO_PROXY` must cover the solver |
| **requests** | per-request `proxies=` | `Session` jar | replace the `datadome` cookie, don't append |
| **httpx** | per-client, one per pinned session | client jar | same cookie caveat as `requests` |
| **urllib** | two openers — see below | manual | stdlib only; no per-request proxy |

## Other languages

The same flow in Python lives in the examples repo under `py-src/datadome/`:

| File | Client |
|---|---|
| [`grainger_requests.py`](https://github.com/xhrdev/examples/blob/master/py-src/datadome/grainger_requests.py) | `requests` — a `Session` keeps the jar |
| [`grainger_httpx.py`](https://github.com/xhrdev/examples/blob/master/py-src/datadome/grainger_httpx.py) | `httpx` — proxy is per-client, one per pinned session |
| [`grainger_urllib.py`](https://github.com/xhrdev/examples/blob/master/py-src/datadome/grainger_urllib.py) | standard library only |
| [`http_utils.py`](https://github.com/xhrdev/examples/blob/master/py-src/datadome/http_utils.py) | the Python port of `http-utils.ts`, identity included |

They read the same `.env` and take the same flags as the TypeScript versions:

```bash
./venv/bin/python py-src/datadome/grainger_requests.py
./venv/bin/python py-src/datadome/grainger_urllib.py --url=https://www.idealista.com/
```

Two Python-specific notes:

- **`requests` and `httpx` both need help with the clearance cookie.**
  DataDome sets it with `Domain=.grainger.com`, but the response comes from
  `geo.captcha-delivery.com`, so the jar drops it as a domain mismatch. Worse,
  the block response already put a pre-solve `datadome` cookie in the jar for
  that domain — add the new one without removing it and both go out, the stale
  value wins, and it looks exactly like a failed solve. **Replace, don't
  append.**
- **`urllib` has no per-request proxy escape hatch.** Build two openers: one
  with a `ProxyHandler` for target traffic, one with an empty `ProxyHandler({})`
  for the call to your solver. Credentials in the proxy URL become the
  `Proxy-Authorization` header on the CONNECT automatically.

For anything else, [Via the API](/integrate-api) has the whole flow in curl and
jq — the clearest place to see the raw HTTP.

## Gotchas

- **`no challenge to solve`** — the site served your IP the page directly.
  Datacenter proxies frequently sail through; try a residential pool.
- **A 403 immediately after a solve** — the cookie was earned on a different
  IP. Check that you sent the submission yourself, over the same proxy
  session, and that session pinning is on.
- **The cookie is a full `Set-Cookie` string.** `/captcha/check` returns
  `datadome=abc…; Max-Age=31536000; Domain=.grainger.com; …`. Split on `;` and
  keep the value.
- **Cookies are per-registered-domain.** One earned on `grainger.com` works
  across its subdomains, and nowhere else.

## Next

- [Via a browser (Playwright)](/integrate-browser) — when the site needs a browser
- [Via the API](/integrate-api) — the same flow in curl, for other languages
- [DataDome API reference](/api-datadome) · [Akamai API reference](/api-akamai)
- [SDK](/sdk) — typed request/response shapes
