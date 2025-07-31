// submitAnswers.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Attach to the submit button
document.getElementById("submitBtn")?.addEventListener("click", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const studentName = urlParams.get("studentName");
  const parentEmail = urlParams.get("parentEmail");
  const grade = urlParams.get("grade");
  const tutorName = urlParams.get("tutorName");
  const location = urlParams.get("location");
  const subject = urlParams.get("subject");

  if (!studentName || !parentEmail || !grade || !tutorName || !location || !subject) {
    alert("Missing student info. Redirecting...");
    window.location.href = "index.html";
    return;
  }

  const answers = [];
  const questionElems = document.querySelectorAll(".question-block");

  questionElems.forEach((block, index) => {
    const selectedOption = block.querySelector("input[type='radio']:checked");
    answers.push({
      question: block.querySelector(".question-text")?.innerText || `Question ${index + 1}`,
      selected: selectedOption ? selectedOption.value : "No answer",
    });
  });

  try {
    await addDoc(collection(db, "studentResults"), {
      studentName,
      parentEmail,
      grade,
      tutorName,
      location,
      subject,
      answers,
      submittedAt: Timestamp.now(),
    });

    alert("Test submitted successfully.");
    window.location.href = "subject-select.html";
  } catch (err) {
    console.error("Error saving to Firestore:", err);
    alert("Failed to submit. Please try again.");
  }
});
