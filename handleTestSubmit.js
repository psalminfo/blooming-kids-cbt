// It only needs to save the raw data to Firestore.
import { saveReportToFirestore } from './saveReportToFirestore.js';
import { getAllLoadedQuestions, getAnswerData } from './autoQuestionGen.js';
import { db } from './firebaseConfig.js';
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

  // ── GRADING ──────────────────────────────────────────────────────────────────
  const allQuestions   = getAllLoadedQuestions();
  const answerMap      = getAnswerData();
  const openEndedItems = [];
  let mcqCorrect = 0;
  let mcqTotal   = 0;

  allQuestions.forEach((q, index) => {
    const qId           = q.id || q.firebaseId || `question-${index}`;
    const studentAnswer = answerMap[qId] || answers?.[index] || '';
    const hasOptions    = Array.isArray(q.options) && q.options.length > 0;

    if (q.type === 'creative-writing') return; // handled separately by continueToMCQ

    if (hasOptions) {
      // Multiple choice — auto-grade
      mcqTotal++;
      const correct = q.correctAnswer || q.correct_answer || q.answer || '';
      if (studentAnswer.trim().toLowerCase() === correct.trim().toLowerCase()) mcqCorrect++;
    } else {
      // Open-ended — collect for tutor grading
      openEndedItems.push({ questionId: qId, questionText: q.question || '', studentAnswer });
    }
  });

  const mcqScore     = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : null;
  const hasOpenEnded = openEndedItems.length > 0;
  // ─────────────────────────────────────────────────────────────────────────────

  // Create the data object in the simple format the parent portal needs.
  const reportData = {
    studentName,
    parentEmail,
    subject,
    grade,
    answers, // The crucial array of student answers
    mcqScore,
    mcqCorrect,
    mcqTotal,
    hasOpenEndedQuestions: hasOpenEnded,
    status: hasOpenEnded ? 'needs_grading' : 'graded',
  };

  try {
    // The 'saveReportToFirestore' function should be updated to handle this new data format.
    await saveReportToFirestore(reportData);

    // Save open-ended answers to tutor's homework inbox for manual grading
    if (hasOpenEnded) {
      const tutorEmail = (() => {
        try { return JSON.parse(localStorage.getItem('studentData') || '{}').tutorEmail || ''; }
        catch (_) { return ''; }
      })();

      for (const item of openEndedItems) {
        try {
          await addDoc(collection(db, 'homework_assignments'), {
            studentName, parentEmail, tutorEmail, subject, grade,
            questionId:    item.questionId,
            questionText:  item.questionText,
            studentAnswer: item.studentAnswer,
            type:          'open-ended-placement',
            status:        'needs_grading',
            submittedAt:   serverTimestamp(),
          });
        } catch (err) {
          console.warn('Could not save open-ended item for grading:', err.message);
        }
      }
    }

    alert("Test submitted successfully!");

    // Redirect to the subject selection page after successful submission.
    window.location.href = 'subject-select.html';

  } catch (error) {
    console.error("❌ Error in submission:", error);
    alert("Something went wrong while submitting your test. Please try again.");
  }
}
