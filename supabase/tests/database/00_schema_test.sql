create extension if not exists pgtap with schema extensions;

begin;
select plan(26);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'posts', 'posts table exists');
select has_table('public', 'comments', 'comments table exists');
select has_table('public', 'likes', 'likes table exists');
select has_table('public', 'saved_posts', 'saved_posts table exists');
select has_table('public', 'follows', 'follows table exists');
select has_table('public', 'reports', 'reports table exists');
select has_table('public', 'game_favorites', 'game_favorites table exists');
select has_table('public', 'game_ratings', 'game_ratings table exists');
select has_table('public', 'game_reviews', 'game_reviews table exists');

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  ),
  10::bigint,
  'public schema contains exactly the ten approved application tables'
);

select is(
  (
    select count(*)
    from pg_constraint
    where contype = 'f'
      and connamespace = 'public'::regnamespace
      and confdeltype in ('c', 'n')
  ),
  17::bigint,
  'all seventeen application foreign keys use CASCADE or SET NULL as designed'
);

select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'profiles has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.posts'::regclass), true, 'posts has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.comments'::regclass), true, 'comments has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.likes'::regclass), true, 'likes has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.saved_posts'::regclass), true, 'saved_posts has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.follows'::regclass), true, 'follows has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), true, 'reports has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.game_favorites'::regclass), true, 'game_favorites has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.game_ratings'::regclass), true, 'game_ratings has RLS enabled');
select is((select relrowsecurity from pg_class where oid = 'public.game_reviews'::regclass), true, 'game_reviews has RLS enabled');

select ok(
  to_regprocedure('public.get_post_interaction_counts(uuid[])') is not null,
  'post interaction aggregate RPC exists'
);
select ok(
  to_regprocedure('public.get_game_rating_summary(bigint)') is not null,
  'game rating aggregate RPC exists'
);

select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and column_name in (
        'likes_count',
        'comments_count',
        'saves_count',
        'followers_count',
        'following_count',
        'posts_count'
      )
  ),
  0::bigint,
  'no materialized counters were added'
);

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('games', 'tags', 'post_tags', 'media', 'notifications', 'messages', 'prices', 'stores')
  ),
  0::bigint,
  'out-of-scope application tables do not exist'
);

select * from finish();
rollback;
