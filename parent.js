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

// Normalize phone number - keep multiple formats for compatibility
function normalizePhone(phone) {
    if (!phone) return "";
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, "");
    // Return last 10 digits AND full international format for compatibility
    return {
        last10: digitsOnly.slice(-10),
        full: digitsOnly,
        withPlus: digitsOnly.startsWith('234') ? `+${digitsOnly}` : digitsOnly
    };
}

// Check if user is logged in on page load
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in, load reports automatically
        loadReportsForUser(user);
    }
});

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

// Authentication Functions
function showTab(tabName) {
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    
    if (tabName === 'signIn') {
        signInTab.classList.remove('tab-inactive');
        signInTab.classList.add('tab-active');
        signUpTab.classList.remove('tab-active');
        signUpTab.classList.add('tab-inactive');
        signInForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
    } else {
        signUpTab.classList.remove('tab-inactive');
        signUpTab.classList.add('tab-active');
        signInTab.classList.remove('tab-active');
        signInTab.classList.add('tab-inactive');
        signUpForm.classList.remove('hidden');
        signInForm.classList.add('hidden');
    }
    
    // Clear all error messages
    clearAllErrors();
}

function clearAllErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(el => {
        el.classList.add('hidden');
        el.textContent = '';
    });
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.remove('hidden');
}

function validateSignUpForm() {
    clearAllErrors();
    let isValid = true;
    
    const phone = document.getElementById('signUpPhone').value.trim();
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPassword').value;
    const confirmPassword = document.getElementById('signUpConfirmPassword').value;
    
    if (!phone) {
        showError('signUpPhoneError', 'Phone number is required');
        isValid = false;
    } else if (phone.replace(/\D/g, '').length < 10) {
        showError('signUpPhoneError', 'Please enter a valid phone number');
        isValid = false;
    }
    
    if (!email) {
        showError('signUpEmailError', 'Email address is required');
        isValid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        showError('signUpEmailError', 'Please enter a valid email address');
        isValid = false;
    }
    
    if (!password) {
        showError('signUpPasswordError', 'Password is required');
        isValid = false;
    } else if (password.length < 6) {
        showError('signUpPasswordError', 'Password must be at least 6 characters');
        isValid = false;
    }
    
    if (!confirmPassword) {
        showError('signUpConfirmPasswordError', 'Please confirm your password');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('signUpConfirmPasswordError', 'Passwords do not match');
        isValid = false;
    }
    
    return isValid;
}

function validateSignInForm() {
    clearAllErrors();
    let isValid = true;
    
    const identifier = document.getElementById('signInIdentifier').value.trim();
    const password = document.getElementById('signInPassword').value;
    
    if (!identifier) {
        showError('signInIdentifierError', 'Phone number or email is required');
        isValid = false;
    }
    
    if (!password) {
        showError('signInPasswordError', 'Password is required');
        isValid = false;
    }
    
    return isValid;
}

