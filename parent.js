import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
const storage = getStorage(app);

const urlParams = new URLSearchParams(window.location.search);
const studentName = urlParams.get("student");
const parentEmail = urlParams.get("parent");

async function loadReport() {
  const reportArea = document.getElementById("reportArea");
  const loading = document.getElementById("loading");

  const q = query(
    collection(db, "testResults"),
    where("studentName", "==", studentName),
    where("parentEmail", "==", parentEmail)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      loading.innerHTML =
        "<p class='text-red-500'>No reports found for this student and parent email.</p>";
      return;
    }

    const data = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    const latest = data.sort((a, b) => b.timestamp - a.timestamp)[0];

    document.getElementById("studentName").textContent = latest.studentName;
    document.getElementById("grade").textContent = latest.grade;
    document.getElementById("tutorName").textContent = latest.tutorName;

    const subjectScores = document.getElementById("subjectScores");
    subjectScores.innerHTML = "";
    Object.entries(latest.scores).forEach(([subject, score]) => {
      const li = document.createElement("li");
      li.textContent = `${subject}: ${score}/30`;
      subjectScores.appendChild(li);
    });

    const messageArea = document.getElementById("directorMessage");
    messageArea.innerHTML = `
      <p>Dear Parent,</p>
      <p>Thank you for trusting Blooming Kids House with your child's academic journey. Based on the assessment, our professional tutors have carefully reviewed ${latest.studentName}'s results.</p>
      <p>We believe that with the right guidance and consistent tutoring, your child can significantly improve and excel in these subjects. We recommend enrolling your child in a personalized tutoring plan led by ${latest.tutorName}, who is well-equipped to support ${latest.studentName}'s learning journey.</p>
      <p>Warm regards,</p>
      <p><strong>Mrs. Yinka Isikalu</strong><br/>Director, Blooming Kids House</p>
    `;

    const recommendationArea = document.getElementById("recommendations");
    recommendationArea.innerHTML = generateRecommendations(latest.scores, latest.grade, latest.tutorName, latest.studentName);

    const storageReference = storageRef(storage, `reports/${latest.id}.pdf`);
    const downloadURL = await getDownloadURL(storageReference);

    const downloadLink = document.getElementById("downloadLink");
    downloadLink.href = downloadURL;
    downloadLink.classList.remove("hidden");

    loading.classList.add("hidden");
    reportArea.classList.remove("hidden");

    // ✅ Make logout button visible
    document.getElementById("logoutArea").style.display = "flex";

  } catch (error) {
    loading.innerHTML =
      "<p class='text-red-500'>Error loading report. Please try again.</p>";
    console.error("Error loading report:", error);
  }
}

function generateRecommendations(scores, grade, tutorName, studentName) {
  let recommendations = "<ul class='list-disc pl-5'>";
  for (const [subject, score] of Object.entries(scores)) {
    let suggestion = "";
    if (score < 15) {
      suggestion = `We recommend focused tutoring sessions in ${subject} to address foundational gaps. Key areas covered in the test include reading comprehension, arithmetic, critical thinking, and curriculum-specific skills aligned with Texas and UK standards.`;
    } else if (score < 25) {
      suggestion = `${studentName} shows potential in ${subject}, but would benefit from additional support in advanced concepts. Regular practice and targeted intervention by ${tutorName} can help solidify mastery.`;
    } else {
      suggestion = `${studentName} performed well in ${subject}. Continued tutoring with ${tutorName} can help sustain and build upon this performance, especially as the curriculum advances.`;
    }
    recommendations += `<li><strong>${subject}:</strong> ${suggestion}</li>`;
  }
  recommendations += "</ul>";
  return recommendations;
}

function logout() {
  window.location.href = "parent.html";
}

window.addEventListener("DOMContentLoaded", loadReport);
window.logout = logout;
