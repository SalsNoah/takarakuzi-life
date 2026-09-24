#!/usr/bin/env node
/* ストア提出前の設定漏れを止める。開発中の sync では使わない。 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "store.config.json"), "utf8"));
const html = fs.readFileSync(path.join(root, "www", "index.html"), "utf8");
const admob = cfg.admob || {};
const errors = [];
const sample = "3940256099942544";

function isSample(id){
  return !id || String(id).indexOf(sample) >= 0;
}
if(cfg.useTestAds){
  errors.push("store.config.json の useTestAds が true です。提出ビルドでは false にしてください。");
}
if(isSample(admob.androidAppId)){
  errors.push("AdMob の Android アプリ ID が未設定、または Google のサンプル ID です。");
}
if(isSample(admob.iosAppId)){
  errors.push("AdMob の iOS アプリ ID が未設定、または Google のサンプル ID です。");
}
if(isSample(admob.rewardedAndroid)){
  errors.push("リワード広告の Android 広告ユニット ID が未設定、またはテスト ID です。");
}
if(isSample(admob.rewardedIos)){
  errors.push("リワード広告の iOS 広告ユニット ID が未設定、またはテスト ID です。");
}

const linkBlock = html.slice(html.indexOf("const STORE_LINKS"), html.indexOf("const IAP_PRODUCT_IDS"));
for(const key of ["terms", "privacy", "support"]){
  const m = linkBlock.match(new RegExp(key + ':\\s*"([^"]*)"'));
  const url = m ? m[1] : "";
  if(!/^https:\/\/.+/.test(url) || /^https:\/\/note\.com\/?$/.test(url)){
    errors.push("STORE_LINKS." + key + " が公開済みの https URL ではありません。");
  }
}

if(!html.includes("NativePurchases") || !html.includes("prepareRewardVideoAd")){
  errors.push("www/index.html の StoreBridge がストア課金・リワード広告に接続されていません。");
}

if(errors.length){
  console.error("ストア提出チェックに失敗しました:");
  for(const err of errors) console.error(" - " + err);
  process.exit(1);
}
console.log("ストア提出チェック OK");
