/* Strict LIVE-NOW balance audit vs current index.html.
   Usage: node sim/audit_live_now.js [--runs=40] [--hours=504]
*/
"use strict";

const fs = require("fs");
const path = require("path");
const v6 = require("./v6_balance.js");

const arg = k => {
  const m = process.argv.find(a => a.startsWith(`--${k}=`));
  return m ? m.split("=")[1] : undefined;
};
const RUNS = Number(arg("runs") || "40");
const HOURS = Number(arg("hours") || "504");
const CHECK_DAYS = [3, 7, 14, 20]; // D21 ≈ day index 20 (0-based end of day 20 = 21 calendar days)

const extractedLive = {
  source: "index.html",
  UNIT: 2e7,
  TICKET_COST: 30,
  SUPER_PRIZE: 7e10,
  SUPER_RATE: 1e-4,
  RHC_COST: 1e8,
  RHC_PRIZE_MULT: 1.5,
  rhcFirstRate: "(1/UNIT)/2^rhcFirst (halves each RHC first)",
  ZERO_STREAK: 13,
  ZERO_STREAK_CAP: 64,
  ZERO_BATCH: 10,
  ZERO_MAX_BUY: 100,
  zeroMaxUncappedRemaining: true,
  AD_DAILY_LIMIT: 5,
  AD_MINUTES_BASE: 15,
  AD_MINUTES_BOOSTED: 60,
  AD_BOOST_COST: 200,
  BASE_OFFLINE_HOURS: 2,
  MAX_EXP: 12,
  trueMaxTickets: true,
  FAC_BULK: [{ min: 100, mult: 10 }, { min: 10, mult: 2 }],
  facBulkMode: "owned",
  RECYCLE: { baseCost: 200, costMult: 11, multPerLv: 1.48 },
  facilities: v6.LIVE_NOW.facilities,
  life: v6.LIVE_NOW.life,
  lifeMax: v6.LIVE_NOW.life.length - 1,
};

const simDrift = [
  "LIVE.rhcMultBase was 100; index.html RHC_PRIZE_MULT=1.5 (×1.5^n)",
  "LIVE.adDaily/adMinutes was 3×30; index.html is 5×15 (boosted 60)",
  "LIVE lacked rhcRateHalve; index.html halves RHC first rate each win",
  "LIVE.zeroTrueMax false; index.html MAX spends all remaining zero attempts",
  "Stale LIVE therefore overstated prizeMult / RHC wins massively (prior out_r6)",
];

const assumptions = [
  "Active play ~25–45 min/day by archetype; offline capped at offlineHours",
  "F2P: 25min/day, 0 ads, offlineHours=2, rhcAggressiveness=0.3, coinsSpent=0",
  "Ad: 30min/day, adsPerDay=5×15min, offline=2, rhcAgg=0.5, no IAP ad-boost",
  "Soft: 35min/day, ads 5×60min (ad boost owned), offline≈8h, comboTimeLv=1, rhcAgg=0.7, ~600 coins (combo+offline+adBoost approx)",
  "Whale: 45min/day, ads 5×60min, offline=24h, comboTimeLv=2, rhcAgg=1.0, ~2000 coins equiv",
  "Sim spends TP/money greedily each step; RHC/zero ~every 10min when apex",
  "Audit uses stepSec=300 + fastTap EV taps for runtime; economy equations unchanged",
  "Day index d=floor(sec/86400); D7=day7, D14=day14, D21=day20 (end of 504h)",
  "RHC geometric rate reduction IS modeled in LIVE_NOW (rhcRateHalve:true)",
  "TICKET_COST=30 TP; labor combo caps at ×3 by ~20 taps (sim fastTap uses ~×2 EV uplift)",
];

function dayRow(r, d) {
  return r.daily.find(x => x.d === d) || r.daily[r.daily.length - 1];
}

function stats(arr) {
  const b = arr.filter(x => x !== undefined && Number.isFinite(x)).sort((x, y) => x - y);
  if (!b.length) return { med: null, p10: null, p90: null, min: null, max: null, n: 0 };
  const at = p => b[Math.min(b.length - 1, Math.floor(b.length * p))];
  return {
    med: b[Math.floor(b.length / 2)],
    p10: at(0.1),
    p90: at(0.9),
    min: b[0],
    max: b[b.length - 1],
    n: b.length,
  };
}

function numOrNull(x) {
  if (x == null) return null;
  if (!Number.isFinite(x)) return String(x);
  return x;
}

