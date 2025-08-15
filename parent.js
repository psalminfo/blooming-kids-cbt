// Firebase config for the 'bloomingkidsassessment' project
firebase.initializeApp({
  apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
  authDomain: "bloomingkidsassessment.firebaseapp.com",
  projectId: "bloomingkidsassessment",
  storageBucket: "bloomingkidsassessment.appspot.com",
  messagingSenderId: "238975054977",
  appId: "1:238975054977:web:87c70b4db044998a204980"
});

const db = firebase.firestore();

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

async function loadReport() {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  
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
      const tutorEmail = session[0].tutorEmail || 'N/A';
      const studentCountry = session[0].studentCountry || 'N/A';
      const fullName = capitalize(session[0].studentName);
      const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
      
      const tutorDoc = await db.collection("tutors").doc(tutorEmail).get();
      const tutorName = tutorDoc.exists ? tutorDoc.data().name : 'N/A';

      const results = session.map(testResult => {
        if (!Array.isArray(testResult.answers) || testResult.answers.length === 0 || typeof testResult.answers[0] !== 'object' || testResult.answers[0] === null) {
            console.error("Invalid or old data format for subject:", testResult.subject);
            return { subject: testResult.subject, correct: 0, total: 0, topics: ["Outdated Test Format"] };
        }

        let correctCount = 0;
        testResult.answers.forEach(answerObject => {
          if (answerObject.type !== 'creative-writing' && String(answerObject.studentAnswer).toLowerCase() === String(answerObject.correctAnswer).toLowerCase()) {
            correctCount++;
          }
        });
        const topics = [...new Set(testResult.answers.map(a => a.topic).filter(t => t))];
        const totalScoreable = testResult.totalScoreableQuestions;

        return {
          subject: testResult.subject,
          correct: correctCount,
          total: totalScoreable,
          topics: topics,
        };
      });

      const tableRows = results.map(res => {
        return `<tr><td class="border px-2 py-1">${res.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td></tr>`;
      }).join("");
      
      const topicsTableRows = results.map(res => {
          return `<tr>
                    <td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td>
                    <td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td>
                  </tr>`;
      }).join("");

      const creativeWritingAnswer = session[0].answers.find(a => a.type === 'creative-writing');
      const tutorReport = creativeWritingAnswer?.tutorReport || 'N/A';

      const fullBlock = `
        <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
          <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
          <p><strong>Parent Email:</strong> ${parentEmail}</p>
          <p><strong>Grade:</strong> ${session[0].grade}</p>
          <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
          <p><strong>Location:</strong> ${studentCountry || 'N/A'}</p>
          <p><strong>Session Date:</strong> ${formattedDate}</p>
          <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
          <table class="w-full text-sm mb-4 border border-collapse">
            <thead class="bg-gray-100">
              <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
          <h3 class="text-lg font-semibold mt-4 mb-2">Knowledge & Skill Analysis</h3>
          ${topicsTableRows ? `
              <table class="w-full text-sm mb-4 border border-collapse">
                <thead class="bg-gray-100">
                  <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr>
                </thead>
                <tbody>${topicsTableRows}</tbody>
              </table>
            ` : `<p class="italic">No topics found for this test.</p>`}
          
          <h3 class="text-lg font-semibold mt-4 mb-2">Creative Writing Report</h3>
          <p class="mb-2"><strong>Submission:</strong> ${creativeWritingContent}</p
