# Commercial Delivery Matrix

This repository contains products with different delivery architectures. A product is considered commercially deliverable only inside the explicit boundary below; a public demo is not treated as proof of a commissioned customer deployment.

| Product | Delivery type | Persistent customer data | Auth/RBAC | Backup/restore | Verified handover artifact | Production acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| NEXA SERVICE SUITE | Single-node Node.js + SQLite + HTTPS proxy | Yes | Employee session/RBAC + customer OTP session | Verified SQLite snapshots + restore | NEXA delivery build | API, RBAC, handoff, persistence, backup/restore, Chrome |
| BOOKING CRM | Single-node Node.js + SQLite + HTTPS proxy | Yes | ADMIN/STAFF, HttpOnly session, CSRF | Verified SQLite snapshot manifest + guarded restore | `dist/booking-crm-delivery` + SHA-256 manifest | Booking/inquiry/CRM/account lifecycle/persistence/restore/Chrome |
| MONO OPERATIONS | Single-node Node.js + SQLite + HTTPS proxy | Yes | Employee session/RBAC + CSRF | Verified database operations | `dist/mono-operations-delivery` + manifest | Real HTTP/SQLite/Chrome commercial workflow |
| Excel Workbench | Static local-first browser application | No workbook persistence | Not applicable by contract | Not applicable; source files remain customer-owned | Verified `dist/` + SHA-256 manifest | File import/transform/download + settings + Chrome |
| OPS KIT | Static local-first browser utility | No | Not applicable by contract | Not applicable | `dist/ops-kit-delivery` + SHA-256 manifest | Tool actions, failure/success simulation + Chrome |

## Meaning of “commercially deliverable”

For server-backed products it means the repository contains a fail-closed production runtime, durable data model, authentication/authorization appropriate to the stated scope, operational recovery, deployment configuration, acceptance tests, and a handover process. Customer-specific domains, TLS certificates, secrets, message-provider credentials, infrastructure accounts, and organization data are installation inputs and are never hard-coded into the product.

For static local-first tools it means the lack of a backend is intentional and documented. Their contract excludes shared server state and server-side restore. Deliverability is established by a verified static artifact, privacy boundary, supported-file limits where relevant, browser workflow tests, and deployment instructions.

## Out-of-scope upgrades

None of these packages silently promises high availability, multi-region disaster recovery, multi-tenant SaaS isolation, regulated-industry certification, SSO/SCIM, payment-card handling, or arbitrary customer integrations. Those requirements change the architecture and require a new commercial scope and acceptance gate.
