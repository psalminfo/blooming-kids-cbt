import { db } from "./firebaseConfig.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
// --- THIS IS THE FIX: We now import the functions from our dedicated file ---
import { loadQuestions, getLoadedQuestions } from "./autoQuestionGen.js";

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const subject = urlParams.get("subject")?.toLowerCase();

    const studentName = localStorage.getItem("studentName");
    const parentEmail = localStorage.getItem("studentEmail");
    const grade = localStorage.getItem("grade");
    const tutorEmail = localStorage.getItem("tutorEmail");
    const studentCountry = localStorage.getItem("studentCountry");

    if (!studentName || !parentEmail || !grade || !subject) {
        alert("Missing student info. Please log in again.");
        window.location.href = "index.html";
        return;
    }

    // --- The complex loading logic is gone. We just call the function. ---
    loadQuestions(subject, grade);
    
    startTimer(30);

    function startTimer(mins) {
        let time = mins * 60;
        const timerEl = document.getElementById("timer");
        if (!timerEl) return;
        const interval = setInterval(() => {
            const m = String(Math.floor(time / 60)).padStart(2, "0");
            const s = String(time % 60).padStart(2, "0");
            timerEl.textContent = `Time Left: ${m}:${s}`;
            if (--time < 0) {
                clearInterval(interval);
                alert("Time is up! Submitting your answers.");
                submitTest();
            }
        }, 1000);
    }

    async function submitTest() {
        // We now get the questions from our dedicated module
        const questions = getLoadedQuestions();
        const allQuestionBlocks = document.querySelectorAll('.question-block');
        allQuestionBlocks.forEach(block => block.style.border = "1px solid #e2e8f0");

        for (let i = 0; i < questions.length; i++) {
            const selectedInput = document.querySelector(`input[name="q${i}"]:checked`);
            if (!selectedInput) {
                const unansweredBlock = allQuestionBlocks[i];
                unansweredBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                unansweredBlock.style.border = "2px solid red";
                return;
            }
        }

        const resultsPayload = questions.map((q, i) => {
            const selectedInput = document.querySelector(`input[name="q${i}"]:checked`);
            return {
                questionText: q.question,
                topic: q.topic || "N/A",
                studentAnswer: selectedInput ? selectedInput.value : "No answer",
                correctAnswer: q.correctAnswer || "N/A",
                imageUrl: q.imageUrl || null
            };
        });
        
        const score = resultsPayload.filter(r => r.studentAnswer === r.correctAnswer).length;

        try {
            await addDoc(collection(db, "student_results"), {
                studentName,
                parentEmail,
                grade,
                subject,
                tutorEmail,
                studentCountry,
                answers: resultsPayload,
                score: score,
                totalScoreableQuestions: questions.length,
                submittedAt: serverTimestamp()
            });

            alert("Test submitted successfully!");
            window.location.href = "subject-select.html";

        } catch (err) {
            console.error("Submit error:", err);
            alert("Failed to submit your test.");
        }
    }

    const submitButton = document.getElementById("submitBtn");
    if (submitButton) {
        submitButton.addEventListener("click", submitTest);
    }
});
