import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function hashPassword(password, salt = randomBytes(16).toString('base64url')) {
  const value = String(password ?? '');
  if (value.length < 12 || value.length > 256) {
    const error = new Error('PASSWORD_POLICY');
    error.code = 'PASSWORD_POLICY';
    throw error;
  }
  const derived = scryptSync(value, salt, 64).toString('base64url');
  return { salt, hash: derived };
}

export function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = Buffer.from(scryptSync(String(password ?? ''), salt, 64).toString('base64url'));
    const expected = Buffer.from(String(expectedHash ?? ''));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function parseCookies(header = '') {
  const result = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

export function sessionCookie(value, { secure = false, maxAge = 28_800 } = {}) {
  const parts = [`mono_session=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie({ secure = false } = {}) {
  const parts = ['mono_session=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function decodeSecretKey(value) {
  const key = Buffer.from(String(value ?? ''), 'base64');
  if (key.length !== 32) {
    const error = new Error('MONO_SECRET_KEY_MUST_BE_32_BYTES_BASE64');
    error.code = 'INVALID_SECRET_KEY';
    throw error;
  }
  return key;
}

export function encryptSecret(plaintext, secretKey) {
  const key = decodeSecretKey(secretKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

export function decryptSecret(record, secretKey) {
  const key = decodeSecretKey(secretKey);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

export function webhookSignature(rawBody, secret) {
  return `sha256=${createHmac('sha256', String(secret)).update(rawBody).digest('hex')}`;
}

export function verifyWebhookSignature(rawBody, secret, received) {
  const expected = Buffer.from(webhookSignature(rawBody, secret));
  const actual = Buffer.from(String(received ?? ''));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
