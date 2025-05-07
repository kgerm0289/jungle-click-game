/* ========== Firebase ONLY Database ========== */
import { initializeApp }      from
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, get, set, push,
  onValue, query, orderByValue, limitToLast
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

/* -- jouw projectdata -- */
const firebaseConfig = {
  apiKey: "AIzaSyDQ6J6_4kX-0WxKPKWxDHMvzvv-CEsl_9c",
  authDomain: "testgame-4b20f.firebaseapp.com",
  databaseURL:
    "https://testgame-4b20f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testgame-4b20f",
  storageBucket: "testgame-4b20f.appspot.com",
  messagingSenderId: "1041699656889",
  appId: "1:1041699656889:web:8599f44a8be05cd01df768"
};

initializeApp(firebaseConfig);
const db = getDatabase();

/* ========== DOM refs ========== */
const scoreEl   = document.getElementById('score');
const timeEl    = document.getElementById('time');
const streakEl  = document.getElementById('streak');
const personalEl= document.getElementById('personal');
const globalEl  = document.getElementById('global');

const resetBtn  = document.getElementById('reset-btn');
const muteBtn   = document.getElementById('mute-btn');
const boardBtn  = document.getElementById('board-btn');
const modal     = document.getElementById('modal');
const closeModal= document.getElementById('close-modal');
const boardList = document.getElementById('board-list');

const ambient   = document.getElementById('ambient');
const clickSnd  = document.getElementById('click-sound');
const errorSnd  = document.getElementById('error-sound');

/* ========== STATE ========== */
let muted=false;
let audioLoaded=false;
let score=0, timeLeft=30, last=-1, timeout=null, timer=null;
let freezeActive=false;

/* ========== Streak check ========== */
const today = new Date().toISOString().slice(0,10);
let streak  = +localStorage.getItem('streak') || 0;
const lastDay= localStorage.getItem('lastPlayed');
if (lastDay !== today) {
  streak++;                            // nieuwe dag → streak++
  localStorage.setItem('lastPlayed', today);
  localStorage.setItem('streak', streak);
}
streakEl.textContent = streak;

/* Persoonlijk+globaal record */
personalEl.textContent = localStorage.getItem('personalHigh') || 0;
onValue(ref(db,'highscore/global'), s=>{
  if(s.exists()) globalEl.textContent = s.val();
});

/* ========== Leaderboard modal ========== */
boardBtn.onclick = ()=>{ modal.classList.remove('hidden'); updateBoard(); };
closeModal.onclick=()=> modal.classList.add('hidden');

function updateBoard(){
  boardList.innerHTML='<li>laden…</li>';
  const q=query(ref(db,'scores'),orderByValue(),limitToLast(10));
  get(q).then(s=>{
    const arr=[];
    s.forEach(c=>arr.push([c.key,c.val()]));
    arr.sort((a,b)=>b[1]-a[1]);
    boardList.innerHTML='';
    arr.forEach(([n,v])=>{
      const li=document.createElement('li');
      li.textContent=`${n}: ${v}`;
      boardList.appendChild(li);
    });
  }).catch(()=>{boardList.innerHTML='<li>(geen data)</li>';});
}

/* ========== Mute / Lazy‑load audio ========== */
muteBtn.onclick=()=>{
  muted=!muted;
  [ambient,clickSnd,errorSnd].forEach(a=>a.muted=muted);
  muteBtn.textContent=muted?'🔇':'🔈';
  muteBtn.classList.toggle('muted',muted);
};

/* laad mp3 pas bij eerste user‑interactie */
function ensureAudio(){
  if(audioLoaded) return;
  audioLoaded=true;
  ambient.load(); clickSnd.load(); errorSnd.load();
}

/* ========== GRID setup ========== */
const cont=document.getElementById('game-container');
const cells=[];
for(let i=0;i<9;i++){
  const d=document.createElement('div');
  d.className='cell';
  d.onclick=onClick;
  d.addEventListener('animationend',()=>d.classList.remove('spawn'));
  cont.appendChild(d);
  cells.push(d);
}

/* ========== Game flow ========== */
resetBtn.onclick=start;
start();

