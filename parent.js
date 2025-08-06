// Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY", // Your API Key
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
});

const db = firebase.firestore();

// Helper function to capitalize names
function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

function loadReport() {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  const reportArea = document.getElementById("reportArea");
  const reportContent = document.getElementById("reportContent");
  const loader = document.getElementById("loader");
  const generateBtn = document.getElementById("generateBtn");

  // Basic validation
  if (!studentName || !parentEmail) {
    alert("Please enter both the student's full name and the parent's email.");
    return;
  }

  // Show loader and disable button
  loader.classList.remove("hidden");
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  db.collection("student_results").where("parentEmail", "==", parentEmail).get()
    .then((querySnapshot) => {
      const studentResults = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter by student name (case-insensitive)
        if (data.studentName && data.studentName.toLowerCase() === studentName) {
          studentResults.push({ ...data, timestamp: data.submittedAt?.seconds || Date.now() / 1000 });
        }
      });

      if (studentResults.length === 0) {
        alert("No records found for the provided details. Please check the name and email and try again.");
        loader.classList.add("hidden");
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Report";
        return;
      }

      // Group results by session (e.g., all tests taken within the same hour)
      const grouped = {};
      studentResults.forEach((result) => {
        const sessionKey = Math.floor(result.timestamp / 3600); // Group by hour
        if (!grouped[sessionKey]) grouped[sessionKey] = [];
        grouped[sessionKey].push(result);
      });

      let blockIndex = 0;
      reportContent.innerHTML = ""; // Clear previous reports

      for (const key in grouped) {
        const session = grouped[key];
        // Use details from the first record in the session for consistency
        const { grade, tutorName, location } = session[0];
        const fullName = capitalize(session[0].studentName);
        const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

        const tableRows = session.map(r => {
          const correct = r.answers.filter(a => a === "correct").length;
          return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${correct} / ${r.answers.length}</td></tr>`;
        }).join("");

        const topicRecommendations = `
          <table class="w-full text-sm mb-4 border border-collapse">
            <thead class="bg-gray-100">
              <tr>
                <th class="border px-2 py-1 text-left">Subject</th>
                <th class="border px-2 py-1 text-left">Topics Covered</th>
                <th class="border px-2 py-1 text-left">Skills Assessed</th>
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

        // The main HTML block for each report session
        const block = `
          <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
            <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
            <p><strong>Parent Email:</strong> ${parentEmail}</p>
            <p><strong>Grade:</strong> ${grade}</p>
            <p><strong>Tutor:</strong> ${tutorName}</p>
            <p><strong>Location:</strong> ${location}</p>
            <p><strong>Session Date:</strong> ${formattedDate}</p>

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
            <p class="mb-2 italic">Based on this assessment, ${tutorName} recommends dedicated focus on the specific skills and topics highlighted above. Regular practice will help reinforce understanding and build long-term confidence.</p>

            <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
            <p class="italic text-sm">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>

            <div class="mt-4">
              <button onclick="downloadSessionReport(${blockIndex}, '${fullName}')" class="btn-yellow px-4 py-2 rounded">Download Session PDF</button>
            </div>
          </div>`;

        reportContent.innerHTML += block;

        // --- Chart.js UPGRADED STACKED BAR CHART ---
        const ctx = document.getElementById(`chart-${blockIndex}`).getContext('2d');
        const subjectLabels = session.map(r => r.subject.toUpperCase());
        const correctScores = session.map(r => r.answers.filter(a => a === "correct").length);
        const incorrectScores = session.map(r => r.answers.filter(a => a !== "correct").length); // Calculate wrong/unanswered

        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: subjectLabels,
            datasets: [
              { label: 'Correct Answers', data: correctScores, backgroundColor: '#4CAF50' },
              { label: 'Incorrect/Unanswered', data: incorrectScores, backgroundColor: '#FFCD56' }
            ]
          },
          options: {
            responsive: true,
            scales: {
              x: { stacked: true },
              y: { stacked: true, beginAtZero: true }
            },
            plugins: {
                title: { display: true, text: 'Score Distribution by Subject' }
            }
          }
        });
        blockIndex++;
      }

      // Hide the input form and show the report area
      document.getElementById("inputArea").classList.add("hidden");
      reportArea.classList.remove("hidden");
      document.getElementById("logoutArea").style.display = "flex"; // Show the logout button

    }).catch(error => {
        console.error("Error fetching report: ", error);
        alert("An error occurred while fetching the report. Please try again.");
        loader.classList.add("hidden");
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Report";
    });
}

function downloadSessionReport(index, studentName) {
  const element = document.getElementById(`report-block-${index}`);
  const safeStudentName = studentName.replace(/ /g, '_');
  const fileName = `Assessment_Report_${safeStudentName}_Session_${index + 1}.pdf`;
  
  // Options to improve PDF layout
  const opt = {
    margin:       0.5,
    filename:     fileName,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().from(element).set(opt).save();
}

// Redirects back to the main login page
function logout() {
  window.location.href = "parent.html";
}
