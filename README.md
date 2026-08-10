# SafetyCore Production

te fisrt image is the image for the signup, its a demo so those are the emails an password for the differen dashboards
You are building the production version of the SafetyCore pharmacovigilance platform.

I am attaching a ZIP file containing the actual SafetyCore frontend prototype.

IMPORTANT:

The attached SafetyCore ZIP is the PRIMARY SOURCE OF TRUTH for the UI.

Do NOT redesign it.

Do NOT create a “similar” dashboard.

Do NOT reinterpret the visual design.

Do NOT replace the layout with your own SaaS design.

Your job is to take the actual SafetyCore frontend prototype and turn it into a real production application by connecting its existing UI and workflows to Supabase.

The existing Sentinel project is a SECONDARY SOURCE OF TRUTH for pharmacovigilance business/domain logic only.

==================================================

1. FIRST: INSPECT EVERYTHING

==================================================

Before writing significant code, inspect the entire attached ZIP.

Read and understand:

- safetycore.html

- safetycore-app.html

- all CSS

- all JavaScript

- README files

- prototype data

- navigation

- modals

- forms

- tables

- filters

- dashboard cards

- role switching

- workflow states

- buttons

- notifications

- case screens

- WhatsApp screens

- signal screens

- reporting screens

- QMS/SOP screens

- search

- E2B/export UI

- empty states

- loading states

- error states

Do not only inspect the screenshots.

Inspect the actual HTML/CSS/JS because the prototype contains behavioral and data requirements that may not be obvious from screenshots.

Create an internal mapping:

SafetyCore UI element

→ required data

→ required database table

→ required CRUD operation

→ required permission

→ required calculated value

→ required external integration, if any.

==================================================

2. SAFETYCORE UI MUST REMAIN THE UI AUTHORITY

==================================================

The final application must visually and structurally reproduce the SafetyCore prototype.

Preserve:

- colors

- typography

- spacing

- cards

- borders

- shadows

- navigation

- sidebar

- header

- tables

- buttons

- badges

- icons

- modals

- forms

- dashboard structure

- case workbench structure

- responsive behavior

- interaction patterns

If the prototype has a particular visual hierarchy, preserve it.

If the prototype has a particular screen layout, reproduce it.

Do not make a “modernized interpretation.”

The goal is:

SAFETYCORE PROTOTYPE

        ↓

REAL PRODUCTION IMPLEMENTATION

NOT:

SAFETYCORE PROTOTYPE

        ↓

NEW DESIGN INSPIRED BY SAFETYCORE

==================================================

3. REMOVE PROTOTYPE-ONLY AUTH

==================================================

The prototype contains a fake/demo sign-in experience.

Do not use mock authentication.

Replace the prototype authentication with:

Supabase Auth

The public SafetyCore landing page should lead to the real authentication page.

After successful authentication:

authenticate user

→ load profile

→ determine role

→ load correct dashboard

→ enforce permissions

Do not allow users to select a role from the UI.

The role must come from the authenticated user's profile.

==================================================

4. SUPABASE IS THE REAL BACKEND

==================================================

Use:

- Supabase PostgreSQL

- Supabase Auth

- Supabase Row Level Security

- Supabase Storage where attachments are required

Do not use mock arrays as the source of truth.

Do not use localStorage as the database.

Do not hardcode dashboard numbers.

Do not create fake success responses.

Every important operation must persist to Supabase.

==================================================

5. DATABASE MUST BE DERIVED FROM THE ACTUAL UI

==================================================

Inspect every feature in SafetyCore and determine what data it actually requires.

Use the following as the initial domain model, but modify it when the actual prototype requires additional fields.

Core tables:

organizations

profiles

products

sites

cases

case_assignments

case_codings

case_follow_ups

case_audit_events

case_submissions

signals

signal_reviews

aggregate_reports

qms_entries

whatsapp_threads

whatsapp_messages

whatsapp_extracts

notifications

attachments

If the prototype requires another table, create it.

If a proposed table is not actually required, don't create it unnecessarily.

==================================================

6. CASE MODEL

==================================================

Cases need to support the actual fields and workflow visible in SafetyCore.

At minimum support:

- case number

- status

- source channel

- reporter information

- patient context

- product

- batch information

- event description

- onset date

- seriousness

- seriousness criteria

- severity

- site

- assignee

- receipt date

- due date

- submission state

- outcome

- created/updated timestamps

Do not assume that all calculated values need database columns.

Derived values such as:

- overdue

- days to due

- workflow completion

- readiness

- KPI counts

should generally be calculated from authoritative data.

==================================================

7. ROLE SYSTEM

==================================================

Support these roles:

FIELD_ASSOCIATE

PV_COORDINATOR

PV_MANAGER

ADMIN

