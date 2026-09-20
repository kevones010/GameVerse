begin;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;
alter table public.game_favorites enable row level security;
alter table public.game_ratings enable row level security;
alter table public.game_reviews enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.posts from anon, authenticated;
revoke all on table public.comments from anon, authenticated;
revoke all on table public.likes from anon, authenticated;
revoke all on table public.saved_posts from anon, authenticated;
revoke all on table public.follows from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.game_favorites from anon, authenticated;
revoke all on table public.game_ratings from anon, authenticated;
revoke all on table public.game_reviews from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;

revoke all on function private.is_valid_https_url(text) from public;
revoke all on function private.is_valid_tags(text[]) from public;
revoke all on function private.is_valid_post_media(jsonb) from public;
revoke all on function private.set_updated_at() from public;
revoke all on function private.apply_soft_delete() from public;
revoke all on function private.enforce_comment_parent_post() from public;
revoke all on function private.enforce_report_target() from public;

grant execute on function private.is_valid_https_url(text) to authenticated;
grant execute on function private.is_valid_tags(text[]) to authenticated;
grant execute on function private.is_valid_post_media(jsonb) to authenticated;

grant select on table
  public.profiles,
  public.posts,
  public.comments,
  public.follows,
  public.game_reviews
to anon, authenticated;

grant select on table
  public.likes,
  public.saved_posts,
  public.reports,
  public.game_favorites,
  public.game_ratings
to authenticated;

grant update (display_name, bio, avatar_key)
  on table public.profiles to authenticated;

grant insert (
  rawg_game_id,
  game_name,
  game_slug,
  type,
  title,
  content,
  media,
  tags,
  spoiler,
  spoiler_label,
  legacy_local_id
) on table public.posts to authenticated;

grant update (
  rawg_game_id,
  game_name,
  game_slug,
  type,
  title,
  content,
  media,
  tags,
  spoiler,
  spoiler_label,
  status
) on table public.posts to authenticated;

grant insert (post_id, parent_comment_id, content, spoiler, legacy_local_id)
  on table public.comments to authenticated;
grant update (content, spoiler, status)
  on table public.comments to authenticated;

grant insert (post_id) on table public.likes to authenticated;
grant delete on table public.likes to authenticated;

grant insert (post_id) on table public.saved_posts to authenticated;
grant delete on table public.saved_posts to authenticated;

grant insert (following_id) on table public.follows to authenticated;
grant delete on table public.follows to authenticated;

grant insert (reported_post_id, reported_profile_id, reason, details)
  on table public.reports to authenticated;

grant insert (rawg_game_id, game_name, game_slug, game_image_url)
  on table public.game_favorites to authenticated;
grant update (game_name, game_slug, game_image_url)
  on table public.game_favorites to authenticated;
grant delete on table public.game_favorites to authenticated;

grant insert (rawg_game_id, rating)
  on table public.game_ratings to authenticated;
grant update (rating) on table public.game_ratings to authenticated;
grant delete on table public.game_ratings to authenticated;

grant insert (rawg_game_id, content, visibility)
  on table public.game_reviews to authenticated;
grant update (content, visibility, status)
  on table public.game_reviews to authenticated;

grant execute on function public.get_post_interaction_counts(uuid[])
  to anon, authenticated;
grant execute on function public.get_game_rating_summary(bigint)
  to anon, authenticated;

create policy profiles_public_read
on public.profiles
for select
to anon, authenticated
using (status = 'active');

create policy profiles_owner_read
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_owner_update
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy posts_public_read
on public.posts
for select
to anon, authenticated
using (status = 'published' and visibility = 'public');

create policy posts_owner_read
on public.posts
for select
to authenticated
using (author_id = (select auth.uid()));

create policy posts_owner_insert
on public.posts
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'published'
  and visibility = 'public'
  and deleted_at is null
  and exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
  )
);

create policy posts_owner_update
on public.posts
for update
to authenticated
using (
  author_id = (select auth.uid())
  and status = 'published'
)
with check (
  author_id = (select auth.uid())
  and visibility = 'public'
  and exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
  )
);

