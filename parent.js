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

  const sessions = {};

  for (const doc of querySnapshot.docs) {
    const data = doc.data();
    if (data.studentName.toLowerCase() !== studentName) continue;

    const submittedAt = data.submittedAt?.seconds || 0;
    const rounded = Math.floor(submittedAt / 3600) * 3600;

    if (!sessions[rounded]) sessions[rounded] = [];
    sessions[rounded].push(data);
  }

  if (Object.keys(sessions).length === 0) {
    alert("No records found.");
    return;
  }

  reportContent.innerHTML = "";

  for (const [timestamp, tests] of Object.entries(sessions)) {
    const date = new Date(timestamp * 1000).toLocaleString();
    const base = tests[0];

    const subjectScores = tests.map(t => {
      const correct = t.answers.filter(a => a === "correct").length;
      const percent = Math.round((correct / t.answers.length) * 100);
      return { subject: t.subject.toUpperCase(), percent };
    });

    const topics = await collectTopics(tests);

    const sessionHTML = `
      <div class="bg-white rounded-2xl shadow-md p-6 mb-8">
        <h2 class="text-xl font-bold text-green-700 mb-2">BLOOMING KIDS HOUSE ASSESSMENT REPORT</h2>
        <p><strong>Student Name:</strong> ${capitalize(base.studentName)}</p>
        <p><strong>Parent Email:</strong> ${parentEmail}</p>
        <p><strong>Grade:</strong> ${base.grade}</p>
        <p><strong>Location:</strong> ${base.location}</p>
        <p><strong>Tutor:</strong> ${base.tutorName}</p>
        <p><strong>Submitted:</strong> ${date}</p>

        <hr class="my-4 border-yellow-400"/>

        <h3 class="text-lg font-semibold text-green-800 mb-1">Performance Summary</h3>
        <table class="w-full text-left border mb-4">
          <thead><tr class="bg-yellow-100"><th class="p-2">Subject</th><th class="p-2">Score (%)</th></tr></thead>
          <tbody>
            ${subjectScores.map(s => `<tr><td class="p-2">${s.subject}</td><td class="p-2">${s.percent}%</td></tr>`).join("")}
          </tbody>
        </table>

        <h3 class="text-lg font-semibold text-green-800 mb-1">Knowledge & Skill Analysis</h3>
        <p class="mb-4">${topics.length ? topics.join(", ") : "Key curriculum areas were assessed across subjects."}</p>

        <h3 class="text-lg font-semibold text-green-800 mb-1">Tutor’s Recommendation</h3>
        <p class="mb-4">We encourage consistent review of the topics listed above. ${base.tutorName} will provide personalized support to reinforce these skills and boost confidence in upcoming assessments.</p>

        <h3 class="text-lg font-semibold text-green-800 mb-1">Director’s Message</h3>
        <p class="italic mb-2">Dear Parent,</p>
        <p class="mb-2">Thank you for partnering with Blooming Kids House. We are committed to helping your child excel academically and personally. With the support of our expert tutors, your child will gain confidence and mastery in every subject area.</p>
        <p class="font-bold mb-2">– Mrs. Yinka Isikalu, Director</p>

        <button class="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" onclick="downloadPDF(this)">Download PDF</button>
      </div>
    `;

    reportContent.innerHTML += sessionHTML;
  }

  reportArea.classList.remove("hidden");
}

async function collectTopics(tests) {
  const topics = new Set();

  for (const test of tests) {
    const file = `${test.grade}-${test.subject}.json`;
    try {
      const res = await fetch(`https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${file}`);
      const json = await res.json();

      const questionMap = {};
      for (const q of json.questions) {
        questionMap[q.question] = q.topic || "";
      }

      for (const ans of test.answers) {
        const matchedTopic = questionMap[ans];
        if (matchedTopic) topics.add(matchedTopic);
      }
    } catch (e) {
      console.warn("Topic fetch failed for", file);
    }
  }

  return Array.from(topics);
}

function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

window.loadReport = loadReport;

window.downloadPDF = function (btn) {
  import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js").then(() => {
    const reportBlock = btn.closest(".bg-white");
    const opt = {
      margin: 0.5,
      filename: 'Assessment_Report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(reportBlock).save();
  });
};

window.logout = () => {
  window.location.href = "parent.html";
};
