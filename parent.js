import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

async function fetchQuestionData(grade, subject) {
  const fileName = `${grade}-${subject.toLowerCase()}.json`;
  const url = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.questions;
  } catch (err) {
    console.error("Failed to fetch question data:", err);
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

    const rows = await Promise.all(session.map(async (r) => {
      const allQuestions = await fetchQuestionData(r.grade, r.subject);
      let correctCount = 0;
      let topicsSet = new Set();

      for (let i = 0; i < r.answers.length; i++) {
        const submitted = r.answers[i];
        const correct = allQuestions[i]?.correct_answer;
        const topic = allQuestions[i]?.topic || allQuestions[i]?.topics?.[0];

        if (submitted === correct) correctCount++;
        if (topic) topicsSet.add(topic);
      }

      const percent = Math.round((correctCount / r.answers.length) * 100);
      return {
        subject: r.subject.toUpperCase(),
        percent,
        topics: Array.from(topicsSet)
      };
    }));

    const tableHTML = rows.map(r => `<tr><td class="border px-2 py-1">${r.subject}</td><td class="border px-2 py-1 text-center">${r.percent}%</td></tr>`).join("");

    const topicHTML = rows.map(r => `<li><strong>${r.subject}:</strong> ${r.topics.join(", ") || "General skill development recommended."}</li>`).join("");

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
            <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score (%)</th></tr>
          </thead>
          <tbody>${tableHTML}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-1">Knowledge & Skill Analysis</h3>
        <ul class="list-disc pl-5 mb-4">${topicHTML}</ul>

        <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
        <p class="mb-2 italic">${tutorName} recommends dedicated focus on the skills highlighted above. Regular tutoring sessions will help reinforce understanding and build long-term confidence.</p>

        <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
        <p class="italic text-sm">At Blooming Kids House, we are committed to helping your child succeed. Personalized support and guidance from ${tutorName} will unlock the full potential of ${fullName}.<br/>– Mrs. Yinka Isikalu, Director</p>

        <div class="flex justify-between mt-4">
          <button onclick="downloadSessionReport(${blockIndex})" class="btn-yellow px-4 py-2 rounded">Download PDF</button>
          <button onclick="logout()" class="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
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
        const pdf = new jsPDF("p", "mm", "a4");
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
