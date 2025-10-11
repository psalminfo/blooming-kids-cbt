// Firebase config for the 'bloomingkidsassessment' project
const firebaseConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- DOM ELEMENTS ---
const authArea = document.getElementById('authArea');
const reportArea = document.getElementById('reportArea');
const reportContent = document.getElementById('reportContent');
const logoutArea = document.getElementById('logoutArea');
const portalSubtitle = document.getElementById('portal-subtitle');
const authLoader = document.getElementById('authLoader');
const authMessage = document.getElementById('authMessage');

// --- TABS & FORMS ---
const signInTab = document.getElementById('signInTab');
const signUpTab = document.getElementById('signUpTab');
const signInForm = document.getElementById('signInForm');
const signUpForm = document.getElementById('signUpForm');
const logoutBtn = document.getElementById('logoutBtn');

// --- PASSWORD RESET MODAL ---
const passwordResetModal = document.getElementById('passwordResetModal');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const closeModalBtn = document.getElementById('closeModalBtn');
const sendResetLinkBtn = document.getElementById('sendResetLinkBtn');
const passwordResetForm = document.getElementById('passwordResetForm');
const resetEmailInput = document.getElementById('resetEmail');
const resetMessage = document.getElementById('resetMessage');


// --- UTILITY FUNCTIONS ---
function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Normalizes a phone number to the last 10 digits.
 * @param {string} phone The phone number in any format.
 * @returns {string} The normalized 10-digit phone number.
 */
function normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '').slice(-10);
}

/**
 * Displays a message in the authentication area.
 * @param {string} message The message text.
 * @param {boolean} isError True if the message is an error.
 */
