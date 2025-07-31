import { uploadPDFtoCloudinary } from './uploadPDFtoCloudinary.js';
import { saveReportToFirestore } from './saveReportToFirestore.js';

export async function handleTestSubmit({ studentName, parentEmail, subject, grade, score }) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 10, 10);
  doc.text(`Student: ${studentName}`, 10, 20);
  doc.text(`Subject: ${subject}`, 10, 30);
  doc.text(`Grade: ${grade}`, 10, 40);
  doc.text(`Score: ${score}/30`, 10, 50);
  const pdfBlob = doc.output("blob");

  try {
    const pdfUrl = await uploadPDFtoCloudinary(pdfBlob);
    await saveReportToFirestore({ student: studentName, parentEmail, subject, grade, pdfUrl });

    // Redirect to subject selection page
    window.location.href = 'subject-select.html';

  } catch (error) {
    console.error("❌ Error in submission:", error);
    alert("Something went wrong. Please try again.");
  }
}
