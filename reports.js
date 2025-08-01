// report.js
import html2pdf from "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";

// Load student data from sessionStorage
const studentData = JSON.parse(sessionStorage.getItem("studentData"));
const studentName = sessionStorage.getItem("studentName");
const parentEmail = sessionStorage.getItem("parentEmail");

if (!studentData || !studentName || !parentEmail) {
  alert("Missing student info. Please return to the parent portal.");
  window.location.href = "parent.html";
}

document.getElementById("student-name").textContent = studentName;
document.getElementById("student-grade").textContent = studentData.grade || "N/A";
document.getElementById("parent-email").textContent = parentEmail;
document.getElementById("subject").textContent = studentData.subject || "N/A";
document.getElementById("tutor-name").textContent = studentData.tutorName || "N/A";
document.getElementById("director-tutor-name").textContent = studentData.tutorName || "our tutor";
document.getElementById("score").textContent = `${studentData.score || 0}/30`;

document.getElementById("summary-text").textContent = `Your child scored ${studentData.score} out of 30 in the ${studentData.subject} assessment. This result shows the student's performance across key areas in the ${studentData.subject} curriculum.`;

document.getElementById("recommendations").textContent = `We recommend targeted support in areas such as comprehension, vocabulary, and grammar (for ELA), or arithmetic, word problems, and measurement (for Math). Our tutor ${studentData.tutorName || "assigned"} will focus on these during sessions.`;

// Download PDF
document.getElementById("download-btn").addEventListener("click", () => {
  const report = document.getElementById("report-content");
  html2pdf().from(report).save(`${studentName}_report.pdf`);
});

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "parent.html";
});
