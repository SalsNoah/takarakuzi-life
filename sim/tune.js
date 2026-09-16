/* 宝くじ生活 バランス調整 A/B 検証
   現行値と調整案を同じ条件で走らせ、進行速度と詰まりを比較する。
   使い方: node sim/tune.js [--hours=336] [--runs=15] */

/* ---------- 固定定義 ---------- */
const UNIT = 20000000, TICKET_COST = 20;
const TIERS = [
  { key:"first", prize:700000000, count:1 },
  { key:"around",prize:150000000, count:2 },
  { key:"kumi",  prize:100000,    count:199 },
  { key:"second",prize:10000000,  count:3 },
  { key:"third", prize:1000000,   count:100 },
  { key:"fourth",prize:50000,     count:2000 },
  { key:"fifth", prize:10000,     count:60000 },
  { key:"sixth", prize:3000,      count:200000 },
  { key:"seventh",prize:300,      count:2000000 },
];
const SUPER_PRIZE = 70000000000, SUPER_RATE = 0.01;
const EV = TIERS.reduce((s,t)=>s+t.prize*t.count,0)/UNIT;

/* ---------- 現行の設定 ---------- */
const CURRENT = {
  label:"現行",
  maxExp:8, trueMax:false, prodExp:1.12,
  facilities:[
    { name:"貯金箱ロボ",     base:0.1,    baseCost:200,   costMult:1.25 },
    { name:"内職マシン",     base:3,      baseCost:8e4,   costMult:1.28 },
    { name:"TP印刷工場",     base:80,     baseCost:1.2e7, costMult:1.30 },
    { name:"AI労働センター", base:2500,   baseCost:4e9,   costMult:1.33 },
    { name:"量子タップ炉",   base:120000, baseCost:2e13,  costMult:1.36 },
    { name:"異次元プラント", base:8e6,    baseCost:5e17,  costMult:1.40 },
  ],
  life:[
    { name:"公園のベンチ",      cost:0,     tap:1,      auto:1 },
    { name:"ネットカフェ暮らし",cost:5000,  tap:4,      auto:2 },
    { name:"ボロアパート",      cost:1e5,   tap:15,     auto:6 },
    { name:"分譲マンション",    cost:3e6,   tap:60,     auto:20 },
    { name:"タワマン最上階",    cost:1.5e8, tap:250,    auto:80 },
    { name:"丘の上の大豪邸",    cost:8e9,   tap:1200,   auto:350 },
    { name:"プライベート島",    cost:6e11,  tap:6000,   auto:1600 },
    { name:"月面ヴィラ",        cost:9e13,  tap:35000,  auto:9000 },
    { name:"火星コロニー領主",  cost:4e16,  tap:220000, auto:60000 },
    { name:"銀河系オーナー",    cost:8e19,  tap:1.5e6,  auto:450000 },
  ],
  recycle:{ baseCost:100, costMult:8, multPerLv:1.6 },
};

