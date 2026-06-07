// Testa src/db/crypto.js — a criptografia simétrica (AES-256-GCM) usada no
// campo ChannelAccount.credentials (ver "Por que criptografar credentials?"
// em docs/ERD-megachat.md). Gera sua própria ENCRYPTION_KEY de teste — não
// depende de segredo real nem de banco.

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENCRYPTION_KEY = 'b'.repeat(64);

const { encrypt, decrypt, getCredentials, setCredentials } = require('../../src/db/crypto');

// Troca ENCRYPTION_KEY temporariamente — só usado nos testes que checam o
// comportamento com chave ausente/inválida, restaura no final mesmo se `fn` lançar.
function withEncryptionKey(value, fn) {
  const original = process.env.ENCRYPTION_KEY;
  if (value === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = value;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = original;
  }
}

test('encrypt/decrypt fazem ida e volta sem perder o conteúdo original', () => {
  const plaintext = JSON.stringify({ access_token: 'abc123', refresh_token: 'xyz789' });
  assert.equal(decrypt(encrypt(plaintext)), plaintext);
});

test('encrypt gera um resultado diferente a cada chamada — IV aleatório (não dá pra comparar ciphertexts)', () => {
  const plaintext = 'mesmo conteúdo';
  assert.notEqual(encrypt(plaintext), encrypt(plaintext));
});

test('o resultado de encrypt tem o formato "iv:authTag:ciphertext" em hex', () => {
  const parts = encrypt('qualquer coisa').split(':');
  assert.equal(parts.length, 3);
  for (const part of parts) assert.match(part, /^[0-9a-f]+$/);
});

test('decrypt rejeita payload adulterado — GCM detecta a violação pelo authTag', () => {
  const [iv, authTag, ciphertext] = encrypt('conteúdo sensível').split(':');
  const ultimoByte = ciphertext.slice(-2);
  const adulterado = [iv, authTag, ciphertext.slice(0, -2) + (ultimoByte === '00' ? '01' : '00')].join(':');
  assert.throws(() => decrypt(adulterado));
});

test('decrypt rejeita payload em formato inesperado (não cifrado por encrypt)', () => {
  assert.throws(() => decrypt('texto-plano-sem-cifrar'), /formato inesperado/);
  assert.throws(() => decrypt('{}'), /formato inesperado/);
});

test('encrypt/decrypt exigem ENCRYPTION_KEY com 32 bytes em hex (openssl rand -hex 32)', () => {
  withEncryptionKey(undefined, () => {
    assert.throws(() => encrypt('x'), /ENCRYPTION_KEY ausente ou inválida/);
  });
  withEncryptionKey('chave-curta-demais', () => {
    assert.throws(() => encrypt('x'), /ENCRYPTION_KEY ausente ou inválida/);
  });
});

test('getCredentials decifra e faz parse do JSON salvo em credentials', () => {
  const creds = { access_token: 'tok-1', seller_id: '999' };
  const account = { credentials: encrypt(JSON.stringify(creds)) };
  assert.deepEqual(getCredentials(account), creds);
});

test('getCredentials devolve {} quando a conta ainda não tem credentials salvas (null/vazio/ausente)', () => {
  assert.deepEqual(getCredentials({ credentials: null }), {});
  assert.deepEqual(getCredentials({ credentials: undefined }), {});
  assert.deepEqual(getCredentials({ credentials: '' }), {});
  assert.deepEqual(getCredentials({}), {});
});

test('setCredentials cifra o objeto e getCredentials lê de volta (round-trip simétrico do lado de escrita)', () => {
  const creds = { access_token: 'tok', refresh_token: 'ref', seller_id: '999' };
  const stored = setCredentials(creds);
  // está cifrado, não é o JSON em texto plano
  assert.match(stored, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  assert.notEqual(stored, JSON.stringify(creds));
  // e decifra de volta no objeto original
  assert.deepEqual(getCredentials({ credentials: stored }), creds);
});

test('setCredentials devolve null para objeto vazio/nulo (conta sem token — ex: WhatsApp)', () => {
  assert.equal(setCredentials({}), null);
  assert.equal(setCredentials(null), null);
  assert.equal(setCredentials(undefined), null);
});
