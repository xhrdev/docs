# Data Processing Addendum

> This is a plain-language draft reflecting the move to an on-prem-only
> product. It has not been reviewed by counsel — treat it as a starting
> point until it has been.

This Data Processing Addendum ("DPA") supplements the XHR Software Inc.
License Agreement and [Privacy Policy](/privacy) (together, the
"Agreement") and is incorporated by reference. It is between XHR Software
Inc., a Delaware C-Corp ("XHR Software"), and the Customer. Where the
parties have signed an order form and agreement through Common Paper, this
DPA is part of that agreement, and if a DPA signed there conflicts with this
page, the signed version controls.

## 1. Why this DPA is narrow

XHR Software's product is on-prem software: it runs inside the Customer's
own infrastructure, and the Customer's application traffic, target-site
data, and end-user Personal Data never pass through any system operated by
XHR Software. For that data, **XHR Software does not act as a Data
Processor or Sub-processor**, because it never processes it at all.

This DPA therefore governs only the limited Personal Data XHR Software does
handle:

1. **Business contact data** (name, email, company, billing details) that
   Customer provides to purchase, administer, and receive support for a
   licence — for this, XHR Software acts as an independent Data Controller,
   as described in the [Privacy Policy](/privacy).
2. **Any data the Customer voluntarily shares with XHR Software for support
   purposes** (e.g. logs or reproduction data sent when requesting help
   debugging a deployment) — for this narrow, opt-in category, XHR Software
   acts as a Data Processor on the Customer's instructions, per the terms
   below.
3. **Data sent to our hosted evaluation services** — the trial solver,
   which XHR Software operates for prospects. These
   are opt-in and are not part of a licensed deployment. If the Customer
   (or a prospect) sends requests to them, those requests can contain
   Personal Data (target URLs, cookies including session cookies, device
   and browser characteristics, IP addresses, API keys). For that data XHR
   Software acts as a Data Processor on the Customer's instructions, per
   the terms below. The Customer should not send end-user Personal Data or
   credentials for real accounts to these services.

## 2. Definitions

Terms not defined here have the meaning given in the Agreement.

- **"Data Protection Laws"** — applicable privacy/data-protection laws,
  including EU/UK GDPR and US state laws (e.g. CCPA).
- **"Personal Data"** — data processed by XHR Software as described in
  Section 1(2) above that is defined as personal data under applicable Data
  Protection Laws.
- **"Processing," "Controller," "Processor," "Data Subject,"
  "Supervisory Authority"** — as defined in the GDPR/UK GDPR.

## 3. Obligations for support and evaluation data (Sections 1(2) and 1(3))

Where Customer shares Personal Data with XHR Software for support purposes
or sends it to the hosted evaluation services, XHR Software will:

- Process it only to provide the requested support or evaluation, per
  Customer's instructions in the Agreement or the request itself.
- Assist Customer, taking into account the nature of the processing and the
  information available to XHR Software, in responding to Data Subject
  requests and meeting its obligations under Data Protection Laws.
- Make available the information reasonably necessary to demonstrate
  compliance with this DPA, and allow for reasonable audits by Customer on
  reasonable notice, no more than once a year unless required by a
  Supervisory Authority or following a breach.
- Apply appropriate technical and organizational safeguards, consistent
  with [Security](/security).
- Ensure personnel accessing it are bound by confidentiality obligations.
- Notify Customer within 24 hours of any breach affecting that data.
- Delete or return it once the support request is resolved or the
  evaluation ends (and its API key is revoked), or on Customer's request,
  unless retention is required by law. Operational logs of the evaluation
  services are kept for 15 days.
- Not sell it, or use it for any purpose other than the support or
  evaluation request.

## 4. Sub-processors

For licensed on-prem use, XHR Software's sub-processors are limited to the
general business tooling listed on the [Subprocessors](/subprocessors) page
(contracts, banking, code hosting, email) — none of which receive
Customer's application or end-user data, since XHR Software itself never
receives it. The hosting vendors behind the evaluation services are listed
on the same page and apply only to data described in Section 1(3).

Customer authorises these sub-processors. XHR Software remains responsible
for them, imposes data-protection obligations on them no less protective
than this DPA, and will give Customer notice of changes as described on the
Subprocessors page, so that Customer can object on reasonable data-protection
grounds.

## 5. Customer responsibility

Because XHR Software's software runs inside Customer's own infrastructure,
Customer is the Data Controller (and, where applicable, the Data Processor
to its own end users) for all Personal Data processed by the Software. XHR
Software has no visibility into, and cannot fulfill Data Subject requests
regarding, that data — Customer is responsible for its own compliance
obligations with respect to it, including any data protection impact
assessment or Data Subject rights processes.

## 6. International transfers

XHR Software is a US company and its vendors operate primarily in the
United States. Where Personal Data subject to EU/UK GDPR is transferred to
the US in connection with this DPA, the parties rely on the EU-US Data
Privacy Framework where the recipient is certified, and otherwise on the
Standard Contractual Clauses (and the UK Addendum) which are incorporated by
reference, with Customer as exporter and XHR Software as importer.

## 7. Contact

[legal@xhr.dev](mailto:legal@xhr.dev)
