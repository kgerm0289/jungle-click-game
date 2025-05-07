import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, get, set, onValue, query, orderByValue, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQ6J6_4kX-0WxKPKWxDHMvzvv-CEsl_9c",
  authDomain: "testgame-4b20f.firebaseapp.com",
  databaseURL: "https://testgame-4b20f-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testgame-4b20f",
  storageBucket: "testgame-4b20f.appspot.com",
  messagingSenderId: "1041699656889",
  appId: "1:1041699656889:web:8599f44a8be05cd01df768"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);
/* ... shortened for brevity ... */
