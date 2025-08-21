import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js';

const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/**
 * Handles the upload of a creative writing file to Cloudinary.
 * @param {File} file The file to be uploaded.
 * @returns {Promise<string>} The URL of the uploaded file.
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


export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let score = 0;
    let totalScoreableQuestions = 0;
    let creativeWritingSubmitted = false;
    let multipleChoiceComplete = true;

    const questionBlocks = document.querySelectorAll(".question-block");
    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));

        if (!originalQuestion) continue;

        const isCreativeWriting = originalQuestion.type === 'creative-writing';

        if (isCreativeWriting) {
            const textAnswer = block.querySelector('textarea').value.trim();
            const file = block.querySelector('input[type="file"]').files[0];
            let fileUrl = null;

            if (textAnswer || file) {
                if (file) {
                    try {
                        fileUrl = await uploadCreativeWritingFile(file);
                    } catch (error) {
                        alert("Failed to upload creative writing file. Please try again.");
                        return; // Stop submission on file upload failure
                    }
                }
                
                answers.push({
                    questionText: originalQuestion.question || null,
                    type: 'creative-writing',
                    studentResponse: textAnswer || null,
                    fileUrl: fileUrl || null,
                    tutorReport: null,
                    status: 'pending_review'
                });
                creativeWritingSubmitted = true;
            }
        } else {
            totalScoreableQuestions++;
            const selectedOption = block.querySelector("input[type='radio']:checked");

            if (!selectedOption) {
                multipleChoiceComplete = false;
            } else {
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
        }
    }

    // Perform final validation check before submitting
    if (!multipleChoiceComplete) {
        alert("Please answer all multiple-choice questions before submitting.");
        return;
    }
    if (loadedQuestions.some(q => q.type === 'creative-writing') && !creativeWritingSubmitted) {
        alert("Please provide a response or upload a file for the creative writing question.");
        return;
    }

    const resultData = {
        subject,
        grade,
        studentName,
        parentEmail,
        tutorEmail,
        studentCountry,
        answers, // This now contains all answers in one array
        score: score,
        totalScoreableQuestions: totalScoreableQuestions,
        submittedAt: Timestamp.now()
    };

    try {
        await addDoc(collection(db, "student_results"), resultData);
        alert("Test results submitted successfully!");
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        alert("Failed to submit test results. Please try again.");
    }
}
