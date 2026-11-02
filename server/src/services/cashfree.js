import { PaymentGateway } from '../models/index.js';
import { decrypt } from '../utils/crypto.js';
import { ApiError } from '../utils/ApiError.js';

export const CASHFREE_API_VERSION = '2023-08-01';
const BASE = { sandbox: 'https://sandbox.cashfree.com/pg', production: 'https://api.cashfree.com/pg' };

/** Active Cashfree credentials, managed by Super Admin (secrets encrypted at rest). */
export async function getCashfreeConfig({ requireEnabled = true } = {}) {
  const gw = await PaymentGateway.findOne({ provider: 'cashfree' }).lean();
  if (!gw || (requireEnabled && !gw.enabled)) throw new ApiError(503, 'Online payments are not enabled yet. Please contact support.', 'GATEWAY_DISABLED');
  const creds = gw[gw.mode] || {};
  if (!creds.appId || !creds.secretKeyEnc) throw new ApiError(503, `Cashfree ${gw.mode} credentials are not configured.`, 'GATEWAY_NOT_CONFIGURED');
  return { mode: gw.mode, appId: creds.appId, secretKey: decrypt(creds.secretKeyEnc), baseUrl: BASE[gw.mode] };
}

export async function cashfreeRequest(cfg, method, path, body) {
  const res = await fetch(cfg.baseUrl + path, {
    method,
    headers: {
      'x-client-id': cfg.appId, 'x-client-secret': cfg.secretKey, 'x-api-version': CASHFREE_API_VERSION,
      'Content-Type': 'application/json', Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(res.status >= 500 ? 502 : 400, data?.message || `Cashfree error (${res.status})`, 'GATEWAY_ERROR', { cashfree: data?.code, status: res.status });
    err.gatewayStatus = res.status;
    throw err;
  }
  return data;
}

export const createOrder = (cfg, order) => cashfreeRequest(cfg, 'POST', '/orders', order);
export const fetchOrder = (cfg, orderId) => cashfreeRequest(cfg, 'GET', `/orders/${encodeURIComponent(orderId)}`);
export const fetchOrderPayments = (cfg, orderId) => cashfreeRequest(cfg, 'GET', `/orders/${encodeURIComponent(orderId)}/payments`);
export const createRefund = (cfg, orderId, refund) => cashfreeRequest(cfg, 'POST', `/orders/${encodeURIComponent(orderId)}/refunds`, refund);

export { verifyWebhookSignature } from '../utils/webhookSignature.js';

/** Validates credentials without moving money: fetching a non-existent order returns 404 when auth is OK. */
export async function testCredentials(cfg) {
  try {
    await fetchOrder(cfg, `gosoft_connection_test_${Date.now()}`);
    return { ok: true };
  } catch (e) {
    if (e.gatewayStatus === 404) return { ok: true };
    if (e.gatewayStatus === 401 || e.gatewayStatus === 403) return { ok: false, message: 'Cashfree rejected these credentials (authentication failed).' };
    return { ok: false, message: e.message };
  }
}
