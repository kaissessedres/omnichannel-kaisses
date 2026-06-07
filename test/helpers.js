// Utilitários compartilhados entre os testes.
// Só wrappers finos sobre o que Node/Express já oferecem — sem dependências novas.

const http = require('node:http');
const express = require('express');

// Sobe um servidor HTTP efêmero (porta aleatória) com o router montado em
// `mountPath`. Devolve a base URL e uma função pra derrubar o servidor —
// usado pelos testes de webhook, que precisam exercitar o roteamento real
// do Express (não só chamar a função do handler isolada).
async function startRouterServer(mountPath, router) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// Substitui global.fetch por `impl` durante a execução de `fn` e restaura
// o original no final (mesmo se `fn` lançar). Os conectores e o cliente do
// Libredesk usam fetch nativo, então isso basta pra simular as APIs externas.
async function withMockFetch(impl, fn) {
  const original = global.fetch;
  global.fetch = impl;
  try {
    return await fn();
  } finally {
    global.fetch = original;
  }
}

// Os webhooks respondem 200 imediatamente e processam o resto de forma
// assíncrona (await na Libredesk/no conector) — então o efeito colateral
// que o teste quer checar (linha no banco, chamada mockada) pode não ter
// acontecido ainda quando a resposta HTTP chega. Em vez de adivinhar a
// ordem exata das microtasks, espera até `checkFn` devolver algo truthy
// ou estourar o timeout — robusto e rápido (tudo aqui é local/em memória).
async function waitFor(checkFn, { timeout = 2000, interval = 10 } = {}) {
  const start = Date.now();
  for (;;) {
    const result = checkFn();
    if (result) return result;
    if (Date.now() - start >= timeout) {
      throw new Error(`waitFor: condição não satisfeita em ${timeout}ms`);
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

// Insere uma linha em ChannelAccount com valores padrão razoáveis,
// devolve o id gerado. Usado pelos testes que dependem de uma conta existir.
function seedAccount(db, overrides = {}) {
  const account = {
    channel_type: 'whatsapp',
    account_label: 'Conta de teste',
    credentials: '{}',
    evolution_instance_id: null,
    libredesk_inbox_id: 1,
    status: 'active',
    ...overrides,
  };
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO ChannelAccount
      (channel_type, account_label, credentials, evolution_instance_id, libredesk_inbox_id, status)
    VALUES (@channel_type, @account_label, @credentials, @evolution_instance_id, @libredesk_inbox_id, @status)
  `).run(account);
  return lastInsertRowid;
}

module.exports = { startRouterServer, withMockFetch, waitFor, seedAccount };
