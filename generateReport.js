// generateReport.js
document.addEventListener("DOMContentLoaded", () => {
  const studentName = localStorage.getItem("studentName");
  const parentEmail = localStorage.getItem("parentEmail");

  if (!studentName || !parentEmail) {
    alert("Missing student or parent information. Please log in again.");
    window.location.href = "parent.html";
    return;
  }

  const reportContainer = document.getElementById("reportContainer");

  // Simulate loading a report
  reportContainer.innerHTML = `
    <div class="bg-green-50 p-4 rounded shadow">
      <h2 class="text-xl font-bold text-green-800 mb-2">Report for ${studentName}</h2>
      <p><strong>Parent Email:</strong> ${parentEmail}</p>
      <p><strong>Performance Summary:</strong> Your child completed the assessments and results are below.</p>
      <p><strong>Subjects:</strong> Math: 82%, ELA: 88%</p>
      <p><strong>Recommendation:</strong> We recommend continued tutoring support with their assigned tutor.</p>
      <p class="mt-4 italic text-sm text-gray-500">— Director, Blooming Kids House</p>
    </div>
  `;
});