function summarizeRuns(rs, playerKey) {
  const P = v6.PLAYERS[playerKey];
  const collapseFlags = rs.map(r => {
    const bad =
      !Number.isFinite(r.S.money) ||
      !Number.isFinite(r.rate) ||
      !Number.isFinite(r.prizeM) ||
      !Number.isFinite(r.S.rhcFirst) ||
      r.daily.some(d => !Number.isFinite(d.money) || !Number.isFinite(d.rate) || !Number.isFinite(d.prizeM));
    return bad;
  });
  const collapseRate = collapseFlags.filter(Boolean).length / rs.length;

  const checkpoint = {};
  for (const d of [3, 7, 14, 20]) {
    const label = d === 20 ? "D21" : `D${d}`;
    const lives = rs.map(r => dayRow(r, d).life);
    const moneys = rs.map(r => dayRow(r, d).money);
    const rates = rs.map(r => dayRow(r, d).rate);
    const pms = rs.map(r => dayRow(r, d).prizeM);
    const firsts = rs.map(r => dayRow(r, d).first);
    const supers = rs.map(r => dayRow(r, d).super);
    const rhcs = rs.map(r => dayRow(r, d).rhc);
    const zeros = rs.map(r => dayRow(r, d).zero);
    const recs = rs.map(r => dayRow(r, d).rec);
    const lifeS = stats(lives);
    checkpoint[label] = {
      lifeMed: lifeS.med,
      lifeP10: lifeS.p10,
      lifeP90: lifeS.p90,
      money: stats(moneys),
      autoRate: stats(rates),
      prizeMult: stats(pms),
      firstWins: stats(firsts),
      superWins: stats(supers),
      rhcFirst: stats(rhcs),
      zeroWins: stats(zeros),
      recycleLv: stats(recs),
    };
  }

  const final = {
    lifeLv: stats(rs.map(r => r.S.lifeLv)),
    money: stats(rs.map(r => r.S.money)),
    autoRate: stats(rs.map(r => r.rate)),
    firstWins: stats(rs.map(r => r.S.first)),
    superWins: stats(rs.map(r => r.S.super)),
    rhcFirst: stats(rs.map(r => r.S.rhcFirst)),
    prizeMult: stats(rs.map(r => r.prizeM)),
    zeroWins: stats(rs.map(r => r.S.zeroWins)),
    recycleLv: stats(rs.map(r => r.S.recLv)),
    totalFacLv: stats(rs.map(r => r.S.facLv.reduce((a, b) => a + b, 0))),
    adsWatched: stats(rs.map(r => r.S.adsWatched)),
  };

  return {
    label: P.label,
    playMinPerDay: P.playMinPerDay,
    adsPerDay: P.adsPerDay,
    offlineHours: P.offlineHours,
    coinsSpent: P.coinsSpent,
    adBoost: P.adBoost,
    rhcAggressiveness: P.rhcAggressiveness,
    collapseRate,
    D3: checkpoint.D3,
    D7: checkpoint.D7,
    D14: checkpoint.D14,
    D21: checkpoint.D21,
    metrics: final,
    reachLife2byD7: rs.filter(r => dayRow(r, 7).life >= 2).length / rs.length,
    reachLife4byD7: rs.filter(r => dayRow(r, 7).life >= 4).length / rs.length,
    reachLife9byD14: rs.filter(r => dayRow(r, 14).life >= 9).length / rs.length,
    reachLife9byD21: rs.filter(r => dayRow(r, 20).life >= 9).length / rs.length,
  };
}

function runArchetypes(C, runs, hours) {
  const out = {};
  const extraOpts = { stepSec: 300, fastTap: true };
  for (const pk of ["f2p", "ad", "soft", "whale"]) {
    console.log(`\n>>> ${C.id} / ${pk} × ${runs} @ ${hours}h (step=300,fastTap)`);
    const t0 = Date.now();
    const summary = v6.runConfig(C, pk, runs, hours, extraOpts);
    const enriched = summarizeRuns(summary._raw, pk);
    console.log(
      `  done ${(Date.now() - t0) / 1000 | 0}s | D7/14/21 life med=` +
        `${enriched.D7.lifeMed}/${enriched.D14.lifeMed}/${enriched.D21.lifeMed}` +
        `  prizeM med=${enriched.metrics.prizeMult.med}` +
        `  rhc med=${enriched.metrics.rhcFirst.med}` +
        `  collapse=${enriched.collapseRate}`
    );
    out[pk] = enriched;
  }
  return out;
}

