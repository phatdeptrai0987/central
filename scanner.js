
let scanImage=null,scanData={heroes:[],kdas:[],portraits:[],text:''},ocrPromise=null,portraitTemplates=null;
function scanNorm(s){return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g,'');}
function parseScanText(text){
 const packed=scanNorm(text),words=text.toLowerCase().split(/[^a-z0-9.'-]+/).map(scanNorm);
 const heroes=heroList.filter(h=>{const n=scanNorm(h.name);return n.length<=3?words.includes(n):packed.includes(n);}).map(h=>h.name);
 const kdas=[];const re=/\b(\d{1,2})\s*[\/|\\]\s*(\d{1,2})\s*[\/|\\]\s*(\d{1,2})\b/g;let m;
 while((m=re.exec(text))&&kdas.length<10)kdas.push({k:+m[1],d:+m[2],a:+m[3]});
 const spaced=[/\b(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+\d{3,5}\b/g,/\b\d{3,5}\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\b/g];
 for(const pattern of spaced)while((m=pattern.exec(text))&&kdas.length<10){const value={k:+m[1],d:+m[2],a:+m[3]};if(!kdas.some(v=>v.k===value.k&&v.d===value.d&&v.a===value.a))kdas.push(value);}
 return{heroes:[...new Set(heroes)],kdas,text};
}
window.parseScanText=parseScanText;
function renderScanTool(){
 const el=document.getElementById('scan-tool');if(!el)return;
 el.innerHTML=`<div class="scan-card"><div class="scan-title">📷 Scan MLBB Scoreboard</div><div class="scan-sub">Take a screenshot during the match, then select it here. Central reads visible hero names and KDA on your iPhone.</div><label class="scan-drop">Choose Scoreboard Screenshot<input id="scan-file" type="file" accept="image/*"></label><img class="scan-preview" id="scan-preview"><div class="scan-progress" id="scan-progress"><div class="scan-track"><div class="scan-fill" id="scan-fill"></div></div><div class="scan-status" id="scan-status">Preparing scanner…</div></div><div class="privacy-note">🔒 Processed on this device. Central does not upload your screenshot.</div></div><div class="scan-card scan-results" id="scan-results"><div class="scan-sub">Results will appear here after scanning.</div></div>`;
 document.getElementById('scan-file').addEventListener('change',e=>{if(e.target.files[0])scanScreenshot(e.target.files[0]);});
}
async function ensureOCR(){
 if(window.Tesseract)return window.Tesseract;
 if(!ocrPromise)ocrPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js';s.onload=()=>resolve(window.Tesseract);s.onerror=()=>reject(new Error('Scanner engine could not load'));document.head.appendChild(s);});
 return ocrPromise;
}
function updateScanProgress(p,label){
 const box=document.getElementById('scan-progress'),fill=document.getElementById('scan-fill'),status=document.getElementById('scan-status');box.style.display='block';fill.style.width=Math.round(p*100)+'%';status.textContent=label;
}
async function prepareScanImage(file){
 const url=URL.createObjectURL(file),img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url;});
 const max=1800,scale=Math.min(1,max/img.width),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
 const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<d.data.length;i+=4){let v=(d.data[i]*.3+d.data[i+1]*.59+d.data[i+2]*.11-128)*1.45+128;v=Math.max(0,Math.min(255,v));d.data[i]=d.data[i+1]=d.data[i+2]=v;}
 ctx.putImageData(d,0,0);URL.revokeObjectURL(url);return c.toDataURL('image/jpeg',.92);
}
function scanLoadImage(src){return new Promise((ok,no)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=no;img.src=src;});}
function portraitFeature(img,cx,cy,size){
 const c=document.createElement('canvas'),n=12;c.width=c.height=n;const ctx=c.getContext('2d'),inner=size*.76;
 ctx.drawImage(img,cx-inner/2,cy-inner/2,inner,inner,0,0,n,n);
 const data=ctx.getImageData(0,0,n,n).data,out=[];
 for(let i=0;i<data.length;i+=4){const sum=data[i]+data[i+1]+data[i+2]+1;out.push(data[i]/sum,data[i+1]/sum,data[i+2]/sum,(data[i]+data[i+1]+data[i+2])/765);}
 return out;
}
function portraitDistance(a,b){let d=0;for(let i=0;i<a.length;i++)d+=Math.abs(a[i]-b[i]);return d/a.length;}
function rowBrightness(img,side,y,size){
 const c=document.createElement('canvas');c.width=16;c.height=3;const ctx=c.getContext('2d'),x=side==='ally'?0:img.width*.91;
 ctx.drawImage(img,x,y-size*.38,img.width*.09,size*.76,0,0,c.width,c.height);
 const d=ctx.getImageData(0,0,c.width,c.height).data;let total=0;
 for(let i=0;i<d.length;i+=4)total+=d[i]*.299+d[i+1]*.587+d[i+2]*.114;
 return total/(d.length/4);
}
async function getPortraitTemplates(){
 if(portraitTemplates)return portraitTemplates;
 portraitTemplates=(await Promise.all(heroList.map(async h=>{const src=hSrc(h.wn);if(!src)return null;try{const img=await scanLoadImage(src),side=Math.min(img.width,img.height);return{hero:h,feature:portraitFeature(img,img.width/2,side/2,side)};}catch(_){return null;}}))).filter(Boolean);
 return portraitTemplates;
}
async function detectHeroPortraits(file){
 const url=URL.createObjectURL(file),img=await scanLoadImage(url),templates=await getPortraitTemplates();URL.revokeObjectURL(url);
 const rows=[.294,.428,.552,.679,.805],slots=[],size=img.height*.12;
 const light={ally:rows.map(y=>rowBrightness(img,'ally',img.height*y,size)),enemy:rows.map(y=>rowBrightness(img,'enemy',img.height*y,size))};
 const median=v=>[...v].sort((a,b)=>a-b)[2],allyBase=median(light.ally),enemyBase=median(light.enemy);
 const allyBest=Math.max(...light.ally.map(v=>v-allyBase)),enemyBest=Math.max(...light.enemy.map(v=>v-enemyBase));
 const mySide=allyBest>=enemyBest?'ally':'enemy',myRow=light[mySide].map(v=>v-(mySide==='ally'?allyBase:enemyBase)).indexOf(Math.max(allyBest,enemyBest));
 for(const side of [{name:'ally',x:.157},{name:'enemy',x:.846}]){
  for(let row=0;row<5;row++){
   const feature=portraitFeature(img,img.width*side.x,img.height*rows[row],size);
   const ranked=templates.map(t=>({hero:t.hero,score:portraitDistance(feature,t.feature)})).sort((a,b)=>a.score-b.score);
   slots.push({side:side.name,row,isMe:side.name===mySide&&row===myRow,isOpponent:side.name!==mySide,hero:ranked[0].hero.name,confidence:Math.max(0,Math.min(99,Math.round((1-ranked[0].score*2.3)*100))),alternatives:ranked.slice(1,3).map(v=>v.hero.name)});
  }
 }
 return slots;
}
async function scanScreenshot(file){
 const preview=document.getElementById('scan-preview');preview.src=URL.createObjectURL(file);preview.style.display='block';document.getElementById('scan-results').innerHTML='<div class="scan-sub">Reading screenshot…</div>';
 try{
  updateScanProgress(.03,'Matching hero portraits…');const portraits=await detectHeroPortraits(file);scanImage=await prepareScanImage(file);const T=await ensureOCR();updateScanProgress(.08,'Loading text recognition…');
  const worker=await T.createWorker('eng',1,{logger:m=>{if(m.progress)updateScanProgress(.1+m.progress*.85,m.status.replace(/_/g,' ')+'…');}});
  const out=await worker.recognize(scanImage);await worker.terminate();scanData={...parseScanText(out.data.text||''),portraits};
  const mine=portraits.find(p=>p.isMe),kdaIndex=mine?(mine.side==='ally'?mine.row:5+mine.row):-1;
  if(kdaIndex>=0&&scanData.kdas[kdaIndex]&&(mine.side==='ally'||scanData.kdas.length===10)){const v=scanData.kdas[kdaIndex];localStorage.setItem('central-live-kda',JSON.stringify(v));}
  updateScanProgress(1,'Scan complete');renderScanResults();
 }catch(e){document.getElementById('scan-results').innerHTML=`<div class="scan-error">Could not scan this image: ${e.message}. Try a clear landscape scoreboard screenshot.</div>`;updateScanProgress(0,'Scan failed');}
}
function applyScannedHero(name,type){if(type==='me')setMyHero(name);else addE(name);saveAppMatch();renderScanResults();}
function setScanKda(k,d,a){localStorage.setItem('central-live-kda',JSON.stringify({k,d,a}));renderScanResults();renderLiveMatch();}
function applyDetectedEnemies(){scanData.portraits.filter(p=>p.side==='enemy').forEach(p=>addE(p.hero));saveAppMatch();renderScanResults();}
function applyDetectedMatch(){
 const mine=scanData.portraits.find(p=>p.isMe);if(mine)setMyHero(mine.hero);
 enemyTeam=[];scanData.portraits.filter(p=>p.isOpponent).forEach(p=>{const h=heroList.find(v=>v.name===p.hero);if(h&&!enemyTeam.some(e=>e.name===h.name))enemyTeam.push(h);});
 purchaseIndex=0;renderSlots();renderMG();renderCR();saveAppMatch();renderLiveMatch();renderScanResults();
}
function changePortrait(side,row,name){const match=scanData.portraits.find(p=>p.side===side&&p.row===row);if(match){match.alternatives=[match.hero,...match.alternatives.filter(n=>n!==name)].slice(0,2);match.hero=name;match.confidence='confirmed';renderScanResults();}}
function manualPortrait(side,row){const typed=prompt('Type the correct hero name');if(!typed)return;const hero=heroList.find(h=>h.name.toLowerCase()===typed.trim().toLowerCase());if(hero)changePortrait(side,row,hero.name);else alert('Hero not found. Check the spelling and try again.');}
function renderScanResults(){
 const el=document.getElementById('scan-results'),saved=JSON.parse(localStorage.getItem('central-live-kda')||'null');
 let html='';
 html+='<div class="scan-section">Portrait matches</div>';
 html+=scanData.portraits?.length?scanData.portraits.map(p=>{const h=heroList.find(x=>x.name===p.hero),alts=p.alternatives.map(n=>`<button class="scan-action" onclick="changePortrait('${p.side}',${p.row},'${n.replace(/'/g,"\\'")}')">${n}</button>`).join(''),label=p.isMe?'YOU':p.isOpponent?'OPPONENT':'ALLY';return`<div class="detected-row" style="${p.isMe?'border-color:#3b82f688;box-shadow:0 0 20px #3b82f622':p.isOpponent?'border-color:#ef444433':''}">${appAvatar(h)}<div class="detected-name">${p.hero}<div class="kda-label">${label} · ${p.confidence==='confirmed'?'CONFIRMED':p.confidence+'% match'}</div><div class="scan-actions">${alts}<button class="scan-action" onclick="manualPortrait('${p.side}',${p.row})">Change…</button></div></div></div>`;}).join(''):'<div class="scan-sub">Portrait matching will appear after scanning.</div>';
 if(scanData.portraits?.length)html+='<button class="live-setup" onclick="applyDetectedMatch()">Use Detected Match</button>';
 if(scanData.heroes.length)html+='<div class="scan-section">Names found in text</div>'+scanData.heroes.map(n=>'<span class="scan-sub">'+n+'</span>').join(' · ');
 html+='<div class="scan-section">Detected KDA</div><div class="kda-grid">';
 html+=scanData.kdas.length?scanData.kdas.map(v=>`<button class="kda-card scan-action" onclick="setScanKda(${v.k},${v.d},${v.a})"><div class="kda-value">${v.k} / ${v.d} / ${v.a}</div><div class="kda-label">${saved&&saved.k===v.k&&saved.d===v.d&&saved.a===v.a?'✓ YOUR KDA':'TAP IF THIS IS YOU'}</div></button>`).join(''):'<div class="scan-sub">No K/D/A pattern was found.</div>';
 html+='</div><button class="live-setup" onclick="switchTab(\'live\')">Open Live Build</button><details><summary class="scan-sub">Show text Central read</summary><div class="ocr-raw">'+scanData.text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</div></details>';
 el.innerHTML=html;
}
const scanBaseBuild=buildCounterBuild;
buildCounterBuild=function(hero){
 const build=scanBaseBuild(hero),live=JSON.parse(localStorage.getItem('central-live-kda')||'null');
 if(!live)return build;
 if(live.k>=5&&live.k>=live.d*2&&hero.build[4]){
  const original=hero.build[4];
  build[4]={...original,kind:'core',reasons:[`Ahead at ${live.k}/${live.d}/${live.a}: keep your power-spike item`],prio:'med'};
  return build;
 }
 if(live.d>=4&&live.d>live.k){
  const magic=enemyTeam.filter(h=>h.roles.includes('Mage')).length;
  const physical=enemyTeam.filter(h=>h.roles.some(r=>['Marksman','Fighter','Assassin'].includes(r))).length;
  const name=magic>physical?"Athena's Shield":'Immortality';
  const base=Object.values(DB).flat().find(i=>i.n===name)||{n:name,e:name==='Immortality'?'💀':'🔵',t:'Defense'};
  const reason=`Your ${live.k}/${live.d}/${live.a} KDA shows you need ${magic>physical?'magic burst protection':'a safer second life'}`;
  const existing=build.find(i=>i.n===name);
  if(existing){existing.kind='both';existing.reasons=[reason];existing.prio='high';}
  else build[4]={...base,kind:'counter',reasons:[reason],prio:'high'};
 }
 return build;
};
const scanBaseSwitch=switchTab;switchTab=function(t){scanBaseSwitch(t);if(t==='scan')renderScanTool();};
const scanBaseLive=renderLiveMatch;renderLiveMatch=function(){scanBaseLive();const saved=JSON.parse(localStorage.getItem('central-live-kda')||'null'),sub=document.querySelector('#live-match .live-sub');if(saved&&sub)sub.textContent+=' · KDA '+saved.k+'/'+saved.d+'/'+saved.a;};
renderScanTool();
