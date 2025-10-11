// Firebase config for the 'bloomingkidsassessment' project
// Uses Firebase V9 Compatibility for simple CDN loading
firebase.initializeApp({
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
});

const db = firebase.firestore();

// Constants
const REPORTS_COLLECTION = "student_results";
const MONTHLY_REPORTS_COLLECTION = "tutor_submissions";

// --- UTILITY FUNCTIONS ---

/**
 * Capitalizes the first letter of every word in a string.
 */
function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Normalizes the phone number: strips non-digits and returns the last 10 digits.
 * This is crucial for matching records in the database, regardless of the input format.
 * This ensures the phone number works exactly as intended by the original system.
 * @param {string} rawPhone The raw phone number input.
 * @returns {string} The normalized 10-digit string.
 */
function normalizePhone(rawPhone) {
    const digits = rawPhone.replace(/\D/g, ''); // Strip all non-digit characters
    return digits.slice(-10); // Return the last 10 digits
}

/**
 * Custom Toast/Message Handler (Replaces alert() and window.alert())
 */
function showToast(message, type = 'error', containerId = 'messageContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.textContent = message;
    container.classList.remove('hidden', 'bg-red-500', 'bg-green-600', 'bg-yellow-500', 'text-white');
    
    if (type === 'success') {
        container.classList.add('bg-green-600', 'text-white');
    } else if (type === 'error') {
        container.classList.add('bg-red-500', 'text-white');
    } else if (type === 'info') {
        container.classList.add('bg-yellow-500', 'text-white');
    }

    container.classList.remove('opacity-0');
    container.classList.add('opacity-100');
    
    setTimeout(() => {
        container.classList.remove('opacity-100');
        container.classList.add('opacity-0');
        setTimeout(() => container.classList.add('hidden'), 500); // Hide after fade
    }, 5000);
}

/**
 * Checks if the search name matches the stored name, allowing for slight variations.
 */
function nameMatches(storedName, searchName) {
    if (!storedName || !searchName) return false;
    
    const storedLower = storedName.toLowerCase().trim();
    const searchLower = searchName.toLowerCase().trim();
    
    // Check if the search name is a subset or superset of the stored name
    return storedLower.includes(searchLower) || searchLower.includes(storedLower);
}

/**
 * Generates a unique, personalized recommendation using a smart template.
 */
function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [];
    const weaknesses = [];
    results.forEach(res => {
        const percentage = res.total > 0 ? (res.correct / res.total) * 100 : 0;
        const topicList = res.topics.length > 0 ? res.topics : [res.subject];
        if (percentage >= 75) {
            strengths.push(...topicList);
        } else if (percentage < 50) {
            weaknesses.push(...topicList);
        }
    });

    const uniqueStrengths = [...new Set(strengths)];
    const uniqueWeaknesses = [...new Set(weaknesses)];

    let praiseClause = "";
    if (uniqueStrengths.length > 2) {
        praiseClause = `It was great to see ${studentName} demonstrate a solid understanding of several key concepts, particularly in areas like ${uniqueStrengths[0]} and ${uniqueStrengths[1]}. `;
    } else if (uniqueStrengths.length > 0) {
        praiseClause = `${studentName} showed strong potential, especially in the topic of ${uniqueStrengths.join(', ')}. `;
    } else {
        praiseClause = `${studentName} has put in a commendable effort on this initial assessment. `;
    }

    let improvementClause = "";
    if (uniqueWeaknesses.length > 2) {
        improvementClause = `Our next step will be to focus on building more confidence in a few areas, such as ${uniqueWeaknesses[0]} and ${uniqueWeaknesses[1]}. `;
    } else if (uniqueWeaknesses.length > 0) {
        improvementClause = `To continue this positive progress, our focus will be on the topic of ${uniqueWeaknesses.join(', ')}. `;
    } else {
        improvementClause = "We will continue to build on these fantastic results and explore more advanced topics. ";
    }

    const closingStatement = `With personalized support from their tutor, ${tutorName}, at Blooming Kids House, we are very confident that ${studentName} will master these skills and unlock their full potential.`;

    return praiseClause + improvementClause + closingStatement;
}

// --- CORE REPORT LOGIC ---

/**
 * Loads ALL children's reports associated with the provided normalized phone number.
 * This is the main function triggered by the user's form submission.
 */
