import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityService } from '../js/services/community/communityService.js';
import { CommunitySession } from '../js/services/community/communitySession.js';
import { LocalCommunityRepository, COMMUNITY_STORAGE_KEY } from '../js/services/community/localCommunityRepository.js';
import { migrateCommunityState, validatePost } from '../js/services/community/communityValidation.js';
import { createCommunitySeed } from '../data/communitySeed.js';

function fixture(initialState) {
  const values = new Map();
  if (initialState) values.set(COMMUNITY_STORAGE_KEY, JSON.stringify(initialState));
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const repository = new LocalCommunityRepository(storage);
  return { service: new CommunityService(repository, new CommunitySession(repository)), storage };
}

test('dados de demonstração têm números coerentes com 6 usuários', () => {
  const seed = createCommunitySeed();
  const perPost = new Map();
  seed.likes.forEach(like => perPost.set(like.postId, (perPost.get(like.postId) || 0) + 1));
  assert.ok(Math.max(...perPost.values()) <= seed.users.length - 1);
  assert.ok(seed.likes.every(like => seed.posts.find(post => post.id === like.postId).authorId !== like.userId));
  assert.ok(seed.comments.every(comment => comment.content !== 'Comentário demonstrativo preservado da fase inicial.'));
});

test('migração v2 -> v3 remove interações sintéticas e preserva o que a pessoa fez', () => {
  const v3 = createCommunitySeed();
  const v2 = {
    ...v3,
    schemaVersion: 2,
    posts: v3.posts.filter(post => post.type !== 'review').map(({ poll, ...post }) => post),
    likes: [
      { id: 'legacy-like-x-0', postId: v3.posts[0].id, userId: 'legacy-like-user-x-0', origin: 'seed-summary' },
      { id: 'like-meu', postId: 'post-arte-vee-aventura', userId: 'user-veemaster', createdAt: new Date().toISOString() }
    ],
    comments: [{ id: 'legacy-comment-x', postId: v3.posts[0].id, authorId: 'legacy', content: 'x', status: 'published', origin: 'seed-summary' }],
    savedPosts: [],
    follows: []
  };
  delete v2.reactions;
  delete v2.pollVotes;
  const migrated = migrateCommunityState(v2);
  assert.equal(migrated.schemaVersion, 3);
  assert.ok(!migrated.likes.some(like => like.origin === 'seed-summary'));
  assert.ok(migrated.likes.some(like => like.id === 'like-meu'));
  assert.ok(!migrated.comments.some(comment => comment.origin === 'seed-summary'));
  assert.ok(migrated.posts.some(post => post.type === 'review'));
  assert.ok(migrated.posts.find(post => post.id === 'post-chefe-elden-ring').poll.options.length >= 2);
  assert.ok(Array.isArray(migrated.reactions) && Array.isArray(migrated.pollVotes));
});

test('reações: uma de cada tipo por pessoa, clicar de novo tira', async () => {
  const { service } = fixture();
  const post = (await service.listPosts({ limit: 1 })).items[0];
  const before = post.reactions.find(r => r.emoji === 'wow');
  const on = await service.toggleReaction(post.id, 'wow');
  assert.equal(on.reacted, !before.mine);
  const off = await service.toggleReaction(post.id, 'wow');
  assert.equal(off.reactionCounts.wow, before.count);
  await assert.rejects(service.toggleReaction(post.id, 'xyz'), { code: 'invalid-reaction' });
});

test('enquete: um voto por pessoa, pode trocar ou retirar', async () => {
  const { service } = fixture();
  const poll = await service.getPostById('post-chefe-elden-ring');
  const base = poll.poll.options.map(option => option.votes);
  const first = await service.votePoll(poll.id, 0);
  assert.equal(first.optionIndex, 0);
  assert.equal(first.pollCounts[0], base[0] + 1);
  const changed = await service.votePoll(poll.id, 1);
  assert.equal(changed.pollCounts[0], base[0]);
  assert.equal(changed.pollCounts[1], base[1] + 1);
  const removed = await service.votePoll(poll.id, 1);
  assert.equal(removed.optionIndex, null);
  await assert.rejects(service.votePoll(poll.id, 9), { code: 'invalid-poll-option' });
  assert.equal((await service.getPostById(poll.id)).poll.myVote, null);
});

test('hashtag filtra o feed', async () => {
  const { service } = fixture();
  const result = await service.listPosts({ tag: '#Persona5', limit: 12 });
  assert.ok(result.total > 0);
  assert.ok(result.items.every(post => post.tags.includes('persona5')));
});

test('análise e enquete são validadas', () => {
  const review = validatePost({ type: 'review', title: 'Análise: Celeste', content: 'Muito bom mesmo.', rating: 5 });
  assert.equal(review.rating, 5);
  assert.throws(() => validatePost({ type: 'review', title: 'Análise', content: 'Texto ok.', rating: 9 }));
  const question = validatePost({ type: 'question', title: 'Qual o melhor?', content: 'Votem aí.', pollOptions: ['A', 'B', ''] });
  assert.deepEqual(question.poll.options, ['A', 'B']);
  assert.throws(() => validatePost({ type: 'question', title: 'Qual?', content: 'Votem aí.', pollOptions: ['A'] }));
  assert.throws(() => validatePost({ type: 'question', title: 'Qual?', content: 'Votem aí.', pollOptions: ['A', 'a'] }));
  assert.equal(validatePost({ type: 'guide', title: 'Guia', content: 'Texto ok.', pollOptions: ['A', 'B'] }).poll, null);
});

test('atividade e estatísticas do perfil', async () => {
  const { service } = fixture();
  const post = await service.createPost({ type: 'review', title: 'Análise: Hades', content: 'Excelente roguelike.', rating: 4, gameId: 3328, gameName: 'Hades' });
  await service.createComment(post.id, { content: 'Concordo!' });
  const activity = await service.getUserActivity('user-veemaster');
  assert.equal(activity[0].kind, 'comment');
  assert.equal(activity[1].kind, 'review');
  assert.equal(activity[1].rating, 4);
  const stats = await service.getUserCommunityStats('user-veemaster');
  assert.equal(stats.byType.review, 1);
  assert.ok(stats.comments >= 1);
});

test('conquistas: progresso e desbloqueio; perfis de outras pessoas não mostram dados da coleção', async () => {
  const { computeAchievements } = await import('../js/services/achievements.js');
  const community = { posts: 4, byType: { guide: 3, review: 1 }, comments: 1, likesReceived: 12, followers: 3 };
  const player = { total: 12, completed: 2, genresCount: 6, ratingsCount: 0, analysesCount: 1 };
  const mine = computeAchievements({ community, player });
  const byId = Object.fromEntries(mine.map(item => [item.id, item]));
  assert.equal(byId['first-post'].unlocked, true);
  assert.equal(byId['guide-master'].unlocked, true);
  assert.equal(byId.collector.unlocked, true);
  assert.equal(byId.finisher.unlocked, false);
  assert.equal(byId.finisher.progress, 2);
  assert.equal(byId.critic.progress, 2);
  assert.ok(mine.findIndex(item => !item.unlocked) > mine.findLastIndex(item => item.unlocked));
  const theirs = computeAchievements({ community, player: null });
  assert.ok(!theirs.some(item => item.id === 'collector'));
});
