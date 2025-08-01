// Firebase config (do NOT change — matches your student portal)
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

window.fetchStudentResult = async function () {
  const studentName = document.getElementById('studentName').value.trim().toLowerCase();
  const parentEmail = document.getElementById('parentEmail').value.trim().toLowerCase();

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const query = await db.collection("student_results")
    .where("studentName", "==", studentName)
    .where("parentEmail", "==", parentEmail)
    .get();

  if (query.empty) {
    alert("No results found for this student.");
    return;
  }

  const records = [];
  query.forEach(doc => records.push(doc.data()));

  window.studentRecords = records;
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("report-section").classList.remove("hidden");

  const reportHTML = generateReportHTML(records);
  document.getElementById("report-content").innerHTML = reportHTML;
};

window.logout = function () {
  window.location.reload();
};

window.downloadPDF = function () {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.html(document.getElementById("report-content"), {
    callback: function (pdf) {
      pdf.save("blooming-kids-report.pdf");
    },
    x: 10,
    y: 10,
    width: 180
  });
};
