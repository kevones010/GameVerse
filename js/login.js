// Página de login/cadastro (contas locais, ver js/services/auth/accountStore.js).
import { accountStore, safeReturnPath } from './services/auth/accountStore.js';

const params = new URLSearchParams(location.search);
const returnTo = safeReturnPath(params.get('voltar'));
const store = accountStore();

const tabs = {
  login: { tab: document.getElementById('tabLogin'), form: document.getElementById('loginForm') },
  register: { tab: document.getElementById('tabRegister'), form: document.getElementById('registerForm') }
};

function showTab(name, focus = true) {
  Object.entries(tabs).forEach(([key, { tab, form }]) => {
    const active = key === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    form.hidden = !active;
  });
  if (focus) tabs[name].form.querySelector('input')?.focus();
}

tabs.login.tab.addEventListener('click', () => showTab('login'));
tabs.register.tab.addEventListener('click', () => showTab('register'));
// Setas trocam de aba (padrão de acessibilidade para "tabs").
document.querySelector('.auth-tabs').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const next = tabs.login.tab.getAttribute('aria-selected') === 'true' ? 'register' : 'login';
  showTab(next, false);
  tabs[next].tab.focus();
});

document.querySelectorAll('.password-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ocultar' : 'Mostrar';
    button.setAttribute('aria-pressed', String(show));
  });
});

function showError(form, error) {
  const box = form.querySelector('.auth-error');
  box.textContent = error?.message || 'Algo deu errado. Tente de novo.';
  form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
  const field = error?.field && form.querySelector(`[name="${error.field}"]`);
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus();
  }
}

async function submit(form, action) {
  const button = form.querySelector('[type="submit"]');
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Aguarde…';
  form.querySelector('.auth-error').textContent = '';
  try {
    await action(Object.fromEntries(new FormData(form)));
    location.href = returnTo;
  } catch (error) {
    showError(form, error);
    button.disabled = false;
    button.textContent = label;
  }
}

tabs.login.form.addEventListener('submit', (event) => {
  event.preventDefault();
  submit(tabs.login.form, (data) => store.login(data));
});

tabs.register.form.addEventListener('submit', (event) => {
  event.preventDefault();
  submit(tabs.register.form, (data) => store.register(data));
});

document.getElementById('demoLogin').addEventListener('click', () => {
  store.loginDemo();
  location.href = returnTo;
});

document.getElementById('skipLogin').href = returnTo;

// Já entrou? Mostra quem é e oferece sair.
const current = store.currentAccount();
if (current) {
  const notice = document.createElement('div');
  notice.className = 'auth-current';
  notice.setAttribute('role', 'status');
  const text = document.createElement('p');
  text.append('Você já entrou como ', Object.assign(document.createElement('strong'), { textContent: current.displayName }), '.');
  const go = Object.assign(document.createElement('a'), { className: 'btn btn-primary', href: returnTo, textContent: 'Continuar' });
  const exit = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-secondary', textContent: 'Sair desta conta' });
  exit.addEventListener('click', () => {
    store.logout();
    notice.remove();
  });
  notice.append(text, go, exit);
  document.querySelector('.auth-tabs').before(notice);
}

if (params.get('aba') === 'cadastro') showTab('register', false);