The role model must match the existing Sentinel domain rules where applicable.

FIELD ASSOCIATE:

- create basic reports

- submit own intake

- cannot access the full team queue

- cannot approve/refute signals

- cannot generate aggregate reports

PV COORDINATOR:

- create cases

- work assigned cases

- update assigned cases

- perform coding

- manage follow-ups

- work WhatsApp intake

- move cases through workflow

- cannot approve/refute signals

- cannot generate management aggregate reports

PV MANAGER / QPPV:

- organization-wide case visibility

- assign/reassign cases

- review cases

- approve/refute signals

- generate aggregate report drafts

- manage regulatory workflow

- perform management actions

ADMIN:

- manage users

- manage roles

- manage products

- manage sites

- manage system configuration

- full operational access

==================================================

8. SECURITY IS NOT JUST UI HIDING

==================================================

Implement Supabase RLS.

The UI must hide unauthorized functionality, BUT UI hiding is NOT the security mechanism.

Database policies must independently enforce authorization.

Examples:

Coordinator:

Can only access cases they are permitted to work on.

Manager:

Can access cases within their organization.

Admin:

Can access system-level data.

Audit events:

Must be append-only.

Users must never be able to modify another user's audit history.

Never expose service-role credentials to the browser.

Never bypass RLS from client-side code.

==================================================

9. REAL WORKFLOWS

==================================================

Every visible workflow must actually work.

CASE INTAKE:

SafetyCore intake form

→ validation

→ create case

→ calculate workflow state

→ assign if appropriate

→ create audit event

→ return case number

→ show success state

CASE ASSIGNMENT:

Manager

→ selects coordinator

→ assignment persists

→ audit event created

→ coordinator sees case in their queue

CODING:

Case

→ coding workspace

→ search dictionary

→ save coding

→ persist coding

→ audit event

FOLLOW-UP:

Case

→ create follow-up

→ assign owner

→ set due date

→ update response/status

→ persist

→ audit event

CASE WORKFLOW:

Intake

→ Triage

→ Coding

→ Follow-up

→ Review

→ Regulatory readiness

→ Submission

The exact states must follow the prototype.

==================================================

10. DASHBOARDS

==================================================

The SafetyCore dashboard layouts must be reproduced faithfully.

Do not invent a different dashboard.

Manager dashboard must use real Supabase data.

Coordinator dashboard must use role-scoped data.

All KPIs must be calculated from actual database records.

Examples:

- open cases

- overdue cases

- serious cases

- cases awaiting coding

- cases awaiting follow-up

- cases awaiting review

- submissions

- signals

- workload

Never hardcode these values.

==================================================

11. WHATSAPP

==================================================

The prototype contains a WhatsApp-style intake workflow.

Implement the UI and persistence model.

Store:

- thread

- messages

- sender

- timestamps

- consent

- extracted information

- minimum-information criteria

- linked case

A WhatsApp conversation may be converted into a formal case once the required information is available.

IMPORTANT:

Do not pretend that a real WhatsApp Business API exists if credentials/integration are not provided.

Build the persistence and workflow layer now.

Clearly mark the external WhatsApp Business API integration as pending if required.

==================================================

12. SIGNAL DETECTION

==================================================

Implement the SafetyCore signal workflow using real case data.

Do not present static mock signals as real signals.

Signal detection should derive candidate signals from actual case data.

Store:

- product

- reaction/event term

- supporting case count

- detection period

- status

- review information

- reviewer

- review decision

- review timestamp

- notes

Managers/QPPV can review signals.

If the prototype uses a simplified threshold, implement that threshold transparently.

Do not claim that it is a validated pharmacovigilance statistical signal detection methodology.

==================================================

13. AGGREGATE REPORTING

==================================================

The prototype contains aggregate reporting functionality.

Implement:

report type

product

date range

case selection/filter

generated draft

summary

generation timestamp

created by

status

The report must be generated from real case data.

Do not create fake report content.

If regulatory submission itself requires an external gateway, keep the draft/export functionality separate from actual regulatory submission.

==================================================

14. QMS / SOP

==================================================

Implement the QMS/SOP interface shown in SafetyCore.

Persist:

- event

- type

- description

- actor

- timestamp

- status

- relevant references

Apply role restrictions according to the prototype and Sentinel domain model.

==================================================

15. SEARCH

==================================================

Global search must use real database queries.

Support the fields actually searchable in SafetyCore.

Do not search only the currently loaded client-side array.

Add appropriate indexes.

==================================================

16. NOTIFICATIONS

==================================================

Notifications must be persistent.

Generate notifications for relevant events such as:

- overdue cases

- approaching regulatory deadlines

- assignment

- follow-up due

- signal review

- WhatsApp inbound

- workflow changes

Store:

user

type

