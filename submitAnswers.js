import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
// Ensure this path points to your question loading file, likely 'autoQuestionGen.js'
import { getLoadedQuestions } from './autoQuestionGen.js';

// No longer needed, as autoQuestionGen.js handles this upload directly
// const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
// const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
// const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
// async function uploadCreativeWritingFile(file) { ... }


export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let score = 0;
    let totalScoreableQuestions = 0;

    // FIX: Filter out the creative writing question from the list of questions to be scored.
    const scoreableQuestions = loadedQuestions.filter(q => q.type !== 'creative-writing');
    
    // Check if a parent email search is being used and filter the query
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

        if (!selectedOption) {
            alert("Please answer all multiple-choice questions before submitting.");
            throw new Error("All multiple-choice questions must be answered.");
        }

        const studentAnswer = selectedOption.value;

        // This is the final, robust fix to correctly find the answer
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
        console.log("Test results submitted successfully.");
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        throw new Error("Failed to submit test results.");
    }
}
