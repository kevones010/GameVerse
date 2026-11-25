import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountStore, validateRegistration, safeReturnPath, ACCOUNTS_STORAGE_KEY, AuthError } from '../js/services/auth/accountStore.js';
import { CommunityService } from '../js/services/community/communityService.js';
import { CommunitySession } from '../js/services/community/communitySession.js';
import { LocalCommunityRepository } from '../js/services/community/localCommunityRepository.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

function fixture() {
  const storage = memoryStorage();
  const accounts = createAccountStore({ storage, reservedUsernames: ['lunaforge'] });
  const repository = new LocalCommunityRepository(storage);
  return { storage, accounts, service: new CommunityService(repository, new CommunitySession(repository, accounts)) };
}

const newAccount = { username: 'Kevin_01', displayName: '  Kevin  ', password: 'segredo123', confirmPassword: 'segredo123' };

test('cadastro valida usuário, nome e senha apontando o campo', () => {
  const field = (input) => { try { validateRegistration(input); } catch (error) { return error.field; } return null; };
  assert.equal(field({ ...newAccount, username: 'a' }), 'username');
  assert.equal(field({ ...newAccount, username: 'com espaço' }), 'username');
  assert.equal(field({ ...newAccount, displayName: 'K' }), 'displayName');
  assert.equal(field({ ...newAccount, password: '123', confirmPassword: '123' }), 'password');
  assert.equal(field({ ...newAccount, confirmPassword: 'outra' }), 'confirmPassword');
  assert.deepEqual(validateRegistration(newAccount), { username: 'kevin_01', displayName: 'Kevin', password: 'segredo123' });
});

test('cadastrar entra na conta e a senha não fica salva em texto', async () => {
  const { storage, accounts } = fixture();
  const account = await accounts.register(newAccount);
  assert.equal(account.username, 'kevin_01');
  assert.equal(accounts.currentAccount().id, account.id);
  const saved = storage.getItem(ACCOUNTS_STORAGE_KEY);
  assert.ok(!saved.includes('segredo123'));
  assert.match(JSON.parse(saved).accounts[0].hash, /^[A-Za-z0-9+/=]{40,}$/);
});

test('usuário repetido ou reservado é recusado', async () => {
  const { accounts } = fixture();
  await accounts.register(newAccount);
  await assert.rejects(accounts.register({ ...newAccount, username: 'KEVIN_01' }), { code: 'username-taken' });
  await assert.rejects(accounts.register({ ...newAccount, username: 'lunaforge' }), { code: 'username-taken' });
  await assert.rejects(accounts.register({ ...newAccount, username: 'veemaster' }), { code: 'username-taken' });
});

test('login com senha certa entra; senha errada e usuário inexistente dão a mesma mensagem', async () => {
  const { accounts } = fixture();
  await accounts.register(newAccount);
  accounts.logout();
  assert.equal(accounts.currentAccount(), null);

  const wrong = await accounts.login({ username: 'kevin_01', password: 'errada' }).catch((error) => error);
  const missing = await accounts.login({ username: 'ninguem', password: 'segredo123' }).catch((error) => error);
  assert.ok(wrong instanceof AuthError);
  assert.equal(wrong.message, missing.message);
  assert.equal(accounts.currentAccount(), null);

  await accounts.login({ username: '@Kevin_01', password: 'segredo123' });
  assert.equal(accounts.currentAccount().username, 'kevin_01');
});

test('conta de demonstração usa o perfil VeeMaster', async () => {
  const { accounts, service } = fixture();
  accounts.loginDemo();
  const user = await service.getCurrentUser();
  assert.equal(user.id, 'user-veemaster');
  assert.equal(user.displayName, 'VeeMaster');
});

test('visitante lê a comunidade, mas não publica nem curte', async () => {
  const { service } = fixture();
  const guest = await service.getCurrentUser();
  assert.equal(guest.isGuest, true);
  const page = await service.listPosts({ tab: 'recent', limit: 3 });
  assert.equal(page.items.length, 3);
  await assert.rejects(service.toggleLike(page.items[0].id), { code: 'login-required' });
  await assert.rejects(service.createPost({ type: 'guide', title: 'Guia de teste', content: 'Conteúdo suficiente para publicação.' }), { code: 'login-required' });
  await assert.rejects(service.createComment(page.items[0].id, { content: 'oi' }), { code: 'login-required' });
});

test('conta nova ganha um perfil na comunidade e publica com ele', async () => {
  const { accounts, service } = fixture();
  const account = await accounts.register(newAccount);
  const user = await service.getCurrentUser();
  assert.equal(user.id, account.communityUserId);
  assert.equal(user.handle, 'kevin_01');
  assert.equal(user.displayName, 'Kevin');
  const post = await service.createPost({ type: 'guide', title: 'Meu primeiro guia', content: 'Conteúdo suficiente para publicação.' });
  assert.equal(post.authorId, account.communityUserId);
  // Chamar de novo não duplica o perfil.
  assert.equal((await service.getCurrentUser()).id, account.communityUserId);
});

test('excluir conta pede a senha e encerra a sessão', async () => {
  const { accounts } = fixture();
  await accounts.register(newAccount);
  await assert.rejects(accounts.deleteAccount('errada'), { code: 'invalid-credentials' });
  await accounts.deleteAccount('segredo123');
  assert.equal(accounts.currentAccount(), null);
  await assert.rejects(accounts.login({ username: 'kevin_01', password: 'segredo123' }), { code: 'invalid-credentials' });
});

test('safeReturnPath só aceita páginas do próprio site', () => {
  assert.equal(safeReturnPath('perfil.html'), 'perfil.html');
  assert.equal(safeReturnPath('comunidade-jogo.html?gameId=3498'), 'comunidade-jogo.html?gameId=3498');
  assert.equal(safeReturnPath('https://site-malicioso.com'), 'index.html');
  assert.equal(safeReturnPath('//evil.com/x.html'), 'index.html');
  assert.equal(safeReturnPath('javascript:alert(1)'), 'index.html');
  assert.equal(safeReturnPath('login.html'), 'index.html');
  assert.equal(safeReturnPath(null), 'index.html');
});
