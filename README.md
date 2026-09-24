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

課金は `@capgo/native-purchases`（Play Billing / StoreKit 2）、広告は `@capacitor-community/admob` のリワード広告です。ブラウザではモックのままです。

1. note で利用規約・プライバシー・サポートを公開し、`www/index.html` の `STORE_LINKS` を実URLに変更  
   （下書きの要点は `docs/store-note-draft.md`）
2. AdMob でアプリとリワード広告ユニットを作り、`store.config.json` に ID を入れる。提出ビルドでは `useTestAds` を `false` にする
3. App Store Connect / Play Console に、コードと同じ製品 ID でアプリ内課金を作る  
   - `starter_kit_500` … 非消耗型（買い切り。付与後に consume しない）  
   - `coins_100` `coins_220` `coins_550` `coins_1200` `coins_6500` `coins_14000` … 消耗型（付与を保存してから Android で consume）
4. ネイティブプロジェクトへ反映:

```bash
npm install
npm run sync
npm run check:store
npx cap open android
npx cap open ios
```

`npm run package:store` は、テスト広告 ID と仮の規約 URL が残っていると失敗します。提出前の確認用です。

iOS は Xcode で In-App Purchase を有効にし、署名して Archive します。Android は自分のアップロード鍵でリリース用 AAB を作ります。鍵はリポジトリに置きません。

## 遊び方（概要）

1. **労働** — 光ったパネルをタップして TP 獲得  
2. **宝くじ購入** — TP でチケットを買い、抽選  
3. **強化** — 当選金で設備・生活、ハズレ券で再生  
4. **嗜好品 / 極み** — 蒐集と追加コンテンツ  

詳細なゲーム仕様は従来どおりコードと記録帳を参照してください。

## 注意

- 娯楽用シミュレーションであり、実在の宝くじ事業とは無関係です
- 複数タブ同時プレイはセーブ競合の原因になるため避けてください