create policy comments_public_read
on public.comments
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.posts as post
    where post.id = comments.post_id
      and post.status = 'published'
      and post.visibility = 'public'
  )
);

create policy comments_owner_read
on public.comments
for select
to authenticated
using (author_id = (select auth.uid()));

create policy comments_owner_insert
on public.comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and status = 'published'
  and deleted_at is null
  and exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
  )
  and exists (
    select 1
    from public.posts as post
    where post.id = comments.post_id
      and post.status = 'published'
      and post.visibility = 'public'
  )
);

create policy comments_owner_update
on public.comments
for update
to authenticated
using (
  author_id = (select auth.uid())
  and status = 'published'
)
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.posts as post
    where post.id = comments.post_id
      and post.status = 'published'
      and post.visibility = 'public'
  )
);

create policy likes_owner_read
on public.likes
for select
to authenticated
using (user_id = (select auth.uid()));

create policy likes_owner_insert
on public.likes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts as post
    where post.id = likes.post_id
      and post.status = 'published'
      and post.visibility = 'public'
  )
);

create policy likes_owner_delete
on public.likes
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy saved_posts_owner_read
on public.saved_posts
for select
to authenticated
using (user_id = (select auth.uid()));

create policy saved_posts_owner_insert
on public.saved_posts
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.posts as post
    where post.id = saved_posts.post_id
      and post.status = 'published'
      and post.visibility = 'public'
  )
);

create policy saved_posts_owner_delete
on public.saved_posts
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy follows_public_read
on public.follows
for select
to anon, authenticated
using (
  exists (
    select 1 from public.profiles as follower
    where follower.id = follows.follower_id and follower.status = 'active'
  )
  and exists (
    select 1 from public.profiles as followed
    where followed.id = follows.following_id and followed.status = 'active'
  )
);

create policy follows_owner_insert
on public.follows
for insert
to authenticated
with check (
  follower_id = (select auth.uid())
  and follower_id <> following_id
  and exists (
    select 1 from public.profiles as follower
    where follower.id = (select auth.uid()) and follower.status = 'active'
  )
  and exists (
    select 1 from public.profiles as followed
    where followed.id = follows.following_id and followed.status = 'active'
  )
);

create policy follows_owner_delete
on public.follows
for delete
to authenticated
using (follower_id = (select auth.uid()));

create policy reports_owner_read
on public.reports
for select
to authenticated
using (reporter_id = (select auth.uid()));

create policy reports_owner_insert
on public.reports
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and status = 'pending'
  and resolved_at is null
  and exists (
    select 1 from public.profiles as reporter
    where reporter.id = (select auth.uid()) and reporter.status = 'active'
  )
  and (
    (
      reported_post_id is not null
      and exists (
        select 1 from public.posts as post
        where post.id = reports.reported_post_id
          and post.status = 'published'
          and post.visibility = 'public'
      )
    )
    or (
      reported_profile_id is not null
      and exists (
        select 1 from public.profiles as target_profile
        where target_profile.id = reports.reported_profile_id
          and target_profile.status = 'active'
      )
    )
  )
);

create policy game_favorites_owner_read
on public.game_favorites
for select
to authenticated
using (user_id = (select auth.uid()));

create policy game_favorites_owner_insert
on public.game_favorites
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy game_favorites_owner_update
on public.game_favorites
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy game_favorites_owner_delete
on public.game_favorites
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy game_ratings_owner_read
on public.game_ratings
for select
to authenticated
using (user_id = (select auth.uid()));

create policy game_ratings_owner_insert
on public.game_ratings
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy game_ratings_owner_update
on public.game_ratings
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy game_ratings_owner_delete
on public.game_ratings
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy game_reviews_public_read
on public.game_reviews
for select
to anon, authenticated
using (status = 'published' and visibility = 'public');

create policy game_reviews_owner_read
on public.game_reviews
for select
to authenticated
using (user_id = (select auth.uid()));

create policy game_reviews_owner_insert
on public.game_reviews
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'published'
  and deleted_at is null
);

create policy game_reviews_owner_update
on public.game_reviews
for update
to authenticated
using (
  user_id = (select auth.uid())
  and status = 'published'
)
with check (user_id = (select auth.uid()));

commit;
