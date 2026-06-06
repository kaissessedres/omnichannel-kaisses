require('dotenv').config();

const express = require('express');
const { initDb } = require('./db/schema');
const { startPolling } = require('./poller');
const evolutionWebhook = require('./webhook/evolution');
const libredeskWebhook = require('./webhook/libredesk');

const app = express();
app.use(express.json());

app.use('/webhook/evolution', evolutionWebhook);
app.use('/webhook/libredesk', libredeskWebhook);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

async function main() {
  initDb();
  startPolling();
  const port = process.env.WEBHOOK_PORT || 3000;
  app.listen(port, () => console.log(`[bridge] Rodando na porta ${port}`));
}

main().catch(err => {
  console.error('[bridge] Falha ao iniciar:', err);
  process.exit(1);
});
