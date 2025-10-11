// --- FIREBASE INITIALIZATION & SETUP ---

// Firebase config for the 'bloomingkidsassessment' project
firebase.initializeApp({
    // IMPORTANT: DO NOT expose a real API key here. I'm using the placeholder key from the original file.
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
});

const db = firebase.firestore();
const auth = firebase.auth();

// Constants
const PARENT_USERS_COLLECTION = "parent_users";
const REPORTS_COLLECTION = "student_results";
const MONTHLY_REPORTS_COLLECTION = "tutor_submissions";

// --- UTILITY FUNCTIONS ---

/**
 * Custom Toast/Message Handler (Replaces alert())
 * @param {string} message The message to display.
 * @param {string} type 'success' or 'error'
 * @param {string} containerId ID of the element to show the message in.
 */
function showToast(message, type = 'error', containerId = 'messageContainer') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Message container not found:", containerId);
        return;
    }
    
    container.textContent = message;
    container.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
    
    if (type === 'success') {
        container.classList.add('bg-green-100', 'text-green-700');
    } else {
        container.classList.add('bg-red-100', 'text-red-700');
    }
    
    setTimeout(() => container.classList.add('hidden'), 5000);
}

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Normalizes the phone number: strips non-digits and returns the last 10 digits.
 * This is crucial for matching existing reports.
 * @param {string} rawPhone The raw phone number input.
 * @returns {string} The normalized 10-digit string.
 */
function normalizePhone(rawPhone) {
    const digits = rawPhone.replace(/\D/g, ''); // Strip all non-digit characters
    return digits.slice(-10); // Return the last 10 digits
}

/**
 * Determines if the login identifier is likely an email or a phone number.
 * @param {string} identifier
 * @returns {'email' | 'phone'}
 */
function getIdentifierType(identifier) {
    // Simple check: if it contains an '@', treat as email
    return identifier.includes('@') ? 'email' : 'phone';
}

// --- AUTHENTICATION & USER MANAGEMENT ---

/**
 * Stores the user's profile in Firestore after successful sign-up.
 * @param {object} user The Firebase Auth user object.
 * @param {string} rawPhone The original phone number.
 * @param {string} normalizedPhone The 10-digit phone number for matching.
 * @param {string} email The user's email.
 */
