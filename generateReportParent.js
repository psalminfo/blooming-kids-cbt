import html2pdf from "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";

export function renderReportToHTML(studentName, parentEmail, allResults) {
  let html = `
    <div class="p-6">
      <h2 class="text-xl font-bold text-green-600 mb-4 text-center">BLOOMING KIDS HOUSE ASSESMENT REPORT</h2>
      <p><strong>Student Name:</strong> ${studentName}</p>
      <p><strong>Parent Email:</strong> ${parentEmail}</p>
      <p><strong>Total Subjects Taken:</strong> ${allResults.length}</p>
      <hr class="my-4"/>`;

  allResults.forEach(result => {
    const score = result.answers.filter(ans => ans === "correct").length;
    const subject = result.subject.charAt(0).toUpperCase() + result.subject.slice(1);
    const date = new Date(result.submittedAt?.seconds * 1000).toLocaleString();

    html += `
      <div class="my-4 border border-green-200 p-4 rounded bg-green-50">
        <h3 class="text-lg font-semibold text-green-700">${subject} Assessment</h3>
        <p><strong>Grade:</strong> ${result.grade}</p>
        <p><strong>Score:</strong> ${score} / 30</p>
        <p><strong>Location:</strong> ${result.location}</p>
        <p><strong>Tutor:</strong> ${result.tutorName}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p class="mt-2"><strong>Recommendation:</strong> Based on ${subject}, we suggest tutoring support to improve topics such as problem-solving, comprehension, and retention. Your assigned tutor, ${result.tutorName}, will guide your child through targeted lessons.</p>
      </div>`;
  });

  html += `
    <hr class="my-6"/>
    <p class="italic text-center text-sm">Director’s Message: We appreciate your trust in Blooming Kids House. We remain committed to your child’s academic growth. – Mrs. Yinka Isikalu</p>
    <p class="text-center mt-4 text-xs text-yellow-600">POWERED BY <span style="color:#FFEB3B">POG</span></p>
    </div>`;

  return html;
}

export function generateAndDownloadPDF(studentName, htmlContent) {
  const opt = {
    margin: 0.5,
    filename: `${studentName}-report.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
  };
  html2pdf().from(htmlContent).set(opt).save();
}
