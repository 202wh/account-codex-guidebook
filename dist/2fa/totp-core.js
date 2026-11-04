const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SUPPORTED_ALGORITHMS = new Map([
  ['SHA1', 'SHA-1'],
  ['SHA256', 'SHA-256'],
  ['SHA512', 'SHA-512'],
]);

export function decodeBase32(value) {
  const clean = String(value || '')
    .trim()
    .replace(/^2fa\s*[:：]\s*/i, '')
    .toUpperCase()
    .replace(/[\s=-]+/g, '');

  if (!clean) throw new Error('请输入 2FA 密钥');
  if (clean.length < 8) throw new Error('2FA 密钥太短，请粘贴完整密钥');
  if (!/^[A-Z2-7]+$/.test(clean)) throw new Error('密钥不是有效的 Base32 格式');

  let buffer = 0;
  let bitCount = 0;
  const bytes = [];
  for (const char of clean) {
    buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(char);
    bitCount += 5;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((buffer >>> bitCount) & 0xff);
      buffer &= (1 << bitCount) - 1;
    }
  }

  if (!bytes.length) throw new Error('无法解析该 2FA 密钥');
  return { clean, bytes: new Uint8Array(bytes) };
}

export function parseOtpInput(rawValue, fallbackLabel = '') {
  let raw = String(rawValue || '').trim();
  if (!raw) throw new Error('请输入 2FA 密钥');

  let secret = raw;
  let algorithm = 'SHA1';
  let digits = 6;
  let period = 30;
  let label = String(fallbackLabel || '').trim();

  if (/^otpauth:\/\//i.test(raw)) {
    let url;
    try { url = new URL(raw); } catch { throw new Error('otpauth:// 地址格式不正确'); }
    if (url.protocol !== 'otpauth:' || url.hostname.toLowerCase() !== 'totp') {
      throw new Error('目前仅支持 otpauth://totp/ 地址');
    }
    secret = url.searchParams.get('secret') || '';
    algorithm = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase().replace(/[^A-Z0-9]/g, '');
    digits = Number(url.searchParams.get('digits') || 6);
    period = Number(url.searchParams.get('period') || 30);
    if (!label) {
      try { label = decodeURIComponent(url.pathname.replace(/^\//, '')); } catch { label = url.pathname.replace(/^\//, ''); }
    }
  }

  if (!SUPPORTED_ALGORITHMS.has(algorithm)) throw new Error(`不支持 ${algorithm} 算法`);
  if (![6, 8].includes(digits)) throw new Error('验证码位数仅支持 6 位或 8 位');
  if (!Number.isInteger(period) || period < 5 || period > 300) throw new Error('验证码周期必须在 5～300 秒之间');

  const decoded = decodeBase32(secret);
  return {
    secret: decoded.clean,
    secretBytes: decoded.bytes,
    algorithm,
    webCryptoAlgorithm: SUPPORTED_ALGORITHMS.get(algorithm),
    digits,
    period,
    label: label || '未命名账户',
  };
}

export function counterFor(timestampMs, period = 30) {
  return Math.floor(timestampMs / 1000 / period);
}

export function remainingFor(timestampMs, period = 30) {
  const elapsed = (timestampMs / 1000) % period;
  return Math.max(0, period - elapsed);
}

export async function generateTotp(config, timestampMs = Date.now()) {
  const counter = BigInt(counterFor(timestampMs, config.period));
  const message = new Uint8Array(8);
  let value = counter;
  for (let index = 7; index >= 0; index -= 1) {
    message[index] = Number(value & 255n);
    value >>= 8n;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    config.secretBytes,
    { name: 'HMAC', hash: config.webCryptoAlgorithm },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  );
  return String(binary % (10 ** config.digits)).padStart(config.digits, '0');
}
