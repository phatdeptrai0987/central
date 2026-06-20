
let scanImage=null,scanData={heroes:[],kdas:[],text:''},ocrPromise=null;
function scanNorm(s){return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g,'');}
function parseScanText(text){
 const packed=scanNorm(text),words=text.toLowerCase().split(/[^a-z0-9.'-]+/).map(scanNorm);
 const heroes=heroList.filter(h=>{const n=scanNorm(h.name);return n.length<=3?words.includes(n):packed.includes(n);}).map(h=>h.name);
 const kdas=[];const re=/\b(\d{1,2})\s*[\/|\\]\s*(\d{1,2})\s*[\/|\\]\s*(\d{1,2})\b/g;let m;
 while((m=re.exec(text))&&kdas.length<10)kdas.push({k:+m[1],d:+m[2],a:+m[3]});
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
async function scanScreenshot(file){
 const preview=document.getElementById('scan-preview');preview.src=URL.createObjectURL(file);preview.style.display='block';document.getElementById('scan-results').innerHTML='<div class="scan-sub">Reading screenshot…</div>';
 try{
  updateScanProgress(.03,'Preparing screenshot…');scanImage=await prepareScanImage(file);const T=await ensureOCR();updateScanProgress(.08,'Loading text recognition…');
  const worker=await T.createWorker('eng',1,{logger:m=>{if(m.progress)updateScanProgress(.1+m.progress*.85,m.status.replace(/_/g,' ')+'…');}});
  const out=await worker.recognize(scanImage);await worker.terminate();scanData=parseScanText(out.data.text||'');updateScanProgress(1,'Scan complete');renderScanResults();
 }catch(e){document.getElementById('scan-results').innerHTML=`<div class="scan-error">Could not scan this image: ${e.message}. Try a clear landscape scoreboard screenshot.</div>`;updateScanProgress(0,'Scan failed');}
}
function applyScannedHero(name,type){if(type==='me')setMyHero(name);else addE(name);saveAppMatch();renderScanResults();}
function setScanKda(k,d,a){localStorage.setItem('central-live-kda',JSON.stringify({k,d,a}));renderScanResults();renderLiveMatch();}
function renderScanResults(){
 const el=document.getElementById('scan-results'),saved=JSON.parse(localStorage.getItem('central-live-kda')||'null');
 let html='';
 html+='<div class="scan-section">Detected heroes</div>';
 html+=scanData.heroes.length?scanData.heroes.map(n=>{const h=heroList.find(x=>x.name===n);return`<div class="detected-row">${appAvatar(h)}<div class="detected-name">${n}</div><div class="scan-actions"><button class="scan-action me" onclick="applyScannedHero('${n.replace(/'/g,"\\'")}','me')">My Hero</button><button class="scan-action enemy" onclick="applyScannedHero('${n.replace(/'/g,"\\'")}','enemy')">Enemy</button></div></div>`;}).join(''):'<div class="scan-sub">No hero names were readable. You can still use the detected KDA and select heroes in Counter Tool.</div>';
 html+='<div class="scan-section">Detected KDA</div><div class="kda-grid">';
 html+=scanData.kdas.length?scanData.kdas.map(v=>`<button class="kda-card scan-action" onclick="setScanKda(${v.k},${v.d},${v.a})"><div class="kda-value">${v.k} / ${v.d} / ${v.a}</div><div class="kda-label">${saved&&saved.k===v.k&&saved.d===v.d&&saved.a===v.a?'✓ YOUR KDA':'TAP IF THIS IS YOU'}</div></button>`).join(''):'<div class="scan-sub">No K/D/A pattern was found.</div>';
 html+='</div><button class="live-setup" onclick="switchTab(\'live\')">Open Live Build</button><details><summary class="scan-sub">Show text Central read</summary><div class="ocr-raw">'+scanData.text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</div></details>';
 el.innerHTML=html;
}
const scanBaseSwitch=switchTab;switchTab=function(t){scanBaseSwitch(t);if(t==='scan')renderScanTool();};
const scanBaseLive=renderLiveMatch;renderLiveMatch=function(){scanBaseLive();const saved=JSON.parse(localStorage.getItem('central-live-kda')||'null'),sub=document.querySelector('#live-match .live-sub');if(saved&&sub)sub.textContent+=' · KDA '+saved.k+'/'+saved.d+'/'+saved.a;};
renderScanTool();
