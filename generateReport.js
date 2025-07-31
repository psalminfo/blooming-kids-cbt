// generateReport.js
import { db } from './firebaseConfig.js';
import { collection, getDocs, addDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js';

async function generateReport(studentName, parentEmail, grade, tutorName) {
  const resultsCol = collection(db, "results");
  const snapshot = await getDocs(resultsCol);
  const reportData = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.name === studentName && data.parentEmail === parentEmail) {
      reportData.push(data);
    }
  });

  if (reportData.length === 0) {
    alert("No test data found for this student.");
    return;
  }

  // Sort subjects alphabetically for consistency
  reportData.sort((a, b) => a.subject.localeCompare(b.subject));

  const reportDoc = new jsPDF();
  let y = 20;

  // Title
  reportDoc.setFontSize(16);
  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 105, y, { align: 'center' });
  y += 10;

  // Student info
  reportDoc.setFontSize(12);
  reportDoc.setFont("helvetica", "normal");
  reportDoc.text(`Name: ${studentName}`, 20, y);
  reportDoc.text(`Grade: ${grade}`, 110, y);
  y += 8;
  reportDoc.text(`Tutor: ${tutorName}`, 20, y);
  reportDoc.text(`Parent Email: ${parentEmail}`, 110, y);
  y += 10;

  // Subject Results
  for (let result of reportData) {
    if (y > 260) {
      reportDoc.addPage();
      y = 20;
    }

    reportDoc.setFont("helvetica", "bold");
    reportDoc.text(`${result.subject} Result`, 20, y);
    y += 6;

    reportDoc.setFont("helvetica", "normal");
    reportDoc.text(`Score: ${result.score}%`, 25, y);
    y += 6;

    if (result.knowledge && Array.isArray(result.knowledge)) {
      reportDoc.text("Knowledge Gained:", 25, y);
      y += 6;
      for (let item of result.knowledge) {
        reportDoc.text(`• ${item}`, 30, y);
        y += 5;
        if (y > 270) {
          reportDoc.addPage();
          y = 20;
        }
      }
    }

    if (result.skills && Array.isArray(result.skills)) {
      reportDoc.text("Skills Developed:", 25, y);
      y += 6;
      for (let skill of result.skills) {
        reportDoc.text(`• ${skill}`, 30, y);
        y += 5;
        if (y > 270) {
          reportDoc.addPage();
          y = 20;
        }
      }
    }

    y += 8;
  }

  // Recommendation
  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("Recommendation:", 20, y);
  y += 6;
  reportDoc.setFont("helvetica", "normal");
  const recommendation = `Based on the performance, we strongly recommend continued tutoring support with ${tutorName} to help ${studentName} improve and thrive academically.`;
  const splitRecommendation = reportDoc.splitTextToSize(recommendation, 170);
  reportDoc.text(splitRecommendation, 25, y);
  y += splitRecommendation.length * 6;

  // Director Message
  if (y > 250) {
    reportDoc.addPage();
    y = 20;
  }

  reportDoc.setFont("helvetica", "bold");
  reportDoc.text("Message from the Director:", 20, y);
  y += 6;
  reportDoc.setFont("helvetica", "normal");
  const directorMessage = `Thank you for trusting Blooming Kids House. Our mission is to guide and support every child toward excellence. We are proud of ${studentName}'s progress and remain committed to their academic journey.\n\nSincerely,\nDirector, Blooming Kids House`;
  const splitMessage = reportDoc.splitTextToSize(directorMessage, 170);
  reportDoc.text(splitMessage, 25, y);
  y += splitMessage.length * 6;

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

  // Open PDF in new tab
  window.open(pdfUrl, "_blank");
}

window.generateReport = generateReport;
