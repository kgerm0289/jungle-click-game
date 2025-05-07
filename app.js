/* Firebase – alleen Database */
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, get, set, push,
  onValue, query, orderByValue, limitToLast
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

/* --- config (vul eigen data) --- */
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

/* --- spelernaam --- */
let playerName = localStorage.getItem('playerName') ||
  prompt('Hoe heet je? (max 12 tekens)','Player').slice(0,12);
localStorage.setItem('playerName', playerName);

/* --- DOM refs --- */
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
const clickS    = document.getElementById('click-sound');
const errorS    = document.getElementById('error-sound');

/* ---------- State ---------- */
let level = 1, gridSize = 3;
let cells = [], cont = document.getElementById('game-container');

let muted=false,audioLoaded=false;
let score=0,timeLeft=30,last=-1,timeout=null,timer=null,freeze=false;

/* ---------- High‑score & streak ---------- */
const today = new Date().toISOString().slice(0,10);
let streak = +localStorage.getItem('streak') || 0;
if (localStorage.getItem('lastPlayed') !== today) {
  streak++; localStorage.setItem('streak', streak);
  localStorage.setItem('lastPlayed', today);
}
streakEl.textContent = streak;
personalEl.textContent = localStorage.getItem('personalHigh') || 0;
onValue(ref(db,'highscore/global'),s=>{if(s.exists())globalEl.textContent=s.val();});

/* ---------- Audio helpers ---------- */
function ensureAudio(){ if(audioLoaded) return; audioLoaded=true; [ambient,clickS,errorS].forEach(a=>a.load()); }
function play(a){ if(!muted) a.play(); }

/* ---------- UI events ---------- */
muteBtn.onclick = ()=>{ muted=!muted; [ambient,clickS,errorS].forEach(a=>a.muted=muted);
  muteBtn.textContent = muted?'🔇':'🔈'; muteBtn.classList.toggle('muted',muted); };
boardBtn.onclick  = ()=>{ modal.classList.remove('hidden'); updateBoard(); };
closeModal.onclick= ()=> modal.classList.add('hidden');
resetBtn.onclick  = start;

/* ---------- Leaderboard ---------- */
function updateBoard(){
  boardList.innerHTML='<li>laden…</li>';
  const q=query(ref(db,'scores'),orderByValue(),limitToLast(10));
  get(q).then(s=>{
    const a=[]; s.forEach(c=>a.push([c.key,c.val()])); a.sort((x,y)=>y[1]-x[1]);
    renderBoard(a);
  }).catch(()=>renderBoard([[playerName, personalEl.textContent]]));
}
function renderBoard(arr){
  boardList.innerHTML='';
  arr.forEach(([n,v])=>{
    const li=document.createElement('li');
    li.textContent=`${n}: ${v}`; boardList.appendChild(li);
  });
}

/* ---------- Grid builder ---------- */
function buildGrid(){
  cont.innerHTML=''; cells=[];
  cont.style.gridTemplateColumns=`repeat(${gridSize},110px)`;
  cont.style.gridTemplateRows=`repeat(${gridSize},110px)`;
  for(let i=0;i<gridSize*gridSize;i++){
    const d=document.createElement('div');
    d.className='cell'; d.onclick=onClick;
    d.addEventListener('animationend',()=>d.classList.remove('spawn'));
    cont.appendChild(d); cells.push(d);
  }
}

/* ---------- Start / Tick / Stop ---------- */
function start(){
  ensureAudio();
  level=1; gridSize=3; buildGrid();
  score=0; timeLeft=30; last=-1; freeze=false;
  scoreEl.textContent=0; timeEl.textContent=timeLeft;
  spawn(); timer=setInterval(tick,1000); if(!muted) ambient.play();
}
function tick(){ if(!freeze){ timeLeft--; timeEl.textContent=timeLeft; if(timeLeft<=0) stop(); }}
function stop(){
  clearTimeout(timeout); clearInterval(timer); ambient.pause();
  if(score>+globalEl.textContent){ set(ref(db,'highscore/global'),score); globalEl.textContent=score; }
  if(score>+personalEl.textContent){ personalEl.textContent=score; localStorage.setItem('personalHigh',score); }
  set(ref(db,'scores/'+playerName), score);
  alert(`Game over! Score ${score}`);
}

