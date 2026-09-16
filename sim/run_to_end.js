/* Run LIVE_NOW to endgame (final life) or horizon.
   Usage: node sim/run_to_end.js [--runs=24] [--days=180]
*/
"use strict";

const fs = require("fs");
const path = require("path");
const v6 = require("./v6_balance.js");

const arg = k => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split("=")[1] : undefined;
};
const RUNS = Number(arg("runs") || "24");
const DAYS = Number(arg("days") || "180");
const HOURS = DAYS * 24;
const C = v6.LIVE_NOW;
const LIFE_MAX = C.life.length - 1;
const NAMES = v6.LIFE_NAMES;

function med(a) {
  const b = a.filter(x => x !== undefined && Number.isFinite(x)).sort((x, y) => x - y);
  if (!b.length) return undefined;
  return b[Math.floor(b.length / 2)];
}
function fmtT(s) {
  if (s === undefined) return "—";
  const h = Math.floor(s / 3600), d = Math.floor(h / 24);
  if (d > 0) return `${d}日${h % 24}時間`;
  if (h > 0) return `${h}時間`;
  return `${Math.floor(s / 60)}分`;
}
function dayOf(sec) {
  if (sec === undefined) return null;
  return +(sec / 86400).toFixed(1);
}

function runPlayer(pk) {
  const P = v6.PLAYERS[pk];
  const adMin = P.adBoost && C.adMinutesBoosted != null ? C.adMinutesBoosted : C.adMinutes;
  const opts = {
    hours: HOURS,
    playMinPerDay: P.playMinPerDay,
    comboTimeLv: P.comboTimeLv,
    offlineHours: P.offlineHours ?? C.offlineHours,
    adsPerDay: P.adsPerDay == null ? C.adDaily : P.adsPerDay,
    adMinutes: adMin,
    rhcAggressiveness: P.rhcAggressiveness,
    player: pk,
    fastTap: true,
    stepSec: 600,
  };
  const rs = [];
  const t0 = Date.now();
  for (let i = 0; i < RUNS; i++) rs.push(v6.simulate(C, opts));
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const lifeReach = {};
  for (let lv = 1; lv <= LIFE_MAX; lv++) {
    const secs = rs.map(r => r.marks["life" + lv]).filter(x => x !== undefined);
    lifeReach[lv] = {
      name: NAMES[lv] || `life${lv}`,
      rate: secs.length / rs.length,
      medSec: med(secs),
      medDay: dayOf(med(secs)),
      medLabel: fmtT(med(secs)),
    };
  }

  const finals = rs.map(r => r.S.lifeLv);
  const lifeFinal = med(finals);
  const atMax = finals.filter(l => l >= LIFE_MAX).length / rs.length;
  const last = rs.map(r => r.daily[r.daily.length - 1]);

  // Checkpoint medians
  const atDay = d => {
    const rows = rs.map(r => r.daily.find(x => x.d === d) || r.daily[r.daily.length - 1]);
    return {
      life: med(rows.map(x => x.life)),
      prizeM: med(rows.map(x => x.prizeM)),
      rhc: med(rows.map(x => x.rhc)),
    };
  };

  const checkpoints = {};
  for (const d of [7, 14, 21, 42, 60, 90, 120, 150, DAYS - 1]) {
    if (d < DAYS) checkpoints[`D${d === DAYS - 1 ? DAYS : d}`] = atDay(Math.min(d, DAYS - 1));
  }

  return {
    player: pk,
    label: P.label,
    elapsedSec: +elapsed,
    lifeFinal,
    atMaxRate: atMax,
    lifeReach,
    checkpoints,
    final: {
      life: lifeFinal,
      prizeM: med(last.map(x => x.prizeM)),
      rhc: med(last.map(x => x.rhc)),
      zero: med(rs.map(r => r.S.zeroWins)),
      money: med(last.map(x => x.money)),
      rate: med(last.map(x => x.rate)),
    },
  };
}

console.log(`======== LIVE_NOW TO END ========`);
console.log(`runs=${RUNS} days=${DAYS}h=${HOURS} lifeMax=${LIFE_MAX} (${NAMES[LIFE_MAX]})`);
console.log(`fac0base=${C.facilities[0].base} rhcDiv=${C.rhcRateDiv || 2} ticket=${v6.TICKET_COST}\n`);

const out = {
  config: "LIVE_NOW",
  runs: RUNS,
  days: DAYS,
  hours: HOURS,
  lifeMax: LIFE_MAX,
  lifeNames: NAMES,
  archetypes: {},
};

for (const pk of ["f2p", "ad", "soft", "whale"]) {
  console.log(`>>> ${pk}`);
  const r = runPlayer(pk);
  out.archetypes[pk] = r;
  console.log(`  final life med=${r.lifeFinal}  reachMax=${(r.atMaxRate * 100).toFixed(0)}%  (${r.elapsedSec}s)`);
  for (let lv = 1; lv <= LIFE_MAX; lv++) {
    const x = r.lifeReach[lv];
    console.log(`  life${lv} ${x.name}: ${(x.rate * 100).toFixed(0)}% @ ${x.medLabel}`);
  }
  const c = r.checkpoints;
  const keys = Object.keys(c);
  console.log(
    "  pace " +
      keys
        .map(k => `${k}=${c[k].life}`)
        .join(" ")
  );
  console.log("");
}

const outPath = path.join(__dirname, "audit_to_end_report.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(out, (_, v) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v), 2)
);
console.log(`wrote ${outPath}`);
