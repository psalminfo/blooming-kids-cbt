// generateReport.js
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
import {
  db,
  collection,
  getDocs,
  doc,
  updateDoc
} from './firebaseConfig.js';

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/dxewqfuul/upload";
const CLOUDINARY_UPLOAD_PRESET = "bloomingkids_preset"; // Update if needed

export async function generateReport(studentName, parentEmail, grade, tutorName) {
  const reportDoc = new jsPDF();

  // 1. Fetch all results for this student
  const querySnapshot = await getDocs(collection(db, "results"));
  const studentResults = [];

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.name === studentName && data.parentEmail === parentEmail) {
      studentResults.push(data);
    }
  });

  if (studentResults.length === 0) {
    alert("No results found for this student.");
    return;
  }

  // 2. Build tables for each subject
  let y = 20;

  reportDoc.setFont("helvetica", "bold");
  reportDoc.setFontSize(14);
  reportDoc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 105, y, { align: "center" });
  y += 10;

  reportDoc.setFontSize(11);
  reportDoc.setFont("helvetica", "normal");
  reportDoc.text(`Name: ${studentName}`, 15, y);
  reportDoc.text(`Grade: ${grade}`, 105, y);
  y += 8;
  reportDoc.text(`Parent Email: ${parentEmail}`, 15, y);
  reportDoc.text(`Tutor: ${tutorName}`, 105, y);
  y += 10;

  for (let subjectResult of studentResults) {
    const { subject, score, knowledge, skills } = subjectResult;

    reportDoc.setFont("helvetica", "bold");
    reportDoc.text(`Subject: ${subject}`, 15, y);
    y += 8;

    reportDoc.setFont("helvetica", "normal");
    reportDoc.text(`Score: ${score}%`, 15, y);
    y += 6;

    reportDoc.text("Knowledge Outcomes:", 15, y);
    y += 6;
    knowledge.forEach(k => {
      reportDoc.text(`- ${k}`, 20, y);
      y += 5;
    });

    reportDoc.text("Skills Outcomes:", 15, y);
    y += 6;
    skills.forEach(s => {
      reportDoc.text(`- ${s}`, 20, y);
      y += 5;
    });

    y += 8;
  }

  // 3. Add Personalized Recommendation
  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("RECOMMENDATION", 15, y);
  y += 8;

  reportDoc.setFont("helvetica", "normal");
  const recText = `Based on the assessment results, we strongly recommend that your child receive ongoing tutoring support. ${tutorName}, our experienced tutor, will be working closely with your child to address learning gaps and strengthen their understanding. This personalized attention will ensure your child excels confidently.`;
  const recLines = reportDoc.splitTextToSize(recText, 180);
  reportDoc.text(recLines, 15, y);
  y += recLines.length * 6 + 8;

  // 4. Add Director Message
  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("MESSAGE FROM THE DIRECTOR", 15, y);
  y += 8;

  const dirMessage = `Thank you for choosing Blooming Kids House. We are committed to your child's academic growth. This report reflects our passion for excellence and care. Please feel free to reach out for further assistance.`;
  const dirLines = reportDoc.splitTextToSize(dirMessage, 180);
  reportDoc.setFont("helvetica", "normal");
  reportDoc.text(dirLines, 15, y);
  y += dirLines.length * 6 + 10;

  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("Mrs. Oladoyin Temitope", 15, y);
  reportDoc.setFont("helvetica", "normal");
  reportDoc.text("Director, Blooming Kids House", 15, y + 6);

  // 5. Add Footer
  reportDoc.setFontSize(10);
  reportDoc.text("POWERED BY ", 15, 290);
  reportDoc.setTextColor("#FFEB3B");
  reportDoc.text("POG", 50, 290);
  reportDoc.setTextColor(0, 0, 0);

  // 6. Upload to Cloudinary
  const blob = reportDoc.output("blob");

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const cloudRes = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData
  });

  const cloudData = await cloudRes.json();
  const pdfUrl = cloudData.secure_url;

  // 7. Save the report URL to Firestore under "reports"
  const reportRef = doc(db, "reports", `${studentName}_${grade}`);
  await updateDoc(reportRef, {
    url: pdfUrl,
    timestamp: new Date()
  }).catch(async () => {
    await setDoc(reportRef, {
      name: studentName,
      grade,
      parentEmail,
      tutorName,
      url: pdfUrl,
      timestamp: new Date()
    });
  });

  // 8. Offer to download or view
  window.open(pdfUrl, "_blank");
}
