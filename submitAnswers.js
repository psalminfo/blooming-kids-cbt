import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { loadedQuestions } from './autoQuestionGen.js'; // This line is new or modified

// UPDATED Firebase config to point to the correct project
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


// CORRECTED 'submitBtn' function
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

  // We are now creating a detailed array of objects
  const answers = [];
  const questionBlocks = document.querySelectorAll(".question-block");

  for (let i = 0; i < questionBlocks.length; i++) {
    const block = questionBlocks[i];
    const questionText = block.querySelector(".question-text").innerText; // Assuming you have a class for the question text
    const selectedOption = block.querySelector("input[type='radio']:checked");
    
    // Get the student's chosen answer
    const studentAnswer = selectedOption ? selectedOption.value : "No answer";

    // Find the original question from the loaded JSON data
    const originalQuestion = loadedQuestions.find(q => q.question === questionText);
    
    // Get the correct answer from the original question object
    const correctAnswer = originalQuestion ? originalQuestion.correct_answer : 'N/A';

    // Push a detailed object into the answers array
    answers.push({
      questionText: questionText,
      studentAnswer: studentAnswer,
      correctAnswer: correctAnswer
    });
  }

  try {
    // Save the detailed data to Firestore
    await addDoc(collection(db, "student_results"), {
      studentName,
      parentEmail,
      grade,
      subject,
      tutorName,
      location,
      answers, // This is now the detailed array the parent portal needs
      submittedAt: Timestamp.now()
    });

    alert("Test submitted successfully!");
    window.location.href = "subject-select.html"; 

  } catch (err) {
    console.error("Error submitting test results to Firebase:", err);
    alert("Failed to submit your test. Please check your connection and try again.");
  }
});
