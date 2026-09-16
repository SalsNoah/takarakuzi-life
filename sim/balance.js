/* 宝くじ生活 バランス検証シミュレーター
   index.html の数式をそのまま移植し、放置＋労働の進行を時間軸で追う。
   使い方: node sim/balance.js [--hours=168] [--play=30] [--runs=20] */

const UNIT = 20000000;
const TICKET_COST = 20;
const TIERS = [
  { key:"first",  prize:700000000, count:1 },
  { key:"around", prize:150000000, count:2 },
  { key:"kumi",   prize:100000,    count:199 },
  { key:"second", prize:10000000,  count:3 },
  { key:"third",  prize:1000000,   count:100 },
  { key:"fourth", prize:50000,     count:2000 },
  { key:"fifth",  prize:10000,     count:60000 },
  { key:"sixth",  prize:3000,      count:200000 },
  { key:"seventh",prize:300,       count:2000000 },
];
const SUPER_PRIZE = 70000000000;
const SUPER_RATE = 0.01;
const EV = TIERS.reduce((s,t)=>s+t.prize*t.count,0)/UNIT;

const FACILITIES = [
  { name:"貯金箱ロボ",      base:0.1,    baseCost:200,   costMult:1.25 },
  { name:"内職マシン",      base:3,      baseCost:8e4,   costMult:1.28 },
  { name:"TP印刷工場",      base:80,     baseCost:1.2e7, costMult:1.30 },
  { name:"AI労働センター",  base:2500,   baseCost:4e9,   costMult:1.33 },
  { name:"量子タップ炉",    base:120000, baseCost:2e13,  costMult:1.36 },
  { name:"異次元プラント",  base:8e6,    baseCost:5e17,  costMult:1.40 },
];
const LIFE_LEVELS = [
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
];
const RECYCLE = { baseCost:100, costMult:8, multPerLv:1.6 };
const MAX_EXP = 8;
const LUXURIES = [500,3e4,3e5,3e6,3e7,2e8,1e9,9e9,7e10,8e11,2e13,6e14,4e16,9e17,5e19,2e22,7e25,3e29,8e34];

