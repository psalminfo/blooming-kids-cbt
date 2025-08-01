window.addEventListener("DOMContentLoaded", () => {
  const data = JSON.parse(localStorage.getItem("reportData"));

  if (!data || !data.studentName || !data.studentEmail) {
    alert("Missing student info. Please return to the parent portal.");
    window.location.href = "parent.html";
    return;
  }

  // Populate report
  document.getElementById("studentName").textContent = data.studentName;
  document.getElementById("studentEmail").textContent = data.studentEmail;
  document.getElementById("grade").textContent = data.grade;
  document.getElementById("score").textContent = data.score + "%";
  document.getElementById("tutorName").textContent = data.tutorName;
  document.getElementById("recommendation").textContent = data.recommendation;

  // Director Message
  document.getElementById("directorMessage").textContent = `
    At Blooming Kids House, we believe every child has the potential to excel. 
    ${data.studentName} has taken an important step. Our tutor, ${data.tutorName}, 
    will provide personalized support to ensure progress in key subjects.
  `;

  // Handle download button
  const downloadBtn = document.getElementById("downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      window.print(); // or generate PDF with html2pdf if you prefer
    });
  }

  // Handle logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("reportData");
      window.location.href = "parent.html";
    });
  }
});