async function signUp() {
    if (!validateSignUpForm()) return;
    
    const phone = document.getElementById('signUpPhone').value.trim();
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPassword').value;
    
    const authLoader = document.getElementById('authLoader');
    const signUpBtn = document.getElementById('signUpBtn');
    
    authLoader.classList.remove('hidden');
    signUpBtn.disabled = true;
    signUpBtn.textContent = 'Creating Account...';
    
    try {
        // First check if user already exists with this phone number
        const normalizedPhone = normalizePhone(phone);
        const existingUserQuery = await db.collection('parents')
            .where('normalizedPhone.last10', '==', normalizedPhone.last10)
            .limit(1)
            .get();
        
        if (!existingUserQuery.empty) {
            // User exists with this phone, guide them to sign in
            authLoader.classList.add('hidden');
            signUpBtn.disabled = false;
            signUpBtn.textContent = 'Create Account';
            alert('BKH says: An account already exists with this phone number. Please sign in instead.');
            showTab('signIn');
            return;
        }
        
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Store phone number in user profile
        await user.updateProfile({
            displayName: phone
        });
        
        // Create user document in Firestore
        await db.collection('parents').doc(user.uid).set({
            phone: phone,
            email: email,
            normalizedPhone: normalizePhone(phone),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Success - user will be automatically redirected by auth state change
        console.log('User created successfully');
        
    } catch (error) {
        console.error('Error creating account:', error);
        let errorMessage = 'An error occurred during sign up. Please try again.';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email address is already in use. Please sign in instead.';
            showTab('signIn');
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak. Please use a stronger password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address. Please check your email.';
        }
        
        alert(`BKH says: ${errorMessage}`);
    } finally {
        authLoader.classList.add('hidden');
        signUpBtn.disabled = false;
        signUpBtn.textContent = 'Create Account';
    }
}

async function signIn() {
    if (!validateSignInForm()) return;
    
    const identifier = document.getElementById('signInIdentifier').value.trim();
    const password = document.getElementById('signInPassword').value;
    
    const authLoader = document.getElementById('authLoader');
    const signInBtn = document.getElementById('signInBtn');
    
    authLoader.classList.remove('hidden');
    signInBtn.disabled = true;
    signInBtn.textContent = 'Signing In...';
    
    try {
        let emailToUse = identifier;
        
        // If identifier looks like a phone number (contains mostly digits)
        if (/^\d+$/.test(identifier.replace(/\D/g, ''))) {
            // It's a phone number, we need to find the associated email
            const normalizedPhone = normalizePhone(identifier);
            const parentQuery = await db.collection('parents')
                .where('normalizedPhone.last10', '==', normalizedPhone.last10)
                .limit(1)
                .get();
            
            if (parentQuery.empty) {
                throw new Error('No account found with this phone number');
            }
            
            const parentData = parentQuery.docs[0].data();
            emailToUse = parentData.email;
        }
        
        // Sign in with email and password
        await auth.signInWithEmailAndPassword(emailToUse, password);
        
        // Success - user will be automatically redirected by auth state change
        
    } catch (error) {
        console.error('Error signing in:', error);
        let errorMessage = 'An error occurred during sign in. Please try again.';
        
        if (error.code === 'auth/user-not-found' || error.message === 'No account found with this phone number') {
            errorMessage = 'No account found with these credentials. Please check your details or sign up.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address. Please check your email.';
        }
        
        alert(`BKH says: ${errorMessage}`);
    } finally {
        authLoader.classList.add('hidden');
        signInBtn.disabled = false;
        signInBtn.textContent = 'Sign In';
    }
}

async function forgotPassword() {
    const email = document.getElementById('resetEmail').value.trim();
    const resetEmailError = document.getElementById('resetEmailError');
    const resetLoader = document.getElementById('resetLoader');
    const sendResetBtn = document.getElementById('sendResetBtn');
    
    if (!email) {
        resetEmailError.textContent = 'Email address is required';
        resetEmailError.classList.remove('hidden');
        return;
    }
    
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        resetEmailError.textContent = 'Please enter a valid email address';
        resetEmailError.classList.remove('hidden');
        return;
    }
    
    resetLoader.classList.remove('hidden');
    sendResetBtn.disabled = true;
    
    try {
        await auth.sendPasswordResetEmail(email);
        alert('BKH says: Password reset email sent! Please check your inbox.');
        closeForgotPasswordModal();
    } catch (error) {
        console.error('Error sending password reset:', error);
        let errorMessage = 'An error occurred. Please try again.';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email address.';
        }
        
        alert(`BKH says: ${errorMessage}`);
    } finally {
        resetLoader.classList.add('hidden');
        sendResetBtn.disabled = false;
    }
}

function showForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').classList.remove('hidden');
    document.getElementById('resetEmail').value = '';
    document.getElementById('resetEmailError').classList.add('hidden');
}

function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').classList.add('hidden');
}

