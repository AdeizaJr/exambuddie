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
