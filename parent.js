// Firebase config...
firebase.initializeApp({ /* ... */ });
const db = firebase.firestore();

// capitalize and calculateScoreFromGitHub functions remain the same...
function capitalize(str) { /* ... */ }
async function calculateScoreFromGitHub(grade, subject, studentAnswers) { /* ... */ }


// Main function to load the report
async function loadReport() {
  // ... (The beginning of this function is the same, it fetches studentResults) ...

  try {
    // ... (The code to get and group studentResults is the same) ...

    for (const key in grouped) {
      const session = grouped[key];
      // ... (The code to get session details is the same) ...
      
      const results = await Promise.all(session.map(r => calculateScoreFromGitHub(r.grade, r.subject, r.answers)));

      const tableRows = session.map((r, i) => {
        const score = results[i];
        return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${score.correct} / ${score.total}</td></tr>`;
      }).join("");
      
      // --- NEW: Create a table for the topics covered ---
      const topicsTableRows = results.map((res, i) => {
        const subject = session[i].subject.toUpperCase();
        const topics = res.topics.join(', ');
        return `<tr>
                  <td class="border px-2 py-1 font-semibold">${subject}</td>
                  <td class="border px-2 py-1">${topics || 'N/A'}</td>
                </tr>`;
      }).join("");

      const topicsTable = `
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100">
            <tr>
              <th class="border px-2 py-1 text-left">Subject</th>
              <th class="border px-2 py-1 text-left">Topics Covered</th>
            </tr>
          </thead>
          <tbody>
            ${topicsTableRows}
          </tbody>
        </table>`;

      // --- UPDATED fullBlock to include the new topicsTable ---
      const fullBlock = `
        <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
          <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
          <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
          <table class="w-full text-sm mb-4 border border-collapse">
            <tbody>${tableRows}</tbody>
          </table>
          
          <h3 class="text-lg font-semibold mt-4 mb-2">Knowledge & Skill Analysis</h3>
          ${topicsTable}

          <canvas id="chart-${blockIndex}" class="w-full h-48 mb-4"></canvas>
          
          <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
          </div>`;

      reportContent.innerHTML += fullBlock;
      
      // ... (The chart generation and rest of the function remain the same) ...
    }

    // ... (The final part of the function is the same) ...

  } catch (error) { /* ... */ } 
  finally { /* ... */ }
}

// downloadSessionReport and logout functions remain unchanged
function downloadSessionReport(index, studentName) { /* ... */ }
function logout() { /* ... */ }
