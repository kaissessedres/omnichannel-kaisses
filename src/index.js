require('dotenv').config();

const express = require('express');
const { initDb } = require('./db/schema');
const { startPolling } = require('./poller');
const evolutionWebhook = require('./webhook/evolution');
const libredeskWebhook = require('./webhook/libredesk');

const app = express();
// `verify` guarda o corpo bruto em req.rawBody — necessário pro webhook do
// Libredesk validar a assinatura HMAC, que é calculada sobre os bytes
// originais (re-serializar req.body via JSON.stringify pode gerar uma
// string diferente byte a byte e quebrar a verificação).
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

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
