# Privacy Policy for the xhrdev Chrome Extension

**Last updated: 2026-10-18**

> **This page covers the browser extension.** It is a separate product from the
> on-prem solver software, whose notice is at [Privacy Policy](/privacy). The
> extension runs in your browser and handles page data; that notice covers the
> business data we collect to sell and support a licence, and does not describe
> what the extension does. This page does.

xhrdev is a Chrome extension that answers Akamai and DataDome challenges in the
tab you are browsing, by sending the challenge to a **solver** — an HTTP service
whose address you enter yourself. This policy describes what data the extension
collects, how it is used, where it is stored, who it is shared with, and how
long it is kept.

## The two deployments, because they differ

Everything below depends on which solver you point the extension at, so it is
stated first:

- **Self-hosted.** You run the solver container on your own hardware or in your
  own cloud account. Data goes from your browser to your own service. The author
  of this extension never receives it and has no way to.
- **Hosted trial (`trial.xhrdev.com`).** A solver instance operated by XHR
  Software Inc. for evaluation, gated behind an API key. If you enter this
  host, the data described under *What is collected* is transmitted to a server
  that company operates, rather than to one of your own.

The extension has no backend of its own and contacts no other service. It does
not phone home, and there is no address baked into it — with no host configured
it makes no network requests at all.

## What is collected

The extension collects data only while a solve is running — started by you from
the popup, or automatically if you have enabled automatic solving. For each
solve it gathers, from the tab being solved:

- **Web history.** The URL of the page being solved.
- **Website content.** The challenge document served by the anti-bot vendor and
  the stylesheets it links; the anti-bot script served to the page (Akamai's
  sensor script and SBSD bundle); and the page's HTML with scripts removed.
- **Authentication information.** Cookies. The two channels differ, and the
  difference matters: **DataDome** is sent a single value, the `datadome` cookie
  the challenge was issued against (or the `cid` from the challenge URL for a
  captcha). **Akamai** is sent the entire cookie jar for the host being solved,
  `httpOnly` cookies included, because the `_abck` protocol is stateful and the
  solver must model the visitor as the browser actually presents them. **On a
  site you are signed in to, that includes your session cookie.**

  A single site can be several hosts. A protected property often serves its
  pages, its booking or checkout engine and its APIs from different hostnames
  under the same domain, each scored separately and each with its own `_abck`.
  Where that is so, the jar for each of those hosts is sent — one per host,
  never combined — because a realm answered with another realm's cookies
  describes a browser that does not exist. Which hosts count is decided by the
  Akamai sites you have listed in settings: only hosts under a site on that list
  are ever read this way.
- **Device and browser characteristics.** Screen and window geometry, languages,
  timezone, device memory, CPU core count, network conditions, resource timings,
  and JavaScript heap sizes, read from the page being solved.
- **Credentials you supply.** The API key you entered, if any, sent as an
  `x-api-key` header.

The extension collects no personally identifiable information, health data,
financial or payment data, personal communications, or location data, and
performs no analytics, telemetry, crash reporting, or usage measurement of any
kind.

## How it is used

Solely to compute a valid challenge response and return it to your browser. The
data is used for the solve it was collected for and for nothing else. It is not
profiled, not analysed, not used to train anything, and not used for
advertising.

## How it is stored

**In the browser.** Your settings — solver host, API key, proxy string, Akamai
site list, channel toggles, timeout — are stored with `chrome.storage.local` on
the machine where you installed the extension. The Akamai site list is a list of
hostnames you have visited that run Akamai, recorded as described above; it stays
on this machine and is never transmitted. `chrome.storage.local` is used
rather than `chrome.storage.sync` specifically so that your API key is never
pushed through Google's servers to your other devices.

The solve transcript shown in the popup is held in memory in the extension's
service worker. It is never written to disk, never transmitted, and is lost when
that worker is torn down.

**On the solver.** How solve data is stored, and whether it is stored at all, is
a property of the solver you point the extension at, not of the extension.

*Self-hosted* — the intended deployment — means your own infrastructure under
your own retention policy. The solver container logs to stdout under whatever
log driver you attach, and ships nothing anywhere; XHR Software Inc. has no
visibility into the traffic, target sites, proxies, or data it processes. See
[Security](/security).

*Hosted trial* means the same container, operated by XHR Software Inc. on your
behalf for evaluation. Solve payloads are processed to compute the response;
operational logs are kept for 15 days, as described under *Evaluation Services* in the
[Privacy Policy](/privacy). The hosting vendors are listed on
[Subprocessors](/subprocessors).

## How it is shared

The extension transmits the data described above to **exactly one destination:
the solver host you configured**. There is no other network destination in the
code.

It is not sold. It is not transferred to third parties for advertising,
analytics, credit assessment, lending, or any purpose unrelated to performing
the solve you requested. No third-party service receives it — no analytics
vendor, no error reporting service, no advertising network.

For a self-hosted solver there is no recipient other than your own
infrastructure. For the hosted trial the recipient is XHR Software Inc., on the
terms described under *How it is stored*. Data may be disclosed if required by
law.

## Retention and deletion

Extension settings persist until you delete them. You can remove them at any
time by clearing the fields in the popup's settings view, or by removing the
extension — uninstalling deletes its `chrome.storage.local` data. The in-memory
transcript requires no deletion; it does not survive the service worker.

For the hosted trial, request deletion of records associated with your API key
by writing to the contact address below.

## Permissions, and why each is needed

The extension declares host access to `http://*/*` and `https://*/*`, which
Chrome presents at install as "Read and change all your data on all websites".

That is broader than what it does, and the gap is worth stating plainly. The
service worker must `fetch` your solver, and your solver's address is yours to
choose — a public hostname, or a private IP on your own network — so the
declared pattern cannot be narrowed ahead of time to the one origin it actually
uses. **In use it contacts exactly one host: the solver you configured.** There
is no other network destination in the code.

The `cookies` permission is used for one thing, and not for collection: after a
page finishes loading, the extension checks whether that site has set an Akamai
bot-manager cookie (`_abck`, `bm_sz`, `ak_bmsc`, `bm_sv`, `akamai-botf`). Only
the presence of those names is read, only the site's own hostname is recorded,
and nothing about this check leaves your browser. It exists so that an Akamai
site can be solved automatically on later visits, which otherwise requires
instrumenting a load that has already happened.

Cookie *values* are read over the debugger session attached to the tab being
solved, not through this permission — as is everything else the extension does
on the sites it solves on. That is why `debugger` is the
significant permission: it is how the request is inspected and rewritten, and
Chrome displays a visible banner on any tab where it is in use. `storage` holds
your settings; `tabs` and `webNavigation` identify the tab and detect a
challenge frame.

No remotely hosted code is used. All executable code ships inside the package.

## Changes

Material changes to this policy will be reflected in the "Last updated" date
above and, where they affect what is collected or who receives it, in the
extension's Chrome Web Store listing.

## Contact

[privacy@xhr.dev](mailto:privacy@xhr.dev)
