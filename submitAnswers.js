import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

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
  let correctCount = 0;
  const questionBlocks = document.querySelectorAll(".question-block");

  for (let i = 0; i < questionBlocks.length; i++) {
    const block = questionBlocks[i];
    const questionText = block.querySelector(".question-text")?.innerText || `Question ${i + 1}`;
    const selectedOption = block.querySelector("input[type='radio']:checked");
    const selected = selectedOption ? selectedOption.value : "No answer";
    const correct = block.getAttribute("data-correct");

    if (selected === correct) correctCount++;

    answers.push({
      question: questionText,
      selected,
      correct
    });
  }

  const score = `${correctCount}/${answers.length}`;

  // Generate PDF
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Blooming Kids House Test Report", 20, 20);
  doc.setFontSize(12);
  doc.text(`Student Name: ${studentName}`, 20, 30);
  doc.text(`Parent Email: ${parentEmail}`, 20, 38);
  doc.text(`Grade: ${grade}`, 20, 46);
  doc.text(`Subject: ${subject}`, 20, 54);
  doc.text(`Tutor: ${tutorName}`, 20, 62);
  doc.text(`Location: ${location}`, 20, 70);
  doc.text(`Score: ${score}`, 20, 78);
  doc.text(`Submitted: ${new Date().toLocaleString()}`, 20, 86);

  doc.setFontSize(11);
  doc.text("Director's Message:", 20, 98);
  doc.text("Thank you for taking the Blooming Kids test. This report helps us tailor support for your child.", 20, 106, { maxWidth: 170 });

  // Add brief recommendation
  doc.setFontSize(11);
  doc.text("Recommendation:", 20, 120);
  doc.text(`We recommend continued guidance from ${tutorName} to reinforce ${subject} concepts.`, 20, 128, { maxWidth: 170 });

  const pdfBlob = doc.output("blob");

  try {
    // Upload report to storage
    const fileRef = ref(storage, `reports/${studentName}_${subject}_${Date.now()}.pdf`);
    await uploadBytes(fileRef, pdfBlob);
    const reportUrl = await getDownloadURL(fileRef);

    // Save to Firestore
    await addDoc(collection(db, "studentResults"), {
      studentName,
      parentEmail,
      grade,
      subject,
      tutorName,
      location,
      answers,
      score,
      reportUrl,
      submittedAt: Timestamp.now()
    });

    window.location.href = "subject-select.html";
  } catch (err) {
    console.error("Error submitting:", err);
    alert("Failed to submit. Please try again.");
  }
});
