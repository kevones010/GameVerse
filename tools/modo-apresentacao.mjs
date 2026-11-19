// Gera a cópia de segurança do "modo apresentação" pelo Node (alternativa à página modo-apresentacao.html).
//
// Uso (na pasta do projeto, com internet):
//   node tools/modo-apresentacao.mjs               -> dados + imagens dos jogos principais
//   node tools/modo-apresentacao.mjs --sem-imagens -> só os dados
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSnapshot } from '../js/tools/snapshotBuilder.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function readApiKey() {
  const configPath = join(ROOT, 'js', 'config.local.js');
  if (!existsSync(configPath)) throw new Error('js/config.local.js não encontrado.');
  const { LOCAL_CONFIG } = await import(pathToFileURL(configPath).href);
  return LOCAL_CONFIG?.RAWG_API_KEY || '';
}

async function main() {
  const withImages = !process.argv.includes('--sem-imagens');
  if (withImages) await rm(join(ROOT, 'assets', 'offline'), { recursive: true, force: true });
  await buildSnapshot({
    apiKey: await readApiKey(),
    withImages,
    writeFile: async (relativePath, content) => {
      const target = join(ROOT, ...relativePath.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
  });
}

main().catch((error) => {
  console.error(`\nNão foi possível gerar o modo apresentação: ${error.message}`);
  process.exitCode = 1;
});