async function loadReports(event) {
    event.preventDefault(); // Stop form submission
    
    const studentName = document.getElementById('studentName').value.trim();
    const rawPhone = document.getElementById('parentPhone').value.trim();
    const normalizedPhone = normalizePhone(rawPhone);

    const reportContent = document.getElementById("reportContent");
    const reportArea = document.getElementById("reportArea");
    const inputArea = document.getElementById("inputArea");
    const welcomeMessage = document.getElementById('welcomeMessage');
    const loader = document.getElementById("loader");
    const generateBtn = document.getElementById('generateBtn');

    reportContent.innerHTML = ''; 
    document.getElementById('messageContainer').classList.add('hidden'); // Clear previous messages

    if (!studentName || normalizedPhone.length < 10) {
        showToast("Please enter the student's name and a valid 10-digit phone number.", 'error');
        return;
    }

    loader.classList.remove("hidden");
    generateBtn.disabled = true;
    generateBtn.textContent = "Loading Reports...";
    
    // Add CSS for preserving whitespace dynamically (Important for report formatting)
    if (!document.querySelector('#whitespace-style')) {
        const style = document.createElement('style');
        style.id = 'whitespace-style';
        style.textContent = `
            .preserve-whitespace {
                white-space: pre-line !important;
                line-height: 1.6 !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // --- CACHE IMPLEMENTATION (for faster subsequent loads) ---
    const cacheKey = `reportCache_${studentName.toLowerCase()}_${normalizedPhone}`;
    const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
    try {
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
            const { timestamp, html, chartConfigs, parentName } = JSON.parse(cachedItem);
            if (Date.now() - timestamp < twoWeeksInMillis) {
                console.log("Loading report from cache.");
                reportContent.innerHTML = html;
                welcomeMessage.textContent = `Welcome Back, ${parentName}!`;

                // Re-initialize charts from cached configuration
                if (chartConfigs && chartConfigs.length > 0) {
                    // Use setTimeout to ensure DOM elements exist before initialization
                    setTimeout(() => { 
                         chartConfigs.forEach(chart => {
                            const ctx = document.getElementById(chart.canvasId);
                            if (ctx) new Chart(ctx, chart.config);
                        });
                    }, 0);
                }

                inputArea.classList.add("hidden");
                reportArea.classList.remove("hidden");
                loader.classList.add("hidden");
                generateBtn.disabled = false;
                generateBtn.textContent = "Generate Report";
                showToast("Reports loaded from cache!", 'info');
                return; 
            }
        }
    } catch (e) {
        console.error("Could not read from cache:", e);
        localStorage.removeItem(cacheKey); // Clear corrupted cache
    }
    // --- END CACHE IMPLEMENTATION ---


    try {
        // Step 1: Query both collections concurrently using the normalized phone number
        const assessmentQuery = db.collection(REPORTS_COLLECTION)
            .where("parentPhone", "==", normalizedPhone).get();
        
        const monthlyQuery = db.collection(MONTHLY_REPORTS_COLLECTION)
            .where("parentPhone", "==", normalizedPhone).get();
        
        const [assessmentSnapshot, monthlySnapshot] = await Promise.all([assessmentQuery, monthlyQuery]);

        // Step 2: Filter results by name on the client-side
        const studentResults = [];
        assessmentSnapshot.forEach(doc => {
            const data = doc.data();
            if (nameMatches(data.studentName, studentName)) {
                studentResults.push({ 
                    id: doc.id,
                    ...data,
                    timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                    type: 'assessment'
                });
            }
        });

        const monthlyReports = [];
        monthlySnapshot.forEach(doc => {
            const data = doc.data();
            if (nameMatches(data.studentName, studentName)) {
                monthlyReports.push({ 
                    id: doc.id,
                    ...data,
                    timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                    type: 'monthly'
                });
            }
        });

        // Step 3: Combine and sort all reports by timestamp (most recent first)
        const allReports = [...studentResults, ...monthlyReports].sort((a, b) => b.timestamp - a.timestamp);
        
        if (allReports.length === 0) {
            showToast(`No reports found for ${studentName} with that phone number.`, 'info');
            return;
        }

        // --- Core Logic: Extract Parent Name from the first available report (as requested) ---
        const firstReport = allReports[0];
        const extractedParentName = firstReport.parentName ? capitalize(firstReport.parentName) : 'Valued Parent'; 
        
        // Update the Welcome message using the name found in the report
        welcomeMessage.textContent = `Welcome Back, ${extractedParentName}!`;
        // --- End Name Extraction Logic ---

        // Step 4: Iterate through all reports to generate HTML
        const chartConfigsToCache = [];
        let reportHtml = '';
        let reportIndex = 0; // Use a single index for both types

        for (const report of allReports) {
            const fullName = capitalize(report.studentName);
            const formattedDate = new Date(report.timestamp * 1000).toLocaleString('en-US', {
                dateStyle: 'long',
                timeStyle: 'short'
            });
            
            const currentId = `${report.type}-block-${reportIndex}`;

            if (report.type === 'monthly') {
                // Monthly Report Generation
                const monthlyReport = report;
                
                const block = `
                    <div class="border rounded-xl shadow mb-8 p-6 bg-white transition-shadow duration-300 hover:shadow-lg" id="${currentId}">
                        <div class="text-center mb-6 border-b pb-4">
                            <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                                 alt="Blooming Kids House Logo" 
                                 class="h-16 w-auto mx-auto mb-3">
                            <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                            <p class="text-gray-600">Date: ${formattedDate}</p>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                            <div>
                                <p><strong>Student's Name:</strong> ${monthlyReport.studentName || 'N/A'}</p>
                                <p><strong>Parent's Name:</strong> ${monthlyReport.parentName || 'N/A'}</p>
                                <p><strong>Parent's Phone:</strong> ${monthlyReport.parentPhone || 'N/A'}</p>
                            </div>
                            <div>
                                <p><strong>Grade:</strong> ${monthlyReport.grade || 'N/A'}</p>
                                <p><strong>Tutor's Name:</strong> ${monthlyReport.tutorName || 'N/A'}</p>
                            </div>
                        </div>

                        ${monthlyReport.introduction ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">INTRODUCTION</h3>
                            <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.introduction}</p>
                        </div>
                        ` : ''}

                        ${monthlyReport.topics ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3>
                            <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.topics}</p>
                        </div>
                        ` : ''}

                        ${monthlyReport.progress ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3>
                            <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.progress}</p>
                        </div>
                        ` : ''}

                        ${monthlyReport.strengthsWeaknesses ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3>
                            <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.strengthsWeaknesses}</p>
                        </div>
                        ` : ''}

                        ${monthlyReport.recommendations ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3>
                            <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.recommendations}</p>
                        </div>
                        ` : ''}

                        ${monthlyReport.generalComments ? `
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3>
                            <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.generalComments}</p>
                        </div>
                        ` : ''}

                        <div class="text-right mt-8 pt-4 border-t">
                            <p class="text-gray-600">Best regards,</p>
                            <p class="font-semibold text-green-800">${monthlyReport.tutorName || 'N/A'}</p>
                        </div>

                        <div class="mt-6 text-center">
                            <button onclick="downloadSessionReport(${reportIndex}, '${fullName}', 'monthly')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold btn-glow hover:bg-green-700 transition-all duration-200">
                                Download Monthly Report PDF
                            </button>
                        </div>
                    </div>
                `;
                reportHtml += block;

            } else if (report.type === 'assessment') {
                // Assessment Report Generation
                const session = [report];
                const tutorEmail = report.tutorEmail || 'N/A';
                const studentCountry = report.studentCountry || 'N/A';
                
                // Tutor name handling (prioritize name in report, fall back to email lookup)
                let tutorName = report.tutorName || 'N/A'; 
                if (tutorEmail && tutorEmail !== 'N/A' && tutorName === 'N/A') {
                    try {
                        const tutorDoc = await db.collection("tutors").doc(tutorEmail).get();
                        if (tutorDoc.exists) {
                            tutorName = tutorDoc.data().name;
                        }
                    } catch (error) { /* Silent fail on lookup */ }
                }


                const results = session.map(testResult => {
                    const topics = [...new Set(testResult.answers?.map(a => a.topic).filter(t => t))] || [];
                    return {
                        subject: testResult.subject,
                        correct: testResult.score !== undefined ? testResult.score : 0,
                        total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0,
                        topics: topics,
                    };
                });

                const tableRows = results.map(res => `<tr><td class="border px-2 py-1">${res.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td></tr>`).join("");
                const topicsTableRows = results.map(res => `<tr><td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td><td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td></tr>`).join("");

                const recommendation = generateTemplatedRecommendation(fullName, tutorName, results);
                const creativeWritingAnswer = session[0].answers?.find(a => a.type === 'creative-writing');
                const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.';
                
                const block = `
                    <div class="border rounded-xl shadow mb-8 p-6 bg-white transition-shadow duration-300 hover:shadow-lg" id="${currentId}">
                        <div class="text-center mb-6 border-b pb-4">
                            <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                                 alt="Blooming Kids House Logo" 
                                 class="h-16 w-auto mx-auto mb-3">
                            <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                            <p class="text-gray-600">Date: ${formattedDate}</p>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                            <div>
                                <p><strong>Student's Name:</strong> ${fullName}</p>
                                <p><strong>Parent's Phone:</strong> ${report.parentPhone || 'N/A'}</p>
                                <p><strong>Grade:</strong> ${report.grade}</p>
                            </div>
                            <div>
                                <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
                                <p><strong>Location:</strong> ${studentCountry || 'N/A'}</p>
                            </div>
                        </div>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Performance Summary</h3>
                        <table class="w-full text-sm mb-4 border border-collapse">
                            <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Knowledge & Skill Analysis</h3>
                        <table class="w-full text-sm mb-4 border border-collapse">
                            <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr></thead>
                            <tbody>${topicsTableRows}</tbody>
                        </table>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Tutor's Recommendation</h3>
                        <p class="mb-2 text-gray-700 leading-relaxed">${recommendation}</p>

                        ${creativeWritingAnswer ? `
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3>
                        <p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${tutorReport}</p>
                        ` : ''}

                        ${results.length > 0 ? `
                        <canvas id="chart-${reportIndex}" class="w-full h-48 mb-4"></canvas>
                        ` : ''}
                        
                        <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                            <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                            <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                        </div>
                        
                        <div class="mt-6 text-center">
                            <button onclick="downloadSessionReport(${reportIndex}, '${fullName}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold btn-glow hover:bg-green-700 transition-all duration-200">
                                Download Assessment PDF
                            </button>
                        </div>
                    </div>
                `;

                reportHtml += block;
                
                // Chart generation
                if (results.length > 0) {
                    const chartConfig = {
                        type: 'bar',
                        data: {
                            labels: results.map(r => r.subject.toUpperCase()),
                            datasets: [
                                { label: 'Correct Answers', data: results.map(s => s.correct), backgroundColor: '#4CAF50' }, 
                                { label: 'Incorrect/Unanswered', data: results.map(s => s.total - s.correct), backgroundColor: '#FFCD56' }
                            ]
                        },
                        options: {
                            responsive: true,
                            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                            plugins: { title: { display: true, text: 'Score Distribution by Subject' } }
                        }
                    };
                    
                    chartConfigsToCache.push({ canvasId: `chart-${reportIndex}`, config: chartConfig });
                    // Initialize Chart after HTML is inserted
                    setTimeout(() => {
                        const ctx = document.getElementById(`chart-${reportIndex}`);
                        if (ctx) new Chart(ctx, chartConfig);
                    }, 0); 
                }
            }
            reportIndex++;
        }
        
        // Finalize HTML
        reportContent.innerHTML = reportHtml;

        // Save to cache after successful retrieval
        try {
            const dataToCache = {
                timestamp: Date.now(),
                html: reportContent.innerHTML,
                chartConfigs: chartConfigsToCache,
                parentName: extractedParentName
            };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
            console.log("Report data cached successfully.");
        } catch (e) {
            console.error("Could not write to cache:", e);
        }

        // Show the report area
        inputArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        showToast("Reports loaded successfully!", 'success');

    } catch (error) {
        console.error("CRITICAL ERROR loading reports:", error);
        showToast(`An error occurred while loading reports: ${error.message}.`, 'error');
    } finally {
        loader.classList.add("hidden");
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Report";
    }
}

