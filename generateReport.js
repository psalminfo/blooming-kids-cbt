import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js'; 

const firebaseConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.firebasestorage.app",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorName, location) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    const questionBlocks = document.querySelectorAll(".question-block");

    for (let i = 0; i < questionBlocks.length; i++) {
        const block = questionBlocks[i];
        
        const questionId = block.getAttribute('data-question-id');

        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));
        
        const selectedOption = block.querySelector("input[type='radio']:checked");
        const studentAnswer = selectedOption ? selectedOption.value : "No answer";

        const correctAnswer = originalQuestion ? originalQuestion.correct_answer : 'N/A';
        const topic = originalQuestion ? originalQuestion.topic : 'N/A';
        const questionText = originalQuestion ? originalQuestion.question : 'N/A';

        answers.push({
            questionText: questionText,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: topic
        });
    }

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
