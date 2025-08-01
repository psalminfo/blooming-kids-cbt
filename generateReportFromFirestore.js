// generateReportFromFirestore.js

document.addEventListener("DOMContentLoaded", () => {
  const reportData = JSON.parse(localStorage.getItem("reportData"));

  if (!reportData) {
    alert("Missing student info. Please return to the parent portal.");
    window.location.href = "parent.html";
    return;
  }

  const studentInfoDiv = document.getElementById("studentInfo");
  studentInfoDiv.innerHTML = `
    <p><strong>Student Name:</strong> ${reportData.studentName}</p>
    <p><strong>Grade:</strong> ${reportData.grade}</p>
    <p><strong>Score:</strong> ${reportData.score}%</p>
    <p><strong>Assigned Tutor:</strong> ${reportData.tutorName}</p>
  `;

  const recommendation = reportData.recommendation || `
    Based on your child's recent assessment, we recommend focused support in foundational curriculum areas including reading comprehension, arithmetic reasoning, and problem-solving strategies.
    Our dedicated tutor, ${reportData.tutorName}, will guide your child through tailored sessions to build confidence and mastery.
  `;

  document.getElementById("recommendationText").textContent = recommendation;

  // Download button
  document.getElementById("downloadBtn").addEventListener("click", () => {
    window.print(); // This can be replaced later with html2pdf for styled PDF
  });

  // Logout button
  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("reportData");
    window.location.href = "parent.html";
  });
});
