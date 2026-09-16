"use strict";
/**
 * Strict verification of 零等 (zero challenge) boost / spend / UI changes in index.html.
 */
const fs = require("fs");
const path = require("path");

const INDEX = path.join(__dirname, "..", "index.html");
const OUT = path.join(__dirname, "zero_boost_verify.json");
const src = fs.readFileSync(INDEX, "utf8");

const checks = [];
const failures = [];

function check(id, ok, detail) {
  checks.push({ id, ok: !!ok, detail: String(detail) });
  if (!ok) failures.push(`${id}: ${detail}`);
}

function countDef(name) {
  const re = new RegExp(
    "(?:^|\\n)\\s*function\\s+" + name + "\\s*\\(",
    "g"
  );
  return (src.match(re) || []).length;
}

function extractConst(name) {
  const m = src.match(new RegExp("const\\s+" + name + "\\s*=\\s*([^;]+);"));
  return m ? m[1].trim() : null;
}

/* ---------- Spec constants from file ---------- */
const ZERO_MAX_BUY = Number(extractConst("ZERO_MAX_BUY"));
const ZERO_COST_BASE = Number(extractConst("ZERO_COST_BASE"));
const ZERO_STREAK = Number(extractConst("ZERO_STREAK"));
const ZERO_BOOST_MAX_EXP = Number(extractConst("ZERO_BOOST_MAX_EXP"));
const ZERO_SKIP_PER_BOOST = Number(extractConst("ZERO_SKIP_PER_BOOST"));

/* Reimplement formulas (mirror index.html) */
function zeroCostPerAttempt(exp) {
  return ZERO_COST_BASE * Math.pow(10, exp);
}
function zeroSkipStreak(exp) {
  return ZERO_SKIP_PER_BOOST * exp;
}
function zeroBoostMult(exp) {
  return Math.pow(10, exp);
}
function zeroAttemptsLeft(superWins, zeroSpentSuper, exp) {
  const cost = zeroCostPerAttempt(exp);
  if (!(cost > 0)) return 0;
  const pool = Math.max(0, (superWins || 0) - (zeroSpentSuper || 0));
  return Math.floor(pool / cost);
}
function zeroPlanCount(left, zeroAmt) {
  if (left <= 0) return 0;
  if (zeroAmt === "max") return Math.min(left, ZERO_MAX_BUY);
  const want = Math.max(1, +zeroAmt || 1);
  return Math.min(left, want, ZERO_MAX_BUY);
}

/* Deterministic resolveZeroSilent with injected RNG for streak start */
function resolveZeroSilent(startStreak, rng, streakCap, winStreak) {
  let streak = Math.max(0, Math.min(streakCap, startStreak | 0));
  while (streak < streakCap && rng() < 0.5) streak++;
  return { streak, win: streak >= winStreak };
}

/* ===================== CHECKS ===================== */

/* 1. ZERO_MAX_BUY === 10000; MAX capped at 10000 */
check(
  "ZERO_MAX_BUY_10000",
  ZERO_MAX_BUY === 10000,
  `ZERO_MAX_BUY = ${extractConst("ZERO_MAX_BUY")}`
);

check(
  "zeroPlanCount_max_capped",
  /if\s*\(\s*S\.zeroAmt\s*===\s*"max"\s*\)\s*return\s*Math\.min\(\s*left\s*,\s*ZERO_MAX_BUY\s*\)/.test(src),
  "zeroPlanCount: max → Math.min(left, ZERO_MAX_BUY)"
);

check(
  "zeroPlanCount_want_capped",
  /return\s*Math\.min\(\s*left\s*,\s*want\s*,\s*ZERO_MAX_BUY\s*\)/.test(src),
  "zeroPlanCount: Math.min(left, want, ZERO_MAX_BUY)"
);

const planMax = zeroPlanCount(50000, "max");
const planWant = zeroPlanCount(50000, 10000);
const planOver = zeroPlanCount(50000, 99999);
check(
  "runtime_MAX_cap_10000",
  planMax === 10000 && planWant === 10000 && planOver === 10000,
  `max→${planMax}, want10000→${planWant}, want99999→${planOver}`
);

/* 2. ZERO_COST_BASE === 10 */
check(
  "ZERO_COST_BASE_10",
  ZERO_COST_BASE === 10,
  `ZERO_COST_BASE = ${extractConst("ZERO_COST_BASE")}`
);