/* ---------- 乱数（本体と同じ近似） ---------- */
function gauss(){
  let u=0,v=0;
  while(!u) u=Math.random();
  while(!v) v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
function poisson(l){
  if(l<=0) return 0;
  if(l>30) return Math.max(0, Math.round(l+Math.sqrt(l)*gauss()));
  const L=Math.exp(-l); let k=0,p=1;
  do{ k++; p*=Math.random(); }while(p>L);
  return k-1;
}
function binom(n,p){
  if(n<=0||p<=0) return 0;
  if(p>=1) return n;
  if(n<64){ let c=0; for(let i=0;i<n;i++) if(Math.random()<p) c++; return c; }
  const mean=n*p;
  if(mean<30) return Math.min(n,poisson(mean));
  return Math.max(0, Math.min(n, Math.round(mean+Math.sqrt(mean*(1-p))*gauss())));
}

/* ---------- 状態 ---------- */
function newState(){
  return {
    money:0, manualTP:0, autoTP:0, loseTickets:0,
    facLv:FACILITIES.map(()=>0), lifeLv:0, recycleLv:0,
    luxOwned:LUXURIES.map(()=>false),
    firstWins:0, superWins:0, superUnlocked:false,
    ticketsBought:0, totalWinnings:0,
    comboTimeLv:0, capHits:0, throttled:0,
  };
}
const facProdAt=(i,lv)=> lv<=0?0:FACILITIES[i].base*lv*Math.pow(1.12,lv);
const facProd=(S,i)=>facProdAt(i,S.facLv[i]);
const lifeAuto=S=>LIFE_LEVELS[S.lifeLv].auto;
const tapPower=S=>LIFE_LEVELS[S.lifeLv].tap;
const recycleMult=S=>Math.pow(RECYCLE.multPerLv,S.recycleLv);
function autoRate(S){
  let s=0;
  for(let i=0;i<FACILITIES.length;i++) s+=facProd(S,i);
  return s*lifeAuto(S)*recycleMult(S);
}
const facCost=(S,i)=>FACILITIES[i].baseCost*Math.pow(FACILITIES[i].costMult,S.facLv[i]);
const recycleCost=S=>RECYCLE.baseCost*Math.pow(RECYCLE.costMult,S.recycleLv);

/* ---------- 抽選 ---------- */
function draw(S,n){
  let prize=0,winners=0,sup=0;
  for(const t of TIERS){
    let c=binom(n,t.count/UNIT);
    if(t.key==="first"&&c>0&&S.superUnlocked){ sup=binom(c,SUPER_RATE); c-=sup; }
    if(c>0){ prize+=t.prize*c; winners+=c; if(t.key==="first") S.firstWins+=c; }
  }
  if(sup>0){ prize+=SUPER_PRIZE*sup; winners+=sup; S.superWins+=sup; }
  if(S.firstWins>0) S.superUnlocked=true;
  S.money+=prize; S.totalWinnings+=prize;
  S.loseTickets+=n-winners; S.ticketsBought+=n;
  return prize;
}

/* ---------- プレイヤー方針 ---------- */
// TP は「10のべき乗」でまとめ買い。買えるだけ買う。
// 1 分あたりの購入操作回数の上限（＝実プレイでの連打限界。約 1 回/秒）
const BUYS_PER_MIN = 64;
function spendTP(S){
  for(const pool of ["manualTP","autoTP"]){
    let guard=0;
    while(guard++<BUYS_PER_MIN){
      let e=0;
      while(e<MAX_EXP && Math.pow(10,e+1)*TICKET_COST<=S[pool]) e++;
      const n=Math.pow(10,e), cost=n*TICKET_COST;
      if(S[pool]<cost) break;
      if(e>=MAX_EXP) S.capHits++;
      S[pool]-=cost;
      draw(S,n);
    }
    if(guard>BUYS_PER_MIN) S.throttled++;   // 連打上限で消化しきれなかった分
  }
}
// 所持金は「自動生産の伸び / コスト」が最大の投資へ。生活・再生も候補に含める。
function spendMoney(S){
  let guard=0;
  while(guard++<4000){
    const cur=autoRate(S);
    let best=null;
    for(let i=0;i<FACILITIES.length;i++){
      const c=facCost(S,i);
      if(c>S.money) continue;
      const before=facProd(S,i), after=facProdAt(i,S.facLv[i]+1);
      const gain=(after-before)*lifeAuto(S)*recycleMult(S);
      const eff=gain/c;
      if(gain>0&&(!best||eff>best.eff)) best={type:"fac",i,cost:c,eff};
    }
    const nx=LIFE_LEVELS[S.lifeLv+1];
    if(nx&&nx.cost<=S.money){
      const gain=cur*(nx.auto/lifeAuto(S)-1);
      // 生活は手動 TP も伸ばすため、効率が僅差でも優先されるよう下駄を履かせる
      const eff=(gain>0?gain:cur)/Math.max(nx.cost,1)*1.5;
      if(!best||eff>best.eff) best={type:"life",cost:nx.cost,eff};
    }
    if(!best) break;
    if(best.type==="fac"){ S.money-=best.cost; S.facLv[best.i]++; }
    else { S.money-=best.cost; S.lifeLv++; }
  }
  // 再生はハズレ券専用。買えるなら常に買う（自動生産に複利）
  let g2=0;
  while(g2++<200){
    const c=recycleCost(S);
    if(S.loseTickets<c) break;
    S.loseTickets-=c; S.recycleLv++;
  }
  // 嗜好品は資産の 1% 以内なら買う（進行を阻害しない範囲の浪費）
  for(let i=0;i<LUXURIES.length;i++){
    if(!S.luxOwned[i]&&LUXURIES[i]<=S.money*0.01){ S.money-=LUXURIES[i]; S.luxOwned[i]=true; }
  }
}

/* ---------- 1 回のプレイを時間で回す ---------- */
// playMinPerDay: 1日に能動的に労働する分数。残りは放置（オフライン上限つき）。
function simulate({hours=168, playMinPerDay=30, comboTimeLv=0, offlineHours=2, adsPerDay=0, hitRate=0.9}={}){
  const S=newState();
  S.comboTimeLv=comboTimeLv;
  const log=[];
  const marks={};
  const stepSec=60;                       // 1分刻み
  const activeSecPerDay=playMinPerDay*60;
  let activeLeftToday=activeSecPerDay;
  let adsLeftToday=adsPerDay;
  let dayIdx=0;
  let offlineAccum=0;

  for(let sec=0; sec<hours*3600; sec+=stepSec){
    const d=Math.floor(sec/86400);
    if(d!==dayIdx){ dayIdx=d; activeLeftToday=activeSecPerDay; adsLeftToday=adsPerDay; }

    const active=activeLeftToday>0;
    if(active){
      // 能動プレイ中：自動生産はリアルタイム、labor も回す
      activeLeftToday-=stepSec;
      S.autoTP+=autoRate(S)*stepSec;

      // 労働：連鎖を維持しながら叩く。1打あたりの平均間隔＝持ち時間の 55%
      let t=0, combo=0;
      while(t<stepSec){
        const dur=Math.max(620,1600-combo*22)*(comboTimeLv>=2?2:comboTimeLv>=1?1.5:1)/1000;
        const interval=dur*0.55;
        t+=interval;
        if(Math.random()<hitRate){
          S.manualTP+=tapPower(S)*(1+Math.min(combo,100)*0.05);
          combo++;
        } else combo=0;
      }
    } else {
      // 放置：オフライン上限まで貯まる
      offlineAccum=Math.min(offlineAccum+stepSec, offlineHours*3600);
    }

    // 復帰時にオフライン分を回収（1日の能動プレイ開始時に相当）
    if(active&&offlineAccum>0){ S.autoTP+=autoRate(S)*offlineAccum; offlineAccum=0; }
    if(active&&adsLeftToday>0){ S.autoTP+=autoRate(S)*30*60; adsLeftToday--; }

    spendTP(S);
    spendMoney(S);

    // マイルストーン記録
    for(let i=1;i<LIFE_LEVELS.length;i++){
      if(S.lifeLv>=i&&marks["life"+i]===undefined) marks["life"+i]=sec;
    }
    if(S.firstWins>0&&marks.first===undefined) marks.first=sec;
    if(S.superWins>0&&marks.super===undefined) marks.super=sec;

    if(sec%3600===0) log.push({h:sec/3600, money:S.money, rate:autoRate(S), tickets:S.ticketsBought,
                               lifeLv:S.lifeLv, idleTP:S.manualTP+S.autoTP, recLv:S.recycleLv});
  }
  return {S, marks, log};
}

/* ---------- 出力 ---------- */
const fmtT=s=>{
  if(s===undefined) return "未到達";
  const h=Math.floor(s/3600), d=Math.floor(h/24);
  if(d>0) return `${d}日${h%24}時間`;
  if(h>0) return `${h}時間${Math.floor(s%3600/60)}分`;
  return `${Math.floor(s/60)}分`;
};
const UNITS=[[1e40,"正"],[1e36,"澗"],[1e32,"溝"],[1e28,"穣"],[1e24,"秭"],[1e20,"垓"],[1e16,"京"],[1e12,"兆"],[1e8,"億"],[1e4,"万"]];
function fmt(n){
  if(!isFinite(n)) return "∞";
  for(const [v,u] of UNITS) if(n>=v) return (n/v>=100?Math.round(n/v).toLocaleString():(n/v).toFixed(2))+u;
  return Math.round(n).toLocaleString();
}
const median=a=>{ const b=[...a].sort((x,y)=>x-y); return b[Math.floor(b.length/2)]; };

const arg=k=>{ const m=process.argv.find(a=>a.startsWith(`--${k}=`)); return m?Number(m.split("=")[1]):undefined; };
const HOURS=arg("hours")??168;
const PLAY=arg("play")??30;
const RUNS=arg("runs")??20;

const scenarios=[
  { label:"ライト（1日10分・無課金）",       playMinPerDay:10, comboTimeLv:0, offlineHours:2,  adsPerDay:0 },
  { label:"標準（1日30分・広告3回）",        playMinPerDay:30, comboTimeLv:0, offlineHours:2,  adsPerDay:3 },
  { label:"ヘビー（1日90分・広告3回）",      playMinPerDay:90, comboTimeLv:0, offlineHours:2,  adsPerDay:3 },
  { label:"課金（1日30分・全強化・24h放置）",playMinPerDay:30, comboTimeLv:2, offlineHours:24, adsPerDay:3 },
];

console.log(`\n=== 宝くじ生活 バランス検証 (${HOURS}時間 / 各${RUNS}回) ===`);
console.log(`1枚あたり理論期待値: ${EV.toFixed(1)} G  (20 TP → 1 TP ≒ ${(EV/TICKET_COST).toFixed(2)} G)\n`);

for(const sc of scenarios){
  const runs=[];
  for(let r=0;r<RUNS;r++) runs.push(simulate({hours:HOURS, ...sc}));
  const pick=k=>runs.map(r=>r.marks[k]).filter(v=>v!==undefined);
  const reach=k=>{ const v=pick(k); return v.length? `${fmtT(median(v))} (${v.length}/${RUNS})` : "未到達"; };

  console.log(`■ ${sc.label}`);
  console.log(`   最終資産(中央値)   : ${fmt(median(runs.map(r=>r.S.money)))} G`);
  console.log(`   最終自動生産(中央) : ${fmt(median(runs.map(r=>autoRate(r.S))))} TP/秒`);
  console.log(`   購入枚数(中央)     : ${fmt(median(runs.map(r=>r.S.ticketsBought)))} 枚`);
  console.log(`   到達生活Lv(中央)   : ${median(runs.map(r=>r.S.lifeLv))} / ${LIFE_LEVELS.length-1}`);
  console.log(`   嗜好品(中央)       : ${median(runs.map(r=>r.S.luxOwned.filter(Boolean).length))} / ${LUXURIES.length}`);
  console.log(`   一等 初当たり      : ${reach("first")}`);
  console.log(`   超一等 初当たり    : ${reach("super")}`);
  for(let i=1;i<LIFE_LEVELS.length;i++){
    const v=pick("life"+i);
    if(v.length) console.log(`     └ ${LIFE_LEVELS[i].name.padEnd(11,"　")}: ${fmtT(median(v))}`);
  }
  console.log("");
}

/* 進行カーブ（標準シナリオ 1本） */
const demo=simulate({hours:HOURS, playMinPerDay:30, comboTimeLv:0, offlineHours:2, adsPerDay:3});
console.log("■ 標準シナリオの進行カーブ");
console.log("   時間      資産            自動TP/秒        未消化TP        購入枚数    生活Lv 再生Lv");
for(const p of demo.log){
  if(p.h%12!==0) continue;
  console.log(`   ${String(p.h).padStart(4)}h  ${fmt(p.money).padStart(12)}  ${fmt(p.rate).padStart(12)}  ${fmt(p.idleTP).padStart(12)}  ${fmt(p.tickets).padStart(10)}  ${String(p.lifeLv).padStart(4)}  ${String(p.recLv).padStart(4)}`);
}
console.log(`\n   まとめ買い上限(10^${MAX_EXP}枚)に張り付いた購入: ${fmt(demo.S.capHits)} 回`);
console.log(`   連打上限で TP を消化しきれなかった分: ${fmt(demo.S.throttled)} 回\n`);

/* 序盤 3 時間の分刻み（最初の体験の速さを確認） */
const early=simulate({hours:3, playMinPerDay:180, comboTimeLv:0, offlineHours:2, adsPerDay:0});
console.log("■ 序盤の到達速度（ずっと労働し続けた場合）");
for(let i=1;i<LIFE_LEVELS.length;i++){
  const t=early.marks["life"+i];
  console.log(`   ${LIFE_LEVELS[i].name.padEnd(11,"　")} (${fmt(LIFE_LEVELS[i].cost).padStart(8)} G) : ${fmtT(t)}`);
}
console.log(`   一等 初当たり : ${fmtT(early.marks.first)}`);
console.log("");
