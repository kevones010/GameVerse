begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select is(
  (select count(*) from public.profiles where is_demo),
  2::bigint,
  'seed contains exactly two demo profiles'
);

select is(
  (
    select count(*)
    from public.profiles as profile
    join auth.users as auth_user on auth_user.id = profile.id
    where profile.is_demo
  ),
  2::bigint,
  'every demo profile belongs to an Auth user'
);

select is(
  (
    select count(*)
    from public.posts
    where id in (
      '00000000-0000-4000-8000-000000002001',
      '00000000-0000-4000-8000-000000002002',
      '00000000-0000-4000-8000-000000002003',
      '00000000-0000-4000-8000-000000002004'
    )
  ),
  4::bigint,
  'seed contains exactly four identified demo posts'
);

select is(
  (select count(*) from public.posts),
  4::bigint,
  'seed contains no posts beyond the four approved demo posts'
);

select is(
  (
    select count(*)
    from public.posts as post
    join public.profiles as author on author.id = post.author_id
    where author.is_demo
  ),
  4::bigint,
  'every seeded post belongs to a marked demo profile'
);

select is((select count(*) from public.likes), 0::bigint, 'seed contains no fake likes');
select is((select count(*) from public.comments), 0::bigint, 'seed contains no fake comments');
select is((select count(*) from public.saved_posts), 0::bigint, 'seed contains no fake saves');
select is((select count(*) from public.follows), 0::bigint, 'seed contains no fake follows');
select is((select count(*) from public.game_favorites), 0::bigint, 'seed contains no fake favorites');
select is((select count(*) from public.game_ratings), 0::bigint, 'seed contains no fake ratings');
select is((select count(*) from public.game_reviews), 0::bigint, 'seed contains no fake reviews');
select is((select count(*) from public.reports), 0::bigint, 'seed contains no fake reports');

select * from finish();

rollback;
