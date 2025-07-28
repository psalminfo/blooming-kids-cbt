document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();
  const db = firebase.firestore();

  const reportsTab = document.getElementById("tab-reports");
  const uploadTab = document.getElementById("tab-upload");
  const curriculumTab = document.getElementById("tab-curriculum");

  const sectionReports = document.getElementById("section-reports");
  const sectionUpload = document.getElementById("section-upload");
  const sectionCurriculum = document.getElementById("section-curriculum");

  const logoutBtn = document.getElementById("logoutBtn");

  function showTab(tabId) {
    [sectionReports, sectionUpload, sectionCurriculum].forEach((section) =>
      section.classList.add("hidden")
    );
    document.getElementById(tabId).classList.remove("hidden");
  }

  reportsTab.addEventListener("click", () => showTab("section-reports"));
  uploadTab.addEventListener("click", () => showTab("section-upload"));
  curriculumTab.addEventListener("click", () => showTab("section-curriculum"));

  logoutBtn.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "login-admin.html";
  });

  const uploadForm = document.getElementById("uploadForm");
  const questionJSON = document.getElementById("questionJSON");

  uploadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const file = questionJSON.files[0];
    if (!file) return alert("Please select a JSON file.");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (!Array.isArray(jsonData)) throw new Error("Invalid format");

        jsonData.forEach((qset) => {
          if (qset.grade && qset.subject && Array.isArray(qset.questions)) {
            db.collection("manualQuestions").add({
              grade: qset.grade,
              subject: qset.subject,
              questions: qset.questions,
              uploadedAt: new Date().toISOString(),
            });
          }
        });

        alert("Questions uploaded.");
      } catch (err) {
        console.error(err);
        alert("Invalid JSON format.");
      }
    };
    reader.readAsText(file);
  });

  // Fetch reports
  const reportsContainer = document.getElementById("reportsContainer");

  db.collection("testResults").get().then((snapshot) => {
    reportsContainer.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.className = "p-2 border rounded mb-2 bg-gray-50";
      div.innerHTML = `
        <p><strong>${data.student}</strong> - ${data.subject}</p>
        <p>Score: ${data.correct}/${data.total} | ${data.percentage}%</p>
        <p>${new Date(data.timestamp).toLocaleString()}</p>
      `;
      reportsContainer.appendChild(div);
    });
  });
});