/* ---------- Spawning ---------- */
function setCell(i,txt,t){ cells[i].textContent=txt; cells[i].dataset.type=t; cells[i].classList.add('spawn'); }
function spawn(){
  if(timeLeft<=0) return;
  cells.forEach(c=>{c.textContent='';c.dataset.type='empty';});
  /* banaan */
  let b; do{b=Math.floor(Math.random()*cells.length);}while(b===last); last=b;
  setCell(b,'🍌','banana');
  /* ananas 20% */
  if(Math.random()<.2){ let p; do{p=Math.floor(Math.random()*cells.length);}while(p===b);
    setCell(p,'🍍','pine'); }
  /* kokosnoten afhankelijk level */
  let kok = level===1 ? (Math.random()<.5?1:2) : 3;
  while(kok){ let i=Math.floor(Math.random()*cells.length);
    if(cells[i].dataset.type==='empty'){ setCell(i,'🥥','coco'); kok--; } }
  /* power‑ups */
  if(Math.random()<.15){ let x; do{x=Math.floor(Math.random()*cells.length);}while(cells[x].dataset.type!=='empty');
    Math.random()<.5? setCell(x,'⏳','freeze') : setCell(x,'💣','bomb'); }
  /* tijger af en toe */
  if(Math.random()<.1){ let t; do{t=Math.floor(Math.random()*cells.length);}while(cells[t].dataset.type!=='empty');
    setCell(t,'🐅','tiger'); setTimeout(()=>{cells[t].textContent='';cells[t].dataset.type='empty';},800);}
  /* difficulty */
  const interval = (level===1?1000:800) - Math.min(score*20,500);
  timeout=setTimeout(spawn, interval);
}

/* ---------- Click ---------- */
function onClick(e){
  ensureAudio(); if(timeLeft<=0) return;
  const c=e.currentTarget; let delta=0,col='#8fff8f';

  switch(c.dataset.type){
    case 'banana': delta=+1; play(clickS); break;
    case 'pine'  : delta=+5; play(clickS); break;
    case 'coco'  : delta=-2; col='#ff7f7f'; play(errorS); break;
    case 'freeze': freeze=true; particle(c,'PAUZE','#ffe66d'); setTimeout(()=>freeze=false,3000); break;
    case 'bomb'  : cells.forEach(cell=>{if(cell.dataset.type==='coco'){cell.textContent='';cell.dataset.type='empty';}});
                   particle(c,'BOEM!','#ff5555'); break;
    default      : delta=-1; col='#ff7f7f'; play(errorS);
  }

  if(delta!==0){ score+=delta; scoreEl.textContent=score; particle(c,(delta>0?'+':'')+delta,col); }
  c.textContent=''; c.dataset.type='empty';
  if(navigator.vibrate) navigator.vibrate(50);

  /* ---------- Level‑up ---------- */
  if(level===1 && score>=10){
    level=2; gridSize=4; timeLeft+=10;  /* extra tijd bonus */
    buildGrid(); particle(cont,'LEVEL 2!','#ffe66d');
  }
}

/* ---------- Particle ---------- */
function particle(cell,text,color){
  const span=document.createElement('span');
  span.textContent=text; span.style.position='absolute';
  const r=cell.getBoundingClientRect();
  span.style.left=`${r.left+r.width/2}px`; span.style.top=`${r.top}px`;
  span.style.font='bold 24px Jua, sans-serif'; span.style.color=color;
  span.style.animation='float 1s ease-out'; document.body.appendChild(span);
  span.addEventListener('animationend',()=>span.remove());
}

/* ----- init ----- */
start();
