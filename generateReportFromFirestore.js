export function renderReport() {
  const data = JSON.parse(localStorage.getItem("studentReportData"));

  if (!data) {
    document.body.innerHTML = "<div class='text-center mt-10 text-red-500 font-bold'>Missing student info. Please return to the parent portal.</div>";
    return;
  }

  document.getElementById("studentName").textContent = data.studentName || "N/A";
  document.getElementById("studentEmail").textContent = data.studentEmail || "N/A";
  document.getElementById("grade").textContent = data.grade || "N/A";
  document.getElementById("score").textContent = data.score || "N/A";
  document.getElementById("tutorName").textContent = data.tutorName || "N/A";
  document.getElementById("recommendation").textContent = data.recommendation || "N/A";
}

function downloadPDF() {
  const element = document.body;
  const opt = {
    margin:       0.5,
    filename:     'student_report.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().from(element).set(opt).save();
}

window.addEventListener("DOMContentLoaded", () => {
  renderReport();
  document.getElementById("downloadBtn").addEventListener("click", downloadPDF);
});
