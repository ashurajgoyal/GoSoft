import crypto from 'node:crypto';

/** Cashfree webhook signature: base64(HMAC_SHA256(timestamp + rawBody, secretKey)). */
export function verifyWebhookSignature(rawBody, timestamp, signature, secretKey) {
  if (!rawBody || !timestamp || !signature || !secretKey) return false;
  const expected = crypto.createHmac('sha256', secretKey).update(String(timestamp) + rawBody.toString('utf8')).digest('base64');
  const a = Buffer.from(expected); const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