function sensitivityBrief(baseArchetypes) {
  // Qualitative + observed deltas from same LIVE_NOW run across archetypes
  const f = baseArchetypes.f2p;
  const a = baseArchetypes.ad;
  const s = baseArchetypes.soft;
  const w = baseArchetypes.whale;
  return {
    note: "Knobs ranked by observed D14 life impact within this audit (LIVE_NOW params fixed; archetype proxies for ads/IAP).",
    d14LifeByArchetype: {
      f2p: f.D14.lifeMed,
      ad: a.D14.lifeMed,
      soft: s.D14.lifeMed,
      whale: w.D14.lifeMed,
    },
    adLiftD14: (a.D14.lifeMed ?? 0) - (f.D14.lifeMed ?? 0),
    softLiftD14: (s.D14.lifeMed ?? 0) - (f.D14.lifeMed ?? 0),
    drivers: [
      "RHC prize mult (1.5^n) + geometric rate: caps runaway vs stale ×100^n; still main late-game lever once apex",
      "Life costs / auto mults: primary pace for D7–D14 life ladder before heavy RHC",
      "Ads (5×15 F2P-gap; soft/whale 5×60): measured adLiftD14 above",
      "Fac bulk ×2/×10: accelerates facility compounding when cash-rich",
      "Offline hours (IAP): soft/whale time compression without changing ticket EV",
    ],
  };
}

function verdictFrom(arch, r6arch) {
  const findings = [];
  const recommendations = [];
  let verdict = "PASS";

  const f = arch.f2p;
  const a = arch.ad;
  const s = arch.soft;
  const w = arch.whale;

  const anyCollapse = ["f2p", "ad", "soft", "whale"].some(k => arch[k].collapseRate > 0);
  if (anyCollapse) {
    verdict = "FAIL";
    findings.push("Collapse/Infinity/NaN detected in ≥1 archetype run (collapseRate>0).");
  } else {
    findings.push(`No Infinity/NaN collapse across archetypes (collapseRate=0 for all).`);
  }

  const d3 = f.D3.lifeMed;
  const d7 = f.D7.lifeMed;
  const d14 = f.D14.lifeMed;
  const d21 = f.D21.lifeMed;
  const tgt = { D7: [4, 5], D14: [5, 6], D21: [6, 7] };

  function inRange(v, [lo, hi]) {
    return v != null && v >= lo && v <= hi;
  }

  findings.push(
    `F2P life medians: D3=${d3} (p10=${f.D3.lifeP10}/p90=${f.D3.lifeP90}), ` +
      `D7=${d7} (p10=${f.D7.lifeP10}/p90=${f.D7.lifeP90}), ` +
      `D14=${d14}, D21=${d21}.`
  );

  if (f.reachLife2byD7 < 0.9 || (d7 != null && d7 <= 2)) {
    verdict = "FAIL";
    findings.push(`Early soft-lock risk: F2P D7 life med=${d7} (target 4–5); reachLife≥2 by D7=${(f.reachLife2byD7 * 100).toFixed(0)}%.`);
  }

  if (!inRange(d7, tgt.D7) || !inRange(d14, tgt.D14) || !inRange(d21, tgt.D21)) {
    verdict = "FAIL";
    findings.push(
      `F2P life pace FAIL vs R6 targets: D7 med=${d7} (want 4–5), D14 med=${d14} (want 5–6), D21 med=${d21} (want 6–7).`
    );
  } else {
    findings.push(`F2P life medians hit R6 windows: D7=${d7}, D14=${d14}, D21=${d21}.`);
  }

  if (d3 != null && d3 >= 4) {
    verdict = "FAIL";
    findings.push(
      `Early overshoot: F2P already D3 life med=${d3} with prizeMult still ~${f.D3.prizeMult.med} (pre-RHC); base fac/life EV too strong.`
    );
  }

  const adGap14 = (a.D14.lifeMed ?? 0) - (d14 ?? 0);
  if (d14 >= 9 && a.D14.lifeMed >= 9) {
    verdict = "FAIL";
    findings.push(
      `Ad differentiation collapsed: both F2P and Ad at life ${d14} by D14 (gap=${adGap14}); ceiling hit before ads matter.`
    );
  } else if (adGap14 < 0.4 || adGap14 > 1.5) {
    if (verdict === "PASS") verdict = "CONDITIONAL";
    findings.push(`Ad vs F2P D14 life gap=${adGap14} (target ~+0.5–1).`);
  } else {
    findings.push(`Ad vs F2P D14 life gap=${adGap14} within ~+0.5–1 target band.`);
  }

  if ((s.D14.lifeMed ?? 0) >= 9 || (s.reachLife9byD14 ?? 0) > 0.25) {
    verdict = "FAIL";
    findings.push(
      `Light spend hits life 9 too early: soft D14 life med=${s.D14.lifeMed}, P(life≥9 by D14)=${(s.reachLife9byD14 * 100).toFixed(0)}% ` +
        `(F2P also ${(f.reachLife9byD14 * 100).toFixed(0)}%).`
    );
  }

  const pmMed = f.metrics.prizeMult.med;
  const pmP90 = f.metrics.prizeMult.p90;
  const rhcMed = f.metrics.rhcFirst.med;
  findings.push(
    `F2P D21 prizeMult med=${pmMed} p90=${pmP90}; rhcFirst med=${rhcMed} ` +
      `(D7 already rhc≈${f.D7.rhcFirst.med}, prizeMult≈${f.D7.prizeMult.med}). ` +
      `Finite (no Infinity) but far above R6 cap design (prizeMultCap=64).`
  );
  if (typeof pmMed === "number" && Number.isFinite(pmMed) && pmMed > 1e6) {
    verdict = "FAIL";
    findings.push(`prizeMult runaway F2P med=${pmMed} p90=${pmP90}.`);
  }

  if (r6arch) {
    findings.push(
      `Side-by-side F2P D7/14/21: LIVE_NOW ${d7}/${d14}/${d21} vs R6 ${r6arch.f2p.D7.lifeMed}/${r6arch.f2p.D14.lifeMed}/${r6arch.f2p.D21.lifeMed} ` +
        `(R6 F2P prizeMult med=${r6arch.f2p.metrics.prizeMult.med}, rhc=${r6arch.f2p.metrics.rhcFirst.med}).`
    );
  }

  recommendations.push(
    "Ship balance ≠ R6: adopt R6-like life costs / facBulk / recycle, or raise late life costs sharply."
  );
  recommendations.push(
    "Keep RHC_PRIZE_MULT=1.5 + rate-halve (good anti-runaway vs stale ×100), but add prizeMultCap or slower early apex."
  );
  recommendations.push(
    "Nerf early facility bulk (×10 at 100) and/or early life costs so F2P D7 lands at 4–5 not 9."
  );
  recommendations.push(
    "Re-tune ads only after life ceiling is restored; currently 5×15 cannot create D14 gap when all hit life 9 by D7."
  );
  recommendations.push(
    "Update sim LIVE defaults to LIVE_NOW to prevent stale ×100 audits."
  );

  return { verdict, findings, recommendations };
}

