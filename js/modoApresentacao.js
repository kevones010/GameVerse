// Página que gera a cópia do modo apresentação direto pelo navegador (não precisa de Node).
// Usa a API de arquivos do Chrome/Edge para gravar na pasta do projeto que a pessoa escolher.
import { buildSnapshot } from './tools/snapshotBuilder.js';
import { getLocalConfig } from './services/localConfig.js';

const FORCE_KEY = 'gameverse:forcar-offline';
const logBox = document.getElementById('presentationLog');
const statusBox = document.getElementById('snapshotStatus');
const generateButton = document.getElementById('generateButton');
const forceButton = document.getElementById('forceButton');

function log(message) {
  logBox.hidden = false;
  logBox.textContent += `${message}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

async function showSnapshotStatus() {
  try {
    const response = await fetch('data/offline/rawg-snapshot.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('sem cópia');
    const snapshot = await response.json();
    const date = new Date(snapshot.createdAt).toLocaleString('pt-BR');
    statusBox.className = 'presentation-status is-ready';
    statusBox.textContent = `✅ Cópia pronta, gerada em ${date}: ${snapshot.pool.length} jogos no catálogo e ${Object.keys(snapshot.games).length} com página completa.`;
  } catch {
    statusBox.className = 'presentation-status is-missing';
    statusBox.textContent = '⚠️ Ainda não existe cópia. Gere uma antes da apresentação.';
  }
}

function isForced() {
  try { return localStorage.getItem(FORCE_KEY) === '1'; } catch { return false; }
}

function renderForceButton() {
  forceButton.textContent = isForced() ? '🌐 Voltar a usar a RAWG' : '🧪 Testar como se a RAWG estivesse fora';
  forceButton.setAttribute('aria-pressed', String(isForced()));
}

forceButton.addEventListener('click', () => {
  try {
    if (isForced()) localStorage.removeItem(FORCE_KEY);
    else localStorage.setItem(FORCE_KEY, '1');
    sessionStorage.clear(); // limpa o cache de listas para o teste valer na hora
  } catch { /* navegador sem armazenamento */ }
  renderForceButton();
  log(isForced() ? 'Modo de teste LIGADO: o site vai usar só a cópia salva. Abra a Home para ver.' : 'Modo de teste desligado: o site volta a usar a RAWG.');
});

// Cria as subpastas e grava o arquivo dentro da pasta escolhida.
function folderWriter(root) {
  return async (relativePath, content) => {
    const parts = relativePath.split('/');
    const fileName = parts.pop();
    let dir = root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
    const file = await dir.getFileHandle(fileName, { create: true });
    const writable = await file.createWritable();
    await writable.write(content);
    await writable.close();
  };
}

async function pickProjectFolder() {
  const root = await window.showDirectoryPicker({ id: 'gameverse', mode: 'readwrite' });
  try {
    await root.getFileHandle('index.html');
    await root.getDirectoryHandle('js');
  } catch {
    throw new Error('Essa pasta não parece ser a do GameVerse (não achei index.html e js/). Escolha a pasta do projeto.');
  }
  return root;
}

function downloadJson(content) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  link.download = 'rawg-snapshot.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

generateButton.addEventListener('click', async () => {
  logBox.textContent = '';
  generateButton.disabled = true;
  try {
    const { RAWG_API_KEY } = await getLocalConfig();
    if (!RAWG_API_KEY) throw new Error('A chave da RAWG não está em js/config.local.js.');

    if (window.showDirectoryPicker) {
      const root = await pickProjectFolder();
      log('Pasta escolhida. Gerando…');
      await buildSnapshot({ apiKey: RAWG_API_KEY, writeFile: folderWriter(root), log, withImages: true });
    } else {
      // Navegador sem acesso a pastas (ex.: Firefox): baixa só o arquivo de dados.
      log('Este navegador não grava em pastas. Vou gerar só os dados e baixar o arquivo.');
      log('Depois, mova o rawg-snapshot.json para a pasta data/offline/ do projeto.');
      let json = '';
      await buildSnapshot({
        apiKey: RAWG_API_KEY,
        withImages: false,
        log,
        writeFile: async (path, content) => { if (path.endsWith('.json')) json = content; }
      });
      downloadJson(json);
    }
    await showSnapshotStatus();
  } catch (error) {
    if (error?.name === 'AbortError') log('Cancelado: nenhuma pasta foi escolhida.');
    else log(`❌ Não foi possível gerar: ${error.message}`);
  } finally {
    generateButton.disabled = false;
  }
});

renderForceButton();
showSnapshotStatus();
