import { saveReportToFirestore } from './saveReportToFirestore.js';
import { db } from './firebaseConfig.js';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAllLoadedQuestions, getAnswerData } from './autoQuestionGen.js';

/**
 * Handles the test submission with full grading support.
 *
 * GRADING LOGIC:
 *   - Multiple Choice (has options + correctAnswer): auto-graded immediately.
 *     Score is calculated as (correct / total MCQ) * 100.
 *
 *   - Text / Open-ended (no options): flagged as 'needs_grading'.
 *     Saved to 'homework_assignments' so the tutor can review and grade
 *     them from their dashboard inbox.
 *
 *   - Creative Writing: already handled separately by continueToMCQ in
 *     autoQuestionGen.js — not re-processed here.
 *
 * @param {Object} testData
 * @param {string} testData.studentName
 * @param {string} testData.parentEmail
 * @param {string} testData.subject
 * @param {string} testData.grade
 * @param {Array<string>} testData.answers  - legacy flat array (kept for compatibility)
 */
export async function handleTestSubmit({ studentName, parentEmail, subject, grade, answers }) {

  // ── 1. Gather all questions and the student's answers from session ──────────
  const allQuestions = getAllLoadedQuestions();   // full question objects with correctAnswer
  const answerMap    = getAnswerData();            // { questionId: studentAnswer }

  // ── 2. Grade each question ──────────────────────────────────────────────────
  const gradedResults   = [];   // one entry per question
  const openEndedItems  = [];   // questions that need tutor grading
  let mcqCorrect  = 0;
  let mcqTotal    = 0;

  allQuestions.forEach((q, index) => {
    const qId           = q.id || q.firebaseId || `question-${index}`;
    const studentAnswer = answerMap[qId] || answers?.[index] || '';
    const hasOptions    = Array.isArray(q.options) && q.options.length > 0;
    const isCreative    = q.type === 'creative-writing';

    if (isCreative) {
      // Creative writing is handled by continueToMCQ — skip here
      return;
    }

    if (hasOptions) {
      // ── Multiple Choice: auto-grade ────────────────────────────────────────
      mcqTotal++;
      const correct   = q.correctAnswer || q.correct_answer || q.answer || '';
      const isCorrect = studentAnswer.trim().toLowerCase() === correct.trim().toLowerCase();
      if (isCorrect) mcqCorrect++;

      gradedResults.push({
        questionId:    qId,
        questionText:  q.question || '',
        type:          'multiple-choice',
        studentAnswer,
        correctAnswer: correct,
        isCorrect,
        points:        isCorrect ? 1 : 0,
      });

    } else {
      // ── Open-ended / Text answer: needs tutor grading ──────────────────────
      gradedResults.push({
        questionId:   qId,
        questionText: q.question || '',
        type:         'open-ended',
        studentAnswer,
        isCorrect:    null,   // tutor will decide
        points:       null,
      });

      openEndedItems.push({
        questionId:   qId,
        questionText: q.question || '',
        studentAnswer,
      });
    }
  });

  // ── 3. Calculate MCQ score ──────────────────────────────────────────────────
  const mcqScore      = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : null;
  const hasOpenEnded  = openEndedItems.length > 0;
  const overallStatus = hasOpenEnded ? 'needs_grading' : 'graded';

  // ── 4. Build the full report payload ────────────────────────────────────────
  const reportData = {
    studentName,
    parentEmail,
    subject,
    grade,
    answers,                       // legacy flat array — kept so saveReportToFirestore still works
    gradedResults,                 // full per-question breakdown with isCorrect flags
    mcqScore,                      // 0–100 or null if no MCQs
    mcqCorrect,
    mcqTotal,
    hasOpenEndedQuestions: hasOpenEnded,
    openEndedCount:        openEndedItems.length,
    status:                overallStatus,
    submittedAt:           new Date().toISOString(),
  };

  try {
    // ── 5. Save the main report ───────────────────────────────────────────────
    await saveReportToFirestore(reportData);

    // ── 6. Save open-ended questions to homework_assignments for tutor review ──
    // Each open-ended answer is saved as a separate document so the tutor
    // sees it in their homework inbox just like a submitted homework assignment.
    if (hasOpenEnded) {
      const tutorEmail = (() => {
        try { return JSON.parse(localStorage.getItem('studentData') || '{}').tutorEmail || ''; }
        catch (_) { return ''; }
      })();

      for (const item of openEndedItems) {
        try {
          await addDoc(collection(db, 'homework_assignments'), {
            studentName,
            parentEmail,
            tutorEmail,
            subject,
            grade,
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
      console.log(`📝 ${openEndedItems.length} open-ended answer(s) sent to tutor inbox for grading.`);
    }

    // ── 7. Mark placement test complete on the student's Firestore doc ─────────
    const studentUid = (() => {
      try {
        const d = JSON.parse(localStorage.getItem('studentData') || '{}');
        return d.studentUid || localStorage.getItem('studentUid') || null;
      } catch (_) { return localStorage.getItem('studentUid') || null; }
    })();

    if (studentUid) {
      try {
        await updateDoc(doc(db, 'students', studentUid), {
          placementTestStatus:      'completed',
          placementTestScore:       mcqScore,
          placementTestSubject:     subject,
          placementTestCompletedAt: serverTimestamp(),
          hasOpenEndedPending:      hasOpenEnded,
        });
      } catch (err) {
        console.warn('Could not update placementTestStatus:', err.message);
      }

      // ── 8. Notify tutor dashboard tab to remove the button immediately ───────
      try {
        const bc = new BroadcastChannel('bkh_placement_complete');
        bc.postMessage({ type: 'PLACEMENT_COMPLETED', studentUid });
        bc.close();
      } catch (_) {}

    } else {
      console.warn('handleTestSubmit: studentUid not in localStorage — button may not auto-hide.');
    }

    // ── 9. Show result summary and redirect ──────────────────────────────────
    if (mcqScore !== null) {
      alert(
        `✅ Test submitted!\n\n` +
        `MCQ Score: ${mcqScore}% (${mcqCorrect}/${mcqTotal} correct)` +
        (hasOpenEnded
          ? `\n📝 ${openEndedItems.length} written answer(s) sent to your tutor for review.`
          : '')
      );
    } else {
      alert(
        `✅ Test submitted!\n\n` +
        (hasOpenEnded
          ? `📝 Your written answers have been sent to your tutor for review.`
          : '')
      );
    }

    window.location.href = 'subject-select.html';

  } catch (error) {
    console.error('❌ Error in submission:', error);
    alert('Something went wrong while submitting your test. Please try again.');
  }
}
