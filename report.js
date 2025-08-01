import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import { firebaseConfig } from "./firebaseConfig.js";
import html2pdf from "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const params = new URLSearchParams(window.location.search);
const studentName = params.get("student");
const parentEmail = params.get("parent");

const reportContainer = document.getElementById("reportContent");
const downloadBtn = document.getElementById("downloadBtn");
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.addEventListener("click", () => {
  window.location.href = "parent.html";
});

async function fetchReport() {
  try {
    const resultsRef = collection(db, "student_results");
    const q = query(resultsRef,
      where("studentName", "==", studentName),
      where("parentEmail", "==", parentEmail)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      reportContainer.innerHTML = `<p class="text-red-500">No report found for this student and parent email.</p>`;
      return;
    }

    const data = snapshot.docs[0].data();

    const subjects = Object.keys(data.subjectScores || {});
    const subjectList = subjects.map(subj =>
      `<li><strong>${subj}:</strong> ${data.subjectScores[subj]}%</li>`
    ).join("");

    const recommendations = subjects.map(subj => {
      const score = data.subjectScores[subj];
      let message = score >= 80
        ? "Excellent work!"
        : score >= 60
          ? "Good effort, but needs some improvement."
          : "We recommend focused tutoring sessions.";

      return `<li><strong>${subj}:</strong> ${message}</li>`;
    }).join("");

    reportContainer.innerHTML = `
      <div id="report-pdf" class="space-y-4">
        <h3 class="text-xl font-bold text-gray-700">Student: ${data.studentName}</h3>
        <p><strong>Email:</strong> ${data.studentEmail}</p>
        <p><strong>Grade:</strong> ${data.grade}</p>
        <p><strong>Tutor:</strong> ${data.tutorName}</p>
        <ul class="list-disc pl-6">${subjectList}</ul>

        <h4 class="text-lg font-semibold text-yellow-700 mt-4">Director's Message</h4>
        <p>Dear Parent, we appreciate your commitment to your child’s education. At Blooming Kids House, we are dedicated to supporting each child’s unique learning journey. We look forward to partnering with you to help ${data.studentName} thrive academically.</p>
        <p class="italic">– Mrs. Yinka Isikalu (Director)</p>

        <h4 class="text-lg font-semibold text-yellow-700 mt-4">Recommendations</h4>
        <ul class="list-disc pl-6">${recommendations}</ul>
      </div>
    `;

    downloadBtn.onclick = () => {
      const element = document.getElementById("report-pdf");
      html2pdf().from(element).save(`${data.studentName}_report.pdf`);
    };

  } catch (err) {
    console.error("Error fetching report:", err);
    reportContainer.innerHTML = `<p class="text-red-500">Error loading report. Please try again later.</p>`;
  }
}

fetchReport();