async function storeUserProfile(user, rawPhone, normalizedPhone, email) {
    try {
        await db.collection(PARENT_USERS_COLLECTION).doc(user.uid).set({
            email: email,
            rawPhone: rawPhone,
            normalizedPhone: normalizedPhone,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error storing user profile in Firestore:", error);
        // This is not a critical error for sign-in, but log it.
    }
}

/**
 * Fetches the normalized phone number for the currently authenticated user.
 * @returns {Promise<string|null>} The 10-digit phone number or null if not found.
 */
async function getNormalizedPhoneForUser(uid) {
    try {
        const doc = await db.collection(PARENT_USERS_COLLECTION).doc(uid).get();
        if (doc.exists) {
            return doc.data().normalizedPhone;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}


// --- UI FLOW CONTROLS ---

function switchTab(tab) {
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    const signInTabBtn = document.getElementById('signInTab');
    const signUpTabBtn = document.getElementById('signUpTab');

    signInForm.classList.add('hidden');
    signUpForm.classList.add('hidden');
    signInTabBtn.classList.remove('tab-active');
    signUpTabBtn.classList.remove('tab-active');

    if (tab === 'signIn') {
        signInForm.classList.remove('hidden');
        signInTabBtn.classList.add('tab-active');
    } else {
        signUpForm.classList.remove('hidden');
        signUpTabBtn.classList.add('tab-active');
    }
    // Clear any previous messages
    document.getElementById('messageContainer').classList.add('hidden');
}

function showForgotPasswordModal(event) {
    event.preventDefault();
    document.getElementById('forgotPasswordModal').classList.remove('hidden');
    document.getElementById('resetMessageContainer').classList.add('hidden');
}

function hideForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').classList.add('hidden');
    document.getElementById('resetEmail').value = '';
}

function setProcessingState(isProcessing, btnId) {
    const btn = document.getElementById(btnId);
    const loader = document.getElementById('loader');
    
    if (isProcessing) {
        btn.disabled = true;
        btn.textContent = "Processing...";
        loader.classList.remove('hidden');
    } else {
        btn.disabled = false;
        loader.classList.add('hidden');
        if (btnId === 'loginBtn') btn.textContent = "Sign In";
        if (btnId === 'signUpBtn') btn.textContent = "Sign Up";
        if (btnId === 'resetBtn') btn.textContent = "Send Reset Link";
    }
}


// --- AUTHENTICATION HANDLERS ---

document.getElementById('signUpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setProcessingState(true, 'signUpBtn');

    const rawPhone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const normalizedPhone = normalizePhone(rawPhone);

    if (password !== confirmPassword) {
        showToast("Passwords do not match.", 'error');
        setProcessingState(false, 'signUpBtn');
        return;
    }
    if (password.length < 6) {
        showToast("Password must be at least 6 characters.", 'error');
        setProcessingState(false, 'signUpBtn');
        return;
    }
    if (normalizedPhone.length < 10) {
        showToast("Please enter a valid phone number (at least 10 digits).", 'error');
        setProcessingState(false, 'signUpBtn');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await storeUserProfile(userCredential.user, rawPhone, normalizedPhone, email);
        showToast("Sign up successful! You are now logged in.", 'success');
        // Auth state observer will handle the rest (loading reports)
    } catch (error) {
        console.error("Sign Up Error:", error);
        let message = "Sign up failed. Please check your email format or if the email is already in use.";
        if (error.code === 'auth/email-already-in-use') {
             message = "This email is already registered. Please sign in or use password recovery.";
        }
        showToast(message, 'error');
    } finally {
        setProcessingState(false, 'signUpBtn');
    }
});

document.getElementById('signInForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setProcessingState(true, 'loginBtn');

    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    const identifierType = getIdentifierType(identifier);

    try {
        if (identifierType === 'email') {
            await auth.signInWithEmailAndPassword(identifier, password);
        } else {
            // Find user by normalized phone number first
            const normalizedPhone = normalizePhone(identifier);
            if (normalizedPhone.length < 10) {
                showToast("Please enter a valid phone number or email.", 'error');
                setProcessingState(false, 'loginBtn');
                return;
            }

            // We must find the Firebase Auth email associated with the phone
            const userQuery = await db.collection(PARENT_USERS_COLLECTION)
                                      .where("normalizedPhone", "==", normalizedPhone)
                                      .limit(1).get();

            if (userQuery.empty) {
                showToast("No account found matching this phone number. Please sign up.", 'error');
                setProcessingState(false, 'loginBtn');
                return;
            }
            
            const userEmail = userQuery.docs[0].data().email;
            await auth.signInWithEmailAndPassword(userEmail, password);
        }
        // Auth state observer handles report loading
        showToast("Sign in successful!", 'success');
    } catch (error) {
        console.error("Sign In Error:", error);
        let message = "Sign in failed. Invalid phone/email or password.";
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            message = "Invalid login credentials. Please check your phone/email and password.";
        }
        showToast(message, 'error');
    } finally {
        setProcessingState(false, 'loginBtn');
    }
});

document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setProcessingState(true, 'resetBtn');

    const email = document.getElementById('resetEmail').value.trim();
    const resetMessageContainer = document.getElementById('resetMessageContainer');
    
    resetMessageContainer.classList.add('hidden');

    // Custom action code settings for "BKH says..." branding and no SMS cost
    const actionCodeSettings = {
        url: window.location.href, // Link back to this portal page
        handleCodeInApp: true
    };
    
    try {
        await auth.sendPasswordResetEmail(email, actionCodeSettings);
        
        resetMessageContainer.classList.remove('hidden', 'bg-red-100', 'text-red-700');
        resetMessageContainer.classList.add('bg-green-100', 'text-green-700');
        resetMessageContainer.innerHTML = `
            <p class="font-semibold">BKH says... Password reset email sent!</p>
            <p>Check your inbox for a link to reset your password for ${email}.</p>
        `;
    } catch (error) {
        console.error("Password Reset Error:", error);
        
        resetMessageContainer.classList.remove('hidden', 'bg-green-100', 'text-green-700');
        resetMessageContainer.classList.add('bg-red-100', 'text-red-700');
        resetMessageContainer.innerHTML = `
            <p class="font-semibold">BKH says... Recovery failed.</p>
            <p>Could not send password reset to ${email}. Please check the email address or sign up if you don't have an account.</p>
        `;
    } finally {
        setProcessingState(false, 'resetBtn');
    }
});


