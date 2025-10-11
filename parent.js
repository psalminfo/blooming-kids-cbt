// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM ELEMENT SELECTORS ---
const authArea = document.getElementById("authArea");
const reportArea = document.getElementById("reportArea");
const reportContent = document.getElementById("reportContent");
const logoutArea = document.getElementById("logoutArea");
const loader = document.getElementById("loader");

// Tabs
const signInTabBtn = document.getElementById("signInTabBtn");
const signUpTabBtn = document.getElementById("signUpTabBtn");

// Forms
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const passwordResetModal = document.getElementById("passwordResetModal");
const passwordResetForm = document.getElementById("passwordResetForm");

// Buttons
const logoutBtn = document.getElementById("logoutBtn");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const cancelResetBtn = document.getElementById("cancelResetBtn");

// Error/Success Messages
const signInError = document.getElementById("signInError");
const signUpError = document.getElementById("signUpError");
const resetSuccess = document.getElementById("resetSuccess");
const resetError = document.getElementById("resetError");

// --- HELPER FUNCTIONS ---
/**
 * Normalizes a phone number to the last 10 digits.
 * @param {string} phone - The phone number in any format.
 * @returns {string} The normalized 10-digit phone number.
 */
function normalizePhone(phone) {
    if (!phone) return "";
    const digitsOnly = phone.replace(/\D/g, "");
    return digitsOnly.slice(-10);
}

/**
 * Capitalizes the first letter of each word in a string.
 * @param {string} str - The input string.
 * @returns {string} The capitalized string.
 */
function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Toggles the visibility of UI elements.
 * @param {HTMLElement} el - The element to show/hide.
 * @param {boolean} show - True to show, false to hide.
 */
function toggleVisibility(el, show) {
    if (show) {
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
}

/**
 * Shows an error message in a specified element.
 * @param {HTMLElement} el - The error message element.
 * @param {string} message - The error message to display.
 */
function showFormError(el, message) {
    el.textContent = message;
    toggleVisibility(el, true);
}

// --- AUTHENTICATION LOGIC ---

/**
 * Handles the user sign-up process.
 */
async function handleSignUp(event) {
    event.preventDefault();
    toggleVisibility(loader, true);
    signUpError.classList.add('hidden');

    const email = document.getElementById("signUpEmail").value;
    const phone = document.getElementById("signUpPhone").value;
    const password = document.getElementById("signUpPassword").value;
    const confirmPassword = document.getElementById("signUpConfirmPassword").value;

    if (password !== confirmPassword) {
        showFormError(signUpError, "Passwords do not match.");
        toggleVisibility(loader, false);
        return;
    }
    if (password.length < 6) {
        showFormError(signUpError, "Password must be at least 6 characters long.");
        toggleVisibility(loader, false);
        return;
    }
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
        showFormError(signUpError, "Please enter a valid phone number.");
        toggleVisibility(loader, false);
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Store user profile with normalized phone for dual login
        await db.collection("users").doc(user.uid).set({
            email: user.email,
            normalizedPhone: normalized
        });

    } catch (error) {
        showFormError(signUpError, error.message);
    } finally {
        toggleVisibility(loader, false);
    }
}

/**
 * Handles the user sign-in process with either email or phone.
 */
async function handleSignIn(event) {
    event.preventDefault();
    toggleVisibility(loader, true);
    signInError.classList.add('hidden');

    const identifier = document.getElementById("signInIdentifier").value;
    const password = document.getElementById("signInPassword").value;

    try {
        let emailToSignIn = identifier;

        // If identifier is not an email, assume it's a phone number
        if (!identifier.includes('@')) {
            const normalized = normalizePhone(identifier);
            if (normalized.length !== 10) {
                throw new Error("Invalid phone number format.");
            }
            
            // Find the email associated with this phone number
            const querySnapshot = await db.collection("users").where("normalizedPhone", "==", normalized).limit(1).get();
            if (querySnapshot.empty) {
                throw new Error("No account found with this phone number.");
            }
            emailToSignIn = querySnapshot.docs[0].data().email;
        }

        await auth.signInWithEmailAndPassword(emailToSignIn, password);
    } catch (error) {
        showFormError(signInError, "BKH says: " + error.message);
    } finally {
        toggleVisibility(loader, false);
    }
}

/**
 * Handles the password reset process.
 */
async function handlePasswordReset(event) {
    event.preventDefault();
    toggleVisibility(loader, true);
    resetError.classList.add('hidden');
    resetSuccess.classList.add('hidden');
    const email = document.getElementById("resetEmail").value;
    
    try {
        await auth.sendPasswordResetEmail(email);
        resetSuccess.textContent = "BKH says: A password reset link has been sent to your email!";
        toggleVisibility(resetSuccess, true);
        passwordResetForm.reset();
    } catch (error) {
        resetError.textContent = "BKH says: " + error.message;
        toggleVisibility(resetError, true);
    } finally {
        toggleVisibility(loader, false);
    }
}

/**
 * Handles user logout.
 */
function handleLogout() {
    auth.signOut();
}

