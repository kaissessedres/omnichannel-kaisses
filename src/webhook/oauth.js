// Fluxo OAuth de ponta (Fases 7/8): leva o lojista a autorizar a conta no ML /
// Instagram e recebe o redirect com o `code`, troca pelo 1º token e PERSISTE
// cifrado. O `state` carrega o id do ChannelAccount sendo conectado (crie a
// conta antes — ex: pelo onboarding — em status 'disconnected').
//
// Pré-requisito real: OAUTH_REDIRECT_URI tem que ser uma URL pública igual à
// registrada no app do ML/Meta, e bater com a usada no /start. Por isso este
// fluxo só roda de ponta a ponta com o servidor exposto (ver DEPLOY-*).

const express = require('express');
const { getAccountById, saveCredentials, setAccountStatus } = require('../db/queries');
const mercadolivre = require('../connectors/mercadolivre');
const instagram = require('../connectors/instagram');

const router = express.Router();

// Só os canais com fluxo OAuth implementado. WhatsApp usa QR (Evolution),
// Shopee é P2 — ficam de fora.
const OAUTH_CONNECTORS = {
  mercadolivre,
  instagram,
};

function redirectUri() {
  const uri = process.env.OAUTH_REDIRECT_URI;
  if (!uri) throw new Error('OAUTH_REDIRECT_URI não configurada');
  return uri;
}

// GET /oauth/start?account=<id> → redireciona pra tela de autorização do canal
// da conta. O `state` é o próprio id da conta, que volta no callback.
router.get('/start', (req, res) => {
  const account = getAccountById(Number(req.query.account));
  if (!account) return res.status(404).send('Conta não encontrada');

  const connector = OAUTH_CONNECTORS[account.channel_type];
  if (!connector) return res.status(400).send(`Canal sem fluxo OAuth: ${account.channel_type}`);

  try {
    return res.redirect(connector.getAuthUrl(redirectUri(), String(account.id)));
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

// GET /oauth/callback?code=...&state=<accountId> → troca o code pelo token e
// salva cifrado, marcando a conta como ativa.
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Autorização recusada: ${error}`);
  if (!code || !state) return res.status(400).send('Faltam code/state');

  const account = getAccountById(Number(state));
  if (!account) return res.status(404).send('Conta não encontrada para esse state');

  const connector = OAUTH_CONNECTORS[account.channel_type];
  if (!connector) return res.status(400).send(`Canal sem fluxo OAuth: ${account.channel_type}`);

  try {
    const credentials = await connector.exchangeCode(code, redirectUri());
    saveCredentials(account.id, credentials);
    setAccountStatus(account.id, 'active');
    console.log(`[oauth] Conta ${account.id} (${account.channel_type}) conectada`);
    return res.send('Conta conectada! Pode fechar esta aba e voltar ao Megachat.');
  } catch (err) {
    console.error('[oauth] Erro no callback:', err.message);
    return res.status(502).send(`Falha ao conectar: ${err.message}`);
  }
});

module.exports = router;
