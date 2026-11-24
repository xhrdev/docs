# Frequently Asked Questions

## General

### 1. What is xhr.dev?

xhr.dev is an on-prem anti-bot challenge solver. It ships as a Docker
container you run inside your own infrastructure, and it solves Akamai Bot
Manager and DataDome challenges via a local HTTP/WebSocket API.

### 2. Is there a hosted / cloud version?

No — xhr.dev is on-prem only. You run the container yourself; nothing
proxies through xhr.dev's infrastructure. See [Deployment](/deployment).

### 3. What does xhr.dev solve today?

- **Akamai Bot Manager** — `_abck` / `bm-sz` sensor challenges, SBSD and the pixel collector
- **DataDome** — captcha and interstitial challenges
- **F5 / Shape** — attested request headers for a request you name

Don't see a provider you need? [Message us](mailto:info@xhr.dev).

### 4. How do I integrate it?

Everything is plain HTTP/WebSocket to your own running container. The choice
is whether you need a browser:

1. **Without a browser** — your code makes the requests and hands the captured
   challenge to `POST /akamai/solve` or `POST /dd/solve`. See
   [Via HTTP (Node, Python)](/integrate-http-clients), or
   [Via the API](/integrate-api) for the raw flow in curl.
2. **With a browser** — when the site needs one anyway; Akamai also has a
   WebSocket session (`/akamai/session`) for this. See
   [Playwright](/integrate-browser) or [Lightpanda](/integrate-lightpanda).

Start at [How to integrate](/integrate), or go straight to the API references
for [Akamai](/api-akamai) and [DataDome](/api-datadome).

If you'd rather have a coding agent do it, [Via Claude](/integrate-claude) has
a prompt and a skill you can install.

### 5. How is it licensed?

Per-customer, via a signed licence file (`licence.json` + `licence.sig`)
that the container verifies locally at startup — no phone-home to xhr.dev.
[Contact us](mailto:info@xhr.dev) to get one issued. See
[Deployment](/deployment) for how licence delivery and renewal work.

### 6. What does it cost?

Contact us — pricing depends on scale and which providers/features you need.

### 7. What are the system requirements?

Docker, on either ARM64 or x86-64. No GPU or special hardware required.

### 8. Does xhr.dev see my traffic, proxies, or target data?

No. The container runs entirely on your infrastructure. It never calls
xhr.dev at runtime — the licence check is a local signature
verification, not a network request. See [Security](/security).

### 9. Can I customize its behavior?

Yes — per-request fields (browser profile, proxy, timeouts) are documented in the [Akamai](/api-akamai) and
[DataDome](/api-datadome) references. Reach out if you need something the
current API doesn't expose.

### 10. How do I get support?

[Book a call](https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ2uDlsqLG_VZLl3s3ri_-YIXD3xXi5WzY21o0dFuk6Gq4HhcXwJBxUz-1K6kMGxTEf4oIPny-nV),
[email us](mailto:info@xhr.dev), or find us on
[GitHub](https://github.com/xhrdev) and
[LinkedIn](https://www.linkedin.com/company/xhrdev/).

### 11. How often is the image updated?

xhr.dev ships updated images as challenge scripts change upstream. Because
the licence is decoupled from the image, you can usually pull a new image
tag without any licence changes; if a licence renewal is due separately,
you'll hear from us ahead of expiry.

### 12. Am I responsible for keeping it up to date?

Yes for self-hosted deployments — you control when you pull a new image tag.
xhr.dev publishes updated images as anti-bot vendors change their
challenges; we'll flag it when a change means you should update sooner
rather than later.

### 13. Can it handle multiple bots / high concurrency?

Yes. Each container admits solves through an internal queue — 8 concurrent
solves by default — and you scale horizontally by running more containers
behind a load balancer.

### 14. Are there usage limits or quotas?

None enforced by the software itself — throughput is bounded by your own
hardware and the licence terms you agreed to (e.g. seat/host count, if
applicable). Contact us if you're unsure what your licence covers.

### 15. What level of coding knowledge is required?

You need to be comfortable making HTTP/WebSocket requests and running
Docker. No SDK is required to get started — see the `curl` examples in
[Getting Started](/).

### 16. Does it work with any programming language?

Yes — it's a plain HTTP/WebSocket API, callable from any language that can
make HTTP requests.

### 17. What kind of monitoring or logging does the container produce?

It logs locally (stdout/your log driver of choice) — nothing is sent to
xhr.dev. See [Security](/security) for details on what's logged.

### 18. Is there authentication on the API?

No, and there's no API key to obtain. The licence gates startup, not requests,
so anything that can reach port 3000 can use the solver. That's by design —
the container is meant to run on a locked-down host reachable only from your
own scrapers. See [Network posture](/on-prem#network-posture).

(The `x-api-key` you'll see in the examples repo is for the hosted trial box
we lend out during evaluations, which sits behind a reverse proxy. Your own
deployment ignores it.)

### 19. Can I have an AI agent write the integration?

Yes, and it's a good fit — the job is well-specified and there are runnable
examples to copy. [Via Claude](/integrate-claude) has a prompt to paste, a
Claude Code skill to install, and the list of things agents reliably get wrong
here. The docs are also published as
[llms.txt](https://docs.xhr.dev/llms.txt) /
[llms-full.txt](https://docs.xhr.dev/llms-full.txt) so an agent can read the
whole site in one fetch.
