// src/bot/handlers/challenge.ts
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';

const BOT_USERNAME = process.env.BOT_USERNAME || 'ExamBuddieBot';
const LOBBY_SECS = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────

function inviteLink(code: string) {
  return `https://t.me/${BOT_USERNAME}?start=room_${code}`;
}

function shareUrl(code: string) {
  const link = inviteLink(code);
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Join my ExamBuddie challenge! Room code: ${code}`)}`;
}

function formatLobby(room: db.PracticeRoom, participants: db.RoomParticipant[], secsLeft: number): string {
  const sub = fmt.SUBJECT_MAP[room.subject] || room.subject;
  const yr = room.year ? `${room.year}` : 'Any Year';
  const mins = Math.floor(room.time_limit_secs / 60);
  const readyCount = participants.filter(p => p.ready).length;
  const playerList = participants
    .map(p => `${p.ready ? '✅' : '⏳'} ${fmt.escHtml(p.first_name)}${p.telegram_id === room.creator_telegram_id ? ' 👑' : ''}`)
    .join('\n');
  const countdownStr = secsLeft > 0
    ? `⏳ <b>${secsLeft}s</b> lobby countdown — auto-starts when all ${room.max_players} players are ready`
    : `🚀 Starting now…`;

  return (
    `🎯 <b>Challenge Room</b> <code>${room.code}</code>\n\n` +
    `📚 ${sub} · ${yr} · ${room.exam_type}\n` +
    `❓ ${room.num_questions} questions · ⏱ ${mins} min\n\n` +
    `<b>Players (${readyCount}/${room.max_players} ready):</b>\n${playerList}\n\n` +
    `🔗 Invite link:\n<code>${inviteLink(room.code)}</code>\n\n` +
    `${countdownStr}`
  );
}

