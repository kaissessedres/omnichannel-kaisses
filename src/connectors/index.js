// Registro central de conectores — composition root
// Único lugar que importa os módulos de conector.
// poller.js e webhook/libredesk.js dependem só deste índice,
// nunca dos arquivos individuais — evita duas listas que podem divergir.

const whatsapp     = require('./whatsapp');
const instagram    = require('./instagram');
const mercadolivre = require('./mercadolivre');
const shopee       = require('./shopee');

// Todos os conectores — usado para rotear a resposta do lojista (sendMessage)
const ALL = { whatsapp, instagram, mercadolivre, shopee };

// Conectores orientados a polling — implementam fetchNewMessages de verdade.
// WhatsApp recebe via webhook do Evolution API (sem polling).
const POLLED = { instagram, mercadolivre, shopee };

module.exports = { ALL, POLLED };
