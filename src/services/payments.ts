// src/services/payments.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as db from '../db';
import { User } from '../types';
import * as crypto from 'crypto';

const FLW_BASE = 'https://api.flutterwave.com/v3';

function headers() {
  return { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` };
}

export interface PlanDetails {
  amount: number;
  label: string;
  duration: number;
}

export const PLANS: Record<string, PlanDetails> = {
  monthly: {
    amount: parseInt(process.env.MONTHLY_PRICE_NGN || '800', 10),
    label: '₦800/month',
    duration: 30, // days
  },
  yearly: {
    amount: parseInt(process.env.YEARLY_PRICE_NGN || '7000', 10),
    label: '₦7,000/year (save ₦2,600)',
    duration: 365,
  },
};

export async function createPaymentLink(user: User, planType: string): Promise<{ link: string; txRef: string }> {
  const plan = PLANS[planType];
  if (!plan) throw new Error(`Invalid plan: ${planType}`);

  const txRef = `examace-${user.telegram_id}-${Date.now()}-${uuidv4().slice(0, 8)}`;

  // Save pending subscription to DB
  await db.query(
    `INSERT INTO subscriptions (user_id, plan, amount_ngn, flutterwave_tx_ref, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [user.id, planType, plan.amount, txRef]
  );

  const payload = {
    tx_ref: txRef,
    amount: plan.amount,
    currency: 'NGN',
    redirect_url: `${process.env.APP_URL}/payment/callback`,
    customer: {
      email: `${user.telegram_id}@examace.bot`,
      name: user.first_name || 'Student',
    },
    customizations: {
      title: 'ExamAce Premium',
      description: `${plan.label} — Unlimited exam prep`,
      logo: `${process.env.APP_URL}/logo.png`,
    },
    meta: {
      telegram_id: user.telegram_id,
      plan: planType,
      tx_ref: txRef,
    },
  };

  const res = await axios.post(`${FLW_BASE}/payments`, payload, { headers: headers() });

  if (res.data.status !== 'success') {
    throw new Error(`Flutterwave error: ${res.data.message}`);
  }

  return { link: res.data.data.link, txRef };
}

export async function verifyPayment(txRef: string): Promise<any> {
  const res = await axios.get(
    `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${txRef}`,
    { headers: headers() }
  );
  return res.data.data;
}

export async function activateSubscription(txRef: string): Promise<{ user: User; expiresAt: Date; planType: string }> {
  const txData = await verifyPayment(txRef);
  if (txData.status !== 'successful') {
    throw new Error(`Payment not successful: ${txData.status}`);
  }

  const telegramId = txData.meta?.telegram_id;
  const planType = txData.meta?.plan;
  const plan = PLANS[planType];
  if (!plan) throw new Error('Invalid plan in payment meta');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + plan.duration);

  // Update subscription record
  await db.query(
    `UPDATE subscriptions
     SET status = 'active', flutterwave_tx_id = $1, started_at = NOW(), expires_at = $2
     WHERE flutterwave_tx_ref = $3`,
    [txData.id, expiresAt.toISOString(), txRef]
  );

  // Update user plan
  const user = await db.updateUser(telegramId, {
    plan: 'premium',
    plan_expires_at: expiresAt.toISOString(),
  });

  return { user, expiresAt, planType };
}

// Verify Flutterwave webhook signature
export function verifyWebhook(signature: string | string[] | undefined, body: any): boolean {
  if (!signature) return false;
  const sigStr = Array.isArray(signature) ? signature[0] : signature;
  const hash = crypto
    .createHmac('sha256', process.env.FLUTTERWAVE_WEBHOOK_SECRET || '')
    .update(JSON.stringify(body))
    .digest('hex');
  return hash === sigStr;
}

export async function checkExpiredSubscriptions(): Promise<any[]> {
  // Called by cron — downgrades users whose subscriptions expired
  const { rows } = await db.query(
    `UPDATE users SET plan = 'free'
     WHERE plan = 'premium' AND plan_expires_at < NOW()
     RETURNING telegram_id, first_name`
  );
  return rows;
}
