import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

  const rawResults = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.studentName.toLowerCase() === studentName) {
      rawResults.push(data);
    }
  });

  if (rawResults.length === 0) {
    alert("No records found.");
    return;
  }

  // Group sessions within 1 hour
  rawResults.sort((a, b) => a.submittedAt.seconds - b.submittedAt.seconds);
  const groupedSessions = [];
  let currentGroup = [];

  rawResults.forEach((entry, i) => {
    const ts = entry.submittedAt.seconds;
    if (currentGroup.length === 0) {
      currentGroup.push(entry);
    } else {
      const last = currentGroup[currentGroup.length - 1];
      if (ts - last.submittedAt.seconds <= 3600) {
        currentGroup.push(entry);
      } else {
        groupedSessions.push(currentGroup);
        currentGroup = [entry];
      }
    }
    if (i === rawResults.length - 1 && currentGroup.length > 0) {
      groupedSessions.push(currentGroup);
    }
  });

  // Render reports
  reportContent.innerHTML = groupedSessions.map((group, index) => {
    const first = group[0];
    const scores = group.map(r => {
      const correct = r.answers.filter(a => a === "correct").length;
      const total = r.answers.length;
      const percent = Math.round((correct / total) * 100);
      return { subject: r.subject, percent, topic: r.topic || "General Concepts" };
    });

    const scoreTable = `
      <table class="w-full text-sm border mt-2">
        <thead>
          <tr class="bg-gray-100">
            <th class="border p-1">Subject</th>
            <th class="border p-1">Score (%)</th>
          </tr>
        </thead>
        <tbody>
          ${scores.map(s => `
            <tr>
              <td class="border p-1 text-center">${s.subject.toUpperCase()}</td>
              <td class="border p-1 text-center">${s.percent}%</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    const knowledgeTable = `
      <table class="w-full text-sm border mt-2">
        <thead>
          <tr class="bg-gray-100">
            <th class="border p-1">Subject</th>
            <th class="border p-1">Topics Covered</th>
          </tr>
        </thead>
        <tbody>
          ${scores.map(s => `
            <tr>
              <td class="border p-1 text-center">${s.subject.toUpperCase()}</td>
              <td class="border p-1 text-center">${s.topic}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    const submittedDate = new Date(first.submittedAt.seconds * 1000).toLocaleString();

    return `
      <div id="report-block-${index}" class="p-4 border rounded mb-6 bg-white shadow">
        <h2 class="text-xl font-bold mb-1">Assessment Report – Session ${index + 1}</h2>
        <p class="text-sm text-gray-500 mb-3">Submitted on: ${submittedDate}</p>

        <p><strong>Student:</strong> ${capitalize(first.studentName)}</p>
        <p><strong>Grade:</strong> ${first.grade}</p>
        <p><strong>Parent Email:</strong> ${first.parentEmail}</p>
        <p><strong>Tutor:</strong> ${first.tutorName}</p>
        <p><strong>Location:</strong> ${first.location}</p>

        <h3 class="mt-4 font-semibold">Performance Summary</h3>
        ${scoreTable}

        <h3 class="mt-4 font-semibold">Knowledge & Skill Analysis</h3>
        ${knowledgeTable}

        <h3 class="mt-4 font-semibold">Tutor's Recommendation</h3>
        <p class="text-sm mt-1 mb-2">We encourage your child to continue practicing especially in areas highlighted. Our tutor, ${first.tutorName}, will support your child with targeted practice and encouragement.</p>

        <h3 class="mt-4 font-semibold">Director's Message</h3>
        <p class="text-sm italic">Thank you for trusting Blooming Kids House. We are committed to excellence and growth. Our tailored sessions build confidence and mastery in each child.<br><br>– <strong>Mrs. Yinka Isikalu</strong>, Director</p>

        <div class="mt-4 flex justify-end">
          <button onclick="downloadSessionReport(${index})" class="bg-yellow-400 text-black px-4 py-1 rounded font-bold">Download PDF</button>
        </div>
      </div>`;
  }).join("");

  document.getElementById("reportArea").classList.remove("hidden");
};

// ✅ PDF export using html2canvas + jsPDF
window.downloadSessionReport = function (index) {
  const el = document.getElementById(`report-block-${index}`);

  import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js").then(({ jsPDF }) => {
    import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js").then(() => {
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

// 🔁 Logout button
window.logout = function () {
  window.location.href = "parent.html";
};
