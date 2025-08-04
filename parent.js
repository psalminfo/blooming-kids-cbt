import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Capitalize names properly
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
      studentResults.push({ ...data, timestamp: data.submittedAt?.seconds || Date.now() });
    }
  });

  if (studentResults.length === 0) {
    alert("No records found.");
    return;
  }

  const grouped = {};
  studentResults.forEach((result) => {
    const sessionKey = Math.floor(result.timestamp / 3600); // group by hour
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

    const tableRows = session.map(r => {
      const correct = r.answers.filter(a => a === "correct").length;
      return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${correct}/${r.answers.length}</td></tr>`;
    }).join("");

    const topicRecommendations = session.map(r => {
      const topics = (r.topic || r.topics || []).join(", ");
      const skill = r.skill_detail || "";
      return `<li><strong>${r.subject.toUpperCase()}:</strong> ${topics || "General skill development"} ${skill ? ` - ${skill}` : ""}</li>`;
    }).join("");

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

        <h3 class="text-lg font-semibold mb-1">Knowledge & Skill Analysis</h3>
        <ul class="list-disc pl-5 mb-4">${topicRecommendations}</ul>

        <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
        <p class="mb-2 italic">${tutorName} recommends consistent support in the listed topics. Regular sessions will build mastery and confidence.</p>

        <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
        <p class="italic text-sm">Thank you for choosing Blooming Kids House. With the dedication of our tutor ${tutorName}, we are confident your child will achieve excellence. <br/>– Mrs. Yinka Isikalu, Director</p>

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

window.downloadSessionReport = async function (index) {
  const el = document.getElementById(`report-block-${index}`);

  const html2canvas = (await import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js")).default;
  const jspdfModule = await import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const { jsPDF } = jspdfModule;

  html2canvas(el).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Assessment_Report_${index + 1}.pdf`);
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