function logout() {
    auth.signOut().then(() => {
        // Redirect or refresh the page to show the login screen
        window.location.reload(); 
    }).catch((error) => {
        console.error("Logout Error:", error);
        showToast("Logout failed. Please try again.", 'error');
    });
}

// --- REPORT LOGIC (PRESERVED) ---

/**
 * Generates a unique, personalized recommendation using a smart template.
 * (Original function preserved)
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
 * Checks if the search name matches the stored name.
 * NOTE: This function is preserved but no longer used in the main report loading
 * since student name is not provided on login, and ALL reports for the parent's
 * phone are now loaded automatically.
 */
function nameMatches(storedName, searchName) {
    if (!storedName || !searchName) return false;
    
    const storedLower = storedName.toLowerCase().trim();
    const searchLower = searchName.toLowerCase().trim();
    
    if (storedLower === searchLower) return true;
    if (storedLower.includes(searchLower)) return true;
    if (searchLower.includes(storedLower)) return true;
    
    const searchWords = searchLower.split(/\s+/).filter(word => word.length > 1);
    const storedWords = storedLower.split(/\s+/);
    
    if (searchWords.length > 0) {
        return searchWords.every(word => storedWords.some(storedWord => storedWord.includes(word)));
    }
    
    return false;
}

/**
 * NEW: Loads ALL children's reports associated with the authenticated parent's
 * normalized phone number. Replaces the old loadReport().
 */
async function loadAllChildrenReports(normalizedPhone) {
    const dashboardArea = document.getElementById("dashboardArea");
    const reportContent = document.getElementById("reportContent");
    const loader = document.getElementById("loader");

    loader.classList.remove("hidden");
    dashboardArea.classList.add("hidden");
    reportContent.innerHTML = ''; // Clear previous content

    // Add CSS for preserving whitespace dynamically (Preserved from original file)
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

    // --- CACHE IMPLEMENTATION (Updated for Auth) ---
    const cacheKey = `reportCache_auth_${normalizedPhone}`;
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
                    setTimeout(() => { // Use timeout to ensure DOM is fully rendered
                         chartConfigs.forEach(chart => {
                            const ctx = document.getElementById(chart.canvasId);
                            if (ctx) new Chart(ctx, chart.config);
                        });
                    }, 0);
                }
                loader.classList.add("hidden");
                dashboardArea.classList.remove("hidden");
                return; // Stop execution since we loaded from cache
            }
        }
    } catch (e) {
        console.error("Could not read from cache:", e);
        localStorage.removeItem(cacheKey); // Clear corrupted cache
    }
    // --- END CACHE IMPLEMENTATION ---

    try {
        // --- HIGHLY OPTIMIZED READS (Using normalizedPhone for backward compatibility) ---
        
        // 1. Query Assessment Reports
        const assessmentQuery = db.collection(REPORTS_COLLECTION)
            .where("parentPhone", "==", normalizedPhone).get();
        
        // 2. Query Monthly Reports
        const monthlyQuery = db.collection(MONTHLY_REPORTS_COLLECTION)
            .where("parentPhone", "==", normalizedPhone).get();
        
        const [assessmentSnapshot, monthlySnapshot] = await Promise.all([assessmentQuery, monthlyQuery]);

        // No need for client-side name filtering, we show all reports for this parentPhone
        const studentResults = [];
        assessmentSnapshot.forEach(doc => {
            studentResults.push({ 
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().submittedAt?.seconds || Date.now() / 1000,
                type: 'assessment'
            });
        });

        const monthlyReports = [];
        monthlySnapshot.forEach(doc => {
            monthlyReports.push({ 
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().submittedAt?.seconds || Date.now() / 1000,
                type: 'monthly'
            });
        });

        if (studentResults.length === 0 && monthlyReports.length === 0) {
            reportContent.innerHTML = `
                <div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg" role="alert">
                    <p class="font-bold">No Reports Found</p>
                    <p>We couldn't find any reports linked to your phone number. Please check back later or contact support if you believe this is an error.</p>
                </div>
            `;
            loader.classList.add("hidden");
            dashboardArea.classList.remove("hidden");
            return;
        }
        
        const allReports = [...studentResults, ...monthlyReports].sort((a, b) => b.timestamp - a.timestamp);

        const chartConfigsToCache = []; // To store chart data for caching
        
        let reportIndex = 0;
        
        for (const report of allReports) {
            const fullName = capitalize(report.studentName);
            const formattedDate = new Date(report.timestamp * 1000).toLocaleString('en-US', {
                dateStyle: 'long',
                timeStyle: 'short'
            });

            if (report.type === 'assessment') {
                // Assessment Report Logic (Preserved)
                const session = [report]; // Treat single report as a session for compatibility
                const tutorEmail = report.tutorEmail || 'N/A';
                const studentCountry = report.studentCountry || 'N/A';
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
                
                const currentId = `assessment-block-${reportIndex}`;

                const assessmentBlock = `
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

                reportContent.innerHTML += assessmentBlock;
                
                // Chart generation (Preserved)
                if (results.length > 0) {
                    const ctx = document.getElementById(`chart-${reportIndex}`);
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
                        chartConfigsToCache.push({ canvasId: `chart-${reportIndex}`, config: chartConfig });
                    }
                }
                
            } else if (report.type === 'monthly') {
                // Monthly Report Logic (Preserved)
                const monthlyReport = report;
                const currentId = `monthly-block-${reportIndex}`;
                
                const monthlyBlock = `
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
                reportContent.innerHTML += monthlyBlock;
            }
            reportIndex++;
        }
        
        // --- CACHE SAVING LOGIC (Updated for Auth) ---
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

        // Show the dashboard
        loader.classList.add("hidden");
        dashboardArea.classList.remove("hidden");

    } catch (error) {
        console.error("Error loading reports for authenticated user:", error);
        reportContent.innerHTML = `
            <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
                <p class="font-bold">Error Loading Reports</p>
                <p>Sorry, there was an error loading the reports. Please try logging out and logging back in.</p>
            </div>
        `;
    } finally {
        loader.classList.add("hidden");
    }
}

