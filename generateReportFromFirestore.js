// generateReportFromFirestore.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your Firebase config (already shared by you)
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Utility: Extract query parameters
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Load and render report
export async function fetchAndRenderReport() {
  const studentName = getQueryParam("name");
  const studentEmail = getQueryParam("email");

  if (!studentName || !studentEmail) {
    document.body.innerHTML = "<div class='text-center mt-10 text-red-500 font-bold'>Invalid access. Missing student info.</div>";
    return;
  }

  const docId = `${studentEmail}-${studentName}`; // Must match how it's stored in Firestore
  const docRef = doc(db, "student_results", docId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    renderReport(data); // render to DOM
  } else {
    document.body.innerHTML = "<div class='text-center mt-10 text-red-500 font-bold'>No report data found. Please go back to the parent portal.</div>";
  }
}

// Inject data into HTML
function renderReport(data) {
  document.getElementById("studentName").textContent = data.studentName || "N/A";
  document.getElementById("studentEmail").textContent = data.studentEmail || "N/A";
  document.getElementById("grade").textContent = data.grade || "N/A";
  document.getElementById("score").textContent = data.score || "N/A";
  document.getElementById("tutorName").textContent = data.tutorName || "N/A";
  document.getElementById("recommendation").textContent = data.recommendation || "N/A";
}
