# Premium Service Roadmap

The commercial baseline answers: **can this be safely handed to a customer?**

The premium roadmap answers: **does the product reduce work, prevent problems and improve the customer's operation every day?**

The design principle is **Reactive Tool → Proactive Service**. Premium features must create measurable operating value rather than add decorative dashboard surface area.

## 1. NEXA SERVICE SUITE — Service Excellence

Priority: **P0 / first implementation**

Move from request/dispatch tracking to proactive service operations:

- configurable internal response targets by business impact; these are not public SLA promises unless the customer contract explicitly adopts them
- on-track / at-risk / overdue / met / breached service-case state
- durable notification outbox with idempotent events, bounded exponential retry and dead-letter state
- provider-neutral SMS/email/webhook adapter boundary; no provider credentials in source or browser code
- customer completion feedback (CSAT) accepted once per closed service case
- response-time, breach, notification-health and CSAT operating metrics
- reconciliation so missed application events can be recovered from the source-of-truth operational database
- later: preventive-maintenance schedules, device history, repeat-fault detection and parts/visit recommendations

The long-term moat is not generic CRM. It is the ability to turn device/service history into earlier intervention and fewer customer stoppages.

## 2. BOOKING CRM — Attendance & Relationship Automation

Priority: **P1**

- confirmation/reminder/follow-up outbox
- configurable reminder windows
- waitlist and cancellation-fill workflow
- recurring bookings and staff/service availability
- no-show and cancellation-rate metrics
- post-visit CSAT and rebooking prompts
- customer consent/preferences for communication

Primary value: reduce no-shows, manual calling and empty capacity.

## 3. MONO OPERATIONS — Operations Intelligence

Priority: **P1**

- SLA/deadline-aware unified work inbox
- saved views and ownership rules
- automation rules with preview, approval and audit
- anomaly/queue-pressure signals
- scheduled operational summaries
- integration-health score from retry/dead-letter/provider state
- AI suggestions remain evidence-grounded and human-approved for sensitive actions

Primary value: managers see work that will become a problem before it becomes a problem.

## 4. Excel Workbench — Data Quality Intelligence

Priority: **P2**

- data-profile and quality score before transformation
- explainable issue groups and column-level diagnostics
- reusable organization recipes/policy packs
- before/after quality delta
- batch evidence report suitable for handoff or audit
- privacy remains local-first: workbook rows stay in browser memory

Primary value: move from file cleanup to a repeatable data-quality process.

## 5. OPS KIT — Release Assurance Packs

Priority: **P2**

- reusable release/security policy packs
- one evidence bundle across all utility checks
- release scorecard and explicit NO_GO causes
- signed/hash-verifiable evidence package
- comparison against prior release evidence

Primary value: turn isolated checks into a lightweight release-control process.

## Cross-product premium contract

Every premium capability should satisfy these rules:

1. **Proactive:** surface risk or next action before the user manually searches for it.
2. **Measurable:** expose an operational outcome such as response time, backlog, failure rate, no-show rate, quality delta or CSAT.
3. **Recoverable:** scheduled/event work uses durable state, idempotency and replay/reconciliation where appropriate.
4. **Auditable:** automation never erases who/what/when/why.
5. **Portable:** customer data and configuration can be exported or recovered without vendor lock-in.
6. **Secure by default:** server-side secrets, least privilege, fail-closed production config, bounded inputs and privacy-aware logs.
7. **Human control:** high-impact financial, service, approval and AI decisions keep explicit review boundaries.
8. **Honest scope:** a configured operational target is not marketed as a contractual SLA until the contract says so.

## Development order

1. Finish and verify the current commercial baseline on `main`.
2. Build NEXA Service Excellence domain/store/outbox/reconciliation and tests.
3. Integrate NEXA inquiry/customer/operations surfaces and production worker configuration.
4. Extend the same durable event pattern to Booking CRM reminders/follow-up.
5. Add MONO deadline/rule intelligence.
6. Add local-first quality/evidence intelligence to Excel Workbench and OPS KIT.
7. Run each product's full same-SHA commercial/live acceptance gates before calling the premium layer complete.
