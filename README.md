# 宝くじ生活

宝くじの当選金だけで生活するスマホ向けインフレ・放置ゲーム。

- ブラウザ: `www/index.html`（ルートの `index.html` からも開けます）
- ストア用: Capacitor（`jp.takarakuzi.life`）で iOS / Android 化

## ブラウザで遊ぶ

`www/index.html` を開くか:

```bash
npm install
npm run preview
```

## ストア向けセットアップ

1. note で利用規約・プライバシーを公開し、`www/index.html` の `STORE_LINKS` を実URLに変更  
   （下書きの要点は `docs/store-note-draft.md`）
2. 依存関係とネイティブプロジェクト:

```bash
npm install
npx cap add android
npx cap add ios          # macOS + Xcode が必要
npm run sync
npx cap open android
npx cap open ios
```

3. 本番の課金・広告は `StoreBridge`（`www/index.html` 内）にプラグインを接続

## 遊び方（概要）

1. **労働** — 光ったパネルをタップして TP 獲得  
2. **宝くじ購入** — TP でチケットを買い、抽選  
3. **強化** — 当選金で設備・生活、ハズレ券で再生  
4. **嗜好品 / 極み** — 蒐集と追加コンテンツ  

詳細なゲーム仕様は従来どおりコードと記録帳を参照してください。

## 注意

- 娯楽用シミュレーションであり、実在の宝くじ事業とは無関係です
- 複数タブ同時プレイはセーブ競合の原因になるため避けてください
