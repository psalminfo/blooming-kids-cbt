function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

async function fetchCorrectAnswers(subject, grade) {
  const url = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/${grade}-${subject.toLowerCase()}.json`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.questions || [];
  } catch (e) {
    console.warn("GitHub load failed:", e);
    return [];
  }
}

window.loadReport = async function () {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  const reportArea = document.getElementById("reportArea");
  const reportContent = document.getElementById("reportContent");

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const db = firebase.firestore();
  const q = db.collection("student_results").where("parentEmail", "==", parentEmail);
  const snapshot = await q.get();

  const studentResults = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.studentName.toLowerCase() === studentName) {
      studentResults.push({ ...data, timestamp: data.submittedAt?.seconds || Date.now() });
    }
  });

  if (studentResults.length === 0) {
    alert("No records found.");
    return;
  }

  const grouped = {};
  studentResults.forEach((result) => {
    const sessionKey = Math.floor(result.timestamp / 3600);
    if (!grouped[sessionKey]) grouped[sessionKey] = [];
    grouped[sessionKey].push(result);
  });

  let blockIndex = 0;
  reportContent.innerHTML = "";

  for (const key in grouped) {
    const session = grouped[key];
    const { grade, tutorName, location } = session[0];
    const fullName = capitalize(session[0].studentName);
    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString();

    const scoreTable = [];
    const topicMap = {};
    const skillMap = {};

    for (const r of session) {
      const correctAnswers = await fetchCorrectAnswers(r.subject, r.grade);
      const correctSet = new Set(correctAnswers.map(q => q.correct_answer));
      let score = 0;
      if (r.answers?.length) {
        for (let i = 0; i < r.answers.length; i++) {
          if (r.answers[i] === correctAnswers[i]?.correct_answer) score++;
        }
      }

      const topicList = (r.topic || r.topics || []);
      const skillList = (r.skill_detail || []);

      topicMap[r.subject] = topicList;
      skillMap[r.subject] = skillList;
      scoreTable.push({ subject: r.subject, score, total: r.answers.length });
    }

    const tableRows = scoreTable.map(r =>
      `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${r.score} / ${r.total}</td></tr>`
    ).join("");

    const knowledgeAnalysis = Object.entries(topicMap).map(([subject, topics]) =>
      `<tr><td class="border px-2 py-1 font-semibold">${subject.toUpperCase()}</td><td class="border px-2 py-1">${topics.join(", ") || "N/A"}</td></tr>`
    ).join("");

    const skillDetails = Object.entries(skillMap).map(([subject, skills]) =>
      `<tr><td class="border px-2 py-1 font-semibold">${subject.toUpperCase()}</td><td class="border px-2 py-1">${skills.join(", ") || "N/A"}</td></tr>`
    ).join("");

    const block = `
      <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
        <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
        <p><strong>Parent Email:</strong> ${parentEmail}</p>
        <p><strong>Grade:</strong> ${grade}</p>
        <p><strong>Tutor:</strong> ${tutorName}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Session:</strong> ${formattedDate}</p>

        <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100">
            <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <canvas id="chart-${blockIndex}" class="my-4"></canvas>

        <h3 class="text-lg font-semibold mb-2">Knowledge & Skill Analysis</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100"><tr><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Topics</th></tr></thead>
          <tbody>${knowledgeAnalysis}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-2">Skill Details</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100"><tr><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Skills</th></tr></thead>
          <tbody>${skillDetails}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-2">Tutor’s Recommendation</h3>
        <p class="mb-4 italic">${tutorName} recommends dedicated focus on the topics and skills highlighted above. Consistent tutoring will strengthen your child's mastery.</p>

        <h3 class="text-lg font-semibold mb-2">Director’s Message</h3>
        <p class="italic text-sm">At Blooming Kids House, we believe in nurturing potential through tailored support. With guidance from ${tutorName}, your child is on the path to excellence.<br/>– Mrs. Yinka Isikalu, Director</p>

        <div class="mt-4">
          <button onclick="downloadSessionReport(${blockIndex})" class="btn-yellow px-4 py-2 rounded">Download PDF</button>
        </div>
      </div>
    `;
    reportContent.innerHTML += block;

    setTimeout(() => {
      const ctx = document.getElementById(`chart-${blockIndex}`).getContext("2d");
      const chartData = {
        labels: scoreTable.map(r => r.subject.toUpperCase()),
        datasets: [{
          label: 'Score',
          data: scoreTable.map(r => r.score),
          backgroundColor: '#4CAF50'
        }]
      };
      new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
    }, 500);

    blockIndex++;
  }

  reportArea.classList.remove("hidden");
};

window.downloadSessionReport = function (index) {
  const el = document.getElementById(`report-block-${index}`);
  html2pdf().from(el).save(`Assessment_Report_${index + 1}.pdf`);
};

window.logout = function () {
  window.location.href = "parent.html";
};
