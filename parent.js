// parent.js
import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const githubBase = 'https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main';

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

function getQuestionFileURL(grade, subject) {
  return `${githubBase}/${grade}-${subject.toLowerCase()}.json`;
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

  const grouped = {};
  studentResults.forEach((r) => {
    const sessionKey = Math.floor(r.timestamp / 3600);
    if (!grouped[sessionKey]) grouped[sessionKey] = [];
    grouped[sessionKey].push(r);
  });

  let blockIndex = 0;
  reportContent.innerHTML = "";
  for (const key in grouped) {
    const session = grouped[key];
    const fullName = capitalize(session[0].studentName);
    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString();
    const { grade, tutorName, location } = session[0];

    const scoreTable = [];
    const topicsMap = {}; // { topic: count }
    const skillsMap = {}; // { skill_detail: count }

    for (let r of session) {
      try {
        const res = await fetch(getQuestionFileURL(r.grade, r.subject));
        const { questions } = await res.json();

        let correct = 0;
        r.answers.forEach((a, i) => {
          if (questions[i] && questions[i].correct_answer === a) {
            correct++;
          }

          const topic = questions[i]?.topic || "General";
          const skill = questions[i]?.skill_detail || null;
          topicsMap[topic] = (topicsMap[topic] || 0) + 1;
          if (skill) skillsMap[skill] = (skillsMap[skill] || 0) + 1;
        });

        scoreTable.push(`<tr><td class='border px-2 py-1'>${r.subject.toUpperCase()}</td><td class='border px-2 py-1 text-center'>${correct}/${r.answers.length}</td></tr>`);
      } catch (err) {
        console.warn("Failed to fetch GitHub question file", err);
      }
    }

    const topicList = Object.entries(topicsMap).map(([topic, count]) => `<li>${topic} (${count} questions)</li>`).join("");
    const skillList = Object.entries(skillsMap).map(([skill, count]) => `<li>${skill} (${count})</li>`).join("");

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
          <tbody>${scoreTable.join("")}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-1">Knowledge & Skill Analysis</h3>
        <ul class="list-disc pl-5 mb-2">${topicList}</ul>
        <ul class="list-disc pl-5 mb-4 text-sm text-gray-700">${skillList}</ul>

        <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
        <p class="mb-2 italic">${tutorName} recommends consistent focus on the highlighted areas. Ongoing guidance will improve mastery and performance.</p>

        <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
        <p class="italic text-sm">Thank you for trusting Blooming Kids House. Your child's learning journey is our top priority. With tailored support from ${tutorName}, we believe your child will thrive. <br/>– Mrs. Yinka Isikalu, Director</p>

        <div class="flex justify-end mt-4">
          <button onclick="downloadSessionReport(${blockIndex})" class="btn-yellow px-4 py-2 rounded">Download PDF</button>
        </div>
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
    import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js").then((jspdfModule) => {
      const { jsPDF } = jspdfModule;
      html2canvas(el).then((canvas) => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Assessment_Report_${index + 1}.pdf`);
      });
    });
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
