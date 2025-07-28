import jsPDF from 'jspdf';
import { db, storage } from './firebaseConfig.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';

export async function generatePDFReport(data) {
  const {
    studentName, parentName, tutorName, location,
    grade, results, timestamp
  } = data;

  const doc = new jsPDF();
  const dateStr = new Date(timestamp).toLocaleString();

  // Header
  doc.setFontSize(16);
  doc.text('BLOOMING KIDS HOUSE ASSESSMENT REPORT', 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.text('From the Director, Mrs. Yinka Isikalu', 200, 23, { align: 'right' });

  // Info Block
  doc.setFontSize(9);
  const info = [
    `Student: ${studentName}`,
    `Parent: ${parentName}`,
    `Tutor: ${tutorName}`,
    `Location: ${location}`,
    `Grade: ${grade}`,
    `Date: ${dateStr}`
  ];
  info.forEach((txt, i) => doc.text(txt, 15, 35 + i * 5));

  // Performance Summary
  doc.setFontSize(11);
  doc.text('Performance Summary', 15, 70);
  doc.setFontSize(9);
  doc.autoTable({
    startY: 73,
    head: [['Subject', 'Score', 'Percentage', 'Letter Grade']],
    body: Object.entries(results).map(([subject, { score, total, percent, grade }]) => [
      subject, `${score}/${total}`, `${percent}%`, grade
    ]),
    theme: 'grid'
  });

  // Knowledge and Skills
  let y = doc.lastAutoTable.finalY + 8;
  Object.entries(results).forEach(([subject, { breakdown }]) => {
    doc.setFontSize(11);
    doc.text(`${subject} Knowledge & Skills`, 15, y);
    doc.autoTable({
      startY: y + 3,
      head: [['Category', 'Correct', 'Total', '%']],
      body: breakdown.map(b => [b.category, b.correct, b.total, b.percent]),
      theme: 'striped'
    });
    y = doc.lastAutoTable.finalY + 5;
  });

  // Recommendations
  doc.setFontSize(11);
  doc.text(`Personalized Recommendations for ${studentName}`, 15, y + 5);
  const msg = `Dear ${parentName},

At Blooming Kids House, our tutors are committed to ensuring your child excels academically and develops well-rounded skills. Based on the assessment results, our tutors will focus on the following areas to support your child’s growth:

[Math and ELA strategies follow as standard block]

Our dedicated tutors at Blooming Kids House will work closely with your child to ensure they thrive academically, build confidence, and develop the essential skills needed for lifelong success.

Sincerely,
Mrs. Yinka Isikalu, Director`;

  doc.setFontSize(9);
  doc.text(msg, 15, y + 10, { maxWidth: 180, lineHeightFactor: 1.4 });

  // Upload PDF to Cloudinary
  const blob = doc.output('blob');
  const filename = `Reports/${studentName}-${Date.now()}.pdf`;
  const storageRef = ref(storage, filename);
  const snap = await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(snap.ref);

  await addDoc(collection(db, 'reports'), {
    studentName, parentName, tutorName, location,
    grade, date: new Date(timestamp),
    reportUrl: url
  });

  return url;
}
