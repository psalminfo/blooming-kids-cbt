import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

window.loadReport = async function () {
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const q = query(collection(db, "studentResults"), where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));
  const querySnapshot = await getDocs(q);

  const reportContent = document.getElementById("reportContent");
  const reportSection = document.getElementById("reportSection");

  if (querySnapshot.empty) {
    reportContent.innerHTML = "<p class='text-red-500'>No report found for the given name and email.</p>";
    reportSection.classList.remove("hidden");
    return;
  }

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    reportContent.innerHTML = `
      <h2 class="text-xl font-bold mb-2">Student Report</h2>
      <p><strong>Student Name:</strong> ${data.studentName}</p>
      <p><strong>Grade:</strong> ${data.grade}</p>
      <p><strong>Subjects:</strong></p>
      <ul class="list-disc ml-5">
        ${Object.entries(data.scores || {}).map(([subject, score]) => `<li>${subject}: ${score}%</li>`).join('')}
      </ul>
      <p class="mt-2"><strong>Recommendations:</strong> ${data.recommendation || 'N/A'}</p>
      <p class="mt-2"><strong>Tutor:</strong> ${data.tutorName || 'Not Assigned'}</p>
      <p class="mt-4 italic">Director’s Message: Well done for reviewing your child's performance. Together, we can improve and support their learning journey.<br>– Mrs. Yinka Isikalu</p>
      <footer class="mt-4 text-center text-sm text-gray-500">POWERED BY <span style="color:#FFEB3B">POG</span></footer>
    `;
    reportSection.classList.remove("hidden");
  });
};

window.downloadSessionReport = function () {
  const element = document.getElementById("reportContent");
  const opt = {
    margin: 0.5,
    filename: 'student_report.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  html2pdf().from(element).set(opt).save();
};

window.logout = function () {
  window.location.href = "parent.html";
};