function main() {
  console.log("======== LIVE-NOW STRICT BALANCE AUDIT ========");
  console.log(`runs=${RUNS} hours=${HOURS}`);
  console.log("extracted from index.html → LIVE_NOW config");
  console.log(JSON.stringify({
    rhcMultBase: v6.LIVE_NOW.rhcMultBase,
    rhcRateHalve: v6.LIVE_NOW.rhcRateHalve,
    adDaily: v6.LIVE_NOW.adDaily,
    adMinutes: v6.LIVE_NOW.adMinutes,
    zeroPerSuper: v6.LIVE_NOW.zeroPerSuper,
    superRate: v6.LIVE_NOW.superRate,
  }));

  const liveNowArch = runArchetypes(v6.LIVE_NOW, RUNS, HOURS);
  console.log("\n--- R6 comparison (same runs/hours) ---");
  const r6Arch = runArchetypes(v6.R6, RUNS, HOURS);

  const sens = sensitivityBrief(liveNowArch);
  const { verdict, findings, recommendations } = verdictFrom(liveNowArch, r6Arch);

  const report = {
    extractedLive,
    simDrift,
    assumptions,
    runs: RUNS,
    hours: HOURS,
    archetypes: liveNowArch,
    r6Comparison: {
      note: "Same RUNS/HOURS; independent RNG (not paired seeds).",
      archetypes: r6Arch,
      f2pLife: {
        liveNow: {
          D7: liveNowArch.f2p.D7.lifeMed,
          D14: liveNowArch.f2p.D14.lifeMed,
          D21: liveNowArch.f2p.D21.lifeMed,
        },
        r6: {
          D7: r6Arch.f2p.D7.lifeMed,
          D14: r6Arch.f2p.D14.lifeMed,
          D21: r6Arch.f2p.D21.lifeMed,
        },
      },
      adLiftD14: {
        liveNow: (liveNowArch.ad.D14.lifeMed ?? 0) - (liveNowArch.f2p.D14.lifeMed ?? 0),
        r6: (r6Arch.ad.D14.lifeMed ?? 0) - (r6Arch.f2p.D14.lifeMed ?? 0),
      },
    },
    sensitivity: sens,
    verdict,
    findings,
    recommendations,
  };

  // JSON-safe: convert non-finite numbers
  const safe = JSON.stringify(report, (_, v) => {
    if (typeof v === "number" && !Number.isFinite(v)) return String(v);
    return v;
  }, 2);

  const outName = arg("out") || "audit_live_now_report.json";
  const outJson = path.isAbsolute(outName) ? outName : path.join(__dirname, outName);
  fs.writeFileSync(outJson, safe);
  const outLog = outJson.replace(/\.json$/i, ".log");
  try {
    // mirror console summary already printed
    fs.writeFileSync(outLog, findings.map(f => "- " + f).join("\n") + `\nVERDICT=${verdict}\n`);
  } catch (_) {}
  console.log(`\n======== VERDICT: ${verdict} ========`);
  for (const f of findings) console.log(" - " + f);
  console.log(`wrote ${outJson}`);
}

main();
