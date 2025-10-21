import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js';

/**
 * Submits the multiple-choice test results to Firebase.
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

    // Get parentPhone from student data
    const studentData = JSON.parse(localStorage.getItem("studentData") || "{}");
    const parentPhone = studentData.parentPhone || '';

    console.log("🚀 Starting test submission...");
    console.log("📋 Loaded questions:", loadedQuestions.length);
    console.log("👤 Student:", studentName);

    // Validation to ensure all questions are answered (either MC or text)
    for (let i = 0; i < loadedQuestions.length; i++) {
        const questionBlock = document.querySelector(`.question-block[data-question-id="${loadedQuestions[i].id}"]`);
        if (questionBlock) {
            const selectedOption = questionBlock.querySelector("input[type='radio']:checked");
            const textResponse = questionBlock.querySelector("textarea, input[type='text']");
            const hasTextAnswer = textResponse && textResponse.value.trim() !== '';
            
            // Check if either MC option OR text response is provided
            if (!selectedOption && !hasTextAnswer) {
                alert("Please answer all questions before submitting. You can provide multiple-choice answers or text responses.");
                questionBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                questionBlock.style.border = "2px solid red";
                throw new Error("All questions must be answered (either multiple-choice or text).");
            }
        }
    }

    // Process all questions (both MC and text)
    const questionBlocks = document.querySelectorAll(".question-block");
    console.log("🔍 Found question blocks:", questionBlocks.length);

    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));

        console.log(`📝 Processing question ${questionId}:`, {
            foundOriginal: !!originalQuestion,
            questionText: originalQuestion?.question?.substring(0, 50) + '...',
            hasOptions: originalQuestion?.options?.length > 0
        });

        if (!originalQuestion) {
            console.warn(`❌ No original question found for ID: ${questionId}`);
            continue;
        }

        const selectedOption = block.querySelector("input[type='radio']:checked");
        const textResponse = block.querySelector("textarea, input[type='text']");
        const hasTextAnswer = textResponse && textResponse.value.trim() !== '';

        let studentAnswer = '';
        let answerType = '';
        let isCorrect = false;

        if (selectedOption) {
            studentAnswer = selectedOption.value.trim();
            answerType = 'multiple_choice';
            totalScoreableQuestions++;
            
            // Get the correct answer from the question data
            const correctAnswer = originalQuestion.correctAnswer || originalQuestion.correct_answer;
            
            if (!correctAnswer) {
                console.warn(`❌ No correct answer found for question: ${originalQuestion.question}`);
                // Don't score if no correct answer exists
                totalScoreableQuestions--; 
            } else {
                // Normalize both answers for case-insensitive comparison
                const normalizedStudent = studentAnswer.toLowerCase().trim();
                const normalizedCorrect = correctAnswer.toString().toLowerCase().trim();
                
                console.log(`🎯 Scoring: Student: "${studentAnswer}", Correct: "${correctAnswer}"`);
                
                if (normalizedStudent === normalizedCorrect) {
                    score++;
                    isCorrect = true;
                    console.log(`✅ CORRECT! Score: ${score}/${totalScoreableQuestions}`);
                } else {
                    console.log(`❌ INCORRECT: "${studentAnswer}" vs "${correctAnswer}"`);
                }
            }
        } else if (hasTextAnswer) {
            studentAnswer = textResponse.value.trim();
            answerType = 'text_response';
            console.log(`📄 Text answer: ${studentAnswer.substring(0, 30)}...`);
            // Text responses are not scored
        } else {
            console.warn(`⚠️ No answer provided for question ${questionId}`);
        }

        // Ensure we have valid topic data
        const topic = originalQuestion.topic || originalQuestion.subject || 'General';
        const questionText = originalQuestion.question || 'No question text';

        answers.push({
            questionText: questionText,
            studentAnswer: studentAnswer,
            correctAnswer: originalQuestion.correctAnswer || originalQuestion.correct_answer || null,
            answerType: answerType,
            isCorrect: isCorrect,
            topic: topic,
            imageUrl: originalQuestion.imageUrl || null,
            imagePosition: originalQuestion.imagePosition || null
        });
    }

    console.log("📊 FINAL SCORING SUMMARY:");
    console.log(`✅ Score: ${score}/${totalScoreableQuestions}`);
    console.log(`📝 Total answers: ${answers.length}`);
    console.log(`🏷️ Topics found:`, [...new Set(answers.map(a => a.topic))]);

    const resultData = {
        subject,
        grade,
        studentName,
        parentEmail,
        tutorEmail,
        studentCountry,
        parentPhone,
        answers,
        score: score,
        totalScoreableQuestions: totalScoreableQuestions,
        submittedAt: Timestamp.now()
    };

    console.log("🔥 Saving to Firebase:", resultData);

    try {
        await addDoc(collection(db, "student_results"), resultData);
        console.log("✅ Test results submitted successfully!");
        alert("Test results submitted successfully.");
    } catch (err) {
        console.error("❌ Error submitting test results to Firebase:", err);
        alert("Failed to submit test results. Please try again.");
    }
}
