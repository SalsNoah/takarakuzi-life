/* 宝くじ生活 v6 バランス＋マネタイズ統合シミュ
   現行 index.html の式を移植。複数コンフィグを 21日軸で比較。
   使い方: node sim/v6_balance.js [--round=1] [--runs=12] [--hours=504]
*/
"use strict";

const UNIT = 2e7, TICKET_COST = 30, SUPER_PRIZE = 7e10;
const TIERS = [
  { key:"first",  prize:7e8,  count:1 },
  { key:"around", prize:1.5e8,count:2 },
  { key:"kumi",   prize:1e5,  count:199 },
  { key:"second", prize:1e7,  count:3 },
  { key:"third",  prize:1e6,  count:100 },
  { key:"fourth", prize:5e4,  count:2000 },
  { key:"fifth",  prize:1e4,  count:60000 },
  { key:"sixth",  prize:3e3,  count:200000 },
  { key:"seventh",prize:300,   count:2000000 },
];
const EV = TIERS.reduce((s,t)=>s+t.prize*t.count,0)/UNIT;
const LIFE_NAMES = ["ベンチ","ネカフェ","アパート","マンショ","タワマン","豪邸","島","月面","火星","銀河","パラレル","バグ空間"];

/* ---------- コンフィグ ---------- */
const LIVE = {
  id:"LIVE", label:"現行(sim旧・stale)",
  superRate:1e-4, rhcCost:1e8, rhcMultBase:100, zeroStreak:13, zeroPerSuper:10, zeroMaxBuy:100,
  maxExp:12, trueMax:true,
  facBulk:[{min:100,mult:10},{min:10,mult:2}],
  prodLinear:true, prodExp:1.0,
  facilities:[
    { name:"ロボ", base:0.1, baseCost:200, costMult:1.22 },
    { name:"内職", base:3,   baseCost:7e4, costMult:1.24 },
    { name:"工場", base:80,  baseCost:1e7, costMult:1.26 },
    { name:"AI",   base:2500,baseCost:3e9, costMult:1.28 },
    { name:"量子", base:1.2e5,baseCost:1.5e13,costMult:1.30 },
    { name:"異次", base:8e6, baseCost:4e17,costMult:1.32 },
  ],
  life:[
    { cost:0,     tap:1,    auto:1 },
    { cost:5e3,   tap:4,    auto:2 },
    { cost:1e5,   tap:15,   auto:6 },
    { cost:3e6,   tap:60,   auto:20 },
    { cost:1.5e8, tap:250,  auto:80 },
    { cost:8e9,   tap:1200, auto:350 },
    { cost:6e11,  tap:6000, auto:1600 },
    { cost:9e13,  tap:35000,auto:9000 },
    { cost:4e16,  tap:2.2e5,auto:60000 },
    { cost:8e19,  tap:1.5e6,auto:450000 },
  ],
  recycle:{ baseCost:100, costMult:8, multPerLv:1.6 },
  // monetization knobs (sim) — STALE vs index.html (AD 5×15, RHC×1.5^n + rate halve)
  offlineHours:2, adDaily:3, adMinutes:30,
  rhcCapPerDay:null, // null = uncapped
  prizeMultCap:null,
  rhcRateHalve:false,
  zeroTrueMax:false,
};

/* LIVE-NOW: extracted from current index.html */
const LIVE_NOW = {
  id:"LIVE_NOW", label:"現行index.html",
  superRate:1e-4, rhcCost:1e8, rhcMultBase:1.5, zeroStreak:13, zeroPerSuper:10, zeroMaxBuy:100,
  maxExp:12, trueMax:true,
  facBulk:[{min:100,mult:10},{min:10,mult:2}],
  facBulkMode:"owned", // cumulative owned Lv → mult (not per-purchase batch)
  prodLinear:true, prodExp:1.0,
  facilities:[
    { name:"ロボ", base:0.1, baseCost:200, costMult:1.22 },
    { name:"内職", base:3,   baseCost:7e4, costMult:1.24 },
    { name:"工場", base:80,  baseCost:1e7, costMult:1.26 },
    { name:"AI",   base:2500,baseCost:3e9, costMult:1.28 },
    { name:"量子", base:1.2e5,baseCost:1.5e13,costMult:1.30 },
    { name:"異次", base:8e6, baseCost:4e17,costMult:1.32 },
  ],
  life:[
    { cost:0,     tap:1,    auto:1 },
    { cost:5e3,   tap:4,    auto:2 },
    { cost:1e5,   tap:15,   auto:6 },
    { cost:3e6,   tap:60,   auto:20 },
    { cost:5e8,   tap:250,  auto:80 },
    { cost:6e10,  tap:1200, auto:350 },
    { cost:1.2e13,tap:6000, auto:1600 },
    { cost:1.5e15,tap:35000,auto:9000 },
    { cost:8e16,  tap:2.2e5,auto:60000 },
    { cost:1.5e21,tap:1.5e6,auto:450000 },
    { cost:1.5e25,tap:1e7,  auto:3500000 },
    { cost:1.5e29,tap:7e7,  auto:25000000 },
  ],
  recycle:{ baseCost:200, costMult:11, multPerLv:1.48 },
  offlineHours:2, adDaily:5, adMinutes:15, adMinutesBoosted:60,
  rhcCapPerDay:null,
  prizeMultCap:null,
  rhcRateHalve:true,   // geometric decay; factor = rhcRateDiv
  rhcRateDiv:3,        // p = (1/UNIT)/3^rhcFirst
  zeroTrueMax:true,    // MAX spends all remaining attempts
};

