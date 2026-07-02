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

export async function createPaymentLink(
  user: User,
  planType: string
): Promise<{ link: string; txRef: string }> {
  const plan = getPlans()[planType];
  if (!plan) throw new Error(`Invalid plan: ${planType}`);

  const txRef = `exambuddie-${user.telegram_id}-${Date.now()}-${uuidv4().slice(0, 8)}`;

  // Save pending subscription to DB
  await db.query(
    `INSERT INTO subscriptions (user_id, plan, amount_ngn, paystack_tx_ref, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [user.id, planType, plan.amount, txRef]
  );

  const payload = {
    email: `${user.telegram_id}@exambuddie.bot`,
    amount: plan.amount * 100, // Paystack expects kobo, not naira
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

  // Update subscription record
  await db.query(
    `UPDATE subscriptions
     SET status = 'active', paystack_tx_id = $1, started_at = NOW(), expires_at = $2
     WHERE paystack_tx_ref = $3`,
    [txData.id, expiresAt.toISOString(), txRef]
  );

  // Update user plan
  const user = await db.updateUser(telegramId, {
    plan: 'premium',
    plan_expires_at: expiresAt.toISOString(),
  });

  return { user, expiresAt, planType };
}

// Verify Paystack webhook signature (HMAC-SHA512 over raw body, signed with the secret key)
export function verifyWebhook(signature: string | string[] | undefined, rawBody: string | Buffer): boolean {
  if (!signature) return false;
  const sigStr = Array.isArray(signature) ? signature[0] : signature;
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
    .update(rawBody)
    .digest('hex');
  return hash === sigStr;
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
