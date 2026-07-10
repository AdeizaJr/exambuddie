// src/services/payments.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import { User } from '../types';
import * as crypto from 'crypto';
import { getPricing } from './pricing';

const PAYSTACK_BASE = 'https://api.paystack.co';

function headers() {
  return { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` };
}

export interface PlanDetails {
  amount: number;
  label: string;
  duration: number;
}

export function getPlans(): Record<string, PlanDetails> {
  const p = getPricing();
  return {
    monthly: {
      amount: p.monthly_ngn,
      label: `₦${p.monthly_ngn.toLocaleString()}/month`,
      duration: 30,
    },
    term: {
      amount: p.term_ngn,
      label: `₦${p.term_ngn.toLocaleString()} / 3 months (save ₦${(p.monthly_ngn * 3 - p.term_ngn).toLocaleString()})`,
      duration: 90,
    },
    yearly: {
      amount: p.yearly_ngn,
      label: `₦${p.yearly_ngn.toLocaleString()}/year (save ₦${(p.monthly_ngn * 12 - p.yearly_ngn).toLocaleString()})`,
      duration: 365,
    },
  };
}

// ── Paystack Plans (recurring billing) ───────────────────────────────────────
// One Paystack Plan per tier, created lazily and cached in `settings`. The plan
// code stays stable across price edits — syncPaystackPlanPrice() updates the
// amount on the existing plan instead of creating a new one.
const PAYSTACK_INTERVAL: Record<string, string> = {
  monthly: 'monthly',
  term: 'quarterly',
  yearly: 'annually',
};

async function getSetting(key: string): Promise<string | null> {
  const { rows } = await db.query('SELECT value FROM settings WHERE key = $1', [key]);
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
}

export async function getOrCreatePaystackPlan(planType: string): Promise<string> {
  const settingKey = `paystack_plan_code_${planType}`;
  const existing = await getSetting(settingKey);
  if (existing) return existing;

  const plan = getPlans()[planType];
  if (!plan) throw new Error(`Invalid plan: ${planType}`);

  const res = await axios.post(
    `${PAYSTACK_BASE}/plan`,
    {
      name: `ExamBuddie ${planType[0].toUpperCase()}${planType.slice(1)}`,
      amount: plan.amount * 100,
      interval: PAYSTACK_INTERVAL[planType],
      currency: 'NGN',
    },
    { headers: headers() }
  );
  if (!res.data.status) throw new Error(`Paystack plan creation error: ${res.data.message}`);

  const planCode = res.data.data.plan_code;
  await setSetting(settingKey, planCode);
  return planCode;
}

// Pushes a price change onto the live Paystack plan immediately, including
// currently-active subscribers (applies on their next billing cycle).
export async function syncPaystackPlanPrice(planType: string, amountNgn: number): Promise<void> {
  const planCode = await getSetting(`paystack_plan_code_${planType}`);
  if (!planCode) return; // no plan created yet — it'll be created with the current price on first subscribe

  await axios.put(
    `${PAYSTACK_BASE}/plan/${planCode}`,
    { amount: amountNgn * 100, update_existing_subscriptions: true },
    { headers: headers() }
  );
}

export async function createPaymentLink(
  user: User,
  planType: string
): Promise<{ link: string; txRef: string }> {
  const plan = getPlans()[planType];
  if (!plan) throw new Error(`Invalid plan: ${planType}`);

  const planCode = await getOrCreatePaystackPlan(planType);
  const txRef = `exambuddie-${user.telegram_id}-${Date.now()}-${uuidv4().slice(0, 8)}`;

  // Save pending subscription to DB
  await db.query(
    `INSERT INTO subscriptions (user_id, plan, amount_ngn, paystack_tx_ref, paystack_plan_code, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [user.id, planType, plan.amount, txRef, planCode]
  );

  const payload = {
    email: `${user.telegram_id}@exambuddie.bot`,
    amount: plan.amount * 100, // required even with `plan` set — Paystack rejects the request without it
    // Attaching `plan` auto-subscribes the customer on success, if their card supports recurring charges.
    plan: planCode,
    currency: 'NGN',
    reference: txRef,
    callback_url: `${process.env.APP_URL}/payment/callback`,
    metadata: {
      telegram_id: user.telegram_id,
      plan: planType,
      tx_ref: txRef,
      custom_fields: [
        { display_name: 'Plan', variable_name: 'plan', value: plan.label },
      ],
    },
  };

  const res = await axios.post(`${PAYSTACK_BASE}/transaction/initialize`, payload, {
    headers: headers(),
  });

  if (!res.data.status) {
    throw new Error(`Paystack error: ${res.data.message}`);
  }

  return { link: res.data.data.authorization_url, txRef };
}

export async function verifyPayment(txRef: string): Promise<any> {
  const res = await axios.get(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: headers(),
  });
  return res.data.data;
}

