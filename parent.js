// parent.js
import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

async function fetchSubjectData(grade, subject) {
  const url = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${grade}-${subject.toLowerCase()}.json`;
  const res = await fetch(url);
  const data = await res.json();
  return data.questions;
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

    const tableRows = await Promise.all(session.map(async r => {
      const questionSet = await fetchSubjectData(grade, r.subject);
      let correct = 0;
      for (let i = 0; i < r.answers.length; i++) {
        if (questionSet[i] && r.answers[i] === questionSet[i].correct_answer) correct++;
      }
      return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${correct}/${r.answers.length}</td></tr>`;
    }));

    let skillAnalysisRows = "";
    const topicMap = {};
    for (let r of session) {
      try {
        const questionSet = await fetchSubjectData(grade, r.subject);
        for (let i = 0; i < questionSet.length && i < r.answers.length; i++) {
          const topic = questionSet[i].topic || "General";
          const skill = questionSet[i].skill_detail || "";
          if (!topicMap[r.subject]) topicMap[r.subject] = { topics: new Set(), skills: new Set() };
          topicMap[r.subject].topics.add(topic);
          if (skill) topicMap[r.subject].skills.add(skill);
        }
      } catch (e) {
        console.warn("Error loading question set:", e.message);
      }
    }

    for (let subject in topicMap) {
      skillAnalysisRows += `
        <tr><td class="border px-2 py-1 font-bold">${subject.toUpperCase()}</td><td class="border px-2 py-1">${[...topicMap[subject].topics].join(", ")}</td></tr>
        <tr><td class="border px-2 py-1 italic">Skill Details</td><td class="border px-2 py-1 italic">${[...topicMap[subject].skills].join(", ") || "General skills"}</td></tr>
      `;
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
          <tbody>${tableRows.join("")}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-2">Knowledge & Skill Analysis</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <tbody>${skillAnalysisRows}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
        <p class="mb-2 italic">${tutorName} recommends dedicated focus on the skills highlighted above. Regular tutoring sessions will help reinforce understanding and build long-term confidence.</p>

        <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
        <p class="italic text-sm">At Blooming Kids House, we are committed to helping your child succeed. Personalized support and guidance from ${tutorName} will unlock the full potential of ${fullName}.<br/>– Mrs. Yinka Isikalu, Director</p>

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
  html2pdf().set({
    margin: 10,
    filename: `Assessment_Report_${index + 1}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(el).save();
};

window.logout = function () {
  window.location.href = "parent.html";
};
