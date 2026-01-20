/**
 * STANDALONE PROGRESS REPORT MODULE
 * Includes Firebase Initialization to prevent "No Firebase App" error
 */

// 1. INITIALIZE FIREBASE (Must happen first)
// Checking apps.length prevents double-initialization errors if this script is loaded twice
if (!firebase.apps.length) {
    firebase.initializeApp({
        apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
        authDomain: "bloomingkidsassessment.firebaseapp.com",
        projectId: "bloomingkidsassessment",
        storageBucket: "bloomingkidsassessment.appspot.com",
        messagingSenderId: "238975054977",
        appId: "1:238975054977:web:87c70b4db044998a204980"
    }); [cite_start]// [cite: 1]
}

// 2. DEFINE SERVICES
const db = firebase.firestore(); [cite_start]// [cite: 2]
let currentUserData = null; 

/**
 * MAIN ENTRY POINT: Load Reports
 * Call this function when the tab is opened.
 * @param {string} parentPhone - The parent's phone number to search for.
 * @param {string} userId - The parent's Firebase UID (optional, for caching).
 * @param {boolean} forceRefresh - Bypass cache if true.
 */
async function loadProgressReports(parentPhone, userId, forceRefresh = false) {
    const reportContent = document.getElementById("reportContent");
    const loader = document.getElementById("reportLoader");
    
    // Safety check for UI elements
    if (!reportContent || !loader) {
        console.error("Critical Error: Missing #reportContent or #reportLoader in HTML");
        return;
    }

    loader.classList.remove("hidden");
    reportContent.innerHTML = ""; 

    try {
        console.log(`🔍 Starting Report Search for: ${parentPhone}`);

        // Perform Search
        const searchResults = await performMultiLayerSearch(parentPhone, null, userId);
        const { assessmentResults, monthlyResults } = searchResults;

        // Handle No Results
        if (assessmentResults.length === 0 && monthlyResults.length === 0) {
            renderEmptyState(reportContent);
            return;
        }

        // Process & Render
        const studentsMap = groupReportsByStudent(assessmentResults, monthlyResults);
        renderStudentReports(studentsMap, reportContent);

    } catch (error) {
        console.error("Error loading reports:", error);
        reportContent.innerHTML = `<div class="text-red-500 text-center p-4">Error loading reports: ${error.message}</div>`;
    } finally {
        loader.classList.add("hidden");
    }
}

// --- CORE RENDERING LOGIC ---

function groupReportsByStudent(assessments, monthly) {
    const map = new Map();
    
    const initStudent = (name) => {
        if (!map.has(name)) map.set(name, { assessments: [], monthly: [] });
    };

    assessments.forEach(r => {
        initStudent(r.studentName);
        map.get(r.studentName).assessments.push(r);
    });

    monthly.forEach(r => {
        initStudent(r.studentName);
        map.get(r.studentName).monthly.push(r);
    });

    return map;
}

function renderStudentReports(studentsMap, container) {
    let studentIndex = 0;

    for (const [studentName, data] of studentsMap) {
        const fullName = capitalize(studentName);

        [cite_start]// Student Header [cite: 404]
        container.innerHTML += `
            <div class="bg-green-100 border-l-4 border-green-600 p-4 rounded-lg mb-6 mt-8">
                <h2 class="text-xl font-bold text-green-800">${fullName}</h2>
                <p class="text-green-600">Student Record</p>
            </div>
        `;

        // Render Assessments
        if (data.assessments.length > 0) {
            renderAssessments(data.assessments, container, studentIndex, fullName);
        }

        // Render Monthly Reports
        if (data.monthly.length > 0) {
            renderMonthlyReports(data.monthly, container, studentIndex, fullName);
        }

        studentIndex++;
    }
}

