// Botão da conta no topo de todas as páginas: "Entrar" para visitantes,
// avatar + nome com menu (Meu perfil, Minha coleção, Sair) para quem entrou.
import { accountStore, loginUrl, ACCOUNTS_STORAGE_KEY } from './services/auth/accountStore.js';
import { LocalCommunityRepository } from './services/community/localCommunityRepository.js';
import { CommunitySession } from './services/community/communitySession.js';

const DEFAULT_AVATAR = 'assets/vee/avatars/vee-avatar-default.webp';
const safeAvatar = (value) => (/^(https:\/\/|assets\/)/i.test(value || '') ? value : DEFAULT_AVATAR);

function ensureStylesheet() {
  if (document.querySelector('link[href="css/account.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/account.css';
  document.head.append(link);
}

// O topo da página do jogo é montado depois pelo JavaScript: espera ele aparecer.
function whenNavReady(callback) {
  const find = () => document.querySelector('.topbar .nav-actions, header .nav-actions');
  const nav = find();
  if (nav) return callback(nav);
  const observer = new MutationObserver(() => {
    const found = find();
    if (found) {
      observer.disconnect();
      callback(found);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return undefined;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function communityProfile(account) {
  try {
    const repository = new LocalCommunityRepository();
    return await new CommunitySession(repository, accountStore()).getCurrentUser();
  } catch {
    return { displayName: account.displayName, avatar: DEFAULT_AVATAR, id: account.communityUserId };
  }
}

function logout() {
  accountStore().logout();
  // No próprio perfil, sair leva para a Home; nas outras páginas, só recarrega.
  const onOwnProfile = location.pathname.endsWith('perfil.html') && !new URLSearchParams(location.search).get('userId');
  if (onOwnProfile) location.href = 'index.html';
  else location.reload();
}

async function render(nav) {
  nav.querySelector('.profile-pill')?.remove();
  // Comunidade e Perfil já têm um #communityUser: reaproveita para não duplicar.
  let link = nav.querySelector('#communityUser');
  if (!link) {
    link = element('a', 'community-user');
    link.id = 'communityUser';
  }
  const wrapper = element('div', 'account-menu');
  link.replaceWith(wrapper);
  wrapper.append(link);
  nav.append(wrapper);

  const account = accountStore().currentAccount();
  if (!account) {
    link.className = 'community-user account-login';
    link.href = loginUrl();
    link.removeAttribute('title');
    link.setAttribute('aria-label', 'Entrar ou criar conta');
    link.replaceChildren(element('span', '', 'Entrar'));
    return;
  }

  const user = await communityProfile(account);
  const avatar = element('img');
  avatar.src = safeAvatar(user?.avatar);
  avatar.alt = '';
  avatar.width = 32;
  avatar.height = 32;
  link.className = 'community-user';
  link.href = `perfil.html?userId=${encodeURIComponent(user?.id || account.communityUserId)}`;
  link.setAttribute('aria-label', 'Abrir meu perfil');
  link.replaceChildren(avatar, element('span', '', user?.displayName || account.displayName));

  const toggle = element('button', 'account-toggle', '▾');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Menu da conta');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'accountDropdown');

  const menu = element('div', 'account-dropdown');
  menu.id = 'accountDropdown';
  menu.hidden = true;
  const who = element('p', 'account-who');
  who.append(element('strong', '', user?.displayName || account.displayName), element('span', '', `@${account.username}${account.demo ? ' · demonstração' : ''}`));
  const profileLink = element('a', '', '👤 Meu perfil');
  profileLink.href = link.href;
  const collectionLink = element('a', '', '📚 Minha coleção');
  collectionLink.href = 'favoritos.html';
  const exit = element('button', 'account-logout', '↩ Sair');
  exit.type = 'button';
  exit.addEventListener('click', logout);
  menu.append(who, profileLink, collectionLink, exit);
  wrapper.append(toggle, menu);

  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(menu.hidden);
    if (!menu.hidden) profileLink.focus();
  });
  document.addEventListener('click', (event) => { if (!wrapper.contains(event.target)) setOpen(false); });
  wrapper.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
}

ensureStylesheet();
whenNavReady((nav) => { void render(nav); });

// Entrou ou saiu em outra aba: atualiza esta também.
window.addEventListener('storage', (event) => {
  if (event.key === ACCOUNTS_STORAGE_KEY) location.reload();
});
