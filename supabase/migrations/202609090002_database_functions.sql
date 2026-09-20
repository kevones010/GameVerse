begin;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function private.apply_soft_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'deleted' and new.status <> 'deleted' then
    raise exception using
      errcode = '23514',
      message = 'deleted content cannot be restored during the beta';
  end if;

  if new.status = 'deleted' then
    new.deleted_at := coalesce(old.deleted_at, statement_timestamp());
  else
    new.deleted_at := null;
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create or replace function private.enforce_comment_parent_post()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_post_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select comment.post_id
  into parent_post_id
  from public.comments as comment
  where comment.id = new.parent_comment_id;

  if parent_post_id is null then
    raise exception using
      errcode = '23503',
      message = 'parent comment does not exist';
  end if;

  if parent_post_id <> new.post_id then
    raise exception using
      errcode = '23514',
      message = 'parent comment must belong to the same post';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_report_target()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_author_id uuid;
begin
  if new.reported_profile_id is not null
    and new.reported_profile_id = new.reporter_id then
    raise exception using
      errcode = '23514',
      message = 'a profile cannot report itself';
  end if;

  if new.reported_post_id is not null then
    select post.author_id
    into target_author_id
    from public.posts as post
    where post.id = new.reported_post_id;

    if target_author_id is not null and target_author_id = new.reporter_id then
      raise exception using
        errcode = '23514',
        message = 'an author cannot report their own post';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_handle text;
  profile_display_name text;
  profile_bio text;
  profile_avatar_key text;
begin
  if jsonb_typeof(metadata) <> 'object'
    or jsonb_typeof(metadata -> 'handle') is distinct from 'string' then
    raise exception using
      errcode = '23514',
      message = 'valid handle metadata is required to create a profile';
  end if;

  if metadata ? 'display_name'
    and jsonb_typeof(metadata -> 'display_name') <> 'string' then
    raise exception using
      errcode = '23514',
      message = 'display_name metadata must be a string';
  end if;

  if metadata ? 'bio' and jsonb_typeof(metadata -> 'bio') <> 'string' then
    raise exception using
      errcode = '23514',
      message = 'bio metadata must be a string';
  end if;

  if metadata ? 'avatar_key'
    and jsonb_typeof(metadata -> 'avatar_key') <> 'string' then
    raise exception using
      errcode = '23514',
      message = 'avatar_key metadata must be a string';
  end if;

  profile_handle := metadata ->> 'handle';
  profile_display_name := coalesce(metadata ->> 'display_name', profile_handle);
  profile_bio := coalesce(metadata ->> 'bio', '');
  profile_avatar_key := coalesce(metadata ->> 'avatar_key', 'default');

  if profile_handle !~ '^[a-z0-9_]{3,24}$' then
    raise exception using
      errcode = '23514',
      message = 'handle metadata must be lowercase and contain 3 to 24 letters, numbers, or underscores';
  end if;

  if profile_display_name <> btrim(profile_display_name)
    or char_length(profile_display_name) not between 2 and 32 then
    raise exception using
      errcode = '23514',
      message = 'display_name metadata must contain 2 to 32 characters';
  end if;

  if profile_bio <> btrim(profile_bio) or char_length(profile_bio) > 180 then
    raise exception using
      errcode = '23514',
      message = 'bio metadata must contain at most 180 characters';
  end if;

  if profile_avatar_key !~ '^[a-z0-9][a-z0-9_-]{0,31}$' then
    raise exception using
      errcode = '23514',
      message = 'avatar_key metadata must be a valid local avatar key';
  end if;

  insert into public.profiles (
    id,
    handle,
    display_name,
    bio,
    avatar_key,
    status,
    is_demo,
    created_at,
    updated_at
  ) values (
    new.id,
    profile_handle,
    profile_display_name,
    profile_bio,
    profile_avatar_key,
    'active',
    false,
    coalesce(new.created_at, now()),
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger posts_apply_soft_delete
before update on public.posts
for each row execute function private.apply_soft_delete();

create trigger comments_apply_soft_delete
before update on public.comments
for each row execute function private.apply_soft_delete();

create trigger comments_enforce_parent_post
before insert or update of parent_comment_id, post_id on public.comments
for each row execute function private.enforce_comment_parent_post();

create trigger reports_enforce_target
before insert or update of reporter_id, reported_post_id, reported_profile_id on public.reports
for each row execute function private.enforce_report_target();

create trigger reports_set_updated_at
before update on public.reports
for each row execute function private.set_updated_at();

create trigger game_favorites_set_updated_at
before update on public.game_favorites
for each row execute function private.set_updated_at();

create trigger game_ratings_set_updated_at
before update on public.game_ratings
for each row execute function private.set_updated_at();

create trigger game_reviews_apply_soft_delete
before update on public.game_reviews
for each row execute function private.apply_soft_delete();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function public.get_post_interaction_counts(p_post_ids uuid[])
returns table (
  post_id uuid,
  likes_count bigint,
  comments_count bigint,
  saves_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_post_ids is null or cardinality(p_post_ids) = 0 then
    return;
  end if;

  if cardinality(p_post_ids) > 100 then
    raise exception using
      errcode = '22023',
      message = 'at most 100 post ids may be summarized at once';
  end if;

  return query
  select
    post.id,
    (select count(*) from public.likes as post_like where post_like.post_id = post.id),
    (
      select count(*)
      from public.comments as post_comment
      where post_comment.post_id = post.id
        and post_comment.status = 'published'
    ),
    (select count(*) from public.saved_posts as post_save where post_save.post_id = post.id)
  from public.posts as post
  where post.id = any(p_post_ids)
    and post.status = 'published'
    and post.visibility = 'public'
  order by post.created_at desc, post.id desc;
end;
$$;

create or replace function public.get_game_rating_summary(p_rawg_game_id bigint)
returns table (
  rawg_game_id bigint,
  rating_average numeric(3, 2),
  ratings_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_rawg_game_id is null or p_rawg_game_id <= 0 then
    raise exception using
      errcode = '22023',
      message = 'rawg game id must be a positive integer';
  end if;

  return query
  select
    p_rawg_game_id,
    round(avg(game_rating.rating)::numeric, 2)::numeric(3, 2),
    count(*)::bigint
  from public.game_ratings as game_rating
  where game_rating.rawg_game_id = p_rawg_game_id;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;
revoke all on function public.get_post_interaction_counts(uuid[]) from public;
revoke all on function public.get_game_rating_summary(bigint) from public;

commit;