function renderAssessments(assessments, container, studentIndex, studentName) {
    // Group assessments by session (date)
    const sessions = new Map();
    assessments.forEach(res => {
        const key = Math.floor(res.timestamp / 86400); 
        if (!sessions.has(key)) sessions.set(key, []);
        sessions.get(key).push(res);
    });

    let sessionIndex = 0;
    for (const [_, session] of sessions) {
        const meta = session[0];
        const dateStr = new Date(meta.timestamp * 1000).toLocaleDateString();
        
        // Calculate Scores
        const results = session.map(t => ({
            subject: t.subject,
            correct: t.score || 0,
            total: t.totalScoreableQuestions || 0,
            topics: t.answers?.map(a => a.topic).filter(Boolean) || []
        }));

        const recommendation = generateTemplatedRecommendation(studentName, "The Tutor", results);

        [cite_start]// HTML Template [cite: 420]
        const html = `
            <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${sessionIndex}">
                <div class="flex justify-between border-b pb-4 mb-4">
                    <div>
                        <h3 class="text-lg font-bold text-green-800">Assessment Report</h3>
                        <p class="text-sm text-gray-500">${dateStr}</p>
                    </div>
                    <div class="text-right">
                        <span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Grade: ${meta.grade}</span>
                    </div>
                </div>

                <table class="w-full text-sm mb-4 border border-collapse">
                    <thead class="bg-gray-50"><tr><th class="border p-2 text-left">Subject</th><th class="border p-2 text-center">Score</th></tr></thead>
                    <tbody>
                        ${results.map(r => `<tr><td class="border p-2">${r.subject.toUpperCase()}</td><td class="border p-2 text-center font-bold">${r.correct}/${r.total}</td></tr>`).join('')}
                    </tbody>
                </table>

                <div class="bg-gray-50 p-4 rounded mb-4">
                    <h4 class="font-semibold text-green-700 text-sm mb-2">Tutor's Recommendation</h4>
                    <p class="text-sm text-gray-700 leading-relaxed">${recommendation}</p>
                </div>

                <div class="h-48 w-full mb-4">
                    <canvas id="chart-${studentIndex}-${sessionIndex}"></canvas>
                </div>

                <div class="text-center mt-4">
                    <button onclick="downloadSessionReport(${studentIndex}, ${sessionIndex}, '${studentName}', 'assessment')" class="text-green-600 hover:underline text-sm font-semibold">
                        ⬇ Download PDF
                    </button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', html);
        initChart(`chart-${studentIndex}-${sessionIndex}`, results);
        sessionIndex++;
    }
}

function renderMonthlyReports(reports, container, studentIndex, studentName) {
    let reportIndex = 0;
    reports.forEach(report => {
        const dateStr = new Date(report.timestamp * 1000).toLocaleDateString();

        const html = `
            <div class="border rounded-lg shadow mb-8 p-6 bg-white relative overflow-hidden" id="monthly-block-${studentIndex}-${reportIndex}">
                <div class="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                <div class="pl-4">
                    <h3 class="text-lg font-bold text-blue-800 mb-1">Monthly Learning Report</h3>
                    <p class="text-sm text-gray-500 mb-4">${dateStr}</p>
                    
                    ${renderSection("Progress & Achievements", report.progress)}
                    ${renderSection("Topics Covered", report.topics)}
                    ${renderSection("Tutor's Comments", report.generalComments)}

                    <div class="text-center mt-6 border-t pt-4">
                        <button onclick="downloadMonthlyReport(${studentIndex}, ${reportIndex}, '${studentName}')" class="text-blue-600 hover:underline text-sm font-semibold">
                            ⬇ Download Monthly Report PDF
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
        reportIndex++;
    });
}

// --- HELPER FUNCTIONS ---

function initChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (ctx && typeof Chart !== 'undefined') {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(r => r.subject.toUpperCase()),
                datasets: [
                    { label: 'Correct', data: data.map(s => s.correct), backgroundColor: '#4CAF50' },
                    { label: 'Missed', data: data.map(s => s.total - s.correct), backgroundColor: '#FFCD56' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
            }
        });
    }
}

function renderSection(title, content) {
    if (!content) return '';
    return `
        <div class="mb-4">
            <h4 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">${title}</h4>
            <p class="text-sm text-gray-600 whitespace-pre-wrap">${content}</p>
        </div>
    `;
}

function renderEmptyState(container) {
    container.innerHTML = `
        <div class="text-center py-16 bg-gray-50 rounded-lg">
            <div class="text-5xl mb-4">📊</div>
            <h3 class="text-xl font-bold text-gray-700">No Reports Found</h3>
            <p class="text-gray-500 max-w-md mx-auto mt-2">
                We couldn't find any assessment or monthly reports linked to this phone number. 
            </p>
        </div>
    `;
}

// --- EXPORT FUNCTIONALITY ---

window.downloadSessionReport = function(sIdx, rIdx, name, type) {
    const element = document.getElementById(`${type}-block-${sIdx}-${rIdx}`);
    if (typeof html2pdf === 'undefined') {
        alert("PDF generator library not loaded. Please refresh.");
        return;
    }
    const opt = { 
        margin: 0.5, 
        filename: `${name}_${type}_Report.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2 }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
    };
    html2pdf().from(element).set(opt).save();
};

window.downloadMonthlyReport = function(sIdx, rIdx, name) {
    downloadSessionReport(sIdx, rIdx, name, 'monthly');
};

function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [];
    results.forEach(r => {
        if ((r.correct / r.total) >= 0.75) strengths.push(r.subject);
    });
    
    if (strengths.length > 0) {
        return `Great job! ${studentName} showed strong understanding in ${strengths.join(', ')}. We will continue to build on these results.`;
    }
    return `${studentName} is making progress. We will focus on building confidence in the upcoming sessions.`;
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ""; }

// --- SEARCH LOGIC (SIMPLIFIED FOR STANDALONE) ---
// Note: This relies on the 'normalizedParentPhone' field existing in your DB
async function performMultiLayerSearch(phone, email, uid) {
    const results = { assessmentResults: [], monthlyResults: [] };
    
    // Clean phone input
    const cleanPhone = phone.replace(/[^\d+]/g, '');

    try {
        // 1. Assessment Search
        const assessSnap = await db.collection("student_results")
            .where("normalizedParentPhone", "==", cleanPhone)
            .get();
        
        assessSnap.forEach(doc => {
            results.assessmentResults.push({ id: doc.id, ...doc.data(), timestamp: doc.data().submittedAt?.seconds });
        });

        // 2. Monthly Search
        const monthSnap = await db.collection("tutor_submissions")
            .where("normalizedParentPhone", "==", cleanPhone)
            .get();
            
        monthSnap.forEach(doc => {
            results.monthlyResults.push({ id: doc.id, ...doc.data(), timestamp: doc.data().submittedAt?.seconds });
        });
    } catch (e) {
        console.error("Search failed:", e);
    }

    return results;
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Button Listener
    const btn = document.getElementById('manualRefreshBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            // REPLACE THIS WITH HOW YOU GET THE PHONE NUMBER IN YOUR APP
            // Example: const phone = document.getElementById('phoneInput').value;
            const phone = prompt("Enter parent phone number (e.g., +234...)");
            if (phone) loadProgressReports(phone, null, true);
        });
    }
});
