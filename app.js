/* Firebase – Database only */
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, get, set, push,
  onValue, query, orderByValue, limitToLast
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

/* === config (eigen keys) === */
const firebaseConfig={apiKey:"AIzaSyDQ6J6_4kX-0WxKPKWxDHMvzvv-CEsl_9c",
authDomain:"testgame-4b20f.firebaseapp.com",
databaseURL:"https://testgame-4b20f-default-rtdb.europe-west1.firebasedatabase.app",
projectId:"testgame-4b20f",storageBucket:"testgame-4b20f.appspot.com",
messagingSenderId:"1041699656889",appId:"1:1041699656889:web:8599f44a8be05cd01df768"};
initializeApp(firebaseConfig); const db=getDatabase();

/* === player name prompt ========================================= */
let playerName=localStorage.getItem('playerName');
if(!playerName){playerName=prompt('Hoe heet je? (max 12 tekens)','Player')?.slice(0,12)||'Player';
localStorage.setItem('playerName',playerName);}

/* === DOM refs ==================================================== */
const scoreEl=document.getElementById('score'), timeEl=document.getElementById('time'),
streakEl=document.getElementById('streak'), personalEl=document.getElementById('personal'),
globalEl=document.getElementById('global');

const resetBtn=document.getElementById('reset-btn'), muteBtn=document.getElementById('mute-btn'),
themeBtn=document.getElementById('theme-btn'), boardBtn=document.getElementById('board-btn'),
statsBtn=document.getElementById('stats-btn'), zoomRange=document.getElementById('zoomRange'),
trackSel=document.getElementById('trackSel');

const modal=document.getElementById('modal'),closeModal=document.getElementById('close-modal'),
boardList=document.getElementById('board-list');

const stats=document.getElementById('stats'), closeStats=document.getElementById('close-stats'),
statList=document.getElementById('stat-list');

const achv=document.getElementById('achv'), closeAchv=document.getElementById('close-achv'),
achvList=document.getElementById('achv-list');

const ambient=document.getElementById('ambient'), clickS=document.getElementById('click-sound'),
errorS=document.getElementById('error-sound');

/* === global state =============================================== */
let level=1,grid=3,baseInt=1000,cells=[],cont=document.getElementById('game-container');
let muted=false,audioLoaded=false,score=0,timeLeft=30,last=-1,timeout=null,timer=null,freeze=false;
let statsData=JSON.parse(localStorage.getItem('stats')||'{"games":0,"clicks":0,"hits":0}');

/* === streak & highscores ======================================== */
const today=new Date().toISOString().slice(0,10);
let streak=+localStorage.getItem('streak')||0;
if(localStorage.getItem('lastPlayed')!==today){streak++;localStorage.setItem('streak',streak);
localStorage.setItem('lastPlayed',today);}
streakEl.textContent=streak;
personalEl.textContent=localStorage.getItem('personalHigh')||0;
onValue(ref(db,'highscore/global'),s=>{if(s.exists())globalEl.textContent=s.val();});

/* === audio helpers ============================================== */
const ensureAudio=()=>{if(audioLoaded)return;audioLoaded=true;[ambient,clickS,errorS].forEach(a=>a.load());};
const play=a=>{if(!muted)a.play();};

/* === THEMES ====================================================== */
const themes=[{bg:"url('jungle_background.png')"},{bg:"url('jungle_night.png')"},
              {bg:"url('jungle_beach.png')"}]; let themeIdx=0;
function applyTheme(){document.documentElement.style.setProperty('--bg',themes[themeIdx].bg);}
themeBtn.onclick=()=>{themeIdx=(themeIdx+1)%themes.length;applyTheme();};

/* === accessibility slider ======================================= */
zoomRange.oninput=e=>{document.documentElement.style.setProperty('--zoom',e.target.value);};

/* === music switcher ============================================= */
trackSel.onchange=e=>{ambient.src=e.target.value; if(!muted){ambient.pause();ambient.load();ambient.play();}};

