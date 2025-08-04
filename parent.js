import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Util
function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

async function fetchCorrectAnswers(subject, grade) {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${grade}-${subject.toLowerCase()}.json`);
    const data = await response.json();
    return data.questions;
  } catch (e) {
    console.warn(`❌ Failed to load ${grade}-${subject} questions.`, e);
    return [];
  }
}

window.loadReport = async function () {
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
      studentResults.push({ ...data, timestamp: data.submittedAt?.seconds || Date.now() });
    }
  });

  if (studentResults.length === 0) {
    alert("No records found.");
    return;
  }

  // Group by session (1 hour)
  const grouped = {};
  studentResults.forEach((result) => {
    const sessionKey = Math.floor(result.timestamp / 3600);
    if (!grouped[sessionKey]) grouped[sessionKey] = [];
    grouped[sessionKey].push(result);
  });

  let blockIndex = 0;
  reportContent.innerHTML = "";
  for (const key in grouped) {
    const session = grouped[key];
    const { grade, tutorName, location } = session[0];
    const fullName = capitalize(session[0].studentName);
    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString();

    let subjectRows = '';
    let topicTable = '';

    for (const entry of session) {
      const correctAnswers = await fetchCorrectAnswers(entry.subject, entry.grade);
      let correct = 0;
      const topicsDone = [];

      entry.answers.forEach((ans, idx) => {
        if (correctAnswers[idx]?.correct_answer === ans) correct++;
        if (correctAnswers[idx]?.topic) topicsDone.push(correctAnswers[idx].topic);
      });

      const total = entry.answers.length;
      subjectRows += `<tr><td class="border px-2 py-1">${entry.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${correct}/${total}</td></tr>`;

      topicTable += `
        <tr>
          <td class="border px-2 py-1 font-semibold">${entry.subject.toUpperCase()}</td>
          <td class="border px-2 py-1">${[...new Set(topicsDone)].join(", ") || "General skill development recommended."}</td>
        </tr>`;
    }

    const block = `
      <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
        <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
        <p><strong>Parent Email:</strong> ${parentEmail}</p>
        <p><strong>Grade:</strong> ${grade}</p>
        <p><strong>Tutor:</strong> ${tutorName}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Session:</strong> ${formattedDate}</p>

        <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100"><tr><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
          <tbody>${subjectRows}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-2">Knowledge & Skill Analysis</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100"><tr><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Topics Covered</th></tr></thead>
          <tbody>${topicTable}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
        <p class="mb-2 italic">${tutorName} recommends targeted tutoring on topics above. Consistent practice and guidance will improve performance significantly.</p>

        <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
        <p class="italic text-sm">At Blooming Kids House, we are committed to helping your child thrive. With the dedication of ${tutorName}, and our curriculum-aligned approach, your child will blossom confidently.<br/><strong>– Mrs. Yinka Isikalu, Director</strong></p>

        <button onclick="downloadSessionReport(${blockIndex})" class="mt-4 btn-yellow px-4 py-2 rounded">Download PDF</button>
      </div>
    `;
    reportContent.innerHTML += block;
    blockIndex++;
  }

  reportArea.classList.remove("hidden");
};

window.downloadSessionReport = function (index) {
  const el = document.getElementById(`report-block-${index}`);
  import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js").then(() => {
    import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js").then(jsPDFModule => {
      const { jsPDF } = jsPDFModule;
      html2canvas(el).then(canvas => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF();
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Assessment_Report_${index + 1}.pdf`);
      });
    });
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
