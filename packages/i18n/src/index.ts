import ja from './ja.json';
import en from './en.json';

export { ja, en };

/** 言語ファイルの形(日本語ファイルが基準)。 */
export type Messages = typeof ja;

/** 画面に出す文字は、ここを通して取り出す。 */
export function getMessages(): Messages {
  return ja;
}
