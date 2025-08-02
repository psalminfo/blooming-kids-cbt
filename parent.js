// parent.js
import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

async function loadReport() {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  const reportArea = document.getElementById("reportArea");
  const reportContent = document.getElementById("reportContent");

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const q = query(collection(db, "student_results"), where("parentEmail", "==", parentEmail));
  const querySnapshot = await getDocs(q);

  const grouped = {};

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.studentName.toLowerCase() === studentName) {
      const timeKey = new Date(data.submittedAt.toDate());
      timeKey.setMinutes(0, 0, 0); // Round to the nearest hour
      const sessionKey = timeKey.toISOString();
      if (!grouped[sessionKey]) grouped[sessionKey] = [];
      grouped[sessionKey].push(data);
    }
  });

  if (Object.keys(grouped).length === 0) {
    alert("No records found.");
    return;
  }

  reportContent.innerHTML = "";

  Object.entries(grouped).forEach(([sessionTime, sessionData], index) => {
    const blockId = `report-block-${index}`;
    const { grade, tutorName, location } = sessionData[0];

    const scoreTable = sessionData.map((r) => {
      const correct = r.answers.filter(a => a === "correct").length;
      const percent = Math.round((correct / r.answers.length) * 100);
      return `<tr><td class='border px-2 py-1'>${capitalize(r.subject)}</td><td class='border px-2 py-1 text-center'>${percent}%</td></tr>`;
    }).join("");

    const topicsTable = sessionData.map(r => {
      const topics = Array.from(new Set((r.questions || []).map(q => q.topic || q.category || "N/A"))).join(", ");
      return `<tr><td class='border px-2 py-1'>${capitalize(r.subject)}</td><td class='border px-2 py-1'>${topics || 'N/A'}</td></tr>`;
    }).join("");

    const recommendations = sessionData.map(r => {
      const topics = Array.from(new Set((r.questions || []).map(q => q.topic || q.category || "key areas"))).join(", ");
      return `<li><strong>${capitalize(r.subject)}</strong>: Focus on ${topics.toLowerCase()} for improvement with ${tutorName}.</li>`;
    }).join("");

    reportContent.innerHTML += `
      <div class="mb-8 border border-gray-300 p-4 rounded-lg bg-white shadow" id="${blockId}">
        <h2 class="text-xl font-bold mb-2">Assessment Session - ${new Date(sessionTime).toLocaleString()}</h2>
        <p><strong>Student Name:</strong> ${capitalize(studentName)}</p>
        <p><strong>Grade:</strong> ${grade}</p>
        <p><strong>Parent Email:</strong> ${parentEmail}</p>
        <p><strong>Tutor:</strong> ${tutorName}</p>
        <p><strong>Location:</strong> ${location}</p>

        <hr class="my-3"/>
        <h3 class="text-lg font-semibold">Performance Summary</h3>
        <table class="w-full text-left border border-collapse my-2">
          <thead><tr class="bg-gray-100"><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Score (%)</th></tr></thead>
          <tbody>${scoreTable}</tbody>
        </table>

        <h3 class="text-lg font-semibold mt-4">Knowledge & Skill Analysis</h3>
        <table class="w-full text-left border border-collapse my-2">
          <thead><tr class="bg-gray-100"><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Topics Covered</th></tr></thead>
          <tbody>${topicsTable}</tbody>
        </table>

        <h3 class="text-lg font-semibold mt-4">Tutor’s Recommendation</h3>
        <ul class="list-disc pl-6">${recommendations}</ul>

        <h3 class="text-lg font-semibold mt-4">Director’s Note</h3>
        <p class="italic text-sm">Thank you for trusting Blooming Kids House. These results highlight your child's areas of strength and areas where support is needed. ${tutorName} is committed to providing tailored tutoring that builds confidence and mastery across key learning areas.</p>
        <p class="font-semibold text-right mt-2">– Mrs. Yinka Isikalu, Director</p>

        <div class="mt-4 text-right">
          <button onclick="downloadReport('${blockId}')" class="btn-yellow px-4 py-2 rounded">Download PDF</button>
        </div>
      </div>
    `;
  });

  document.getElementById("reportArea").classList.remove("hidden");
}

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

window.loadReport = loadReport;

window.downloadReport = function (blockId) {
  const element = document.getElementById(blockId);
  const opt = {
    margin: 0.5,
    filename: `${blockId}_Assessment_Report.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
};

window.logout = function () {
  window.location.href = "parent.html";
};
