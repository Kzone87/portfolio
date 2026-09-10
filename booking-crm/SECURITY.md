# BOOKING CRM Security Boundary

Production deployments require persistent SQLite storage, an explicit allowed origin, a unique bootstrap administrator secret, localhost application binding and HTTPS termination at a reverse proxy.

Employee passwords use scrypt with per-user random salt. Browser session bearer values are held in HttpOnly SameSite=Strict cookies; only SHA-256 session identifiers are stored in SQLite. Authenticated mutations require CSRF, and employee-administration endpoints require ADMIN. Role changes, deactivation and password reset revoke active sessions. The last active administrator cannot be removed or demoted.

Public booking/inquiry submission is rate-limited in process and should additionally be rate-limited at the production reverse proxy for multi-process or hostile-traffic environments. This single-node package is not a substitute for a WAF or distributed rate limiter.

Secrets, `.env`, SQLite databases, backup manifests/snapshots, TLS private keys and customer data must not be placed in the public static directory or source repository.
