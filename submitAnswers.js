[file name]: submitAnswers.js
[file content begin]
import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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

/**
 * Submits the test results to Firebase in the simplified format
 */
export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    // Validate session and required data first
    if (!validateSessionData()) {
        throw new Error("Session expired or missing data. Please log in again.");
    }

    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let creativeWritingContent = null;
    let creativeWritingFileUrl = null;
    let score = 0;
    let totalScoreableQuestions = 0;

    // Get parentPhone from student data
    const studentData = getStudentData();
    const parentPhone = studentData.parentPhone || '';

    console.log("🚀 Starting test submission...");
    console.log("📋 Loaded questions:", loadedQuestions.length);
    console.log("👤 Student:", studentName);

    // Check for creative writing question
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

    // Validation to ensure all questions are answered (either MC, text, or griddable)
    for (let i = 0; i < loadedQuestions.length; i++) {
        const questionBlock = document.querySelector(`.question-block[data-question-id="${loadedQuestions[i].id}"]`);
        if (questionBlock) {
            const selectedOption = questionBlock.querySelector("input[type='radio']:checked");
            const textResponse = questionBlock.querySelector("textarea, input[type='text']");
            const hasTextAnswer = textResponse && textResponse.value.trim() !== '';
            
            // Check for griddable question selection
            const isGriddableSelected = selectedOption && selectedOption.value === "Gridable question";
            
            // Skip creative writing questions (already handled above)
            if (loadedQuestions[i].type === 'creative-writing') continue;
            
            // Check if either MC option OR text response OR griddable option is selected
            if (!selectedOption && !hasTextAnswer) {
                alert("Please answer all questions before submitting. You can provide multiple-choice answers, text responses, or select 'Gridable question'.");
                questionBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                questionBlock.style.border = "2px solid red";
                throw new Error("All questions must be answered (either multiple-choice, text, or griddable).");
            }
        }
    }

    // Process all questions (MC, text, griddable, and creative writing)
    const questionBlocks = document.querySelectorAll(".question-block");
    console.log("🔍 Found question blocks:", questionBlocks.length);

    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        
        // Use loose equality for question matching
        const originalQuestion = loadedQuestions.find(q => q.id == questionId);

        console.log(`📝 Processing question ${questionId}:`, {
            foundOriginal: !!originalQuestion,
            questionText: originalQuestion?.question?.substring(0, 50) + '...',
            type: originalQuestion?.type
        });

        if (!originalQuestion) {
            console.warn(`❌ No original question found for ID: ${questionId}`);
            continue;
        }

        // Handle creative writing questions
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

        const selectedOption = block.querySelector("input[type='radio']:checked");
        const textResponse = block.querySelector("textarea, input[type='text']");
        const hasTextAnswer = textResponse && textResponse.value.trim() !== '';
        
        // Check for griddable inputs
        const gridInputs = block.querySelectorAll('.grid-input, .bubble-input, .math-grid-input, input[type="number"]');
        const gridAnswers = Array.from(gridInputs).map(input => input.value.trim()).filter(val => val !== '');
        const hasGridAnswer = gridAnswers.length > 0;
        const isGriddableSelected = selectedOption && selectedOption.value === "Gridable question";

        let studentAnswer = '';
        let isCorrect = false;

        if (isGriddableSelected) {
            // Handle griddable question - format the answer
            studentAnswer = hasGridAnswer 
                ? `Griddable: ${gridAnswers.join(', ')}`
                : 'Griddable question selected (no grid input)';
            totalScoreableQuestions++;
            
            // Griddable questions need manual grading, so don't auto-score
            isCorrect = false;
            console.log(`🔢 Griddable answer: ${studentAnswer}`);
            
        } else if (selectedOption && !isGriddableSelected) {
            // Handle regular multiple-choice question
            studentAnswer = selectedOption.value.trim();
            totalScoreableQuestions++;
            
            // Get the correct answer from the question data
            const correctAnswer = originalQuestion.correctAnswer || originalQuestion.correct_answer;
            
            if (correctAnswer) {
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
            } else {
                console.warn(`❌ No correct answer found for question: ${originalQuestion.question}`);
                totalScoreableQuestions--; 
            }
        } else if (hasTextAnswer) {
            // Handle text response
            studentAnswer = textResponse.value.trim();
            console.log(`📄 Text answer: ${studentAnswer.substring(0, 30)}...`);
            // Text responses are not scored
        } else {
            console.warn(`⚠️ No answer provided for question ${questionId}`);
            continue;
        }

        // Get question metadata
        const correctAnswer = originalQuestion.correctAnswer || originalQuestion.correct_answer || null;
        const topic = originalQuestion.topic || null;
        const imageUrl = originalQuestion.imageUrl || null;
        const imagePosition = originalQuestion.imagePosition || null;
        const questionText = originalQuestion.question || 'No question text';

        // Use the SIMPLIFIED format like the new file
        answers.push({
            questionText: questionText,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: topic,
            imageUrl: imageUrl,
            imagePosition: imagePosition
            // Note: No answerType, isCorrect, griddableAnswers, needsManualGrading fields
        });
    }

    console.log("📊 FINAL SCORING SUMMARY:");
    console.log(`✅ Score: ${score}/${totalScoreableQuestions}`);
    console.log(`📝 Total answers: ${answers.length}`);
    console.log(`🔢 Griddable questions: ${answers.filter(a => a.studentAnswer.includes('Griddable')).length}`);
    console.log(`🏷️ Topics found:`, [...new Set(answers.map(a => a.topic))]);

    const resultData = {
        subject,
        grade,
        studentName,
        parentEmail,
        tutorEmail,
        studentCountry,
        parentPhone, // Still include parentPhone
        answers, // Now in simplified format
        score: score,
        totalScoreableQuestions: totalScoreableQuestions,
        submittedAt: Timestamp.now()
        // Note: No hasGriddableQuestions, needsManualGrading flags
    };

    console.log("🔥 Saving to Firebase (simplified format):", resultData);

    try {
        await addDoc(collection(db, "student_results"), resultData);
        console.log("✅ Test results submitted successfully!");
        
        // Auto-register student after test submission (keep this feature)
        await autoRegisterStudentAfterTest(subject, grade, studentName, parentEmail, tutorEmail, studentCountry);
        
        // Show appropriate alert
        const griddableCount = answers.filter(a => a.studentAnswer.includes('Griddable')).length;
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
// # SECTION: HELPER FUNCTIONS FOR SESSION MANAGEMENT
// ##################################################################

/**
 * Validates that required session data exists
 */
function validateSessionData() {
    const studentData = getStudentData();
    
    // Check if we have basic required data
    if (!studentData || Object.keys(studentData).length === 0) {
        console.error("❌ No student data found in localStorage");
        return false;
    }
    
    // Check if critical fields exist
    if (!studentData.studentName || !studentData.parentEmail) {
        console.error("❌ Missing critical student data:", {
            studentName: studentData.studentName,
            parentEmail: studentData.parentEmail
        });
        return false;
    }
    
    console.log("✅ Session data validated successfully");
    return true;
}

/**
 * Safely gets student data from localStorage
 */
function getStudentData() {
    try {
        const studentDataStr = localStorage.getItem("studentData");
        if (!studentDataStr) {
            console.warn("⚠️ No studentData found in localStorage");
            return {};
        }
        
        const studentData = JSON.parse(studentDataStr);
        console.log("📁 Student data retrieved:", studentData);
        return studentData;
    } catch (error) {
        console.error("❌ Error parsing studentData from localStorage:", error);
        return {};
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
        const studentData = getStudentData();
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
            subjects: ["Auto-Registered"],
            days: 1,
            studentFee: 0,
            autoRegistered: true,
            registrationDate: Timestamp.now(),
            needsCompletion: true,
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
