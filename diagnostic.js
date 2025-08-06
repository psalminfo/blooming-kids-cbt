// Import the necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Your correct Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
  authDomain: "bloomingkidsassessment.firebaseapp.com",
  projectId: "bloomingkidsassessment",
  storageBucket: "bloomingkidsassessment.firebasestorage.app",
  messagingSenderId: "238975054977",
  appId: "1:238975054977:web:8a7c70b4db044998a204980"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- This is our main diagnostic function ---
async function runTest(subject) {
  console.log(`--- Starting test for ${subject.toUpperCase()} ---`);

  // 1. Define hardcoded student details
  const studentDetails = {
    studentName: "Diagnostic User",
    parentEmail: "test@example.com",
    grade: "Grade 3",
    subject: subject,
  };

  // 2. Fetch the correct answer key from GitHub
  const gradeNumber = studentDetails.grade.match(/\d+/)[0];
  const fileName = `${gradeNumber}-${subject}.json`;
  const fetchURL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${fileName}`;

  let questions = [];
  try {
    const response = await fetch(fetchURL);
    if (!response.ok) throw new Error(`File not found: ${fileName}`);
    const data = await response.json();
    questions = data.questions;
    console.log(`Successfully fetched ${questions.length} questions for ${subject}.`);
  } catch (err) {
    console.error("Fetch Error:", err);
    alert(`Could not load questions for ${subject}.`);
    return;
  }

  // 3. Simulate the student answering: We'll just create a simple list of the first option for each question.
  const studentAnswers = questions.map(q => q.options[0]);

  // 4. Prepare the final data object to be saved
  const dataToSave = {
    ...studentDetails,
    answers: studentAnswers, // The array of answers for this specific test
    submittedAt: serverTimestamp(),
  };

  // 5. *** THE MOST IMPORTANT STEP ***
  // Log the data to the console BEFORE saving it.
  console.log(`Data that will be saved for ${subject.toUpperCase()}:`, dataToSave);
  
  // 6. Save to Firebase
  try {
    await addDoc(collection(db, "student_results"), dataToSave);
    console.log(`✅ Successfully saved ${subject.toUpperCase()} results to Firebase.`);
    alert(`${subject.toUpperCase()} test has been submitted successfully! Check the console and your database.`);
  } catch (err) {
    console.error("Firebase Save Error:", err);
    alert(`Failed to save ${subject.toUpperCase()} results.`);
  }
}

// Add event listeners to our buttons
document.getElementById("mathBtn").addEventListener("click", () => runTest("math"));
document.getElementById("elaBtn").addEventListener("click", () => runTest("ela"));