export async function activateSubscription(
  txRef: string
): Promise<{ user: User; expiresAt: Date; planType: string }> {
  const txData = await verifyPayment(txRef);
  if (txData.status !== 'success') {
    throw new Error(`Payment not successful: ${txData.status}`);
  }

  const telegramId = txData.metadata?.telegram_id;
  const planType = txData.metadata?.plan;
  const plan = getPlans()[planType];
  if (!plan) throw new Error('Invalid plan in payment metadata');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + plan.duration);

  // customer_code is only present once Paystack has processed the charge — needed to
  // match future renewal charges (which arrive with no telegram_id/plan metadata) back to this user
  const customerCode = txData.customer?.customer_code ?? null;

  // Update subscription record. This can be called twice for the same tx_ref — the
  // browser redirect (/payment/callback) and the charge.success webhook both call
  // activateSubscription, and typically land within moments of each other. The
  // `AND status != 'active'` guard makes the second call a no-op instead of
  // re-extending expiry from "now" a second time for one payment.
  const { rowCount } = await db.query(
    `UPDATE subscriptions
     SET status = 'active', paystack_tx_id = $1, started_at = NOW(), expires_at = $2, paystack_customer_code = $3
     WHERE paystack_tx_ref = $4 AND status != 'active'`,
    [txData.id, expiresAt.toISOString(), customerCode, txRef]
  );

  if (!rowCount) {
    // Already activated by a concurrent/duplicate call — report the existing state
    // rather than extending expiry again.
    const existing = await db.getUser(telegramId);
    if (!existing) throw new Error('User not found during duplicate activation');
    return {
      user: existing,
      expiresAt: existing.plan_expires_at ? new Date(existing.plan_expires_at) : expiresAt,
      planType,
    };
  }

  // Update user plan
  const user = await db.updateUser(telegramId, {
    plan: 'premium',
    plan_expires_at: expiresAt.toISOString(),
  });

  return { user, expiresAt, planType };
}

// Handles a `subscription.create` webhook — links the subscription_code/email_token
// Paystack generated back onto the subscription row created by the original charge.
export async function handleSubscriptionCreate(data: any): Promise<void> {
  const customerCode = data.customer?.customer_code;
  const planCode = data.plan?.plan_code;
  const subscriptionCode = data.subscription_code;
  const emailToken = data.email_token;
  if (!customerCode || !planCode || !subscriptionCode) return;

  // Precise match: most_recent_invoice.transaction is the same internal Paystack
  // transaction id we stored as paystack_tx_id in activateSubscription(). This avoids
  // mis-linking when a customer has more than one row for the same customer+plan
  // (e.g. they tried subscribing more than once).
  const txId = data.most_recent_invoice?.transaction;
  if (txId) {
    const { rowCount } = await db.query(
      `UPDATE subscriptions SET paystack_subscription_code = $1, email_token = $2, is_recurring = TRUE
       WHERE paystack_tx_id = $3`,
      [subscriptionCode, emailToken, String(txId)]
    );
    if (rowCount && rowCount > 0) return;
  }

  // Fallback (if most_recent_invoice is ever absent from the webhook payload):
  // oldest unlinked row for this customer+plan — the first successful charge is
  // what actually creates the subscription, so it's the better guess than newest.
  await db.query(
    `UPDATE subscriptions SET paystack_subscription_code = $1, email_token = $2, is_recurring = TRUE
     WHERE id = (
       SELECT id FROM subscriptions
       WHERE paystack_customer_code = $3 AND paystack_plan_code = $4 AND paystack_subscription_code IS NULL
       ORDER BY started_at ASC LIMIT 1
     )`,
    [subscriptionCode, emailToken, customerCode, planCode]
  );
}