/* ---------- 調整案 ----------
   1) まとめ買いの上限を撤廃（所持 TP で買えるだけ買える MAX を用意）
   2) 設備の伸び 1.12 → 1.09、コスト倍率を +0.12 して 1 レベルの重みを増やす
   3) 生活拠点の倍率の跳ね上がりを抑え、価格の刻みを広げる
   4) 再生の倍率を 1.6 → 1.45、コスト倍率を 8 → 12
------------------------------------------ */
const TUNED = {
  label:"調整案",
  maxExp:12, trueMax:true, prodExp:1.09,
  facilities:[
    { name:"貯金箱ロボ",     base:0.1,    baseCost:200,   costMult:1.37 },
    { name:"内職マシン",     base:3,      baseCost:1.5e5, costMult:1.40 },
    { name:"TP印刷工場",     base:80,     baseCost:6e7,   costMult:1.42 },
    { name:"AI労働センター", base:2500,   baseCost:3e10,  costMult:1.45 },
    { name:"量子タップ炉",   base:120000, baseCost:2e14,  costMult:1.48 },
    { name:"異次元プラント", base:8e6,    baseCost:8e18,  costMult:1.52 },
  ],
  life:[
    { name:"公園のベンチ",      cost:0,     tap:1,     auto:1 },
    { name:"ネットカフェ暮らし",cost:12000, tap:3,     auto:1.8 },
    { name:"ボロアパート",      cost:6e5,   tap:10,    auto:4 },
    { name:"分譲マンション",    cost:4e7,   tap:35,    auto:11 },
    { name:"タワマン最上階",    cost:5e9,   tap:130,   auto:32 },
    { name:"丘の上の大豪邸",    cost:8e11,  tap:520,   auto:95 },
    { name:"プライベート島",    cost:2e14,  tap:2200,  auto:290 },
    { name:"月面ヴィラ",        cost:6e16,  tap:9500,  auto:900 },
    { name:"火星コロニー領主",  cost:3e19,  tap:42000, auto:2800 },
    { name:"銀河系オーナー",    cost:2e22,  tap:2e5,   auto:9000 },
  ],
  recycle:{ baseCost:250, costMult:12, multPerLv:1.45 },
};

/* 実際に index.html へ適用した内容：まとめ買い上限の撤廃のみ */
const UNCAPPED = Object.assign({}, CURRENT, { label:"上限撤廃のみ", maxExp:12, trueMax:true });

/* 中間案：現行と調整案の間。上限は撤廃しつつ、伸びは現行寄りに残す */
const MID = {
  label:"中間案",
  maxExp:12, trueMax:true, prodExp:1.105,
  facilities:[
    { name:"貯金箱ロボ",     base:0.1,    baseCost:200,   costMult:1.31 },
    { name:"内職マシン",     base:3,      baseCost:1.1e5, costMult:1.34 },
    { name:"TP印刷工場",     base:80,     baseCost:3e7,   costMult:1.36 },
    { name:"AI労働センター", base:2500,   baseCost:1.2e10,costMult:1.39 },
    { name:"量子タップ炉",   base:120000, baseCost:7e13,  costMult:1.42 },
    { name:"異次元プラント", base:8e6,    baseCost:2e18,  costMult:1.46 },
  ],
  life:[
    { name:"公園のベンチ",      cost:0,     tap:1,     auto:1 },
    { name:"ネットカフェ暮らし",cost:8000,  tap:3.5,   auto:1.9 },
    { name:"ボロアパート",      cost:3e5,   tap:12,    auto:5 },
    { name:"分譲マンション",    cost:1.2e7, tap:45,    auto:15 },
    { name:"タワマン最上階",    cost:9e8,   tap:180,   auto:50 },
    { name:"丘の上の大豪邸",    cost:8e10,  tap:800,   auto:170 },
    { name:"プライベート島",    cost:1e13,  tap:3800,  auto:600 },
    { name:"月面ヴィラ",        cost:2e15,  tap:19000, auto:2200 },
    { name:"火星コロニー領主",  cost:6e17,  tap:1e5,   auto:8500 },
    { name:"銀河系オーナー",    cost:3e20,  tap:6e5,   auto:35000 },
  ],
  recycle:{ baseCost:150, costMult:10, multPerLv:1.5 },
};

