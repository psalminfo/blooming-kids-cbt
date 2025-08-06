// This file no longer needs to generate a PDF, so jsPDF and Cloudinary imports can be removed.
// It only needs to save the raw data to Firestore.
import { saveReportToFirestore } from './saveReportToFirestore.js';

/**
 * UPDATED: Handles the test submission.
 * @param {Object} testData - An object containing all the test data.
 * @param {string} testData.studentName - The student's name.
 * @param {string} testData.parentEmail - The parent's email.
 * @param {string} testData.subject - The subject of the test.
 * @param {string} testData.grade - The student's grade.
 * @param {Array<string>} testData.answers - The list of the student's selected answers.
 */
export async function handleTestSubmit({ studentName, parentEmail, subject, grade, answers }) {
  // Create the data object in the simple format the parent portal needs.
  const reportData = {
    studentName,
    parentEmail,
    subject,
    grade,
    answers, // The crucial array of student answers
  };

  try {
    // The 'saveReportToFirestore' function should be updated to handle this new data format.
    await saveReportToFirestore(reportData);

    alert("Test submitted successfully!");
    
    // Redirect to the subject selection page after successful submission.
    window.location.href = 'subject-select.html';

  } catch (error) {
    console.error("❌ Error in submission:", error);
    alert("Something went wrong while submitting your test. Please try again.");
  }
}
