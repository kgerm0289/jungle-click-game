/* Firebase – alleen Database */
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, get, set, push,
  onValue, query, orderByValue, limitToLast
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

/* config */
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

/* ========== Player name prompt ========== */
let playerName = localStorage.getItem('playerName');
if (!playerName) {
  playerName = prompt('Hoe heet je? (max 12 tekens)', '') || 'Player';
  playerName = playerName.slice(0, 12);
  localStorage.setItem('playerName', playerName);
}

/* ========== DOM refs ========== */
const scoreEl = document.getElementById('score');
const timeEl  = document.getElementById('time');
const streakEl= document.getElementById('streak');
const personalEl = document.getElementById('personal');
const globalEl   = document.getElementById('global');

const resetBtn =  document.getElementById('reset-btn');
const muteBtn  =  document.getElementById('mute-btn');
const boardBtn =  document.getElementById('board-btn');
const modal    =  document.getElementById('modal');
const closeModal =document.getElementById('close-modal');
const boardList = document.getElementById('board-list');

const ambient = document.getElementById('ambient');
const clickS  = document.getElementById('click-sound');
const errorS  = document.getElementById('error-sound');

/* ========== State ========== */
let muted=false, audioLoaded=false;
let score=0, timeLeft=30, last=-1, timeout=null, timer=null, freeze=false;

/* ========== Streak ========== */
const today = new Date().toISOString().slice(0,10);
let streak  = +localStorage.getItem('streak') || 0;
if (localStorage.getItem('lastPlayed') !== today) {
  streak++; localStorage.setItem('streak', streak);
  localStorage.setItem('lastPlayed', today);
}
streakEl.textContent = streak;

/* Pers./glob record */
personalEl.textContent = localStorage.getItem('personalHigh') || 0;
onValue(ref(db,'highscore/global'), s=>{ if(s.exists()) globalEl.textContent=s.val(); });

/* Leaderboard modal */
boardBtn.onclick  = () => { modal.classList.remove('hidden'); updateBoard(); };
closeModal.onclick= () => modal.classList.add('hidden');

function updateBoard(){
  boardList.innerHTML='<li>laden…</li>';
  const q=query(ref(db,'scores'), orderByValue(), limitToLast(10));
  get(q).then(s=>{
    const arr=[];
    s.forEach(c=>arr.push([c.key,c.val()]));
    arr.sort((a,b)=>b[1]-a[1]);
    renderBoard(arr);
  }).catch(()=> renderBoard([[playerName, personalEl.textContent]]));
}
function renderBoard(a){
  boardList.innerHTML='';
  a.forEach(([n,v])=>{
    const li=document.createElement('li');
    li.textContent=`${n}: ${v}`;
    boardList.appendChild(li);
  });
}

/* Mute */
muteBtn.onclick = ()=>{
  muted=!muted; [ambient,clickS,errorS].forEach(a=>a.muted=muted);
  muteBtn.classList.toggle('muted', muted);
  muteBtn.textContent= muted?'🔇':'🔈';
};

/* Lazy audio load */
function ensureAudio(){ if(audioLoaded) return; audioLoaded=true; [ambient,clickS,errorS].forEach(a=>a.load()); }

/* GRID */
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

/* Game handlers */
resetBtn.onclick=start; start();

function start(){
  ensureAudio();
  score=0;timeLeft=30;last=-1;freeze=false;
  scoreEl.textContent=0;timeEl.textContent=timeLeft;
  spawn(); timer=setInterval(tick,1000);
  if(!muted) ambient.play();

  /* daily bonus */
  if(localStorage.getItem('lastPlayed')===today){
    score+=10; particle(cont,'BONUS +10','#ffe66d');
    scoreEl.textContent=score;
  }
}
function tick(){ if(!freeze){ timeLeft--; timeEl.textContent=timeLeft; if(timeLeft<=0) stop(); }}

function stop(){
  clearTimeout(timeout); clearInterval(timer); ambient.pause();
  if(score>+globalEl.textContent){ set(ref(db,'highscore/global'),score); globalEl.textContent=score; }
  if(score>+personalEl.textContent){ personalEl.textContent=score; localStorage.setItem('personalHigh',score);}
  set(ref(db,'scores/'+playerName), score);    /* naam‑key */
  alert(`Tijd voorbij! Je score is ${score}`);
}

/* Spawner */
function setCell(i,txt,t){ cells[i].textContent=txt; cells[i].dataset.type=t; cells[i].classList.add('spawn'); }
function spawn(){
  if(timeLeft<=0)return;
  cells.forEach(c=>{c.textContent='';c.dataset.type='empty';});
  let b; do{b=Math.floor(Math.random()*9);}while(b===last); last=b; setCell(b,'🍌','banana');
  if(Math.random()<.2){ let p; do{p=Math.floor(Math.random()*9);}while(p===b); setCell(p,'🍍','pine'); }
  if(Math.random()<.15){
    let x; do{x=Math.floor(Math.random()*9);}while(cells[x].dataset.type!=='empty');
    Math.random()<.5? setCell(x,'⏳','freeze') : setCell(x,'💣','bomb');
  }
  let k=Math.random()<.5?1:2;
  while(k){ let i=Math.floor(Math.random()*9); if(cells[i].dataset.type==='empty'){ setCell(i,'🥥','coco'); k--;}}
  const int = 1000 - Math.min(score*20,500);
  timeout=setTimeout(spawn,int);
}

/* Click */
function onClick(e){
  ensureAudio();
  if(timeLeft<=0)return;
  const c=e.currentTarget;
  let delta=0,col='#8fff8f';

  switch(c.dataset.type){
    case 'banana': delta=+1; play(clickS); break;
    case 'pine'  : delta=+5; play(clickS); break;
    case 'coco'  : delta=-2; col='#ff7f7f'; play(errorS); break;
    case 'freeze': freeze=true; particle(c,'PAUZE','#ffe66d'); setTimeout(()=>freeze=false,3000); break;
    case 'bomb'  : cells.forEach(cell=>{ if(cell.dataset.type==='coco'){cell.textContent='';cell.dataset.type='empty';}}); particle(c,'BOEM!','#ff5555'); break;
    default      : delta=-1; col='#ff7f7f'; play(errorS); break;
  }

  if(delta!==0){ score+=delta; scoreEl.textContent=score; particle(c,(delta>0?'+':'')+delta,col); }
  c.textContent=''; c.dataset.type='empty';
  if(navigator.vibrate) navigator.vibrate(50);
}
function play(a){ if(!muted) a.play(); }

/* Particle */
function particle(cell,text,color){
  const span=document.createElement('span');
  span.textContent=text; span.style.position='absolute';
  const r=cell.getBoundingClientRect();
  span.style.left=`${r.left+r.width/2}px`; span.style.top=`${r.top}px`;
  span.style.fontSize='24px'; span.style.fontWeight='bold'; span.style.color=color;
  span.style.animation='float 1s ease-out'; document.body.appendChild(span);
  span.addEventListener('animationend',()=>span.remove());
}
