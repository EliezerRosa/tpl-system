import { readFile } from 'fs/promises';
import path from 'path';

/**
 * Atualização: gere um novo PAT, salve-o em public/token.json com o app e execute este script para publicar o artefato ofuscado.
 * Revogação: remova o PAT em github.com/settings/tokens, zere public/token.json (payload [] e checksum null) e rode novamente o script.
 */

const token = process.env.GITHUB_TOKEN || process.env.PAT || process.argv[2];

if (!token) {
  console.error('Forneça o PAT via variável GITHUB_TOKEN/PAT ou como primeiro argumento.');
  process.exit(1);
}

const owner = process.env.GITHUB_OWNER || 'EliezerRosa';
const repo = process.env.GITHUB_REPO || 'ControleDeTerrorio';
const filePath = 'public/token.json';
const message = 'Token distribuído para GitHub Pages';

async function main() {
  const absolutePath = path.resolve('public/token.json');
  const content = await readFile(absolutePath, 'utf8');
  const base64 = Buffer.from(content, 'utf8').toString('base64');

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  let sha;
  const getResponse = await fetch(url, { headers });
  if (getResponse.status === 200) {
    const payload = await getResponse.json();
    sha = payload.sha;
  } else if (getResponse.status !== 404) {
    throw new Error(`GET ${url} retornou status ${getResponse.status}`);
  }

  const putResponse = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: base64,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putResponse.ok) {
    const errorBody = await putResponse.text();
    throw new Error(`PUT retornou status ${putResponse.status}: ${errorBody}`);
  }

  const result = await putResponse.json();
  console.log(`Arquivo publicado com sucesso. Commit ${result.commit.sha}`);
}

main().catch((error) => {
  console.error('Erro ao publicar artefato:', error);
  process.exit(1);
});
