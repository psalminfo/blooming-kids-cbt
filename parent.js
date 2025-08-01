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

  const subjects = studentResults.map(r => r.subject.toUpperCase());
  const scores = studentResults.map(r => {
    const correct = r.answers.filter(a => a === "correct").length;
    return { subject: r.subject, score: correct, total: r.answers.length };
  });

  // Report layout
  reportContent.innerHTML = `
    <h2 class="text-xl font-bold mb-2">Student Name: ${capitalize(studentResults[0].studentName)}</h2>
    <p><strong>Parent Email:</strong> ${parentEmail}</p>
    <p><strong>Grade:</strong> ${studentResults[0].grade}</p>
    <p><strong>Tutor:</strong> ${studentResults[0].tutorName}</p>
    <p><strong>Location:</strong> ${studentResults[0].location}</p>
    <hr class="my-3"/>
    <h3 class="text-lg font-semibold mb-2">Subject Scores:</h3>
    <ul class="mb-4">
      ${scores.map(s => `<li><strong>${s.subject.toUpperCase()}</strong>: ${s.score}/${s.total}</li>`).join("")}
    </ul>
    <h3 class="text-lg font-semibold mb-1">Director’s Message:</h3>
    <p class="mb-2 italic">Dear Parent, thank you for trusting Blooming Kids House. Based on the results, we recommend personalized tutoring for your child to build confidence and mastery. Our tutor, ${studentResults[0].tutorName}, will guide them with expert support across all topics tested.</p>
    <h3 class="text-lg font-semibold mb-1">Recommendations:</h3>
    <ul class="list-disc pl-5">
      ${studentResults.map(r => `<li><strong>${r.subject.toUpperCase()}</strong>: Focus on revising major concepts covered in the assessment. Consistent tutoring sessions are highly recommended.</li>`).join("")}
    </ul>
    <footer class="text-sm text-center text-gray-500 mt-6">POWERED BY <span class="text-blooming-yellow font-bold">POG</span></footer>
  `;

  reportArea.classList.remove("hidden");
}

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

window.loadReport = loadReport;

window.downloadReport = function () {
  import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js").then(module => {
    const element = document.getElementById("reportContent");
    html2pdf().from(element).save("Assessment_Report.pdf");
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
