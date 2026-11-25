// Contas locais do GameVerse: ficam só neste navegador (localStorage), sem servidor.
//
// É um login de demonstração para o projeto. A senha nunca é guardada: guardamos um "hash"
// PBKDF2-SHA256 com sal aleatório, como sistemas de verdade fazem. Mesmo assim, quem tem acesso
// a este computador consegue apagar ou trocar os dados — por isso não use uma senha real sua.

export const ACCOUNTS_STORAGE_KEY = 'gameverse-contas:v1';
export const AUTH_EVENT = 'gameverse:conta';
export const DEMO_ACCOUNT = Object.freeze({
  id: 'demo-veemaster',
  username: 'veemaster',
  displayName: 'VeeMaster',
  communityUserId: 'user-veemaster',
  demo: true
});

const ITERATIONS = 120000;
const USERNAME = /^[a-z0-9_.]{3,20}$/;

export class AuthError extends Error {
  constructor(message, { code = 'auth-error', field = null } = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.field = field;
  }
}

export function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase();
}

// Regras do cadastro. Devolve os dados limpos ou lança AuthError apontando o campo.
export function validateRegistration({ username, displayName, password, confirmPassword } = {}, reservedUsernames = []) {
  const cleanUsername = normalizeUsername(username);
  const cleanName = String(displayName || '').trim().replace(/\s+/g, ' ');
  const pass = String(password || '');

  if (!USERNAME.test(cleanUsername)) {
    throw new AuthError('O usuário precisa ter de 3 a 20 caracteres: letras minúsculas, números, "_" ou ".".', { code: 'invalid-username', field: 'username' });
  }
  if (reservedUsernames.includes(cleanUsername)) {
    throw new AuthError('Esse nome de usuário já está em uso.', { code: 'username-taken', field: 'username' });
  }
  if (cleanName.length < 2 || cleanName.length > 40) {
    throw new AuthError('O nome de exibição precisa ter de 2 a 40 caracteres.', { code: 'invalid-name', field: 'displayName' });
  }
  if (pass.length < 6 || pass.length > 128) {
    throw new AuthError('A senha precisa ter pelo menos 6 caracteres.', { code: 'weak-password', field: 'password' });
  }
  if (confirmPassword !== undefined && confirmPassword !== pass) {
    throw new AuthError('As senhas não são iguais.', { code: 'password-mismatch', field: 'confirmPassword' });
  }
  return { username: cleanUsername, displayName: cleanName, password: pass };
}

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function hashPassword(cryptoApi, password, salt, iterations) {
  const key = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await cryptoApi.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toBase64(bits);
}

// Compara sem parar no primeiro caractere diferente.
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function randomId(cryptoApi) {
  const bytes = cryptoApi.getRandomValues(new Uint8Array(8));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// storage e cryptoApi são injetáveis para os testes (Node).
export function createAccountStore({ storage, cryptoApi = globalThis.crypto, reservedUsernames = [], notify = () => {} } = {}) {
  const read = () => {
    try {
      const data = JSON.parse(storage.getItem(ACCOUNTS_STORAGE_KEY) || 'null');
      if (data && Array.isArray(data.accounts)) return data;
    } catch { /* dados estragados: começa do zero */ }
    return { accounts: [], session: null };
  };
  const write = (data) => {
    try {
      storage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      throw new AuthError('Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado).', { code: 'storage-error' });
    }
    notify();
  };
  const publicAccount = (account) => (account ? {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    communityUserId: account.communityUserId,
    createdAt: account.createdAt,
    demo: false
  } : null);

  return {
    currentAccount() {
      const data = read();
      const accountId = data.session?.accountId;
      if (!accountId) return null;
      if (accountId === DEMO_ACCOUNT.id) return { ...DEMO_ACCOUNT };
      return publicAccount(data.accounts.find((account) => account.id === accountId));
    },

    async register(input) {
      const data = read();
      const taken = [...reservedUsernames, DEMO_ACCOUNT.username, ...data.accounts.map((account) => account.username)];
      const { username, displayName, password } = validateRegistration(input, taken);
      const salt = cryptoApi.getRandomValues(new Uint8Array(16));
      const id = `acc-${randomId(cryptoApi)}`;
      const account = {
        id,
        username,
        displayName,
        communityUserId: `user-${id}`,
        salt: toBase64(salt),
        hash: await hashPassword(cryptoApi, password, salt, ITERATIONS),
        iterations: ITERATIONS,
        createdAt: new Date().toISOString()
      };
      write({ accounts: [...data.accounts, account], session: { accountId: id, startedAt: account.createdAt } });
      return publicAccount(account);
    },

    async login({ username, password } = {}) {
      const data = read();
      const account = data.accounts.find((item) => item.username === normalizeUsername(username));
      // Mesma mensagem para usuário inexistente e senha errada: não entrega quais usuários existem.
      const fail = new AuthError('Usuário ou senha incorretos.', { code: 'invalid-credentials' });
      if (!account) {
        await hashPassword(cryptoApi, String(password || ''), new Uint8Array(16), ITERATIONS); // mesmo tempo de resposta
        throw fail;
      }
      const hash = await hashPassword(cryptoApi, String(password || ''), fromBase64(account.salt), account.iterations);
      if (!sameText(hash, account.hash)) throw fail;
      write({ ...data, session: { accountId: account.id, startedAt: new Date().toISOString() } });
      return publicAccount(account);
    },

    loginDemo() {
      const data = read();
      write({ ...data, session: { accountId: DEMO_ACCOUNT.id, startedAt: new Date().toISOString() } });
      return { ...DEMO_ACCOUNT };
    },

    logout() {
      const data = read();
      write({ ...data, session: null });
    },

    // Apaga a conta (só o login; as publicações na comunidade continuam).
    async deleteAccount(password) {
      const account = this.currentAccount();
      if (!account || account.demo) throw new AuthError('Não há conta para excluir.', { code: 'no-account' });
      const data = read();
      const saved = data.accounts.find((item) => item.id === account.id);
      const hash = await hashPassword(cryptoApi, String(password || ''), fromBase64(saved.salt), saved.iterations);
      if (!sameText(hash, saved.hash)) throw new AuthError('Senha incorreta.', { code: 'invalid-credentials', field: 'password' });
      write({ accounts: data.accounts.filter((item) => item.id !== account.id), session: null });
    }
  };
}

// Instância do navegador. Avisa as outras partes da página (e outras abas, via evento "storage").
let browserStore = null;
export function accountStore() {
  if (!browserStore) {
    browserStore = createAccountStore({
      storage: localStorage,
      reservedUsernames: RESERVED_USERNAMES,
      notify: () => window.dispatchEvent(new CustomEvent(AUTH_EVENT))
    });
  }
  return browserStore;
}

// Nomes dos perfis de exemplo da comunidade (não podem ser usados no cadastro).
export const RESERVED_USERNAMES = ['veemaster', 'lunaforge', 'knightshade', 'tarnishedbr', 'redherb', 'cloudsave', 'admin', 'gameverse', 'visitante'];

// Só aceita voltar para uma página do próprio site (evita mandar a pessoa para outro endereço).
export function safeReturnPath(value, fallback = 'index.html') {
  const text = String(value || '');
  return /^[a-z0-9-]+\.html(\?[^#\s]*)?$/i.test(text) && !text.startsWith('login.html') ? text : fallback;
}

export function loginUrl(returnTo = currentPagePath()) {
  return `login.html?voltar=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

function currentPagePath() {
  if (typeof location === 'undefined') return 'index.html';
  const page = location.pathname.split('/').pop() || 'index.html';
  return `${page}${location.search}`;
}
