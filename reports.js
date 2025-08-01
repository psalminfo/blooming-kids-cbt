import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { generateAndDownloadPDF, renderReportToHTML } from './generateReportParent.js';

const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const downloadBtn = document.getElementById("downloadBtn");

loginBtn.addEventListener("click", async () => {
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const q = query(
    collection(db, "student_results"),
    where("studentName", "==", studentName),
    where("parentEmail", "==", parentEmail)
  );

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    alert("No matching report found. Please check the details.");
    return;
  }

  const allResults = [];
  querySnapshot.forEach(doc => allResults.push(doc.data()));

  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("reportSection").classList.remove("hidden");

  const html = renderReportToHTML(studentName, parentEmail, allResults);
  document.getElementById("reportContainer").innerHTML = html;

  downloadBtn.onclick = () => {
    generateAndDownloadPDF(studentName, html);
  };
});

logoutBtn.addEventListener("click", () => {
  window.location.reload();
});
