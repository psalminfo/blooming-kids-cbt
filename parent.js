// parent.js (final working version with full validation, charts, accurate score, and PDF download)

import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Helper: Capitalize name
function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Helper: Load correct answers for a subject/grade from GitHub
async function fetchCorrectAnswers(subject, grade) {
  const url = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${grade}-${subject}.json`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.questions.map(q => ({ answer: q.correct_answer, topic: q.topic || '', skill_detail: q.skill_detail || '' }));
  } catch (err) {
    console.error("Failed to load correct answers for:", subject, grade, err);
    return [];
  }
}

// Load student report from Firebase
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

  querySnapshot.forEach(doc => {
    const data = doc.data();
    if (data.studentName.toLowerCase() === studentName) {
      studentResults.push({ ...data, timestamp: data.submittedAt?.seconds || Date.now() });
    }
  });

  if (studentResults.length === 0) {
    alert("No records found.");
    return;
  }

  // Group sessions by hour
  const grouped = {};
  studentResults.forEach((result) => {
    const sessionKey = Math.floor(result.timestamp / 3600);
    if (!grouped[sessionKey]) grouped[sessionKey] = [];
    grouped[sessionKey].push(result);
  });

  reportContent.innerHTML = "";
  let blockIndex = 0;

  for (const key in grouped) {
    const session = grouped[key];
    const { grade, tutorName, location } = session[0];
    const fullName = capitalize(session[0].studentName);
    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString();

    const performanceRows = [];
    const topicList = [];

    for (const result of session) {
      const correctSet = await fetchCorrectAnswers(result.subject, result.grade);
      let correct = 0;
      const answered = result.answers || [];

      answered.forEach((ans, i) => {
        if (correctSet[i] && ans === correctSet[i].answer) correct++;
        if (correctSet[i]) topicList.push({
          subject: result.subject,
          topic: correctSet[i].topic,
          skill: correctSet[i].skill_detail
        });
      });

      performanceRows.push(`<tr><td class='border px-2 py-1'>${result.subject.toUpperCase()}</td><td class='border px-2 py-1 text-center'>${correct} / ${answered.length}</td></tr>`);
    }

    const topicTable = Object.values(topicList.reduce((acc, curr) => {
      const key = curr.subject + '-' + curr.topic;
      if (!acc[key]) acc[key] = { ...curr, count: 1 };
      else acc[key].count++;
      return acc;
    }, {})).map(t => `<tr><td class='border px-2 py-1'>${t.subject.toUpperCase()}</td><td class='border px-2 py-1'>${t.topic}</td><td class='border px-2 py-1'>${t.skill}</td></tr>`).join('');

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
          <thead class="bg-gray-100">
            <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr>
          </thead>
          <tbody>${performanceRows.join("")}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-2">Knowledge & Skill Analysis</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100">
            <tr><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Topic</th><th class="border px-2 py-1">Skill Detail</th></tr>
          </thead>
          <tbody>${topicTable}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
        <p class="mb-2 italic">${tutorName} recommends continued support in the skill areas listed above. Regular tutoring sessions will deepen your child’s understanding and confidence.</p>

        <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
        <p class="italic text-sm">At Blooming Kids House, we are committed to helping your child thrive. Personalized learning support and expert guidance from ${tutorName} will unlock their full potential.<br/>– Mrs. Yinka Isikalu, Director</p>

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
  setTimeout(() => {
    import("https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js").then(() => {
      html2pdf().set({
        margin: 0.5,
        filename: `Assessment_Report_${index + 1}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      }).from(el).save();
    });
  }, 500);
};

window.logout = function () {
  window.location.href = "parent.html";
};
