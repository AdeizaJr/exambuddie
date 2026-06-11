// src/bot/handlers/onboarding.ts
import * as db from '../../db';
import * as redis from '../../services/redis';
import * as fmt from '../formatter';

export async function handleStart(ctx: any): Promise<void> {
  const user = await db.upsertUser(ctx);

  if (user.exam_type && user.subjects && user.subjects.length > 0) {
    await ctx.reply(
      `👋 <b>Welcome back, ${user.first_name}!</b>\n\nReady to practise? Tap a button below or choose from the menu:`,
      { parse_mode: 'HTML', reply_markup: fmt.persistentMenuKeyboard() }
    );
    return;
  }

  // New user — start onboarding at step 1: year selection
  await redis.setSession(ctx.from.id, { step: 'year', selectedSubjects: [] });
  await ctx.reply(fmt.welcome(user.first_name), {
    parse_mode: 'HTML',
    reply_markup: fmt.onboardYearKeyboard(),
  });
}

// Step 1 — Year selected → move to exam type
export async function handleOnboardYear(ctx: any): Promise<void> {
  const raw = ctx.callbackQuery.data.split(':')[2]; // 'any' or '2024'
  const year = raw === 'any' ? null : parseInt(raw, 10);
  await ctx.answerCbQuery();

  await redis.updateSession(ctx.from.id, { step: 'exam_type', targetYear: year, selectedSubjects: ['english'] });

  await ctx.editMessageText(fmt.askExamType(year), {
    parse_mode: 'HTML',
    reply_markup: fmt.examTypeKeyboard(),
  });
}

// Step 2 — Exam type selected → move to subjects
export async function handleExamType(ctx: any): Promise<void> {
  const examType = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery();

  const session = await redis.getSession(ctx.from.id) || {};
  // English is always compulsory — pre-select it
  await redis.updateSession(ctx.from.id, { step: 'subjects', examType, selectedSubjects: ['english'] });

  await ctx.editMessageText(fmt.askSubjects(examType), {
    parse_mode: 'HTML',
    reply_markup: fmt.subjectKeyboard(['english']),
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

  await ctx.answerCbQuery();

  const session = await redis.getSession(ctx.from.id) || { selectedSubjects: ['english'] };
  let selected: string[] = session.selectedSubjects || ['english'];

  // Always keep English in the list
  if (!selected.includes('english')) selected = ['english', ...selected];

  if (selected.includes(subject)) {
    selected = selected.filter((s: string) => s !== subject);
  } else {
    if (selected.length >= fmt.MAX_SUBJECTS) {
      await ctx.answerCbQuery(
        `Maximum ${fmt.MAX_SUBJECTS} subjects (English + ${fmt.MAX_SUBJECTS - 1} others)`,
        { show_alert: true }
      );
      return;
    }
    selected = [...selected, subject];
  }

  await redis.updateSession(ctx.from.id, { selectedSubjects: selected });
  await ctx.editMessageReplyMarkup(fmt.subjectKeyboard(selected));
}

// Step 3 — Subjects done → save everything, show main menu
export async function handleSubjectsDone(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const session = await redis.getSession(ctx.from.id);

  if (!session || !session.selectedSubjects || session.selectedSubjects.length === 0) {
    await ctx.answerCbQuery('Please select at least one subject!', { show_alert: true });
    return;
  }

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

  await ctx.editMessageText(fmt.profileComplete(user), { parse_mode: 'HTML' });
  await ctx.reply('Use the menu below to get started 👇', {
    reply_markup: fmt.persistentMenuKeyboard(),
  });
}

// /settings command
export async function handleSettings(ctx: any): Promise<void> {
  const user = await db.getUser(ctx.from.id);
  if (!user) { await ctx.reply('Please use /start first.'); return; }

  await ctx.reply(
    `⚙️ <b>Settings</b>\n\nWhat would you like to change?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Change Exam Type', callback_data: 'settings:exam' }],
          [{ text: '📚 Change Subjects', callback_data: 'settings:subjects' }],
          [{ text: '🔔 Toggle Notifications', callback_data: 'settings:notifications' }],
          [{ text: '❌ Cancel', callback_data: 'menu:main' }],
        ],
      },
    }
  );
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
  if (!user) return;
  // Always ensure English is in the selection
  const current = user.subjects?.includes('english')
    ? user.subjects
    : ['english', ...(user.subjects || [])];
  await redis.setSession(ctx.from.id, {
    step: 'change_subjects',
    selectedSubjects: current,
  });
  await ctx.editMessageText(
    `📚 <b>Edit Subjects</b>\n\nEnglish is compulsory. You can select up to ${fmt.MAX_SUBJECTS} subjects total.`,
    { parse_mode: 'HTML', reply_markup: fmt.subjectKeyboard(current) }
  );
}

export async function handleSettingsNotifications(ctx: any): Promise<void> {
  await ctx.answerCbQuery();
  const user = await db.getUser(ctx.from.id);
  if (!user) return;
  const newVal = !user.notifications_enabled;
  await db.updateUser(ctx.from.id, { notifications_enabled: newVal });
  await ctx.answerCbQuery(
    `Notifications ${newVal ? 'enabled ✅' : 'disabled 🔕'}`,
    { show_alert: true }
  );
}
