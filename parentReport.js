export function generatePDFReport() {
  const reportElement = document.getElementById("report");

  const opt = {
    margin: 0.5,
    filename: `blooming_report.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().from(reportElement).set(opt).save();
}
