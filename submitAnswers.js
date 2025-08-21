import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js';

/**
 * Submits the multiple-choice test results to Firebase, ignoring creative writing.
 * @param {string} subject The test subject.
 * @param {string} grade The student's grade.
 * @param {string} studentName The student's name.
 * @param {string} parentEmail The parent's email.
 * @param {string} tutorEmail The tutor's email.
 * @param {string} studentCountry The student's country.
 */
export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let score = 0;
    let totalScoreableQuestions = 0;

    // Filter out the creative writing question from the list of questions to be scored
    const scoreableQuestions = loadedQuestions.filter(q => q.type !== 'creative-writing');

    // **NEW VALIDATION LOGIC**
    // Iterate only over the questions that are scoreable (i.e., multiple-choice) to check for answers
    for (const originalQuestion of scoreableQuestions) {
        const questionBlock = document.querySelector(`.question-block[data-question-id="${originalQuestion.id}"]`);
        if (questionBlock) {
            const selectedOption = questionBlock.querySelector("input[type='radio']:checked");
            if (!selectedOption) {
                alert("Please answer all multiple-choice questions before submitting.");
                throw new Error("All multiple-choice questions must be answered.");
            }
        }
    }

    // Now, iterate through the DOM to score the answers. This part remains similar.
    const questionBlocks = document.querySelectorAll(".question-block");
    
    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = scoreableQuestions.find(q => q.id === parseInt(questionId));

        // Skip the creative writing question block entirely
        if (!originalQuestion) {
            continue;
        }

        totalScoreableQuestions++;
        const selectedOption = block.querySelector("input[type='radio']:checked");

        const studentAnswer = selectedOption.value;
        const correctAnswer = originalQuestion.correctAnswer || originalQuestion.correct_answer || null;
        const topic = originalQuestion.topic || null;
        const imageUrl = originalQuestion.imageUrl || null;
        const imagePosition = originalQuestion.imagePosition || null;

        if (studentAnswer === correctAnswer) {
            score++;
        }

        answers.push({
            questionText: originalQuestion.question || null,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: topic,
            imageUrl: imageUrl,
            imagePosition: imagePosition
        });
    }

    const resultData = {
        subject,
        grade,
        studentName,
        parentEmail,
        tutorEmail,
        studentCountry,
        answers,
        score: score,
        totalScoreableQuestions: totalScoreableQuestions,
        submittedAt: Timestamp.now()
    };

    try {
        await addDoc(collection(db, "student_results"), resultData);
        alert("Test results submitted successfully.");
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        alert("Failed to submit test results. Please try again.");
    }
}
