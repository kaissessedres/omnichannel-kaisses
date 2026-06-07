// Criptografia simétrica do campo ChannelAccount.credentials — ver
// docs/ERD-megachat.md ("Por que criptografar credentials?"): tokens OAuth
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
// ⚠️  Quem for persistir ChannelAccount.credentials (fluxo de OAuth das
//     Fases 7/8/10 — ainda não existe: hoje só getCredentials() consome o
//     valor já salvo) PRECISA chamar encrypt(JSON.stringify(creds)) antes
//     do INSERT/UPDATE. Sem isso, getCredentials() vai rejeitar o valor em
//     texto plano como "formato inesperado" — decrypt não tem fallback.
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

module.exports = { encrypt, decrypt, getCredentials };
