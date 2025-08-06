// Firebase config for the 'bloomingkidsassessment' project
firebase.initializeApp({
  apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
  authDomain: "bloomingkidsassessment.firebaseapp.com",
  projectId: "bloomingkidsassessment",
  storageBucket: "bloomingkidsassessment.firebasestorage.app",
  messagingSenderId: "238975054977",
  appId: "1:238975054977:web:87c70b4db044998a204980"
});

const db = firebase.firestore();

// Helper function to capitalize names
function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * FINAL VERSION: Asynchronously calculates a score by fetching the full question file from GitHub
 * and extracting the 'correct_answer' from each question object.
 * @param {string} grade The student's grade (e.g., "Grade 3").
 * @param {string} subject The test subject (e.g., "Math").
 * @param {Array<string>} studentAnswers The answers submitted by the student.
 * @returns {Promise<{correct: number, total: number}>} An object with the number of correct answers and total questions.
 */
async function calculateScoreFromGitHub(grade, subject, studentAnswers) {
  const baseURL = "https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/";
  
  const gradeNumber = grade.match(/\d+/)?.[0] || '1'; 
  const subjectLower = subject.toLowerCase();
  
  const subjectNameMap = {
      'chemistry': 'chemistry',
      'biology': 'biology',
      'physics': 'physics',
      'math': 'math',
      'english language arts': 'ela',
      'ela': 'ela'
  };

  const subjectForFile = subjectNameMap[subjectLower] || subjectLower;
  const fileName = `${gradeNumber}-${subjectForFile}.json`;
  const fetchURL = baseURL + fileName;

  console.log(`Attempting to fetch answers from: ${fetchURL}`);

  try {
    const response = await fetch(fetchURL);
    if (!response.ok) {
      console.error(`Could not find answer file at: ${fetchURL}`);
      return { correct: 0, total: studentAnswers.length };
    }

    const data = await response.json();

    if (!data || !data.questions || !Array.isArray(data.questions)) {
      console.error(`Error: The file ${fileName} is missing the "questions": [...] array inside it.`);
      return { correct: 0, total: studentAnswers.length };
    }

    // --- UPDATED LOGIC: Extract correct answers from the array of question objects ---
    const correctAnswers = data.questions.map(q => q.correct_answer);

    let score = 0;
    studentAnswers.forEach((answer, index) => {
      if (index < correctAnswers.length && String(answer).toLowerCase() === String(correctAnswers[index]).toLowerCase()) {
        score++;
      }
    });

    return { correct: score, total: correctAnswers.length };

  } catch (error) {
    console.error(`Error fetching or processing ${fileName}:`, error);
    return { correct: 0, total: studentAnswers.length };
  }
}

// Main function to load the report (async to handle scoring)
async function loadReport() {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  const reportArea = document.getElementById("reportArea");
  const reportContent = document.getElementById("reportContent");
  const loader = document.getElementById("loader");
  const generateBtn = document.getElementById("generateBtn");

  if (!studentName || !parentEmail) {
    alert("Please enter both the student's full name and the parent's email.");
    return;
  }

  loader.classList.remove("hidden");
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    const querySnapshot = await db.collection("student_results").where("parentEmail", "==", parentEmail).get();
    
    const studentResults = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.studentName && data.studentName.toLowerCase() === studentName) {
        studentResults.push({ ...data, timestamp: data.submittedAt?.seconds || Date.now() / 1000 });
      }
    });

    if (studentResults.length === 0) {
      alert("No records found. Please check the name and email.");
      loader.classList.add("hidden");
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Report";
      return;
    }

    // Group results by session
    const grouped = {};
    studentResults.forEach((result) => {
      const sessionKey = Math.floor(result.timestamp / 3600);
      if (!grouped[sessionKey]) grouped[sessionKey] = [];
      grouped[sessionKey].push(result);
    });

    reportContent.innerHTML = "";
    let blockIndex = 0;

    for (const key in grouped) {
      const session = grouped[key];
      const { tutorName, location } = session[0];
      const fullName = capitalize(session[0].studentName);
      const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
      
      const scorePromises = session.map(r => calculateScoreFromGitHub(r.grade, r.subject, r.answers));
      const scores = await Promise.all(scorePromises);

      const tableRows = session.map((r, i) => {
        return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${scores[i].correct} / ${scores[i].total}</td></tr>`;
      }).join("");
      
      const fullBlock = `
        <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
          <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
          <p><strong>Parent Email:</strong> ${parentEmail}</p>
          <p><strong>Grade:</strong> ${session[0].grade}</p>
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
          
          <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
          <p class="mb-2 italic">Based on this assessment, ${tutorName} recommends dedicated focus on the specific skills and topics highlighted above. Regular practice will help reinforce understanding and build long-term confidence.</p>

          <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
          <p class="italic text-sm">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>

          <div class="mt-4">
            <button onclick="downloadSessionReport(${blockIndex}, '${fullName}')" class="btn-yellow px-4 py-2 rounded">Download Session PDF</button>
          </div>
        </div>`;

      reportContent.innerHTML += fullBlock;
      
      const ctx = document.getElementById(`chart-${blockIndex}`).getContext('2d');
      const subjectLabels = session.map(r => r.subject.toUpperCase());
      const correctScores = scores.map(s => s.correct);
      const incorrectScores = scores.map(s => s.total - s.correct);
      
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
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
            plugins: { title: { display: true, text: 'Score Distribution by Subject' } }
          }
        });

      blockIndex++;
    }

    document.getElementById("inputArea").classList.add("hidden");
    reportArea.classList.remove("hidden");
    document.getElementById("logoutArea").style.display = "flex";

  } catch (error) {
    console.error("Error generating report: ", error);
    alert("A critical error occurred while generating the report. Please check the console for details.");
  } finally {
    loader.classList.add("hidden");
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Report";
  }
}

function downloadSessionReport(index, studentName) {
  const element = document.getElementById(`report-block-${index}`);
  const safeStudentName = studentName.replace(/ /g, '_');
  const fileName = `Assessment_Report_${safeStudentName}_Session_${index + 1}.pdf`;
  
  const opt = {
    margin: 0.5,
    filename: fileName,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().from(element).set(opt).save();
}

function logout() {
  window.location.href = "parent.html";
}