/* R1提案: 爆発抑制 + 3週間ペース */
const R1 = Object.assign({}, LIVE, {
  id:"R1", label:"R1爆発抑制",
  rhcMultBase:10,                 // ×10^n
  prizeMultCap:1e12,              // 賞金額倍率上限
  facBulk:[{min:100,mult:3},{min:10,mult:1.5}],
  recycle:{ baseCost:200, costMult:12, multPerLv:1.45 },
  facilities:LIVE.facilities.map((f,i)=>({
    ...f,
    costMult: [1.28,1.30,1.32,1.34,1.36,1.38][i],
    baseCost: [200,1e5,2e7,8e9,5e13,2e18][i],
  })),
  life:LIVE.life.map((l,i)=>({
    ...l,
    cost: [0,8e3,3e5,1.5e7,1e9,1e11,2e13,4e15,1e18,5e20][i],
    auto:[1,1.9,5,14,45,140,500,1800,7000,28000][i],
    tap:[1,3.5,12,45,160,700,3200,15000,7e4,3.5e5][i],
  })),
});

/* R2: 広告/課金の効きを明確化 */
const R2 = Object.assign({}, R1, {
  id:"R2", label:"R2マネタイズ設計",
  offlineHours:2,
  adDaily:5, adMinutes:20,          // 視聴しやすいが1回短縮
  // IAP効果はプレイヤータイプで外挿
});

/* R3: 超一等→零等ループ調整 + RHC日次ソフトキャップ */
const R3 = Object.assign({}, R2, {
  id:"R3", label:"R3極み抑制",
  superRate:2e-4,                   // 少し出やすく（物語）
  zeroPerSuper:20,                  // 超一等20回で1挑戦
  rhcCost:2.5e8,
  rhcCapPerDay:1000,                // 1日最大1000回分のRHC消費
  prizeMultCap:1e8,
  rhcMultBase:5,
});

/* R4: 3週間マイルストーン合わせ — 序盤やや速く、終盤を伸ばす */
const R4 = Object.assign({}, R3, {
  id:"R4", label:"R4三週ペース",
  rhcMultBase:3,
  prizeMultCap:1e4,
  rhcCapPerDay:200,
  rhcCost:1.5e8,
  zeroPerSuper:12,
  facilities:[
    { name:"ロボ", base:0.1, baseCost:200,   costMult:1.24 },
    { name:"内職", base:3,   baseCost:7e4,   costMult:1.26 },
    { name:"工場", base:80,  baseCost:1.2e7, costMult:1.28 },
    { name:"AI",   base:2500,baseCost:4e9,   costMult:1.30 },
    { name:"量子", base:1.2e5,baseCost:2e13, costMult:1.33 },
    { name:"異次", base:8e6, baseCost:6e17,  costMult:1.36 },
  ],
  life:[
    { cost:0,     tap:1,    auto:1 },
    { cost:5e3,   tap:4,    auto:2 },
    { cost:1.2e5, tap:14,   auto:5.5 },
    { cost:4e6,   tap:55,   auto:16 },
    { cost:2.5e8, tap:200,  auto:48 },
    { cost:2e10,  tap:900,  auto:140 },
    { cost:3e12,  tap:4000, auto:420 },
    { cost:8e14,  tap:18000,auto:1300 },
    { cost:3e17,  tap:9e4,  auto:4500 },
    { cost:2e20,  tap:5e5,  auto:16000 },
  ],
  recycle:{ baseCost:150, costMult:10, multPerLv:1.5 },
  adDaily:5, adMinutes:20,
});