check(
  "zeroCostPerAttempt_formula",
  /function\s+zeroCostPerAttempt\s*\(\s*\)\s*\{\s*return\s+ZERO_COST_BASE\s*\*\s*Math\.pow\(\s*10\s*,\s*getZeroBoostExp\(\)\s*\)\s*;?\s*\}/.test(src),
  "cost = ZERO_COST_BASE * 10^exp"
);

/* 3. Boost exp 0..12 */
check(
  "ZERO_BOOST_MAX_EXP_12",
  ZERO_BOOST_MAX_EXP === 12,
  `ZERO_BOOST_MAX_EXP = ${extractConst("ZERO_BOOST_MAX_EXP")}`
);

check(
  "ZERO_SKIP_PER_BOOST_3",
  ZERO_SKIP_PER_BOOST === 3,
  `ZERO_SKIP_PER_BOOST = ${extractConst("ZERO_SKIP_PER_BOOST")}`
);

check(
  "zeroSkipStreak_formula",
  /function\s+zeroSkipStreak\s*\(\s*\)\s*\{\s*return\s+ZERO_SKIP_PER_BOOST\s*\*\s*getZeroBoostExp\(\)\s*;?\s*\}/.test(src),
  "skip = ZERO_SKIP_PER_BOOST * exp"
);

const boostCases = [];
for (let exp = 0; exp <= 12; exp++) {
  const cost = zeroCostPerAttempt(exp);
  const skip = zeroSkipStreak(exp);
  const mult = zeroBoostMult(exp);
  const expectCost = 10 * Math.pow(10, exp);
  const expectSkip = 3 * exp;
  const expectMult = Math.pow(10, exp);
  const ok = cost === expectCost && skip === expectSkip && mult === expectMult;
  boostCases.push({ exp, cost, skip, mult, ok });
}
check(
  "boost_exp_0_to_12_formulas",
  boostCases.every((c) => c.ok),
  boostCases
    .map((c) => `e${c.exp}:cost=${c.cost},skip=${c.skip},×${c.mult}${c.ok ? "" : " FAIL"}`)
    .join("; ")
);

check(
  "boost_exp1_x10_cost100_skip3",
  zeroCostPerAttempt(1) === 100 &&
    zeroSkipStreak(1) === 3 &&
    zeroBoostMult(1) === 10,
  `exp1: cost=${zeroCostPerAttempt(1)}, skip=${zeroSkipStreak(1)}, mult=${zeroBoostMult(1)}`
);

check(
  "boost_exp12_x1e12_cost1e13_skip36",
  zeroCostPerAttempt(12) === 1e13 &&
    zeroSkipStreak(12) === 36 &&
    zeroBoostMult(12) === 1e12,
  `exp12: cost=${zeroCostPerAttempt(12)}, skip=${zeroSkipStreak(12)}, mult=${zeroBoostMult(12)}`
);

