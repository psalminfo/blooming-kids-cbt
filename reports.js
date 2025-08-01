// report.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { firebaseConfig } from "./firebaseConfig.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const studentName = sessionStorage.getItem("studentName");
const parentEmail = sessionStorage.getItem("parentEmail");

if (!studentName || !parentEmail) {
  document.body.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-yellow-50">
      <div class="bg-white p-6 rounded shadow text-center">
        <p class="text-lg font-semibold text-red-500">Missing student info. Please return to the parent portal.</p>
        <a href="parent.html" class="text-yellow-600 underline mt-4 block">Go to Parent Portal</a>
      </div>
    </div>
  `;
  throw new Error("Missing session data");
}

const resultsRef = collection(db, "results");
const q = query(resultsRef, where("studentName", "==", studentName));

getDocs(q).then(snapshot => {
  if (snapshot.empty) {
    document.getElementById("report").innerHTML = `
      <div class="text-center text-red-500 font-semibold">No report found for ${studentName}.</div>
    `;
    return;
  }

  let reportsHtml = "";
  snapshot.forEach(doc => {
    const data = doc.data();
    reportsHtml += generateReportCard(data);
  });

  document.getElementById("report").innerHTML = reportsHtml;
});

function generateReportCard(data) {
  const subjects = Object.keys(data.scores || {});
  const subjectList = subjects.map(subject => `
    <li><strong>${subject}:</strong> ${data.scores[subject]}%</li>
  `).join("");

  const recommendations = subjects.map(subject => `
    <li>${subject}: ${generateRecommendation(subject)}</li>
  `).join("");

  return `
    <div class="bg-white p-6 rounded shadow-md">
      <h2 class="text-2xl font-bold mb-4 text-yellow-600">Student Report</h2>
      <p><strong>Name:</strong> ${data.studentName}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Grade:</strong> ${data.grade}</p>
      <p><strong>Assigned Tutor:</strong> ${data.tutorName}</p>
      <ul class="mt-4 space-y-1">${subjectList}</ul>
      <div class="mt-6">
        <h3 class="text-lg font-semibold mb-2">Recommendations</h3>
        <ul class="list-disc pl-5">${recommendations}</ul>
      </div>
      <div class="mt-6 italic text-sm text-gray-700">
        Director's Note: Thank you for trusting us. Your child's learning journey is important to us.
        — <strong>Mrs. Yinka Isikalu</strong>, Director
      </div>
      <div class="mt-6 text-xs text-center text-gray-500">
        POWERED BY <span style="color:#FFEB3B">POG</span>
      </div>
      <div class="mt-4 text-center">
        <a href="parent.html" class="text-yellow-600 underline">Logout</a>
      </div>
    </div>
  `;
}

function generateRecommendation(subject) {
  return `Further support in ${subject} is advised. The tutor will focus on helping your child master key areas using curriculum-based strategies.`;
}