function showAuthMessage(message, isError = false) {
    authMessage.textContent = message;
    authMessage.className = `text-center mt-4 p-3 rounded-lg ${isError ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
    authMessage.classList.remove('hidden');
}

// --- AUTHENTICATION LOGIC ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        authArea.classList.add('hidden');
        reportArea.classList.remove('hidden');
        logoutArea.classList.remove('hidden');
        portalSubtitle.textContent = `Welcome! Loading reports...`;
        loadAllReportsForUser(user);
    } else {
        // User is signed out
        authArea.classList.remove('hidden');
        reportArea.classList.add('hidden');
        logoutArea.classList.add('hidden');
        reportContent.innerHTML = ''; // Clear reports on logout
        portalSubtitle.textContent = "Secure Access to Your Child's Reports";
    }
});

/**
 * Handles the Sign Up process.
 * @param {Event} e The form submission event.
 */
async function handleSignUp(e) {
    e.preventDefault();
    authLoader.classList.remove('hidden');
    authMessage.classList.add('hidden');

    const phone = document.getElementById('signUpPhone').value;
    const email = document.getElementById('signUpEmail').value;
    const password = document.getElementById('signUpPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showAuthMessage("Passwords do not match.", true);
        authLoader.classList.add('hidden');
        return;
    }
    if (password.length < 6) {
        showAuthMessage("Password must be at least 6 characters long.", true);
        authLoader.classList.add('hidden');
        return;
    }

    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
        showAuthMessage("Please enter a valid phone number.", true);
        authLoader.classList.add('hidden');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        // Store user profile in Firestore
        await db.collection('users').doc(userCredential.user.uid).set({
            email: email,
            phone: phone,
            normalizedPhone: normalized,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Sign-in will be handled by onAuthStateChanged
    } catch (error) {
        showAuthMessage(error.message, true);
    } finally {
        authLoader.classList.add('hidden');
    }
}

/**
 * Handles the Sign In process with either email or phone.
 * @param {Event} e The form submission event.
 */
async function handleSignIn(e) {
    e.preventDefault();
    authLoader.classList.remove('hidden');
    authMessage.classList.add('hidden');

    const identifier = document.getElementById('signInIdentifier').value.trim();
    const password = document.getElementById('signInPassword').value;

    try {
        // Check if identifier is an email
        if (identifier.includes('@')) {
            await auth.signInWithEmailAndPassword(identifier, password);
        } else {
            // Identifier is a phone number, look up the email
            const normalized = normalizePhone(identifier);
            const usersRef = db.collection('users');
            const snapshot = await usersRef.where('normalizedPhone', '==', normalized).limit(1).get();

            if (snapshot.empty) {
                throw new Error("No account found with this phone number.");
            }
            const userDoc = snapshot.docs[0].data();
            await auth.signInWithEmailAndPassword(userDoc.email, password);
        }
    } catch (error) {
        showAuthMessage(error.message, true);
    } finally {
        authLoader.classList.add('hidden');
    }
}

/**
 * Handles the Password Reset process.
 */
async function handlePasswordReset() {
    sendResetLinkBtn.disabled = true;
    sendResetLinkBtn.textContent = 'Sending...';
    resetMessage.classList.add('hidden');
    
    const email = resetEmailInput.value;

    try {
        await auth.sendPasswordResetEmail(email, {
             url: window.location.href // Redirect back to this page after reset
        });
        resetMessage.textContent = "BKH says: Password reset link sent! Please check your email.";
        resetMessage.className = 'text-sm mt-3 text-green-700';
    } catch (error) {
        resetMessage.textContent = `BKH says: ${error.message}`;
        resetMessage.className = 'text-sm mt-3 text-red-700';
    } finally {
        resetMessage.classList.remove('hidden');
        sendResetLinkBtn.disabled = false;
        sendResetLinkBtn.textContent = 'Send Reset Link';
    }
}


/**
 * Signs the user out.
 */
function handleSignOut() {
    auth.signOut().catch(error => console.error("Sign out error", error));
}


// --- REPORT LOADING & DISPLAY ---

/**
 * Loads all reports associated with the logged-in parent's phone number.
 * @param {firebase.User} user The authenticated user object.
 */
async function loadAllReportsForUser(user) {
    reportContent.innerHTML = '<p class="text-center text-green-700">Fetching all your children\'s reports...</p>';

    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) throw new Error("User profile not found.");

        const { normalizedPhone } = userDoc.data();
        
        // Use last 10 digits for backward compatibility
        const phoneForQuery = normalizePhone(normalizedPhone);

        const assessmentQuery = db.collection("student_results").where("parentPhone", "==", phoneForQuery).get();
        const monthlyQuery = db.collection("tutor_submissions").where("parentPhone", "==", phoneForQuery).get();

        const [assessmentSnapshot, monthlySnapshot] = await Promise.all([assessmentQuery, monthlyQuery]);
        
        const allReports = [];
        assessmentSnapshot.forEach(doc => allReports.push({ ...doc.data(), type: 'assessment', id: doc.id }));
        monthlySnapshot.forEach(doc => allReports.push({ ...doc.data(), type: 'monthly', id: doc.id }));

        if (allReports.length === 0) {
            reportContent.innerHTML = '<p class="text-center text-gray-600">No reports found for the phone number associated with your account.</p>';
            return;
        }

        // Group reports by student name
        const reportsByStudent = allReports.reduce((acc, report) => {
            const studentName = capitalize(report.studentName || 'Unknown Student');
            if (!acc[studentName]) {
                acc[studentName] = [];
            }
            acc[studentName].push(report);
            return acc;
        }, {});

        portalSubtitle.textContent = `Viewing reports for ${Object.keys(reportsByStudent).length} student(s).`;
        reportContent.innerHTML = ''; // Clear loader

        let studentIndex = 0;
        for (const studentName in reportsByStudent) {
            const studentReports = reportsByStudent[studentName];
            studentReports.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)); // Sort by date descending
            
            const studentSection = document.createElement('div');
            studentSection.className = 'mb-12';
            studentSection.innerHTML = `<h2 class="text-3xl font-bold text-green-800 mb-4 border-b-2 border-green-200 pb-2">${studentName}</h2>`;
            
            for (const report of studentReports) {
                if (report.type === 'assessment') {
                     studentSection.innerHTML += await generateAssessmentHTML(report, `${studentIndex}-${report.id}`);
                } else if (report.type === 'monthly') {
                    studentSection.innerHTML += generateMonthlyHTML(report, `${studentIndex}-${report.id}`);
                }
            }
            reportContent.appendChild(studentSection);
            
            // Now that HTML is in the DOM, render charts
            for (const report of studentReports) {
                if (report.type === 'assessment' && report.score !== undefined) {
                     renderAssessmentChart(report, `${studentIndex}-${report.id}`);
                }
            }
            studentIndex++;
        }

    } catch (error) {
        console.error("Error loading reports:", error);
        reportContent.innerHTML = `<p class="text-center text-red-600">Error: Could not load reports. ${error.message}</p>`;
    }
}

async function generateAssessmentHTML(sessionData, uniqueId) {
    const tutorEmail = sessionData.tutorEmail || 'N/A';
    const fullName = capitalize(sessionData.studentName);
    const formattedDate = new Date((sessionData.submittedAt?.seconds || 0) * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    let tutorName = 'N/A';
    if (tutorEmail !== 'N/A') {
        try {
            const tutorDoc = await db.collection("tutors").doc(tutorEmail).get();
            if (tutorDoc.exists) tutorName = tutorDoc.data().name;
        } catch (e) { console.error("Could not fetch tutor name", e); }
    }
    
    // This part is complex because the original data has multiple docs per session
    // This new version assumes each assessment doc is its own report
    const results = [{
        subject: sessionData.subject,
        correct: sessionData.score || 0,
        total: sessionData.totalScoreableQuestions || 0,
        topics: [...new Set(sessionData.answers?.map(a => a.topic).filter(Boolean))]
    }];

    const tableRows = results.map(res => `<tr><td class="border px-2 py-1">${res.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td></tr>`).join("");
    const topicsTableRows = results.map(res => `<tr><td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td><td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td></tr>`).join("");

    const recommendation = generateTemplatedRecommendation(fullName, tutorName, results);
    const creativeWritingAnswer = sessionData.answers?.find(a => a.type === 'creative-writing');
    const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.';

    return `
        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${uniqueId}">
            <div class="text-center mb-6 border-b pb-4">
                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" alt="Logo" class="h-16 w-auto mx-auto mb-3">
                <h3 class="text-2xl font-bold text-green-800">Assessment Report</h3>
                <p class="text-gray-600">Date: ${formattedDate}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                <div>
                    <p><strong>Grade:</strong> ${sessionData.grade}</p>
                    <p><strong>Tutor:</strong> ${tutorName}</p>
                </div>
                <div>
                     <p><strong>Location:</strong> ${sessionData.studentCountry || 'N/A'}</p>
                </div>
            </div>
            <h4 class="text-lg font-semibold mt-4 mb-2 text-green-700">Performance Summary</h4>
            <table class="w-full text-sm mb-4 border border-collapse">
                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            <h4 class="text-lg font-semibold mt-4 mb-2 text-green-700">Knowledge & Skill Analysis</h4>
            <table class="w-full text-sm mb-4 border border-collapse">
                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr></thead>
                <tbody>${topicsTableRows}</tbody>
            </table>
            <h4 class="text-lg font-semibold mt-4 mb-2 text-green-700">Tutor's Recommendation</h4>
            <p class="mb-2 text-gray-700 leading-relaxed">${recommendation}</p>
            ${creativeWritingAnswer ? `<h4 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h4><p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${tutorReport}</p>` : ''}
            ${results.length > 0 ? `<canvas id="chart-${uniqueId}" class="w-full h-48 mb-4"></canvas>` : ''}
            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                <h4 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h4>
                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
            </div>
            <div class="mt-6 text-center">
                <button onclick="window.downloadReport('${uniqueId}', '${fullName}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    Download Assessment PDF
                </button>
            </div>
        </div>
    `;
}

function renderAssessmentChart(sessionData, uniqueId) {
    const ctx = document.getElementById(`chart-${uniqueId}`);
    if (!ctx) return;
    
    const results = [{
        subject: sessionData.subject,
        correct: sessionData.score || 0,
        total: sessionData.totalScoreableQuestions || 0
    }];

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: results.map(r => r.subject.toUpperCase()),
            datasets: [
                { label: 'Correct', data: results.map(s => s.correct), backgroundColor: '#4CAF50' },
                { label: 'Incorrect', data: results.map(s => s.total - s.correct), backgroundColor: '#FFCD56' }
            ]
        },
        options: {
            responsive: true,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
            plugins: { title: { display: true, text: 'Score Distribution' } }
        }
    });
}

function generateMonthlyHTML(report, uniqueId) {
     const formattedDate = new Date((report.submittedAt?.seconds || 0) * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
     const fullName = capitalize(report.studentName);

    return `
        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${uniqueId}">
            <div class="text-center mb-6 border-b pb-4">
                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" alt="Logo" class="h-16 w-auto mx-auto mb-3">
                <h3 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h3>
                <p class="text-gray-600">Date: ${formattedDate}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                <div>
                    <p><strong>Parent's Name:</strong> ${report.parentName || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${report.grade || 'N/A'}</p>
                </div>
                <div>
                    <p><strong>Tutor's Name:</strong> ${report.tutorName || 'N/A'}</p>
                </div>
            </div>
            ${Object.entries(report)
                .filter(([key, value]) => ['introduction', 'topics', 'progress', 'strengthsWeaknesses', 'recommendations', 'generalComments'].includes(key) && value)
                .map(([key, value]) => `
                    <div class="mb-6">
                        <h4 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">${key.replace(/([A-Z])/g, ' $1').toUpperCase()}</h4>
                        <p class="text-gray-700 leading-relaxed" style="white-space: pre-line;">${value}</p>
                    </div>
                `).join('')
            }
            <div class="text-right mt-8 pt-4 border-t">
                <p class="text-gray-600">Best regards,</p>
                <p class="font-semibold text-green-800">${report.tutorName || 'N/A'}</p>
            </div>
            <div class="mt-6 text-center">
                <button onclick="window.downloadReport('${uniqueId}', '${fullName}', 'monthly')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    Download Monthly Report PDF
                </button>
            </div>
        </div>
    `;
}

// --- PDF & MISC LOGIC (PRESERVED) ---

// Expose download function to global scope for the onclick attribute
window.downloadReport = function(uniqueId, studentName, type) {
    const element = document.getElementById(`${type}-block-${uniqueId}`);
    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${capitalize(type)}_Report_${safeStudentName}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().from(element).set(opt).save();
}

// Keep the templated recommendation logic
function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [], weaknesses = [];
    results.forEach(res => {
        const percentage = res.total > 0 ? (res.correct / res.total) * 100 : 0;
        const topicList = res.topics.length > 0 ? res.topics : [res.subject];
        if (percentage >= 75) strengths.push(...topicList);
        else if (percentage < 50) weaknesses.push(...topicList);
    });
    const [uniqueStrengths, uniqueWeaknesses] = [[...new Set(strengths)], [...new Set(weaknesses)]];
    let praiseClause = uniqueStrengths.length > 2 ? `It was great to see ${studentName} demonstrate a solid understanding of several key concepts, particularly in areas like ${uniqueStrengths[0]} and ${uniqueStrengths[1]}. `
        : uniqueStrengths.length > 0 ? `${studentName} showed strong potential, especially in the topic of ${uniqueStrengths.join(', ')}. `
        : `${studentName} has put in a commendable effort on this initial assessment. `;
    let improvementClause = uniqueWeaknesses.length > 2 ? `Our next step will be to focus on building more confidence in a few areas, such as ${uniqueWeaknesses[0]} and ${uniqueWeaknesses[1]}. `
        : uniqueWeaknesses.length > 0 ? `To continue this positive progress, our focus will be on the topic of ${uniqueWeaknesses.join(', ')}. `
        : "We will continue to build on these fantastic results and explore more advanced topics. ";
    return `${praiseClause}${improvementClause}With personalized support from their tutor, ${tutorName}, at Blooming Kids House, we are very confident that ${studentName} will master these skills and unlock their full potential.`;
}


// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    signInTab.addEventListener('click', () => {
        signInTab.classList.add('tab-active');
        signUpTab.classList.remove('tab-active');
        signInForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
        authMessage.classList.add('hidden');
    });

    signUpTab.addEventListener('click', () => {
        signUpTab.classList.add('tab-active');
        signInTab.classList.remove('tab-active');
        signUpForm.classList.remove('hidden');
        signInForm.classList.add('hidden');
        authMessage.classList.add('hidden');
    });

    // Form submissions
    signInForm.addEventListener('submit', handleSignIn);
    signUpForm.addEventListener('submit', handleSignUp);
    logoutBtn.addEventListener('click', handleSignOut);

    // Modal handling
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        passwordResetModal.classList.remove('hidden');
    });
    closeModalBtn.addEventListener('click', () => {
        passwordResetModal.classList.add('hidden');
        resetMessage.classList.add('hidden');
        passwordResetForm.reset();
    });
    sendResetLinkBtn.addEventListener('click', handlePasswordReset);
});
