# OPS KIT Delivery Runbook

OPS KIT is delivered as a local-first static browser utility. Its commercial boundary is intentionally smaller than a server-backed operations system: there is no account database, customer data store, background worker, or external API in the delivered application.

## Supported delivery scope

- Static HTTPS hosting on an internal web server, CDN, or customer web server.
- Modern Chromium/Chrome, Edge, Firefox, or Safari with JavaScript enabled.
- User input remains in the browser runtime. The application does not upload source text or files to a KZONE87 server.
- `connect-src 'none'` remains part of the public security boundary. A customer-specific integration that requires network access is a separate scoped change.
- Workflow Dry-Run is a simulation/training utility and must not be represented as a live RPA executor.

## Build the handover artifact

From the repository root with Node.js 24+:

```bash
npm test
npm run build:ops-kit-delivery
```

The handover directory is:

```text
dist/ops-kit-delivery/
```

`MANIFEST.json` contains the byte size and SHA-256 digest of every delivered file. Verify the manifest before copying the package to customer infrastructure.

## Deployment

Serve the artifact directory over HTTPS. A minimal local acceptance server can be started with any static server, for example:

```bash
python3 -m http.server 8080 --directory dist/ops-kit-delivery
```

For production, use the customer's existing HTTPS reverse proxy/static host. Do not expose directory listings.

## Backup and restore boundary

OPS KIT intentionally has no server-side user data. Therefore database backup/restore is not applicable. Customer-created exports are ordinary downloaded files and should follow the customer's own document retention policy.

## Acceptance gate

Before handover:

1. `npm test` is green.
2. `npm run build:ops-kit-delivery` succeeds.
3. Every `MANIFEST.json` digest matches the delivered file.
4. Content Preflight, Data Extractor, Workflow Dry-Run, Security Check, and Release Gate execute in a real browser.
5. Failure simulation and success simulation both produce the expected controlled result.
6. Desktop 1440px, tablet 768px, and mobile 390px have no horizontal overflow.
7. Browser console, page errors, request failures, and HTTP >=400 errors are clear during the tested flow.
8. The privacy boundary and Workflow Dry-Run simulation label remain visible.

## Customer-specific changes that require a new scope

Authentication, shared persistence, live workflow execution, external APIs, file-server integration, regulated-data controls, multi-tenant isolation, and audit retention are not hidden features of this package. If a customer needs them, the project becomes a server-backed application and must pass a new delivery review.
