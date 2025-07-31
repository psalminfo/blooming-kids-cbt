// generateReport.js
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebaseConfig.js";
import jsPDF from "jspdf";

// Generates a report PDF, uploads it, and returns the download URL
export async function generateReport(studentName, parentEmail, testResults) {
  try {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 20, 20);

    doc.setFontSize(12);
    doc.text(`Student Name: ${studentName}`, 20, 40);
    doc.text(`Parent Email: ${parentEmail}`, 20, 50);
    doc.text(`Performance Summary:`, 20, 70);

    let y = 80;
    for (const [subject, score] of Object.entries(testResults)) {
      doc.text(`${subject}: ${score}%`, 30, y);
      y += 10;
    }

    doc.text("Recommendation: We recommend continued tutoring support with their assigned tutor.", 20, y + 10);
    doc.text("— Mrs. Yinka Isikalu, Director, Blooming Kids House", 20, y + 30);

    const pdfBlob = doc.output("blob");

    // Upload to Firebase Storage
    const timestamp = Date.now();
    const fileRef = ref(storage, `reports/${studentName}_${timestamp}.pdf`);
    await uploadBytes(fileRef, pdfBlob);
    const downloadURL = await getDownloadURL(fileRef);

    return downloadURL;
  } catch (error) {
    console.error("Error generating or uploading report:", error);
    throw error;
  }
}
