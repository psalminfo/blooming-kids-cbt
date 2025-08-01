// parent.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM
const loginForm = document.getElementById("parentLoginForm");
const reportSection = document.getElementById("reportSection");
const loginSection = document.getElementById("loginSection");
const reportContent = document.getElementById("reportContent");
const downloadBtn = document.getElementById("downloadReport");
const logoutBtn = document.getElementById("logoutBtn");

// Helpers
function formatReport(results, studentName) {
  const subjects = results.map(doc => doc.subject.toUpperCase());
  const testDate = new Date(results[0].timestamp?.seconds * 1000).toLocaleDateString();

  const intro = `<h2 class="text-xl font-bold text-yellow-800 mb-2">Assessment Report for ${studentName}</h2>
  <p class="text-sm text-gray-600 mb-2"><strong>Date:</strong> ${testDate}</p>`;

  let subjectBlocks = "";

  results.forEach(doc => {
    const data = doc;
    subjectBlocks += `
      <div class="mt-4 p-4 border rounded-lg bg-yellow-50 shadow">
        <h3 class="text-lg font-semibold text-yellow-900">${data.subject}</h3>
        <p><strong>Score:</strong> ${data.score || 0}%</p>
        <p><strong>Grade:</strong> ${data.grade || "N/A"}</p>
        <p><strong>Recommendations:</strong> ${data.recommendation || "Review foundational concepts in this subject and practice consistently."}</p>
        <p><strong>Tutor:</strong> ${data.tutor || "Blooming Kids Tutor"}</p>
      </div>
    `;
  });

  const directorMsg = `
    <div class="mt-6 p-4 bg-yellow-100 rounded-lg border-l-4 border-yellow-500">
      <h4 class="font-bold text-yellow-800">Director’s Message</h4>
      <p class="text-gray-700">
        Dear Parent, <br/>
        Thank you for trusting Blooming Kids House with your child’s learning journey.
        We strongly believe every child can thrive with the right guidance, and our tutors are dedicated to helping ${studentName} grow in confidence and skills.
        Please review the recommendations and feel free to reach out to us for personalized tutoring support.
        <br/><br/>Sincerely,<br/><strong>Mrs. Yinka Isikalu</strong><br/>Director, Blooming Kids House
      </p>
    </div>
  `;

  const footer = `<footer class="mt-8 text-sm text-center text-gray-500">POWERED BY <span style="color:#FFEB3B">POG</span></footer>`;

  return intro + subjectBlocks + directorMsg + footer;
}

// Fetch and build report
loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  const studentName = document.getElementById("studentName").value.trim();

  if (!parentEmail || !studentName) return alert("Please fill in both fields.");

  try {
    await signInAnonymously(auth);

    const resultRef = collection(db, "results");
    const q = query(resultRef, where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("No report found for this student.");
      return;
    }

    const resultData = [];
    querySnapshot.forEach(doc => resultData.push(doc.data()));

    // Sort by timestamp
    resultData.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    // Group by closeness (within 1 hour)
    const grouped = [];
    let group = [resultData[0]];
    for (let i = 1; i < resultData.length; i++) {
      const prev = resultData[i - 1].timestamp?.seconds || 0;
      const curr = resultData[i].timestamp?.seconds || 0;
      if (curr - prev <= 3600) {
        group.push(resultData[i]);
      } else {
        grouped.push(group);
        group = [resultData[i]];
      }
    }
    grouped.push(group); // Push last group

    // Only show most recent group
    const latestGroup = grouped[grouped.length - 1];
    reportContent.innerHTML = formatReport(latestGroup, studentName);

    loginSection.classList.add("hidden");
    reportSection.classList.remove("hidden");

  } catch (err) {
    console.error("Error generating report:", err);
    alert("Something went wrong. Please try again.");
  }
});

// Download as PDF
downloadBtn.addEventListener("click", () => {
  const pdf = new jsPDF("p", "pt", "a4");
  pdf.html(reportContent, {
    callback: doc => doc.save("report.pdf"),
    margin: [20, 20, 20, 20],
    autoPaging: 'text',
    html2canvas: { scale: 0.5 }
  });
});

// Logout
logoutBtn.addEventListener("click", () => {
  reportSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  reportContent.innerHTML = "";
  loginForm.reset();
});
