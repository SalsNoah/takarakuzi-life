#!/usr/bin/env node
/* store.config.json を Android / iOS / www に反映する */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(root, "store.config.json"), "utf8"));
const admob = cfg.admob || {};
const androidAppId = admob.androidAppId || "";
const iosAppId = admob.iosAppId || "";

const stringsPath = path.join(root, "android", "app", "src", "main", "res", "values", "strings.xml");
let strings = fs.readFileSync(stringsPath, "utf8");
const admobString = `    <string name="admob_app_id">${androidAppId}</string>\n`;
if(strings.includes('name="admob_app_id"')){
  strings = strings.replace(/<string name="admob_app_id">[^<]*<\/string>/, `<string name="admob_app_id">${androidAppId}</string>`);
}else{
  strings = strings.replace("</resources>", admobString + "</resources>");
}
fs.writeFileSync(stringsPath, strings);

const plistPath = path.join(root, "ios", "App", "App", "Info.plist");
let plist = fs.readFileSync(plistPath, "utf8");
const gad = `<key>GADApplicationIdentifier</key>\n\t<string>${iosAppId}</string>`;
if(plist.includes("<key>GADApplicationIdentifier</key>")){
  plist = plist.replace(/<key>GADApplicationIdentifier<\/key>\s*<string>[^<]*<\/string>/, gad);
}else{
  plist = plist.replace("</dict>\n</plist>", `\t${gad}\n</dict>\n</plist>`);
}
fs.writeFileSync(plistPath, plist);

const web = {
  useTestAds: !!cfg.useTestAds,
  admob: {
    androidAppId,
    iosAppId,
    rewardedAndroid: admob.rewardedAndroid || "",
    rewardedIos: admob.rewardedIos || "",
  },
};
const js = "/* store.config.json から生成。手で編集しない。 */\n"
  + "window.STORE_CONFIG = " + JSON.stringify(web, null, 2) + ";\n";
fs.writeFileSync(path.join(root, "www", "store.config.js"), js);
console.log("store.config.json を反映しました");