function start(){
  ensureAudio();
  score=0; timeLeft=30; last=-1;
  scoreEl.textContent=0; timeEl.textContent=timeLeft;
  spawn();
  timer=setInterval(tick,1000);
  if(!muted) ambient.play();

  /* dag‑bonus direct toevoegen */
  if(localStorage.getItem('lastPlayed')===today){
    score+=10; particle(cont,'BONUS +10','#ffe66d');
    scoreEl.textContent=score;
  }
}

function tick(){
  if(freezeActive){ return; }            // timer pauze
  timeLeft--; timeEl.textContent=timeLeft;
  if(timeLeft<=0) stop();
}

function stop(){
  clearTimeout(timeout); clearInterval(timer); ambient.pause();
  /* highscores */
  if(score>+globalEl.textContent){ globalEl.textContent=score; set(ref(db,'highscore/global'),score); }
  const local=+personalEl.textContent;
  if(score>local){ personalEl.textContent=score; localStorage.setItem('personalHigh',score);}
  push(ref(db,'scores'), score);
  alert(`Tijd voorbij! Je score is ${score}`);
}

/* ========== Spawning icons ========== */
function spawn(){
  if(timeLeft<=0) return;
  cells.forEach(c=>{c.textContent='';c.dataset.type='empty';});
  /* banaan */
  let b; do{b=Math.floor(Math.random()*9);}while(b===last); last=b;
  setCell(b,'🍌','banana');

  /* ananas 20 % */
  if(Math.random()<.2){
    let p; do{p=Math.floor(Math.random()*9);}while(p===b);
    setCell(p,'🍍','pine');
  }

  /* tijger 10 % (pure animatie) */
  if(Math.random()<.1){
    let t; do{t=Math.floor(Math.random()*9);}while(cells[t].dataset.type!=='empty');
    setCell(t,'🐅','tiger');
    setTimeout(()=>{cells[t].textContent='';cells[t].dataset.type='empty';},800);
  }

  /* extra power‑ups (⏳ & 💣) 15 % */
  if(Math.random()<.15){
    let x; do{x=Math.floor(Math.random()*9);}while(cells[x].dataset.type!=='empty');
    if(Math.random()<.5){ setCell(x,'⏳','freeze'); }
    else { setCell(x,'💣','bomb'); }
  }

  /* kokosnoten 1–2 */
  let k=Math.random()<.5?1:2;
  while(k){ let i=Math.floor(Math.random()*9);
    if(cells[i].dataset.type==='empty'){ setCell(i,'🥥','coco');k--; }
  }

  const int = 1000 - Math.min(score*20,500);
  timeout=setTimeout(spawn,int);
}

function setCell(i,txt,t){ cells[i].textContent=txt; cells[i].dataset.type=t; cells[i].classList.add('spawn'); }

/* ========== Click handling ========== */
function onClick(e){
  ensureAudio();
  if(timeLeft<=0) return;
  const c=e.currentTarget;
  let delta=0, col='#8fff8f';

  switch(c.dataset.type){
    case 'banana': delta=+1; play(clickSnd); break;
    case 'pine'  : delta=+5; play(clickSnd); break;
    case 'coco'  : delta=-2; col='#ff7f7f'; play(errorSnd); break;
    case 'freeze':
      freezeActive=true; particle(c,'PAUZE','#ffe66d');
      setTimeout(()=>{freezeActive=false;},3000);
      break;
    case 'bomb':
      cells.forEach(cell=>{
        if(cell.dataset.type==='coco'){ cell.textContent=''; cell.dataset.type='empty'; }
      });
      particle(c,'BOEM!','#ff5555'); break;
    default:
      delta=-1; col='#ff7f7f'; play(errorSnd); break;
  }

  if(delta!==0){
    score+=delta; scoreEl.textContent=score;
    particle(c,(delta>0?'+':'')+delta, col);
  }

  c.textContent=''; c.dataset.type='empty';
  if(navigator.vibrate) navigator.vibrate(50);
}

/* helper play */
function play(a){ if(!muted) a.play(); }

/* ========== Particle effect ========== */
function particle(cell,text,color){
  const span=document.createElement('span');
  span.textContent=text;
  span.style.position='absolute';
  const r=cell.getBoundingClientRect();
  span.style.left=`${r.left+r.width/2}px`;
  span.style.top =`${r.top}px`;
  span.style.fontSize='24px';
  span.style.fontWeight='bold';
  span.style.color=color;
  span.style.animation='float 1s ease-out';
  document.body.appendChild(span);
  span.addEventListener('animationend',()=>span.remove());
}
