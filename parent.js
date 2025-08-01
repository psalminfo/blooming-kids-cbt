import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Use CDN script in browser (no import)
const html2pdf = window.html2pdf;

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

document.getElementById("parentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();

  const q = query(
    collection(db, "student_results"),
    where("studentName", "==", studentName),
    where("parentEmail", "==", parentEmail)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    alert("No results found for this student and parent email.");
    return;
  }

  const results = {};
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const testKey = `${data.subject}-${data.submittedAt?.seconds}`;
    results[testKey] = data;
  });

  let reportHTML = "";
  for (const key in results) {
    const r = results[key];
    reportHTML += `
      <div class="mb-6 border p-4 rounded shadow-sm">
        <h2 class="text-xl font-bold mb-2">${r.subject.toUpperCase()} Report</h2>
        <p><strong>Student:</strong> ${r.studentName}</p>
        <p><strong>Parent:</strong> ${r.parentEmail}</p>
        <p><strong>Grade:</strong> ${r.grade}</p>
        <p><strong>Location:</strong> ${r.location}</p>
        <p><strong>Tutor:</strong> ${r.tutorName}</p>
        <p><strong>Date:</strong> ${new Date(r.submittedAt?.seconds * 1000).toLocaleDateString()}</p>
        <p><strong>Topics Tested:</strong> Number Concepts, Algebraic Reasoning, Data Analysis</p>
        <p class="mt-2"><strong>Director’s Message:</strong> At Blooming Kids House, we believe in nurturing potential. Based on ${r.studentName}'s recent performance, we recommend targeted support. Our tutor, ${r.tutorName}, will provide personalized guidance to help improve their understanding in ${r.subject}.</p>
      </div>
    `;
  }

  reportHTML += `
    <footer class="mt-6 text-sm text-center italic">
      <p><strong>Mrs. Yinka Isikalu</strong>, Director</p>
      <p>POWERED BY <span style="color:#FFEB3B">POG</span></p>
    </footer>
  `;

  document.getElementById("reportContent").innerHTML = reportHTML;
  document.getElementById("reportContainer").classList.remove("hidden");
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  html2pdf().from(document.getElementById("reportContent")).save("student-report.pdf");
});
