interface TimerEntry {
  timeout: NodeJS.Timeout;
  interval: NodeJS.Timeout;
}

const timers = new Map<number | string, TimerEntry>();

export function setQuestionTimer(
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

export function clearQuestionTimer(telegramId: number | string): void {
  const entry = timers.get(telegramId);
  if (entry) {
    clearTimeout(entry.timeout);
    clearInterval(entry.interval);
    timers.delete(telegramId);
  }
}
