begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

create or replace function pg_temp.sqlstate_of(statement text)
returns text
language plpgsql
as $$
begin
  execute statement;
  return null;
exception
  when others then
    return sqlstate;
end;
$$;

create or replace function pg_temp.row_count_of(statement text)
returns bigint
language plpgsql
as $$
declare
  affected bigint;
begin
  execute statement;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'lifecycle-a@example.test',
    '{"handle":"lifecycle_a","display_name":"Lifecycle A"}'::jsonb
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'lifecycle-b@example.test',
    '{"handle":"lifecycle_b","display_name":"Lifecycle B"}'::jsonb
  );

insert into public.posts (id, author_id, title, content, type)
values
  (
    '41000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    'Post removível A',
    'Este post será removido logicamente durante o teste.',
    'discussion'
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    'Post agregado B',
    'Este post permanece publicado para testar os agregados.',
    'guide'
  );

insert into public.comments (id, post_id, author_id, content)
values (
  '42000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000001',
  'Este comentário será removido logicamente.'
);

insert into public.game_reviews (user_id, rawg_game_id, content, visibility)
values (
  '40000000-0000-4000-8000-000000000001',
  9001,
  'Esta análise pública será removida logicamente.',
  'public'
);

insert into public.likes (user_id, post_id)
values
  ('40000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002'),
  ('40000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002');

insert into public.saved_posts (user_id, post_id)
values ('40000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002');

insert into public.game_ratings (user_id, rawg_game_id, rating)
values
  ('40000000-0000-4000-8000-000000000001', 9001, 4),
  ('40000000-0000-4000-8000-000000000002', 9001, 2);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.sqlstate_of($sql$
    update public.posts
    set status = 'deleted'
    where id = '41000000-0000-4000-8000-000000000001'
  $sql$),
  null,
  'owner can soft-delete a post'
);

select is(
  pg_temp.sqlstate_of($sql$
    update public.comments
    set status = 'deleted'
    where id = '42000000-0000-4000-8000-000000000001'
  $sql$),
  null,
  'owner can soft-delete a comment'
);

select is(
  pg_temp.sqlstate_of($sql$
    update public.game_reviews
    set status = 'deleted'
    where user_id = '40000000-0000-4000-8000-000000000001'
      and rawg_game_id = 9001
  $sql$),
  null,
  'owner can soft-delete a game review'
);

reset role;

select ok(
  exists (
    select 1
    from public.posts
    where id = '41000000-0000-4000-8000-000000000001'
      and status = 'deleted'
      and deleted_at is not null
  ),
  'soft-deleted post is retained with deleted_at'
);

select ok(
  exists (
    select 1
    from public.comments
    where id = '42000000-0000-4000-8000-000000000001'
      and status = 'deleted'
      and deleted_at is not null
  ),
  'soft-deleted comment is retained with deleted_at'
);

select ok(
  exists (
    select 1
    from public.game_reviews
    where user_id = '40000000-0000-4000-8000-000000000001'
      and rawg_game_id = 9001
      and status = 'deleted'
      and deleted_at is not null
  ),
  'soft-deleted review is retained with deleted_at'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select is(
  (select count(*) from public.posts where id = '41000000-0000-4000-8000-000000000001'),
  0::bigint,
  'anonymous users cannot see a soft-deleted post'
);

select is(
  (select count(*) from public.comments where id = '42000000-0000-4000-8000-000000000001'),
  0::bigint,
  'anonymous users cannot see a soft-deleted comment'
);

select is(
  (
    select count(*)
    from public.game_reviews
    where user_id = '40000000-0000-4000-8000-000000000001'
      and rawg_game_id = 9001
  ),
  0::bigint,
  'anonymous users cannot see a soft-deleted review'
);

select is(
  (
    select comments_count
    from public.get_post_interaction_counts(
      array['41000000-0000-4000-8000-000000000002'::uuid]
    )
  ),
  0::bigint,
  'post aggregate ignores soft-deleted comments'
);

select is(
  (
    select likes_count
    from public.get_post_interaction_counts(
      array['41000000-0000-4000-8000-000000000002'::uuid]
    )
  ),
  2::bigint,
  'post aggregate returns the like count without identities'
);

select is(
  (
    select saves_count
    from public.get_post_interaction_counts(
      array['41000000-0000-4000-8000-000000000002'::uuid]
    )
  ),
  1::bigint,
  'post aggregate returns the saved count without identities'
);

select is(
  (select rating_average from public.get_game_rating_summary(9001)),
  3.00::numeric,
  'game rating aggregate returns the average'
);

select is(
  (select ratings_count from public.get_game_rating_summary(9001)),
  2::bigint,
  'game rating aggregate returns the rating count'
);

select is(
  pg_temp.sqlstate_of('select * from public.get_game_rating_summary(0)'),
  '22023',
  'game rating aggregate rejects invalid RAWG ids'
);

select is(
  pg_temp.sqlstate_of(
    'select * from public.get_post_interaction_counts(array_fill(gen_random_uuid(), array[101]))'
  ),
  '22023',
  'post aggregate rejects batches larger than 100'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.sqlstate_of($sql$
    delete from public.posts
    where id = '41000000-0000-4000-8000-000000000001'
  $sql$),
  '42501',
  'client role cannot physically delete a post'
);

select is(
  pg_temp.sqlstate_of($sql$
    delete from public.comments
    where id = '42000000-0000-4000-8000-000000000001'
  $sql$),
  '42501',
  'client role cannot physically delete a comment'
);

select is(
  pg_temp.sqlstate_of($sql$
    delete from public.game_reviews
    where user_id = '40000000-0000-4000-8000-000000000001'
      and rawg_game_id = 9001
  $sql$),
  '42501',
  'client role cannot physically delete a game review'
);

select is(
  pg_temp.row_count_of($sql$
    update public.posts
    set status = 'published'
    where id = '41000000-0000-4000-8000-000000000001'
  $sql$),
  0::bigint,
  'client cannot restore a soft-deleted post during beta'
);

select * from finish();

rollback;
