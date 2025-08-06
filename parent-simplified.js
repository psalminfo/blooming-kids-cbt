// Firebase config
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

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

function loadReport() {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  const reportArea = document.getElementById("reportArea");
  const reportContent = document.getElementById("reportContent");

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  db.collection("student_results").where("parentEmail", "==", parentEmail).get().then((querySnapshot) => {
    const studentResults = [];
    querySnapshot.forEach((doc) => {
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

      const tableRows = session.map(r => {
        const correct = r.answers.filter(a => a === "correct").length;
        return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${correct} / ${r.answers.length}</td></tr>`;
      }).join("");

      const topicRecommendations = `
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100">
            <tr>
              <th class="border px-2 py-1 text-left">Subject</th>
              <th class="border px-2 py-1 text-left">Topics</th>
              <th class="border px-2 py-1 text-left">Skills</th>
            </tr>
          </thead>
          <tbody>
            ${session.map(r => {
              const topics = (r.topic || r.topics || []).join(", ") || "N/A";
              const skills = (r.skill_detail || []).join(", ") || "N/A";
              return `<tr>
                <td class="border px-2 py-1">${r.subject.toUpperCase()}</td>
                <td class="border px-2 py-1">${topics}</td>
                <td class="border px-2 py-1">${skills}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>`;

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

          <canvas id="chart-${blockIndex}" class="w-full h-48 mb-4"></canvas>

          <h3 class="text-lg font-semibold mb-1">Knowledge & Skill Analysis</h3>
          ${topicRecommendations}

          <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
          <p class="mb-2 italic">${tutorName} recommends dedicated focus on the skills highlighted above. Regular tutoring sessions will help reinforce understanding and build long-term confidence.</p>

          <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
          <p class="italic text-sm">At Blooming Kids House, we are committed to helping your child succeed. Personalized support and guidance from ${tutorName} will unlock the full potential of ${fullName}.<br/>– Mrs. Yinka Isikalu, Director</p>

          <div class="mt-4">
            <button onclick="downloadSessionReport(${blockIndex})" class="btn-yellow px-4 py-2 rounded">Download PDF</button>
          </div>
        </div>`;

      reportContent.innerHTML += block;

      const ctx = document.getElementById(`chart-${blockIndex}`).getContext('2d');
      const subjectLabels = session.map(r => r.subject.toUpperCase());
      const correctScores = session.map(r => r.answers.filter(a => a === "correct").length);
      const totalScores = session.map(r => r.answers.length);

      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: subjectLabels,
          datasets: [
            { label: 'Correct Answers', data: correctScores, backgroundColor: '#4CAF50' },
            { label: 'Total Questions', data: totalScores, backgroundColor: '#FFEB3B' }
          ]
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true } }
        }
      });

      blockIndex++;
    }

    reportArea.classList.remove("hidden");
  });
}

function downloadSessionReport(index) {
  const element = document.getElementById(`report-block-${index}`);
  html2pdf().from(element).save(`Assessment_Report_${index + 1}.pdf`);
}

function logout() {
  window.location.href = "parent.html";
}