/* === leader board modal ========================================= */
boardBtn.onclick=()=>{modal.classList.remove('hidden');updateBoard();};
closeModal.onclick=()=>modal.classList.add('hidden');
function updateBoard(){
  boardList.innerHTML='<li>laden…</li>';
  get(query(ref(db,'scores'),orderByValue(),limitToLast(10)))
  .then(s=>{const a=[];s.forEach(c=>a.push([c.key,c.val()]));a.sort((x,y)=>y[1]-x[1]);renderBoard(a);})
  .catch(()=>renderBoard([[playerName, personalEl.textContent]]));
}
function renderBoard(arr){boardList.innerHTML='';arr.forEach(([n,v])=>{
  const li=document.createElement('li');li.textContent=`${n}: ${v}`;boardList.appendChild(li);});}

/* === stats modal ================================================= */
statsBtn.onclick=()=>{statList.innerHTML=
`<li>Gespeelde spellen: ${statsData.games}</li>
 <li>Totaal klikken: ${statsData.clicks}</li>
 <li>Hits %: ${(statsData.hits/Math.max(1,statsData.clicks)*100).toFixed(0)}%</li>`;stats.classList.remove('hidden');};
closeStats.onclick=()=>stats.classList.add('hidden');

/* === achievements =============================================== */
const badgeDefs=[
 {id:'rookie',txt:'Eerste spel 😃',cond:()=>statsData.games>=1},
 {id:'banaan100',txt:'100 bananen 🍌',cond:()=>statsData.hits>=100},
 {id:'streak5',txt:'5‑daagse streak 🔥',cond:()=>streak>=5},
 {id:'pro',txt:'Pers. record ≥ 50 🏆',cond:()=>+personalEl.textContent>=50}
];
function checkBadges(){
  let html='';
  badgeDefs.forEach(b=>{const got=localStorage.getItem('badge_'+b.id);
    if(!got && b.cond()){localStorage.setItem('badge_'+b.id,'1');alert('Badge behaald: '+b.txt);}
    if(localStorage.getItem('badge_'+b.id))html+='<li>'+b.txt+'</li>';});
  achvList.innerHTML=html||'<li>Geen badges</li>';
}
statsBtn.onclick=statsBtn.onclick||(()=>{}); /* keep reference */

/* === mute ======================================================== */
muteBtn.onclick=()=>{muted=!muted;[ambient,clickS,errorS].forEach(a=>a.muted=muted);
  muteBtn.textContent=muted?'🔇':'🔈';muteBtn.classList.toggle('muted',muted);};

/* === grid builder =============================================== */
function buildGrid(){
  cont.innerHTML=''; cells=[];
  cont.style.gridTemplateColumns=`repeat(${grid},110px)`;
  cont.style.gridTemplateRows=`repeat(${grid},110px)`;
  for(let i=0;i<grid*grid;i++){
    const d=document.createElement('div');d.className='cell';d.onclick=onClick;
    d.addEventListener('animationend',()=>d.classList.remove('spawn'));
    cont.appendChild(d);cells.push(d);
  }
}

/* === game ======================================================== */
resetBtn.onclick=start; start();
function start(){
  ensureAudio(); statsData.games++; localStorage.setItem('stats',JSON.stringify(statsData));
  level=1;grid=3;baseInt=1000;buildGrid();
  score=0;timeLeft=30;freeze=false;scoreEl.textContent=0;timeEl.textContent=timeLeft;
  spawn();timer=setInterval(tick,1000);if(!muted)ambient.play();applyTheme();checkBadges();
}
function tick(){if(!freeze){timeLeft--;timeEl.textContent=timeLeft;if(timeLeft<=0)stop();}}
function stop(){clearTimeout(timeout);clearInterval(timer);ambient.pause();
  if(score>+globalEl.textContent){globalEl.textContent=score;set(ref(db,'highscore/global'),score);}
  if(score>+personalEl.textContent){personalEl.textContent=score;localStorage.setItem('personalHigh',score);}
  set(ref(db,'scores/'+playerName),score);alert(`Game over — Score ${score}`);}

