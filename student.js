import { db, collection, addDoc, serverTimestamp } from "./firebaseConfig.js";

// This function will run when the page loads
async function initializeTestPage() {
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

    // Fetch and render the questions for the current subject
    const questions = await fetchQuestions(grade, subject);
    if (questions) {
        renderQuestions(questions);
        startTimer(30); // 30-minute timer
    }

    // Set up the submit button to work with the fetched questions
    const submitButton = document.getElementById("submitBtn");
    if (submitButton) {
        submitButton.addEventListener("click", () => submitTest({
            studentName,
            parentEmail,
            grade,
            subject,
            questions
        }));
    }
}

// Fetches the questions from the correct JSON file
async function fetchQuestions(grade, subject) {
    const gradeNumber = grade.match(/\d+/)[0];
    const file = `${gradeNumber}-${subject}.json`;

    try {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`File not found: ${file}`);
        const data = await res.json();
        // Randomize and take up to 30 questions
        return data.questions.sort(() => 0.5 - Math.random()).slice(0, 30);
    } catch (err) {
        console.error("Question fetch error:", err);
        alert(`Could not load questions for ${subject}. Please check the subject name and file.`);
        return null;
    }
}

// Renders the questions as radio buttons on the page
function renderQuestions(qs) {
    const container = document.getElementById("questionContainer");
    if (!container) return;
    container.innerHTML = qs.map((q, i) => `
      <div class="bg-white p-4 rounded shadow mb-4">
        <p class="font-semibold mb-2">${i + 1}. ${q.question}</p>
        <div class="options-container">
        ${q.options.map(opt => `
          <label class="block cursor-pointer p-2 rounded hover:bg-gray-100">
            <input type="radio" name="q${i}" value="${opt}" class="mr-2" />${opt}
          </label>`).join("")}
        </div>
      </div>
    `).join("");
}

// Handles the countdown timer
function startTimer(mins) {
    // ... (This function remains the same)
}

// Gathers answers and saves them to Firebase
async function submitTest({ studentName, parentEmail, grade, subject, questions }) {
    // Gather the student's selected answers into a simple array
    const answers = questions.map((q, i) => {
        const selectedInput = document.querySelector(`input[name="q${i}"]:checked`);
        return selectedInput ? selectedInput.value : "No answer";
    });

    const dataToSave = {
        studentName,
        parentEmail,
        grade,
        subject,
        answers, // This is the simple array of strings
        submittedAt: serverTimestamp()
    };

    console.log("Data being saved to Firebase:", dataToSave);

    try {
        await addDoc(collection(db, "student_results"), dataToSave);
        alert("Test submitted successfully!");
        // We no longer clear localStorage here, as the user might take another test
        window.location.href = "subject-select.html";
    } catch (err) {
        console.error("Submit error:", err);
        alert("Failed to submit your test. Please try again.");
    }
}

// Start the entire process when the page is loaded
document.addEventListener("DOMContentLoaded", initializeTestPage);