/**
 * PDF Download functionality.
 */
function downloadSessionReport(index, studentName, type) {
    const elementId = `${type}-block-${index}`;
    const element = document.getElementById(elementId);
    
    if (!element) {
        showToast("Error: Could not find report content to download.", 'error');
        return;
    }

    // Temporarily clone and hide charts if they exist, or they might cause issues with html2pdf
    const charts = element.querySelectorAll('canvas');
    charts.forEach(canvas => canvas.style.display = 'none');

    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}_${index}.pdf`; 
    
    const opt = { 
        margin: 0.5, 
        filename: fileName, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
    };
    
    html2pdf().from(element).set(opt).save().then(() => {
        // Restore charts display after PDF generation is complete
        charts.forEach(canvas => canvas.style.display = 'block');
    });
}

/**
 * Function to handle page refresh/return to the input form.
 */
function logout() {
    window.location.reload(); 
}

// --- INITIALIZE PAGE ---

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('generateBtn').addEventListener('click', loadReports);
    
    // Create a container for messages (replacing alert())
    const messageDiv = document.createElement('div');
    messageDiv.id = 'messageContainer';
    messageDiv.className = 'hidden fixed top-4 right-4 p-4 rounded-xl shadow-xl text-white font-semibold z-50 transition-opacity duration-500 opacity-0';
    document.body.appendChild(messageDiv);

    // Expose functions globally for HTML buttons/events 
    window.loadReports = loadReports;
    window.downloadSessionReport = downloadSessionReport;
    window.logout = logout;
});
