import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
// Ensure this path points to your question loading file, likely 'autoQuestionGen.js'
import { getLoadedQuestions } from './autoQuestionGen.js';

// No longer needed, as autoQuestionGen.js handles this upload directly
// const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
// const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
// const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
// async function uploadCreativeWritingFile(file) { ... }


export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    // FIX: Get creative writing document ID and check its existence directly
    let creativeWritingSubmitted = false;
    const creativeWritingQuestionId = "0"; // Assuming CW is always at index 0
    const creativeWritingDocId = `${parentEmail}-${creativeWritingQuestionId}`;
    try {
        const docRef = doc(db, "tutor_submissions", creativeWritingDocId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            creativeWritingSubmitted = true;
        }
    } catch (error) {
        console.error("Error checking for creative writing submission:", error);
    }

    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let score = 0;
    let totalScoreableQuestions = 0;

    const questionBlocks = document.querySelectorAll(".question-block");
    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));

        if (!originalQuestion) continue;

        const isCreativeWriting = originalQuestion.type === 'creative-writing';
        if (isCreativeWriting) {
            // If creative writing has been submitted, skip it. Otherwise, alert.
            if (!creativeWritingSubmitted) {
                alert("Please submit your creative writing first.");
                throw new Error("Creative writing submission required.");
            }
            continue;
        }

        totalScoreableQuestions++;
        const selectedOption = block.querySelector("input[type='radio']:checked");

        if (!selectedOption) {
            alert("Please answer all multiple-choice questions before submitting.");
            throw new Error("All multiple-choice questions must be answered.");
        }

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
        console.log("Test results submitted successfully.");
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        throw new Error("Failed to submit test results.");
    }
}