function whatsappUrl(code: string) {
  const text = `Join my ExamBuddie Challenge! Room code: *${code}*\n${inviteLink(code)}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function lobbyKeyboard(code: string, isReady: boolean, isCreator: boolean) {
  const rows: { text: string; callback_data?: string; url?: string }[][] = [];
  rows.push([{ text: isReady ? '✅ Ready!' : '✅ Mark Ready', callback_data: `challenge:ready:${code}` }]);
  rows.push([
    { text: '📤 Telegram', url: shareUrl(code) },
    { text: '💬 WhatsApp', url: whatsappUrl(code) },
  ]);
  rows.push([{ text: '📋 Copy Link', callback_data: `challenge:copylink:${code}` }]);
  if (isCreator) {
    rows.push([{ text: '⚡ Start Now', callback_data: `challenge:start_now:${code}` }]);
  }
  rows.push([{ text: '❌ Leave Room', callback_data: `challenge:leave:${code}` }]);
  return { inline_keyboard: rows };
}

function challengeSubjectKeyboard(subjects: string[]) {
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < subjects.length; i += 2) {
    rows.push(
      subjects.slice(i, i + 2).map(s => ({
        text: fmt.SUBJECT_MAP[s] || s,
        callback_data: `challenge:subject:${s}`,
      }))
    );
  }
  rows.push([{ text: '❌ Cancel', callback_data: 'menu:main' }]);
  return { inline_keyboard: rows };
}

// ── Creation flow ─────────────────────────────────────────────────────────────

export async function handleChallenge(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  const isPremium = user?.plan === 'premium';
  await ctx.reply('🎯 <b>Challenge Mode</b>\n\nCreate a room or challenge a specific friend:', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: isPremium ? '➕ Create Challenge' : '💎 Create Challenge (Premium)', callback_data: 'challenge:create' }],
        [{ text: '⚔️ Duel a Friend', callback_data: 'challenge:duel' }],
        [{ text: '🔍 Join with Code', callback_data: 'challenge:search' }],
        [{ text: '❌ Cancel', callback_data: 'menu:main' }],
      ],
    },
  });
}

export async function handleChallengeCreate(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  if (user.plan !== 'premium') {
    await ctx.reply(
      '💎 <b>Premium Required</b>\n\nCreating a challenge room is a Premium feature.\n\nYou can still <b>join</b> any challenge room shared with you — but to host your own, upgrade to Premium.\n\n👇 Tap /subscribe to unlock.',
      { parse_mode: 'HTML' }
    );
    return;
  }

  await redis.setSession(ctx.from.id, { step: 'challenge_subject', examType: user.exam_type || 'WAEC' });
  await ctx.editMessageText('🎯 <b>Challenge Mode</b>\n\nPick a subject for the challenge:', {
    parse_mode: 'HTML',
    reply_markup: challengeSubjectKeyboard(Object.keys(fmt.SUBJECT_MAP)),
  });
}

export async function handleChallengeSearch(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await redis.setSession(ctx.from.id, { step: 'challenge_enter_code' });
  await ctx.reply('🔍 <b>Join a Challenge</b>\n\nType the 6-character room code shared with you:', {
    parse_mode: 'HTML',
    reply_markup: { force_reply: true, selective: true },
  });
}

// Called from free-text handler when step === 'challenge_enter_code'
export async function handleChallengeCodeInput(ctx: any): Promise<void> {
  const code = ctx.message?.text?.trim().toUpperCase();
  if (!code || code.length !== 6) {
    await ctx.reply('❌ Invalid code. Room codes are 6 characters. Try again or tap /start to go back.');
    return;
  }

  const room = await db.getRoom(code);
  if (!room) { await ctx.reply('❌ Room not found. Check the code and try again.'); return; }
  if (room.status === 'ended') { await ctx.reply('❌ This challenge has already ended.'); return; }
  if (room.status === 'active') { await ctx.reply('❌ This challenge has already started.'); return; }

  const user = await db.getUser(ctx.from.id);
  if (!user?.exam_type) { await ctx.reply('Please set up your profile first using /start.'); return; }

  const participants = await db.getRoomParticipants(room.id);
  const alreadyIn = participants.some(p => p.telegram_id === ctx.from.id);

  await db.joinRoom(room.id, ctx.from.id, user.first_name);
  await redis.clearSession(ctx.from.id);
  await redis.setSession(ctx.from.id, { step: 'challenge_lobby', roomCode: code });

  const updated = await db.getRoomParticipants(room.id);

  if (!alreadyIn) {
    for (const p of updated) {
      if (p.telegram_id !== ctx.from.id) {
        await ctx.telegram
          .sendMessage(
            p.telegram_id,
            `👤 <b>${fmt.escHtml(user.first_name)}</b> joined the room! (${updated.filter(x => x.ready).length}/${room.max_players} ready)`,
            { parse_mode: 'HTML' }
          )
          .catch(() => {});
      }
    }
  }

  const lobbyExpiresAt = new Date(room.created_at).getTime() + LOBBY_SECS * 1000;
  const secsLeft = Math.max(0, Math.floor((lobbyExpiresAt - Date.now()) / 1000));

  await ctx.reply(formatLobby(room, updated, secsLeft), {
    parse_mode: 'HTML',
    reply_markup: lobbyKeyboard(code, false, false),
    disable_web_page_preview: true,
  });
}

export async function handleChallengeSubject(ctx: any): Promise<void> {
  const subject = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery();

  await redis.updateSession(ctx.from.id, { step: 'challenge_examtype', subject });
  const sub = fmt.SUBJECT_MAP[subject] || subject;

  await ctx.editMessageText(
    `🎯 <b>Challenge Mode</b>\n\nSubject: <b>${sub}</b>\n\nPick exam type:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'WAEC', callback_data: 'challenge:examtype:WAEC' },
            { text: 'JAMB', callback_data: 'challenge:examtype:JAMB' },
            { text: 'NECO', callback_data: 'challenge:examtype:NECO' },
          ],
          [{ text: '❌ Cancel', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleChallengeExamType(ctx: any): Promise<void> {
  const examType = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery();

  await redis.updateSession(ctx.from.id, { step: 'challenge_year', examType });
  const session = await redis.getSession(ctx.from.id);
  const sub = fmt.SUBJECT_MAP[session.subject] || session.subject;

  const years: number[] = [];
  const now = new Date().getFullYear();
  for (let y = now - 1; y >= 2005; y--) years.push(y);

  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < Math.min(years.length, 18); i += 3) {
    rows.push(years.slice(i, i + 3).map(y => ({ text: `${y}`, callback_data: `challenge:year:${y}` })));
  }
  rows.push([{ text: '🔀 Any Year', callback_data: 'challenge:year:any' }]);
  rows.push([{ text: '❌ Cancel', callback_data: 'menu:main' }]);

  await ctx.editMessageText(
    `🎯 <b>Challenge Mode</b>\n\nSubject: <b>${sub}</b> · Exam: <b>${examType}</b>\n\nPick a year:`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }
  );
}