/* UI generates boost buttons 0..12 */
check(
  "boost_buttons_0_to_max",
  /Array\.from\(\s*\{\s*length:\s*ZERO_BOOST_MAX_EXP\s*\+\s*1\s*\}/.test(src) &&
    /data-zero-boost="\$\{e\}"/.test(src),
  "boostHtml: Array.from({length: ZERO_BOOST_MAX_EXP+1}) with data-zero-boost"
);

/* 4. resolveZeroSilent / animateZeroCell start with skip streak; win if streak >= ZERO_STREAK */
check(
  "ZERO_STREAK_13",
  ZERO_STREAK === 13,
  `ZERO_STREAK = ${extractConst("ZERO_STREAK")}`
);

check(
  "resolveZeroSilent_startStreak",
  /function\s+resolveZeroSilent\s*\(\s*startStreak\s*\)\s*\{[\s\S]*?let\s+streak\s*=\s*Math\.max\(\s*0\s*,\s*Math\.min\(\s*ZERO_STREAK_CAP\s*,\s*startStreak\s*\|\s*0\s*\)\s*\)/.test(
    src
  ),
  "resolveZeroSilent(startStreak) initializes streak from startStreak"
);

check(
  "resolveZeroSilent_win_ge_ZERO_STREAK",
  /function\s+resolveZeroSilent\s*\([\s\S]*?return\s*\{\s*streak\s*,\s*win:\s*streak\s*>=\s*ZERO_STREAK\s*\}/.test(
    src
  ),
  "win: streak >= ZERO_STREAK"
);

check(
  "animateZeroCell_startStreak",
  /async\s+function\s+animateZeroCell\s*\(\s*cell\s*,\s*idx\s*,\s*startStreak\s*\)/.test(src) &&
    /let\s+streak\s*=\s*start\s*;/.test(src) &&
    /let\s+won\s*=\s*streak\s*>=\s*ZERO_STREAK/.test(src),
  "animateZeroCell(cell, idx, startStreak); streak=start; won = streak >= ZERO_STREAK"
);

check(
  "runZeroBatch_passes_skip_streak",
  /const\s+startStreak\s*=\s*zeroSkipStreak\s*\(\s*\)/.test(src) &&
    /animateZeroCell\(\s*cell\s*,\s*i\s*,\s*startStreak\s*\)/.test(src) &&
    /resolveZeroSilent\(\s*startStreak\s*\)/.test(src),
  "runZeroBatch: startStreak=zeroSkipStreak(); passed to animate/resolve"
);

/* Runtime: start with skip=36 (exp12), immediate win if no more flips needed when streak already >= 13 */
{
  // Force all fail after start → streak stays at start
  const rFail = resolveZeroSilent(36, () => 1, 64, 13);
  check(
    "runtime_skip36_already_win",
    rFail.win === true && rFail.streak === 36,
    `start36 + always-fail RNG → streak=${rFail.streak}, win=${rFail.win}`
  );
  // start 0, win first 13 flips
  let n = 0;
  const rWin = resolveZeroSilent(0, () => (n++ < 13 ? 0 : 1), 64, 13);
  check(
    "runtime_from0_13wins",
    rWin.win === true && rWin.streak === 13,
    `start0 + 13 heads → streak=${rWin.streak}, win=${rWin.win}`
  );
  // start 3 (exp1), need 10 more to reach 13
  n = 0;
  const rSkip3 = resolveZeroSilent(3, () => (n++ < 10 ? 0 : 1), 64, 13);
  check(
    "runtime_start3_need10_more",
    rSkip3.win === true && rSkip3.streak === 13,
    `start3 + 10 heads → streak=${rSkip3.streak}, win=${rSkip3.win}`
  );
}

/* 5. Spending uses zeroSpentSuper; attempts = floor((superWins - zeroSpentSuper) / cost) */
check(
  "state_has_zeroSpentSuper",
  /zeroSpentSuper\s*:\s*0/.test(src),
  "S default includes zeroSpentSuper:0"
);

check(
  "zeroAttemptsLeft_uses_zeroSpentSuper",
  /function\s+zeroAttemptsLeft\s*\(\s*\)\s*\{[\s\S]*?S\.superWins[\s\S]*?S\.zeroSpentSuper[\s\S]*?Math\.floor\(\s*pool\s*\/\s*cost\s*\)/.test(
    src
  ),
  "attempts = floor((superWins - zeroSpentSuper) / cost)"
);

check(
  "zeroAttemptsLeft_not_zeroUsed_div10_only",
  !/function\s+zeroAttemptsLeft\s*\(\s*\)\s*\{[^}]*zeroUsed\s*\/\s*10/.test(src) &&
    !/function\s+zeroAttemptsLeft\s*\(\s*\)\s*\{[^}]*Math\.floor\(\s*\(?\s*S\.superWins[^)]*zeroUsed/.test(
      src
    ),
  "zeroAttemptsLeft does not use zeroUsed/10 as spend pool"
);

check(
  "runZeroBatch_charges_zeroSpentSuper",
  /S\.zeroSpentSuper\s*=\s*\(S\.zeroSpentSuper\s*\|\|\s*0\)\s*\+\s*totalCost/.test(src),
  "runZeroBatch: S.zeroSpentSuper += totalCost"
);

check(
  "runtime_attempts_left_formula",
  (() => {
    // superWins=10000, spent=0, exp=0 cost=10 → 1000
    const a0 = zeroAttemptsLeft(10000, 0, 0);
    // spent=5000 → pool=5000 → 500
    const a1 = zeroAttemptsLeft(10000, 5000, 0);
    // exp=1 cost=100 → floor(5000/100)=50
    const a2 = zeroAttemptsLeft(10000, 5000, 1);
    // zeroUsed-style wrong formula would be floor((10000-used)/10); ensure spent path
    const a3 = zeroAttemptsLeft(100, 0, 12); // cost 1e13 → 0
    const ok = a0 === 1000 && a1 === 500 && a2 === 50 && a3 === 0;
    return {
      ok,
      detail: `a0=${a0}(exp1000), a1=${a1}(500), a2=${a2}(50), a3=${a3}(0)`,
    };
  })().ok,
  (() => {
    const a0 = zeroAttemptsLeft(10000, 0, 0);
    const a1 = zeroAttemptsLeft(10000, 5000, 0);
    const a2 = zeroAttemptsLeft(10000, 5000, 1);
    const a3 = zeroAttemptsLeft(100, 0, 12);
    return `a0=${a0}, a1=${a1}, a2=${a2}, a3=${a3}`;
  })()
);

/* Migrate legacy zeroUsed * ZERO_COST_BASE into zeroSpentSuper */
check(
  "migrate_zeroSpentSuper_from_zeroUsed",
  /if\s*\(\s*S\.zeroSpentSuper\s*==\s*null\s*\)\s*\{\s*S\.zeroSpentSuper\s*=\s*\(S\.zeroUsed\s*\|\|\s*0\)\s*\*\s*ZERO_COST_BASE/.test(
    src
  ),
  "null zeroSpentSuper migrates from zeroUsed * ZERO_COST_BASE"
);

/* 6. No duplicate function definitions */
for (const name of ["zeroOddsLabel", "zeroPlanCount", "zeroAttemptsLeft"]) {
  const n = countDef(name);
  check(`no_dup_${name}`, n === 1, `function ${name} defined ${n} time(s)`);
}

/* 7. UI: data-zero-boost buttons and data-zero-amt including 10000 */
check(
  "data-zero-boost_present",
  /data-zero-boost=/.test(src),
  "data-zero-boost attribute present in UI"
);

check(
  "data-zero-amt_present",
  /data-zero-amt=/.test(src),
  "data-zero-amt attribute present in UI"
);

check(
  "data-zero-amt_includes_10000",
  /\[1\s*,\s*"×1"\]\s*,\s*\[10\s*,\s*"×10"\]\s*,\s*\[100\s*,\s*"×100"\]\s*,\s*\[1000\s*,\s*"×1000"\]\s*,\s*\[10000\s*,\s*"×1万"\]/.test(
    src
  ) || /\[10000\s*,\s*"×1万"\]/.test(src),
  (() => {
    const m = src.match(/const\s+zeroOpts\s*=\s*(\[[\s\S]*?\]);/);
    return m ? `zeroOpts = ${m[1].replace(/\s+/g, " ").trim()}` : "zeroOpts not found; searched [10000,\"×1万\"]";
  })()
);

check(
  "click_handler_data-zero-boost",
  /closest\(\s*"\[data-zero-boost\]"\s*\)/.test(src),
  "click handler for [data-zero-boost]"
);

check(
  "click_handler_data-zero-amt",
  /closest\(\s*"\[data-zero-amt\]"\s*\)/.test(src),
  "click handler for [data-zero-amt]"
);

/* Extra: getZeroBoostExp clamps 0..12 */
check(
  "getZeroBoostExp_clamped",
  /Math\.max\(\s*0\s*,\s*Math\.min\(\s*ZERO_BOOST_MAX_EXP\s*,\s*Math\.floor\(Number\(S\.zeroBoostExp\)\s*\|\|\s*0\)\s*\)\s*\)/.test(
    src
  ),
  "getZeroBoostExp clamps to [0, ZERO_BOOST_MAX_EXP]"
);

/* Write report */
const pass = failures.length === 0;
const summary = pass
  ? `PASS: all ${checks.length} checks ok (ZERO_MAX_BUY=${ZERO_MAX_BUY}, COST_BASE=${ZERO_COST_BASE}, STREAK=${ZERO_STREAK}, boost 0..${ZERO_BOOST_MAX_EXP})`
  : `FAIL: ${failures.length}/${checks.length} checks failed — ${failures.slice(0, 5).join(" | ")}`;

const report = { pass, checks, failures, summary };
fs.writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
console.log(summary);
console.log("Wrote", OUT);
process.exit(pass ? 0 : 1);
