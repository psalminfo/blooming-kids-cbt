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
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generates a unique, personalized recommendation using a smart template.
 * It summarizes performance instead of just listing topics.
 * @param {string} studentName The name of the student.
 * @param {string} tutorName The name of the tutor.
 * @param {Array} results The student's test results.
 * @returns {string} A personalized recommendation string.
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

/**
 * Checks if the search name matches the stored name, allowing for extra names added by tutors
 * @param {string} storedName The name stored in the database
 * @param {string} searchName The name entered by the parent
 * @returns {boolean} True if names match (case insensitive and allows extra names)
 */
function nameMatches(storedName, searchName) {
    if (!storedName || !searchName) return false;
    
    const storedLower = storedName.toLowerCase().trim();
    const searchLower = searchName.toLowerCase().trim();
    
    // Exact match
    if (storedLower === searchLower) return true;
    
    // If stored name contains the search name (tutor added extra names)
    if (storedLower.includes(searchLower)) return true;
    
    // If search name contains the stored name (parent entered full name but stored has partial)
    if (searchLower.includes(storedLower)) return true;
    
    // Split into words and check if all search words are in stored name
    const searchWords = searchLower.split(/\s+/).filter(word => word.length > 1);
    const storedWords = storedLower.split(/\s+/);
    
    if (searchWords.length > 0) {
        return searchWords.every(word => storedWords.some(storedWord => storedWord.includes(word)));
    }
    
    return false;
}