export async function handleChallengeYear(ctx: any): Promise<void> {
  const raw = ctx.callbackQuery.data.split(':')[2];
  const year = raw === 'any' ? null : parseInt(raw, 10);
  await ctx.answerCbQuery();

  await redis.updateSession(ctx.from.id, { step: 'challenge_count', year });
  const session = await redis.getSession(ctx.from.id);
  const sub = fmt.SUBJECT_MAP[session.subject] || session.subject;
  const yr = year ? `${year}` : 'Any Year';

  await ctx.editMessageText(
    `🎯 <b>Challenge Mode</b>\n\nSubject: <b>${sub}</b> · Exam: <b>${session.examType}</b> · Year: <b>${yr}</b>\n\nHow many questions?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '10', callback_data: 'challenge:count:10' },
            { text: '20', callback_data: 'challenge:count:20' },
            { text: '30', callback_data: 'challenge:count:30' },
          ],
          [
            { text: '40', callback_data: 'challenge:count:40' },
            { text: '50', callback_data: 'challenge:count:50' },
            { text: '60', callback_data: 'challenge:count:60' },
          ],
          [{ text: '❌ Cancel', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleChallengeCount(ctx: any): Promise<void> {
  const count = parseInt(ctx.callbackQuery.data.split(':')[2], 10);
  await ctx.answerCbQuery();

  await redis.updateSession(ctx.from.id, { step: 'challenge_timer', numQuestions: count });
  const session = await redis.getSession(ctx.from.id);
  const sub = fmt.SUBJECT_MAP[session.subject] || session.subject;
  const yr = session.year ? `${session.year}` : 'Any Year';

  await ctx.editMessageText(
    `🎯 <b>Challenge Mode</b>\n\nSubject: <b>${sub}</b> · Exam: <b>${session.examType}</b> · Year: <b>${yr}</b> · Questions: <b>${count}</b>\n\nSet overall time limit:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '10 min', callback_data: 'challenge:timer:600' },
            { text: '15 min', callback_data: 'challenge:timer:900' },
            { text: '20 min', callback_data: 'challenge:timer:1200' },
          ],
          [
            { text: '30 min', callback_data: 'challenge:timer:1800' },
            { text: '45 min', callback_data: 'challenge:timer:2700' },
            { text: '60 min', callback_data: 'challenge:timer:3600' },
          ],
          [{ text: '❌ Cancel', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

async function createAndNotifyDuel(ctx: any, session: any, expected: number): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  let room: db.PracticeRoom;
  try {
    room = await db.createRoom({
      creatorTelegramId: ctx.from.id,
      subject: session.subject,
      examType: session.examType || user.exam_type || 'WAEC',
      year: session.year || null,
      numQuestions: session.numQuestions,
      timeLimitSecs: session.timeLimitSecs,
      expectedPlayers: expected,
    });
  } catch (e: any) {
    await ctx.reply(`❌ ${e.message}`);
    return;
  }

  await db.joinRoom(room.id, ctx.from.id, user.first_name);
  await db.setParticipantReady(room.id, ctx.from.id);
  await redis.clearSession(ctx.from.id);
  await redis.setSession(ctx.from.id, { step: 'challenge_lobby', roomCode: room.code });

  const participants = await db.getRoomParticipants(room.id);
  await ctx.reply(formatLobby(room, participants, LOBBY_SECS), {
    parse_mode: 'HTML',
    reply_markup: lobbyKeyboard(room.code, true, true),
    disable_web_page_preview: true,
  });

  if (session.duelOpponentId) {
    const sub = fmt.SUBJECT_MAP[room.subject] || room.subject;
    ctx.telegram.sendMessage(
      session.duelOpponentId,
      `⚔️ <b>${fmt.escHtml(user.first_name)} challenged you to a duel!</b>\n\n📚 ${sub} · ${room.num_questions} questions\n\nTap below to accept:`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⚔️ Accept Duel', url: inviteLink(room.code) }]] },
      }
    ).catch(() => {});
  }

  scheduleAutoStart(ctx.telegram, room);
}