message

entity

read/unread

created_at

==================================================

17. AUDIT TRAIL

==================================================

Because this is pharmacovigilance software, meaningful changes must be auditable.

Store:

- actor

- action

- entity

- entity ID

- timestamp

- before state where appropriate

- after state where appropriate

- metadata

The audit trail should be append-only.

Do not provide a normal UI operation that edits or deletes historical audit events.

==================================================

18. ATTACHMENTS

==================================================

Where the prototype requires file attachments:

Use Supabase Storage.

Store metadata in an attachments table.

Do not store large binary files directly inside PostgreSQL.

Apply organization/user access restrictions.

==================================================

19. EXISTING SENTINEL PROJECT

==================================================

The existing Sentinel repository should be inspected for:

- pharmacovigilance business rules

- roles

- case workflow

- seriousness logic

- regulatory clock rules

- case fields

- coding concepts

- follow-up concepts

- audit concepts

Use Sentinel as a DOMAIN REFERENCE.

Do not blindly copy its Prisma schema into Supabase.

Translate the required domain concepts into a clean PostgreSQL/Supabase design.

==================================================

20. IMPORTANT: DO NOT FABRICATE MISSING INTEGRATIONS

==================================================

Some prototype features may require external systems.

Examples:

- licensed MedDRA / WHO-DD

- WhatsApp Business API

- regulatory E2B gateway

- advanced statistical signal detection

- formal compliance/validation systems

If credentials or external services are unavailable:

BUILD THE INTERNAL DATA MODEL AND UI WORKFLOW.

Do NOT fake the external integration.

Clearly identify:

IMPLEMENTED

PARTIALLY IMPLEMENTED

EXTERNAL INTEGRATION REQUIRED

PENDING PRODUCT DECISION

==================================================

21. PRODUCTION SECURITY

==================================================

This application handles sensitive pharmacovigilance information.

Implement:

- RLS

- server-side authorization

- input validation

- secure authentication

- protected routes

- no secrets in frontend

- no service-role keys in browser

- safe error messages

- audit logging

- organization isolation

- appropriate database indexes

- secure file storage

- environment variables

- no debug/auth bypass routes

- no hardcoded credentials

- no fake authentication

==================================================

22. DO NOT STOP AT UI

==================================================

A page is NOT considered implemented just because it looks correct.

For every feature:

UI

↓

user action

↓

validation

↓

Supabase operation

↓

database persistence

↓

authorization/RLS

↓

updated UI state

↓

audit/notification where required

must work end-to-end.

==================================================

23. IMPLEMENTATION ORDER

==================================================

Build in this order:

P0 — Core production system

1. SafetyCore landing page

2. Real Supabase authentication

3. Profiles + roles

4. RLS

5. Case database

6. Case intake

7. Manager dashboard

8. Coordinator dashboard

9. Case workbench

10. Case workflow

11. Coding

12. Follow-up

13. Audit trail

P1 — Operational platform

14. WhatsApp persistence/workflow

15. Signals

16. Signal review

17. Aggregate reports

18. QMS/SOP

19. Search

20. Notifications

21. CSV/export

P2

22. Attachments

23. E2B generation

24. Admin console

25. Advanced filtering/pagination

P3 — External/enterprise integrations

26. WhatsApp Business API

27. Licensed MedDRA/WHO-DD

28. Regulatory gateway

29. Advanced validated signal detection

30. Formal compliance/validation work

==================================================

24. TEST EVERYTHING

==================================================

Do not simply report that something was implemented.

Actually test:

- registration/login

- logout

- role routing

- coordinator permissions

- manager permissions

- admin permissions

- case creation

- case editing

- assignment

- coding

- follow-up

- audit trail

- dashboards

- search

- notifications

- RLS isolation

- invalid inputs

- unauthorized requests

- empty states

- loading states

- error states

- responsive UI

Test with multiple roles.

Verify that a coordinator cannot access manager-only data by manipulating requests directly.

==================================================

25. FINAL DELIVERABLE

==================================================

The final application should be:

SafetyCore UI

+

real Supabase backend

+

Supabase Auth

+

RLS

+

real workflows

+

real persistence

+

role-specific dashboards

+

auditability

+

production-safe architecture.

Do not tell me that something “works” unless you actually tested it.

At the end, provide:

1. What was implemented

2. Supabase tables created

3. RLS policies created

4. Auth/role implementation

5. Features fully working

6. Features partially working

7. External integrations still required

8. Environment variables required

9. Tests performed

10. Known limitations

MOST IMPORTANT:

Do not replace the SafetyCore UI with your own interpretation.

The attached SafetyCore prototype is the visual source of truth.

Preserve it and make it real.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5c0ebd8f-0547-46f7-ae3b-55d9b166e62f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
