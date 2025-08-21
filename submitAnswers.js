import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js';

/**
 * Submits all test results to Firebase, including multiple-choice and creative writing.
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
    
    // Find the creative writing question block
    const creativeWritingQuestion = loadedQuestions.find(q => q.type === 'creative-writing');
    
    // Run validation for multiple-choice questions only
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

    // Process multiple-choice questions
    const questionBlocks = document.querySelectorAll(".question-block");
    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = scoreableQuestions.find(q => q.id === parseInt(questionId));

        // Skip the creative writing question block
        if (!originalQuestion) {
            continue;
        }

        totalScoreableQuestions++;
        const selectedOption = block.querySelector("input[type='radio']:checked");
        const studentAnswer = selectedOption.value;
        const correctAnswer = originalQuestion.correctAnswer || originalQuestion.correct_answer || null;
        
        if (studentAnswer === correctAnswer) {
            score++;
        }

        answers.push({
            questionText: originalQuestion.question || null,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: originalQuestion.topic || null,
            imageUrl: originalQuestion.imageUrl || null,
            imagePosition: originalQuestion.imagePosition || null
        });
    }

    // Process and submit the creative writing question separately
    if (creativeWritingQuestion) {
        const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dy2hxcyaf/upload';
        const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
        const questionId = creativeWritingQuestion.id;
        const questionTextarea = document.getElementById(`creative-writing-text-${questionId}`);
        const fileInput = document.getElementById(`creative-writing-file-${questionId}`);
        
        const textAnswer = questionTextarea ? questionTextarea.value.trim() : '';
        const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

        if (textAnswer || file) {
            try {
                let fileUrl = null;
                if (file) {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                    
                    const response = await fetch(CLOUDINARY_URL, {
                        method: 'POST',
                        body: formData
                    });
                    const result = await response.json();
                    if (result.secure_url) {
                        fileUrl = result.secure_url;
                    } else {
                        throw new Error("Cloudinary upload failed.");
                    }
                }
                
                const submittedData = {
                    questionId: questionId,
                    textAnswer: textAnswer,
                    fileUrl: fileUrl,
                    submittedAt: new Date(),
                    studentName: studentName,
                    parentEmail: parentEmail,
                    tutorEmail: tutorEmail,
                    grade: grade,
                    status: "pending_review"
                };

                const docRef = doc(db, "tutor_submissions", `${parentEmail}-${questionId}`);
                await setDoc(docRef, submittedData);
            } catch (error) {
                console.error("Error submitting creative writing:", error);
            }
        }
    }

    // Finally, submit the multiple-choice results
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
