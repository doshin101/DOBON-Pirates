import jaMessages from './ja.json';
import enMessages from './en.json';

/** 言語ファイルの形(日本語ファイルが基準)。 */
export type Messages = typeof jaMessages;

export const ja: Messages = jaMessages;
/** 英語。日本語と同じ形でないと、型チェックで落ちる(言語の切り替え画面は、まだない) */
export const en: Messages = enMessages;

/** 画面に出す文字は、ここを通して取り出す。 */
export function getMessages(): Messages {
  return ja;
}

/**
 * 文字の中の {name} のような穴を、値で埋める。
 * 例: format('{name} がプレイ', { name: 'CPU 1' }) → 'CPU 1 がプレイ'
 */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  );
}
