export function renderReport() {
  document.addEventListener("DOMContentLoaded", () => {
    const data = JSON.parse(localStorage.getItem("studentReportData"));

    if (!data) {
      document.body.innerHTML = "<div class='text-center mt-10 text-red-500 font-bold'>Missing student info. Please return to the parent portal.</div>";
      return;
    }

    // Populate the fields
    document.getElementById("studentName").textContent = data.studentName || "N/A";
    document.getElementById("studentEmail").textContent = data.studentEmail || "N/A";
    document.getElementById("grade").textContent = data.grade || "N/A";
    document.getElementById("score").textContent = data.score || "N/A";
    document.getElementById("tutorName").textContent = data.tutorName || "N/A";
    document.getElementById("recommendation").textContent = data.recommendation || "N/A";

    // Download button
    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        window.print(); // or replace with PDF generation logic
      });
    }

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("studentReportData");
        window.location.href = "parent.html";
      });
    }
  });
}
