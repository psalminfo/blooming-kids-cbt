import { generateFinalStudentReport } from './report-handler.js';

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".subject-btn");
  const logoutBtn = document.getElementById("logoutBtn");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const grade = button.getAttribute("data-grade");
      const subject = button.getAttribute("data-subject");
      if (!grade || !subject) {
        alert("Missing grade or subject.");
        return;
      }
      window.location.href = `tests/${grade}-${subject}.html`;
    });
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await generateFinalStudentReport();
      alert("Final report generated successfully.");
    } catch (error) {
      console.error("Failed to generate final report:", error);
      alert("There was an error generating the final report.");
    }
    localStorage.clear();
    window.location.href = "index.html";
  });
});
