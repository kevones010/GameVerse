begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select ok(
  has_table_privilege('anon', 'public.profiles', 'SELECT')
  and has_table_privilege('anon', 'public.posts', 'SELECT')
  and has_table_privilege('anon', 'public.comments', 'SELECT')
  and has_table_privilege('anon', 'public.follows', 'SELECT')
  and has_table_privilege('anon', 'public.game_reviews', 'SELECT'),
  'anonymous role receives SELECT only on public-facing tables'
);

select ok(
  not has_table_privilege('anon', 'public.likes', 'SELECT')
  and not has_table_privilege('anon', 'public.saved_posts', 'SELECT')
  and not has_table_privilege('anon', 'public.reports', 'SELECT')
  and not has_table_privilege('anon', 'public.game_favorites', 'SELECT')
  and not has_table_privilege('anon', 'public.game_ratings', 'SELECT'),
  'anonymous role receives no SELECT on private relations'
);

select ok(
  not has_table_privilege('anon', 'public.profiles', 'INSERT')
  and not has_table_privilege('anon', 'public.profiles', 'UPDATE')
  and not has_table_privilege('anon', 'public.profiles', 'DELETE')
  and not has_table_privilege('anon', 'public.posts', 'INSERT')
  and not has_table_privilege('anon', 'public.posts', 'UPDATE')
  and not has_table_privilege('anon', 'public.posts', 'DELETE')
  and not has_table_privilege('anon', 'public.comments', 'INSERT')
  and not has_table_privilege('anon', 'public.comments', 'UPDATE')
  and not has_table_privilege('anon', 'public.comments', 'DELETE')
  and not has_table_privilege('anon', 'public.follows', 'INSERT')
  and not has_table_privilege('anon', 'public.follows', 'DELETE')
  and not has_table_privilege('anon', 'public.game_reviews', 'INSERT')
  and not has_table_privilege('anon', 'public.game_reviews', 'UPDATE')
  and not has_table_privilege('anon', 'public.game_reviews', 'DELETE'),
  'anonymous role receives no content write grants'
);

select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
  and not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated clients cannot insert or delete profiles directly'
);

select ok(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE')
  and has_column_privilege('authenticated', 'public.profiles', 'bio', 'UPDATE')
  and has_column_privilege('authenticated', 'public.profiles', 'avatar_key', 'UPDATE'),
  'authenticated clients may update only editable profile fields'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'handle', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'is_demo', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE'),
  'profile identity, handle and administrative fields have no client UPDATE grant'
);

select ok(
  has_column_privilege('authenticated', 'public.posts', 'title', 'INSERT')
  and has_column_privilege('authenticated', 'public.posts', 'content', 'INSERT')
  and has_column_privilege('authenticated', 'public.posts', 'type', 'INSERT'),
  'authenticated clients receive the required post INSERT columns'
);

select ok(
  not has_column_privilege('authenticated', 'public.posts', 'id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.posts', 'author_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.posts', 'status', 'INSERT')
  and not has_column_privilege('authenticated', 'public.posts', 'visibility', 'INSERT')
  and not has_column_privilege('authenticated', 'public.posts', 'created_at', 'INSERT')
  and not has_column_privilege('authenticated', 'public.posts', 'deleted_at', 'INSERT'),
  'post ownership, state and timestamps cannot be chosen on client INSERT'
);

select ok(
  has_column_privilege('authenticated', 'public.posts', 'title', 'UPDATE')
  and has_column_privilege('authenticated', 'public.posts', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.posts', 'author_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.posts', 'created_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.posts', 'deleted_at', 'UPDATE'),
  'post UPDATE grants allow editing and soft delete without ownership changes'
);

select ok(
  not has_table_privilege('authenticated', 'public.posts', 'DELETE')
  and not has_table_privilege('authenticated', 'public.comments', 'DELETE')
  and not has_table_privilege('authenticated', 'public.game_reviews', 'DELETE'),
  'content tables expose no physical DELETE grant'
);

select ok(
  not has_table_privilege('authenticated', 'public.likes', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.saved_posts', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.follows', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.reports', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.reports', 'DELETE'),
  'immutable relations and user reports expose no UPDATE grant'
);

select ok(
  not has_column_privilege('authenticated', 'public.comments', 'author_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.comments', 'post_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.game_favorites', 'user_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.game_favorites', 'rawg_game_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.game_ratings', 'user_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.game_ratings', 'rawg_game_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.game_reviews', 'user_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.game_reviews', 'rawg_game_id', 'UPDATE'),
  'client UPDATE grants cannot change ownership or canonical identities'
);

select ok(
  not has_column_privilege('authenticated', 'public.likes', 'user_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.saved_posts', 'user_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.follows', 'follower_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.reports', 'reporter_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.game_favorites', 'user_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.game_ratings', 'user_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.game_reviews', 'user_id', 'INSERT'),
  'client INSERT grants derive every ownership column from auth.uid()'
);

select ok(
  has_table_privilege('authenticated', 'public.likes', 'SELECT')
  and has_table_privilege('authenticated', 'public.saved_posts', 'SELECT')
  and has_table_privilege('authenticated', 'public.reports', 'SELECT')
  and has_table_privilege('authenticated', 'public.game_favorites', 'SELECT')
  and has_table_privilege('authenticated', 'public.game_ratings', 'SELECT'),
  'authenticated role receives SELECT for private rows filtered by RLS'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_post_interaction_counts(uuid[])',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.get_post_interaction_counts(uuid[])',
    'EXECUTE'
  )
  and has_function_privilege(
    'anon',
    'public.get_game_rating_summary(bigint)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.get_game_rating_summary(bigint)',
    'EXECUTE'
  ),
  'minimal aggregate RPCs are executable by their intended roles'
);

select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anonymous role has no access to the private helper schema'
);

select * from finish();

rollback;
