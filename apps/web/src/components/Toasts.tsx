import { getMessages } from '@dobon/i18n';
import type { Toast } from '../game/GameRunner';
import { toastText } from '../ui/text';

/** 「○○が張った!」「○○ 継続」など、少しの間だけ出る知らせ(文字だけ) */
export function Toasts({ toasts }: { toasts: readonly Toast[] }) {
  const m = getMessages();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          {toastText(m, toast)}
        </div>
      ))}
    </div>
  );
}
