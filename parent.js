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
const auth = firebase.auth();

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

function normalizePhone(phone) {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('234')) {
        digits = '0' + digits.slice(3);
    }
    return digits;
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

async function loadReports(phone) {
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

    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const loader = document.getElementById("loader");

    loader.classList.remove("hidden");

    // --- CACHE IMPLEMENTATION ---
    const cacheKey = `reportCache_${phone}`;
    const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
    try {
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
            const { timestamp, html, chartConfigs } = JSON.parse(cachedItem);
            if (Date.now() - timestamp < twoWeeksInMillis) {
                console.log("Loading report from cache.");
                reportContent.innerHTML = html;
                
                // Re-initialize charts from cached configuration
                if (chartConfigs && chartConfigs.length > 0) {
                    setTimeout(() => {
                        chartConfigs.forEach(chart => {
                            const ctx = document.getElementById(chart.canvasId);
                            if (ctx) new Chart(ctx, chart.config);
                        });
                    }, 0);
                }

                return; // Stop execution since we loaded from cache
            }
        }
    } catch (e) {
        console.error("Could not read from cache:", e);
        localStorage.removeItem(cacheKey); // Clear corrupted cache
    }
    // --- END CACHE IMPLEMENTATION ---

    try {
        // --- HIGHLY OPTIMIZED READS ---
        const assessmentQuery = db.collection("student_results").where("parentPhone", "==", phone).get();
        const monthlyQuery = db.collection("tutor_submissions").where("parentPhone", "==", phone).get();
        
        const [assessmentSnapshot, monthlySnapshot] = await Promise.all([assessmentQuery, monthlyQuery]);

        const allAssessments = [];
        assessmentSnapshot.forEach(doc => {
            const data = doc.data();
            allAssessments.push({ 
                id: doc.id,
                ...data,
                studentName: capitalize(data.studentName),
                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                type: 'assessment'
            });
        });

        const allMonthlies = [];
        monthlySnapshot.forEach(doc => {
            const data = doc.data();
            allMonthlies.push({ 
                id: doc.id,
                ...data,
                studentName: capitalize(data.studentName),
                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                type: 'monthly'
            });
        });

        if (allAssessments.length === 0 && allMonthlies.length === 0) {
            alert("BKH says: No reports found for your children.");
            return;
        }

        reportContent.innerHTML = "";
        const chartConfigsToCache = []; // To store chart data for caching

        // Group by child
        const childGroups = {};
        allAssessments.forEach(res => {
            const name = res.studentName;
            if (!childGroups[name]) childGroups[name] = {assessments: [], monthlies: []};
            childGroups[name].assessments.push(res);
        });
        allMonthlies.forEach(res => {
            const name = res.studentName;
            if (!childGroups[name]) childGroups[name] = {assessments: [], monthlies: []};
            childGroups[name].monthlies.push(res);
        });

        const children = Object.keys(childGroups).sort();

        let assessmentGlobalIndex = 0;
        let monthlyGlobalIndex = 0;

        for (const child of children) {
            reportContent.innerHTML += `<h2 class="text-3xl font-bold text-green-800 mb-6 text-center">Reports for ${child}</h2>`;

            const {assessments, monthlies} = childGroups[child];

            // Display Assessment Reports
            if (assessments.length > 0) {
                const groupedAssessments = {};
                assessments.forEach((result) => {
                    const sessionKey = Math.floor(result.timestamp / 86400); 
                    if (!groupedAssessments[sessionKey]) groupedAssessments[sessionKey] = [];
                    groupedAssessments[sessionKey].push(result);
                });

                for (const key in groupedAssessments) {
                    const session = groupedAssessments[key];
                    const tutorEmail = session[0].tutorEmail || 'N/A';
                    const studentCountry = session[0].studentCountry || 'N/A';
                    const fullName = session[0].studentName;
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
                        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${assessmentGlobalIndex}">
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
                            <canvas id="chart-${assessmentGlobalIndex}" class="w-full h-48 mb-4"></canvas>
                            ` : ''}
                            
                            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                                <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                            </div>
                            
                            <div class="mt-6 text-center">
                                <button onclick="downloadSessionReport(${assessmentGlobalIndex}, '${fullName}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                    Download Assessment PDF
                                </button>
                            </div>
                        </div>
                    `;

                    reportContent.innerHTML += assessmentBlock;

                    if (results.length > 0) {
                        const ctx = document.getElementById(`chart-${assessmentGlobalIndex}`);
                        if (ctx) {
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
                            new Chart(ctx, chartConfig);
                            chartConfigsToCache.push({ canvasId: `chart-${assessmentGlobalIndex}`, config: chartConfig });
                        }
                    }
                    assessmentGlobalIndex++;
                }
            }
            
            // Display Monthly Reports
            if (monthlies.length > 0) {
                const groupedMonthlies = {};
                monthlies.forEach((result) => {
                    const sessionKey = Math.floor(result.timestamp / 86400); 
                    if (!groupedMonthlies[sessionKey]) groupedMonthlies[sessionKey] = [];
                    groupedMonthlies[sessionKey].push(result);
                });

                for (const key in groupedMonthlies) {
                    const session = groupedMonthlies[key];
                    session.forEach((monthlyReport, subIndex) => {
                        const formattedDate = new Date(monthlyReport.timestamp * 1000).toLocaleString('en-US', {
                            dateStyle: 'long',
                            timeStyle: 'short'
                        });

                        const monthlyBlock = `
                            <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${monthlyGlobalIndex}">
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
                                    <button onclick="downloadSessionReport(${monthlyGlobalIndex}, '${monthlyReport.studentName}', 'monthly')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                        Download Monthly Report PDF
                                    </button>
                                </div>
                            </div>
                        `;
                        reportContent.innerHTML += monthlyBlock;
                        monthlyGlobalIndex++;
                    });
                }
            }
        }

        // --- CACHE SAVING LOGIC ---
        try {
            const dataToCache = {
                timestamp: Date.now(),
                html: reportContent.innerHTML,
                chartConfigs: chartConfigsToCache
            };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
            console.log("Report data cached successfully.");
        } catch (e) {
            console.error("Could not write to cache:", e);
        }
        // --- END CACHE SAVING ---

    } catch (error) {
        console.error("Error generating report:", error);
        alert("BKH says: Sorry, there was an error generating the report. Please try again.");
    } finally {
        loader.classList.add("hidden");
    }
}

