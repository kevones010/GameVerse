# GameVerse Supabase development database

This directory contains only the isolated database foundation for Sprint 9.0B.
The GameVerse frontend still uses its local repositories and is not connected to
Supabase.

## Prerequisites

- Supabase CLI compatible with this `config.toml`
- Docker Desktop or another Docker-compatible runtime
- PostgreSQL 15 local image, selected by `config.toml`

Do not link this directory to a production project. No remote project is required
for the database and RLS tests.

## Reproduce the development database

```powershell
supabase start
supabase db reset --local
supabase test db
```

`db reset --local` rebuilds only the local development database, applies the
three migrations in order, and then runs `seed.sql`.

The pgTAP suite under `tests/database` covers schema/RLS presence, the critical
Auth profile trigger, ANON/USER_A/USER_B authorization, database constraints,
soft delete and aggregate RPC behavior, and the development seed invariants.
The seven files currently declare 183 assertions. A matching `plan(...)` is
kept in every file so incomplete test execution fails visibly.

## Migration order

1. `202609090001_initial_schema.sql`: tables, constraints, FKs, validation helpers and indexes.
2. `202609090002_database_functions.sql`: triggers and the two minimal aggregate RPCs.
3. `202609090003_rls_and_grants.sql`: grants and RLS policies.

## Development seed

The seed creates two non-login demo Auth rows, the matching profiles, and four
posts. It deliberately creates no fake interaction. When a login-capable demo
account is needed, create it through the local Auth API or Studio with a temporary
password that is not committed.

## Rollback during development

Supabase migrations are forward-only. Prefer a corrective migration after a
migration has been shared. Before sharing, a local developer may correct a file
and run `supabase db reset --local` to recreate the disposable local database.

For a forward rollback, remove objects in dependency order:

1. RLS policies and explicit grants.
2. Public aggregate RPCs.
3. Trigger on `auth.users`, then table triggers and private trigger functions.
4. Tables in child-first order: reports, reviews/ratings/favorites, follows,
   saved posts, likes, comments, posts, profiles.
5. Private validation functions and the private schema.

Never use a linked reset as a rollback unless the linked target has been
independently verified as a disposable development environment.

## Security boundaries

- Individual likes, saved posts, favorites and ratings are private.
- Aggregate RPCs return counts/averages only and never return user IDs.
- Ownership and immutable columns are protected by RLS plus column grants.
- Normal post, comment and review deletion is a status update; physical DELETE
  is not granted.
- No privileged server credential or user password belongs in this directory.

## Profile avatar keys

The database stores a short local key such as `default`, `happy` or `purple`,
not an asset URL. It validates a conservative lowercase key format while the
current six-item Vee allowlist remains an application concern. This keeps an
invalid URL or path out of profile metadata without requiring a database
migration whenever a new local Vee avatar is added.

## Client grants

`anon` receives `SELECT` only for active profiles, public posts, published
comments on visible posts, public follows and public reviews. It may execute
the two aggregate RPCs but cannot read their underlying private relations.

`authenticated` receives the same public reads plus RLS-filtered reads of its
own likes, saves, reports, favorites and ratings. Column grants allow only the
editable profile/content fields. Ownership, canonical IDs, administrative
state and timestamps are derived or controlled by the database. Physical
`DELETE` is granted only for the removable relationship/data rows that need
it: likes, saved posts, follows, favorites and ratings; posts, comments
and reviews use status-based soft delete.
