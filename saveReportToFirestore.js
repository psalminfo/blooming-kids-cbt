import { db } from './firebaseConfig.js';
import { collection, addDoc } from 'firebase/firestore';

export async function saveReportToFirestore({ student, parentEmail, subject, grade, pdfUrl }) {
  try {
    await addDoc(collection(db, "reports"), {
      student,
      parentEmail,
      subject,
      grade,
      url: pdfUrl,
      timestamp: new Date().toISOString()
    });
    console.log("✅ Report saved to Firestore.");
  } catch (err) {
    console.error("❌ Firestore error:", err);
  }
}
