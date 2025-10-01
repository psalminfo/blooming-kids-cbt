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

// Phone number normalization function - removes all non-digit characters
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    // Remove all non-digit characters: +, -, (, ), spaces, etc.
    return phone.replace(/\D/g, '');
}

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

async function loadReport() {
    const studentName = document.getElementById("studentName").value.trim().toLowerCase();
    const parentPhone = document.getElementById("parentPhone").value.trim();

    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const loader = document.getElementById("loader");
    const generateBtn = document.getElementById("generateBtn");

    if (!studentName || !parentPhone) {
        alert("Please enter both the student's full name and the parent's phone number.");
        return;
    }

    // Normalize the phone number - remove all formatting
    const normalizedPhone = normalizePhoneNumber(parentPhone);
    console.log("Original phone:", parentPhone, "Normalized:", normalizedPhone);

    if (!normalizedPhone) {
        alert("Please enter a valid phone number.");
        return;
    }

    loader.classList.remove("hidden");
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";

    try {
        // Fetch assessment reports from student_results collection
        const assessmentQuery = await db.collection("student_results")
            .where("parentPhone", "==", parentPhone)
            .get();

        // Also try with normalized phone number for assessment reports
        const assessmentQueryNormalized = await db.collection("student_results")
            .where("parentPhone", "==", normalizedPhone)
            .get();

        // Fetch monthly reports from tutor_submissions collection
        const monthlyQuery = await db.collection("tutor_submissions")
            .where("parentPhone", "==", parentPhone)
            .get();

        // Also try with normalized phone number for monthly reports
        const monthlyQueryNormalized = await db.collection("tutor_submissions")
            .where("parentPhone", "==", normalizedPhone)
            .get();

        const studentResults = [];
        const monthlyReports = [];

        // Process assessment reports (original format)
        assessmentQuery.forEach((doc) => {
            const data = doc.data();
            if (data.studentName && data.studentName.toLowerCase() === studentName) {
                studentResults.push({ ...data,
                    timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                    type: 'assessment'
                });
            }
        });

        // Process assessment reports (normalized format)
        assessmentQueryNormalized.forEach((doc) => {
            const data = doc.data();
            if (data.studentName && data.studentName.toLowerCase() === studentName) {
                // Check if we already have this record to avoid duplicates
                const existing = studentResults.find(r => r.id === doc.id);
                if (!existing) {
                    studentResults.push({ ...data,
                        timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                        type: 'assessment'
                    });
                }
            }
        });

        // Process monthly reports (original format)
        monthlyQuery.forEach((doc) => {
            const data = doc.data();
            if (data.studentName && data.studentName.toLowerCase() === studentName) {
                monthlyReports.push({ ...data,
                    timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                    type: 'monthly'
                });
            }
        });

        // Process monthly reports (normalized format)
        monthlyQueryNormalized.forEach((doc) => {
            const data = doc.data();
            if (data.studentName && data.studentName.toLowerCase() === studentName) {
                // Check if we already have this record to avoid duplicates
                const existing = monthlyReports.find(r => r.id === doc.id);
                if (!existing) {
                    monthlyReports.push({ ...data,
                        timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                        type: 'monthly'
                    });
                }
            }
        });

        if (studentResults.length === 0 && monthlyReports.length === 0) {
            alert("No records found. Please check the student name and phone number.");
            loader.classList.add("hidden");
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate Report";
            return;
        }

        reportContent.innerHTML = "";
        
        // Display Assessment Reports (Original Design)
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
                    const tutorDoc = await db.collection("tutors").doc(tutorEmail).get();
                    if (tutorDoc.exists) {
                        tutorName = tutorDoc.data().name;
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
                        <!-- Logo Header -->
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
                                <p><strong>Parent's Phone:</strong> ${parentPhone}</p>
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

                        <canvas id="chart-${assessmentIndex}" class="w-full h-48 mb-4"></canvas>
                        
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

                // Create chart for assessment results
                const ctx = document.getElementById(`chart-${assessmentIndex}`).getContext('2d');
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

                assessmentIndex++;
            }
        }

        // Display Monthly Reports (Professional Design)
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
                            <!-- Logo Header -->
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
                                <p class="text-gray-700 leading-relaxed">${monthlyReport.introduction}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.topics ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3>
                                <p class="text-gray-700 leading-relaxed">${monthlyReport.topics}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.progress ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3>
                                <p class="text-gray-700 leading-relaxed">${monthlyReport.progress}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.strengthsWeaknesses ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3>
                                <p class="text-gray-700 leading-relaxed">${monthlyReport.strengthsWeaknesses}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.recommendations ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3>
                                <p class="text-gray-700 leading-relaxed">${monthlyReport.recommendations}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.generalComments ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3>
                                <p class="text-gray-700 leading-relaxed">${monthlyReport.generalComments}</p>
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

        document.getElementById("inputArea").classList.add("hidden");
        reportArea.classList.remove("hidden");
        document.getElementById("logoutArea").style.display = "flex";

    } catch (error) {
        console.error("Error generating report: ", error);
        alert("A critical error occurred while generating the report.");
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
