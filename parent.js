function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
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
  const snapshot = await db.collection("student_results").where("parentEmail", "==", parentEmail).get();

  const studentResults = [];
  snapshot.forEach(doc => {
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
  studentResults.forEach(result => {
    const sessionKey = Math.floor(result.timestamp / 3600); // Group by hour
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

    const topicMap = {};
    session.forEach(r => {
      const subject = r.subject.toUpperCase();
      const topics = r.topics || r.topic || [];
      const skills = r.skill_detail || [];

      if (!topicMap[subject]) topicMap[subject] = { topics: new Set(), skills: new Set() };
      topics.forEach(t => topicMap[subject].topics.add(t));
      skills.forEach(s => topicMap[subject].skills.add(s));
    });

    const topicTable = Object.entries(topicMap).map(([subject, { topics, skills }]) => {
      return `
        <tr>
          <td class="border px-2 py-1 align-top"><strong>${subject}</strong></td>
          <td class="border px-2 py-1">${Array.from(topics).join(", ")}</td>
          <td class="border px-2 py-1">${Array.from(skills).join(", ") || "—"}</td>
        </tr>
      `;
    }).join("");

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

        <h3 class="text-lg font-semibold mt-2">Knowledge & Skill Analysis</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100">
            <tr><th class="border px-2 py-1">Subject</th><th class="border px-2 py-1">Topics</th><th class="border px-2 py-1">Skill Details</th></tr>
          </thead>
          <tbody>${topicTable}</tbody>
        </table>

        <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
        <p class="mb-2 italic">${tutorName} recommends dedicated focus on the skills highlighted above. Regular tutoring sessions will help reinforce understanding and build long-term confidence.</p>

        <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
        <p class="italic text-sm">At Blooming Kids House, we are committed to helping your child succeed. Personalized support and guidance from ${tutorName} will unlock the full potential of ${fullName}.<br/>– Mrs. Yinka Isikalu, Director</p>

        <div class="mt-4">
          <button onclick="downloadSessionReport(${blockIndex})" class="btn-yellow px-4 py-2 rounded">Download PDF</button>
        </div>
      </div>
    `;
    reportContent.innerHTML += block;
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
