create extension if not exists pgtap with schema extensions;

begin;
select plan(62);

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
    '20000000-0000-4000-8000-000000000001',
    'rls-user-a@gameverse.invalid',
    '{"handle":"rls_user_a","display_name":"RLS User A","avatar_key":"blue"}'::jsonb
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'rls-user-b@gameverse.invalid',
    '{"handle":"rls_user_b","display_name":"RLS User B","avatar_key":"purple"}'::jsonb
  );

insert into public.posts (id, author_id, rawg_game_id, game_name, game_slug, type, title, content)
values
  (
    '20000000-0000-4000-8000-000000000101',
    '20000000-0000-4000-8000-000000000001',
    339958,
    'Persona 5 Royal',
    'persona-5-royal',
    'guide',
    'Public post owned by User A',
    'Public content owned by User A for the RLS test suite.'
  ),
  (
    '20000000-0000-4000-8000-000000000102',
    '20000000-0000-4000-8000-000000000002',
    9767,
    'Hollow Knight',
    'hollow-knight',
    'discussion',
    'Public post owned by User B',
    'Public content owned by User B for the RLS test suite.'
  );

insert into public.comments (id, post_id, author_id, content)
values (
  '20000000-0000-4000-8000-000000000201',
  '20000000-0000-4000-8000-000000000102',
  '20000000-0000-4000-8000-000000000002',
  'Published comment owned by User B.'
);

insert into public.saved_posts (user_id, post_id)
values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000101');
insert into public.game_favorites (user_id, rawg_game_id, game_name)
values ('20000000-0000-4000-8000-000000000002', 600001, 'Private favorite B');
insert into public.game_ratings (user_id, rawg_game_id, rating)
values ('20000000-0000-4000-8000-000000000002', 600002, 5);
insert into public.game_reviews (user_id, rawg_game_id, content, visibility)
values
  ('20000000-0000-4000-8000-000000000002', 600003, 'Private review owned by User B.', 'private'),
  ('20000000-0000-4000-8000-000000000002', 600004, 'Public review owned by User B.', 'public');
