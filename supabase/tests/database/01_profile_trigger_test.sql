create extension if not exists pgtap with schema extensions;

begin;
select plan(19);

create or replace function pg_temp.sqlstate_of(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlstate;
end;
$$;

select is(
  pg_temp.sqlstate_of($sql$
    insert into auth.users (id, email, raw_user_meta_data)
    values (
      '10000000-0000-4000-8000-000000000001',
      'profile-valid@gameverse.invalid',
      '{"handle":"valid_user","display_name":"Valid User","bio":"Perfil de teste.","avatar_key":"blue"}'::jsonb
    )
  $sql$),
  null::text,
  'valid Auth metadata creates a user'
);
select ok(
  exists (select 1 from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'valid Auth metadata creates exactly one profile'
);
select is((select handle from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 'valid_user', 'handle is copied');
select is((select display_name from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 'Valid User', 'display name is copied');
select is((select bio from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 'Perfil de teste.', 'bio is copied');
select is((select avatar_key from public.profiles where id = '10000000-0000-4000-8000-000000000001'), 'blue', 'avatar key is copied');

select is(
  pg_temp.sqlstate_of($sql$
    insert into auth.users (id, email, raw_user_meta_data)
    values (
      '10000000-0000-4000-8000-000000000002',
      'profile-defaults@gameverse.invalid',
      '{"handle":"defaults_user"}'::jsonb
    )
  $sql$),
  null::text,
  'optional metadata may be absent'
);
select is((select display_name from public.profiles where id = '10000000-0000-4000-8000-000000000002'), 'defaults_user', 'display name defaults to handle');
select is((select bio from public.profiles where id = '10000000-0000-4000-8000-000000000002'), '', 'bio defaults to empty');
select is((select avatar_key from public.profiles where id = '10000000-0000-4000-8000-000000000002'), 'default', 'avatar defaults to default Vee');

select is(
  pg_temp.sqlstate_of($sql$
    insert into auth.users (id, email, raw_user_meta_data)
    values ('10000000-0000-4000-8000-000000000003', 'profile-invalid@gameverse.invalid', '{"handle":"Invalid-Handle"}'::jsonb)
  $sql$),
  '23514',
  'invalid handle aborts Auth user creation'
);
select is((select count(*) from auth.users where id = '10000000-0000-4000-8000-000000000003'), 0::bigint, 'invalid handle leaves no partial Auth user');

select is(
  pg_temp.sqlstate_of($sql$
    insert into auth.users (id, email)
    values ('10000000-0000-4000-8000-000000000004', 'profile-missing@gameverse.invalid')
  $sql$),
  '23514',
  'missing handle metadata aborts Auth user creation'
);
select is((select count(*) from auth.users where id = '10000000-0000-4000-8000-000000000004'), 0::bigint, 'missing metadata leaves no partial Auth user');

select is(
  pg_temp.sqlstate_of($sql$
    insert into auth.users (id, email, raw_user_meta_data)
    values ('10000000-0000-4000-8000-000000000005', 'profile-duplicate-base@gameverse.invalid', '{"handle":"duplicate_user"}'::jsonb)
  $sql$),
  null::text,
  'first unique handle is accepted'
);
select is(
  pg_temp.sqlstate_of($sql$
    insert into auth.users (id, email, raw_user_meta_data)
    values ('10000000-0000-4000-8000-000000000006', 'profile-duplicate@gameverse.invalid', '{"handle":"duplicate_user"}'::jsonb)
  $sql$),
  '23505',
  'duplicate handle aborts Auth user creation'
);
select is((select count(*) from auth.users where id = '10000000-0000-4000-8000-000000000006'), 0::bigint, 'duplicate handle leaves no partial Auth user');

select is(
  pg_temp.sqlstate_of($sql$
    insert into auth.users (id, email, raw_user_meta_data)
    values ('10000000-0000-4000-8000-000000000007', 'profile-avatar@gameverse.invalid', '{"handle":"avatar_user","avatar_key":"https://example.test/avatar.png"}'::jsonb)
  $sql$),
  '23514',
  'invalid avatar metadata aborts Auth user creation'
);
select is((select count(*) from auth.users where id = '10000000-0000-4000-8000-000000000007'), 0::bigint, 'invalid avatar leaves no partial Auth user');

select * from finish();
rollback;
