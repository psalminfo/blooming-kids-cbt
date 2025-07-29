import { db } from './firebaseConfig.js';

async function generatePDFReport(resultData) {
  const { student, parent, tutor, location, grade, timestamp, subject, score, total, percent } = resultData;

  const doc = new jspdf.jsPDF();
  doc.setFontSize(12);
  doc.setTextColor(40);

  // Title
  doc.setFontSize(16);
  doc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 105, 15, null, null, "center");

  doc.setFontSize(10);
  doc.text("From the Director, Mrs. Yinka Isikalu", 200, 22, null, null, "right");

  // Info Block
  const info = [
    `Student: ${student}`, `Parent: ${parent}`, `Tutor: ${tutor}`,
    `Location: ${location}`, `Grade: ${grade}`, `Date: ${new Date(timestamp).toLocaleString()}`
  ];
  doc.setFontSize(9);
  info.forEach((line, i) => {
    doc.text(line, 14 + (i % 3) * 70, 32 + Math.floor(i / 3) * 6);
  });

  // Performance Summary Table
  doc.autoTable({
    startY: 45,
    head: [['Subject', 'Score', 'Percentage', 'Letter Grade']],
    body: [[subject, `${score}/${total}`, `${percent}%`, getLetterGrade(percent)]],
    theme: 'grid'
  });

  // Recommendation Section
  const recY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.text(`Personalized Recommendations for ${student}`, 14, recY);

  const message = `Dear ${parent},\nAt Blooming Kids House, our tutors are committed to ensuring your child excels academically and develops well-rounded skills. Based on the assessment results, our tutors will focus on key areas to support your child’s growth.`;

  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(message, 180), 14, recY + 6);

  doc.text("Math", 14, recY + 26);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(`
- Practice rounding numbers with real-life items
- Use games to identify place values
- Compare fractions using visuals
- Improve multiplication facts
- Use real-life scenarios for arithmetic
- Solve division problems with remainders
- Measure and calculate areas/perimeters
- Identify shapes and properties
- Create data charts
- Analyze bar graphs
- Practice budgeting and expenses
  `, 180), 14, recY + 30);

  doc.text("ELA", 110, recY + 26);
  doc.text(doc.splitTextToSize(`
- Read texts and discuss ideas
- Use context clues for vocabulary
- Summarize stories and articles
- Write short paragraphs
- Identify parts of speech
- Practice grammar corrections
  `, 90), 110, recY + 30);

  // Director's Closing
  doc.setFont("helvetica", "bold");
  doc.text("Sincerely,", 14, 260);
  doc.text("Mrs. Yinka Isikalu, Director", 14, 265);

  // Upload to Cloudinary
  const pdfBlob = doc.output("blob");
  const formData = new FormData();
  formData.append("file", pdfBlob);
  formData.append("upload_preset", "bkh_assessments");
  formData.append("folder", `bkh_assessments/reports/${student}`);

  const response = await fetch("https://api.cloudinary.com/v1_1/dy2hxcyaf/upload", {
    method: "POST",
    body: formData
  });

  const data = await response.json();
  const pdfUrl = data.secure_url;

  await db.collection("reports").add({
    student,
    parent,
    subject,
    url: pdfUrl,
    createdAt: new Date().toISOString()
  });

  return pdfUrl;
}

function getLetterGrade(percent) {
  const p = parseFloat(percent);
  if (p >= 90) return "A";
  if (p >= 80) return "B";
  if (p >= 70) return "C";
  if (p >= 60) return "D";
  return "F";
}

export { generatePDFReport };
