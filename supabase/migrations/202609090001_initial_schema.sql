begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.is_valid_https_url(value text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select char_length(value) between 9 and 2048
    and value ~ '^https://[^[:space:]]+$';
$$;

create or replace function private.is_valid_tags(value text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select coalesce(array_ndims(value), 1) = 1
    and cardinality(value) <= 5
    and not exists (
      select 1
      from unnest(value) as item(tag)
      where tag is null
        or tag <> btrim(tag)
        or char_length(tag) not between 1 and 32
    )
    and cardinality(value) = (
      select count(distinct tag)
      from unnest(value) as item(tag)
    );
$$;

create or replace function private.is_valid_post_media(value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select jsonb_typeof(value) = 'array'
    and jsonb_array_length(value) <= 2
    and not exists (
      select 1
      from jsonb_array_elements(value) as media(item)
      where jsonb_typeof(item) <> 'object'
        or item ->> 'type' is distinct from 'image'
        or coalesce(item ->> 'source', 'external') not in ('external', 'supabase')
        or case coalesce(item ->> 'source', 'external')
          when 'external' then not coalesce(private.is_valid_https_url(item ->> 'url'), false)
          when 'supabase' then not (
            char_length(coalesce(item ->> 'storage_path', '')) between 1 and 1024
            and item ->> 'storage_path' !~ '(^/|\.\.)'
            and item ->> 'storage_path' ~ '^[A-Za-z0-9/_\.-]+$'
          )
          else true
        end
        or case
          when item ? 'thumbnail' and jsonb_typeof(item -> 'thumbnail') <> 'null'
            then not coalesce(private.is_valid_https_url(item ->> 'thumbnail'), false)
          else false
        end
        or case
          when item ? 'alt' and jsonb_typeof(item -> 'alt') <> 'null'
            then jsonb_typeof(item -> 'alt') <> 'string'
              or char_length(item ->> 'alt') > 500
          else false
        end
        or case jsonb_typeof(item -> 'width')
          when 'number' then (item ->> 'width')::numeric <= 0
          when 'null' then false
          else item ? 'width'
        end
        or case jsonb_typeof(item -> 'height')
          when 'number' then (item ->> 'height')::numeric <= 0
          when 'null' then false
          else item ? 'height'
        end
    );
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  display_name text not null,
  bio text not null default '',
  avatar_key text not null default 'default',
  status text not null default 'active',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_handle_unique unique (handle),
  constraint profiles_display_name_length check (
    display_name = btrim(display_name)
    and char_length(display_name) between 2 and 32
  ),
  constraint profiles_bio_length check (
    bio = btrim(bio)
    and char_length(bio) <= 180
  ),
  constraint profiles_avatar_key_format check (
    avatar_key ~ '^[a-z0-9][a-z0-9_-]{0,31}$'
  ),
  constraint profiles_status_allowed check (
    status in ('active', 'suspended', 'deactivated')
  ),
  constraint profiles_timestamps_ordered check (updated_at >= created_at)
);

create table public.posts (
  id uuid primary key default extensions.gen_random_uuid(),
  author_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  rawg_game_id bigint,
  game_name text,
  game_slug text,
  type text not null,
  title text not null,
  content text not null,
  media jsonb not null default '[]'::jsonb,
  tags text[] not null default array[]::text[],
  spoiler boolean not null default false,
  spoiler_label text,
  status text not null default 'published',
  visibility text not null default 'public',
  legacy_local_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint posts_rawg_game_id_positive check (
    rawg_game_id is null or rawg_game_id > 0
  ),
  constraint posts_game_name_length check (
    game_name is null
    or (game_name = btrim(game_name) and char_length(game_name) between 1 and 200)
  ),
  constraint posts_game_slug_length check (
    game_slug is null
    or (game_slug = btrim(game_slug) and char_length(game_slug) between 1 and 200)
  ),
  constraint posts_game_snapshot_consistent check (
    rawg_game_id is not null or (game_name is null and game_slug is null)
  ),
  constraint posts_type_allowed check (
    type in ('guide', 'art', 'screenshot', 'discussion', 'question')
  ),
  constraint posts_title_length check (
    title = btrim(title) and char_length(title) between 4 and 120
  ),
  constraint posts_content_length check (
    content = btrim(content) and char_length(content) between 5 and 5000
  ),
  constraint posts_media_valid check (private.is_valid_post_media(media)),
  constraint posts_tags_valid check (private.is_valid_tags(tags)),
  constraint posts_spoiler_label_valid check (
    (not spoiler and spoiler_label is null)
    or (
      spoiler
      and (
        spoiler_label is null
        or (spoiler_label = btrim(spoiler_label) and char_length(spoiler_label) <= 120)
      )
    )
  ),
  constraint posts_status_allowed check (status in ('published', 'deleted')),
  constraint posts_visibility_allowed check (visibility = 'public'),
  constraint posts_legacy_local_id_valid check (
    legacy_local_id is null
    or (legacy_local_id = btrim(legacy_local_id) and char_length(legacy_local_id) between 1 and 255)
  ),
  constraint posts_soft_delete_consistent check (
    (status = 'published' and deleted_at is null)
    or (status = 'deleted' and deleted_at is not null)
  ),
  constraint posts_timestamps_ordered check (updated_at >= created_at)
);

create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete set null,
  content text not null,
  spoiler boolean not null default false,
  status text not null default 'published',
  legacy_local_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comments_content_length check (
    content = btrim(content) and char_length(content) between 1 and 1000
  ),
  constraint comments_status_allowed check (status in ('published', 'deleted')),
  constraint comments_legacy_local_id_valid check (
    legacy_local_id is null
    or (legacy_local_id = btrim(legacy_local_id) and char_length(legacy_local_id) between 1 and 255)
  ),
  constraint comments_soft_delete_consistent check (
    (status = 'published' and deleted_at is null)
    or (status = 'deleted' and deleted_at is not null)
  ),
  constraint comments_timestamps_ordered check (updated_at >= created_at)
);

create table public.likes (
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.saved_posts (
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.follows (
  follower_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create table public.reports (
  id uuid primary key default extensions.gen_random_uuid(),
  reporter_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  reported_post_id uuid references public.posts(id) on delete cascade,
  reported_profile_id uuid references public.profiles(id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_exactly_one_target check (
    num_nonnulls(reported_post_id, reported_profile_id) = 1
  ),
  constraint reports_profile_not_self check (
    reported_profile_id is null or reported_profile_id <> reporter_id
  ),
  constraint reports_reason_allowed check (
    reason in ('spam', 'offensive', 'spoiler', 'misinformation', 'other')
  ),
  constraint reports_details_length check (
    details = btrim(details) and char_length(details) <= 500
  ),
  constraint reports_status_allowed check (
    status in ('pending', 'reviewing', 'resolved', 'dismissed')
  ),
  constraint reports_resolution_consistent check (
    (status in ('pending', 'reviewing') and resolved_at is null)
    or (status in ('resolved', 'dismissed') and resolved_at is not null)
  ),
  constraint reports_timestamps_ordered check (updated_at >= created_at)
);

create table public.game_favorites (
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  rawg_game_id bigint not null,
  game_name text,
  game_slug text,
  game_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, rawg_game_id),
  constraint game_favorites_rawg_game_id_positive check (rawg_game_id > 0),
  constraint game_favorites_game_name_length check (
    game_name is null
    or (game_name = btrim(game_name) and char_length(game_name) between 1 and 200)
  ),
  constraint game_favorites_game_slug_length check (
    game_slug is null
    or (game_slug = btrim(game_slug) and char_length(game_slug) between 1 and 200)
  ),
  constraint game_favorites_image_https check (
    game_image_url is null or private.is_valid_https_url(game_image_url)
  ),
  constraint game_favorites_timestamps_ordered check (updated_at >= created_at)
);

create table public.game_ratings (
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  rawg_game_id bigint not null,
  rating smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, rawg_game_id),
  constraint game_ratings_rawg_game_id_positive check (rawg_game_id > 0),
  constraint game_ratings_value_range check (rating between 1 and 5),
  constraint game_ratings_timestamps_ordered check (updated_at >= created_at)
);

create table public.game_reviews (
  user_id uuid not null default auth.uid()
    references public.profiles(id) on delete cascade,
  rawg_game_id bigint not null,
  content text not null,
  visibility text not null default 'private',
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, rawg_game_id),
  constraint game_reviews_rawg_game_id_positive check (rawg_game_id > 0),
  constraint game_reviews_content_length check (
    content = btrim(content) and char_length(content) between 1 and 5000
  ),
  constraint game_reviews_visibility_allowed check (
    visibility in ('private', 'public')
  ),
  constraint game_reviews_status_allowed check (status in ('published', 'deleted')),
  constraint game_reviews_soft_delete_consistent check (
    (status = 'published' and deleted_at is null)
    or (status = 'deleted' and deleted_at is not null)
  ),
  constraint game_reviews_timestamps_ordered check (updated_at >= created_at)
);

create unique index posts_author_legacy_local_id_key
  on public.posts (author_id, legacy_local_id)
  where legacy_local_id is not null;

create unique index comments_author_legacy_local_id_key
  on public.comments (author_id, legacy_local_id)
  where legacy_local_id is not null;

create unique index reports_active_post_key
  on public.reports (reporter_id, reported_post_id)
  where reported_post_id is not null and status in ('pending', 'reviewing');

create unique index reports_active_profile_key
  on public.reports (reporter_id, reported_profile_id)
  where reported_profile_id is not null and status in ('pending', 'reviewing');

create index posts_public_recent_idx
  on public.posts (created_at desc, id desc)
  where status = 'published' and visibility = 'public';

create index posts_public_game_recent_idx
  on public.posts (rawg_game_id, created_at desc, id desc)
  where status = 'published' and visibility = 'public' and rawg_game_id is not null;

create index posts_author_recent_idx
  on public.posts (author_id, created_at desc, id desc);

create index comments_public_post_recent_idx
  on public.comments (post_id, created_at, id)
  where status = 'published';

create index likes_post_id_idx on public.likes (post_id);
create index saved_posts_post_id_idx on public.saved_posts (post_id);
create index follows_following_recent_idx
  on public.follows (following_id, created_at desc);
create index reports_reporter_recent_idx
  on public.reports (reporter_id, created_at desc);
create index game_ratings_rawg_game_id_idx
  on public.game_ratings (rawg_game_id);
create index game_reviews_public_game_recent_idx
  on public.game_reviews (rawg_game_id, created_at desc)
  where status = 'published' and visibility = 'public';
create index game_reviews_user_recent_idx
  on public.game_reviews (user_id, created_at desc);

commit;
