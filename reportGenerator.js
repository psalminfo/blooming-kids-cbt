import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateAssessmentReport(data) {
  const {
    studentName, parentName, tutorName, location, grade,
    date, results, skillTables
  } = data;

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 105, 10, { align: "center" });
  doc.setFontSize(11);
  doc.text("From the Director, Mrs. Yinka Isikalu", 105, 17, { align: "center" });

  autoTable(doc, {
    startY: 22,
    styles: { fontSize: 9 },
    theme: 'grid',
    body: [[
      `Student: ${studentName}`,
      `Parent: ${parentName}`,
      `Tutor: ${tutorName}`,
      `Location: ${location}`,
      `Grade: ${grade}`,
      `Date: ${date}`
    ]]
  });

  autoTable(doc, {
    startY: doc.autoTable.previous.finalY + 4,
    head: [['Subject', 'Score', 'Percentage', 'Letter Grade']],
    body: results.map(r => [r.subject, r.score, `${r.percent}%`, r.grade]),
    theme: 'grid',
    styles: { fontSize: 10 }
  });

  skillTables.forEach(skill => {
    autoTable(doc, {
      startY: doc.autoTable.previous.finalY + 5,
      head: [[skill.subject, 'Correct', 'Total', '%']],
      body: skill.categories.map(c => [c.name, c.correct, c.total, c.percent]),
      styles: { fontSize: 9 }
    });
  });

  doc.setFontSize(10);
  doc.text(`Personalized Recommendations for ${studentName}`, 14, doc.autoTable.previous.finalY + 8);
  doc.setFontSize(9);
  doc.text(`Dear ${parentName},`, 14, doc.autoTable.previous.finalY + 14);
  doc.text(
    `At Blooming Kids House, our tutors are committed to ensuring your child excels... (continue with full rec block)`,
    14, doc.autoTable.previous.finalY + 20, { maxWidth: 180 }
  );

  doc.setFontSize(10);
  doc.text(`Sincerely,`, 14, 275);
  doc.text(`Mrs. Yinka Isikalu, Director`, 14, 280);

  const fileKey = `${studentName.replace(/\s+/g, '_')}_${parentName.replace(/[@.]/g, '_')}`;
  doc.save(`reports/${fileKey}.pdf`);
}
