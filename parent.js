import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { generatePDFReport } from './parentReport.js';

window.downloadReport = generatePDFReport;

window.logout = () => {
  window.location.href = "parent.html";
};

document.getElementById("fetchReport").addEventListener("click", async () => {
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  const subjectInput = document.getElementById("subject").value.trim().toLowerCase();

  if (!studentName || !parentEmail || !subjectInput) {
    alert("Please fill in all fields.");
    return;
  }

  const resultsRef = collection(db, "student_results");
  const q = query(resultsRef, where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));
  const querySnapshot = await getDocs(q);

  let found = false;

  querySnapshot.forEach(doc => {
    const data = doc.data();
    if ((data.subject || '').toLowerCase() === subjectInput) {
      found = true;
      showReport(data);
    }
  });

  if (!found) {
    alert("No matching report found.");
  }
});

function showReport(data) {
  const reportDiv = document.getElementById("report");
  const actionsDiv = document.getElementById("actions");

  const score = data.answers.filter(a => a === "correct").length;
  const total = data.answers.length;

  reportDiv.innerHTML = `
    <h2 class="text-xl font-semibold mb-2">Student: ${data.studentName}</h2>
    <p><strong>Subject:</strong> ${data.subject}</p>
    <p><strong>Grade:</strong> ${data.grade}</p>
    <p><strong>Tutor:</strong> ${data.tutorName}</p>
    <p><strong>Location:</strong> ${data.location}</p>
    <p><strong>Score:</strong> ${score} / ${total}</p>

    <div class="mt-4">
      <h3 class="font-bold text-green-700">Director's Message</h3>
      <p class="italic">Dear Parent, thank you for trusting us with your child's learning journey. This report reflects performance and areas where your child can grow. Let's work together to support their success. — Mrs. Yinka Isikalu</p>
    </div>

    <div class="mt-4">
      <h3 class="font-bold text-green-700">Recommendations</h3>
      <p>
        Based on the performance in <strong>${data.subject}</strong>, your child needs focused support on key areas of the curriculum.
        Our tutor <strong>${data.tutorName}</strong> will guide them in building confidence, addressing learning gaps, and mastering the topics covered in the test.
      </p>
    </div>
  `;

  reportDiv.classList.remove("hidden");
  actionsDiv.classList.remove("hidden");
}
