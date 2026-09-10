# BOOKING CRM Delivery Runbook

BOOKING CRM is a single-node small-business booking and customer-management application. The production package contains a Node.js 24 HTTP application, persistent SQLite storage, employee authentication, CSRF protection, audit history, verified backup/restore commands, deployment templates, and an integrity manifest.

## Supported commercial scope

- One customer organization per deployed instance.
- One Node.js 24 application process behind an HTTPS reverse proxy.
- Persistent SQLite database on local durable storage.
- ADMIN and STAFF employee roles.
- Public booking and inquiry intake; staff booking/customer/inquiry operations.
- Optimistic concurrency (`expectedVersion`) and slot conflict control.
- Server-side audit records for customer, booking, inquiry, and employee-administration changes.

HA clustering, multi-tenant SaaS isolation, SSO, payment processing, regulated medical/financial records, and distributed queues are separate scoped upgrades.

## Build the delivery artifact

From the repository root:

```bash
npm test
npm run build:booking-delivery
```

Handover directory:

```text
dist/booking-crm-delivery/
```

The directory contains the application, server runtime, deployment templates, backup/restore commands and `MANIFEST.json`. `MANIFEST.json` records SHA-256 and byte size for every delivered file. Do not hand over a package whose manifest does not verify.

## Production configuration

Copy `deploy/.env.example` to a protected environment file and replace every example value. Required settings:

```text
NODE_ENV=production
BOOKING_DB_PATH=/srv/booking-crm/data/booking.sqlite
BOOKING_BACKUP_DIR=/srv/booking-crm/backups
BOOKING_ADMIN_PASSWORD=<unique 12+ character secret containing letters and numbers>
BOOKING_ALLOWED_ORIGIN=https://booking.example.com
BOOKING_PORT=8798
```

The first administrator is created only when the employee table is empty. A weak first-admin password is rejected. After bootstrap, employee accounts are managed through the ADMIN-only API and password reset/deactivation immediately revokes that employee's sessions.

## Authentication and authorization

- Passwords are stored with `scrypt` plus per-user random salt.
- **HttpOnly Session:** the browser receives the bearer value only through an HttpOnly, SameSite=Strict cookie. The database stores only a SHA-256 identifier of the bearer value, not the raw session token.
- CSRF is required for authenticated mutations.
- Production cookies are `Secure`.
- STAFF can operate bookings, inquiries and customer notes.
- Employee list/create/role/activation/password-reset endpoints require ADMIN.
- The last active ADMIN cannot be deactivated or demoted.
- Deactivation, role change and password reset revoke existing sessions.

Employee lifecycle endpoints:

```text
GET   /api/admin/employees
POST  /api/admin/employees
PATCH /api/admin/employees/:id
POST  /api/admin/employees/:id/reset-password
```

## Readiness

`GET /health` is process liveness. `GET /ready` performs SQLite `PRAGMA quick_check`; an unhealthy database returns HTTP 503 and `ready:false`. A process that is alive but cannot safely use its database must not receive production traffic.

## Backup

With the service online or stopped, create a consistent SQLite snapshot using `VACUUM INTO`:

```bash
BOOKING_DB_PATH=/srv/booking-crm/data/booking.sqlite \
BOOKING_BACKUP_DIR=/srv/booking-crm/backups \
npm run backup:booking
```

The command verifies the source database, creates a SQLite snapshot, verifies the snapshot, and writes a manifest containing byte size and SHA-256. Copy backup sets to storage outside the application host according to the customer's retention policy.

## Restore

Stop the application before restore. Restore accepts the backup manifest rather than an arbitrary SQLite file and refuses to proceed without an explicit confirmation value:

```bash
sudo systemctl stop booking-crm
BOOKING_DB_PATH=/srv/booking-crm/data/booking.sqlite \
BOOKING_RESTORE_CONFIRM=RESTORE_BOOKING \
npm run restore:booking -- /srv/booking-crm/backups/manifest-<timestamp>.json
sudo systemctl start booking-crm
```

Restore verifies manifest path safety, size, SHA-256 and SQLite `quick_check`, preserves the current database as a `.pre-restore-*` copy, removes stale WAL/SHM sidecars, installs the verified snapshot, and re-runs `quick_check`. If post-restore verification fails, the pre-restore copy is put back.

## Reverse proxy and service supervisor

Use the provided examples:

```text
deploy/nginx.conf.example
deploy/booking-crm.service.example
```

The Node application binds to localhost. TLS terminates at the reverse proxy. Keep the `.env`, database, backups and TLS private keys out of the public web root and source repository.

## Acceptance gate

Before customer handover, all of the following must pass on the **same main SHA** that is packaged and deployed:

1. Repository tests and syntax checks.
2. `npm run build:booking-delivery` and manifest verification.
3. Production environment fails closed when required settings are absent.
4. `/ready` returns 200 only with a healthy database.
5. Public booking creation and `409 SLOT_CONFLICT` behavior.
6. ADMIN login, HttpOnly cookie, CSRF rejection and authorized mutation.
7. Employee create → STAFF login → ADMIN-only block → deactivate/reset → session revocation.
8. `409 STALE_BOOKING` optimistic-concurrency regression.
9. Database persistence after process restart.
10. Backup → data change → verified restore → original state recovered.
11. Real Chrome public flow at 1440 / 768 / 390 with no console errors, request failures, HTTP >=400 surprises, or horizontal overflow.
12. Customer booking → admin confirm → CRM memo → inquiry close end-to-end flow.

Release evidence must explicitly record **same-SHA production public Chrome QA PASS** for the deployed main revision before handover.

The GitHub Pages surface is the public demonstration build and intentionally does not persist customer input. A customer production deployment uses this runbook's Node/SQLite runtime and customer-specific domain, secrets and durable storage.