async function loadReportsForUser(user) {
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
    const authArea = document.getElementById("authArea");
    const logoutArea = document.getElementById("logoutArea");

    // Get user's phone number from Firestore
    let userPhoneData = null;
    try {
        const parentDoc = await db.collection('parents').doc(user.uid).get();
        if (parentDoc.exists) {
            userPhoneData = parentDoc.data().normalizedPhone;
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }

    if (!userPhoneData) {
        alert("BKH says: Unable to retrieve your account information. Please try logging in again.");
        logout();
        return;
    }

    // --- CACHE IMPLEMENTATION ---
    const cacheKey = `reportCache_${user.uid}`;
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

                authArea.classList.add("hidden");
                reportArea.classList.remove("hidden");
                logoutArea.style.display = "flex";
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
        // Query collections using multiple phone formats for backward compatibility
        const assessmentQuery = db.collection("student_results")
            .where("parentPhone", "in", [
                userPhoneData.last10, 
                userPhoneData.full,
                userPhoneData.withPlus,
                `+${userPhoneData.full}`,
                `234${userPhoneData.last10}`
            ]).get();
        
        const monthlyQuery = db.collection("tutor_submissions")
            .where("parentPhone", "in", [
                userPhoneData.last10, 
                userPhoneData.full,
                userPhoneData.withPlus,
                `+${userPhoneData.full}`,
                `234${userPhoneData.last10}`
            ]).get();
        
        const [assessmentSnapshot, monthlySnapshot] = await Promise.all([assessmentQuery, monthlyQuery]);

        // Get all student results for this parent
        const studentResults = [];
        assessmentSnapshot.forEach(doc => {
            const data = doc.data();
            studentResults.push({ 
                id: doc.id,
                ...data,
                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                type: 'assessment'
            });
        });

        const monthlyReports = [];
        monthlySnapshot.forEach(doc => {
            const data = doc.data();
            monthlyReports.push({ 
                id: doc.id,
                ...data,
                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                type: 'monthly'
            });
        });

        if (studentResults.length === 0 && monthlyReports.length === 0) {
            alert("BKH says: No reports found for your account. Reports will appear here once they are submitted by your child's tutor.");
            return;
        }
        
        reportContent.innerHTML = "";
        const chartConfigsToCache = []; // To store chart data for caching

        // Display Assessment Reports
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
                            <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to nurturing your child's potential through personalized learning. This report reflects their current progress and provides a roadmap for future growth. We look forward to continuing this educational journey together.</p>
                        </div>
                        
                        <div class="mt-6 text-center">
                            <button onclick="downloadPDF('assessment-block-${assessmentIndex}')" 
                                    class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                Download PDF Report
                            </button>
                        </div>
                    </div>
                `;

                reportContent.innerHTML += assessmentBlock;

                // Initialize chart for this assessment
                if (results.length > 0) {
                    setTimeout(() => {
                        const ctx = document.getElementById(`chart-${assessmentIndex}`);
                        if (ctx) {
                            const chartConfig = {
                                type: 'bar',
                                data: {
                                    labels: results.map(r => r.subject.toUpperCase()),
                                    datasets: [{
                                        label: 'Score',
                                        data: results.map(r => r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0),
                                        backgroundColor: '#10b981',
                                        borderColor: '#047857',
                                        borderWidth: 1
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            max: 100,
                                            title: { display: true, text: 'Percentage (%)' }
                                        }
                                    },
                                    plugins: {
                                        title: { display: true, text: 'Subject Performance' },
                                        legend: { display: false }
                                    }
                                }
                            };
                            new Chart(ctx, chartConfig);
                            chartConfigsToCache.push({ canvasId: `chart-${assessmentIndex}`, config: chartConfig });
                        }
                    }, 0);
                }

                assessmentIndex++;
            }
        }

        // Display Monthly Reports
        if (monthlyReports.length > 0) {
            monthlyReports.forEach((report, index) => {
                const fullName = capitalize(report.studentName);
                const formattedDate = new Date(report.timestamp * 1000).toLocaleString('en-US', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                });

                const monthlyBlock = `
                    <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${index}">
                        <div class="text-center mb-6 border-b pb-4">
                            <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                                 alt="Blooming Kids House Logo" 
                                 class="h-16 w-auto mx-auto mb-3">
                            <h2 class="text-2xl font-bold text-green-800">Monthly Progress Report</h2>
                            <p class="text-gray-600">Date: ${formattedDate}</p>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                            <div>
                                <p><strong>Student's Name:</strong> ${fullName}</p>
                                <p><strong>Parent's Phone:</strong> ${report.parentPhone || 'N/A'}</p>
                                <p><strong>Grade:</strong> ${report.grade || 'N/A'}</p>
                            </div>
                            <div>
                                <p><strong>Tutor:</strong> ${report.tutorName || 'N/A'}</p>
                                <p><strong>Month:</strong> ${report.month || 'N/A'}</p>
                            </div>
                        </div>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Monthly Progress Summary</h3>
                        <div class="preserve-whitespace bg-gray-50 p-4 rounded-lg mb-4">
                            ${report.progressSummary || 'No progress summary provided.'}
                        </div>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Areas of Strength</h3>
                        <div class="preserve-whitespace bg-gray-50 p-4 rounded-lg mb-4">
                            ${report.strengths || 'No strengths detailed.'}
                        </div>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Areas for Improvement</h3>
                        <div class="preserve-whitespace bg-gray-50 p-4 rounded-lg mb-4">
                            ${report.improvements || 'No improvement areas specified.'}
                        </div>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Recommendations</h3>
                        <div class="preserve-whitespace bg-gray-50 p-4 rounded-lg mb-4">
                            ${report.recommendations || 'No recommendations provided.'}
                        </div>

                        <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                            <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                            <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to nurturing your child's potential through personalized learning. This report reflects their current progress and provides a roadmap for future growth. We look forward to continuing this educational journey together.</p>
                        </div>
                        
                        <div class="mt-6 text-center">
                            <button onclick="downloadPDF('monthly-block-${index}')" 
                                    class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                Download PDF Report
                            </button>
                        </div>
                    </div>
                `;

                reportContent.innerHTML += monthlyBlock;
            });
        }

        // --- CACHE THE RESULTS ---
        try {
            const htmlToCache = reportContent.innerHTML;
            const cacheData = {
                timestamp: Date.now(),
                html: htmlToCache,
                chartConfigs: chartConfigsToCache
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (e) {
            console.error("Could not write to cache:", e);
        }

        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        logoutArea.style.display = "flex";

    } catch (error) {
        console.error("Error loading reports:", error);
        alert("BKH says: An error occurred while loading reports. Please try again.");
    }
}

function logout() {
    auth.signOut().then(() => {
        // Clear cache on logout
        const cacheKey = `reportCache_${auth.currentUser?.uid}`;
        if (cacheKey) localStorage.removeItem(cacheKey);
        
        document.getElementById('authArea').classList.remove('hidden');
        document.getElementById('reportArea').classList.add('hidden');
        document.getElementById('logoutArea').style.display = 'none';
        document.getElementById('reportContent').innerHTML = '';
        
        // Clear form fields
        document.getElementById('signInIdentifier').value = '';
        document.getElementById('signInPassword').value = '';
        document.getElementById('signUpPhone').value = '';
        document.getElementById('signUpEmail').value = '';
        document.getElementById('signUpPassword').value = '';
        document.getElementById('signUpConfirmPassword').value = '';
        
        // Show sign in tab by default
        showTab('signIn');
    }).catch((error) => {
        console.error("Error signing out:", error);
    });
}

function downloadPDF(elementId) {
    const element = document.getElementById(elementId);
    const options = {
        margin: 10,
        filename: 'BKH_Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(options).from(element).save();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    document.getElementById('signInTab').addEventListener('click', () => showTab('signIn'));
    document.getElementById('signUpTab').addEventListener('click', () => showTab('signUp'));
    
    // Form submissions
    document.getElementById('signInBtn').addEventListener('click', signIn);
    document.getElementById('signUpBtn').addEventListener('click', signUp);
    
    // Forgot password flow
    document.getElementById('forgotPasswordBtn').addEventListener('click', showForgotPasswordModal);
    document.getElementById('cancelResetBtn').addEventListener('click', closeForgotPasswordModal);
    document.getElementById('sendResetBtn').addEventListener('click', forgotPassword);
    
    // Enter key support
    document.getElementById('signInPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') signIn();
    });
    
    document.getElementById('signUpConfirmPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') signUp();
    });
    
    document.getElementById('resetEmail').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') forgotPassword();
    });
});
