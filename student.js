// --- THIS IS THE FIX: We now import functions directly from Firebase ---
import { db } from "./firebaseConfig.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const subject = urlParams.get("subject")?.toLowerCase();

    const studentName = localStorage.getItem("studentName");
    const parentEmail = localStorage.getItem("studentEmail");
    const grade = localStorage.getItem("grade");

    if (!studentName || !parentEmail || !grade || !subject) {
        alert("Missing student info. Please log in again.");
        window.location.href = "index.html";
        return;
    }

    const gradeNumber = grade.match(/\d+/)[0];
    const fileName = `${gradeNumber}-${subject}`;
    // Add a cache-busting parameter to the URL to force the browser to get the latest version
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json?t=${new Date().getTime()}`;

    let questions = [];

    try {
        const res = await fetch(GITHUB_URL);
        if (!res.ok) throw new Error(`File not found: ${GITHUB_URL}`);
        const data = await res.json();

        const testData = data.tests[0];
        questions = testData.questions.sort(() => 0.5 - Math.random()).slice(0, 30);

        renderQuestions(questions);
        startTimer(30);
    } catch (err) {
        console.error("Question fetch error:", err);
        alert(`Could not load questions for ${subject}. Please check the subject name and try again.`);
    }

    function renderQuestions(qs) {
        const container = document.getElementById("questionContainer");
        if (!container) return;
        container.innerHTML = qs.map((q, i) => `
      <div class="bg-white p-4 rounded shadow mb-4 question-block">
        <p class="font-semibold mb-2">${i + 1}. ${q.question}</p>
        ${q.imageUrl ? `<img src="${q.imageUrl}" alt="Question Image" class="my-2 max-w-full h-auto rounded">` : ''}
        <div class="options-container">
        ${q.options.map(opt => `
          <label class="block cursor-pointer p-2 rounded hover:bg-gray-100">
            <input type="radio" name="q${i}" value="${opt}" class="mr-2" />${opt}
          </label>`).join("")}
        </div>
      </div>
    `).join("");
    }

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
        const allQuestionBlocks = document.querySelectorAll('.question-block');
        // Reset styles for all blocks first
        allQuestionBlocks.forEach(block => {
            block.style.border = "1px solid #e2e8f0"; // Reset to default border
        });

        for (let i = 0; i < questions.length; i++) {
            const selectedInput = document.querySelector(`input[name="q${i}"]:checked`);
            if (!selectedInput) {
                const unansweredBlock = allQuestionBlocks[i];
                unansweredBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                unansweredBlock.style.border = "2px solid red";
                return; // Stop the submission process
            }
        }

        const resultsPayload = questions.map((q, i) => {
            const selectedInput = document.querySelector(`input[name="q${i}"]:checked`);
            return {
                questionText: q.question,
                topic: q.topic || "N/A",
                studentAnswer: selectedInput ? selectedInput.value : "No answer",
                correctAnswer: q.correctAnswer || q.correct_answer || "N/A",
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
                answers: resultsPayload,
                score: score,
                totalScoreableQuestions: questions.length,
                submittedAt: serverTimestamp()
            });

            alert("Test submitted successfully!");
            window.location.href = "subject-select.html";

        } catch (err) {
            console.error("Submit error:", err);
            alert("Failed to submit your test. Please try again.");
        }
    }

    const submitButton = document.getElementById("submitBtn");
    if (submitButton) {
        submitButton.addEventListener("click", submitTest);
    }
});
