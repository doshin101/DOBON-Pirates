# DOBON-Pirates

トランプゲーム「ドボン」を、スマホで遊べるWebゲームにするプロジェクトです。

- **遊ぶ(最新版)**:https://dobon-game.pages.dev/(過去の段階の版は、[`docs/setup/release-stages.md`](docs/setup/release-stages.md))
- いまの段階:**MVP(ミニマムルールで、CPU3人と1ゲーム)**
- 作業ルール:[`CLAUDE.md`](CLAUDE.md)
- ルール:[`docs/rules/minimum.md`](docs/rules/minimum.md)、用語:[`docs/rules/glossary.md`](docs/rules/glossary.md)
- MVPの仕様:[`docs/mvp/spec.md`](docs/mvp/spec.md)、画面:[`docs/mvp/wireframe.html`](docs/mvp/wireframe.html)
- 進め方:[`docs/mvp/tasks.md`](docs/mvp/tasks.md)
- スマホでの開発手順:[`docs/setup/smartphone-workflow.md`](docs/setup/smartphone-workflow.md)
- ホーム画面に追加(アプリのように開く・オフラインで遊ぶ):[`docs/setup/install-on-phone.md`](docs/setup/install-on-phone.md)

## フォルダ構成

| 場所 | 役割 |
|---|---|
| `apps/web` | 画面(Vite + React)。タイマーもここ |
| `packages/core` | ルールと状態の変化(画面・時間・本物の乱数を使わない) |
| `packages/cpu` | CPUの考え |
| `packages/i18n` | 言語ファイル(`ja.json` / `en.json`) |
| `docs/` | ルール・仕様・判断の記録など |
| `devlog/` | 開発日誌 |

## 使えるコマンド(ルートで実行)

| コマンド | 内容 |
|---|---|
| `npm install` | 必要なものを入れる |
| `npm test` | 自動テスト(Vitest) |
| `npm run build` | 公開用のファイルを `apps/web/dist` に作る |
| `npm run dev` | 開発用の画面を起動する |
| `npm run typecheck` | 型の間違いがないか調べる(`npm run build` の中でも実行される) |
| `npm run sim` | CPUだけで1000ゲーム回して、`docs/research/sim-minimum-001.md` を作り直す |

Node は 20 以上(`.nvmrc` に書いてあります)。

## Cloudflare Pages の設定値

Cloudflare Pages でこのリポジトリをつなぐときに入れる値です。手順は [`docs/setup/smartphone-workflow.md`](docs/setup/smartphone-workflow.md) を見てください。

| 項目 | 値 |
|---|---|
| Project name(アドレスになる。あとから変えられない) | `dobon-game`(→ `dobon-game.pages.dev`) |
| Production branch(本番のブランチ) | `main` |
| Framework preset | なし(None) |
| Build command(ビルドコマンド) | `npm run build` |
| Build output directory(出力先) | `apps/web/dist` |
| Root directory(ルート) | 空のまま(リポジトリの一番上) |
| 環境変数 `NODE_VERSION` | `20`(`.nvmrc` でも伝わるが、念のため) |

## デバッグ機能(開発の確認用)

URL の後ろに付けるか、ホームの「設定(デバッグ)」で指定します。

| URL | 内容 |
|---|---|
| `?debug=1` | デバッグ表示(CPUの手札の表、ログを開く、結果画面にシード) |
| `?seed=123` | 配りの元(シード)を決める。同じシードで同じ操作をすると、同じ展開になる |
| `?speed=4` | 進行の速さ(1 / 2 / 4)。すべての待ち時間をこの倍率で割る |

4つの終わり方(勝つ・ドボンされて負ける・チョンボ・引き分け)を再現できるシードは、[`docs/mvp/test-seeds.md`](docs/mvp/test-seeds.md) にあります。
