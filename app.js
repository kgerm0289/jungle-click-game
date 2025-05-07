/* Firebase – alleen App + Database (geen Auth) */
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, get, set, push,
  onValue, query, orderByValue, limitToLast
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

/* ------------- config ------------- */
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

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

/* ---------- DOM refs ---------- */
const scoreEl = document.getElementById('score');
const timeEl  = document.getElementById('time');
const personalEl = document.getElementById('personal');
const globalEl   = document.getElementById('global');
const resetBtn = document.getElementById('reset-btn');
const muteBtn  = document.getElementById('mute-btn');
const boardBtn = document.getElementById('board-btn');
const modal    = document.getElementById('modal');
const closeModal = document.getElementById('close-modal');
const boardList = document.getElementById('board-list');

const ambient = document.getElementById('ambient');
const clickS  = document.getElementById('click-sound');
const errorS  = document.getElementById('error-sound');

/* ---------- Mute‑toggle ---------- */
let muted = false;
muteBtn.onclick = () => {
  muted = !muted;
  [ambient, clickS, errorS].forEach(a => a.muted = muted);
  muteBtn.classList.toggle('muted');
  muteBtn.textContent = muted ? '🔇' : '🔈';
};

/* ---------- Leaderboard‑modal ---------- */
boardBtn.onclick  = () => { modal.classList.remove('hidden'); updateBoard(); };
closeModal.onclick= () => modal.classList.add('hidden');

function updateBoard() {
  boardList.innerHTML = '<li>laden…</li>';
  const q = query(ref(db,'scores'), orderByValue(), limitToLast(10));
  get(q).then(snap => {
    const arr = [];
    snap.forEach(c => arr.push([c.key,c.val()]));
    arr.sort((a,b) => b[1]-a[1]);
    boardList.innerHTML = '';
    arr.forEach(([n,v])=>{
      const li = document.createElement('li');
      li.textContent = n + ': ' + v;
      boardList.appendChild(li);
    });
  });
}

/* ---------- Grid ---------- */
const cont=document.getElementById('game-container');
const cells=[];
for(let i=0;i<9;i++){
  const d=document.createElement('div');
  d.className='cell';
  d.dataset.index=i;
  d.onclick=onClick;
  cont.appendChild(d);
  d.addEventListener('animationend',()=>d.classList.remove('spawn'));
  cells.push(d);
}

/* ---------- Vars ---------- */
let score=0,timeLeft=30,last=-1,timeout=null,timer=null;

/* ---------- High‑scores ---------- */
personalEl.textContent = localStorage.getItem('personalHigh') || 0;
onValue(ref(db,'highscore/global'), s=>{
  if(s.exists()) globalEl.textContent = s.val();
});

/* ---------- Game flow ---------- */
function start(){
  score=0; timeLeft=30;
  scoreEl.textContent=0; timeEl.textContent=timeLeft;
  spawn();
  timer=setInterval(()=>{timeLeft--;timeEl.textContent=timeLeft;if(timeLeft<=0)stop();},1000);
  if(!muted) ambient.play();
}

function stop(){
  clearTimeout(timeout); clearInterval(timer); ambient.pause();
  if(score>parseInt(globalEl.textContent||0)){
    globalEl.textContent=score;
    set(ref(db,'highscore/global'),score);
  }
  const local=parseInt(personalEl.textContent||0);
  if(score>local){
    personalEl.textContent=score;
    localStorage.setItem('personalHigh',score);
  }
  push(ref(db,'scores'),score);   /* anonieme push‑key */
  alert('Tijd voorbij! Je score is '+score);
}

/* ---------------- spawn icons ---------------- */
function setCell(i,txt,t){
  cells[i].textContent=txt;
  cells[i].dataset.type=t;
  cells[i].classList.add('spawn');
}

function spawn(){
  if(timeLeft<=0) return;
  cells.forEach(c=>{c.textContent='';c.dataset.type='empty';});
  /* banaan */
  let b; do{b=Math.floor(Math.random()*9);}while(b===last);
  last=b; setCell(b,'🍌','banana');
  /* ananas */
  if(Math.random()<0.2){
    let p; do{p=Math.floor(Math.random()*9);}while(p===b);
    setCell(p,'🍍','pine');
  }
  /* kokosnoten */
  let k=Math.random()<.5?1:2;
  while(k){
    let i=Math.floor(Math.random()*9);
    if(cells[i].dataset.type==='empty'){
      setCell(i,'🥥','coco'); k--;
    }
  }
  const interval = 1000 - Math.min(score*20,500);
  timeout=setTimeout(spawn,interval);
}

/* ---------------- clicks ---------------- */
function onClick(e){
  if(timeLeft<=0) return;
  const c=e.currentTarget;
  let delta=0,color='#8fff8f';

  switch(c.dataset.type){
    case 'banana': delta=+1; if(!muted) clickS.play(); break;
    case 'pine'  : delta=+5; if(!muted) clickS.play(); break;
    case 'coco'  : delta=-2; color='#ff7f7f'; if(!muted) errorS.play(); break;
    default      : delta=-1; color='#ff7f7f'; if(!muted) errorS.play(); break;
  }
  score += delta;
  scoreEl.textContent = score;
  if(delta!==0) particle(c,(delta>0?'+':'')+delta,color);
  c.textContent='';
  c.dataset.type='empty';
  if(navigator.vibrate) navigator.vibrate(50);
}

/* ---------------- particle ---------------- */
function particle(cell,text,color){
  const span=document.createElement('span');
  span.textContent=text;
  span.style.position='absolute';
  const r=cell.getBoundingClientRect();
  span.style.left  = `${r.left+r.width/2}px`;
  span.style.top   = `${r.top}px`;
  span.style.fontSize='24px';
  span.style.fontWeight='bold';
  span.style.color=color;
  span.style.animation='float 1s ease-out';
  document.body.appendChild(span);
  span.addEventListener('animationend',()=>span.remove());
}

document.getElementById('reset-btn').onclick=start;
start();