// --- PDF DOWNLOAD (PRESERVED) ---

function downloadSessionReport(index, studentName, type) {
    const elementId = `${type}-block-${index}`;
    const element = document.getElementById(elementId);
    
    if (!element) {
        console.error("Element not found for PDF download:", elementId);
        showToast("Error: Could not find report content to download.", 'error', 'messageContainer');
        return;
    }

    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}_${index}.pdf`; // Added index for uniqueness
    
    const opt = { 
        margin: 0.5, 
        filename: fileName, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
    };
    html2pdf().from(element).set(opt).save();
}

function downloadMonthlyReport(index, studentName) {
    downloadSessionReport(index, studentName, 'monthly');
}

// --- AUTH STATE LISTENER (MAIN ENTRY POINT) ---

auth.onAuthStateChanged(async (user) => {
    const authArea = document.getElementById('authArea');
    const dashboardArea = document.getElementById('dashboardArea');
    const logoutArea = document.getElementById('logoutArea');
    const welcomeMessage = document.getElementById('welcomeMessage');

    if (user) {
        // User is signed in.
        authArea.classList.add('hidden');
        logoutArea.classList.remove('hidden');
        dashboardArea.classList.add('hidden'); // Keep hidden while loading

        const normalizedPhone = await getNormalizedPhoneForUser(user.uid);
        
        if (normalizedPhone) {
            welcomeMessage.textContent = `Welcome, ${user.email} | Viewing Reports for ${normalizedPhone}`;
            await loadAllChildrenReports(normalizedPhone);
            dashboardArea.classList.remove('hidden');
        } else {
            // User authenticated but no phone number found in profile (shouldn't happen on new sign up)
            showToast("Account profile missing phone number. Please contact BKH support.", 'error');
            auth.signOut(); // Force sign out
        }
    } else {
        // User is signed out.
        authArea.classList.remove('hidden');
        logoutArea.classList.add('hidden');
        dashboardArea.classList.add('hidden');
        welcomeMessage.textContent = "Secure Access to Your Child's Progress Reports";
    }
});

// --- INITIALIZE PAGE ---

document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to the forms
    // Sign-up and Sign-in listeners are attached inline with the forms

    // Set initial active tab
    switchTab('signIn');
    
    // Clear old URL parameter logic (Obsolete with auth)
});

// Expose functions globally for HTML buttons/events (like switchTab, logout, downloadSessionReport)
window.switchTab = switchTab;
window.logout = logout;
window.downloadSessionReport = downloadSessionReport;
window.downloadMonthlyReport = downloadMonthlyReport;
window.showForgotPasswordModal = showForgotPasswordModal;
window.hideForgotPasswordModal = hideForgotPasswordModal;
