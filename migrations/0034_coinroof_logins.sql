-- 0034: the database logins take Coinroof's name (#324, ADR 0020).
--
--   tallyn_api  -> coinroof_api   (request handlers, ADR 0006)
--   tallyn_sync -> coinroof_sync  (the bank sync, ADR 0002, 0005)
--
-- Roles belong to the whole Postgres server, not one database, so a plain
-- ALTER ROLE ... RENAME can't be used: every test database replays 0005 and
-- 0006, which recreate tallyn_* beside the coinroof_* roles already there.
-- Instead this copies what tallyn_* may do in *this* database to coinroof_*,
-- then takes it all away from tallyn_*. It reads the grants from the catalog,
-- so it copies exactly what 0005-0033 granted, whatever that was.
--
-- The new roles start without LOGIN, as 0006's did. An admin turns login on
-- in the Supabase SQL editor (see Dev Setup), then points DATABASE_URL and
-- DATABASE_URL_SYNC at them:
--   alter role coinroof_api  with login password '...';
--   alter role coinroof_sync with login password '...';
-- The emptied tallyn_* roles stay until an admin drops them by hand.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'coinroof_api') then
    create role coinroof_api nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'coinroof_sync') then
    create role coinroof_sync nologin noinherit;
  end if;
end
$$;

-- Same memberships as 0005 and 0006: coinroof_api may only SET ROLE
-- authenticated (no inheriting); the migration user may become coinroof_sync.
grant authenticated to coinroof_api with inherit false, set true;
grant coinroof_sync to current_user;

do $$
declare
  pair  record;
  g     record;
  pol   record;
  roles text;
begin
  for pair in select * from (values ('tallyn_api', 'coinroof_api'), ('tallyn_sync', 'coinroof_sync')) v(old, new)
  loop
    if not exists (select 1 from pg_roles where rolname = pair.old) then
      continue;
    end if;

    -- Schemas (usage).
    for g in
      select n.nspname, a.privilege_type
      from pg_namespace n, aclexplode(n.nspacl) a
      where a.grantee = pair.old::regrole
    loop
      execute format('grant %s on schema %I to %I', g.privilege_type, g.nspname, pair.new);
      execute format('revoke %s on schema %I from %I', g.privilege_type, g.nspname, pair.old);
    end loop;

    -- Tables, views and sequences, whole-object grants.
    for g in
      select c.oid::regclass as obj, a.privilege_type, c.relkind
      from pg_class c, aclexplode(c.relacl) a
      where a.grantee = pair.old::regrole
    loop
      execute format('grant %s on %s %s to %I', g.privilege_type,
                     case when g.relkind = 'S' then 'sequence' else 'table' end, g.obj, pair.new);
      execute format('revoke %s on %s %s from %I', g.privilege_type,
                     case when g.relkind = 'S' then 'sequence' else 'table' end, g.obj, pair.old);
    end loop;

    -- Column grants (e.g. update (status, last_synced_at) on plaid_items).
    for g in
      select at.attrelid::regclass as obj, at.attname, a.privilege_type
      from pg_attribute at, aclexplode(at.attacl) a
      where a.grantee = pair.old::regrole and not at.attisdropped
    loop
      execute format('grant %s (%I) on table %s to %I', g.privilege_type, g.attname, g.obj, pair.new);
      execute format('revoke %s (%I) on table %s from %I', g.privilege_type, g.attname, g.obj, pair.old);
    end loop;

    -- Functions.
    for g in
      select p.oid::regprocedure as obj, a.privilege_type
      from pg_proc p, aclexplode(p.proacl) a
      where a.grantee = pair.old::regrole
    loop
      execute format('grant %s on function %s to %I', g.privilege_type, g.obj, pair.new);
      execute format('revoke %s on function %s from %I', g.privilege_type, g.obj, pair.old);
    end loop;

    -- Row-level policies: swap the old role for the new one in each.
    for pol in
      select p.polname, p.polrelid::regclass as tbl, p.polroles
      from pg_policy p
      where pair.old::regrole = any (p.polroles)
    loop
      select string_agg(case when r = 0 then 'public'
                             when r = pair.old::regrole then quote_ident(pair.new)
                             else quote_ident(r::regrole::text) end, ', ')
        into roles
        from unnest(pol.polroles) r;
      execute format('alter policy %I on %s to %s', pol.polname, pol.tbl, roles);
    end loop;
  end loop;
end
$$;

-- tallyn_api no longer becomes authenticated. Like the grants above, this
-- leaves the old role empty: logging in as it can't reach any data.
revoke authenticated from tallyn_api;
