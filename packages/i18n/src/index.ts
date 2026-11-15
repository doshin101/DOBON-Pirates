import ja from './ja.json';
import en from './en.json';

export { ja, en };

/** 言語ファイルの形(日本語ファイルが基準)。 */
export type Messages = typeof ja;

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