// Handles a recurring `charge.success` webhook — i.e. a charge Paystack initiated
// itself on a subscription's billing cycle, not one we triggered via createPaymentLink().
// Identified by the caller (no matching pending tx_ref for this reference).
export async function handleRecurringCharge(
  data: any
): Promise<{ user: User; expiresAt: Date; planType: string } | null> {
  const customerCode = data.customer?.customer_code;
  const planCode = data.plan?.plan_code;
  if (!customerCode || !planCode) return null;

  const { rows } = await db.query(
    `SELECT s.plan, s.user_id, u.telegram_id
     FROM subscriptions s
     JOIN users u ON s.user_id = u.id
     WHERE s.paystack_customer_code = $1 AND s.paystack_plan_code = $2
     ORDER BY s.started_at DESC LIMIT 1`,
    [customerCode, planCode]
  );
  const match = rows[0];
  if (!match) return null; // unknown customer/plan combo — ignore rather than guess

  const planType = match.plan;
  const plan = getPlans()[planType];
  if (!plan) return null;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + plan.duration);
  const amountNgn = typeof data.amount === 'number' ? data.amount / 100 : plan.amount;

  // Log the renewal as its own row so revenue history stays accurate. Paystack's webhook
  // delivery is at-least-once, so this INSERT can be replayed for the same tx_ref — the
  // ON CONFLICT DO NOTHING de-dupes the row, but rowCount tells us whether this call is
  // the real renewal or a duplicate delivery; only the real one should reset expiry.
  const { rowCount } = await db.query(
    `INSERT INTO subscriptions
       (user_id, plan, amount_ngn, paystack_tx_ref, paystack_plan_code, paystack_customer_code, status, started_at, expires_at, is_recurring)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), $7, TRUE)
     ON CONFLICT (paystack_tx_ref) DO NOTHING`,
    [match.user_id, planType, amountNgn, data.reference, planCode, customerCode, expiresAt.toISOString()]
  );
  if (!rowCount) return null; // duplicate webhook delivery — already processed this tx_ref

  const user = await db.updateUser(match.telegram_id, {
    plan: 'premium',
    plan_expires_at: expiresAt.toISOString(),
  });

  return { user, expiresAt, planType };
}

// Handles `subscription.disable` / `subscription.not_renew` — just marks cancellation.
// Access is NOT revoked here; the existing plan_expires_at (and the hourly cron) still
// govern when the user actually loses Premium, same as a manual non-renewing purchase.
export async function handleSubscriptionCancelled(data: any): Promise<void> {
  const subscriptionCode = data.subscription_code;
  if (!subscriptionCode) return;
  await db.query(
    `UPDATE subscriptions SET cancelled_at = NOW() WHERE paystack_subscription_code = $1`,
    [subscriptionCode]
  );
}

export async function getActiveRecurringSubscription(
  userId: number
): Promise<{ subscriptionCode: string; plan: string } | null> {
  const { rows } = await db.query(
    `SELECT paystack_subscription_code, plan FROM subscriptions
     WHERE user_id = $1 AND is_recurring = TRUE AND cancelled_at IS NULL AND paystack_subscription_code IS NOT NULL
     ORDER BY started_at DESC LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  return row ? { subscriptionCode: row.paystack_subscription_code, plan: row.plan } : null;
}

export async function getManageLink(subscriptionCode: string): Promise<string> {
  const res = await axios.get(`${PAYSTACK_BASE}/subscription/${subscriptionCode}/manage/link`, {
    headers: headers(),
  });
  if (!res.data.status) throw new Error(`Paystack error: ${res.data.message}`);
  return res.data.data.link;
}

// Verify Paystack webhook signature (HMAC-SHA512 over raw body, signed with the secret key)
export function verifyWebhook(signature: string | string[] | undefined, rawBody: string | Buffer): boolean {
  if (!signature) return false;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  // Without this, an unset secret would compute the HMAC with an empty key — a value
  // anyone could reproduce — instead of failing closed.
  if (!secret) return false;
  const sigStr = Array.isArray(signature) ? signature[0] : signature;
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  // timingSafeEqual requires equal-length buffers; a length mismatch already means the
  // signatures differ, so short-circuit before it throws.
  const hashBuf = Buffer.from(hash, 'hex');
  const sigBuf = Buffer.from(sigStr, 'hex');
  return hashBuf.length === sigBuf.length && crypto.timingSafeEqual(hashBuf, sigBuf);
}

export async function checkExpiredSubscriptions(): Promise<any[]> {
  // Called by cron — downgrades users whose subscriptions expired
  const { rows } = await db.query(
    `UPDATE users SET plan = 'free'
     WHERE plan = 'premium' AND plan_expires_at < NOW()
     RETURNING telegram_id, first_name, notifications_enabled`
  );
  return rows;
}
