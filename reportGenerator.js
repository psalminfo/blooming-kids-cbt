import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, storage } from './firebaseConfig.js';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

export async function generateAssessmentReport(data) {
  const {
    studentName,
    parentName,
    tutorName,
    location,
    grade,
    date,
    performance,
    skills,
    recommendations
  } = data;

  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BLOOMING KIDS HOUSE ASSESSMENT REPORT', 105, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.text('From the Director, Mrs. Yinka Isikalu', 200, 22, { align: 'right' });

  // Info table
  autoTable(doc, {
    startY: 25,
    theme: 'grid',
    styles: { fontSize: 9 },
    tableWidth: 'wrap',
    head: [['Student', 'Parent', 'Tutor', 'Location', 'Grade', 'Date']],
    body: [[studentName, parentName, tutorName, location, grade, date]]
  });

  // Performance Summary
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5,
    head: [['Subject', 'Score', 'Percentage', 'Letter Grade']],
    body: performance,
    styles: { fontSize: 9 },
    theme: 'grid'
  });

  // Knowledge + Skills (Math & ELA or other)
  for (let subject in skills) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [['Category', 'Correct', 'Total', '%']],
      body: skills[subject],
      styles: { fontSize: 9 },
      theme: 'grid',
      headStyles: { fillColor: [34, 139, 34] },
      didDrawPage: () => {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`${subject} Knowledge & Skills`, 14, doc.lastAutoTable.finalY + 2);
      }
    });
  }

  // Personalized Recommendations
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  let y = doc.lastAutoTable.finalY + 10;
  doc.text(`Personalized Recommendations for ${studentName}`, 14, y);
  y += 6;
  doc.text(`Dear ${parentName},`, 14, y);
  y += 6;

  const recLines = doc.splitTextToSize(
    `At Blooming Kids House, our tutors are committed to ensuring your child excels academically and develops well-rounded skills. Based on the assessment results, our tutors will focus on the following areas to support your child’s growth:\n\n${recommendations}`,
    180
  );
  doc.text(recLines, 14, y);
  y += recLines.length * 5;

  // Director's closing
  y += 10;
  doc.text(
    `Our dedicated tutors at Blooming Kids House will work closely with your child to ensure they thrive academically, build confidence, and develop the essential skills needed for lifelong success.\n\nSincerely,\nMrs. Yinka Isikalu, Director`,
    14,
    y
  );

  // Convert to data URI and upload to Cloudinary
  const pdfData = doc.output('datauristring');
  const base64 = pdfData.split(',')[1];
  const cloudRef = ref(storage, `bkh_assessments/reports/${studentName}_${Date.now()}.pdf`);
  await uploadString(cloudRef, base64, 'base64', { contentType: 'application/pdf' });
  const fileUrl = await getDownloadURL(cloudRef);

  await addDoc(collection(db, 'reports'), {
    studentName,
    parentName,
    grade,
    date: Timestamp.now(),
    reportUrl: fileUrl
  });

  return fileUrl;
}
