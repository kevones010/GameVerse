begin;

-- Development-only identities. They are valid auth.users rows for FK purposes,
-- but intentionally have no password or sign-in identity. Create login-capable
-- demo accounts through the local Auth API or Studio when interactive testing is
-- needed; never commit a reusable password.
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'vee-guide@gameverse.invalid',
    '{"handle":"vee_guide","display_name":"Vee Guide","bio":"Guias demonstrativos do GameVerse.","avatar_key":"happy"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'vee-explorer@gameverse.invalid',
    '{"handle":"vee_explorer","display_name":"Vee Explorer","bio":"Discussões demonstrativas do GameVerse.","avatar_key":"purple"}'::jsonb
  )
on conflict (id) do nothing;

update public.profiles
set is_demo = true
where id in (
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102'
);

insert into public.posts (
  id,
  author_id,
  rawg_game_id,
  game_name,
  game_slug,
  type,
  title,
  content,
  tags,
  spoiler,
  spoiler_label,
  status,
  visibility
)
values
  (
    '00000000-0000-4000-8000-000000002001',
    '00000000-0000-4000-8000-000000000101',
    339958,
    'Persona 5 Royal',
    'persona-5-royal',
    'guide',
    'Como começar sem tentar otimizar tudo',
    'Organize os objetivos por prioridade e mantenha alguns dias livres para descobrir atividades sem transformar a primeira jornada em uma planilha.',
    array['persona5', 'guia', 'sem-spoilers'],
    false,
    null,
    'published',
    'public'
  ),
  (
    '00000000-0000-4000-8000-000000002002',
    '00000000-0000-4000-8000-000000000102',
    9767,
    'Hollow Knight',
    'hollow-knight',
    'question',
    'Qual área mais marcou sua primeira exploração?',
    'Conte qual região chamou mais sua atenção pela atmosfera, pelos desafios ou pela música, evitando revelar momentos importantes da história.',
    array['hollow-knight', 'exploracao', 'pergunta'],
    false,
    null,
    'published',
    'public'
  ),
  (
    '00000000-0000-4000-8000-000000002003',
    '00000000-0000-4000-8000-000000000101',
    326243,
    'Elden Ring',
    'elden-ring',
    'discussion',
    'Explorar sem pressa também faz parte da estratégia',
    'Voltar mais tarde para um encontro difícil pode revelar caminhos, equipamentos e possibilidades que mudam completamente a experiência.',
    array['elden-ring', 'exploracao', 'discussao'],
    false,
    null,
    'published',
    'public'
  ),
  (
    '00000000-0000-4000-8000-000000002004',
    '00000000-0000-4000-8000-000000000102',
    795632,
    'Resident Evil 4',
    'resident-evil-4-2023',
    'screenshot',
    'A iluminação prepara a tensão antes do combate',
    'Este post demonstrativo observa como o cenário conduz o olhar sem anexar mídia ou revelar acontecimentos da campanha.',
    array['resident-evil', 'fotografia', 'screenshot'],
    false,
    null,
    'published',
    'public'
  )
on conflict (id) do nothing;

-- Deliberately no likes, comments, saved posts, follows, ratings or reports.

commit;
