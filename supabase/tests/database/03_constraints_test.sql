begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

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

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'constraints-a@example.test',
    '{"handle":"constraints_a","display_name":"Constraints A"}'::jsonb
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'constraints-b@example.test',
    '{"handle":"constraints_b","display_name":"Constraints B"}'::jsonb
  );

insert into public.posts (
  id,
  author_id,
  title,
  content,
  type,
  legacy_local_id
)
values
  (
    '31000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'Post válido A',
    'Conteúdo válido para os testes de constraints.',
    'discussion',
    'constraints-post-a'
  ),
  (
    '31000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'Post válido B',
    'Outro conteúdo válido para os testes de constraints.',
    'guide',
    'constraints-post-b'
  );

insert into public.comments (
  id,
  post_id,
  author_id,
  content,
  legacy_local_id
)
values (
  '32000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'Comentário pai válido.',
  'constraints-comment-a'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.game_ratings (user_id, rawg_game_id, rating)
    values ('30000000-0000-4000-8000-000000000001', 10, 0)
  $sql$),
  '23514',
  'rating zero is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.game_ratings (user_id, rawg_game_id, rating)
    values ('30000000-0000-4000-8000-000000000001', 10, 6)
  $sql$),
  '23514',
  'rating above five is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.game_favorites (user_id, rawg_game_id, game_name)
    values ('30000000-0000-4000-8000-000000000001', -1, 'Inválido')
  $sql$),
  '23514',
  'negative RAWG id is rejected in favorites'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.game_favorites (user_id, rawg_game_id, game_image_url)
    values (
      '30000000-0000-4000-8000-000000000001',
      11,
      'http://example.test/image.png'
    )
  $sql$),
  '23514',
  'non-HTTPS game image URL is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, rawg_game_id, title, content, type)
    values (
      '30000000-0000-4000-8000-000000000001',
      -1,
      'RAWG inválido',
      'Este conteúdo é válido, mas o identificador não é.',
      'discussion'
    )
  $sql$),
  '23514',
  'negative RAWG id is rejected in posts'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type)
    values (
      '30000000-0000-4000-8000-000000000001',
      'Tipo inválido',
      'Este conteúdo tenta usar um tipo que não existe.',
      'video'
    )
  $sql$),
  '23514',
  'unknown post type is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type, tags)
    values (
      '30000000-0000-4000-8000-000000000001',
      'Tags demais',
      'Este conteúdo tenta cadastrar mais de cinco tags.',
      'discussion',
      array['one', 'two', 'three', 'four', 'five', 'six']
    )
  $sql$),
  '23514',
  'more than five tags are rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type, tags)
    values (
      '30000000-0000-4000-8000-000000000001',
      'Tag vazia',
      'Este conteúdo tenta cadastrar uma tag vazia.',
      'discussion',
      array['']
    )
  $sql$),
  '23514',
  'empty tags are rejected'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.posts (author_id, title, content, type, tags) values (%L, %L, %L, %L, array[%L])',
    '30000000-0000-4000-8000-000000000001',
    'Tag longa',
    'Este conteúdo tenta cadastrar uma tag longa demais.',
    'discussion',
    repeat('x', 33)
  )),
  '23514',
  'tags longer than 32 characters are rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type)
    values (
      '30000000-0000-4000-8000-000000000001',
      'abc',
      'Este conteúdo tem um título curto demais.',
      'discussion'
    )
  $sql$),
  '23514',
  'post title shorter than four characters is rejected'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.posts (author_id, title, content, type) values (%L, %L, %L, %L)',
    '30000000-0000-4000-8000-000000000001',
    repeat('x', 121),
    'Este conteúdo tem um título longo demais.',
    'discussion'
  )),
  '23514',
  'post title longer than 120 characters is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type)
    values (
      '30000000-0000-4000-8000-000000000001',
      'Conteúdo curto',
      'abcd',
      'discussion'
    )
  $sql$),
  '23514',
  'post content shorter than five characters is rejected'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.posts (author_id, title, content, type) values (%L, %L, %L, %L)',
    '30000000-0000-4000-8000-000000000001',
    'Conteúdo longo',
    repeat('x', 5001),
    'discussion'
  )),
  '23514',
  'post content longer than 5000 characters is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.follows (follower_id, following_id)
    values (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001'
    )
  $sql$),
  '23514',
  'self follow is rejected by the database'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.reports (reporter_id, reason)
    values ('30000000-0000-4000-8000-000000000001', 'spam')
  $sql$),
  '23514',
  'report without a target is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.reports (reporter_id, reported_profile_id, reported_post_id, reason)
    values (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      '31000000-0000-4000-8000-000000000002',
      'spam'
    )
  $sql$),
  '23514',
  'report with two targets is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.reports (reporter_id, reported_profile_id, reason)
    values (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'other'
    )
  $sql$),
  '23514',
  'self report is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.reports (reporter_id, reported_post_id, reason)
    values (
      '30000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001',
      'other'
    )
  $sql$),
  '23514',
  'reporting an owned post is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.comments (post_id, author_id, parent_comment_id, content)
    values (
      '31000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000002',
      '32000000-0000-4000-8000-000000000001',
      'Resposta associada ao post errado.'
    )
  $sql$),
  '23514',
  'parent comment from another post is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type, media)
    values (
      '30000000-0000-4000-8000-000000000001',
      'Mídia inválida',
      'Este conteúdo tenta cadastrar um vídeo.',
      'discussion',
      '[{"type":"video","url":"https://example.test/video.mp4"}]'::jsonb
    )
  $sql$),
  '23514',
  'non-image media is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type, media)
    values (
      '30000000-0000-4000-8000-000000000001',
      'URL insegura',
      'Este conteúdo tenta cadastrar uma imagem por HTTP.',
      'discussion',
      '[{"type":"image","url":"http://example.test/image.png"}]'::jsonb
    )
  $sql$),
  '23514',
  'non-HTTPS external media is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type, media)
    values (
      '30000000-0000-4000-8000-000000000001',
      'Tipo de mídia ausente',
      'Este conteúdo tenta cadastrar mídia sem o tipo obrigatório.',
      'discussion',
      '[{"url":"https://example.test/image.png"}]'::jsonb
    )
  $sql$),
  '23514',
  'media without an image type is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.posts (author_id, title, content, type, legacy_local_id)
    values (
      '30000000-0000-4000-8000-000000000001',
      'Legado duplicado',
      'Este conteúdo repete um identificador legado do mesmo autor.',
      'discussion',
      'constraints-post-a'
    )
  $sql$),
  '23505',
  'duplicate post legacy id for one author is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.comments (post_id, author_id, content, legacy_local_id)
    values (
      '31000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'Este comentário repete o identificador legado.',
      'constraints-comment-a'
    )
  $sql$),
  '23505',
  'duplicate comment legacy id for one author is rejected'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.comments (post_id, author_id, content) values (%L, %L, %L)',
    '31000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    repeat('x', 1001)
  )),
  '23514',
  'comment longer than 1000 characters is rejected'
);

select is(
  pg_temp.sqlstate_of(format(
    'insert into public.posts (author_id, title, content, type, spoiler, spoiler_label) values (%L, %L, %L, %L, true, %L)',
    '30000000-0000-4000-8000-000000000001',
    'Spoiler extenso',
    'Este conteúdo usa uma descrição de spoiler longa demais.',
    'discussion',
    repeat('x', 121)
  )),
  '23514',
  'spoiler label longer than 120 characters is rejected'
);

select is(
  pg_temp.sqlstate_of($sql$
    insert into public.game_reviews (user_id, rawg_game_id, content)
    values ('30000000-0000-4000-8000-000000000001', 10, '')
  $sql$),
  '23514',
  'empty game review is rejected'
);

select * from finish();

rollback;
