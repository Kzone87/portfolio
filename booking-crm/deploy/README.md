# BOOKING CRM deployment templates

These files are examples for the defined single-node Linux deployment boundary:

- `.env.example`: required runtime environment keys; copy outside the public web root and replace all example values.
- `booking-crm.service.example`: systemd service running Node as a dedicated OS account with a restrictive umask and writable data/backup paths only.
- `nginx.conf.example`: HTTPS reverse proxy and baseline security headers.

Customer domain names, certificate paths, OS users, storage paths and secrets are installation-specific and must be reviewed during handover.
