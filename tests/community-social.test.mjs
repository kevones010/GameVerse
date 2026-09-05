import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityService } from '../js/services/community/communityService.js';
import { CommunitySession } from '../js/services/community/communitySession.js';
import { LocalCommunityRepository, COMMUNITY_STORAGE_KEY } from '../js/services/community/localCommunityRepository.js';
import { validateProfile, validateReport } from '../js/services/community/communityValidation.js';

function fixture() {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const repository = new LocalCommunityRepository(storage);
  const service = new CommunityService(repository, new CommunitySession(repository));
  return { service, repository, storage };
}

test('perfil agrega publicações, seguidores e seguindo sem depender de RAWG', async () => {
  const { service } = fixture();
  const current = await service.getCurrentUser();
  const profile = await service.getUserProfile(current.id);
  assert.equal(profile.isCurrentUser, true);
  assert.equal(profile.handle, 'veemaster');
  assert.ok(profile.postsCount >= 1);
  assert.equal(profile.followersCount, 0);
  assert.equal(profile.followingCount, 0);
  assert.equal(Object.values(profile.counts).reduce((a, b) => a + b, 0), profile.postsCount);
});

test('edição do perfil local persiste e repositório bloqueia edição de terceiro', async () => {
  const { service, repository, storage } = fixture();
  const current = await service.getCurrentUser();
  const updated = await service.updateCurrentUserProfile({
    displayName: 'Vee Master Local',
    bio: 'Jogando e escrevendo guias.',
    avatar: 'assets/vee/avatars/vee-avatar-blue.webp'
  });
  assert.equal(updated.displayName, 'Vee Master Local');
  assert.equal((await service.getCurrentUser()).bio, 'Jogando e escrevendo guias.');
  const persisted = JSON.parse(storage.getItem(COMMUNITY_STORAGE_KEY));
  assert.equal(persisted.users.find(user => user.id === current.id).avatar, 'assets/vee/avatars/vee-avatar-blue.webp');
  await assert.rejects(repository.updateUser('user-lunaforge', { displayName: 'Hack' }, current.id), { code: 'forbidden' });
});

test('follow é único, reversível, não permite self-follow e alimenta a aba Seguindo', async () => {
  const { service } = fixture();
  const current = await service.getCurrentUser();
  await assert.rejects(service.toggleFollow(current.id), { code: 'cannot-follow-self' });
  const follow = await service.toggleFollow('user-lunaforge');
  assert.equal(follow.followed, true);
  assert.equal((await service.getUserProfile('user-lunaforge')).followersCount, 1);
  assert.equal((await service.getUserProfile(current.id)).followingCount, 1);
  const followingFeed = await service.listFollowingPosts({ limit: 20 });
  assert.ok(followingFeed.items.length > 0);
  assert.ok(followingFeed.items.every(post => post.authorId === 'user-lunaforge'));
  const unfollow = await service.toggleFollow('user-lunaforge');
  assert.equal(unfollow.followed, false);
  assert.equal((await service.listFollowingPosts()).total, 0);
});

test('sugestões removem usuário atual e perfis já seguidos', async () => {
  const { service } = fixture();
  const before = await service.listSuggestedUsers(10);
  assert.ok(before.every(user => user.id !== 'user-veemaster'));
  assert.ok(before.some(user => user.id === 'user-lunaforge'));
  await service.toggleFollow('user-lunaforge');
  const after = await service.listSuggestedUsers(10);
  assert.ok(after.every(user => user.id !== 'user-lunaforge'));
});

test('listas de seguidores e seguindo resolvem usuários reais', async () => {
  const { service } = fixture();
  await service.toggleFollow('user-knightshade');
  const following = await service.listFollowing('user-veemaster');
  const followers = await service.listFollowers('user-knightshade');
  assert.equal(following[0].id, 'user-knightshade');
  assert.equal(followers[0].id, 'user-veemaster');
});

test('curtidas do próprio perfil são privadas ao usuário atual e preservam interação', async () => {
  const { service } = fixture();
  const candidate = (await service.listPosts({ limit: 12 })).items.find(post => post.authorId !== 'user-veemaster');
  await service.toggleLike(candidate.id);
  const liked = await service.listCurrentUserLikedPosts({ limit: 20 });
  const post = liked.items.find(item => item.id === candidate.id);
  assert.ok(post);
  assert.equal(post.likedByCurrentUser, true);
});

test('denúncia local valida alvo, impede duplicação e conteúdo próprio', async () => {
  const { service, storage } = fixture();
  const otherPost = (await service.listPosts({ limit: 20 })).items.find(post => post.authorId !== 'user-veemaster');
  const report = await service.createReport({ targetType: 'post', targetId: otherPost.id, reason: 'spam', details: 'Teste local.' });
  assert.ok(report.id.startsWith('report-'));
  await assert.rejects(service.createReport({ targetType: 'post', targetId: otherPost.id, reason: 'other' }), { code: 'duplicate-report' });
  const ownPost = (await service.listUserPosts('user-veemaster', { limit: 20 })).items[0];
  await assert.rejects(service.createReport({ targetType: 'post', targetId: ownPost.id, reason: 'spam' }), { code: 'cannot-report-self' });
  await assert.rejects(service.createReport({ targetType: 'user', targetId: 'user-veemaster', reason: 'spam' }), { code: 'cannot-report-self' });
  const state = JSON.parse(storage.getItem(COMMUNITY_STORAGE_KEY));
  assert.equal(state.reports.length, 1);
  assert.equal(state.reports[0].status, 'pending');
});

test('validação de perfil e denúncia aplica limites e avatar local permitido', () => {
  assert.equal(validateProfile({ displayName: 'Vee', bio: '', avatar: 'assets/vee/avatars/vee-avatar-default.webp' }).displayName, 'Vee');
  assert.throws(() => validateProfile({ displayName: 'x', bio: '', avatar: 'assets/vee/avatars/vee-avatar-default.webp' }), error => Boolean(error.fieldErrors.displayName));
  assert.throws(() => validateProfile({ displayName: 'Vee', bio: '', avatar: 'https://evil.test/avatar.png' }), error => Boolean(error.fieldErrors.avatar));
  assert.equal(validateReport({ targetType: 'user', targetId: 'user-x', reason: 'other', details: '<script>alert(1)</script>' }).details, '<script>alert(1)</script>');
  assert.throws(() => validateReport({ targetType: 'post', targetId: 'post-x', reason: 'invalid' }), error => Boolean(error.fieldErrors.reason));
});
