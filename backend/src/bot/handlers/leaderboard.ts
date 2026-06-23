import * as db from '../../db';

const MEDALS = ['🥇', '🥈', '🥉'];

function rankLabel(rank: number): string {
  return MEDALS[rank - 1] ?? `${rank}.`;
}

function formatLeaderboard(
  entries: db.LeaderboardEntry[],
  callerTelegramId: number,
  callerRank: number | null,
  subject?: string
): string {
  const title = subject
    ? `🏆 <b>Weekly Leaderboard — ${subject.charAt(0).toUpperCase() + subject.slice(1)}</b>`
    : '🏆 <b>Weekly Leaderboard</b>';

  if (entries.length === 0) {
    return `${title}\n\nNo activity this week yet. Answer at least 5 questions to appear here!`;
  }

  const rows = entries.map((e) => {
    const you = e.telegram_id === callerTelegramId ? ' ← you' : '';
    return `${rankLabel(e.rank)} <b>${e.first_name}</b> — ${e.accuracy}% (${e.correct}/${e.total})${you}`;
  });

  const yourRankLine =
    callerRank === null
      ? '\n<i>Answer 5+ questions this week to rank up.</i>'
      : callerRank <= 10
      ? ''
      : `\nYour rank: <b>#${callerRank}</b>`;

  return `${title}\n\n${rows.join('\n')}${yourRankLine}\n\n<i>📅 Resets every Monday · min. 5 questions to qualify</i>`;
}

function formatLastWeek(entries: db.LeaderboardEntry[]): string {
  if (entries.length === 0) {
    return '📜 <b>Last Week\'s Leaderboard</b>\n\nNo snapshot available yet.';
  }
  const rows = entries.map(e =>
    `${rankLabel(e.rank)} <b>${e.first_name}</b> — ${e.accuracy}% (${e.correct}/${e.total})`
  );
  return `📜 <b>Last Week\'s Leaderboard</b>\n\n${rows.join('\n')}`;
}

export async function handleLeaderboard(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) {
    await ctx.reply('Start the bot first with /start.');
    return;
  }

  const [entries, rank] = await Promise.all([
    db.getLeaderboard(),
    db.getLeaderboardRank(ctx.from.id),
  ]);

  await ctx.reply(formatLeaderboard(entries, ctx.from.id, rank), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📜 Last Week', callback_data: 'leaderboard:lastweek' },
          { text: '📊 My Stats', callback_data: 'stats:show' },
        ],
        [
          { text: '📚 Practice', callback_data: 'practice:pick' },
        ],
      ],
    },
  });
}

export async function handleLastWeekLeaderboard(ctx: any): Promise<void> {
  const entries = await db.getLastWeekSnapshot();
  await ctx.editMessageText(formatLastWeek(entries), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏆 This Week', callback_data: 'leaderboard:current' },
          { text: '📊 My Stats', callback_data: 'stats:show' },
        ],
      ],
    },
  });
}

export async function handleCurrentLeaderboard(ctx: any): Promise<void> {
  const [entries, rank] = await Promise.all([
    db.getLeaderboard(),
    db.getLeaderboardRank(ctx.from.id),
  ]);
  await ctx.editMessageText(formatLeaderboard(entries, ctx.from.id, rank), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📜 Last Week', callback_data: 'leaderboard:lastweek' },
          { text: '📊 My Stats', callback_data: 'stats:show' },
        ],
        [
          { text: '📚 Practice', callback_data: 'practice:pick' },
        ],
      ],
    },
  });
}
