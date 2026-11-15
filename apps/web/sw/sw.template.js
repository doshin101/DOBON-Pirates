// サービスワーカー(オフラインでも遊べるようにする、ブラウザの裏方)。
// ビルドのとき、vite.config.ts の小さなプラグインが、下の2か所(版の印と、保存するファイルの一覧)を
// 埋めて、dist/sw.js として出力する。このファイルを直接読み込むことはない。

const CACHE = 'dobon-__BUILD_ID__';
// 最初に読み込んで、保存しておくファイル(ビルドで作られた JS・CSS・アイコンなど)
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // 新しい版を、待たずにすぐ使えるようにする
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // 古い版の保存は消す
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ページ本体(HTML):まずネットワークで最新を取る。つながらないときは、保存してあるものを出す
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // それ以外(JS・CSS・画像など。ファイル名に中身の印が付いているので、保存したものをそのまま使ってよい)
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
