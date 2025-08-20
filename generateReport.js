import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js';

// Note: Cloudinary is a third-party service. For a fully integrated Firebase solution,
// consider using Firebase Storage for file uploads in the future.
const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Uploads a file to a third-party service (Cloudinary).
 * @param {File} file The file to upload.
 * @returns {Promise<string>} The secure URL of the uploaded file.
 */
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

/**
 * Gathers test answers, calculates the score, and submits the results to Firestore.
 * @param {string} subject The subject of the test.
 * @param {string} grade The student's grade level.
 * @param {string} studentName The name of the student.
 * @param {string} parentEmail The parent's email address.
 * @param {string} tutorEmail The tutor's email address.
 * @param {string} studentCountry The student's country.
 */
export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let creativeWritingContent = null;
    let creativeWritingFileUrl = null;

    // --- NEW: Initialize variables for scoring ---
    let score = 0;
    let totalScoreableQuestions = 0;

    // --- Creative Writing Section Handling ---
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

    // --- Process All Question Blocks ---
    const questionBlocks = document.querySelectorAll(".question-block");
    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));

        if (!originalQuestion) continue; // Skip if question data not found

        // Handle creative writing question (unscored)
        if (originalQuestion.type === 'creative-writing') {
            answers.push({
                questionText: originalQuestion.question,
                type: 'creative-writing',
                studentResponse: creativeWritingContent || null,
                fileUrl: creativeWritingFileUrl || null,
                tutorGrade: 'Pending',
                tutorReport: null
            });
            continue; // Move to the next question block
        }

        // --- Handle Scoreable Multiple-Choice Questions ---
        totalScoreableQuestions++;
        const selectedOption = block.querySelector("input[type='radio']:checked");

        if (!selectedOption) {
            alert("Please answer all multiple-choice questions before submitting.");
            throw new Error("All multiple-choice questions must be answered.");
        }

        const studentAnswer = selectedOption.value;
        const correctAnswer = originalQuestion.correctAnswer || null;

        // --- NEW: Compare answers and increment score if correct ---
        if (studentAnswer === correctAnswer) {
            score++;
        }

        answers.push({
            questionText: originalQuestion.question || null,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: originalQuestion.topic || null,
            imageUrl: originalQuestion.image_url || null,
            imagePosition: originalQuestion.image_position || null
        });
    }

    // --- Final Data Object for Firestore ---
    const resultData = {
        subject,
        grade,
        studentName,
        parentEmail,
        tutorEmail,
        studentCountry,
        answers,
        // --- NEW: Add the calculated score to the data object ---
        score: score,
        totalScoreableQuestions: totalScoreableQuestions,
        submittedAt: Timestamp.now()
    };

    try {
        const docRef = await addDoc(collection(db, "student_results"), resultData);
        console.log("Test results submitted successfully with Document ID: ", docRef.id);
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        throw new Error("Failed to submit test results.");
    }
}

