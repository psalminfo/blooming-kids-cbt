// Firebase config...
firebase.initializeApp({
  apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
  authDomain: "bloomingkidsassessment.firebaseapp.com",
  projectId: "bloomingkidsassessment",
  storageBucket: "bloomingkidsassessment.firebasestorage.app",
  messagingSenderId: "238975054977",
  appId: "1:238975054977:web:87c70b4db044998a204980"
});

const db = firebase.firestore();

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Main function to load the report
async function loadReport() {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  
  const reportArea = document.getElementById("reportArea");
  const reportContent = document.getElementById("reportContent");
  const loader = document.getElementById("loader");
  const generateBtn = document.getElementById("generateBtn");

  if (!studentName || !parentEmail) { /* ... validation ... */ }
  
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

    if (studentResults.length === 0) { /* ... handle no records ... */ }

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
      
      // --- NEW, SIMPLIFIED SCORE & TOPIC CALCULATION ---
      const results = session.map(testResult => {
        let correctCount = 0;
        // The 'answers' field is now the array of objects
        testResult.answers.forEach(answerObject => {
          if (String(answerObject.studentAnswer).toLowerCase() === String(answerObject.correctAnswer).toLowerCase()) {
            correctCount++;
          }
        });
        const topics = [...new Set(testResult.answers.map(a => a.topic))];
        return {
          subject: testResult.subject,
          correct: correctCount,
          total: testResult.answers.length,
          topics: topics
        };
      });

      const tableRows = results.map(res => `<tr><td class="border px-2 py-1">${res.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td></tr>`).join("");
      
      const topicsTableRows = results.map(res => `<tr><td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td><td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td></tr>`).join("");

      const topicsTable = `
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100">
            <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr>
          </thead>
          <tbody>${topicsTableRows}</tbody>
        </table>`;

      const fullBlock = `
        <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
          <!-- ... The rest of the HTML block is the same ... -->
        </div>`;
      
      // (This part is simplified as we just need to inject the variables)
      reportContent.innerHTML += `
        <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
          <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
          <p><strong>Parent Email:</strong> ${parentEmail}</p>
          <p><strong>Grade:</strong> ${session[0].grade}</p>
          <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
          <p><strong>Location:</strong> ${location || 'N/A'}</p>
          <p><strong>Session Date:</strong> ${formattedDate}</p>
          <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
          <table class="w-full text-sm mb-4 border border-collapse">
            <thead class="bg-gray-100">
              <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <h3 class="text-lg font-semibold mt-4 mb-2">Knowledge & Skill Analysis</h3>
          ${topicsTable}
          <canvas id="chart-${blockIndex}" class="w-full h-48 mb-4"></canvas>
          <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
          <p class="mb-2 italic">Based on this assessment, the tutor recommends dedicated focus on the topics highlighted above. Regular practice will help reinforce understanding and build long-term confidence.</p>
          <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
          <p class="italic text-sm">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
          <div class="mt-4">
            <button onclick="downloadSessionReport(${blockIndex}, '${fullName}')" class="btn-yellow px-4 py-2 rounded">Download Session PDF</button>
          </div>
        </div>
      `;
      
      const ctx = document.getElementById(`chart-${blockIndex}`).getContext('2d');
      new Chart(ctx, { /* ... Chart config is the same, using 'results' data ... */ });
      blockIndex++;
    }

    document.getElementById("inputArea").classList.add("hidden");
    reportArea.classList.remove("hidden");
    document.getElementById("logoutArea").style.display = "flex";

  } catch (error) { /* ... error handling ... */ } 
  finally { /* ... reset button ... */ }
}

function downloadSessionReport(index, studentName) { /* ... */ }
function logout() { /* ... */ }
