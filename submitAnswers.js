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

document.getElementById("submitBtn")?.addEventListener("click", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const studentName = urlParams.get("studentName");
    const parentEmail = urlParams.get("parentEmail");
    const grade = urlParams.get("grade");
    const tutorName = urlParams.get("tutorName");
    const location = urlParams.get("location");
    const subject = urlParams.get("subject");

    if (!studentName || !parentEmail || !grade || !tutorName || !location || !subject) {
        alert("Missing student information from the URL. Please start over.");
        window.location.href = "index.html";
        return;
    }

    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    const questionBlocks = document.querySelectorAll(".question-block");

    for (let i = 0; i < questionBlocks.length; i++) {
        const block = questionBlocks[i];
        const questionText = block.querySelector(".question-text").innerText;
        const selectedOption = block.querySelector("input[type='radio']:checked");
        
        const studentAnswer = selectedOption ? selectedOption.value : "No answer";

        const originalQuestion = loadedQuestions.find(q => q.question === questionText);
        
        const correctAnswer = originalQuestion ? originalQuestion.correct_answer : 'N/A';

        answers.push({
            questionText: questionText,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer
        });
    }

    try {
        await addDoc(collection(db, "student_results"), {
            studentName,
            parentEmail,
            grade,
            subject,
            tutorName,
            location,
            answers,
            submittedAt: Timestamp.now()
        });

        alert("Test submitted successfully!");
        window.location.href = "subject-select.html";
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        alert("Failed to submit your test. Please check your connection and try again.");
    }
});
