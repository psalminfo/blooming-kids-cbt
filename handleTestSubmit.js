import { saveReportToFirestore } from './saveReportToFirestore.js';
import { db } from './firebaseConfig.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * UPDATED: Handles the test submission.
 * After saving the report, marks placementTestStatus = 'completed' on the
 * student's Firestore document so the tutor dashboard button disappears.
 *
 * @param {Object} testData - An object containing all the test data.
 * @param {string} testData.studentName - The student's name.
 * @param {string} testData.parentEmail - The parent's email.
 * @param {string} testData.subject - The subject of the test.
 * @param {string} testData.grade - The student's grade.
 * @param {Array<string>} testData.answers - The list of the student's selected answers.
 */
export async function handleTestSubmit({ studentName, parentEmail, subject, grade, answers }) {
  const reportData = {
    studentName,
    parentEmail,
    subject,
    grade,
    answers,
  };

  try {
    // Step 1 — Save the report as before
    await saveReportToFirestore(reportData);

    // Step 2 — Mark the student's placement test as completed in Firestore.
    // studentUid is stored in localStorage when the tutor launches the test.
    const studentUid = localStorage.getItem('studentUid');
    if (studentUid) {
      try {
        await updateDoc(doc(db, 'students', studentUid), {
          placementTestStatus: 'completed'
        });
      } catch (firestoreErr) {
        // Non-blocking — log but don't fail the whole submission
        console.warn('Could not update placementTestStatus:', firestoreErr.message);
      }
    } else {
      console.warn('handleTestSubmit: studentUid not found in localStorage — button may not auto-hide.');
    }

    // Step 3 — Notify the tutor dashboard tab via BroadcastChannel
    // so the button disappears immediately even before Firestore propagates.
    try {
      const bc = new BroadcastChannel('bkh_placement_complete');
      bc.postMessage({ type: 'PLACEMENT_COMPLETED', studentUid });
      bc.close();
    } catch (_) {
      // BroadcastChannel not supported in some older browsers — safe to ignore
    }

    alert("Test submitted successfully!");

    // Redirect to subject selection after successful submission
    window.location.href = 'subject-select.html';

  } catch (error) {
    console.error("❌ Error in submission:", error);
    alert("Something went wrong while submitting your test. Please try again.");
  }
}
