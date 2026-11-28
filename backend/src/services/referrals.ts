import * as db from '../db';
import * as redis from './redis';
import * as outreach from './outreach';
import * as fmt from '../bot/formatter';

// Invitees whose practice is already reflected in their inviter's ledger, so their later
// answers skip the DB check. Process-local and reset on deploy, which is harmless: the
// check is idempotent and the first answer after a restart just re-confirms nothing is owed.
const settled = new Set<number>();

// Call after an answer has been saved (the attempt row must be committed, or the
// invitee isn't counted yet). Pays the inviter any Premium days now owed and tells them.
// Never throws: a referral hiccup must not break answering a question.
export async function rewardReferrer(
  user: { id: number; referred_by?: number | null },
  telegram: { sendMessage: (...args: any[]) => Promise<unknown> }
): Promise<void> {
  if (!user.referred_by || settled.has(user.id)) return;
  try {
    const result = await db.creditReferrer(user.id);
    settled.add(user.id);
    if (!result) return;

    const { referrer, daysAdded, confirmed } = result;
    await redis.clearCachedUser(referrer.telegram_id).catch(() => {});
    await flagFastReferrer(referrer, daysAdded);
    if (referrer.blocked_at) return;
    try {
      await telegram.sendMessage(
        referrer.telegram_id,
        fmt.referralRewardMessage(referrer.first_name, daysAdded, confirmed, referrer.plan_expires_at),
        { parse_mode: 'HTML', reply_markup: fmt.inviteLinkKeyboard() }
      );
    } catch (err) {
      await outreach.noteSendFailure(referrer.telegram_id, err);
    }
  } catch (err: any) {
    console.error('[referrals] credit failed:', err.message);
  }
}

// Referral days have no cap, so a burst of practising invitees in one week is the sign
// of fake accounts being farmed for Premium. Raises an admin alert each time an inviter
// crosses another multiple of REFERRAL_ALERT_WEEKLY in the last 7 days. Never throws.
export const REFERRAL_ALERT_WEEKLY = 10;

async function flagFastReferrer(
  referrer: { id: number; telegram_id: number; first_name: string },
  daysAdded: number
): Promise<void> {
  try {
    const weekly = await db.getRecentConfirmedReferralCount(referrer.id);
    const before = Math.max(0, weekly - daysAdded);
    if (Math.floor(weekly / REFERRAL_ALERT_WEEKLY) <= Math.floor(before / REFERRAL_ALERT_WEEKLY)) return;
    await db.createAlert(
      'referrals',
      `${referrer.first_name} (telegram_id ${referrer.telegram_id}) has ${weekly} invitees who joined and practised in the last 7 days. Check for fake accounts before more Premium days stack up.`,
      'warning'
    );
  } catch (err: any) {
    console.error('[referrals] fast-referrer check failed:', err.message);
  }
}