async function loadReport() {
    // Add CSS for preserving whitespace dynamically
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

    const studentName = document.getElementById("studentName").value.trim();
    const parentPhone = document.getElementById("parentPhone").value.trim();

    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const loader = document.getElementById("loader");
    const generateBtn = document.getElementById("generateBtn");

    if (!studentName || !parentPhone) {
        alert("Please enter both the student's full name and the parent's phone number.");
        return;
    }
    
    // **NEW**: Caching logic starts here
    const CACHE_KEY = `report_${parentPhone}_${studentName.toLowerCase().replace(/\s/g, '')}`;
    const CACHE_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
            const { timestamp, html } = JSON.parse(cachedData);
            if (Date.now() - timestamp < CACHE_DURATION_MS) {
                console.log("Loading report from cache.");
                reportContent.innerHTML = html;
                document.getElementById("inputArea").classList.add("hidden");
                reportArea.classList.remove("hidden");
                document.getElementById("logoutArea").style.display = "flex";
                
                // Re-initialize charts if any exist from cached HTML
                // Note: Chart.js needs to be re-run on cached content. 
                // This simplified version assumes the visual HTML is sufficient for cached views.
                // For fully interactive charts on cached data, a more complex re-initialization would be needed.
                return; 
            }
        }
    } catch (e) {
        console.error("Could not read from cache:", e);
    }
    // Caching logic ends here

    loader.classList.remove("hidden");
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";

    try {
        // **OPTIMIZED**: Query by phone number first
        const studentsQuery = await db.collection("students")
                                      .where("parentPhone", "==", parentPhone)
                                      .get();
        
        let potentialStudents = [];
        studentsQuery.forEach(doc => {
            potentialStudents.push(doc.data());
        });

        if (potentialStudents.length === 0) {
            alert(`No student records found for the phone number: ${parentPhone}.\n\nPlease check the number or contact support if the issue persists.`);
            loader.classList.add("hidden");
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate Report";
            return;
        }

        // Now, filter the small list of students by the entered name
        const matchingStudents = potentialStudents.filter(student => nameMatches(student.studentName, studentName));

        if (matchingStudents.length === 0) {
            let errorMessage = `We found records for phone number ${parentPhone}, but none matched the student name "${studentName}".\n\nRegistered names for this number are:\n`;
            potentialStudents.forEach(student => {
                errorMessage += `• ${student.studentName}\n`;
            });
            errorMessage += `\nPlease check the spelling of the student's name.`;
            alert(errorMessage);
            loader.classList.add("hidden");
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate Report";
            return;
        }

        // **OPTIMIZED**: Fetch reports only for the specified phone number
        const studentResults = [];
        const monthlyReports = [];
        const matchedStudentName = matchingStudents[0].studentName; // Use the primary matched name for report filtering

        // Get assessment reports
        const assessmentQuery = await db.collection("student_results")
                                        .where("parentPhone", "==", parentPhone)
                                        .get();
        assessmentQuery.forEach(doc => {
            const data = doc.data();
            // Further filter by name to handle multiple children with same phone
            if (nameMatches(data.studentName, matchedStudentName)) {
                studentResults.push({ 
                    id: doc.id,
                    ...data,
                    timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                    type: 'assessment'
                });
            }
        });

        // Get monthly reports
        const monthlyQuery = await db.collection("tutor_submissions")
                                     .where("parentPhone", "==", parentPhone)
                                     .get();
        monthlyQuery.forEach(doc => {
            const data = doc.data();
            // Further filter by name
            if (nameMatches(data.studentName, matchedStudentName)) {
                monthlyReports.push({ 
                    id: doc.id,
                    ...data,
                    timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                    type: 'monthly'
                });
            }
        });

        if (studentResults.length === 0 && monthlyReports.length === 0) {
            alert(`No reports found for student: ${studentName}\n\nReports may not have been submitted yet.`);
            loader.classList.add("hidden");
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate Report";
            return;
        }

        reportContent.innerHTML = "";
        
        // Display Assessment Reports (Logic remains unchanged)
        if (studentResults.length > 0) {
            const groupedAssessments = {};
            studentResults.forEach((result) => {
                const sessionKey = Math.floor(result.timestamp / 86400); 
                if (!groupedAssessments[sessionKey]) groupedAssessments[sessionKey] = [];
                groupedAssessments[sessionKey].push(result);
            });

            let assessmentIndex = 0;
            for (const key in groupedAssessments) {
                const session = groupedAssessments[key];
                const tutorEmail = session[0].tutorEmail || 'N/A';
                const studentCountry = session[0].studentCountry || 'N/A';
                const fullName = capitalize(session[0].studentName);
                const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                });

                let tutorName = 'N/A';
                if (tutorEmail && tutorEmail !== 'N/A') {
                    try {
                        const tutorDoc = await db.collection("tutors").doc(tutorEmail).get();
                        if (tutorDoc.exists) {
                            tutorName = tutorDoc.data().name;
                        }
                    } catch (error) {
                        // Silent fail - tutor name will remain 'N/A'
                    }
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

                const assessmentBlock = `
                    <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${assessmentIndex}">
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
                                <p><strong>Parent's Phone:</strong> ${session[0].parentPhone || 'N/A'}</p>
                                <p><strong>Grade:</strong> ${session[0].grade}</p>
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
                        <canvas id="chart-${assessmentIndex}" class="w-full h-48 mb-4"></canvas>
                        ` : ''}
                        
                        <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                            <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                            <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                        </div>
                        
                        <div class="mt-6 text-center">
                            <button onclick="downloadSessionReport(${assessmentIndex}, '${fullName}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                Download Assessment PDF
                            </button>
                        </div>
                    </div>
                `;

                reportContent.innerHTML += assessmentBlock;

                // Create chart for assessment results only if there are results
                if (results.length > 0) {
                    const ctx = document.getElementById(`chart-${assessmentIndex}`);
                    if (ctx) {
                        const subjectLabels = results.map(r => r.subject.toUpperCase());
                        const correctScores = results.map(s => s.correct);
                        const incorrectScores = results.map(s => s.total - s.correct);

                        new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: subjectLabels,
                                datasets: [{ label: 'Correct Answers', data: correctScores, backgroundColor: '#4CAF50' }, { label: 'Incorrect/Unanswered', data: incorrectScores, backgroundColor: '#FFCD56' }]
                            },
                            options: {
                                responsive: true,
                                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                                plugins: { title: { display: true, text: 'Score Distribution by Subject' } }
                            }
                        });
                    }
                }

                assessmentIndex++;
            }
        }

        // Display Monthly Reports (Logic remains unchanged)
        if (monthlyReports.length > 0) {
            const groupedMonthly = {};
            monthlyReports.forEach((result) => {
                const sessionKey = Math.floor(result.timestamp / 86400); 
                if (!groupedMonthly[sessionKey]) groupedMonthly[sessionKey] = [];
                groupedMonthly[sessionKey].push(result);
            });

            let monthlyIndex = 0;
            for (const key in groupedMonthly) {
                const session = groupedMonthly[key];
                const fullName = capitalize(session[0].studentName);
                const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                });

                session.forEach((monthlyReport, reportIndex) => {
                    const monthlyBlock = `
                        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${monthlyIndex}">
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
                                <button onclick="downloadMonthlyReport(${monthlyIndex}, '${fullName}')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                    Download Monthly Report PDF
                                </button>
                            </div>
                        </div>
                    `;

                    reportContent.innerHTML += monthlyBlock;
                    monthlyIndex++;
                });
            }
        }

        // **NEW**: Save the generated report to the cache
        try {
            const cachePayload = {
                timestamp: Date.now(),
                html: reportContent.innerHTML
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
            console.log("Report has been cached.");
        } catch (e) {
            console.error("Could not write to cache:", e);
        }

        document.getElementById("inputArea").classList.add("hidden");
        reportArea.classList.remove("hidden");
        document.getElementById("logoutArea").style.display = "flex";

    } catch (error) {
        console.error("Error generating report:", error); // Log the full error for debugging
        alert("Sorry, there was an error generating the report. Please try again.");
    } finally {
        loader.classList.add("hidden");
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Report";
    }
}

function downloadSessionReport(index, studentName, type) {
    const element = document.getElementById(`${type}-block-${index}`);
    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().from(element).set(opt).save();
}

function downloadMonthlyReport(index, studentName) {
    downloadSessionReport(index, studentName, 'monthly');
}

function logout() {
    // **NEW**: Clear cache on logout if desired, to ensure fresh data on next login
    // This is optional. You can remove the loop if you want cache to persist across logouts.
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('report_')) {
            localStorage.removeItem(key);
        }
    });
    window.location.href = "parent.html";
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Check if we have URL parameters (coming from login)
    const urlParams = new URLSearchParams(window.location.search);
    const studentFromUrl = urlParams.get('student');
    const phoneFromUrl = urlParams.get('phone');
    
    if (studentFromUrl && phoneFromUrl) {
        document.getElementById('studentName').value = studentFromUrl;
        document.getElementById('parentPhone').value = phoneFromUrl;
    }
    
    document.getElementById("generateBtn").addEventListener("click", loadReport);
});
