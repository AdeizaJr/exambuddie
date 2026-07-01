interface TimerEntry {
  timeout: NodeJS.Timeout;
  interval: NodeJS.Timeout;
}

const timers = new Map<number | string, TimerEntry>();

function setQuestionTimer(
  telegramId: number | string,
  timerSecs: number,
  onTick: (secsLeft: number) => void,
  onExpire: () => Promise<void>,
): void {
  clearQuestionTimer(telegramId);

  const startTime = Date.now();

  const interval = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const secsLeft = Math.max(0, timerSecs - elapsed);
    onTick(secsLeft);
  }, 1000);

  const timeout = setTimeout(() => {
    clearInterval(interval);
    timers.delete(telegramId);
    onExpire().catch(() => {});
  }, timerSecs * 1000);

  timers.set(telegramId, { timeout, interval });
}

export function startDisplayTimer(
  telegramId: number | string,
  timerSecs: number,
  display: {
    telegram: any;
    chatId: number;
    messageId: number;
    imageUrl?: string | null;
    baseText: string;
    timerLine: (secs: number) => string;
    keyboard: any;
  },
  onExpire: () => Promise<void>,
): void {
  const { telegram, chatId, messageId, imageUrl, baseText, timerLine, keyboard } = display;
  setQuestionTimer(
    telegramId,
    timerSecs,
    (secsLeft) => {
      const text = baseText + timerLine(secsLeft);
      if (imageUrl) {
        telegram.editMessageCaption(chatId, messageId, undefined, text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {});
      } else {
        telegram.editMessageText(chatId, messageId, undefined, text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {});
      }
    },
    onExpire,
  );
}

export function clearQuestionTimer(telegramId: number | string): void {
  const entry = timers.get(telegramId);
  if (entry) {
    clearTimeout(entry.timeout);
    clearInterval(entry.interval);
    timers.delete(telegramId);
  }
}