// --- AUTH STATE OBSERVER ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        toggleVisibility(authArea, false);
        toggleVisibility(reportArea, true);
        toggleVisibility(logoutArea, true);
        loadAllReports(user);
    } else {
        // User is signed out
        toggleVisibility(authArea, true);
        toggleVisibility(reportArea, false);
        toggleVisibility(logoutArea, false);
        reportContent.innerHTML = ""; // Clear old reports
    }
});


// --- REPORT GENERATION LOGIC (REBUILT) ---

/**
 * Loads all reports associated with the logged-in parent's phone number.
 * @param {object} user - The authenticated Firebase user object.
 */
async function loadAllReports(user) {
    reportContent.innerHTML = '<p class="text-center text-green-700 font-semibold">Loading reports...</p>';

    try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error("User profile not found.");
        }
        const parentPhone = userDoc.data().normalizedPhone;
        
        // --- CACHE IMPLEMENTATION ---
        const cacheKey = `reportCache_auth_${parentPhone}`;
        const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
        try {
            const cachedItem = localStorage.getItem(cacheKey);
            if (cachedItem) {
                const { timestamp, html, chartConfigs } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < twoWeeksInMillis) {
                    console.log("Loading all reports from cache.");
                    reportContent.innerHTML = html;
                    if (chartConfigs && chartConfigs.length > 0) {
                        setTimeout(() => {
                            chartConfigs.forEach(chart => {
                                const ctx = document.getElementById(chart.canvasId);
                                if (ctx) new Chart(ctx, chart.config);
                            });
                        }, 0);
                    }
                    return;
                }
            }
        } catch (e) {
            console.error("Could not read cache:", e);
            localStorage.removeItem(cacheKey);
        }
        // --- END CACHE ---

        const assessmentQuery = db.collection("student_results").where("parentPhone", "==", parentPhone).get();
        const monthlyQuery = db.collection("tutor_submissions").where("parentPhone", "==", parentPhone).get();

        const [assessmentSnapshot, monthlySnapshot] = await Promise.all([assessmentQuery, monthlyQuery]);

        const allReports = [];
        assessmentSnapshot.forEach(doc => allReports.push({ ...doc.data(), type: 'assessment', timestamp: doc.data().submittedAt?.seconds || 0 }));
        monthlySnapshot.forEach(doc => allReports.push({ ...doc.data(), type: 'monthly', timestamp: doc.data().submittedAt?.seconds || 0 }));

        if (allReports.length === 0) {
            reportContent.innerHTML = '<p class="text-center text-gray-600">No reports found for your account.</p>';
            return;
        }

        // Sort all reports by date, newest first
        allReports.sort((a, b) => b.timestamp - a.timestamp);

        reportContent.innerHTML = "";
        const chartConfigsToCache = [];
        let reportIndex = 0;

        for (const reportData of allReports) {
            if (reportData.type === 'assessment') {
                // Assessment rendering logic adapted from original file
                const fullName = capitalize(reportData.studentName);
                const formattedDate = new Date(reportData.timestamp * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
                let tutorName = 'N/A';
                if (reportData.tutorEmail) {
                    try {
                        const tutorDoc = await db.collection("tutors").doc(reportData.tutorEmail).get();
                        if (tutorDoc.exists) tutorName = tutorDoc.data().name;
                    } catch (e) { console.warn("Could not fetch tutor name."); }
                }
                const results = [{
                    subject: reportData.subject,
                    correct: reportData.score || 0,
                    total: reportData.totalScoreableQuestions || 0,
                    topics: [...new Set(reportData.answers?.map(a => a.topic).filter(t => t))] || [reportData.subject],
                }];
                const recommendation = generateTemplatedRecommendation(fullName, tutorName, results);
                const creativeWritingAnswer = reportData.answers?.find(a => a.type === 'creative-writing');
                
                const assessmentBlock = `
                    <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="report-block-${reportIndex}">
                        <div class="text-center mb-6 border-b pb-4">
                            <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" alt="Logo" class="h-16 w-auto mx-auto mb-3">
                            <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                            <p class="text-gray-600">Date: ${formattedDate}</p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                            <div><p><strong>Student:</strong> ${fullName}</p><p><strong>Grade:</strong> ${reportData.grade}</p></div>
                            <div><p><strong>Tutor:</strong> ${tutorName}</p><p><strong>Location:</strong> ${reportData.studentCountry || 'N/A'}</p></div>
                        </div>
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Performance Summary</h3>
                        <p>${reportData.subject.toUpperCase()}: ${results[0].correct} / ${results[0].total}</p>
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Tutor's Recommendation</h3>
                        <p class="mb-2 text-gray-700 leading-relaxed">${recommendation}</p>
                        ${creativeWritingAnswer ? `<h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3><p><strong>Tutor's Report:</strong> ${creativeWritingAnswer.tutorReport || 'Pending'}</p>` : ''}
                        <canvas id="chart-${reportIndex}" class="w-full h-48 mb-4"></canvas>
                        <div class="mt-6 text-center">
                            <button onclick="downloadReport(${reportIndex}, '${fullName}', 'Assessment')" class="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700">Download PDF</button>
                        </div>
                    </div>`;
                reportContent.innerHTML += assessmentBlock;
                
                const ctx = document.getElementById(`chart-${reportIndex}`);
                if (ctx) {
                    const chartConfig = { type: 'bar', data: { labels: [results[0].subject.toUpperCase()], datasets: [{ label: 'Correct', data: [results[0].correct], backgroundColor: '#4CAF50' }, { label: 'Incorrect', data: [results[0].total - results[0].correct], backgroundColor: '#FFCD56' }] }, options: { scales: { y: { beginAtZero: true, max: results[0].total } } } };
                    new Chart(ctx, chartConfig);
                    chartConfigsToCache.push({ canvasId: `chart-${reportIndex}`, config: chartConfig });
                }

            } else {
                // Monthly report rendering logic adapted from original file
                const fullName = capitalize(reportData.studentName);
                const formattedDate = new Date(reportData.timestamp * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
                const monthlyBlock = `
                    <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="report-block-${reportIndex}">
                        <div class="text-center mb-6 border-b pb-4">
                             <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" alt="Logo" class="h-16 w-auto mx-auto mb-3">
                             <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                             <p class="text-gray-600">Date: ${formattedDate}</p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                           <div><p><strong>Student:</strong> ${fullName}</p><p><strong>Grade:</strong> ${reportData.grade || 'N/A'}</p></div>
                           <div><p><strong>Tutor:</strong> ${reportData.tutorName || 'N/A'}</p></div>
                        </div>
                         ${Object.entries(reportData).map(([key, value]) => {
                             if (['introduction', 'topics', 'progress', 'strengthsWeaknesses', 'recommendations', 'generalComments'].includes(key) && value) {
                                 const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                 return `<div class="mb-4"><h3 class="text-lg font-semibold text-green-700 border-b pb-1 mb-2">${title}</h3><p class="text-gray-700 whitespace-pre-line">${value}</p></div>`;
                             }
                             return '';
                         }).join('')}
                        <div class="mt-6 text-center">
                            <button onclick="downloadReport(${reportIndex}, '${fullName}', 'Monthly')" class="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700">Download PDF</button>
                        </div>
                    </div>`;
                reportContent.innerHTML += monthlyBlock;
            }
            reportIndex++;
        }
        
        // --- CACHE SAVING ---
        try {
            const dataToCache = { timestamp: Date.now(), html: reportContent.innerHTML, chartConfigs: chartConfigsToCache };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
            console.log("Reports cached successfully.");
        } catch (e) {
            console.error("Could not write to cache:", e);
        }

    } catch (error) {
        console.error("Error loading reports:", error);
        reportContent.innerHTML = `<p class="text-center text-red-500">Error: ${error.message}</p>`;
    }
}


/**
 * Generates a personalized recommendation. (Kept from original file)
 */
function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [], weaknesses = [];
    results.forEach(res => {
        const percentage = res.total > 0 ? (res.correct / res.total) * 100 : 0;
        const topicList = res.topics.length > 0 ? res.topics : [res.subject];
        if (percentage >= 75) strengths.push(...topicList);
        else if (percentage < 50) weaknesses.push(...topicList);
    });
    const uniqueStrengths = [...new Set(strengths)];
    const uniqueWeaknesses = [...new Set(weaknesses)];
    let praiseClause = uniqueStrengths.length > 0 ? `${studentName} showed strong potential, especially in ${uniqueStrengths.join(', ')}. ` : `${studentName} has put in a commendable effort. `;
    let improvementClause = uniqueWeaknesses.length > 0 ? `Our next step will be to focus on building confidence in ${uniqueWeaknesses.join(', ')}. ` : "We will continue to build on these fantastic results. ";
    return `${praiseClause}${improvementClause}With personalized support from ${tutorName}, we are confident ${studentName} will unlock their full potential.`;
}

/**
 * Downloads a specific report block as a PDF. (Kept and simplified)
 */
function downloadReport(index, studentName, type) {
    const element = document.getElementById(`report-block-${index}`);
    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${type}_Report_${safeStudentName}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().from(element).set(opt).save();
}


// --- UI EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    signInTabBtn.addEventListener('click', () => {
        signInTabBtn.classList.add('tab-active');
        signUpTabBtn.classList.remove('tab-active');
        toggleVisibility(signInForm, true);
        toggleVisibility(signUpForm, false);
    });
    signUpTabBtn.addEventListener('click', () => {
        signUpTabBtn.classList.add('tab-active');
        signInTabBtn.classList.remove('tab-active');
        toggleVisibility(signUpForm, true);
        toggleVisibility(signInForm, false);
    });

    // Form submissions
    signInForm.addEventListener('submit', handleSignIn);
    signUpForm.addEventListener('submit', handleSignUp);
    passwordResetForm.addEventListener('submit', handlePasswordReset);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Modal controls
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        toggleVisibility(passwordResetModal, true);
    });
    cancelResetBtn.addEventListener('click', () => {
        toggleVisibility(passwordResetModal, false);
        resetError.classList.add('hidden');
        resetSuccess.classList.add('hidden');
    });
});
