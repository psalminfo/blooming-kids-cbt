import { db } from './firebaseConfig.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * UPDATED: Saves the raw test result data to the 'student_results' collection.
 * This is the data the parent portal will use to generate reports.
 * @param {Object} reportData - An object containing the student's test data.
 */
export async function saveReportToFirestore(reportData) {
  try {
    // Save to the correct 'student_results' collection.
    await addDoc(collection(db, "student_results"), {
      studentName: reportData.studentName,
      parentEmail: reportData.parentEmail,
      subject: reportData.subject,
      grade: reportData.grade,
      answers: reportData.answers, // CRITICAL: Includes the array of student answers.
      // You can add other details like tutorName if they are in reportData
      submittedAt: serverTimestamp() // Uses Firebase's own timestamp for accuracy.
    });

    console.log("✅ Student results saved to Firestore.");

  } catch (err) {
    console.error("❌ Error saving to Firestore:", err);
    // Re-throw the error so handleTestSubmit knows something went wrong.
    throw new Error("Failed to save report to Firestore.");
  }
}
