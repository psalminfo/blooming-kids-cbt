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

  const studentResults = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.studentName.toLowerCase() === studentName) {
      studentResults.push({ id: doc.id, ...data });
    }
  });

  if (studentResults.length === 0) {
    alert("No records found.");
    return;
  }

  // Group results by rounded hour timestamp (same test session)
  const grouped = {};
  studentResults.forEach((res) => {
    const date = new Date(res.submittedAt?.seconds * 1000);
    const roundedKey = date.toISOString().slice(0, 13); // e.g., 2025-08-01T10
    if (!grouped[roundedKey]) grouped[roundedKey] = [];
    grouped[roundedKey].push(res);
  });

  reportContent.innerHTML = "";
  Object.entries(grouped).forEach(([session, tests], index) => {
    const summaryRows = tests.map((r) => {
      const score = r.answers.filter((a) => a === "correct").length;
      const percent = Math.round((score / r.answers.length) * 100);
      return `<tr><td class="border px-4 py-1">${r.subject.toUpperCase()}</td><td class="border px-4 py-1">${percent}%</td></tr>`;
    }).join("");

    const allTopics = tests.flatMap(r => r.topic || []);
    const uniqueTopics = [...new Set(allTopics)];

    const topicTable = uniqueTopics.map(topic => `
      <tr>
        <td class="border px-4 py-1">${topic}</td>
        <td class="border px-4 py-1">Needs Practice</td>
      </tr>
    `).join("");

    const htmlBlock = `
      <div class="report-block bg-white p-6 rounded shadow mb-6" id="report-block-${index}">
        <h2 class="text-xl font-bold mb-2">${capitalize(tests[0].studentName)}</h2>
        <p><strong>Parent Email:</strong> ${parentEmail}</p>
        <p><strong>Grade:</strong> ${tests[0].grade}</p>
        <p><strong>Tutor:</strong> ${tests[0].tutorName}</p>
        <p><strong>Location:</strong> ${tests[0].location}</p>
        <p><strong>Test Session:</strong> ${new Date(tests[0].submittedAt.seconds * 1000).toLocaleString()}</p>

        <h3 class="mt-4 font-semibold text-lg">Performance Summary (Percent)</h3>
        <table class="w-full mb-3 border">
          <thead><tr><th class="border px-4 py-1">Subject</th><th class="border px-4 py-1">Score</th></tr></thead>
          <tbody>${summaryRows}</tbody>
        </table>

        <h3 class="mt-4 font-semibold text-lg">Knowledge & Skills Analysis</h3>
        <table class="w-full mb-3 border">
          <thead><tr><th class="border px-4 py-1">Topic</th><th class="border px-4 py-1">Remarks</th></tr></thead>
          <tbody>${topicTable}</tbody>
        </table>

        <h3 class="mt-4 font-semibold text-lg">Tutor's Recommendation</h3>
        <p class="mb-2">It is recommended that ${capitalize(tests[0].studentName)} receive focused tutoring on the topics listed above. Our tutor, ${tests[0].tutorName}, will support your child through personalized sessions.</p>

        <h3 class="mt-4 font-semibold text-lg">Director’s Message</h3>
        <p class="italic">Thank you for choosing Blooming Kids House. We are committed to nurturing your child’s academic growth through personalized support. We recommend regular practice and guided learning to build confidence and mastery.</p>
        <p class="mt-2 font-bold">– Mrs. Yinka Isikalu, Director</p>

        <button class="mt-4 bg-yellow-400 px-4 py-2 rounded font-bold" onclick="downloadSessionReport(${index})">Download PDF</button>
      </div>
    `;
    reportContent.innerHTML += htmlBlock;
  });

  reportArea.classList.remove("hidden");
}

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ✅ Target only that block for PDF generation
window.downloadSessionReport = function (index) {
  const el = document.getElementById(`report-block-${index}`);
  setTimeout(() => {
    import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js").then(() => {
      html2pdf().from(el).save(`Assessment_Report_${index + 1}.pdf`);
    });
  }, 300); // Wait for layout
};

window.loadReport = loadReport;

window.logout = function () {
  window.location.href = "parent.html";
};
