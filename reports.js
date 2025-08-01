// report.js
import { db } from './firebaseParentConfig.js'; // optional future use

window.addEventListener("DOMContentLoaded", () => {
  const studentName = sessionStorage.getItem("studentName");
  const parentEmail = sessionStorage.getItem("parentEmail");
  const rawData = sessionStorage.getItem("studentData");

  if (!studentName || !parentEmail || !rawData) {
    alert("Session expired. Please login again.");
    window.location.href = "parent.html";
    return;
  }

  const data = JSON.parse(rawData);
  const { grade, subject, score, total = 30, tutorName = "Assigned Tutor" } = data;

  document.getElementById("student-name").textContent = studentName;
  document.getElementById("grade").textContent = grade || "N/A";
  document.getElementById("subject").textContent = subject || "N/A";
  document.getElementById("score").textContent = `${score} / ${total}`;
  document.getElementById("tutor").textContent = tutorName;

  // Recommendations
  let rec = "";
  if (subject?.toLowerCase() === "math") {
    rec = `We encourage ${studentName} to focus on number sense, problem solving, and geometry. ${tutorName} will guide your child through daily practice sessions to build confidence and accuracy.`;
  } else if (subject?.toLowerCase() === "ela") {
    rec = `${studentName} should strengthen reading comprehension, grammar, and writing structure. ${tutorName} will provide support through guided reading and personalized writing tasks.`;
  } else {
    rec = `${studentName} will benefit from personalized tutoring with ${tutorName} to strengthen understanding of key curriculum topics.`;
  }

  document.getElementById("recommendation").textContent = rec;

  // Logout
  document.getElementById("logout").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "parent.html";
  });

  // Download as PDF
  document.getElementById("download-report").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Blooming Kids House – Student Report", 10, 20);
    doc.text(`Student Name: ${studentName}`, 10, 30);
    doc.text(`Grade: ${grade || "N/A"}`, 10, 40);
    doc.text(`Subject: ${subject}`, 10, 50);
    doc.text(`Score: ${score} / ${total}`, 10, 60);
    doc.text(`Tutor: ${tutorName}`, 10, 70);

    doc.text("Director's Message:", 10, 90);
    doc.setFontSize(12);
    doc.text(
      `We appreciate your child’s effort during the assessment. At Blooming Kids House, we recommend personalized tutoring sessions to strengthen your child's skills.\n\n– Mrs. Yinka Isikalu, Director`,
      10, 100
    );

    doc.setFontSize(14);
    doc.text("Recommendations:", 10, 150);
    doc.setFontSize(12);
    doc.text(rec, 10, 160, { maxWidth: 180 });

    doc.save(`${studentName}-report.pdf`);
  });
});
