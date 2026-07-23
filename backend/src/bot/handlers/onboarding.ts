// src/bot/handlers/onboarding.ts
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';

export async function handleStart(ctx: any): Promise<void> {
  const user = await db.upsertUser(ctx);

  if (user.exam_type && user.subjects && user.subjects.length > 0) {
    await redis.clearSession(ctx.from.id);
    const stats = await db.getUserStats(user.id);
    const total = Number(stats.total_attempts);
    const accuracy = total > 0 ? `${Math.round((Number(stats.correct) / total) * 100)}%` : null;
    const streakLine = user.streak > 0 ? `🔥 ${user.streak}-day streak` : null;
    const statsLine = total > 0
      ? `📊 ${total.toLocaleString()} questions answered${accuracy ? ` · ${accuracy} accuracy` : ''}`
      : null;
    const subLines = [streakLine, statsLine].filter(Boolean).join('\n');
    const body = subLines ? `\n\n${subLines}` : '';
    await ctx.reply(
      `👋 <b>${fmt.timeGreeting()}, ${fmt.escHtml(user.first_name)}!</b>${body}\n\nReady to practise?`,
      { parse_mode: 'HTML', reply_markup: fmt.persistentMenuKeyboard() }
    );

    // One-time nudge for existing users without a phone number
    if (!user.phone_number && !(await redis.hasSeenPhoneNudge(ctx.from.id))) {
      await redis.markPhoneNudgeSent(ctx.from.id);
      await redis.setPhonePending(ctx.from.id);
      await ctx.reply(
        '📱 <b>Quick one!</b> Share your phone number so we can reach you about your subscription and account.\n\n<i>Optional — tap Skip if you prefer not to.</i>',
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              [{ text: '📱 Share Phone Number', request_contact: true }],
              [{ text: 'Skip for now →' }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    }
    return;
  }

  // New user — show consent screen before onboarding starts
  await redis.setSession(ctx.from.id, { step: 'consent', selectedSubjects: [] });
  await ctx.reply(fmt.consentPrompt(user.first_name), {
    parse_mode: 'HTML',
    reply_markup: fmt.consentKeyboard(),
  });
}

// Step 0 — Consent agreed → move to year selection
export async function handleOnboardConsent(ctx: any): Promise<void> {
  await ctx.answerCbQuery();

  await redis.updateSession(ctx.from.id, { step: 'year' });

  // Record consent timestamp for NDPA compliance
  db.updateUser(ctx.from.id, { consent_given_at: new Date().toISOString() } as any).catch(() => {});

  await ctx.editMessageText('✅ <b>Thanks — you\'re all set.</b> You\'ve agreed to our Terms of Use and Privacy Policy.', {
    parse_mode: 'HTML',
  });

  await ctx.reply(fmt.welcome(), {
    parse_mode: 'HTML',
    reply_markup: fmt.onboardYearKeyboard(),
  });
}

// Step 1 — Year selected → move to exam type
export async function handleOnboardYear(ctx: any): Promise<void> {
  const raw = ctx.callbackQuery.data.split(':')[2]; // 'any' or '2024'
  const year = raw === 'any' ? null : parseInt(raw, 10);
  await ctx.answerCbQuery();

  await redis.updateSession(ctx.from.id, {
    step: 'exam_type',
    targetYear: year,
    selectedSubjects: ['english'],
  });

  await ctx.editMessageText(fmt.askExamType(year), {
    parse_mode: 'HTML',
    reply_markup: fmt.examTypeKeyboard(),
  });
}

// Step 2 — Exam type selected → move to subjects
export async function handleExamType(ctx: any): Promise<void> {
  const examType = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery();

  // Settings → "Change Exam Type" reuses this same callback data, but an existing user
  // switching boards shouldn't lose their subjects or target year the way a brand-new
  // user's first-time picks get built up — carry over whatever of their current subjects
  // still has content for the new board instead of resetting to just English, and leave
  // target_year alone entirely (this session never went through the year-selection step,
  // so saving session.targetYear here would silently null it out).
  const session = await redis.getSession(ctx.from.id);
  if (session?.step === 'change_exam') {
    const user = await db.getUser(ctx.from.id);
    if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

    const allowedSubjects = await db.getSubjectsWithQuestions(examType);
    const carriedOver = (user.subjects || []).filter((s) => allowedSubjects.includes(s));
    const subjects = carriedOver.includes('english') ? carriedOver : ['english', ...carriedOver];
    const dropped = (user.subjects || []).filter((s) => s !== 'english' && !allowedSubjects.includes(s));

    await db.updateUser(ctx.from.id, { exam_type: examType as any, subjects });
    await redis.clearSession(ctx.from.id);

    const droppedLine = dropped.length
      ? `\n\n⚠️ These subjects aren't offered for ${examType}, so they were removed: ${dropped.map((s) => fmt.SUBJECT_MAP[s] || s).join(', ')}`
      : '';
    await ctx.editMessageText(
      `✅ <b>Switched to ${examType}.</b>\n\nYour subjects carried over where possible.${droppedLine}\n\nUse Settings → Edit Subjects to fine-tune your list.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // English is always compulsory — pre-select it
  const allowedSubjects = await db.getSubjectsWithQuestions(examType);
  await redis.updateSession(ctx.from.id, {
    step: 'subjects',
    examType,
    selectedSubjects: ['english'],
    allowedSubjects,
  });

  await ctx.editMessageText(fmt.askSubjects(examType), {
    parse_mode: 'HTML',
    reply_markup: fmt.subjectKeyboard(['english'], allowedSubjects, true),
  });
}

// Toggle subject selection
export async function handleSubjectToggle(ctx: any): Promise<void> {
  const subject = ctx.callbackQuery.data.split(':')[2];

  // English is compulsory — cannot be deselected
  if (subject === 'english') {
    await ctx.answerCbQuery('English is compulsory and always included ✅', { show_alert: true });
    return;
  }

  const session = (await redis.getSession(ctx.from.id)) || { selectedSubjects: ['english'] };
  let selected: string[] = session.selectedSubjects || ['english'];

  // Always keep English in the list
  if (!selected.includes('english')) selected = ['english', ...selected];

  // Premium subscribers get unlimited subjects — this is a paid benefit, not just a higher
  // number, so the cap has to be skipped entirely for them, not just raised. Also unlimited
  // during fresh onboarding (session.step === 'subjects'): the 14-day Premium trial is
  // granted right after this step completes (handleSubjectsDone), so a brand-new user is
  // still on the free plan *during* this exact pick — capping them here would be enforcing
  // a free-plan limit on someone who's seconds away from Premium.
  const isFreshOnboarding = session.step === 'subjects';
  const user = isFreshOnboarding ? null : await db.getUser(ctx.from.id);
  const unlimited = isFreshOnboarding || user?.plan === 'premium';

  if (selected.includes(subject)) {
    selected = selected.filter((s: string) => s !== subject);
  } else {
    if (!unlimited && selected.length >= fmt.MAX_SUBJECTS) {
      await ctx.answerCbQuery(
        `Maximum ${fmt.MAX_SUBJECTS} subjects (English + ${fmt.MAX_SUBJECTS - 1} others) — go Premium for unlimited subjects!`,
        { show_alert: true }
      );
      return;
    }
    selected = [...selected, subject];
  }

  await ctx.answerCbQuery();
  await redis.updateSession(ctx.from.id, { selectedSubjects: selected });
  await ctx.editMessageReplyMarkup(fmt.subjectKeyboard(selected, session.allowedSubjects, unlimited));
}

// Step 3 — Subjects done → save everything, show main menu
export async function handleSubjectsDone(ctx: any): Promise<void> {
  const session = await redis.getSession(ctx.from.id);

  if (!session || !session.selectedSubjects || session.selectedSubjects.length === 0) {
    await ctx.answerCbQuery('Please select at least one subject!', { show_alert: true });
    return;
  }
  await ctx.answerCbQuery();

  const { examType, selectedSubjects, targetYear } = session;

  // English is always compulsory
  const subjects: string[] = selectedSubjects.includes('english')
    ? selectedSubjects
    : ['english', ...selectedSubjects];

  // Save all three fields to DB
  const user = await db.updateUser(ctx.from.id, {
    exam_type: examType as any,
    subjects,
    target_year: targetYear ?? null,
  });

  await redis.clearSession(ctx.from.id);
  await redis.setPhonePending(ctx.from.id);

  await ctx.editMessageText(fmt.profileComplete(user), { parse_mode: 'HTML' });

  // Grant 14-day Premium trial to new users completing onboarding for the first time
  if (session.step === 'subjects' && !user.trial_used && user.plan === 'free') {
    const trialUser = await db.grantTrial(ctx.from.id);
    const expiryLine = trialUser?.plan_expires_at
      ? `\n📅 Expires: <b>${new Date(trialUser.plan_expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</b>\n`
      : '';
    await ctx.reply(
      `🎁 <b>Welcome Gift!</b>\n\nWe're giving you <b>14 days of Premium free</b> to get started!\n${expiryLine}\n✅ Unlimited questions\n✅ Quiz mode &amp; topic drills\n✅ Progress tracking &amp; weekly reports\n\nEnjoy — and subscribe when it expires to keep going! /subscribe`,
      { parse_mode: 'HTML' }
    );
  }

  await ctx.reply(
    '📱 <b>One last thing!</b>\n\nShare your phone number so we can send you important updates about your subscription and account.\n\n<i>This is optional — tap Skip if you prefer not to.</i>',
    {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '📱 Share Phone Number', request_contact: true }],
          [{ text: 'Skip for now →' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
}

async function maybeSendBeatYourInviter(ctx: any, user: any): Promise<void> {
  if (!user.referred_by) return;
  try {
    const referrer = await db.getUserById(user.referred_by);
    if (!referrer) return;
    const stats = await db.getUserStats(referrer.id);
    const accuracy = Number(stats.accuracy) || 0;
    const attempts = Number(stats.total_attempts) || 0;
    if (attempts < 5) return; // referrer hasn't done enough to show off
    const streakLine = (referrer.streak || 0) > 0 ? ` a <b>${referrer.streak}-day streak</b> and` : '';
    await ctx.reply(
      `👀 <b>${fmt.escHtml(referrer.first_name)} invited you.</b>\n\nThey have${streakLine} <b>${accuracy}% accuracy</b> across ${attempts.toLocaleString()} questions.\n\nThink you can beat them? 💪\n\n📚 /practice`,
      { parse_mode: 'HTML' }
    );
  } catch { /* non-critical */ }
}

export async function handleContact(ctx: any): Promise<void> {
  const phone = ctx.message?.contact?.phone_number;
  if (!phone) return;

  if (!(await redis.getPhonePending(ctx.from.id))) return;

  const user = await db.updateUser(ctx.from.id, { phone_number: phone });
  await redis.clearPhonePending(ctx.from.id);
  await redis.markPhoneNudgeSent(ctx.from.id);

  await ctx.reply('✅ Phone number saved!', {
    reply_markup: { remove_keyboard: true },
  });
  await ctx.reply('Use the menu below to get started 👇', {
    reply_markup: fmt.persistentMenuKeyboard(),
  });
  await ctx.reply(fmt.onboardingGuide(), { parse_mode: 'HTML' });
  if (user) await maybeSendBeatYourInviter(ctx, user);
}

export async function handlePhoneSkip(ctx: any): Promise<void> {
  await redis.clearPhonePending(ctx.from.id);
  await redis.snoozePhoneNudge(ctx.from.id); // re-show after 7 days

  const user = await db.getUser(ctx.from.id);
  await ctx.reply('No problem! You can always add it later in Settings.', {
    reply_markup: { remove_keyboard: true },
  });
  await ctx.reply('Use the menu below to get started 👇', {
    reply_markup: fmt.persistentMenuKeyboard(),
  });
  await ctx.reply(fmt.onboardingGuide(), { parse_mode: 'HTML' });
  if (user) await maybeSendBeatYourInviter(ctx, user);
}

// /settings command
function settingsKeyboard(notificationsEnabled: boolean, hasPhone: boolean, isPremium: boolean, reminderHour?: number | null) {
  const notifLabel = notificationsEnabled ? '🔔 Bot Messages: ON' : '🔕 Bot Messages: OFF';
  const phoneLabel = hasPhone ? '📱 Update Phone Number' : '📱 Add Phone Number';
  const reminderLabel = reminderHour != null ? `⏰ Daily Reminder: ${String(reminderHour).padStart(2, '0')}:00 WAT` : '⏰ Set Daily Reminder';
  return {
    inline_keyboard: [
      ...(isPremium ? [
        [{ text: '📊 Weekly Report', callback_data: 'settings:weekly_report' }],
        [{ text: '🛡️ Freeze Streak', callback_data: 'settings:freeze_streak' }],
      ] : []),
      [{ text: '📋 Change Exam Type', callback_data: 'settings:exam' }],
      [{ text: '📚 Change Subjects', callback_data: 'settings:subjects' }],
      [{ text: '📅 Change Target Year', callback_data: 'settings:year' }],
      [{ text: phoneLabel, callback_data: 'settings:phone' }],
      [{ text: reminderLabel, callback_data: 'settings:reminder' }],
      [{ text: notifLabel, callback_data: 'settings:notifications' }],
      [{ text: '📄 Terms & Privacy', url: 'https://exambuddie.app/terms' }],
      [{ text: '🗑️ Delete Account', callback_data: 'settings:delete' }],
      [{ text: '❌ Cancel', callback_data: 'menu:main' }],
    ],
  };
}

export async function handleSettings(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) {
    await ctx.reply('Please use /start first.');
    return;
  }

  await ctx.reply(`⚙️ <b>Settings</b>\n\nWhat would you like to change?`, {
    parse_mode: 'HTML',
    reply_markup: settingsKeyboard(user.notifications_enabled, !!user.phone_number, user.plan === 'premium', user.daily_reminder_hour),
  });
}

export async function handleSettingsExam(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await redis.setSession(ctx.from.id, { step: 'change_exam', selectedSubjects: [] });
  await ctx.editMessageText('Which exam would you like to switch to?', {
    reply_markup: fmt.examTypeKeyboard(),
  });
}

export async function handleSettingsSubjects(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  // Always ensure English is in the selection
  const current = user.subjects?.includes('english')
    ? user.subjects
    : ['english', ...(user.subjects || [])];
  const allowedSubjects = await db.getSubjectsWithQuestions(user.exam_type || '');
  await redis.setSession(ctx.from.id, {
    step: 'change_subjects',
    selectedSubjects: current,
    allowedSubjects,
  });
  const unlimited = user.plan === 'premium';
  const limitLine = unlimited
    ? 'English is compulsory. As a Premium subscriber, you can select unlimited subjects.'
    : `English is compulsory. You can select up to ${fmt.MAX_SUBJECTS} subjects total.`;
  await ctx.editMessageText(
    `📚 <b>Edit Subjects</b>\n\n${limitLine}`,
    { parse_mode: 'HTML', reply_markup: fmt.subjectKeyboard(current, allowedSubjects, unlimited) }
  );
}

export async function handleSettingsNotifications(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  const newVal = !user.notifications_enabled;
  await db.updateUser(ctx.from.id, { notifications_enabled: newVal });
  await ctx.editMessageReplyMarkup(settingsKeyboard(newVal, !!user.phone_number, user.plan === 'premium', user.daily_reminder_hour));
  await ctx.answerCbQuery(
    newVal
      ? "Bot messages enabled ✅"
      : "Bot messages disabled 🔕",
    { show_alert: false }
  );
}

export async function handleSettingsDelete(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    `🗑️ <b>Delete Account</b>\n\n⚠️ This will permanently delete your account and all your data:\n\n• Practice history & stats\n• Progress tracking\n• Subscription info\n\nThis cannot be undone.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⚠️ Yes, delete everything', callback_data: 'settings:delete:confirm' }],
          [{ text: '← Back to Settings', callback_data: 'settings:back' }],
        ],
      },
    }
  );
}

export async function handleSettingsDeleteConfirm(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const telegramId = ctx.from.id;
  await redis.deleteUserData(telegramId);
  await db.deleteUser(telegramId);
  await ctx.editMessageText(
    `✅ <b>Account deleted.</b>\n\nAll your data has been permanently removed. Use /start anytime to create a new account.`,
    { parse_mode: 'HTML' }
  );
}

export async function handleSettingsYear(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  const current = user.target_year ? `Currently: <b>${user.target_year}</b>` : 'Currently: <b>Any Year</b>';
  await ctx.editMessageText(
    `📅 <b>Change Target Year</b>\n\n${current}\n\nSelect the year you're preparing for, or choose Any Year to practice all years.`,
    { parse_mode: 'HTML', reply_markup: fmt.settingsYearKeyboard() }
  );
}

export async function handleSettingsYearPick(ctx: any): Promise<void> {
  const raw = ctx.callbackQuery.data.split(':')[2];
  const year = raw === 'any' ? null : parseInt(raw, 10);
  await db.updateUser(ctx.from.id, { target_year: year });
  const label = year ? `${year}` : 'Any Year';
  await ctx.answerCbQuery(`Target year set to ${label} ✅`, { show_alert: false });
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  await ctx.editMessageText(`⚙️ <b>Settings</b>\n\nWhat would you like to change?`, {
    parse_mode: 'HTML',
    reply_markup: settingsKeyboard(user.notifications_enabled, !!user.phone_number, user.plan === 'premium', user.daily_reminder_hour),
  });
}

export async function handleSettingsBack(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }
  await ctx.editMessageText(`⚙️ <b>Settings</b>\n\nWhat would you like to change?`, {
    parse_mode: 'HTML',
    reply_markup: settingsKeyboard(user.notifications_enabled, !!user.phone_number, user.plan === 'premium', user.daily_reminder_hour),
  });
}

export async function handleStreakFreeze(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.answerCbQuery(); return; }

  if (user.plan !== 'premium') {
    await ctx.answerCbQuery('Streak freeze is a Premium feature!', { show_alert: true });
    return;
  }
  if ((user.streak || 0) === 0) {
    await ctx.answerCbQuery('No active streak to protect! Start practising first.', { show_alert: true });
    return;
  }
  // Once per 7 days
  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
  if (user.streak_freeze_used_at && user.streak_freeze_used_at >= sevenDaysAgo) {
    await ctx.answerCbQuery('You can only freeze your streak once per week!', { show_alert: true });
    return;
  }
  const today = new Date(Date.now() + 60 * 60 * 1000).toISOString().split('T')[0]; // WAT today
  await db.updateUser(ctx.from.id, { streak_freeze_used_at: today as any });
  await ctx.answerCbQuery(
    `🛡️ Streak frozen! Your ${user.streak}-day streak is protected for today.`,
    { show_alert: true }
  );
  await ctx.editMessageText('⚙️ <b>Settings</b>\n\nWhat would you like to change?', {
    parse_mode: 'HTML',
    reply_markup: settingsKeyboard(user.notifications_enabled, !!user.phone_number, true, user.daily_reminder_hour),
  });
}

export async function handleSettingsPhone(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  await redis.setPhonePending(ctx.from.id);

  const prompt = user.phone_number
    ? `📱 <b>Update Phone Number</b>\n\nCurrent: <code>${user.phone_number}</code>\n\nTap the button below to share your updated number.`
    : '📱 <b>Add Phone Number</b>\n\nTap the button below to share your phone number.';

  await ctx.reply(prompt, {
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [
        [{ text: '📱 Share Phone Number', request_contact: true }],
        [{ text: 'Skip for now →' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

export async function handleSettingsReminder(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong. Please try /start.'); return; }

  const hours = [6, 7, 8, 9, 10, 14, 16, 18, 20, 21];
  const keyboard = {
    inline_keyboard: [
      ...hours.map(h => ([{ text: `${String(h).padStart(2, '0')}:00 WAT`, callback_data: `settings:reminder:set:${h}` }])),
      [{ text: '🔕 Turn Off Reminder', callback_data: 'settings:reminder:off' }],
      [{ text: '← Back', callback_data: 'settings:back' }],
    ],
  };
  const current = user.daily_reminder_hour != null
    ? `Current: <b>${String(user.daily_reminder_hour).padStart(2, '0')}:00 WAT</b>\n\n`
    : '';
  await ctx.reply(
    `⏰ <b>Daily Practice Reminder</b>\n\n${current}Pick what time you want a daily nudge to practise. We'll skip it on days you already studied.`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
}

export async function handleReminderSet(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const parts = ctx.callbackQuery.data.split(':');
  const hour = parts[3] === 'off' ? null : parseInt(parts[3], 10);
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Something went wrong.'); return; }

  await db.updateUser(ctx.from.id, { daily_reminder_hour: hour } as any);

  if (hour === null) {
    await ctx.reply('🔕 Daily reminder turned off.');
  } else {
    await ctx.reply(`✅ Reminder set for <b>${String(hour).padStart(2, '0')}:00 WAT</b> every day. We'll skip it when you've already practised.`, { parse_mode: 'HTML' });
  }
}

