import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // Fixed version
import { getLoadedQuestions } from './autoQuestionGen.js';

/**
 * Submits the multiple-choice test results to Firebase.
 * @param {string} subject The test subject.
 * @param {string} grade The student's grade.
 * @param {string} studentName The student's name.
 * @param {string} parentEmail The parent's email.
 * @param {string} tutorEmail The tutor's email.
 * @param {string} studentCountry The student's country.
 * @param {string} parentPhone The parent's phone number. // Added param
 */
export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry, parentPhone) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let score = 0;
    let totalScoreableQuestions = 0;

    // Get studentId from student data stored by tutor dashboard
    const studentData = JSON.parse(localStorage.getItem("studentData") || "{}");
    const studentId = studentData.studentUid || localStorage.getItem('studentUid') || '';

    console.log("🚀 Starting test submission...");
    console.log("📋 Loaded questions:", loadedQuestions.length);
    console.log("👤 Student:", studentName);
    console.log("📞 Parent Phone:", parentPhone);

    // Validation to ensure all questions are answered (either MC or text)
    for (let i = 0; i < loadedQuestions.length; i++) {
        const questionBlock = document.querySelector(`.question-block[data-question-id="${loadedQuestions[i].id}"]`);
        if (questionBlock) {
            const selectedOption = questionBlock.querySelector("input[type='radio']:checked");
            const textResponse = questionBlock.querySelector("textarea, input[type='text']");
            const hasTextAnswer = textResponse && textResponse.value.trim() !== '';
            
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
        
        const originalQuestion = loadedQuestions.find(q => q.id == questionId);

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
            
            const correctAnswer = originalQuestion.correctAnswer || originalQuestion.correct_answer;
            
            if (!correctAnswer) {
                console.warn(`❌ No correct answer found for question: ${originalQuestion.question}`);
                totalScoreableQuestions--; 
            } else {
                const normalizedStudent = studentAnswer.toLowerCase().trim();
                const normalizedCorrect = correctAnswer.toString().toLowerCase().trim();
                
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
        } else {
            console.warn(`⚠️ No answer provided for question ${questionId}`);
        }

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

    const timestamp = Timestamp.now();

    // Enhanced result data with multiple fields for parent portal matching
    const resultData = {
        // Core data
        subject,
        grade,
        studentName,
        studentId,
        
        // Parent contact (multiple formats for matching)
        parentEmail,
        parent_email: parentEmail,
        parentPhone: parentPhone || '',
        parent_phone: parentPhone || '',
        
        // Additional phone fields (parent portal searches these!)
        guardianPhone: parentPhone || '',
        motherPhone: parentPhone || '',
        fatherPhone: parentPhone || '',
        phone: parentPhone || '',
        contactPhone: parentPhone || '',
        
        // Tutor info
        tutorEmail,
        tutor_email: tutorEmail,
        
        // Location
        studentCountry,
        country: studentCountry,
        
        // Test results
        answers,
        score: score,
        totalScoreableQuestions: totalScoreableQuestions,
        total_questions: totalScoreableQuestions,
        
        // Multiple timestamp formats for parent portal matching
        submittedAt: timestamp,
        timestamp: timestamp,
        createdAt: timestamp,
        date: timestamp,
        
        // Status
        status: 'completed',
        test_type: 'mcq',
        
        // Metadata
        source: 'student_test'
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
