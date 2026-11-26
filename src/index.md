# Getting Started

xhr.dev is an **on-prem anti-bot challenge solver**. You run it as a Docker
container inside your own infrastructure — your traffic, proxies, and target
sites never touch xhr.dev's servers. We ship you a container image and a
signed licence file; everything else runs on your hardware.

It currently solves challenges from:

- **Akamai Bot Manager** — sensor challenges (`_abck` / `bm-sz`), SBSD and the pixel collector
- **DataDome** — captcha and interstitial challenges
- **F5 / Shape** — attested request headers for a request you name

Don't see the provider you need? [Message us](mailto:hello@xhrdev.com).

## How it fits into your stack

The whole decision is **do you need a browser**, and if so, which one. See
[How to integrate](/integrate) for the trade-offs:

| Path | What it is |
|---|---|
| [Via the API](/integrate-api) | the raw endpoints in curl — for any language |
| [Via HTTP (Node, Python)](/integrate-http-clients) | no browser. Your code makes the requests (undici, axios, fetch, requests, httpx), hands the challenge to the solver, and sends the submission itself. Cheapest and fastest. |
| [Via a browser (Playwright)](/integrate-browser) | when the site needs a real browser anyway. Chrome owns the submission, so it carries a real TLS fingerprint and the browser's own cookie jar. |
| [Via a browser (Lightpanda)](/integrate-lightpanda) | the same, on a ~70MB renderer-less binary — for browser-driven solving at volume |
| [Via Claude](/integrate-claude) | a prompt and a skill for having an agent write the integration |

Read next:

- [How to integrate](/integrate) — picking an approach
- [SDK](/sdk) — typed request/response definitions
- [Akamai](/api-akamai) · [DataDome](/api-datadome) · [F5 / Shape](/api-f5) API reference
- [Deployment guide](/deployment)
- [OpenAPI spec](/openapi.yml) ([browse interactively](https://docs.xhrdev.com/api.html))
- Runnable examples against live sites: [xhrdev/examples](https://github.com/xhrdev/examples)

## Quickstart

You'll need an invite to your private GitHub org (the image lives there) and a
`licence.json` / `licence.sig` pair — [contact us](mailto:hello@xhrdev.com)
or [book a call](https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2uDlsqLG_VZLl3s3ri_-YIXD3xXi5WzY21o0dFuk6Gq4HhcXwJBxUz-1K6kMGxTEf4oIPny-nV)
to get both issued.

```bash
mkdir -p licence
# place licence.json and licence.sig from xhr.dev into ./licence

# the image is private to your org — accept the GitHub invite first
echo "$GITHUB_TOKEN" | docker login ghcr.io -u <your-github-username> --password-stdin
docker pull ghcr.io/xhrdev-<your-org>/xhrdev:latest

docker run -d \
  --name xhrdev \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./licence:/run/licence:ro \
  ghcr.io/xhrdev-<your-org>/xhrdev:latest

curl http://localhost:3000/hc
# {"status":"ok"}
```

If the licence is missing, expired, or tampered with, the container exits
immediately with `{"event":"launcher_failed"}` and a non-zero exit code — it
fails closed, not open. See the [deployment guide](/deployment) for volume
mount vs. environment-variable licence delivery, Docker Compose, and the full
environment variable reference.

## Solving an Akamai challenge (example)

```bash
curl -X POST http://localhost:3000/akamai/solve \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://target.example.com/login",
    "profile": {
      "id": "chrome-146-macos",
      "chromeFullVersion": "146.0.7680.81",
      "os": "macos",
      "timezone": "America/New_York",
      "timezoneOffsetMinutes": -300,
      "tlsClientHello": "chrome_146",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      "httpHeaderTemplates": { "form": [], "iframe": [], "image": [], "xhr": [] }
    },
    "js_profile": {
      "os": "macos",
      "chromeVersion": "146",
      "hardware": { "webgl": { "vendor": "Google Inc. (Apple)", "renderer": "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" } },
      "screen": { "outerHeight": 1080, "innerHeight": 960 }
    }
  }'
```

```json
{
  "success": true,
  "mode": "abck",
  "submission": { "method": "POST", "url": "...", "body": "...", "request_headers": { "...": "..." } },
  "...": "..."
}
```

The full field reference, and error shapes are in the
[Akamai API reference](/api-akamai).

## Solving a DataDome challenge (example)

```bash
curl -X POST http://localhost:3000/dd/solve \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://target.example.com/",
    "dd": { "cid": "...", "hsh": "...", "rt": "c", "s": 1 },
    "ddCookie": "<datadome cookie value>",
    "profile": { "id": "chrome-146-macos", "...": "..." },
    "js_profile": { "...": "..." }
  }'
```

```json
{
  "body": "<solved payload string>",
  "origin": "https://geo.captcha-delivery.com",
  "referer": "<challenge document url>",
  "url": "<submit url>"
}
```

`/dd/solve` returns a **prepared submission** rather than a cookie — DataDome
binds the clearance cookie to the IP that submits it, so the request has to
come from you. Send it (`GET` when `body` is absent, `POST` when present) and
DataDome answers with `{"cookie":"datadome=…"}`. See
[why you send the submission](/integrate-http-clients#why-you-send-the-submission).

See the [DataDome API reference](/api-datadome) for the full challenge shape
and interstitial handling.

## Next steps

- [How to integrate](/integrate) — pick between HTTP and a browser
- [Via HTTP (Node, Python)](/integrate-http-clients) — the full four-request
  flow in undici, axios, fetch, requests, httpx, and urllib
- [Via a browser (Playwright)](/integrate-browser) — including the Akamai
  WebSocket session
- [Via Claude](/integrate-claude) — a prompt and a skill for agent-written
  integrations
- [SDK](/sdk) — typed request/response definitions for TypeScript
