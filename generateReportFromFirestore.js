export function renderReport() {
  const data = JSON.parse(localStorage.getItem("reportData"));

  if (!data) {
    document.body.innerHTML = "<div class='text-center mt-10 text-red-500 font-bold'>Report not found. Please return to the parent login page.</div>";
    return;
  }

  document.getElementById("studentName").textContent = data.studentName || "N/A";
  document.getElementById("studentEmail").textContent = data.studentEmail || "N/A";
  document.getElementById("grade").textContent = data.grade || "N/A";
  document.getElementById("score").textContent = data.score || "N/A";
  document.getElementById("tutorName").textContent = data.tutorName || "N/A";
  document.getElementById("recommendation").textContent = data.recommendation || "N/A";
}