function downloadSessionReport(index, studentName, type) {
    const element = document.getElementById(`${type}-block-${index}`);
    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().from(element).set(opt).save();
}

function logout() {
    auth.signOut();
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    const signinBtn = document.getElementById('signinBtn');
    const signupBtn = document.getElementById('signupBtn');
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const signinFooter = document.getElementById('signinFooter');
    const signupFooter = document.getElementById('signupFooter');
    const loginButton = document.getElementById('loginButton');
    const signupButton = document.getElementById('signupButton');
    const forgotLink = document.getElementById('forgotLink');
    const forgotModal = document.getElementById('forgotModal');
    const resetButton = document.getElementById('resetButton');
    const closeModal = document.getElementById('closeModal');
    const loader = document.getElementById('loader');
    const reportArea = document.getElementById('reportArea');
    const authArea = document.getElementById('authArea');
    const logoutArea = document.getElementById('logoutArea');
    const reportContent = document.getElementById('reportContent');

    signinBtn.addEventListener('click', () => {
        signinForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        signinFooter.classList.remove('hidden');
        signupFooter.classList.add('hidden');
        signinBtn.classList.add('bg-green-600', 'text-white');
        signinBtn.classList.remove('bg-gray-300', 'text-gray-800');
        signupBtn.classList.add('bg-gray-300', 'text-gray-800');
        signupBtn.classList.remove('bg-green-600', 'text-white');
    });

    signupBtn.addEventListener('click', () => {
        signupForm.classList.remove('hidden');
        signinForm.classList.add('hidden');
        signupFooter.classList.remove('hidden');
        signinFooter.classList.add('hidden');
        signupBtn.classList.add('bg-green-600', 'text-white');
        signupBtn.classList.remove('bg-gray-300', 'text-gray-800');
        signinBtn.classList.add('bg-gray-300', 'text-gray-800');
        signinBtn.classList.remove('bg-green-600', 'text-white');
    });

    loginButton.addEventListener('click', async () => {
        const loginId = document.getElementById('loginId').value.trim();
        const pw = document.getElementById('loginPw').value;
        if (!loginId || !pw) {
            alert('BKH says: Please enter both phone/email and password.');
            return;
        }
        loader.classList.remove('hidden');
        try {
            let email;
            if (loginId.includes('@')) {
                email = loginId;
            } else {
                const normPhone = normalizePhone(loginId);
                await auth.signInAnonymously();
                const querySnap = await db.collection('parents').where('phone', '==', normPhone).get();
                await auth.signOut();
                if (querySnap.empty) {
                    throw new Error('No account found with this phone number.');
                }
                if (querySnap.size > 1) {
                    throw new Error('Multiple accounts found. Please use email to login.');
                }
                email = querySnap.docs[0].data().email;
            }
            await auth.signInWithEmailAndPassword(email, pw);
        } catch (e) {
            alert(`BKH says: ${e.message || 'Login failed. Please check your credentials.'}`);
        } finally {
            loader.classList.add('hidden');
        }
    });

    signupButton.addEventListener('click', async () => {
        const phone = document.getElementById('signupPhone').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const pw = document.getElementById('signupPw').value;
        const confirm = document.getElementById('confirmPw').value;
        if (pw !== confirm) {
            alert('BKH says: Passwords do not match.');
            return;
        }
        if (pw.length < 6) {
            alert('BKH says: Password must be at least 6 characters.');
            return;
        }
        if (!phone || !email) {
            alert('BKH says: Please enter phone, email, and password.');
            return;
        }
        const normPhone = normalizePhone(phone);
        loader.classList.remove('hidden');
        try {
            await auth.signInAnonymously();
            const phoneSnap = await db.collection('parents').where('phone', '==', normPhone).get();
            await auth.signOut();
            if (!phoneSnap.empty) {
                throw new Error('This phone number is already registered.');
            }
            const userCred = await auth.createUserWithEmailAndPassword(email, pw);
            await db.collection('parents').doc(userCred.user.uid).set({
                email: email,
                phone: normPhone
            });
        } catch (e) {
            alert(`BKH says: ${e.message || 'Sign up failed. Email may already be in use.'}`);
        } finally {
            loader.classList.add('hidden');
        }
    });

    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        forgotModal.classList.add('hidden');
    });

    resetButton.addEventListener('click', async () => {
        const resetEmail = document.getElementById('resetEmail').value.trim();
        if (!resetEmail) {
            alert('BKH says: Please enter your email.');
            return;
        }
        loader.classList.remove('hidden');
        try {
            await auth.sendPasswordResetEmail(resetEmail);
            alert('BKH says: Password reset link has been sent to your email.');
            forgotModal.classList.add('hidden');
        } catch (e) {
            alert(`BKH says: ${e.message || 'Failed to send reset link. Please check the email.'}`);
        } finally {
            loader.classList.add('hidden');
        }
    });

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            loader.classList.remove('hidden');
            try {
                const parentDoc = await db.collection('parents').doc(user.uid).get();
                if (!parentDoc.exists) {
                    throw new Error('Profile not found. Please sign up again.');
                }
                const phone = parentDoc.data().phone;
                await loadReports(phone);
                authArea.classList.add('hidden');
                reportArea.classList.remove('hidden');
                logoutArea.style.display = 'flex';
            } catch (e) {
                alert(`BKH says: Error loading profile: ${e.message}`);
                auth.signOut();
            } finally {
                loader.classList.add('hidden');
            }
        } else {
            authArea.classList.remove('hidden');
            reportArea.classList.add('hidden');
            logoutArea.style.display = 'none';
            reportContent.innerHTML = '';
        }
    });
});
