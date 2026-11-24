# Sub-processors of xhr.dev

**Updated: 2026-10-18**

xhr.dev's product is on-prem software: it runs inside your infrastructure,
and your application traffic and end-user data never pass through any
system XHR Software Inc. operates. As a result, the list of vendors that
touch **licensed production use** is limited to the ones that support our
**business operations** — contracts, billing and banking, code hosting, and
email — none of which receive your application or end-user data. See the
[Data Processing Addendum](/dpa) for why this list is narrow, and
[Security](/security) for how the software itself avoids sending data back
to us.

There is one exception, and it is opt-in: the **hosted evaluation
service** (the trial solver) is run by us, so data you send to it does pass
through systems we operate. The vendors behind it are listed separately
below.

This list is accurate as of 2026-11-15 and will be updated as our vendors
change. Customers will be notified of significant updates per their
licensing agreement.

## Business operations (all customers)

- **Common Paper**
  Contract management and e-signature for licence agreements, order forms,
  and the DPA. Receives the business contact details of signatories (name,
  email, company) and, where the order form uses Common Paper's integrated
  billing, the billing details needed to charge you. See their own privacy
  policy for how they handle that data.

- **Mercury**
  Business bank. Where a licence is paid by invoice rather than through
  Common Paper, we send you an invoice and receive payment (ACH/wire) into
  our Mercury account. Receives the payer's name and bank/payment details
  as part of the transfer.

- **Google Workspace**
  Business email, calendar and call scheduling. Receives the business
  contact details and correspondence you send us, including any
  support-related messages.

- **GitHub**
  Code hosting, container image registry (`ghcr.io`), and issue tracking.
  When you pull the image, GitHub sees the GitHub account whose token you
  authenticate with.

- **GitHub Pages**
  Hosting for this documentation site and the marketing site (`xhr.dev`).
  Both are static, with no cookies or analytics; GitHub receives only
  ordinary web traffic (page requests), not any data from your deployment.

- **Fly.io**
  Serves redirects for our secondary domain (`xhrdev.com`) to `xhr.dev`.
  Receives only the request (IP address, path) of visitors who use that
  old domain.

- **Amazon Web Services (DNS)**
  DNS (Route 53) for our domains.

## Hosted evaluation services (opt-in, prospects only)

These apply only if you choose to send requests to our hosted trial solver
(`trial.xhr.dev` or the trial box the examples point at). They are not used
by a licensed on-prem deployment.

- **Oracle Cloud Infrastructure**
  Virtual machine hosting the trial solver (Ashburn, Virginia). Evaluation logs are kept for 15
  days. Receives the evaluation
  requests you send (target URLs, challenge documents, cookies, device
  profile data, and your API key) and the operational logs the solver
  writes.

- **Better Stack**
  Uptime monitoring and the public status page (`status.xhr.dev`). Its
  monitors call our health and synthetic-check endpoints, which solve
  against our own test targets; it receives no customer or evaluation data.
  The synthetic checks run on AWS Lambda in `us-east-1`.

Please do not send production credentials, session cookies for accounts
you do not control, or end-user personal data to the evaluation services.

For questions about our sub-processors, contact
[legal@xhr.dev](mailto:legal@xhr.dev).
