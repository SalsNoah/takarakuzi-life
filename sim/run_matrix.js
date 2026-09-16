/* Monetization × engagement matrix for LIVE_NOW
   Usage: node sim/run_matrix.js [--runs=16] [--days=180]
*/
"use strict";

const fs = require("fs");
const path = require("path");
const v6 = require("./v6_balance.js");

const arg = k => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split("=")[1] : undefined;
};
const RUNS = Number(arg("runs") || "16");
const DAYS = Number(arg("days") || "180");
const HOURS = DAYS * 24;
const C = v6.LIVE_NOW;
const NAMES = v6.LIFE_NAMES;
const LIFE_MAX = C.life.length - 1;

const PAY = {
  f2p:  { label:"無課金", adsPerDay:0,  adBoost:false, offlineHours:2,  comboTimeLv:0, rhcAgg:0.3, coins:0 },
  ad:   { label:"広告",   adsPerDay:5,  adBoost:false, offlineHours:2,  comboTimeLv:0, rhcAgg:0.5, coins:0 },
  soft: { label:"軽課金", adsPerDay:5,  adBoost:true,  offlineHours:8,  comboTimeLv:1, rhcAgg:0.7, coins:600 },
  whale:{ label:"重課金", adsPerDay:5,  adBoost:true,  offlineHours:24, comboTimeLv:2, rhcAgg:1.0, coins:2000 },
};
const ENGAGE = {
  light: { label:"ライト", playMinPerDay:15 },
  mid:   { label:"標準",   playMinPerDay:30 },
  deep:  { label:"やり込み", playMinPerDay:60 },
  hard:  { label:"ガチ",   playMinPerDay:90 },
};

function med(a) {
  const b = a.filter(x => x !== undefined && Number.isFinite(x)).sort((x, y) => x - y);
  return b.length ? b[Math.floor(b.length / 2)] : undefined;
}
function fmtT(s) {
  if (s === undefined) return "—";
  const h = Math.floor(s / 3600), d = Math.floor(h / 24);
  if (d > 0) return `${d}日`;
  if (h > 0) return `${h}時間`;
  return `${Math.floor(s / 60)}分`;
}
function dayAt(rs, d) {
  const rows = rs.map(r => r.daily.find(x => x.d === d) || r.daily[r.daily.length - 1]);
  return {
    life: med(rows.map(x => x.life)),
    prizeM: med(rows.map(x => x.prizeM)),
    rhc: med(rows.map(x => x.rhc)),
  };
}

function runCell(payKey, engKey) {
  const P = PAY[payKey], E = ENGAGE[engKey];
  const adMin = P.adBoost && C.adMinutesBoosted != null ? C.adMinutesBoosted : C.adMinutes;
  const rs = [];
  for (let i = 0; i < RUNS; i++) {
    rs.push(
      v6.simulate(C, {
        hours: HOURS,
        playMinPerDay: E.playMinPerDay,
        comboTimeLv: P.comboTimeLv,
        offlineHours: P.offlineHours,
        adsPerDay: P.adsPerDay,
        adMinutes: adMin,
        rhcAggressiveness: P.rhcAgg,
        player: payKey,
        fastTap: true,
        stepSec: 600,
      })
    );
  }
  const reach = lv => {
    const secs = rs.map(r => r.marks["life" + lv]).filter(x => x !== undefined);
    return {
      rate: secs.length / rs.length,
      medDay: med(secs) !== undefined ? +(med(secs) / 86400).toFixed(1) : null,
      medLabel: fmtT(med(secs)),
    };
  };
  return {
    pay: payKey,
    payLabel: P.label,
    eng: engKey,
    engLabel: E.label,
    playMin: E.playMinPerDay,
    D7: dayAt(rs, 7).life,
    D14: dayAt(rs, 14).life,
    D21: dayAt(rs, 20).life,
    D60: dayAt(rs, 59).life,
    D90: dayAt(rs, 89).life,
    D180: dayAt(rs, Math.min(179, DAYS - 1)).life,
    final: med(rs.map(r => r.S.lifeLv)),
    galaxy: reach(9),
    parallel: reach(10),
    bug: reach(11),
    nameFinal: NAMES[med(rs.map(r => r.S.lifeLv))] || String(med(rs.map(r => r.S.lifeLv))),
  };
}

console.log(`======== MATRIX pay × engagement ========`);
console.log(`LIVE_NOW runs=${RUNS} days=${DAYS} lifeMax=${LIFE_MAX} (${NAMES[LIFE_MAX]})\n`);

const cells = [];
const grid = {};
for (const pay of Object.keys(PAY)) {
  grid[pay] = {};
  for (const eng of Object.keys(ENGAGE)) {
    process.stdout.write(`>>> ${PAY[pay].label} × ${ENGAGE[eng].label} (${ENGAGE[eng].playMinPerDay}分)... `);
    const t0 = Date.now();
    const cell = runCell(pay, eng);
    grid[pay][eng] = cell;
    cells.push(cell);
    console.log(
      `D7/14/21=${cell.D7}/${cell.D14}/${cell.D21} final=${cell.final}(${cell.nameFinal}) ` +
        `パラレル=${cell.parallel.medLabel} バグ空間=${cell.bug.medLabel} (${((Date.now() - t0) / 1000).toFixed(1)}s)`
    );
  }
}

function matrix(field) {
  const rows = [];
  for (const pay of Object.keys(PAY)) {
    const row = { pay: PAY[pay].label };
    for (const eng of Object.keys(ENGAGE)) {
      const c = grid[pay][eng];
      row[eng] = typeof field === "function" ? field(c) : c[field];
    }
    rows.push(row);
  }
  return rows;
}

const report = {
  config: "LIVE_NOW",
  runs: RUNS,
  days: DAYS,
  lifeNames: NAMES,
  pay: Object.fromEntries(Object.entries(PAY).map(([k, v]) => [k, v.label])),
  engage: Object.fromEntries(
    Object.entries(ENGAGE).map(([k, v]) => [k, { label: v.label, playMinPerDay: v.playMinPerDay }])
  ),
  cells,
  matrices: {
    lifeD7: matrix("D7"),
    lifeD14: matrix("D14"),
    lifeD21: matrix("D21"),
    lifeD90: matrix("D90"),
    lifeD180: matrix("D180"),
    lifeFinal: matrix(c => `${c.final} ${c.nameFinal}`),
    daysToParallel: matrix(c => c.parallel.medLabel),
    daysToBugSpace: matrix(c => c.bug.medLabel),
    reachBugRate: matrix(c => Math.round(c.bug.rate * 100) + "%"),
  },
};

const outPath = path.join(__dirname, "audit_matrix_report.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(report, (_, v) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v), 2)
);

console.log("\n--- D21 life ---");
for (const r of report.matrices.lifeD21) {
  console.log(
    `${r.pay}\tライト${r.light}\t標準${r.mid}\tやり込み${r.deep}\tガチ${r.hard}`
  );
}
console.log("\n--- パラレル到達 ---");
for (const r of report.matrices.daysToParallel) {
  console.log(
    `${r.pay}\tライト${r.light}\t標準${r.mid}\tやり込み${r.deep}\tガチ${r.hard}`
  );
}
console.log("\n--- バグ空間到達 ---");
for (const r of report.matrices.daysToBugSpace) {
  console.log(
    `${r.pay}\tライト${r.light}\t標準${r.mid}\tやり込み${r.deep}\tガチ${r.hard}`
  );
}
console.log(`\nwrote ${outPath}`);
