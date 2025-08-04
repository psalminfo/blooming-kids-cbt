import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Helper to fetch correct answers from GitHub
async function fetchSubjectData(grade, subject) {
  const url = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${grade}-${subject}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${subject} questions`);
  const data = await res.json();
  return data.questions || [];
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

  // Group sessions by 1 hour timestamp
  const grouped = {};
  studentResults.forEach(result => {
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

    let tableRows = "";
    let skillAnalysisRows = "";

    for (let r of session) {
      try {
        const questionSet = await fetchSubjectData(grade, r.subject);
        const submittedAnswers = r.answers || [];
        const correctAnswers = questionSet.map(q => q.correct_answer);
        let correctCount = 0;

        // Match questions directly
        for (let i = 0; i < submittedAnswers.length; i++) {
          if (submittedAnswers[i] === correctAnswers[i]) {
            correctCount++;
          }
        }

        tableRows += `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${correctCount}/${submittedAnswers.length}</td></tr>`;

        // Topics + skills
        const topics = {};
        for (let i = 0; i < questionSet.length && i < submittedAnswers.length; i++) {
          const topic = questionSet[i].topic || "General";
          const skill = questionSet[i].skill_detail || "";
          if (!topics[topic]) topics[topic] = new Set();
          if (skill) topics[topic].add(skill);
        }

        for (let topic in topics) {
          skillAnalysisRows += `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1">${topic}</td><td class="border px-2 py-1">${[...topics[topic]].join(", ") || "General skills"}</td></tr>`;
        }
      } catch (err) {
        console.warn("Question fetch error:", err.message);
      }
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
          <thead class="bg-gray-100">
            <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-2">Knowledge & Skill Analysis</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100">
            <tr><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Topic</th><th class="border px-2 py-1">Skill Detail</th></tr>
          </thead>
          <tbody>${skillAnalysisRows}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-2">Tutor’s Recommendation</h3>
        <p class="italic">${tutorName} recommends focused revision on the topics listed above. Consistent tutoring sessions will help strengthen weak areas and boost confidence.</p>

        <h3 class="text-lg font-semibold mb-2">Director’s Message</h3>
        <p class="italic text-sm">At Blooming Kids House, we are committed to helping your child succeed. Personalized support and guidance from ${tutorName} will unlock ${fullName}’s full potential.<br/>– Mrs. Yinka Isikalu, Director</p>

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
  import("https://rawcdn.githack.com/eKoopmans/html2pdf.js/0.9.3/dist/html2pdf.bundle.js").then(() => {
    html2pdf().set({
      margin: 10,
      filename: `Assessment_Report_${index + 1}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el).save();
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