/* ---------- 乱数 ---------- */
function gauss(){ let u=0,v=0; while(!u)u=Math.random(); while(!v)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
function poisson(l){ if(l<=0)return 0; if(l>30) return Math.max(0,Math.round(l+Math.sqrt(l)*gauss()));
  const L=Math.exp(-l); let k=0,p=1; do{k++;p*=Math.random();}while(p>L); return k-1; }
function binom(n,p){ if(n<=0||p<=0)return 0; if(p>=1)return n;
  if(n<64){ let c=0; for(let i=0;i<n;i++) if(Math.random()<p)c++; return c; }
  const m=n*p; if(m<30) return Math.min(n,poisson(m));
  return Math.max(0,Math.min(n,Math.round(m+Math.sqrt(m*(1-p))*gauss()))); }

/* ---------- シミュレーション本体 ---------- */
const BUYS_PER_MIN = 64;

function simulate(C, {hours, playMinPerDay, comboTimeLv=0, offlineHours=2, adsPerDay=0, hitRate=0.9}){
  const F=C.facilities, L=C.life, R=C.recycle;
  const S={ money:0, manualTP:0, autoTP:0, lose:0,
            facLv:F.map(()=>0), lifeLv:0, recLv:0,
            firstWins:0, superWins:0, superUnlocked:false,
            tickets:0, capHits:0, throttleMin:0 };

  const facProdAt=(i,lv)=> lv<=0?0:F[i].base*lv*Math.pow(C.prodExp,lv);
  const recMult=()=>Math.pow(R.multPerLv,S.recLv);
  const rate=()=>{ let s=0; for(let i=0;i<F.length;i++) s+=facProdAt(i,S.facLv[i]);
                   return s*L[S.lifeLv].auto*recMult(); };

  function draw(n){
    let prize=0,win=0,sup=0;
    for(const t of TIERS){
      let c=binom(n,t.count/UNIT);
      if(t.key==="first"&&c>0&&S.superUnlocked){ sup=binom(c,SUPER_RATE); c-=sup; }
      if(c>0){ prize+=t.prize*c; win+=c; if(t.key==="first") S.firstWins+=c; }
    }
    if(sup>0){ prize+=SUPER_PRIZE*sup; win+=sup; S.superWins+=sup; }
    if(S.firstWins>0) S.superUnlocked=true;
    S.money+=prize; S.lose+=n-win; S.tickets+=n;
  }
  function spendTP(){
    let throttled=false;
    for(const pool of ["manualTP","autoTP"]){
      let g=0;
      while(g++<BUYS_PER_MIN){
        let n;
        if(C.trueMax) n=Math.floor(S[pool]/TICKET_COST);
        else { let e=0; while(e<C.maxExp&&Math.pow(10,e+1)*TICKET_COST<=S[pool]) e++;
               n=Math.pow(10,e); if(e>=C.maxExp) S.capHits++; }
        const cost=n*TICKET_COST;
        if(n<1||S[pool]<cost) break;
        S[pool]-=cost; draw(n);
      }
      if(g>BUYS_PER_MIN) throttled=true;
    }
    if(throttled) S.throttleMin++;
  }
  function spendMoney(){
    let g=0;
    while(g++<4000){
      const cur=rate();
      let best=null;
      for(let i=0;i<F.length;i++){
        const c=F[i].baseCost*Math.pow(F[i].costMult,S.facLv[i]);
        if(c>S.money) continue;
        const gain=(facProdAt(i,S.facLv[i]+1)-facProdAt(i,S.facLv[i]))*L[S.lifeLv].auto*recMult();
        if(gain>0&&(!best||gain/c>best.eff)) best={t:"f",i,c,eff:gain/c};
      }
      const nx=L[S.lifeLv+1];
      if(nx&&nx.cost<=S.money){
        const gain=cur*(nx.auto/L[S.lifeLv].auto-1);
        const eff=(gain>0?gain:cur)/Math.max(nx.cost,1)*1.5;
        if(!best||eff>best.eff) best={t:"l",c:nx.cost,eff};
      }
      if(!best) break;
      S.money-=best.c;
      if(best.t==="f") S.facLv[best.i]++; else S.lifeLv++;
    }
    let g2=0;
    while(g2++<200){
      const c=R.baseCost*Math.pow(R.costMult,S.recLv);
      if(S.lose<c) break;
      S.lose-=c; S.recLv++;
    }
  }

  const marks={}, log=[];
  const step=60, activePerDay=playMinPerDay*60;
  let leftToday=activePerDay, adsToday=adsPerDay, day=0, offAcc=0;

  for(let sec=0; sec<hours*3600; sec+=step){
    const d=Math.floor(sec/86400);
    if(d!==day){ day=d; leftToday=activePerDay; adsToday=adsPerDay; }
    const active=leftToday>0;
    if(active){
      leftToday-=step;
      S.autoTP+=rate()*step;
      let t=0,combo=0;
      while(t<step){
        const dur=Math.max(620,1600-combo*22)*(comboTimeLv>=2?2:comboTimeLv>=1?1.5:1)/1000;
        t+=dur*0.55;
        if(Math.random()<hitRate){ S.manualTP+=L[S.lifeLv].tap*(1+Math.min(combo,100)*0.05); combo++; }
        else combo=0;
      }
      if(offAcc>0){ S.autoTP+=rate()*offAcc; offAcc=0; }
      if(adsToday>0){ S.autoTP+=rate()*1800; adsToday--; }
    } else offAcc=Math.min(offAcc+step, offlineHours*3600);

    spendTP(); spendMoney();

    for(let i=1;i<L.length;i++) if(S.lifeLv>=i&&marks["life"+i]===undefined) marks["life"+i]=sec;
    if(S.firstWins>0&&marks.first===undefined) marks.first=sec;
    if(S.superWins>0&&marks.super===undefined) marks.super=sec;
    if(sec%3600===0) log.push({h:sec/3600,money:S.money,rate:rate(),idle:S.manualTP+S.autoTP,
                               tickets:S.tickets,lifeLv:S.lifeLv,recLv:S.recLv});
  }
  return {S,marks,log,rate:rate()};
}

/* ---------- 出力 ---------- */
const fmtT=s=>{ if(s===undefined) return "未到達";
  const h=Math.floor(s/3600), d=Math.floor(h/24);
  if(d>0) return `${d}日${String(h%24).padStart(2)}h`;
  if(h>0) return `${h}h${String(Math.floor(s%3600/60)).padStart(2,"0")}m`;
  return `${Math.floor(s/60)}分`; };
const U=[[1e40,"正"],[1e36,"澗"],[1e32,"溝"],[1e28,"穣"],[1e24,"秭"],[1e20,"垓"],[1e16,"京"],[1e12,"兆"],[1e8,"億"],[1e4,"万"]];
function fmt(n){ if(!isFinite(n))return "∞";
  for(const [v,u] of U) if(n>=v) return (n/v>=100?Math.round(n/v).toLocaleString():(n/v).toFixed(2))+u;
  return Math.round(n).toLocaleString(); }
const med=a=>{ const b=[...a].sort((x,y)=>x-y); return b[Math.floor(b.length/2)]; };
const arg=k=>{ const m=process.argv.find(a=>a.startsWith(`--${k}=`)); return m?Number(m.split("=")[1]):undefined; };

const HOURS=arg("hours")??336, RUNS=arg("runs")??15;
const SC={ playMinPerDay:30, comboTimeLv:0, offlineHours:2, adsPerDay:3 };

console.log(`\n=== 現行 vs 調整案 （標準プレイ: 1日30分・広告3回 / ${HOURS}時間 / 各${RUNS}回・中央値）===\n`);

const CONFIGS=[CURRENT,UNCAPPED,MID];
const res={};
for(const C of CONFIGS){
  const rs=[]; for(let i=0;i<RUNS;i++) rs.push(simulate(C,{hours:HOURS,...SC}));
  res[C.label]=rs;
}
const row=(name,fn)=>{
  console.log(`  ${name.padEnd(12,"　")}` + CONFIGS.map(C=>`${C.label}: ${String(fn(res[C.label])).padStart(13)}`).join("  "));
};
row("最終資産",       rs=>fmt(med(rs.map(r=>r.S.money)))+" G");
row("最終自動生産",   rs=>fmt(med(rs.map(r=>r.rate)))+" TP/s");
row("購入枚数",       rs=>fmt(med(rs.map(r=>r.S.tickets)))+" 枚");
row("到達生活Lv",     rs=>med(rs.map(r=>r.S.lifeLv))+" / 9");
row("再生Lv",         rs=>med(rs.map(r=>r.S.recLv)));
row("未消化TP",       rs=>fmt(med(rs.map(r=>r.S.manualTP+r.S.autoTP))));
row("上限張り付き購入",rs=>fmt(med(rs.map(r=>r.S.capHits)))+" 回");
row("消化不能だった分",rs=>fmt(med(rs.map(r=>r.S.throttleMin)))+" 分");
console.log("");

console.log("  マイルストーン到達時刻（中央値）");
const names=CURRENT.life.map(x=>x.name);
const reach=(rs,k)=>{ const v=rs.map(r=>r.marks[k]).filter(x=>x!==undefined);
                      return v.length>=Math.ceil(RUNS/2)?fmtT(med(v)):"未到達"; };
const mrow=(label,k)=> console.log(`    ${label.padEnd(11,"　")}`+CONFIGS.map(C=>`${C.label}: ${reach(res[C.label],k).padStart(9)}`).join("  "));
for(let i=1;i<names.length;i++) mrow(names[i],"life"+i);
mrow("一等 初当たり","first");
mrow("超一等 初当たり","super");
console.log("");

/* 長期（60日）で最上位まで届くか */
console.log("  長期到達性（1日30分・広告3回・60日 / 各5回）");
for(const C of CONFIGS){
  const rs=[]; for(let i=0;i<5;i++) rs.push(simulate(C,{hours:1440,...SC}));
  console.log(`    ${C.label.padEnd(6,"　")} 到達生活Lv ${med(rs.map(r=>r.S.lifeLv))}/9   資産 ${fmt(med(rs.map(r=>r.S.money))).padStart(12)} G   未消化TP ${fmt(med(rs.map(r=>r.S.manualTP+r.S.autoTP))).padStart(10)}`);
}
console.log("");

/* 課金要素の効き目（調整案のうえで検証） */
console.log("  課金・広告の効き目（中間案 / 168時間時点の自動生産の中央値）");
const variants=[
  ["無課金・広告なし",            {comboTimeLv:0,offlineHours:2, adsPerDay:0}],
  ["広告3回のみ",                 {comboTimeLv:0,offlineHours:2, adsPerDay:3}],
  ["コンボ時間2倍",               {comboTimeLv:2,offlineHours:2, adsPerDay:3}],
  ["オフライン24h",               {comboTimeLv:0,offlineHours:24,adsPerDay:3}],
  ["フル課金",                    {comboTimeLv:2,offlineHours:24,adsPerDay:3}],
];
for(const [label,ov] of variants){
  const rs=[]; for(let i=0;i<RUNS;i++) rs.push(simulate(MID,{hours:336,playMinPerDay:30,...ov}));
  const t=k=>reach(rs,k);
  console.log(`    ${label.padEnd(16,"　")} 一等 ${t("first").padStart(9)}   生活Lv9 ${t("life9").padStart(9)}   14日後 ${fmt(med(rs.map(r=>r.rate))).padStart(10)} TP/s`);
}
console.log("");

/* 調整案の進行カーブ */
const demo=simulate(MID,{hours:HOURS,...SC});
console.log("  中間案の進行カーブ");
console.log("    時間      資産           自動TP/秒      未消化TP      購入枚数    生活Lv 再生Lv");
for(const p of demo.log){
  if(p.h%24!==0) continue;
  console.log(`    ${String(p.h).padStart(4)}h ${fmt(p.money).padStart(13)} ${fmt(p.rate).padStart(13)} ${fmt(p.idle).padStart(12)} ${fmt(p.tickets).padStart(12)} ${String(p.lifeLv).padStart(5)} ${String(p.recLv).padStart(5)}`);
}
console.log("");