insert into public.follows (follower_id, following_id)
values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is((select count(*) from public.profiles where id in ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')), 2::bigint, 'ANON reads active profiles');
select is((select count(*) from public.posts where id in ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000102')), 2::bigint, 'ANON reads published public posts');
select is((select count(*) from public.comments where id = '20000000-0000-4000-8000-000000000201'), 1::bigint, 'ANON reads published comments on visible posts');
select is((select count(*) from public.follows where follower_id = '20000000-0000-4000-8000-000000000002'), 1::bigint, 'ANON reads public follows');
select is((select count(*) from public.game_reviews where user_id = '20000000-0000-4000-8000-000000000002'), 1::bigint, 'ANON reads only the public review');
select is(pg_temp.sqlstate_of('select count(*) from public.saved_posts'), '42501', 'ANON cannot read saved posts');
select is(pg_temp.sqlstate_of('select count(*) from public.game_favorites'), '42501', 'ANON cannot read favorites');
select is(pg_temp.sqlstate_of('select count(*) from public.game_ratings'), '42501', 'ANON cannot read individual ratings');
select is(pg_temp.sqlstate_of('select count(*) from public.reports'), '42501', 'ANON cannot read reports');
select is(pg_temp.sqlstate_of($sql$insert into public.posts (type, title, content) values ('guide', 'Anonymous post', 'Anonymous users cannot create this post.')$sql$), '42501', 'ANON cannot create content');
select is((select ratings_count from public.get_game_rating_summary(600002)), 1::bigint, 'ANON can read the aggregate rating count');

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.posts where id in ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000102')), 2::bigint, 'USER_A reads public content');
select is(pg_temp.row_count_of($sql$update public.profiles set display_name = 'Updated User A' where id = '20000000-0000-4000-8000-000000000001'$sql$), 1::bigint, 'USER_A edits own profile');
select is(pg_temp.sqlstate_of($sql$insert into public.posts (rawg_game_id, game_name, game_slug, type, title, content) values (3328, 'The Witcher 3', 'the-witcher-3-wild-hunt', 'discussion', 'Post created by User A', 'This row proves an authenticated user can create their own post.')$sql$), null::text, 'USER_A creates own post');
select is(pg_temp.row_count_of($sql$update public.posts set title = 'Post A edited by its owner' where id = '20000000-0000-4000-8000-000000000101'$sql$), 1::bigint, 'USER_A edits own post');
select is(pg_temp.sqlstate_of($sql$insert into public.comments (post_id, content) values ('20000000-0000-4000-8000-000000000102', 'Comment created by User A.')$sql$), null::text, 'USER_A creates a comment');
select is(pg_temp.row_count_of($sql$update public.comments set content = 'Comment edited by User A.' where content = 'Comment created by User A.'$sql$), 1::bigint, 'USER_A edits own comment');
select is(pg_temp.sqlstate_of($sql$insert into public.likes (post_id) values ('20000000-0000-4000-8000-000000000102')$sql$), null::text, 'USER_A likes a post');
select is(pg_temp.sqlstate_of($sql$insert into public.saved_posts (post_id) values ('20000000-0000-4000-8000-000000000102')$sql$), null::text, 'USER_A saves a post');
select is(pg_temp.sqlstate_of($sql$insert into public.follows (following_id) values ('20000000-0000-4000-8000-000000000002')$sql$), null::text, 'USER_A follows USER_B');
select is(pg_temp.sqlstate_of($sql$insert into public.game_favorites (rawg_game_id, game_name) values (700001, 'Favorite A')$sql$), null::text, 'USER_A creates a favorite');
select is(pg_temp.sqlstate_of($sql$insert into public.game_ratings (rawg_game_id, rating) values (700002, 4)$sql$), null::text, 'USER_A creates a rating');
select is(pg_temp.row_count_of($sql$update public.game_ratings set rating = 5 where rawg_game_id = 700002$sql$), 1::bigint, 'USER_A updates own rating');
select is(pg_temp.sqlstate_of($sql$insert into public.game_reviews (rawg_game_id, content, visibility) values (700003, 'Private review created by User A.', 'private')$sql$), null::text, 'USER_A creates a private review');
select is(pg_temp.sqlstate_of($sql$insert into public.game_reviews (rawg_game_id, content, visibility) values (700004, 'Public review created by User A.', 'public')$sql$), null::text, 'USER_A creates a public review');
select is(pg_temp.sqlstate_of($sql$insert into public.reports (reported_post_id, reason, details) values ('20000000-0000-4000-8000-000000000102', 'spam', 'Valid report against User B post.')$sql$), null::text, 'USER_A creates a valid report');
select is((select count(*) from public.reports where reporter_id = '20000000-0000-4000-8000-000000000001'), 1::bigint, 'USER_A reads own report');

select is(pg_temp.row_count_of($sql$update public.profiles set display_name = 'Cross-user edit' where id = '20000000-0000-4000-8000-000000000002'$sql$), 0::bigint, 'USER_A cannot edit USER_B profile');
select is(pg_temp.sqlstate_of($sql$update public.profiles set handle = 'changed_handle' where id = '20000000-0000-4000-8000-000000000001'$sql$), '42501', 'USER_A cannot alter own handle');
select is(pg_temp.sqlstate_of($sql$update public.profiles set is_demo = true where id = '20000000-0000-4000-8000-000000000001'$sql$), '42501', 'USER_A cannot alter is_demo');
select is(pg_temp.sqlstate_of($sql$update public.profiles set status = 'suspended' where id = '20000000-0000-4000-8000-000000000001'$sql$), '42501', 'USER_A cannot alter administrative profile status');
select is(pg_temp.sqlstate_of($sql$insert into public.posts (author_id, type, title, content) values ('20000000-0000-4000-8000-000000000002', 'guide', 'Forged author post', 'USER_A cannot create a post owned by USER_B.')$sql$), '42501', 'USER_A cannot create a post as USER_B');
select is(pg_temp.sqlstate_of($sql$update public.posts set author_id = '20000000-0000-4000-8000-000000000002' where id = '20000000-0000-4000-8000-000000000101'$sql$), '42501', 'USER_A cannot change post ownership');
select is(pg_temp.row_count_of($sql$update public.posts set title = 'Cross-user post edit' where id = '20000000-0000-4000-8000-000000000102'$sql$), 0::bigint, 'USER_A cannot edit USER_B post');
select is(pg_temp.sqlstate_of($sql$delete from public.posts where id = '20000000-0000-4000-8000-000000000101'$sql$), '42501', 'USER_A cannot physically delete own post');
select is(pg_temp.row_count_of($sql$update public.comments set content = 'Cross-user comment edit' where id = '20000000-0000-4000-8000-000000000201'$sql$), 0::bigint, 'USER_A cannot edit USER_B comment');
select is(pg_temp.sqlstate_of($sql$update public.comments set author_id = '20000000-0000-4000-8000-000000000002' where content = 'Comment edited by User A.'$sql$), '42501', 'USER_A cannot change comment ownership');
select is(pg_temp.sqlstate_of($sql$insert into public.likes (user_id, post_id) values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000102')$sql$), '42501', 'USER_A cannot like as USER_B');
select is((select count(*) from public.saved_posts where user_id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'USER_A cannot read USER_B saved posts');
select is(pg_temp.sqlstate_of($sql$insert into public.game_favorites (user_id, rawg_game_id) values ('20000000-0000-4000-8000-000000000002', 700010)$sql$), '42501', 'USER_A cannot create a favorite for USER_B');
select is((select count(*) from public.game_favorites where user_id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'USER_A cannot read USER_B favorite');
select is((select count(*) from public.game_ratings where user_id = '20000000-0000-4000-8000-000000000002'), 0::bigint, 'USER_A cannot read USER_B individual rating');
select is(pg_temp.row_count_of($sql$update public.game_reviews set content = 'Cross-user review edit' where user_id = '20000000-0000-4000-8000-000000000002' and rawg_game_id = 600003$sql$), 0::bigint, 'USER_A cannot edit USER_B review');
select is(pg_temp.sqlstate_of($sql$insert into public.follows (following_id) values ('20000000-0000-4000-8000-000000000001')$sql$), '42501', 'USER_A self-follow is rejected at the RLS boundary');
select is(pg_temp.sqlstate_of($sql$insert into public.reports (reported_profile_id, reason) values ('20000000-0000-4000-8000-000000000001', 'other')$sql$), '23514', 'USER_A cannot report itself');
select is(pg_temp.sqlstate_of($sql$insert into public.reports (reported_post_id, reason) values ('20000000-0000-4000-8000-000000000101', 'other')$sql$), '23514', 'USER_A cannot report own post');
select is(pg_temp.sqlstate_of($sql$insert into public.likes (post_id) values ('20000000-0000-4000-8000-000000000102')$sql$), '23505', 'duplicate like is rejected');
select is(pg_temp.sqlstate_of($sql$insert into public.saved_posts (post_id) values ('20000000-0000-4000-8000-000000000102')$sql$), '23505', 'duplicate save is rejected');
select is(pg_temp.sqlstate_of($sql$insert into public.follows (following_id) values ('20000000-0000-4000-8000-000000000002')$sql$), '23505', 'duplicate follow is rejected');
select is(pg_temp.sqlstate_of($sql$insert into public.game_ratings (rawg_game_id, rating) values (700002, 5)$sql$), '23505', 'duplicate rating is rejected');
select is(pg_temp.sqlstate_of($sql$insert into public.reports (reported_post_id, reason) values ('20000000-0000-4000-8000-000000000102', 'other')$sql$), '23505', 'duplicate active report is rejected');
select is((select count(*) from public.game_reviews where user_id = '20000000-0000-4000-8000-000000000001' and rawg_game_id = 700003), 1::bigint, 'USER_A reads own private review');
select is((select count(*) from public.game_reviews where user_id = '20000000-0000-4000-8000-000000000002' and rawg_game_id = 600003), 0::bigint, 'USER_A cannot read USER_B private review');

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.posts where id in ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000102')), 2::bigint, 'USER_B reads public posts');
select is((select count(*) from public.game_favorites where user_id = '20000000-0000-4000-8000-000000000002'), 1::bigint, 'USER_B reads own favorite');
select is((select count(*) from public.game_ratings where user_id = '20000000-0000-4000-8000-000000000002'), 1::bigint, 'USER_B reads own rating');
select is((select count(*) from public.game_favorites where user_id = '20000000-0000-4000-8000-000000000001'), 0::bigint, 'USER_B cannot read USER_A favorite');
select is((select count(*) from public.game_ratings where user_id = '20000000-0000-4000-8000-000000000001'), 0::bigint, 'USER_B cannot read USER_A rating');
select is((select count(*) from public.game_reviews where user_id = '20000000-0000-4000-8000-000000000001' and rawg_game_id = 700003), 0::bigint, 'USER_B cannot read USER_A private review');
select is((select count(*) from public.game_reviews where user_id = '20000000-0000-4000-8000-000000000002' and rawg_game_id = 600003), 1::bigint, 'USER_B reads own private review');
select is((select count(*) from public.reports where reporter_id = '20000000-0000-4000-8000-000000000001'), 0::bigint, 'USER_B cannot read USER_A report');
select is(pg_temp.row_count_of($sql$update public.posts set title = 'USER_B cross edit' where id = '20000000-0000-4000-8000-000000000101'$sql$), 0::bigint, 'USER_B cannot edit USER_A post');

reset role;
select * from finish();
rollback;
