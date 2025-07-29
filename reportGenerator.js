import { jsPDF } from "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
import { db } from "./firebaseConfig.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { calculateLetterGrade, formatDate } from "./utils.js";
import { storage } from "./firebaseConfig.js";

export async function generateReportAndUpload(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const lineHeight = 6;
  let y = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 105, y, { align: "center" });
  y += lineHeight;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("From the Director, Mrs. Yinka Isikalu", 105, y, { align: "center" });
  y += lineHeight * 1.5;

  // Info block
  const info = [
    `Student: ${data.studentName}`,
    `Parent: ${data.parentEmail}`,
    `Tutor: ${data.tutor}`,
    `Location: ${data.location}`,
    `Grade: ${data.grade}`,
    `Date: ${formatDate(data.timestamp)}`
  ];

  info.forEach((line, i) => {
    doc.text(line, 10 + (i % 2 === 0 ? 0 : 100), y + Math.floor(i / 2) * lineHeight);
  });

  y += lineHeight * 3;

  // Performance table
  doc.setFont("helvetica", "bold");
  doc.text("Performance Summary", 10, y);
  y += lineHeight;

  doc.setFont("helvetica", "normal");
  doc.text("Subject", 10, y);
  doc.text("Score", 60, y);
  doc.text("Percent", 110, y);
  doc.text("Grade", 160, y);
  y += lineHeight;

  doc.text(data.subject, 10, y);
  doc.text(`${data.score}/${data.total}`, 60, y);
  doc.text(`${data.percent}%`, 110, y);
  doc.text(calculateLetterGrade(data.percent), 160, y);
  y += lineHeight * 2;

  // Placeholder for Knowledge + Skills
  doc.setFont("helvetica", "bold");
  doc.text("Knowledge and Skills Breakdown", 10, y);
  y += lineHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("(Auto-generation coming soon)", 10, y);
  y += lineHeight * 2;

  // Recommendations
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Personalized Recommendations for ${data.studentName}`, 10, y);
  y += lineHeight;

  const message = `
Dear ${data.parentEmail},
At Blooming Kids House, our tutors are committed to ensuring your child excels academically. 
Based on the assessment results, our tutors will support your child’s growth in key areas.

Sincerely,
Mrs. Yinka Isikalu, Director`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(message, 190), 10, y);

  const pdfBlob = doc.output("blob");
  const reader = new FileReader();

  reader.onloadend = async function () {
    const base64data = reader.result.split(",")[1];
    const filename = `Reports/${data.parentEmail}/report_${Date.now()}.pdf`;
    const storageRef = ref(storage, filename);
    await uploadString(storageRef, base64data, "base64");
    const url = await getDownloadURL(storageRef);
    await addDoc(collection(db, "reports"), {
      url,
      student: data.studentName,
      parent: data.parentEmail,
      subject: data.subject,
      timestamp: data.timestamp,
    });
  };

  reader.readAsDataURL(pdfBlob);
}
