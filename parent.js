import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

async function fetchSubjectTopics(subject, answers) {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/3-${subject}.json`);
    const data = await response.json();
    const matchedTopics = new Set();

    data.questions.forEach(q => {
      if (answers.includes(q.correct_answer)) {
        if (q.topic) matchedTopics.add(q.topic);
      }
    });

    return Array.from(matchedTopics);
  } catch (err) {
    console.warn(`Could not fetch topics for ${subject}:`, err);
    return [];
  }
}

function formatPercentage(score, total) {
  return `${Math.round((score / total) * 100)}%`;
}

function formatDate(timestamp) {
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-GB', {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function groupBySession(results) {
  const sessions = {};
  results.forEach(r => {
    const t = r.submittedAt.toDate ? r.submittedAt.toDate() : new Date(r.submittedAt);
    const key = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}-${t.getHours()}`;
    if (!sessions[key]) sessions[key] = [];
    sessions[key].push(r);
  });
  return sessions;
}

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
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
      studentResults.push(data);
    }
  });

  if (studentResults.length === 0) {
    alert("No records found.");
    return;
  }

  const sessions = groupBySession(studentResults);
  reportContent.innerHTML = "";

  for (const sessionKey in sessions) {
    const session = sessions[sessionKey];
    const topicsMap = {};
    const scoreTable = [];

    for (const r of session) {
      const correctCount = r.answers.filter(a => a === "correct").length;
      scoreTable.push({
        subject: r.subject,
        score: correctCount,
        total: r.answers.length
      });

      const topics = await fetchSubjectTopics(r.subject, r.answers);
      topicsMap[r.subject] = topics;
    }

    const base = session[0]; // Use first record for meta details
    const sessionTime = formatDate(base.submittedAt);
    const topicsAll = Object.entries(topicsMap).map(([subj, topics]) =>
      `<li><strong>${subj.toUpperCase()}:</strong> ${topics.length ? topics.join(", ") : "No topics found."}</li>`
    ).join("");

    const performanceTable = scoreTable.map(s =>
      `<tr><td class="border px-3 py-1">${s.subject.toUpperCase()}</td><td class="border px-3 py-1">${formatPercentage(s.score, s.total)}</td></tr>`
    ).join("");

    reportContent.innerHTML += `
      <div class="bg-white shadow-md rounded-xl p-6 my-6">
        <h2 class="text-2xl font-bold mb-1 text-green-700">Blooming Kids House Assessment Report</h2>
        <p class="text-sm text-gray-500 mb-3">${sessionTime}</p>

        <p><strong>Student Name:</strong> ${capitalize(base.studentName)}</p>
        <p><strong>Grade:</strong> ${base.grade}</p>
        <p><strong>Tutor:</strong> ${base.tutorName}</p>
        <p><strong>Location:</strong> ${base.location}</p>

        <hr class="my-4" />

        <h3 class="font-semibold text-lg mb-2">Performance Summary</h3>
        <table class="w-full mb-4 text-sm border border-gray-300">
          <thead class="bg-gray-100"><tr><th class="border px-3 py-1">Subject</th><th class="border px-3 py-1">Score (%)</th></tr></thead>
          <tbody>${performanceTable}</tbody>
        </table>

        <h3 class="font-semibold text-lg mb-2">Knowledge & Skill Analysis</h3>
        <ul class="list-disc pl-6 text-sm mb-4">${topicsAll}</ul>

        <h3 class="font-semibold text-lg mb-2">Tutor’s Recommendation</h3>
        <p class="mb-4 text-sm">Based on the assessment, personalized guidance is recommended for continued growth. ${base.tutorName} will work with ${capitalize(base.studentName)} to strengthen skills and build mastery in each area listed above.</p>

        <h3 class="font-semibold text-lg mb-2">Director’s Message</h3>
        <p class="italic text-sm">We appreciate your trust in Blooming Kids House. Our goal is to nurture potential through personalized support. With continuous effort and tutor guidance, your child is on the path to excellence.</p>
        <p class="mt-2 text-right font-semibold">– Mrs. Yinka Isikalu, Director</p>

        <div class="text-right mt-6">
          <button onclick="downloadPDF(this)" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl text-sm">Download PDF</button>
        </div>
      </div>
    `;
  }

  reportArea.classList.remove("hidden");
};

window.downloadPDF = function (btn) {
  import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js").then(() => {
    const reportBlock = btn.closest(".bg-white");
    html2pdf().from(reportBlock).save("Assessment_Report.pdf");
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
