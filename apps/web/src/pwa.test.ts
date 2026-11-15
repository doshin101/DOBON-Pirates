import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import manifestText from '../public/manifest.webmanifest?raw';
import headersText from '../public/_headers?raw';
import swTemplate from '../sw/sw.template.js?raw';

// ホーム画面に追加して、アプリのように開ける(PWA)ための設定が、そろっているかを守るテスト。

// public のファイルが、本当にあるか(見つからなければ、読み込みの時点で落ちる)
const publicFiles = Object.keys(import.meta.glob('../public/**/*', { query: '?url', import: 'default', eager: true }));

interface Icon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
const manifest = JSON.parse(manifestText) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  theme_color: string;
  background_color: string;
  lang: string;
  icons: Icon[];
};

describe('マニフェスト(アプリの名前・アイコンなどの設定)', () => {
  it('名前・開く場所・全画面表示・縦向きが決まっている', () => {
    expect(manifest.name).toBe('DOBON');
    expect(manifest.short_name).toBe('DOBON');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.lang).toBe('ja');
  });
  it('色が、正しい書き方(#rrggbb)で決まっている', () => {
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('インストールに必要なアイコン(192・512)と、マスク用アイコンがある', () => {
    const find = (size: string, purpose: string) => manifest.icons.find((i) => i.sizes === size && i.purpose === purpose);
    expect(find('192x192', 'any')).toBeDefined();
    expect(find('512x512', 'any')).toBeDefined();
    expect(find('512x512', 'maskable')).toBeDefined();
  });
  it('マニフェストに書いたアイコンのファイルが、すべて public にある', () => {
    for (const icon of manifest.icons) {
      expect(publicFiles, icon.src).toContain(`../public/${icon.src}`);
      expect(icon.type).toBe('image/png');
    }
  });
});

describe('index.html', () => {
  it('マニフェスト・テーマ色・iPhone用のアイコンを読み込んでいる', () => {
    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(indexHtml).toContain(`name="theme-color" content="${manifest.theme_color}"`);
    expect(indexHtml).toContain('rel="apple-touch-icon" href="/icons/apple-touch-icon.png"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable"');
    expect(publicFiles).toContain('../public/icons/apple-touch-icon.png');
    expect(publicFiles).toContain('../public/icons/icon.svg');
  });
  it('ノッチなどの安全な範囲を使えるよう、viewport-fit=cover を指定している', () => {
    expect(indexHtml).toContain('viewport-fit=cover');
  });
});

describe('_headers(Cloudflare Pages)', () => {
  it('sw.js と マニフェストは、いつも最新を確認させる', () => {
    expect(headersText).toMatch(/\/sw\.js\s+Cache-Control: no-cache/);
    expect(headersText).toMatch(/\/manifest\.webmanifest[\s\S]*Cache-Control: no-cache/);
  });
});

// ---- サービスワーカー(オフライン対応)の動き ----

const BASE = 'https://dobon.test';
const PRECACHE = ['./', './assets/app.js', './manifest.webmanifest'];

type Handler = (event: unknown) => void;
type FakeRequest = { method: string; url: string; mode?: string };

/** ビルドのときのプラグインと同じように、2つの目印を埋めて、偽のブラウザの中で動かす */
function loadServiceWorker(buildId: string, network: (url: string) => Promise<Response>) {
  const code = swTemplate.replace('__BUILD_ID__', buildId).replace('__PRECACHE__', JSON.stringify(PRECACHE));
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, Map<string, Response>>();
  const norm = (key: string | FakeRequest): string => new URL(typeof key === 'string' ? key : key.url, `${BASE}/`).href;
  const state = { skipWaiting: 0, claim: 0, networkCalls: [] as string[] };

  const openCache = (name: string) => {
    const cache = store.get(name) ?? new Map<string, Response>();
    store.set(name, cache);
    return {
      addAll: async (urls: string[]) => {
        for (const url of urls) cache.set(norm(url), await network(norm(url)));
      },
      put: async (key: string | FakeRequest, response: Response) => void cache.set(norm(key), response),
    };
  };
  const caches = {
    open: async (name: string) => openCache(name),
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (key: string | FakeRequest) => {
      for (const cache of store.values()) {
        const hit = cache.get(norm(key));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  const self = {
    location: { origin: BASE },
    addEventListener: (type: string, handler: Handler) => void (handlers[type] = handler),
    skipWaiting: async () => void state.skipWaiting++,
    clients: { claim: async () => void state.claim++ },
  };
  const fetchFn = async (request: string | FakeRequest) => {
    const url = norm(request);
    state.networkCalls.push(url);
    return network(url);
  };
  new Function('self', 'caches', 'fetch', code)(self, caches, fetchFn);

  const settle = async (type: 'install' | 'activate') => {
    const waits: Promise<unknown>[] = [];
    handlers[type]!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  const request = async (req: FakeRequest) => {
    let responded: Promise<Response> | undefined;
    handlers.fetch!({ request: req, respondWith: (p: Promise<Response>) => (responded = p) });
    return responded ? await responded : undefined;
  };
  return { store, state, settle, request };
}

const ok = (body: string) => Promise.resolve(new Response(body, { status: 200 }));
const down = () => Promise.reject(new TypeError('offline'));

describe('サービスワーカー(オフライン対応)', () => {
  it('テンプレートに、版の印と保存の一覧の目印が、ちょうど1つずつある', () => {
    expect(swTemplate.split('__BUILD_ID__')).toHaveLength(2);
    expect(swTemplate.split('__PRECACHE__')).toHaveLength(2);
  });

  it('インストール:一覧のファイルを保存して、すぐ新しい版を使えるようにする', async () => {
    const sw = loadServiceWorker('v1', (url) => ok(`body:${url}`));
    await sw.settle('install');
    expect([...sw.store.keys()]).toEqual(['dobon-v1']);
    expect([...sw.store.get('dobon-v1')!.keys()].sort()).toEqual(
      PRECACHE.map((p) => new URL(p, `${BASE}/`).href).sort(),
    );
    expect(sw.state.skipWaiting).toBe(1);
  });

  it('有効化:古い版の保存は消して、今の版は残す', async () => {
    const sw = loadServiceWorker('v2', (url) => ok(url));
    sw.store.set('dobon-v1', new Map());
    sw.store.set('other-app', new Map());
    await sw.settle('install');
    await sw.settle('activate');
    expect([...sw.store.keys()].sort()).toEqual(['dobon-v2']);
    expect(sw.state.claim).toBe(1);
  });

  it('ページ本体:つながるときは最新を取り、つながらないときは保存してあるものを出す', async () => {
    let online = true;
    const sw = loadServiceWorker('v1', (url) => (online ? ok(`html@${url}`) : down()));
    await sw.settle('install');
    const first = await sw.request({ method: 'GET', url: `${BASE}/`, mode: 'navigate' });
    expect(await first!.text()).toBe(`html@${BASE}/`);
    online = false;
    const offline = await sw.request({ method: 'GET', url: `${BASE}/?seed=113&debug=1`, mode: 'navigate' });
    expect(await offline!.text()).toBe(`html@${BASE}/`); // 保存してあるページ本体
  });

  it('JS・CSS など:保存してあればネットワークを使わない。なければ取って保存し、あとはオフラインでも出せる', async () => {
    let online = true;
    const sw = loadServiceWorker('v1', (url) => (online ? ok(`file@${url}`) : down()));
    await sw.settle('install');
    sw.state.networkCalls.length = 0;
    const cached = await sw.request({ method: 'GET', url: `${BASE}/assets/app.js` });
    expect(await cached!.text()).toBe(`file@${BASE}/assets/app.js`);
    expect(sw.state.networkCalls).toEqual([]); // 保存したものを使った

    const fresh = await sw.request({ method: 'GET', url: `${BASE}/icons/new.png` });
    expect(await fresh!.text()).toBe(`file@${BASE}/icons/new.png`);
    online = false;
    const again = await sw.request({ method: 'GET', url: `${BASE}/icons/new.png` });
    expect(await again!.text()).toBe(`file@${BASE}/icons/new.png`);
  });

  it('失敗した応答(404 など)は、保存しない', async () => {
    const sw = loadServiceWorker('v1', (url) => (url.endsWith('/missing.js') ? Promise.resolve(new Response('no', { status: 404 })) : ok('x')));
    await sw.settle('install');
    const res = await sw.request({ method: 'GET', url: `${BASE}/missing.js` });
    expect(res!.status).toBe(404);
    expect([...sw.store.get('dobon-v1')!.keys()]).not.toContain(`${BASE}/missing.js`);
  });

  it('GET 以外と、ほかのサイトへの通信には、手を出さない', async () => {
    const sw = loadServiceWorker('v1', (url) => ok(url));
    await sw.settle('install');
    expect(await sw.request({ method: 'POST', url: `${BASE}/api` })).toBeUndefined();
    expect(await sw.request({ method: 'GET', url: 'https://example.com/lib.js' })).toBeUndefined();
  });
});
