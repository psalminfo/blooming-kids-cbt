import { db } from './firebaseConfig.js';
import { collection, getDocs, addDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js';

window.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const studentName = decodeURIComponent(params.get("name") || "");
  const parentEmail = decodeURIComponent(params.get("email") || "");
  const grade = params.get("grade") || "N/A";
  const tutorName = params.get("tutor") || "Your Assigned Tutor";

  if (!studentName || !parentEmail) {
    alert("Missing student info.");
    window.location.href = "parent.html";
    return;
  }

  await generateReport(studentName, parentEmail, grade, tutorName);
});

async function generateReport(studentName, parentEmail, grade, tutorName) {
  const resultsCol = collection(db, "results");
  const snapshot = await getDocs(resultsCol);
  const reportData = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (
      data.name?.toLowerCase() === studentName.toLowerCase() &&
      data.parentEmail?.toLowerCase() === parentEmail.toLowerCase()
    ) {
      reportData.push(data);
    }
  });

  if (reportData.length === 0) {
    alert("No test data found for this student.");
    return;
  }

  reportData.sort((a, b) => a.subject.localeCompare(b.subject));

  const reportDoc = new jsPDF();
  let y = 20;

  const marginLeft = 20;

  // Title
  reportDoc.setFontSize(16);
  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 105, y, { align: "center" });
  y += 10;

  // Student info
  reportDoc.setFontSize(12);
  reportDoc.setFont("helvetica", "normal");
  reportDoc.text(`Name: ${studentName}`, marginLeft, y);
  reportDoc.text(`Grade: ${grade}`, 120, y);
  y += 8;
  reportDoc.text(`Tutor: ${tutorName}`, marginLeft, y);
  reportDoc.text(`Parent Email: ${parentEmail}`, 120, y);
  y += 10;

  // Subjects
  for (let result of reportData) {
    if (y > 260) {
      reportDoc.addPage();
      y = 20;
    }

    reportDoc.setFont("helvetica", "bold");
    reportDoc.text(`${result.subject} Result`, marginLeft, y);
    y += 6;

    reportDoc.setFont("helvetica", "normal");
    reportDoc.text(`Score: ${result.score || "N/A"}%`, marginLeft + 5, y);
    y += 6;

    if (result.knowledge && Array.isArray(result.knowledge)) {
      reportDoc.text("Knowledge Gained:", marginLeft + 5, y);
      y += 6;
      for (let item of result.knowledge) {
        const lines = reportDoc.splitTextToSize(`• ${item}`, 160);
        reportDoc.text(lines, marginLeft + 10, y);
        y += lines.length * 5;
        if (y > 270) {
          reportDoc.addPage();
          y = 20;
        }
      }
    }

    if (result.skills && Array.isArray(result.skills)) {
      reportDoc.text("Skills Developed:", marginLeft + 5, y);
      y += 6;
      for (let skill of result.skills) {
        const lines = reportDoc.splitTextToSize(`• ${skill}`, 160);
        reportDoc.text(lines, marginLeft + 10, y);
        y += lines.length * 5;
        if (y > 270) {
          reportDoc.addPage();
          y = 20;
        }
      }
    }

    y += 8;
  }

  // Recommendation
  const recommendationText = `Based on the performance, we strongly recommend continued tutoring support with ${tutorName} to help ${studentName} improve and thrive academically.`;
  const recommendationLines = reportDoc.splitTextToSize(recommendationText, 170);
  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("Recommendation:", marginLeft, y);
  y += 6;
  reportDoc.setFont("helvetica", "normal");
  reportDoc.text(recommendationLines, marginLeft + 5, y);
  y += recommendationLines.length * 6;

  // Director’s Message
  if (y > 250) {
    reportDoc.addPage();
    y = 20;
  }

  const directorMessage = `Thank you for trusting Blooming Kids House. Our mission is to guide and support every child toward excellence. We are proud of ${studentName}'s progress and remain committed to their academic journey.\n\nSincerely,\nDirector, Blooming Kids House`;
  const directorLines = reportDoc.splitTextToSize(directorMessage, 170);

  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("Message from the Director:", marginLeft, y);
  y += 6;
  reportDoc.setFont("helvetica", "normal");
  reportDoc.text(directorLines, marginLeft + 5, y);
  y += directorLines.length * 6;

  // Footer
  reportDoc.setFontSize(10);
  reportDoc.setTextColor("#4CAF50");
  reportDoc.textWithLink("POWERED BY POG", 105, 285, { align: "center" });

  // Export as Blob for upload
  const pdfBlob = reportDoc.output("blob");

  // Upload to Cloudinary
  const cloudinaryUrl = "https://api.cloudinary.com/v1_1/blooming-kids-house/upload";
  const uploadPreset = "bkhpdf";

  const formData = new FormData();
  formData.append("file", pdfBlob);
  formData.append("upload_preset", uploadPreset);

  const uploadRes = await fetch(cloudinaryUrl, {
    method: "POST",
    body: formData
  });

  const uploadData = await uploadRes.json();
  const pdfUrl = uploadData.secure_url;

  // Save to Firestore under "reports"
  const reportRef = collection(db, "reports");
  await addDoc(reportRef, {
    studentName,
    parentEmail,
    grade,
    tutorName,
    reportUrl: pdfUrl,
    timestamp: new Date().toISOString()
  });

  // Open PDF
  window.open(pdfUrl, "_blank");
}
