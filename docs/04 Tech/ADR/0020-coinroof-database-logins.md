---
type: adr
status: active
owner: Dinesh
updated: 2026-11-15
issue: 324
tags: [adr, security, backend]
---

# 0020 — The database logins take Coinroof's name

- **Status:** Accepted
- **Date:** 2026-11-15
- **Ticket:** #324
- **Supersedes:** the role names in [[0006-separate-database-logins]] and [[0005-bank-sync-system-role]] (`tallyn_api`, `tallyn_sync`). Everything else in them stands.

## Context
The rename to Coinroof (#324) reached the two narrow database logins last. Postgres roles belong to the whole server, not one database. Each test database replays every migration, so 0005 and 0006 recreate `tallyn_*` beside `coinroof_*` roles left by the previous test, and a plain `ALTER ROLE … RENAME` fails. Old migrations can't be edited.

## Options considered
1. **Copy the access to new roles (chosen).** 0034 creates `coinroof_api` and `coinroof_sync` as 0005/0006 did, copies every grant (schema, table, column, function) and policy that `tallyn_*` hold in the database by reading the catalog, then revokes them from `tallyn_*`.
2. **Make `coinroof_*` members of `tallyn_*`.** Simpler, but adds role inheritance that ADR 0006 rules out on purpose.
3. **Keep the Tallyn names.** Nobody sees them, but the code would keep two names for one product.

## Decision
Option 1. `coinroof_api` may only `SET ROLE authenticated` (no inheriting), as before; `coinroof_sync` keeps exactly the bank sync's rights. The `tallyn_*` roles are left empty and dropped by hand once no login uses them. New migrations grant to `coinroof_sync`.

## Consequences
- Each project needs passwords for the `coinroof_*` logins and new `DATABASE_URL`/`DATABASE_URL_SYNC` straight after 0034 (Dev Setup → Database logins); until then the server can't reach the database.
- `TestOldTallynRolesAreEmpty` and the login attack tests (now run as `coinroof_*`) guard the boundary.
