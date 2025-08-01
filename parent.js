import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ On load: fetch student + parent from URL and load report
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const studentName = urlParams.get("student");
  const parentEmail = urlParams.get("parent");

  if (!studentName || !parentEmail) {
    document.getElementById("reportContent").innerHTML = "<p class='text-red-500'>Missing student or parent info.</p>";
    return;
  }

  try {
    const resultsRef = collection(db, "student_results");
    const q = query(
      resultsRef,
      where("studentName", "==", studentName),
      where("parentEmail", "==", parentEmail.toLowerCase())
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const resultData = querySnapshot.docs[0].data();

      // ✅ Display report data
      document.getElementById("studentNameDisplay").textContent = resultData.studentName;
      document.getElementById("tutorNameDisplay").textContent = resultData.tutorName || "Your Assigned Tutor";
      document.getElementById("mathScoreDisplay").textContent = resultData.mathScore ?? "N/A";
      document.getElementById("elaScoreDisplay").textContent = resultData.elaScore ?? "N/A";

      // ✅ Recommendations based on score
      const recommendations = generateRecommendations(resultData);
      document.getElementById("recommendations").innerHTML = recommendations;

    } else {
      document.getElementById("reportContent").innerHTML = "<p class='text-red-500'>No report found for this student.</p>";
    }
  } catch (error) {
    console.error("Error loading report:", error);
    document.getElementById("reportContent").innerHTML = "<p class='text-red-500'>An error occurred while loading the report.</p>";
  }
});

// ✅ Generate tailored recommendations
function generateRecommendations(data) {
  let sections = [];

  if (data.mathScore !== undefined) {
    sections.push(`
      <h3 class="text-lg font-semibold mt-4 mb-1 text-blue-700">Math:</h3>
      <p>Your child scored ${data.mathScore}%. We recommend focusing on number sense, basic operations, and word problems. Your assigned tutor, <strong>${data.tutorName}</strong>, will guide your child through these areas weekly.</p>
    `);
  }

  if (data.elaScore !== undefined) {
    sections.push(`
      <h3 class="text-lg font-semibold mt-4 mb-1 text-green-700">ELA:</h3>
      <p>Your child scored ${data.elaScore}%. We suggest targeted reading comprehension, grammar, and vocabulary exercises. <strong>${data.tutorName}</strong> will use STAAR-aligned materials for improvement.</p>
    `);
  }

  return sections.join("");
}
