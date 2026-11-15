/**
 * サービスワーカー(オフラインで遊べるようにする裏方)を登録する。
 * 本番(公開版)だけ。開発中は、古い保存が残って混乱しないよう、登録しない。
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // 登録できなくても、普通に遊べる(オフライン対応が使えないだけ)
    });
  });
}
