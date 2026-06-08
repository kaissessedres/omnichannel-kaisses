// Criptografia simétrica do campo ChannelAccount.credentials — ver
// docs/ERD-kaichat.md ("Por que criptografar credentials?"): tokens OAuth
// de Mercado Livre, Instagram e Shopee não podem ficar em texto plano no
// SQLite. AES-256-GCM autentica o conteúdo (detecta adulteração via authTag)
// e a chave vem de ENCRYPTION_KEY — gere com `openssl rand -hex 32`
// (32 bytes / 256 bits, codificados em hex).

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // tamanho recomendado para GCM

function getKey() {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY ausente ou inválida — gere com: openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
}

// Formato gravado: "iv:authTag:ciphertext", tudo em hex numa string só —
// cabe direto na coluna TEXT existente, sem mudar o schema.
//
// Para PERSISTIR credenciais não chame encrypt() direto: use setCredentials()
// (abaixo) ou as funções createAccount/saveCredentials de db/queries.js, que já
// cifram. getCredentials() rejeita texto plano como "formato inesperado" —
// decrypt não tem fallback, então gravar sem cifrar deixa a conta ilegível.
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((buf) => buf.toString('hex')).join(':');
}

function decrypt(payload) {
  const [ivHex, authTagHex, ciphertextHex] = String(payload).split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('credentials em formato inesperado — esperava "iv:authTag:ciphertext" cifrado');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}

// Decifra e faz o parse de ChannelAccount.credentials — único ponto que
// conhece o formato cifrado; conectores só devem lidar com o objeto pronto.
// `credentials` vazio/nulo = conta sem token salvo ainda (ex: antes do fluxo
// OAuth rodar, ou contas WhatsApp — que não usam este campo, ver ERD).
function getCredentials(channelAccount) {
  const raw = channelAccount?.credentials;
  if (!raw) return {};
  return JSON.parse(decrypt(raw));
}

// Inverso de getCredentials: serializa e cifra o objeto de credenciais para
// gravar na coluna. Objeto vazio/nulo vira NULL (conta sem token — ex: WhatsApp,
// ou antes do OAuth) — simétrico ao {} que getCredentials devolve ao ler NULL.
function setCredentials(credentials) {
  if (!credentials || Object.keys(credentials).length === 0) return null;
  return encrypt(JSON.stringify(credentials));
}

module.exports = { encrypt, decrypt, getCredentials, setCredentials };