/* R5: 検証後微調整 — 広告差を生活+0.5〜1、課金は時間短縮型 */
const R5 = Object.assign({}, R4, {
  id:"R5", label:"R5微調整",
  rhcMultBase:3,
  prizeMultCap:1e3,
  rhcCapPerDay:150,
  rhcCost:2e8,
  zeroPerSuper:15,
  superRate:1.5e-4,
  facBulk:[{min:100,mult:2},{min:10,mult:1.3}],
  adDaily:4, adMinutes:25,
  facilities:R4.facilities.map((f,i)=>({
    ...f,
    costMult:[1.25,1.27,1.29,1.31,1.34,1.37][i],
    baseCost:[200,8e4,1.5e7,5e9,3e13,1e18][i],
  })),
  life:[
    { cost:0,     tap:1,    auto:1 },
    { cost:6e3,   tap:3.5,  auto:1.9 },
    { cost:1.5e5, tap:12,   auto:5 },
    { cost:5e6,   tap:48,   auto:14 },
    { cost:3e8,   tap:180,  auto:42 },
    { cost:3e10,  tap:800,  auto:120 },
    { cost:5e12,  tap:3500, auto:360 },
    { cost:1.2e15,tap:16000,auto:1100 },
    { cost:5e17,  tap:8e4,  auto:3800 },
    { cost:4e20,  tap:4e5,  auto:14000 },
  ],
  recycle:{ baseCost:180, costMult:11, multPerLv:1.48 },
});

/* R6最終案 — 目標: D7=L4-5, D14=L5-6, D21=L6-7(F2P) / 広告でD14に+1 / 軽課金は時間短縮でL8止まり */
const R6 = Object.assign({}, R5, {
  id:"R6", label:"R6最終案",
  superRate:1.2e-4,
  rhcCost:1e8,
  rhcMultBase:2,
  prizeMultCap:64,            // max ×64 (=2^6)
  rhcCapPerDay:2e6,           // ≈期待RHC一等 0.1/日。21日で無課金0〜1、広告〜数回
  zeroPerSuper:12,
  zeroStreak:13,
  facBulk:[{min:100,mult:2},{min:10,mult:1.25}],
  facilities:[
    { name:"ロボ", base:0.1, baseCost:200,   costMult:1.25 },
    { name:"内職", base:3,   baseCost:8e4,   costMult:1.27 },
    { name:"工場", base:80,  baseCost:1.5e7, costMult:1.29 },
    { name:"AI",   base:2500,baseCost:5e9,   costMult:1.31 },
    { name:"量子", base:1.2e5,baseCost:3e13, costMult:1.34 },
    { name:"異次", base:8e6, baseCost:1.2e18,costMult:1.37 },
  ],
  life:[
    { cost:0,     tap:1,    auto:1 },
    { cost:6e3,   tap:3.5,  auto:1.9 },
    { cost:1.8e5, tap:12,   auto:5 },
    { cost:7e6,   tap:48,   auto:14 },
    { cost:5e8,   tap:170,  auto:40 },     // タワマン: F2PのD7壁
    { cost:6e10,  tap:750,  auto:110 },    // 豪邸: D14壁
    { cost:1.2e13,tap:3200, auto:320 },    // 島: D14–21
    { cost:1.5e15,tap:14000,auto:950 },    // 月面: 週3〜4
    { cost:8e16,  tap:7e4,  auto:3200 },   // 火星: F2P D28–35 目安（最終QA）
    { cost:1.5e21,tap:3.5e5,auto:12000 },
  ],
  recycle:{ baseCost:200, costMult:11, multPerLv:1.48 },
  // 広告: 1日6回×25分 = 2.5h相当。F2PとのD14差を作る主レバー
  adDaily:6, adMinutes:25,
  offlineHours:2,
});



const CONFIGS = { LIVE, LIVE_NOW, R1, R2, R3, R4, R5, R6 };

