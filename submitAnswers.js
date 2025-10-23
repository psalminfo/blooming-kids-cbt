import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
// Ensure this path points to your question loading file, likely 'autoQuestionGen.js'
import { getLoadedQuestions } from './autoQuestionGen.js';

const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

async function uploadCreativeWritingFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        console.error("File upload failed with status:", res.status);
        throw new Error("File upload failed");
    }

    const data = await res.json();
    return data.secure_url;
}


export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let creativeWritingContent = null;
    let creativeWritingFileUrl = null;
    let score = 0;
    let totalScoreableQuestions = 0;

    const creativeWritingQuestion = loadedQuestions.find(q => q.type === 'creative-writing');
    const creativeWritingBlock = creativeWritingQuestion ? document.querySelector(`.question-block[data-question-id="${creativeWritingQuestion.id}"]`) : null;

    if (creativeWritingBlock) {
        creativeWritingContent = creativeWritingBlock.querySelector('textarea').value.trim();
        const creativeWritingFile = creativeWritingBlock.querySelector('input[type="file"]').files[0];

        if (!creativeWritingContent && !creativeWritingFile) {
            alert("Please provide a response or upload a file for the creative writing question.");
            throw new Error("Creative writing submission required.");
        }
        if (creativeWritingFile) {
            creativeWritingFileUrl = await uploadCreativeWritingFile(creativeWritingFile);
        }
    }

    const questionBlocks = document.querySelectorAll(".question-block");
    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));

        // =================================================================
        // ===== THIS IS THE DIAGNOSTIC LINE I HAVE ADDED FOR YOU ==========
        // =================================================================
        console.log("Final Check - Question Data:", originalQuestion);
        // =================================================================

        if (!originalQuestion) continue;

        if (originalQuestion.type === 'creative-writing') {
            answers.push({
                questionText: originalQuestion.question,
                type: 'creative-writing',
                studentResponse: creativeWritingContent || null,
                fileUrl: creativeWritingFileUrl || null,
                tutorGrade: 'Pending',
                tutorReport: null
            });
            continue;
        }

        totalScoreableQuestions++;
        const selectedOption = block.querySelector("input[type='radio']:checked");

        if (!selectedOption) {
            alert("Please answer all multiple-choice questions before submitting.");
            throw new Error("All multiple-choice questions must be answered.");
        }

        const studentAnswer = selectedOption.value;

        // --- THIS IS THE FINAL, ROBUST FIX ---
        // It checks for both 'correctAnswer' (camelCase) and 'correct_answer' (snake_case)
        // to guarantee it finds the property from your JSON file.
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
            correctAnswer: correctAnswer, // This will now be saved correctly
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