/* === spawner ===================================================== */
function setCell(i,txt,t){cells[i].textContent=txt;cells[i].dataset.type=t;cells[i].classList.add('spawn');}
function spawn(){
  if(timeLeft<=0) return;
  cells.forEach(c=>{c.textContent='';c.dataset.type='empty';});
  let b;do{b=Math.floor(Math.random()*cells.length);}while(b===last);last=b;setCell(b,'🍌','banana');
  if(Math.random()<.2){let p;do{p=Math.floor(Math.random()*cells.length);}while(p===b);setCell(p,'🍍','pine');}
  /* extra power‑ups */
  if(Math.random()<.15){let x;do{x=Math.floor(Math.random()*cells.length);}while(cells[x].dataset.type!=='empty');
    Math.random()<.5?setCell(x,'⏳','freeze'):setCell(x,'💣','bomb');}
  /* level 2 extra items */
  if(level===2&&Math.random()<.25){let x;do{x=Math.floor(Math.random()*cells.length);}while(cells[x].dataset.type!=='empty');
    Math.random()<.5?setCell(x,'⭐','star'):setCell(x,'🍇','grape');}
  /* kokosnoten */
  let k=level===1?(Math.random()<.5?1:2):3; while(k){let i=Math.floor(Math.random()*cells.length);
    if(cells[i].dataset.type==='empty'){setCell(i,'🥥','coco');k--;}}
  const interval=baseInt/(1+Math.log(score+1)); timeout=setTimeout(spawn,interval);
}

/* === clicks / gyro / shake ====================================== */
let lastShake=0,shTh=15;
window.addEventListener('devicemotion',e=>{
  const a=e.accelerationIncludingGravity; if(!a)return;
  const mag=Math.sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
  if(mag>shTh&&Date.now()-lastShake>1500){lastShake=Date.now();shakeClear();}
});
function shakeClear(){cells.forEach(c=>{if(c.dataset.type==='coco'){c.textContent='';c.dataset.type='empty';}});
  particle(cont,'SHAKE ⚡','#ff5555');}

/* gyro‑boost (tilt > 40°) */
window.addEventListener('deviceorientation',e=>{
  if(Math.abs(e.beta)>40&&!freeze){freeze=true;particle(cont,'SLO‑MO','#ffe66d');setTimeout(()=>freeze=false,2000);}});

function onClick(e){
  ensureAudio(); statsData.clicks++;if(timeLeft<=0)return;
  const c=e.currentTarget; let delta=0,col='#8fff8f';
  switch(c.dataset.type){
    case'banana':delta=+1;statsData.hits++;play(clickS);break;
    case'pine':delta=+5;statsData.hits++;play(clickS);break;
    case'grape':delta=+3;statsData.hits++;play(clickS);break;
    case'star':delta=+10;statsData.hits++;play(clickS);break;
    case'coco':delta=-2;col='#ff7f7f';play(errorS);break;
    case'freeze':freeze=true;particle(c,'PAUZE','#ffe66d');setTimeout(()=>freeze=false,3000);break;
    case'bomb':cells.forEach(cell=>{if(cell.dataset.type==='coco'){cell.textContent='';cell.dataset.type='empty';}});
      particle(c,'BOEM!','#ff5555');break;
    default:delta=-1;col='#ff7f7f';play(errorS);
  }
  localStorage.setItem('stats',JSON.stringify(statsData));
  if(delta!==0){score+=delta;scoreEl.textContent=score;particle(c,(delta>0?'+':'')+delta,col);}  
  if(c.dataset.type){c.textContent='';c.dataset.type='empty';}
  if(navigator.vibrate)navigator.vibrate(50);
  if(level===1&&score>=10){level=2;grid=4;baseInt=1000;timeLeft+=10;buildGrid();particle(cont,'LEVEL 2!','#ffe66d');}
}

function particle(cell,text,color){
  const s=document.createElement('span');s.textContent=text;s.style.position='absolute';
  const r=cell.getBoundingClientRect();s.style.left=`${r.left+r.width/2}px`;s.style.top=`${r.top}px`;
  s.style.font='bold 24px Jua';s.style.color=color;s.style.animation='float 1s ease-out';
  document.body.appendChild(s);s.addEventListener('animationend',()=>s.remove());
}

/* achievements modal toggle */
document.body.addEventListener('keydown',e=>{ if(e.key==='a') {achv.classList.toggle('hidden');} });
closeAchv.onclick=()=>achv.classList.add('hidden');
