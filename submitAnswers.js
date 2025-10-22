[file name]: submitAnswers.js
[file content begin]
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

    // Validation to ensure all questions are answered (either MC, text, or griddable)
    for (let i = 0; i < loadedQuestions.length; i++) {
        const questionBlock = document.querySelector(`.question-block[data-question-id="${loadedQuestions[i].id}"]`);
        if (questionBlock) {
            const selectedOption = questionBlock.querySelector("input[type='radio']:checked");
            const textResponse = questionBlock.querySelector("textarea, input[type='text']");
            const hasTextAnswer = textResponse && textResponse.value.trim() !== '';
            
            // Check for griddable question selection
            const isGriddableSelected = selectedOption && selectedOption.value === "Gridable question";
            
            // Check if either MC option OR text response OR griddable option is selected
            if (!selectedOption && !hasTextAnswer) {
                alert("Please answer all questions before submitting. You can provide multiple-choice answers, text responses, or select 'Gridable question'.");
                questionBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                questionBlock.style.border = "2px solid red";
                throw new Error("All questions must be answered (either multiple-choice, text, or griddable).");
            }
            
            // No special validation requiring grid input for griddable questions
            // It will pass as long as "Gridable question" radio is selected
        }
    }

    // Process all questions (MC, text, and griddable)
    const questionBlocks = document.querySelectorAll(".question-block");
    console.log("🔍 Found question blocks:", questionBlocks.length);

    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        
        // Use loose equality for question matching
        const originalQuestion = loadedQuestions.find(q => q.id == questionId);

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
        
        // Check for griddable inputs
        const gridInputs = block.querySelectorAll('.grid-input, .bubble-input, .math-grid-input, input[type="number"]');
        const gridAnswers = Array.from(gridInputs).map(input => ({
            id: input.id || input.name,
            value: input.value.trim(),
            type: input.type || input.className
        })).filter(item => item.value !== '');
        
        const hasGridAnswer = gridAnswers.length > 0;
        const isGriddableSelected = selectedOption && selectedOption.value === "Gridable question";

        let studentAnswer = '';
        let answerType = '';
        let isCorrect = false;
        let griddableAnswers = null;

        if (isGriddableSelected) {
            // Handle griddable question - even if no grid inputs are filled
            answerType = 'griddable';
            griddableAnswers = gridAnswers; // This could be empty array
            studentAnswer = hasGridAnswer 
                ? `Griddable: ${gridAnswers.map(g => g.value).join(', ')}`
                : 'Griddable question selected (no grid input)';
            totalScoreableQuestions++;
            
            // Griddable questions need manual grading
            isCorrect = false; // Will be graded manually by tutor
            console.log(`🔢 Griddable option selected: ${studentAnswer}`);
            
        } else if (selectedOption && !isGriddableSelected) {
            // Handle regular multiple-choice question
            studentAnswer = selectedOption.value.trim();
            answerType = 'multiple_choice';
            totalScoreableQuestions++;
            
            // Get the correct answer from the question data
            const correctAnswer = originalQuestion.correctAnswer || originalQuestion.correct_answer;
            
            if (!correctAnswer) {
                console.warn(`❌ No correct answer found for question: ${originalQuestion.question}`);
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
            // Handle text response
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
            imagePosition: originalQuestion.imagePosition || null,
            griddableAnswers: griddableAnswers, // Store structured grid data
            needsManualGrading: answerType === 'griddable' // Flag for manual review
        });
    }

    console.log("📊 FINAL SCORING SUMMARY:");
    console.log(`✅ Score: ${score}/${totalScoreableQuestions}`);
    console.log(`📝 Total answers: ${answers.length}`);
    console.log(`🔢 Griddable questions: ${answers.filter(a => a.answerType === 'griddable').length}`);
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
        hasGriddableQuestions: answers.some(a => a.answerType === 'griddable'),
        needsManualGrading: answers.some(a => a.needsManualGrading),
        submittedAt: Timestamp.now()
    };

    console.log("🔥 Saving to Firebase:", resultData);

    try {
        await addDoc(collection(db, "student_results"), resultData);
        console.log("✅ Test results submitted successfully!");
        
        // Auto-register student after test submission
        await autoRegisterStudentAfterTest(subject, grade, studentName, parentEmail, tutorEmail, studentCountry);
        
        // Show appropriate alert based on griddable questions
        const griddableCount = answers.filter(a => a.answerType === 'griddable').length;
        if (griddableCount > 0) {
            alert(`Test results submitted successfully! ${griddableCount} griddable question(s) will be manually graded.`);
        } else {
            alert("Test results submitted successfully!");
        }
    } catch (err) {
        console.error("❌ Error submitting test results to Firebase:", err);
        alert("Failed to submit test results. Please try again.");
    }
}

// ##################################################################
// # SECTION: AUTO STUDENT REGISTRATION
// ##################################################################

/**
 * Automatically registers student after test completion
 */
async function autoRegisterStudentAfterTest(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    try {
        console.log("🚀 Starting auto-registration for student:", studentName);
        
        // Import additional Firebase functions needed
        const { doc, getDoc, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");
        
        // Get parentPhone from student data
        const studentData = JSON.parse(localStorage.getItem("studentData") || "{}");
        const parentPhone = studentData.parentPhone || '';
        
        // Check if student already exists to avoid duplicates
        const studentsQuery = query(
            collection(db, "students"), 
            where("studentName", "==", studentName),
            where("parentPhone", "==", parentPhone),
            where("tutorEmail", "==", tutorEmail)
        );
        
        const pendingQuery = query(
            collection(db, "pending_students"), 
            where("studentName", "==", studentName),
            where("parentPhone", "==", parentPhone),
            where("tutorEmail", "==", tutorEmail)
        );

        const [studentsSnapshot, pendingSnapshot] = await Promise.all([
            getDocs(studentsQuery),
            getDocs(pendingQuery)
        ]);

        // If student already exists, skip registration
        if (!studentsSnapshot.empty || !pendingSnapshot.empty) {
            console.log("📝 Student already exists, skipping auto-registration");
            return;
        }
        
        // Get settings to determine approval bypass
        const settingsDoc = await getDoc(doc(db, "settings", "global_settings"));
        const isBypassApprovalEnabled = settingsDoc.exists() ? settingsDoc.data().bypassPendingApproval : false;
        
        const studentRecord = {
            studentName: studentName,
            parentEmail: parentEmail,
            parentPhone: parentPhone,
            grade: grade,
            country: studentCountry,
            tutorEmail: tutorEmail,
            subjects: ["Auto-Registered"], // Placeholder
            days: 1, // Default
            studentFee: 0, // To be set by tutor
            autoRegistered: true,
            registrationDate: Timestamp.now(),
            needsCompletion: true, // Flag for tutors
            testCompleted: true,
            testSubject: subject
        };

        const targetCollection = isBypassApprovalEnabled ? "students" : "pending_students";
        
        await addDoc(collection(db, targetCollection), studentRecord);
        console.log(`✅ Auto-registered student: ${studentName} in ${targetCollection}`);
        
    } catch (error) {
        console.error("❌ Error auto-registering student:", error);
        // Fail silently - don't affect test submission
    }
}
[file content end]
