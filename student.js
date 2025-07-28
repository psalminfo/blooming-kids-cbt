document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();
  const db = firebase.firestore();

  const startBtn = document.getElementById("startBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const userName = sessionStorage.getItem("bkh_studentName");
  const parentEmail = sessionStorage.getItem("bkh_parentEmail");
  const grade = sessionStorage.getItem("bkh_grade");
  const tutor = sessionStorage.getItem("bkh_tutor");
  const location = sessionStorage.getItem("bkh_location");

  if (!userName || !parentEmail || !grade || !tutor || !location) {
    alert("Missing login information. Please log in again.");
    window.location.href = "login-student.html";
    return;
  }

  // Load subjects based on grade
  const subjects = grade >= 7
    ? ["Math", "ELA", "Biology", "Chemistry", "Physics"]
    : ["Math", "ELA"];

  const subjectTabs = document.getElementById("subjectTabs");
  const questionContainer = document.getElementById("questionContainer");

  subjects.forEach((subject) => {
    const tab = document.createElement("button");
    tab.className = "tab-btn";
    tab.innerText = subject;
    tab.onclick = () => loadQuestions(subject);
    subjectTabs.appendChild(tab);
  });

  let activeSubject = null;
  let questions = [];

  function loadQuestions(subject) {
    activeSubject = subject;
    questionContainer.innerHTML = "<p>Loading questions...</p>";

    const manualRef = db.collection("manualQuestions")
      .where("grade", "==", grade)
      .where("subject", "==", subject);
    
    manualRef.get().then((snapshot) => {
      const manualQs = [];
      snapshot.forEach(doc => manualQs.push(...doc.data().questions));
      if (manualQs.length >= 30) {
        questions = shuffleArray(manualQs).slice(0, 30);
        renderQuestions();
      } else {
        fallbackAutoLoad(subject);
      }
    }).catch((err) => {
      console.error("Error loading manual questions:", err);
      fallbackAutoLoad(subject);
    });
  }

  function fallbackAutoLoad(subject) {
    const autoRef = db.collection("auto_questions")
      .where("grade", "==", grade)
      .where("subject", "==", subject);
    
    autoRef.get().then((snapshot) => {
      const autoQs = [];
      snapshot.forEach(doc => autoQs.push(...doc.data().questions));
      if (autoQs.length >= 30) {
        questions = shuffleArray(autoQs).slice(0, 30);
        renderQuestions();
      } else {
        questionContainer.innerHTML = "<p>No questions available.</p>";
      }
    }).catch(err => {
      console.error("Auto fallback error:", err);
      questionContainer.innerHTML = "<p>Error loading questions.</p>";
    });
  }

  function renderQuestions() {
    questionContainer.innerHTML = "";
    questions.forEach((q, i) => {
      const block = document.createElement("div");
      block.className = "question-box mb-4 p-3 bg-white rounded shadow";
      block.innerHTML = `
        <p><strong>Q${i + 1}:</strong> ${q.question}</p>
        ${q.options.map((opt, j) => `
          <label class="block">
            <input type="radio" name="q${i}" value="${opt}" />
            ${opt}
          </label>
        `).join("")}
      `;
      questionContainer.appendChild(block);
    });

    const submitBtn = document.createElement("button");
    submitBtn.innerText = "Submit";
    submitBtn.className = "bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded mt-4";
    submitBtn.onclick = handleSubmit;
    questionContainer.appendChild(submitBtn);
  }

  function handleSubmit() {
    let correct = 0;
    questions.forEach((q, i) => {
      const selected = document.querySelector(`input[name="q${i}"]:checked`);
      if (selected && selected.value === q.answer) correct++;
    });

    const score = correct;
    const percentage = ((correct / questions.length) * 100).toFixed(2);

    const result = {
      student: userName,
      parent: parentEmail,
      tutor,
      location,
      grade,
      subject: activeSubject,
      total: questions.length,
      correct: score,
      percentage,
      timestamp: new Date().toISOString(),
    };

    db.collection("testResults").add(result)
      .then(() => {
        questionContainer.innerHTML = "<p class='text-green-700 font-bold text-center'>Submitted successfully!</p>";
        setTimeout(() => {
          window.location.href = "subject-select.html";
        }, 1500);
      }).catch(err => {
        console.error("Error submitting:", err);
        alert("Failed to submit. Try again.");
      });
  }

  function shuffleArray(arr) {
    return arr.sort(() => 0.5 - Math.random());
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.clear();
      window.location.href = "login-student.html";
    });
  }
});
