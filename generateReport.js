import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js'; 

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.firebasestorage.app",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// This function is called from student.html
export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorName, location) {
    // Get the questions that were displayed on the page
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    const questionBlocks = document.querySelectorAll(".question-block");

    // Loop through each question on the page
    for (let i = 0; i < questionBlocks.length; i++) {
        const block = questionBlocks[i];
        
        // Get the question's unique ID from the HTML element
        const questionId = block.getAttribute('data-question-id');

        // Find the matching question in the loaded data using the ID
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));
        
        // Get the student's selected answer
        const selectedOption = block.querySelector("input[type='radio']:checked");
        const studentAnswer = selectedOption ? selectedOption.value : "No answer";

        // Extract the correct answer and topic from the matching question object
        const correctAnswer = originalQuestion ? originalQuestion.correct_answer : 'N/A';
        const topic = originalQuestion ? originalQuestion.topic : 'N/A';
        const questionText = originalQuestion ? originalQuestion.question : 'N/A';

        // Build the detailed object for this answer
        answers.push({
            questionText: questionText,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: topic
        });
    }

    // Prepare the full data payload for Firebase
    const resultData = {
        subject,
        grade,
        studentName,
        parentEmail,
        tutorName,
        location,
        answers,
        submittedAt: Timestamp.now()
    };

    try {
        await addDoc(collection(db, "student_results"), resultData);
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        throw new Error("Failed to submit test results.");
    }
}
