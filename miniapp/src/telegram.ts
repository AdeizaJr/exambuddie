declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: { id: number; first_name: string; last_name?: string; username?: string };
          start_param?: string;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme: 'light' | 'dark';
        ready(): void;
        expand(): void;
        close(): void;
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
        BackButton: {
          isVisible: boolean;
          show(): void;
          hide(): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show(): void;
          hide(): void;
          setText(text: string): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          showProgress(leaveActive?: boolean): void;
          hideProgress(): void;
        };
        onEvent(eventType: string, callback: () => void): void;
        offEvent(eventType: string, callback: () => void): void;
        setHeaderColor(color: string): void;
        setBackgroundColor(color: string): void;
        isVersionAtLeast(version: string): boolean;
        version: string;
        platform: string;
      };
    };
  }
}

export const tg = window.Telegram?.WebApp;

export function applyTelegramTheme() {
  const p = tg?.themeParams || {};
  const root = document.documentElement;
  root.style.setProperty('--tg-bg', p.bg_color || '#ffffff');
  root.style.setProperty('--tg-text', p.text_color || '#000000');
  root.style.setProperty('--tg-hint', p.hint_color || '#999999');
  root.style.setProperty('--tg-link', p.link_color || '#2678b6');
  root.style.setProperty('--tg-button', p.button_color || '#2678b6');
  root.style.setProperty('--tg-button-text', p.button_text_color || '#ffffff');
  root.style.setProperty('--tg-secondary-bg', p.secondary_bg_color || '#f1f1f1');
}

export function haptic(type: 'light' | 'medium' | 'success' | 'error' | 'selection' = 'light') {
  if (!tg?.HapticFeedback) return;
  if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
  else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
  else if (type === 'selection') tg.HapticFeedback.selectionChanged();
  else tg.HapticFeedback.impactOccurred(type);
}
