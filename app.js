/* Firebase – alleen App + Database (geen Auth meer) */
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, get, set, push,
  onValue, query, orderByValue, limitToLast
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

/* >>> Vul je eigen config in; hier staat het voorbeeld <<< */
const firebaseConfig = {
  apiKey: "AIzaSyDQ6J6_4kX-0WxKPKWxDHMvzvv-CEsl_9c",
  authDomain: "testgame-4b20f.firebaseapp.com",
  databaseURL:
  "https://testgame-4b20f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testgame-4b20f",
  storageBucket: "testgame-4b20f.appspot.com",
  messagingSenderId: "1041699656889",
  appId: "1:1041699656889:web:8599f44a8be05cd01df768",
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

/* ---------- DOM‑referenties ---------- */
const scoreEl   = document.getElementById("score");
const timeEl    = document.getElementById("time");
const personalEl= document.getElementById("personal");
const globalEl  = document.getElementById("global");
const resetBtn  = document.getElementById("reset-btn");
const muteBtn   = document.getElementById("mute-btn");
const boardBtn  = document.getElementById("board-btn");
const modal     = document.getElementById("modal");
const closeModal= document.getElementById("close-modal");
const boardList = document.getElementById("board-list");

const ambient   = document.getElementById("ambient");
const clickSnd  = document.getElementById("click-sound");
const errorSnd  = document.getElementById("error-sound");

/* ---------- UI‑instellingen ---------- */
let muted = false;
muteBtn.onclick = () => {
  muted = !muted;
  [ambient, clickSnd, errorSnd].forEach(a => a.muted = muted);
  muteBtn.classList.toggle("muted");
  muteBtn.textContent = muted ? "🔇" : "🔈";
};

boardBtn.onclick  = () => { modal.classList.remove("hidden"); updateBoard(); };
closeModal.onclick= () => modal.classList.add("hidden");

/* ---------- Game‑grid ---------- */
const cont  = document.getElementById("game-container");
const cells = [];
for (let i = 0; i < 9; i++) {
  const d = document.createElement("div");
  d.className = "cell";
  d.dataset.index = i;
  d.onclick = onClick;
  d.addEventListener("animationend", () => d.classList.remove("spawn"));
  cont.appendChild(d);
  cells.push(d);
}

/* ---------- High‑scores ---------- */
/* Lokaal persoonlijk record */
personalEl.textContent =
  localStorage.getItem("personalHigh") || 0;

/* Globaal record uit Firebase */
onValue(ref(db, "highscore/global"), snap => {
  if (snap.exists()) globalEl.textContent = snap.val();
});

/* ---------- Leaderboard ---------- */
function updateBoard() {
  boardList.innerHTML = "<li>laden…</li>";
  const q = query(ref(db, "scores"),
                  orderByValue(), limitToLast(10));
  get(q).then(snap => {
    const arr = [];
    snap.forEach(c => arr.push([c.key, c.val()]));
    arr.sort((a, b) => b[1] - a[1]);
    boardList.innerHTML = "";
    arr.forEach(([name, val]) => {
      const li = document.createElement("li");
      li.textContent = name + ": " + val;
      boardList.appendChild(li);
    });
  });
}

/* ---------- Spel‑variabelen ---------- */
let score = 0, timeLeft = 30, last = -1,
    timeout = null, timer = null;

/* ---------- Spel‑flow ---------- */
function start() {
  score = 0; timeLeft = 30;
  scoreEl.textContent = 0;
  timeEl.textContent  = timeLeft;
  spawn();
  timer = setInterval(() => {
    timeLeft--; timeEl.textContent = timeLeft;
    if (timeLeft <= 0) stop();
  }, 1000);
  if (!muted) ambient.play();
}

function stop() {
  clearTimeout(timeout);
  clearInterval(timer);
  ambient.pause();

  /* Update globale high‑score */
  if (score > parseInt(globalEl.textContent || 0)) {
    globalEl.textContent = score;
    set(ref(db, "highscore/global"), score);
  }

  /* Bewaar persoonlijke high‑score lokaal */
  const localHigh = parseInt(personalEl.textContent || 0);
  if (score > localHigh) {
    personalEl.textContent = score;
    localStorage.setItem("personalHigh", score);
  }

  /* Anonieme naam voor leaderboard */
  push(ref(db, "scores"), score);

  alert("Tijd voorbij! Je score is " + score);
}

function setCell(i, txt, type) {
  cells[i].textContent   = txt;
  cells[i].dataset.type  = type;
  cells[i].classList.add("spawn");
}

function spawn() {
  if (timeLeft <= 0) return;
  cells.forEach(c => { c.textContent = ""; c.dataset.type = "empty"; });

  /* Banaan */
  let b;
  do { b = Math.floor(Math.random() * 9); } while (b === last);
  last = b;
  setCell(b, "🍌", "banana");

  /* Ananas 20 % */
  if (Math.random() < 0.2) {
    let p;
    do { p = Math.floor(Math.random() * 9); } while (p === b);
    setCell(p, "🍍", "pine");
  }

  /* 1–2 Kokosnoten */
  let k = Math.random() < 0.5 ? 1 : 2;
  while (k) {
    let i = Math.floor(Math.random() * 9);
    if (cells[i].dataset.type === "empty") {
      setCell(i, "🥥", "coco");
      k--;
    }
  }

  /* Interval past zich aan score aan */
  const interval = 1000 - Math.min(score * 20, 500);
  timeout = setTimeout(spawn, interval);
}

function onClick(e) {
  if (timeLeft <= 0) return;
  const c = e.currentTarget;

  switch (c.dataset.type) {
    case "banana":
      score++; if (!muted) clickSnd.play(); break;
    case "pine":
      score += 5; if (!muted) clickSnd.play(); particle(c, "+5"); break;
    case "coco":
      score -= 2; if (!muted) errorSnd.play(); break;
    default:
      score--;   if (!muted) errorSnd.play(); break;
  }

  scoreEl.textContent = score;
  c.textContent = ""; c.dataset.type = "empty";
  if (navigator.vibrate) navigator.vibrate(50);
}

function particle(cell, text) {
  const span = document.createElement("span");
  span.textContent = text;
  span.style.position = "absolute";
  const r = cell.getBoundingClientRect();
  span.style.left  = r.left + r.width / 2 + "px";
  span.style.top   = r.top  + "px";
  span.style.fontSize = "24px";
  span.style.color = "#fff";
  span.style.animation = "float 1s ease-out";
  document.body.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}
document.head.insertAdjacentHTML(
  "beforeend",
  "<style>@keyframes float{0%{opacity:1;transform:translate(-50%,0);}100%{opacity:0;transform:translate(-50%,-80px);}}</style>"
);

document.getElementById("reset-btn").onclick = start;
start();
