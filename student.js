import { db } from "./firebaseConfig.js";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// This variable will hold the questions for the current test.
let currentTestQuestions = [];

/**
 * This is the main function that loads questions from multiple sources.
 * It prioritizes Firestore and uses GitHub as a fallback.
 */
async function loadQuestions(subject, grade) {
    const container = document.getElementById("questionContainer");
    container.innerHTML = `<p class="text-gray-500">Please wait, preparing your personalized test...</p>`;

    const fileName = `${grade}-${subject}`.toLowerCase();
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}.json`;

    let allQuestions = [];

    try {
        // 1. First, try to find a curated test in the 'tests' collection.
        const testsCollectionRef = collection(db, "tests");
        const curatedTestQuery = query(
            testsCollectionRef,
            where("grade", "==", String(grade)),
            where("subject", "==", subject)
        );
        const curatedTestSnapshot = await getDocs(curatedTestQuery);

        if (!curatedTestSnapshot.empty) {
            const docSnap = curatedTestSnapshot.docs[0];
            allQuestions = docSnap.data().questions || [];
            console.log(`SUCCESS: Loading curated test from Firestore: ${docSnap.id}`);
        } else {
            // 2. If no curated test is found, gather questions from 'admin_questions'.
            console.log(`INFO: No curated test found. Checking 'admin_questions' collection.`);
            const adminQuestionsRef = collection(db, "admin_questions");
            const adminQuery = query(
                adminQuestionsRef,
                where("grade", "==", String(grade)),
                where("subject", "==", subject.toLowerCase())
            );
            const adminSnapshot = await getDocs(adminQuery);

            if (!adminSnapshot.empty) {
                adminSnapshot.forEach(doc => allQuestions.push(doc.data()));
                console.log(`SUCCESS: Loaded ${allQuestions.length} questions from 'admin_questions'.`);
            } else {
                // 3. If still no questions, fall back to GitHub.
                console.log(`INFO: No questions found in Firestore. Trying GitHub as a fallback.`);
                const gitHubRes = await fetch(GITHUB_URL);
                if (!gitHubRes.ok) throw new Error("Test file not found in any source.");
                const rawData = await gitHubRes.json();
                
                if (rawData && rawData.tests) {
                    allQuestions = rawData.tests[0]?.questions || [];
                } else if (rawData && rawData.questions) {
                    allQuestions = rawData.questions;
                }
                console.log(`SUCCESS: Loaded test from GitHub: ${fileName}.json`);
            }
        }
        
        if (allQuestions.length === 0) {
            container.innerHTML = `<p class="text-red-600">❌ No questions found for ${subject.toUpperCase()} Grade ${grade}.</p>`;
            return;
        }

        // Build the final test with the correct mix of questions.
        let finalQuestions = [];
        const multipleChoice = allQuestions.filter(q => q.type === 'multiple-choice' || !q.type);
        const creativeWriting = allQuestions.filter(q => q.type === 'creative-writing');
        const comprehension = allQuestions.filter(q => q.type === 'comprehension');
        
        if (subject.toLowerCase() === 'ela' || subject.toLowerCase() === 'english') {
            if (creativeWriting.length > 0) finalQuestions.push(creativeWriting[0]);
            if (comprehension.length > 0) finalQuestions.push(...comprehension.slice(0, 2));
            
            const remainingNeeded = 30 - finalQuestions.length;
            const remainingQuestions = [...multipleChoice].sort(() => 0.5 - Math.random());
            finalQuestions.push(...remainingQuestions.slice(0, remainingNeeded));
        } else {
            finalQuestions = [...allQuestions].sort(() => 0.5 - Math.random()).slice(0, 30);
        }

        // Save the final questions to our global variable and display them.
        currentTestQuestions = finalQuestions.map((q, index) => ({ ...q, id: index }));
        displayQuestions(currentTestQuestions);

    } catch (err) {
        console.error("Failed to load questions:", err);
        container.innerHTML = `<p class="text-red-600">❌ An error occurred while loading the test. ${err.message}</p>`;
    }
}

/**
 * Renders the questions to the page.
 */
function displayQuestions(questions) {
    const container = document.getElementById("questionContainer");
    container.innerHTML = (questions || []).map((q, i) => {
        const showImage = q.imageUrl;
        return `
        <div class="bg-white p-4 border rounded-lg shadow-sm question-block" data-question-id="${q.id}">
            ${showImage ? `<img src="${q.imageUrl}" class="mb-2 w-full rounded" alt="Question image"/>` : ''}
            <p class="font-semibold mb-2 question-text">${i + 1}. ${q.question || q.passage || ''}</p>
            ${(q.options || []).map(opt => `
                <label class="block ml-4">
                    <input type="radio" name="q${i}" value="${opt}" class="mr-2"> ${opt}
                </label>
            `).join('')}
        </div>
    `}).join('');
}


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

    // Call the main function to load questions.
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
        const questions = currentTestQuestions; // Use the globally stored questions
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