/* ---------- 乱数 ---------- */
function gauss(){ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
function poisson(l){ if(l<=0)return 0; if(l>30)return Math.max(0,Math.round(l+Math.sqrt(l)*gauss()));
  const L=Math.exp(-l); let k=0,p=1; do{k++;p*=Math.random();}while(p>L); return k-1; }
function binom(n,p){ if(n<=0||p<=0)return 0; if(p>=1)return n;
  if(n<80){ let c=0; for(let i=0;i<n;i++) if(Math.random()<p)c++; return c; }
  const m=n*p; if(m<30) return Math.min(n,poisson(m));
  return Math.max(0,Math.min(n,Math.round(m+Math.sqrt(m*(1-p))*gauss()))); }

function bulkMult(C,k){
  for(const b of C.facBulk) if(k>=b.min) return b.mult;
  return 1;
}
function ownedMult(C,lv){
  for(const b of C.facBulk) if(lv>=b.min) return b.mult;
  return 1;
}
function geoCost(base,m,lv,k){ const u=base*Math.pow(m,lv); if(!isFinite(u))return Infinity;
  return u*(Math.pow(m,k)-1)/(m-1); }
function geoMax(base,m,lv,budget){ const u=base*Math.pow(m,lv);
  if(!isFinite(u)||budget<u)return 0;
  return Math.max(0,Math.min(500,Math.floor(Math.log(1+budget*(m-1)/u)/Math.log(m)))); }

/* ---------- シミュ本体 ---------- */
function simulate(C, opts){
  const {
    hours=504, playMinPerDay=30, hitRate=0.9,
    comboTimeLv=0, offlineHours=C.offlineHours,
    adsPerDay=C.adDaily, adMinutes=C.adMinutes,
    player="f2p", // f2p | ad | whale
    rhcAggressiveness=0.5, // 0-1 how much lose tickets spent on RHC when apex
  } = opts;

  const F=C.facilities, L=C.life, R=C.recycle;
  const S={
    money:0, manualTP:0, autoTP:0, lose:0,
    facLv:F.map(()=>0), facExtra:F.map(()=>0),
    lifeLv:0, recLv:0,
    first:0, super:0, apex:false, rhcFirst:0, zeroWins:0, zeroUsed:0,
    tickets:0, rhcDraws:0, rhcDay:0, day:0,
    adsWatched:0, stalledMin:0,
  };

  const ownedMode = C.facBulkMode === "owned";
  const effLv=i=>{
    const lv = S.facLv[i];
    return ownedMode ? lv * ownedMult(C, lv) : lv + S.facExtra[i];
  };
  const facProd=i=>{ const lv=effLv(i); return lv<=0?0:F[i].base*lv; };
  const recM=()=>Math.pow(R.multPerLv,S.recLv);
  const prizeM=()=>{
    let m = S.rhcFirst<=0 ? 1 : Math.pow(C.rhcMultBase, S.rhcFirst);
    if(C.prizeMultCap!=null) m=Math.min(m, C.prizeMultCap);
    return m;
  };
  const rate=()=>{ let s=0; for(let i=0;i<F.length;i++) s+=facProd(i);
    return s*L[S.lifeLv].auto*recM(); };

  function draw(n){
    let prize=0, win=0, sup=0;
    for(const t of TIERS){
      let c=binom(n,t.count/UNIT);
      if(t.key==="first"&&c>0&&S.first>0){ // super unlocked after first ever — use firstWins>0
        /* after any first historically */
      }
      if(t.key==="first"&&c>0&&(S.first>0||S.super>0||S.apex)){
        sup=binom(c,C.superRate); c-=sup;
      }
      if(c>0){ prize+=t.prize*c; win+=c; if(t.key==="first") S.first+=c; }
    }
    if(sup>0){ prize+=SUPER_PRIZE*sup; win+=sup; S.super+=sup; }
    if(S.first>0||S.super>0){ /* unlocked */ }
    if(S.super>0) S.apex=true;
    prize*=prizeM();
    S.money+=prize; S.lose+=n-win; S.tickets+=n;
  }

  // Fix: unlock super after ANY first win including current draw
  function drawFixed(n){
    let prize=0, win=0, firstC=0, sup=0;
    const unlocked = S.first>0 || S.super>0;
    for(const t of TIERS){
      let c=binom(n,t.count/UNIT);
      if(t.key==="first"&&c>0){
        if(unlocked){ const s=binom(c,C.superRate); sup+=s; c-=s; }
        firstC+=c; S.first+=c;
      }
      if(c>0){ prize+=t.prize*c; win+=c; }
    }
    if(sup>0){ prize+=SUPER_PRIZE*sup; win+=sup; S.super+=sup; S.apex=true; }
    if(S.first>0 && !unlocked && firstC>0){ /* first unlock this draw — supers already skipped this batch ok */ }
    prize*=prizeM();
    S.money+=prize; S.lose+=n-win; S.tickets+=n;
  }

  function spendTP(){
    for(const pool of ["manualTP","autoTP"]){
      let g=0;
      while(g++<80){
        let n = C.trueMax ? Math.floor(S[pool]/TICKET_COST)
                          : (()=>{ let e=0; while(e<C.maxExp&&Math.pow(10,e+1)*TICKET_COST<=S[pool])e++; return Math.pow(10,e); })();
        const cost=n*TICKET_COST;
        if(n<1||S[pool]<cost) break;
        S[pool]-=cost; drawFixed(n);
      }
    }
  }

  function buyFac(i,kWant){
    const f=F[i], lv=S.facLv[i];
    let k=kWant;
    if(k==="max") k=Math.max(1, geoMax(f.baseCost,f.costMult,lv,S.money));
    const cost=geoCost(f.baseCost,f.costMult,lv,k);
    if(k<1||cost>S.money||!isFinite(cost)) return false;
    S.money-=cost; S.facLv[i]+=k;
    if(!ownedMode){
      const buff=bulkMult(C,k);
      S.facExtra[i]+=k*(buff-1);
    }
    return true;
  }

  function spendMoney(){
    let g=0;
    while(g++<3000){
      const cur=rate();
      let best=null;
      for(let i=0;i<F.length;i++){
        // prefer bulk 10/100 when affordable
        for(const k of [100,10,1]){
          const cost=geoCost(F[i].baseCost,F[i].costMult,S.facLv[i],k);
          if(cost>S.money||!isFinite(cost)) continue;
          const next=S.facLv[i]+k;
          const gain=ownedMode
            ? F[i].base*(next*ownedMult(C,next)-effLv(i))*L[S.lifeLv].auto*recM()
            : F[i].base*k*bulkMult(C,k)*L[S.lifeLv].auto*recM();
          const eff=gain/cost;
          if(!best||eff>best.eff) best={t:"f",i,k,cost,eff};
        }
      }
      const nx=L[S.lifeLv+1];
      if(nx&&nx.cost<=S.money){
        const gain=cur*(nx.auto/L[S.lifeLv].auto-1);
        const eff=(gain>0?gain:cur)/Math.max(nx.cost,1)*1.4;
        if(!best||eff>best.eff) best={t:"l",cost:nx.cost,eff};
      }
      if(!best) break;
      if(best.t==="f"){ if(!buyFac(best.i,best.k)) break; }
      else { S.money-=best.cost; S.lifeLv++; }
    }
    let g2=0;
    while(g2++<300){
      const c=R.baseCost*Math.pow(R.costMult,S.recLv);
      if(S.lose<c) break;
      S.lose-=c; S.recLv++;
    }
  }

  function doRHC(budgetDraws){
    if(!S.apex) return;
    let n=Math.floor(S.lose/C.rhcCost);
    n=Math.floor(n*rhcAggressiveness);
    if(C.rhcCapPerDay!=null) n=Math.min(n, Math.max(0, C.rhcCapPerDay-S.rhcDay));
    n=Math.min(n, budgetDraws||n);
    if(n<1) return;
    const cost=n*C.rhcCost;
    S.lose-=cost; S.rhcDraws+=n; S.rhcDay+=n;
    let rhcFirst=0, loseGain=0;
    if(C.rhcRateHalve){
      // Match index.html drawRHC: geometric waiting; p /= rhcRateDiv after each first
      const div = C.rhcRateDiv || 2;
      let p = (1 / UNIT) / Math.pow(div, S.rhcFirst || 0);
      let left = n;
      while(left > 0 && p > 1e-18){
        let trials;
        if(p >= 1) trials = 1;
        else {
          const denom = Math.log(1 - p);
          if(!isFinite(denom) || denom === 0) break;
          const u = Math.random();
          if(u <= 0){ trials = left + 1; }
          else trials = Math.floor(Math.log(1 - u) / denom) + 1;
        }
        if(!isFinite(trials) || trials < 1 || trials > left) break;
        rhcFirst++;
        left -= trials;
        p /= div;
      }
      for(const t of TIERS){
        if(t.key==="first") continue;
        const c = n < 2000 ? binom(n, t.count/UNIT)
          : (()=>{ const mean=n*t.count/UNIT; return mean<30?poisson(mean):Math.max(0,Math.round(mean+Math.sqrt(mean)*gauss())); })();
        if(c>0) loseGain += t.prize * c;
      }
    } else if(n < 2000){
      for(const t of TIERS){
        const c=binom(n,t.count/UNIT);
        if(c<=0) continue;
        if(t.key==="first") rhcFirst+=c;
        else loseGain+=t.prize*c;
      }
    } else {
      for(const t of TIERS){
        const mean=n*t.count/UNIT;
        const c=mean<30?poisson(mean):Math.max(0,Math.round(mean+Math.sqrt(mean)*gauss()));
        if(t.key==="first") rhcFirst+=c;
        else loseGain+=t.prize*c;
      }
    }
    S.rhcFirst+=rhcFirst;
    S.lose+=loseGain;
  }

  function doZero(){
    if(!S.apex) return;
    const left=Math.max(0, Math.floor(S.super/C.zeroPerSuper)-S.zeroUsed);
    const plan=C.zeroTrueMax ? left : Math.min(left, C.zeroMaxBuy);
    if(plan<1) return;
    S.zeroUsed+=plan;
    // P(win)=2^-streak — use binom (not per-trial loop; plan can be huge with MAX)
    const p=Math.pow(0.5,C.zeroStreak);
    S.zeroWins += binom(plan, p);
  }

  const marks={}, daily=[];
  const step = opts.stepSec || 60;
  const activePerDay=playMinPerDay*60;
  let leftToday=activePerDay, adsToday=adsPerDay, day=0, offAcc=0;
  let lastMoney=0, stallClock=0;
  const fastTap = !!opts.fastTap; // expected-value taps (audit speed)

  for(let sec=0; sec<hours*3600; sec+=step){
    const d=Math.floor(sec/86400);
    if(d!==day){
      // end-of-day snapshot
      daily.push({
        d:day, money:S.money, rate:rate(), life:S.lifeLv, rec:S.recLv,
        first:S.first, super:S.super, rhc:S.rhcFirst, zero:S.zeroWins,
        tickets:S.tickets, ads:S.adsWatched, prizeM:prizeM(),
      });
      day=d; S.day=d; leftToday=activePerDay; adsToday=adsPerDay; S.rhcDay=0;
    }
    const active=leftToday>0;
    if(active){
      leftToday-=step;
      S.autoTP+=rate()*step;
      const holdScale=comboTimeLv>=2?2:comboTimeLv>=1?1.5:1;
      if(fastTap){
        // ~same EV as micro-loop: taps scale with hitRate & holdScale
        const taps = (step / (1.1 * holdScale)) * hitRate;
        S.manualTP += L[S.lifeLv].tap * taps * 2.0; // EV uplift ≈ mean of ramp to ×3 / 20 taps
      } else {
        let t=0,combo=0;
        while(t<step){
          const dur=Math.max(620,1600-combo*22)*holdScale/1000;
          t+=dur*0.55;
          if(Math.random()<hitRate){ S.manualTP+=L[S.lifeLv].tap*(1+Math.min(combo,20)*0.1); combo++; }
          else combo=0;
        }
      }
      if(offAcc>0){ S.autoTP+=rate()*Math.min(offAcc, offlineHours*3600); offAcc=0; }
      while(adsToday>0){ S.autoTP+=rate()*adMinutes*60; adsToday--; S.adsWatched++; }
      if(S.apex && sec%600 < step){ doRHC(); doZero(); }
    } else {
      offAcc=Math.min(offAcc+step, offlineHours*3600);
    }

    spendTP(); spendMoney();

    if(S.money<=lastMoney*1.0001) stallClock+=step; else stallClock=0;
    lastMoney=S.money;
    if(stallClock>3600) S.stalledMin+=step/60;

    for(let i=1;i<L.length;i++) if(S.lifeLv>=i&&marks["life"+i]===undefined) marks["life"+i]=sec;
    if(S.first>0&&marks.first===undefined) marks.first=sec;
    if(S.super>0&&marks.super===undefined) marks.super=sec;
    if(S.apex&&marks.apex===undefined) marks.apex=sec;
    if(S.rhcFirst>0&&marks.rhc===undefined) marks.rhc=sec;
    if(prizeM()>=100&&marks.m100===undefined) marks.m100=sec;
    if(prizeM()>=1e4&&marks.m1e4===undefined) marks.m1e4=sec;
    if(prizeM()>=1e6&&marks.m1e6===undefined) marks.m1e6=sec;
  }
  daily.push({
    d:day, money:S.money, rate:rate(), life:S.lifeLv, rec:S.recLv,
    first:S.first, super:S.super, rhc:S.rhcFirst, zero:S.zeroWins,
    tickets:S.tickets, ads:S.adsWatched, prizeM:prizeM(),
  });

  return { S, marks, daily, rate:rate(), prizeM:prizeM() };
}

/* ---------- 集計 ---------- */
const U=[[1e40,"正"],[1e36,"澗"],[1e32,"溝"],[1e28,"穣"],[1e24,"秭"],[1e20,"垓"],[1e16,"京"],[1e12,"兆"],[1e8,"億"],[1e4,"万"]];
function fmt(n){ if(!isFinite(n)||n===0) return String(n);
  const a=Math.abs(n);
  for(const [v,u] of U) if(a>=v) return (a/v>=100?Math.round(n/v):(n/v).toFixed(2))+u;
  return Math.round(n).toLocaleString("en-US"); }
function fmtT(s){ if(s===undefined) return "—";
  const h=Math.floor(s/3600), d=Math.floor(h/24);
  if(d>0) return `${d}d${h%24}h`;
  if(h>0) return `${h}h${Math.floor((s%3600)/60)}m`;
  return `${Math.floor(s/60)}m`; }
function med(a){ const b=[...a].filter(x=>x!==undefined&&isFinite(x)).sort((x,y)=>x-y);
  if(!b.length) return undefined; return b[Math.floor(b.length/2)]; }
function pctl(a,p){ const b=[...a].filter(x=>x!==undefined&&isFinite(x)).sort((x,y)=>x-y);
  if(!b.length) return undefined; return b[Math.min(b.length-1, Math.floor(b.length*p))]; }
function reachRate(rs,k){ return rs.filter(r=>r.marks[k]!==undefined).length/rs.length; }

const arg=k=>{ const m=process.argv.find(a=>a.startsWith(`--${k}=`)); return m?m.split("=")[1]:undefined; };
const ROUND=Number(arg("round")||"6");
const RUNS=Number(arg("runs")||"12");
const HOURS=Number(arg("hours")||"504"); // 21 days

const PLAYERS = {
  f2p: { playMinPerDay:25, adsPerDay:0, comboTimeLv:0, offlineHours:2, rhcAggressiveness:0.3, label:"無課金", adBoost:false, coinsSpent:0 },
  ad:  { playMinPerDay:30, adsPerDay:null, comboTimeLv:0, offlineHours:2, rhcAggressiveness:0.5, label:"広告視聴", adBoost:false, coinsSpent:0 },
  soft:{ playMinPerDay:35, adsPerDay:null, comboTimeLv:1, offlineHours:8, rhcAggressiveness:0.7, label:"軽課金", adBoost:true, coinsSpent:600 },
  whale:{ playMinPerDay:45, adsPerDay:null, comboTimeLv:2, offlineHours:24, rhcAggressiveness:1.0, label:"重課金", adBoost:true, coinsSpent:2000 },
};

function runConfig(C, playerKey, runs=RUNS, hours=HOURS, extraOpts={}){
  const P=PLAYERS[playerKey];
  const adMin = P.adBoost && C.adMinutesBoosted!=null ? C.adMinutesBoosted : C.adMinutes;
  const opts={
    hours, playMinPerDay:P.playMinPerDay, comboTimeLv:P.comboTimeLv,
    offlineHours:P.offlineHours ?? C.offlineHours,
    adsPerDay:P.adsPerDay==null?C.adDaily:P.adsPerDay,
    adMinutes:adMin, rhcAggressiveness:P.rhcAggressiveness, player:playerKey,
    ...extraOpts,
  };
  const rs=[];
  for(let i=0;i<runs;i++) rs.push(simulate(C, opts));
  const lifeAt=(d)=>med(rs.map(r=>{ const row=r.daily.find(x=>x.d===d)||r.daily[r.daily.length-1]; return row.life; }));
  const moneyAt=(d)=>med(rs.map(r=>{ const row=r.daily.find(x=>x.d===d)||r.daily[r.daily.length-1]; return row.money; }));
  const rateAt=(d)=>med(rs.map(r=>{ const row=r.daily.find(x=>x.d===d)||r.daily[r.daily.length-1]; return row.rate; }));
  const pmAt=(d)=>med(rs.map(r=>{ const row=r.daily.find(x=>x.d===d)||r.daily[r.daily.length-1]; return row.prizeM; }));
  return {
    config:C.id, player:playerKey, runs, hours,
    life7:lifeAt(7), life14:lifeAt(14), life21:lifeAt(20),
    money7:moneyAt(7), money14:moneyAt(14), money21:moneyAt(20),
    rate21:rateAt(20), prizeM21:pmAt(20),
    lifeFinal:med(rs.map(r=>r.S.lifeLv)),
    recFinal:med(rs.map(r=>r.S.recLv)),
    firstT:fmtT(med(rs.map(r=>r.marks.first))),
    superT:fmtT(med(rs.map(r=>r.marks.super))),
    rhcT:fmtT(med(rs.map(r=>r.marks.rhc))),
    m100T:fmtT(med(rs.map(r=>r.marks.m100))),
    m1e4T:fmtT(med(rs.map(r=>r.marks.m1e4))),
    reachFirst:reachRate(rs,"first"),
    reachSuper:reachRate(rs,"super"),
    reachLife5:reachRate(rs,"life5"),
    reachLife7:reachRate(rs,"life7"),
    reachLife9:reachRate(rs,"life9"),
    rhcFirst:med(rs.map(r=>r.S.rhcFirst)),
    zeroWins:med(rs.map(r=>r.S.zeroWins)),
    stalledMin:med(rs.map(r=>r.S.stalledMin)),
    ads:med(rs.map(r=>r.S.adsWatched)),
    // boredom: money非有限、または日次成長<5%、またはrate成長<5%
    boredomDays:med(rs.map(r=>{
      let b=0;
      for(let i=8;i<r.daily.length;i++){
        const prev=r.daily[i-1], cur=r.daily[i];
        const a=prev.money, c=cur.money;
        if(!isFinite(a) || !isFinite(c) || !isFinite(cur.rate)){ b++; continue; }
        const moneyFlat = a>0 && c/a < 1.05;
        const rateFlat = prev.rate>0 && cur.rate/prev.rate < 1.05;
        if(moneyFlat || rateFlat) b++;
      }
      return b;
    })),
    curve: Array.from({length:Math.min(21, Math.floor(hours/24))},(_,d)=>({
      d, life:lifeAt(d), money:moneyAt(d), rate:rateAt(d), prizeM:pmAt(d),
    })),
    _raw: rs, // for audit enrichment; stripped by CLI writers if needed
  };
}

function monetizationModel(summaryAd, summaryF2P, summarySoft){
  const lifeGap14 = (summaryAd.life14||0) - (summaryF2P.life14||0);
  const lifeGap21 = (summaryAd.life21||0) - (summaryF2P.life21||0);
  const lifeGap7  = (summaryAd.life7||0) - (summaryF2P.life7||0);
  const rateGap = summaryF2P.rate21>0 ? (summaryAd.rate21/summaryF2P.rate21) : 1;
  const logRate = Math.log10(Math.max(rateGap, 1));
  // 序盤の壁突破感（D7差）を広告動機の主因にする
  const adIntent = Math.max(0.05, Math.min(0.40,
    0.10 + 0.06*lifeGap7 + 0.05*lifeGap14 + 0.03*lifeGap21 + 0.03*logRate
  ));
  const softLife = (summarySoft.life21||0) - (summaryF2P.life21||0);
  const softRate = summaryF2P.rate21>0 ? (summarySoft.rate21/summaryF2P.rate21) : 1;
  const softLog = Math.log10(Math.max(softRate, 1));
  const payIntent = Math.max(0.002, Math.min(0.03,
    0.004 + 0.0025*Math.max(0, softLife) + 0.002*softLog + 0.0008*(summaryF2P.boredomDays||0)
  ));
  return {
    adIntent, payIntent, lifeGap7, lifeGap14, lifeGap21, rateGap, softLife, softLog,
    adTarget:0.20, payTarget:0.01,
    adOk: adIntent>=0.14 && adIntent<=0.28,
    payOk: payIntent>=0.007 && payIntent<=0.018,
  };
}

/* ---------- ラウンド実行 ---------- */
const roundPlan = {
  1: ["LIVE"],
  2: ["LIVE","R1"],
  3: ["LIVE","R1","R3"],
  4: ["LIVE","R3","R4"],
  5: ["LIVE","R4","R5"],
  6: ["LIVE","R5","R6"],
  7: ["LIVE_NOW","R6"],
};

function stripRaw(obj){
  const clone = JSON.parse(JSON.stringify(obj, (k,v)=> k==="_raw" ? undefined : v));
  return clone;
}

function runCli(){
  const ids = (arg("configs") ? arg("configs").split(",") : null) || roundPlan[ROUND] || ["LIVE","R6"];
  const out = { round:ROUND, hours:HOURS, runs:RUNS, ev:EV, results:{}, monetization:{} };

  console.log(`\n======== ROUND ${ROUND} | ${HOURS}h (~${(HOURS/24)|0}d) × ${RUNS} runs ========`);
  console.log(`EV/ticket=${EV.toFixed(3)} G  configs=${ids.join(",")}\n`);

  for(const id of ids){
    const C=CONFIGS[id];
    if(!C){ console.error("unknown config", id); continue; }
    out.results[id]={};
    console.log(`--- ${C.label} (${id}) ---`);
    for(const pk of ["f2p","ad","soft","whale"]){
      const r=runConfig(C, pk);
      out.results[id][pk]=stripRaw(r);
      console.log(`  [${PLAYERS[pk].label}] life D7/14/21=${r.life7}/${r.life14}/${r.life21}  `+
        `money21=${fmt(r.money21)}  rate21=${fmt(r.rate21)}  prizeM=${fmt(r.prizeM21)}  `+
        `first=${r.firstT} super=${r.superT} rhc=${r.rhcFirst} boredom=${r.boredomDays}`);
    }
    const mon=monetizationModel(out.results[id].ad, out.results[id].f2p, out.results[id].soft);
    out.monetization[id]=mon;
    console.log(`  monetize: adIntent=${(mon.adIntent*100).toFixed(1)}% (target20%) `+
      `payIntent=${(mon.payIntent*100).toFixed(2)}% (target1%)  `+
      `adOk=${mon.adOk} payOk=${mon.payOk}`);
    console.log("");
  }

  const fs=require("fs");
  const path=require("path");
  const outPath=path.join(__dirname, `out_r${ROUND}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out,null,2));
  console.log(`wrote ${outPath}`);
}

module.exports = {
  UNIT, TICKET_COST, SUPER_PRIZE, TIERS, EV, LIFE_NAMES,
  LIVE, LIVE_NOW, R1, R2, R3, R4, R5, R6, CONFIGS,
  PLAYERS, simulate, runConfig, monetizationModel,
  med, pctl, fmt, fmtT, reachRate,
};

if (require.main === module) runCli();
