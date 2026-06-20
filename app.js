
let purchaseIndex=0,deferredInstallPrompt=null;
function saveAppMatch(){localStorage.setItem('central-match',JSON.stringify({myHero:myHero?.name||null,enemies:enemyTeam.map(h=>h.name),purchaseIndex}));}
function restoreAppMatch(){try{const a=JSON.parse(localStorage.getItem('central-match')||'{}');myHero=heroList.find(h=>h.name===a.myHero)||null;enemyTeam=(a.enemies||[]).map(n=>heroList.find(h=>h.name===n)).filter(Boolean).slice(0,5);purchaseIndex=Math.min(6,Number(a.purchaseIndex)||0);renderMyHeroSlot();renderSlots();renderMG();renderCR();}catch(e){}}
function appAvatar(h){return `<div class="live-avatar">${h.icon}${hSrc(h.wn)?`<img src="${hSrc(h.wn)}" alt="${h.name}" onerror="this.style.display='none'">`:''}</div>`;}
function markBought(){purchaseIndex=Math.min(6,purchaseIndex+1);saveAppMatch();renderLiveMatch();}
function resetPurchases(){purchaseIndex=0;saveAppMatch();renderLiveMatch();}
function renderLiveMatch(){
 const el=document.getElementById('live-match');if(!el)return;
 if(!myHero||!enemyTeam.length){el.innerHTML=`<div class="live-card live-empty"><strong>Set up your match first</strong>Pick your hero and at least one enemy.<br><button class="live-setup" onclick="switchTab('counter')">Set Up Match</button></div>`;return;}
 const b=buildCounterBuild(myHero),done=purchaseIndex>=6,n=b[Math.min(purchaseIndex,5)];
 const why=n?.reasons?.length?[...new Set(n.reasons)].map(v=>v.replace(/<[^>]+>/g,'')).join(' · '):`${n?.t||'Core item'} for ${myHero.name}`;
 el.innerHTML=`<div class="live-card live-bar">${appAvatar(myHero)}<div><div class="live-kicker">Live Match Assistant</div><div class="live-title">${myHero.name}</div><div class="live-sub">${enemyTeam.length} enemies selected</div></div><button class="live-edit" onclick="switchTab('counter')">Edit</button></div>
 <div class="live-card buy-next"><div class="buy-label">${done?'Build Complete':'Buy Next'}</div>${done?`<div class="buy-image">✓</div><div class="buy-name">Full Build Ready</div><button class="buy-action" onclick="resetPurchases()">Reset Build</button>`:`<div class="buy-image">${n.e}<img src="${iSrc(n.n)}" alt="${n.n}" onerror="this.style.display='none'"></div><div class="buy-name">${n.n}</div><div class="buy-reason">${why}</div><button class="buy-action" onclick="markBought()">✓ Mark Bought</button>`}</div>
 <div class="live-card"><div class="build-track">${b.map((v,i)=>`<div class="track-item ${i<purchaseIndex?'bought':i===purchaseIndex?'current':''}"><div class="track-img">${v.e}<img src="${iSrc(v.n)}" alt="${v.n}" onerror="this.style.display='none'"></div><div class="track-name">${i+1}. ${v.n}</div></div>`).join('')}</div></div>
 <div class="live-card"><div class="enemy-row">${enemyTeam.map(h=>`<div class="enemy-chip">${appAvatar(h)}${h.name}</div>`).join('')}</div></div>`;
}
switchTab=function(t){document.querySelectorAll('.tab').forEach((el,i)=>el.classList.toggle('active',['builds','counter','live','scan'][i]===t));document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById('page-'+t).classList.add('active');if(t==='live')renderLiveMatch();};
const baseSet=setMyHero;setMyHero=function(n){baseSet(n);purchaseIndex=0;saveAppMatch();renderLiveMatch();};
const baseClear=clearMyHero;clearMyHero=function(){baseClear();purchaseIndex=0;saveAppMatch();renderLiveMatch();};
const baseAdd=addE;addE=function(n){baseAdd(n);purchaseIndex=0;saveAppMatch();renderLiveMatch();};
const baseRemove=removeE;removeE=function(n){baseRemove(n);purchaseIndex=0;saveAppMatch();renderLiveMatch();};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;document.getElementById('install-app-btn').hidden=false;});
document.getElementById('install-app-btn').onclick=async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;document.getElementById('install-app-btn').hidden=true;};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
restoreAppMatch();renderLiveMatch();