export async function handleChallengeTimer(ctx: any): Promise<void> {
  const timeSecs = parseInt(ctx.callbackQuery.data.split(':')[2], 10);
  await ctx.answerCbQuery();

  await redis.updateSession(ctx.from.id, { step: 'challenge_expected', timeLimitSecs: timeSecs });
  const session = await redis.getSession(ctx.from.id);

  // Duel mode: skip expected-players picker, auto-create with 2 players
  if (session?.duelOpponentId) {
    await createAndNotifyDuel(ctx, session, 2);
    return;
  }
  const sub = fmt.SUBJECT_MAP[session.subject] || session.subject;
  const yr = session.year ? `${session.year}` : 'Any Year';
  const mins = Math.floor(timeSecs / 60);

  await ctx.editMessageText(
    `🎯 <b>Challenge Mode</b>\n\nSubject: <b>${sub}</b> · Exam: <b>${session.examType}</b> · Year: <b>${yr}</b> · Questions: <b>${session.numQuestions}</b> · Time: <b>${mins} min</b>\n\nHow many players are you expecting?\n\n<i>Challenge auto-starts when all expected players tap Ready, or after 60s lobby countdown.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '2', callback_data: 'challenge:expected:2' },
            { text: '3', callback_data: 'challenge:expected:3' },
            { text: '4', callback_data: 'challenge:expected:4' },
            { text: '5', callback_data: 'challenge:expected:5' },
          ],
          [
            { text: '6', callback_data: 'challenge:expected:6' },
            { text: '7', callback_data: 'challenge:expected:7' },
            { text: '8', callback_data: 'challenge:expected:8' },
            { text: '10', callback_data: 'challenge:expected:10' },
          ],
          [
            { text: '15', callback_data: 'challenge:expected:15' },
            { text: '20', callback_data: 'challenge:expected:20' },
            { text: '30', callback_data: 'challenge:expected:30' },
            { text: '50', callback_data: 'challenge:expected:50' },
          ],
          [{ text: '❌ Cancel', callback_data: 'menu:main' }],
        ],
      },
    }
  );
}

export async function handleChallengeExpected(ctx: any): Promise<void> {
  const expected = parseInt(ctx.callbackQuery.data.split(':')[2], 10);
  await ctx.answerCbQuery();

  const session = await redis.getSession(ctx.from.id);
  const user = await db.getUser(ctx.from.id);
  if (!user || !session) return;

  let room: db.PracticeRoom;
  try {
    room = await db.createRoom({
      creatorTelegramId: ctx.from.id,
      subject: session.subject,
      examType: session.examType || user.exam_type || 'WAEC',
      year: session.year || null,
      numQuestions: session.numQuestions,
      timeLimitSecs: session.timeLimitSecs,
      expectedPlayers: expected,
    });
  } catch (e: any) {
    await ctx.editMessageText(`❌ ${e.message}. Try fewer questions or a different year.`);
    return;
  }

  // Auto-join and auto-ready the creator
  await db.joinRoom(room.id, ctx.from.id, user.first_name);
  await db.setParticipantReady(room.id, ctx.from.id);

  await redis.clearSession(ctx.from.id);
  await redis.setSession(ctx.from.id, { step: 'challenge_lobby', roomCode: room.code });

  const participants = await db.getRoomParticipants(room.id);
  await ctx.editMessageText(formatLobby(room, participants, LOBBY_SECS), {
    parse_mode: 'HTML',
    reply_markup: lobbyKeyboard(room.code, true, true),
    disable_web_page_preview: true,
  });

  scheduleAutoStart(ctx.telegram, room);
}

// ── Auto-start timer ──────────────────────────────────────────────────────────

function scheduleAutoStart(telegram: any, room: db.PracticeRoom): void {
  setTimeout(async () => {
    try {
      const fresh = await db.getRoomById(room.id);
      if (!fresh || fresh.status !== 'waiting') return; // already started or ended
      const participants = await db.getRoomParticipants(fresh.id);
      if (participants.length === 0) { await db.endRoom(fresh.id); return; }
      await startChallenge(telegram, fresh, participants);
    } catch (e) {
      console.error('[challenge] auto-start error:', e);
    }
  }, LOBBY_SECS * 1000);
}

// ── Join via deep link ────────────────────────────────────────────────────────

export async function handleChallengeJoin(ctx: any, code: string): Promise<void> {
  const firstName = ctx.from.first_name || ctx.from.username || 'Player';

  const room = await db.getRoom(code);
  if (!room) { await ctx.reply('❌ Room not found. Check the code and try again.'); return; }
  if (room.status === 'ended') { await ctx.reply('❌ This challenge has already ended.'); return; }
  if (room.status === 'active') { await ctx.reply('❌ This challenge has already started.'); return; }

  const participants = await db.getRoomParticipants(room.id);
  const alreadyIn = participants.some(p => p.telegram_id === ctx.from.id);

  await db.joinRoom(room.id, ctx.from.id, firstName);
  await redis.clearSession(ctx.from.id);
  await redis.setSession(ctx.from.id, { step: 'challenge_lobby', roomCode: code });

  const updated = await db.getRoomParticipants(room.id);

  if (!alreadyIn) {
    for (const p of updated) {
      if (p.telegram_id !== ctx.from.id) {
        await ctx.telegram
          .sendMessage(
            p.telegram_id,
            `👤 <b>${fmt.escHtml(firstName)}</b> joined the room! (${updated.filter(x => x.ready).length}/${room.max_players} ready)`,
            { parse_mode: 'HTML' }
          )
          .catch(() => {});
      }
    }
  }

  const lobbyExpiresAt = new Date(room.created_at).getTime() + LOBBY_SECS * 1000;
  const secsLeft = Math.max(0, Math.floor((lobbyExpiresAt - Date.now()) / 1000));

  await ctx.reply(formatLobby(room, updated, secsLeft), {
    parse_mode: 'HTML',
    reply_markup: lobbyKeyboard(code, false, false),
    disable_web_page_preview: true,
  });
}

// ── Lobby: Ready ──────────────────────────────────────────────────────────────

export async function handleChallengeReady(ctx: any): Promise<void> {
  const code = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery('✅ You\'re ready!');

  const room = await db.getRoom(code);
  if (!room || room.status !== 'waiting') return;

  await db.setParticipantReady(room.id, ctx.from.id);
  const participants = await db.getRoomParticipants(room.id);

  const lobbyExpiresAt = new Date(room.created_at).getTime() + LOBBY_SECS * 1000;
  const secsLeft = Math.max(0, Math.floor((lobbyExpiresAt - Date.now()) / 1000));
  const isCreator = ctx.from.id === room.creator_telegram_id;

  await ctx.editMessageText(formatLobby(room, participants, secsLeft), {
    parse_mode: 'HTML',
    reply_markup: lobbyKeyboard(code, true, isCreator),
    disable_web_page_preview: true,
  });

  for (const p of participants) {
    if (p.telegram_id !== ctx.from.id) {
      await ctx.telegram
        .sendMessage(p.telegram_id, `✅ <b>${fmt.escHtml(ctx.from.first_name)}</b> is ready!`, { parse_mode: 'HTML' })
        .catch(() => {});
    }
  }

  // Auto-start if all expected players are ready
  const readyCount = participants.filter(p => p.ready).length;
  if (readyCount >= room.max_players) {
    await startChallenge(ctx.telegram, room, participants);
  }
}

// ── Lobby: Start Now (creator) ────────────────────────────────────────────────

export async function handleChallengeStartNow(ctx: any): Promise<void> {
  const code = ctx.callbackQuery.data.split(':')[2];

  const room = await db.getRoom(code);
  if (!room || room.status !== 'waiting') {
    await ctx.answerCbQuery('Room already started or ended.', { show_alert: true });
    return;
  }
  if (ctx.from.id !== room.creator_telegram_id) {
    await ctx.answerCbQuery('Only the creator can start early.', { show_alert: true });
    return;
  }

  await ctx.answerCbQuery('⚡ Starting now!');
  const participants = await db.getRoomParticipants(room.id);
  await startChallenge(ctx.telegram, room, participants);
}

// ── Lobby: Leave ─────────────────────────────────────────────────────────────

export async function handleChallengeCopyLink(ctx: any): Promise<void> {
  const code = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery('Link copied below 👇');
  await ctx.reply(
    `🔗 <b>Challenge Invite Link</b>\n\nRoom code: <code>${code}</code>\n\n<code>${inviteLink(code)}</code>\n\n<i>Tap the link above to copy, then share anywhere.</i>`,
    { parse_mode: 'HTML' }
  );
}

export async function handleChallengeLeave(ctx: any): Promise<void> {
  const code = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery();

  const room = await db.getRoom(code);
  if (!room) return;

  await db.query('DELETE FROM room_participants WHERE room_id = $1 AND telegram_id = $2', [room.id, ctx.from.id]);
  await redis.clearSession(ctx.from.id);
  await ctx.editMessageText('👋 You left the room.');
  await ctx.reply('Use the menu below to get started 👇', { reply_markup: fmt.persistentMenuKeyboard() });

  if (ctx.from.id === room.creator_telegram_id) {
    if (!(await db.endRoom(room.id))) return; // already ended by a concurrent process
    const remaining = await db.getRoomParticipants(room.id);
    for (const p of remaining) {
      await ctx.telegram.sendMessage(p.telegram_id, '❌ The room creator left. Challenge cancelled.').catch(() => {});
      await ctx.telegram.sendMessage(p.telegram_id, 'Use the menu below to continue 👇', {
        reply_markup: fmt.persistentMenuKeyboard(),
      }).catch(() => {});
    }
  } else {
    const remaining = await db.getRoomParticipants(room.id);
    for (const p of remaining) {
      await ctx.telegram
        .sendMessage(
          p.telegram_id,
          `👤 <b>${fmt.escHtml(ctx.from.first_name)}</b> left the room. (${remaining.filter(p => p.ready).length}/${room.max_players} ready)`,
          { parse_mode: 'HTML' }
        )
        .catch(() => {});
    }
  }
}

// ── Start challenge ───────────────────────────────────────────────────────────

async function startChallenge(telegram: any, room: db.PracticeRoom, participants: db.RoomParticipant[]): Promise<void> {
  // If two overlapping cron ticks (or the cron and a manual "all ready" trigger) both
  // pick up the same lobby-expired room, only the one whose UPDATE actually matched
  // 'waiting' should send "Challenge starting!" to every participant.
  if (!(await db.startRoom(room.id))) return;
  const endTime = Date.now() + room.time_limit_secs * 1000;
  const mins = Math.floor(room.time_limit_secs / 60);

  for (const p of participants) {
    await redis.setSession(p.telegram_id, {
      mode: 'challenge',
      roomCode: room.code,
      roomId: room.id,
      questionIds: room.question_ids,
      currentQIdx: 0,
      endTime,
    });

    await telegram
      .sendMessage(
        p.telegram_id,
        `🚀 <b>Challenge starting!</b>\n\n${room.num_questions} questions · ⏱ ${mins} min countdown\n\nGood luck! 🍀`,
        { parse_mode: 'HTML' }
      )
      .catch(() => {});

    await sendChallengeQuestion(telegram, p.telegram_id, room, 0, endTime);
  }
}

async function sendChallengeQuestion(
  telegram: any,
  telegramId: number,
  room: db.PracticeRoom,
  qIdx: number,
  endTime: number
): Promise<void> {
  const question = await db.getQuestionById(room.question_ids[qIdx]);
  if (!question) return;

  const timeLeftSecs = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
  const timeStr = `⏱ ${Math.floor(timeLeftSecs / 60)}:${String(timeLeftSecs % 60).padStart(2, '0')} left`;
  const msgText =
    fmt.formatQuestion(question, qIdx + 1, room.num_questions, 'challenge') +
    fmt.answerOptions(question) +
    `\n\n${timeStr}`;
  const keyboard = fmt.answerKeyboard(!!question.option_e);

  const imageUrl = question.image_url?.startsWith('/')
    ? `${process.env.APP_URL || ''}${question.image_url}`
    : question.image_url;

  try {
    if (imageUrl) {
      await telegram.sendPhoto(telegramId, imageUrl, { caption: msgText, parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await telegram.sendMessage(telegramId, msgText, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  } catch {
    await telegram.sendMessage(telegramId, msgText, { parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {});
  }
}

// ── Answer ────────────────────────────────────────────────────────────────────

export async function handleChallengeAnswer(ctx: any): Promise<void> {
  const selected = ctx.callbackQuery.data.split(':')[1];
  const session = await redis.getSession(ctx.from.id);
  if (!session || session.mode !== 'challenge') return;

  await ctx.answerCbQuery();

  if (Date.now() > session.endTime) {
    await finishParticipant(ctx, session);
    return;
  }

  const room = await db.getRoomById(session.roomId);
  if (!room || room.status === 'ended') { await redis.clearSession(ctx.from.id); return; }

  const question = await db.getQuestionById(session.questionIds[session.currentQIdx]);
  if (!question) return;

  // Two taps landing close enough that both read currentQIdx above before either write
  // below completes — recordChallengeAnswer does an atomic SQL increment, so unlike a
  // Redis race this genuinely double-counts: current_q_idx/total_answered both actually
  // advance, silently skipping the user a question ahead in the live duel.
  if (!(await redis.acquireActionLock(ctx.from.id, 'challenge:answer'))) return;

  const isCorrect = selected === question.correct_option;
  await db.recordChallengeAnswer(room.id, ctx.from.id, isCorrect);

  const nextIdx = session.currentQIdx + 1;
  const isLast = nextIdx >= room.num_questions;
  await redis.updateSession(ctx.from.id, { currentQIdx: nextIdx });

  const afterKb = isLast
    ? { inline_keyboard: [[{ text: '🏁 Finish', callback_data: 'challenge:finish' }]] }
    : { inline_keyboard: [[{ text: '➡️ Next Question', callback_data: 'challenge:next' }]] };

  await ctx.reply(fmt.correctAnswer(question, selected), { parse_mode: 'HTML', reply_markup: afterKb });
}

export async function handleChallengeNext(ctx: any): Promise<void> {
  const session = await redis.getSession(ctx.from.id);
  if (!session || session.mode !== 'challenge') return;
  await ctx.answerCbQuery();

  // A double-tap re-sends the same next question twice — not data-corrupting since
  // this handler doesn't itself advance currentQIdx, but a duplicate message is annoying.
  if (!(await redis.acquireActionLock(ctx.from.id, 'challenge:next'))) return;

  if (Date.now() > session.endTime) {
    await finishParticipant(ctx, session);
    return;
  }

  const room = await db.getRoomById(session.roomId);
  if (!room || room.status === 'ended') { await redis.clearSession(ctx.from.id); return; }

  await sendChallengeQuestion(ctx.telegram, ctx.from.id, room, session.currentQIdx, session.endTime);
}

export async function handleChallengeFinish(ctx: any): Promise<void> {
  const session = await redis.getSession(ctx.from.id);
  if (!session || session.mode !== 'challenge') return;
  await ctx.answerCbQuery();
  await finishParticipant(ctx, session);
}

async function finishParticipant(ctx: any, session: any): Promise<void> {
  await db.finishParticipant(session.roomId, ctx.from.id);
  await redis.clearSession(ctx.from.id);

  const participants = await db.getRoomParticipants(session.roomId);
  const allDone = participants.every(p => p.finished);

  if (allDone) {
    const room = await db.getRoomById(session.roomId);
    // endRoom's own status guard is the authoritative check — a stale `room.status`
    // read here could race against the cron tick ending the same room concurrently.
    if (room && (await db.endRoom(session.roomId))) {
      await broadcastResults(ctx.telegram, room, participants);
    }
  } else {
    await ctx.reply('✅ <b>You\'re done!</b> Waiting for other players to finish…', { parse_mode: 'HTML' });
    for (const p of participants) {
      if (!p.finished && p.telegram_id !== ctx.from.id) {
        await ctx.telegram
          .sendMessage(p.telegram_id, `🏃 <b>${fmt.escHtml(ctx.from.first_name)}</b> has finished! Keep going! 💪`, { parse_mode: 'HTML' })
          .catch(() => {});
      }
    }
  }
}

// ── Results ───────────────────────────────────────────────────────────────────

async function broadcastResults(telegram: any, room: db.PracticeRoom, participants: db.RoomParticipant[]): Promise<void> {
  const sorted = [...participants].sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (a.finished_at && b.finished_at) {
      return new Date(a.finished_at).getTime() - new Date(b.finished_at).getTime();
    }
    return 0;
  });

  const medals = ['🥇', '🥈', '🥉'];
  const sub = fmt.SUBJECT_MAP[room.subject] || room.subject;

  let msg = `🏆 <b>Challenge Results</b>\n`;
  msg += `📚 ${sub} · ${room.year || 'Any Year'} · ${room.num_questions}Q\n\n`;
  sorted.forEach((p, i) => {
    const acc = Math.round((p.correct / room.num_questions) * 100);
    msg += `${medals[i] || `${i + 1}.`} <b>${fmt.escHtml(p.first_name)}</b> — ${p.correct}/${room.num_questions} (${acc}%)\n`;
  });

  const top = sorted[0];
  for (const [i, p] of sorted.entries()) {
    await redis.saveChallengeResult(p.telegram_id, {
      subject: sub,
      numQuestions: room.num_questions,
      rank: i + 1,
      totalPlayers: sorted.length,
      correct: p.correct,
      topPlayer: top ? { firstName: top.first_name, correct: top.correct } : null,
    });
  }

  for (const p of participants) {
    await telegram.sendMessage(p.telegram_id, msg, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[{ text: '📤 Share Results', callback_data: 'challenge:share' }]] },
    }).catch(() => {});
    await telegram.sendMessage(p.telegram_id, 'Use the menu below to continue 👇', {
      reply_markup: fmt.persistentMenuKeyboard(),
    }).catch(() => {});
  }
}

export async function handleChallengeShare(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const result = await redis.getChallengeResult(ctx.from.id);
  if (!result) {
    await ctx.reply('No recent challenge result found. Join a challenge first!');
    return;
  }

  const accuracy = Math.round((result.correct / result.numQuestions) * 100);
  const place = result.rank === 1 ? '1st' : result.rank === 2 ? '2nd' : result.rank === 3 ? '3rd' : `${result.rank}th`;
  const caption = `🎉 <b>${place} place, ${fmt.escHtml(ctx.from.first_name)}!</b>\n\nSave the image above and post it, or forward it straight to a friend.`;

  try {
    const { renderChallengeResultCard } = await import('../../services/shareCard');
    const image = await renderChallengeResultCard({
      firstName: ctx.from.first_name,
      subject: result.subject,
      numQuestions: result.numQuestions,
      rank: result.rank,
      totalPlayers: result.totalPlayers,
      correct: result.correct,
      topPlayer: result.topPlayer,
      joinHandle: `@${BOT_USERNAME}`,
    });
    await ctx.replyWithPhoto({ source: image }, { caption, parse_mode: 'HTML' });
  } catch (err) {
    // Render failure (e.g. bad host font setup) — fall back to the text card so sharing still works
    console.error('[challenge] share card render failed:', (err as Error).message);
    const card = `🏆 <b>ExamBuddie Challenge Result</b>

📚 Subject: ${result.subject}
🏅 Place: ${place} of ${result.totalPlayers}
✅ Score: ${result.correct}/${result.numQuestions}
🎯 Accuracy: ${accuracy}%

Practice free at @${BOT_USERNAME}`;
    await ctx.reply(card, { parse_mode: 'HTML' });
  }
}

// ── Cron helpers ──────────────────────────────────────────────────────────────

export async function startChallengeCron(telegram: any, room: db.PracticeRoom, participants: db.RoomParticipant[]): Promise<void> {
  await startChallenge(telegram, room, participants);
}

export async function endExpiredRoom(telegram: any, room: db.PracticeRoom): Promise<void> {
  if (!(await db.endRoom(room.id))) return; // already ended by an overlapping tick or a finishing participant
  const participants = await db.getRoomParticipants(room.id);
  await broadcastResults(telegram, room, participants);
}

// ── 1v1 Duel ──────────────────────────────────────────────────────────────────

export async function handleDuel(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  if (user.plan !== 'premium') {
    await ctx.reply(
      '⚔️ <b>Duel Mode — Premium Feature</b>\n\nDuel a specific friend 1-on-1. They\'ll be notified automatically if they\'re on ExamBuddie.\n\nUpgrade to Premium to unlock!',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '💎 Upgrade', callback_data: 'menu:subscribe' }]] } }
    );
    return;
  }

  await redis.setSession(ctx.from.id, { step: 'duel_opponent', examType: user.exam_type || 'WAEC' });
  await ctx.reply(
    '⚔️ <b>Duel a Friend</b>\n\nEnter your opponent\'s Telegram username (e.g. <code>johndoe</code>):\n\n<i>They must have used ExamBuddie before to be found.</i>',
    { parse_mode: 'HTML', reply_markup: { force_reply: true, selective: true } }
  );
}

export async function handleDuelOpponentInput(ctx: any): Promise<void> {
  const rawInput = ctx.message?.text?.trim() || '';
  const username = rawInput.replace(/^@/, '');

  if (!username || username.length < 3) {
    await ctx.reply('❌ Invalid username. Try again or /start to go back.');
    return;
  }

  const user = await db.getUser(ctx.from.id);
  if (!user) return;

  if (username.toLowerCase() === (user.username || '').toLowerCase()) {
    await ctx.reply('❌ You can\'t duel yourself! Enter someone else\'s username.');
    return;
  }

  const opponent = await db.getUserByUsername(username);
  if (!opponent) {
    await ctx.reply(
      `❌ No ExamBuddie user found with username <b>@${username}</b>.\n\nThey need to sign up at @${process.env.BOT_USERNAME || 'ExamBuddieBot'} first.\n\nYou can still create a challenge room and share the link manually.`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '➕ Create Challenge Room', callback_data: 'challenge:create' }]] },
      }
    );
    await redis.clearSession(ctx.from.id);
    return;
  }

  // Store opponent telegram_id and jump straight to subject picker
  await redis.setSession(ctx.from.id, {
    step: 'challenge_subject',
    examType: user.exam_type || 'WAEC',
    duelOpponentId: opponent.telegram_id,
    duelOpponentName: opponent.first_name,
  });

  await ctx.reply(
    `⚔️ <b>Duel vs ${opponent.first_name}</b>\n\nPick a subject:`,
    { parse_mode: 'HTML', reply_markup: challengeSubjectKeyboard(Object.keys(fmt.SUBJECT_MAP)) }
  );
}
