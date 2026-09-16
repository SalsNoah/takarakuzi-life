#!/usr/bin/env node
/* www/ が Capcitor の webDir。追加ビルド工程は現状なし。 */
const fs = require("fs");
const path = require("path");
const www = path.join(__dirname, "..", "www", "index.html");
if(!fs.existsSync(www)){
  console.error("www/index.html が見つかりません");
  process.exit(1);
}
console.log("www/index.html OK");
