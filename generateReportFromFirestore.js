import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fetchQuestionFile(grade, subject) {
  const path = `./${grade}-${subject}.json`;
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Failed to load question file");
    const data = await response.json();
    return data.questions;
  } catch (error) {
    console.error("Question fetch error:", error);
    return [];
  }
}

function calculateScore(studentAnswers, questions) {
  let correctCount = 0;
  const total = questions.length;

  for (let i = 0; i < studentAnswers.length; i++) {
    const studentAns = studentAnswers[i];
    const correctAns = questions[i]?.correct_answer;

    if (studentAns && correctAns && studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase()) {
      correctCount++;
    }
  }

  return {
    correct: correctCount,
    total,
    percentage: ((correctCount / total) * 100).toFixed(1)
  };
}

function generateRecommendations(subject, score) {
  const topics = {
    chemistry: [
      "Elements & Compounds",
      "Acids, Bases & Salts",
      "States of Matter",
      "Chemical Reactions",
      "Periodic Table"
    ],
    math: [
      "Number Sense",
      "Fractions & Decimals",
      "Measurement",
      "Geometry",
      "Data Interpretation"
    ],
    ela: [
      "Reading Comprehension",
      "Grammar & Vocabulary",
      "Spelling",
      "Writing Structure",
      "Critical Thinking"
    ]
  };

  const keyTopics = topics[subject.toLowerCase()] || ["Curriculum topics"];

  return `
    Based on this test, your child may need support in key areas such as <strong>${keyTopics.join(", ")}</strong>.
    We recommend enrolling in our tailored tutoring sessions where Tutor <strong>${window.tutorName || "assigned tutor"}</strong>
    will guide them using personalized techniques to close gaps and build confidence.
  `;
}

export async function generateReportFromFirestore(studentName, parentEmail) {
  const reportRef = collection(db, "studentReports");
  const q = query(
    reportRef,
    where("studentName", "==", studentName),
    where("parentEmail", "==", parentEmail)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    document.getElementById("summary").innerHTML = `<p>No record found for this student.</p>`;
    return;
  }

  const reportData = snapshot.docs[0].data();
  const {
    grade,
    subject,
    studentAnswers,
    tutorName,
    location,
    submittedAt
  } = reportData;

  window.tutorName = tutorName; // for use in recommendation section

  document.getElementById("studentName").textContent = studentName;
  document.getElementById("grade").textContent = grade;
  document.getElementById("location").textContent = location;
  document.getElementById("tutorName").textContent = tutorName;
  document.getElementById("submittedAt").textContent = new Date(
    submittedAt.seconds * 1000
  ).toLocaleString();

  const questions = await fetchQuestionFile(grade, subject);

  if (questions.length === 0) {
    document.getElementById("summary").innerHTML = `<p>No record found for this student.</p>`;
    return;
  }

  const { correct, total, percentage } = calculateScore(studentAnswers, questions);

  // Build performance summary
  document.getElementById("summary").innerHTML = `
    <p><strong>Total Questions:</strong> ${total}</p>
    <p><strong>Correct Answers:</strong> ${correct}</p>
    <p><strong>Score:</strong> ${percentage}%</p>
  `;

  // Build recommendation
  document.getElementById("recommendations").innerHTML = generateRecommendations(subject, percentage);
}
