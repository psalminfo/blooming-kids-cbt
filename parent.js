import { db } from './firebaseConfig.js';
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(timestamp) {
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString();
}

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

  const allResults = [];
  querySnapshot.forEach(doc => {
    const data = doc.data();
    if (data.studentName.toLowerCase() === studentName) {
      allResults.push({ ...data, submittedAt: doc.data().submittedAt });
    }
  });

  if (allResults.length === 0) {
    alert("No records found.");
    return;
  }

  // Group results by session (within 1 hour of each other)
  const grouped = [];
  allResults.sort((a, b) => a.submittedAt.seconds - b.submittedAt.seconds);

  allResults.forEach(result => {
    const lastGroup = grouped[grouped.length - 1];
    if (
      !lastGroup ||
      Math.abs(result.submittedAt.seconds - lastGroup[0].submittedAt.seconds) > 3600
    ) {
      grouped.push([result]);
    } else {
      lastGroup.push(result);
    }
  });

  // Render each session group
  reportContent.innerHTML = "";
  grouped.forEach((session, index) => {
    const first = session[0];
    const topics = new Set();
    const scoreTableRows = session
      .map(r => {
        const correct = r.answers.filter(a => a === "correct").length;
        const percent = ((correct / r.answers.length) * 100).toFixed(0);
        topics.add(r.topic || "General"); // fallback to 'General' if topic missing
        return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1">${percent}%</td></tr>`;
      })
      .join("");

    const topicList = [...topics].map(t => `<li>${t}</li>`).join("");

    reportContent.innerHTML += `
      <div class="bg-white rounded-xl shadow-md p-6 mb-6">
        <h2 class="text-xl font-bold mb-2">Student Name: ${capitalize(first.studentName)}</h2>
        <p><strong>Parent Email:</strong> ${parentEmail}</p>
        <p><strong>Grade:</strong> ${first.grade}</p>
        <p><strong>Tutor:</strong> ${first.tutorName}</p>
        <p><strong>Location:</strong> ${first.location}</p>
        <p><strong>Session Time:</strong> ${formatDate(first.submittedAt)}</p>

        <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
        <table class="table-auto border w-full mb-4 text-left text-sm">
          <thead><tr><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Score (%)</th></tr></thead>
          <tbody>${scoreTableRows}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-2">Knowledge & Skills Analysis</h3>
        <ul class="list-disc pl-5 mb-4">${topicList}</ul>

        <h3 class="text-lg font-semibold mb-2">Tutor’s Recommendation</h3>
        <p class="mb-4">To improve performance, our tutor <strong>${first.tutorName}</strong> recommends revisiting the listed topics with personalized lessons. Regular practice sessions will greatly boost confidence and accuracy.</p>

        <h3 class="text-lg font-semibold mb-2">Director’s Message</h3>
        <p class="italic text-sm mb-2">Dear Parent, thank you for trusting Blooming Kids House. Based on this session, we encourage ongoing support through focused tutoring. We are committed to helping your child grow in mastery and confidence across all subjects.</p>
        <p class="text-sm font-bold">– Mrs. Yinka Isikalu, Director</p>

        <button class="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" onclick="downloadPDF(this)">Download PDF</button>
      </div>
    `;
  });

  reportArea.classList.remove("hidden");
}

window.loadReport = loadReport;

window.downloadPDF = function (btn) {
  import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js").then(() => {
    const block = btn.closest(".bg-white");
    const opt = {
      margin: 0.5,
      filename: 'Assessment_Report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(block).save();
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
