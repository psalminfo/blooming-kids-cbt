// ============================================================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ============================================================================
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

// ============================================================================
// SECTION 1: UTILITY FUNCTIONS (Security & Formatting)
// ============================================================================

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;', '`': '&#x60;', '/': '&#x2F;', '=': '&#x3D;' };
    return text.replace(/[&<>"'`/=]/g, function(m) { return map[m]; });
}

function sanitizeInput(input) {
    return (typeof input === 'string') ? escapeHtml(input.trim()) : input;
}

function safeText(text) {
    return (!text || typeof text !== 'string') ? "" : text.trim();
}

function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    return safeText(str).replace(/\b\w/g, l => l.toUpperCase());
}

function formatDetailedDate(date, showTimezone = false) {
    let dateObj;
    if (date?.toDate) dateObj = date.toDate();
    else if (date instanceof Date) dateObj = date;
    else if (typeof date === 'number') dateObj = new Date(date < 10000000000 ? date * 1000 : date);
    else dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) return 'Invalid date';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    if (showTimezone) options.timeZoneName = 'short';
    return dateObj.toLocaleDateString('en-US', options);
}

function getTimestamp(dateInput) {
    if (!dateInput) return 0;
    if (dateInput?.toDate) return dateInput.toDate().getTime();
    if (dateInput instanceof Date) return dateInput.getTime();
    return 0;
}

// ============================================================================
// SECTION 2: CSS INJECTION (FULL DESIGN RESTORATION)
// ============================================================================

function injectCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Smooth transitions */
        .accordion-content { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
        .accordion-content.hidden { max-height: 0 !important; opacity: 0; padding-top: 0 !important; padding-bottom: 0 !important; margin-top: 0 !important; margin-bottom: 0 !important; }
        .accordion-content:not(.hidden) { max-height: 5000px; opacity: 1; }
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        .slide-down { animation: slideDown 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        /* Loading animations */
        .loading-spinner { border: 3px solid rgba(0, 0, 0, 0.1); border-radius: 50%; border-top: 3px solid #10B981; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        .loading-spinner-small { border: 2px solid rgba(0, 0, 0, 0.1); border-radius: 50%; border-top: 2px solid #10B981; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* Interactive elements */
        .btn-glow:hover { box-shadow: 0 0 15px rgba(16, 185, 129, 0.5); }
        .notification-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
        .accordion-header { transition: all 0.2s ease; }
        .accordion-header:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        .tab-transition { transition: all 0.3s ease; }
    `;
    document.head.appendChild(style);
}

function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone')?.parentNode;
    if (!phoneInputContainer || document.getElementById('countryCode')) return;
    
    const container = document.createElement('div');
    container.className = 'flex gap-2';
    
    const countryCodeSelect = document.createElement('select');
    countryCodeSelect.id = 'countryCode';
    countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    countryCodeSelect.required = true;
    
    const countries = [
        { code: '+1', name: 'USA/Canada (+1)' }, { code: '+234', name: 'Nigeria (+234)' }, { code: '+44', name: 'UK (+44)' },
        { code: '+233', name: 'Ghana (+233)' }, { code: '+254', name: 'Kenya (+254)' }, { code: '+27', name: 'South Africa (+27)' },
        { code: '+91', name: 'India (+91)' }, { code: '+971', name: 'UAE (+971)' }, { code: '+966', name: 'Saudi Arabia (+966)' },
        { code: '+20', name: 'Egypt (+20)' }, { code: '+237', name: 'Cameroon (+237)' }, { code: '+256', name: 'Uganda (+256)' },
        { code: '+255', name: 'Tanzania (+255)' }, { code: '+250', name: 'Rwanda (+250)' }, { code: '+251', name: 'Ethiopia (+251)' },
        { code: '+41', name: 'Switzerland (+41)' }, { code: '+86', name: 'China (+86)' }, { code: '+33', name: 'France (+33)' },
        { code: '+49', name: 'Germany (+49)' }, { code: '+61', name: 'Australia (+61)' }, { code: '+55', name: 'Brazil (+55)' },
        { code: '+351', name: 'Portugal (+351)' }, { code: '+34', name: 'Spain (+34)' }, { code: '+39', name: 'Italy (+39)' },
        { code: '+31', name: 'Netherlands (+31)' }, { code: '+32', name: 'Belgium (+32)' }, { code: '+46', name: 'Sweden (+46)' },
        { code: '+47', name: 'Norway (+47)' }, { code: '+45', name: 'Denmark (+45)' }, { code: '+358', name: 'Finland (+358)' },
        { code: '+353', name: 'Ireland (+353)' }, { code: '+48', name: 'Poland (+48)' }, { code: '+90', name: 'Turkey (+90)' },
        { code: '+961', name: 'Lebanon (+961)' }, { code: '+962', name: 'Jordan (+962)' }, { code: '+81', name: 'Japan (+81)' },
        { code: '+82', name: 'South Korea (+82)' }, { code: '+60', name: 'Malaysia (+60)' }, { code: '+852', name: 'Hong Kong (+852)' },
        { code: '+52', name: 'Mexico (+52)' }, { code: '+63', name: 'Philippines (+63)' }, { code: '+65', name: 'Singapore (+65)' },
        { code: '+64', name: 'New Zealand (+64)' }, { code: '+7', name: 'Russia/Kazakhstan (+7)' }, { code: '+380', name: 'Ukraine (+380)' },
        { code: '+30', name: 'Greece (+30)' }, { code: '+43', name: 'Austria (+43)' }, { code: '+420', name: 'Czech Republic (+420)' },
        { code: '+36', name: 'Hungary (+36)' }, { code: '+40', name: 'Romania (+40)' }
    ];

    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = safeText(country.name);
        countryCodeSelect.appendChild(option);
    });

    countryCodeSelect.value = '+1'; 
    const phoneInput = document.getElementById('signupPhone');
    
    if (phoneInput) {
        phoneInput.placeholder = 'Enter phone number without country code';
        phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
        container.appendChild(countryCodeSelect);
        container.appendChild(phoneInput);
        phoneInputContainer.appendChild(container);
    }
}

function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return { normalized: null, valid: false, error: 'Invalid input' };
    try {
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (!cleaned) return { normalized: null, valid: false, error: 'Empty phone number' };
        
        if (cleaned.startsWith('+')) {
            cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
            return { normalized: cleaned, valid: true, error: null };
        } else {
            cleaned = cleaned.replace(/^0+/, '');
            if (cleaned.length <= 10) cleaned = '+1' + cleaned;
            else if (cleaned.length > 10) {
                const knownCodes = ['234', '44', '91', '86', '33', '49', '81', '61', '55', '7'];
                const possibleCode = cleaned.substring(0, 3);
                cleaned = knownCodes.includes(possibleCode) ? '+' + cleaned : '+1' + cleaned;
            }
            return { normalized: cleaned, valid: true, error: null };
        }
    } catch (error) {
        return { normalized: null, valid: false, error: safeText(error.message) };
    }
}

// ============================================================================
// SECTION 3: GLOBAL VARIABLES
// ============================================================================
let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let unreadMessagesCount = 0;
let realTimeListeners = [];
let academicsNotifications = new Map();

// ============================================================================
// SECTION 4: MESSAGING UI
// ============================================================================
function showMessage(message, type) {
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) existingMessage.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    messageDiv.textContent = `BKH says: ${safeText(message)}`;
    document.body.appendChild(messageDiv);
    setTimeout(() => { if (messageDiv.parentNode) messageDiv.remove(); }, 5000);
}

// ============================================================================
// SECTION 5: AUTHENTICATION (EMAIL SAFE)
// ============================================================================
async function handleSignInFull(identifier, password, signInBtn, authLoader) {
    try {
        await auth.signInWithEmailAndPassword(identifier, password);
        // UnifiedAuthManager handles the rest
    } catch (error) {
        let errorMessage = "Failed to sign in.";
        if (error.code === 'auth/user-not-found') errorMessage = "No account found. Please Create Account first.";
        else if (error.code === 'auth/wrong-password') errorMessage = "Incorrect password.";
        else if (error.code === 'auth/invalid-email') errorMessage = "Invalid email format.";
        showMessage(errorMessage, 'error');
        if (signInBtn) signInBtn.disabled = false;
        if (authLoader) authLoader.classList.add('hidden');
        document.getElementById('signInText').textContent = 'Sign In';
        document.getElementById('signInSpinner').classList.add('hidden');
    }
}

async function handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader) {
    try {
        let fullPhoneInput = localPhone;
        if (!localPhone.startsWith('+')) fullPhoneInput = countryCode + localPhone;
        
        const normalizedResult = normalizePhoneNumber(fullPhoneInput);
        if (!normalizedResult.valid) throw new Error(`Invalid phone number: ${normalizedResult.error}`);
        
        const finalPhone = normalizedResult.normalized;
        
        // EMAIL CHECK: We only catch if the email is already an AUTH USER.
        // If the email exists in enrollment data (Firestore), this will NOT error.
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const referralCode = await generateReferralCode();
        
        await db.collection('parent_users').doc(user.uid).set({
            email: email, phone: finalPhone, normalizedPhone: finalPhone, parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(), referralCode: referralCode, referralEarnings: 0, uid: user.uid
        });
        showMessage('Account created successfully!', 'success');
    } catch (error) {
        let errorMessage = error.message || "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') errorMessage = "This email is already registered. Please Sign In instead.";
        else if (error.code === 'auth/weak-password') errorMessage = "Password too weak.";
        showMessage(errorMessage, 'error');
        if (signUpBtn) signUpBtn.disabled = false;
        if (authLoader) authLoader.classList.add('hidden');
        document.getElementById('signUpText').textContent = 'Create Account';
        document.getElementById('signUpSpinner').classList.add('hidden');
    }
}

async function handlePasswordResetFull(email, sendResetBtn, resetLoader) {
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Reset link sent!', 'success');
        hidePasswordResetModal();
    } catch (error) {
        showMessage("Failed to send reset email.", 'error');
    } finally {
        if (sendResetBtn) sendResetBtn.disabled = false;
        if (resetLoader) resetLoader.classList.add('hidden');
    }
}

// ============================================================================
// SECTION 6: REFERRAL SYSTEM (FULL UI RESTORED)
// ============================================================================
async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    let code, isUnique = false;
    while (!isUnique) {
        let suffix = '';
        for (let i = 0; i < 6; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        code = prefix + suffix;
        const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snapshot.empty) isUnique = true;
    }
    return safeText(code);
}

async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    if (!rewardsContent) return;
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';
    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) { rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found.</p>'; return; }
        
        const userData = userDoc.data();
        const referralCode = safeText(userData.referralCode || 'N/A');
        const totalEarnings = userData.referralEarnings || 0;
        const transactionsSnapshot = await db.collection('referral_transactions').where('ownerUid', '==', parentUid).get();
        
        let referralsHtml = '';
        let pendingCount = 0, approvedCount = 0, paidCount = 0;

        if (transactionsSnapshot.empty) {
            referralsHtml = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>`;
        } else {
            const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            transactions.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
            transactions.forEach(data => {
                const status = safeText(data.status || 'pending');
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';
                if (status === 'pending') pendingCount++;
                if (status === 'approved') approvedCount++;
                if (status === 'paid') paidCount++;
                
                const referredName = capitalize(data.referredStudentName || data.referredStudentPhone);
                const rewardAmount = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
                const referralDate = data.timestamp?.toDate?.().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';

                referralsHtml += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${referredName}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${safeText(referralDate)}</td>
                        <td class="px-4 py-3 text-sm"><span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">${capitalize(status)}</span></td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${safeText(rewardAmount)}</td>
                    </tr>`;
            });
        }
        
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md slide-down">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2">Share this code! You earn **₦5,000** once the referred child completes their first month!</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600 fade-in">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600 fade-in">
                    <p class="text-sm font-medium text-yellow-700">Approved Rewards (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600 fade-in">
                    <p class="text-sm font-medium text-gray-700">Total Successful Referrals (Paid)</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referred Parent/Student</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Used</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">${referralsHtml}</tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error('Error loading referral rewards:', error);
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">An error occurred while loading your rewards data.</p>';
    }
}

// ============================================================================
// SECTION 7: ACADEMICS TAB (FULL DESIGN RESTORED)
// ============================================================================
async function loadAcademicsData(selectedStudent = null) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;
    
    academicsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading academic data...</p></div>';
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in');
        
        // Wait for userChildren to populate if needed
        if (userChildren.length === 0) await new Promise(r => setTimeout(r, 1000));
        
        if (userChildren.length === 0) {
            academicsContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📚</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
                    <p class="text-gray-500 max-w-md mx-auto">No students are currently assigned to your account.</p>
                </div>`;
            return;
        }

        let studentsToShow = selectedStudent && studentIdMap.has(selectedStudent) ? [selectedStudent] : userChildren;
        let academicsHtml = '';
        
        if (userChildren.length > 1) {
            academicsHtml += `
                <div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm slide-down">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
                    <select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" onchange="loadAcademicsData(this.value)">
                        <option value="">All Students</option>
            `;
            userChildren.forEach(name => {
                const isSelected = selectedStudent === name ? 'selected' : '';
                academicsHtml += `<option value="${safeText(name)}" ${isSelected}>${capitalize(name)}</option>`;
            });
            academicsHtml += `</select></div>`;
        }

        for (const studentName of studentsToShow) {
            const studentId = studentIdMap.get(studentName);
            if (!studentId) continue;
            
            // Student Header
            academicsHtml += `
                <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6 slide-down" id="academics-student-${safeText(studentName)}">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}</h2>
                            <p class="text-green-600">Academic progress and assignments</p>
                        </div>
                    </div>
                </div>
            `;

            // 1. SESSION TOPICS ACCORDION
            academicsHtml += `
                <div class="mb-8 fade-in">
                    <button onclick="toggleAcademicsAccordion('session-topics-${safeText(studentName)}')" 
                            class="accordion-header w-full flex justify-between items-center p-4 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-all duration-200 mb-4">
                        <div class="flex items-center">
                            <span class="text-xl mr-3">📝</span>
                            <div class="text-left">
                                <h3 class="font-bold text-blue-800 text-lg">Session Topics</h3>
                                <p class="text-blue-600 text-sm">What your child learned in each session</p>
                            </div>
                        </div>
                        <span id="session-topics-${safeText(studentName)}-arrow" class="accordion-arrow text-blue-600 text-xl">▼</span>
                    </button>
                    <div id="session-topics-${safeText(studentName)}-content" class="accordion-content hidden">
            `;
            
            // Session Topics Logic
            const topicsSnapshot = await db.collection('daily_topics').where('studentId', '==', studentId).get();
            if (topicsSnapshot.empty) {
                academicsHtml += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">No session topics recorded yet.</p></div>`;
            } else {
                const topics = [];
                topicsSnapshot.forEach(doc => topics.push({ id: doc.id, ...doc.data() }));
                topics.sort((a, b) => getTimestamp(b.date || b.timestamp) - getTimestamp(a.date || a.timestamp));
                
                topics.forEach(topic => {
                    const date = formatDetailedDate(topic.date || topic.timestamp);
                    const tutorName = safeText(topic.tutorName || 'Tutor');
                    academicsHtml += `
                        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <span class="font-medium text-gray-800">${date}</span>
                                    <div class="mt-1 flex items-center">
                                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">Session</span>
                                        <span class="text-xs text-gray-600">By: ${tutorName}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="text-gray-700 bg-gray-50 p-3 rounded-md">
                                <p class="whitespace-pre-wrap">${safeText(topic.topics || topic.sessionTopics)}</p>
                            </div>
                            ${topic.notes ? `<div class="mt-3 text-sm"><span class="font-medium text-gray-700">Additional Notes:</span><p class="text-gray-600 mt-1 bg-yellow-50 p-2 rounded">${safeText(topic.notes)}</p></div>` : ''}
                        </div>`;
                });
            }
            academicsHtml += `</div></div>`;

            // 2. HOMEWORK ACCORDION
            academicsHtml += `
                <div class="mb-8 fade-in">
                    <button onclick="toggleAcademicsAccordion('homework-${safeText(studentName)}')" 
                            class="accordion-header w-full flex justify-between items-center p-4 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 transition-all duration-200 mb-4">
                        <div class="flex items-center">
                            <span class="text-xl mr-3">📚</span>
                            <div class="text-left">
                                <h3 class="font-bold text-purple-800 text-lg">Homework Assignments</h3>
                                <p class="text-purple-600 text-sm">Assignments and due dates</p>
                            </div>
                        </div>
                        <span id="homework-${safeText(studentName)}-arrow" class="accordion-arrow text-purple-600 text-xl">▼</span>
                    </button>
                    <div id="homework-${safeText(studentName)}-content" class="accordion-content hidden">
            `;

            // Homework Logic
            const homeworkSnapshot = await db.collection('homework_assignments').where('studentId', '==', studentId).get();
            if (homeworkSnapshot.empty) {
                academicsHtml += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">No homework assigned yet.</p></div>`;
            } else {
                const assignments = [];
                homeworkSnapshot.forEach(doc => assignments.push({ id: doc.id, ...doc.data() }));
                assignments.sort((a, b) => getTimestamp(b.dueDate) - getTimestamp(a.dueDate));
                
                assignments.forEach(hw => {
                    const dueDate = formatDetailedDate(hw.dueDate);
                    const assignedDate = formatDetailedDate(hw.assignedDate || hw.createdAt);
                    const isSubmitted = hw.status === 'submitted' || hw.status === 'completed';
                    const isOverdue = !isSubmitted && getTimestamp(hw.dueDate) < Date.now();
                    const statusColor = isOverdue ? 'bg-red-100 text-red-800' : isSubmitted ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
                    const statusText = isOverdue ? 'Overdue' : isSubmitted ? 'Submitted' : 'Pending';

                    academicsHtml += `
                        <div class="bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <h5 class="font-medium text-gray-800 text-lg">${safeText(hw.title || hw.subject)}</h5>
                                    <div class="mt-1 flex flex-wrap items-center gap-2">
                                        <span class="text-xs ${statusColor} px-2 py-1 rounded-full">${statusText}</span>
                                        <span class="text-xs text-gray-600">Assigned by: ${safeText(hw.tutorName || 'Tutor')}</span>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <span class="text-sm font-medium text-gray-700">Due: ${dueDate}</span>
                                    <div class="text-xs text-gray-500 mt-1">Assigned: ${assignedDate}</div>
                                </div>
                            </div>
                            <div class="text-gray-700 mb-4">
                                <p class="whitespace-pre-wrap bg-gray-50 p-3 rounded-md">${safeText(hw.description || hw.instructions)}</p>
                            </div>
                            <div class="flex justify-between items-center pt-3 border-t border-gray-100">
                                <div class="flex items-center space-x-3">
                                    ${hw.fileUrl ? `<a href="${safeText(hw.fileUrl)}" target="_blank" class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm"><span class="mr-1">📎</span> Download Attachment</a>` : ''}
                                    ${hw.submissionUrl ? `<a href="${safeText(hw.submissionUrl)}" target="_blank" class="text-blue-600 hover:text-blue-800 font-medium flex items-center text-sm"><span class="mr-1">📤</span> View Submission</a>` : ''}
                                </div>
                                ${hw.grade ? `<div class="text-sm"><span class="font-medium text-gray-700">Grade:</span> <span class="ml-1 font-bold ${hw.grade >= 70 ? 'text-green-600' : 'text-red-600'}">${hw.grade}%</span></div>` : ''}
                            </div>
                            ${hw.feedback ? `<div class="mt-4 pt-3 border-t border-gray-100"><span class="font-medium text-gray-700 text-sm">Tutor Feedback:</span><p class="text-gray-600 text-sm mt-1 bg-blue-50 p-2 rounded">${safeText(hw.feedback)}</p></div>` : ''}
                        </div>`;
                });
            }
            academicsHtml += `</div></div>`;
        }
        academicsContent.innerHTML = academicsHtml;
    } catch (error) {
        console.error('Error loading academics:', error);
        academicsContent.innerHTML = `<div class="text-center py-8"><div class="text-4xl mb-4">❌</div><h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Data</h3><button onclick="loadAcademicsData()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg">Try Again</button></div>`;
    }
}

function toggleAcademicsAccordion(id) {
    const content = document.getElementById(`${id}-content`);
    const arrow = document.getElementById(`${id}-arrow`);
    if (content && arrow) {
        if (content.classList.contains('hidden')) { content.classList.remove('hidden'); arrow.textContent = '▲'; }
        else { content.classList.add('hidden'); arrow.textContent = '▼'; }
    }
}

// ============================================================================
// SECTION 8: REPORTS & ARCHIVES (FULL ACCORDION DESIGN)
// ============================================================================
function createYearlyArchiveReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    
    for (const [studentName, reports] of reportsByStudent) {
        const fullName = capitalize(studentName);
        const assessmentCount = Array.from(reports.assessments.values()).flat().length;
        const monthlyCount = Array.from(reports.monthly.values()).flat().length;
        const totalCount = assessmentCount + monthlyCount;

        html += `
            <div class="accordion-item mb-4 fade-in">
                <button onclick="toggleAccordion('student-${studentIndex}')" 
                        class="accordion-header w-full flex justify-between items-center p-4 bg-gradient-to-r from-green-100 to-green-50 border border-green-300 rounded-lg hover:bg-green-200 transition-all duration-200 hover:shadow-md">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">👤</span>
                        <div class="text-left">
                            <h3 class="font-bold text-green-800 text-lg">${fullName}</h3>
                            <p class="text-green-600 text-sm">${totalCount} Reports Available</p>
                        </div>
                    </div>
                    <span id="student-${studentIndex}-arrow" class="accordion-arrow text-green-600 text-xl">▼</span>
                </button>
                <div id="student-${studentIndex}-content" class="accordion-content hidden p-4">
        `;

        if (totalCount === 0) {
            html += `<div class="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center"><div class="text-4xl mb-3">📄</div><h4 class="text-lg font-semibold text-gray-700">No Reports Yet</h4></div>`;
        } else {
            // Group reports by Year
            const reportsByYear = new Map();
            const process = (list) => list.forEach(r => {
                const year = new Date(getTimestamp(r.timestamp)).getFullYear();
                if (!reportsByYear.has(year)) reportsByYear.set(year, []);
                reportsByYear.get(year).push(r);
            });
            Array.from(reports.assessments.values()).flat().forEach(r => process([r]));
            Array.from(reports.monthly.values()).flat().forEach(r => process([r]));

            // Sort Years Descending
            const sortedYears = Array.from(reportsByYear.keys()).sort((a,b) => b-a);

            sortedYears.forEach((year, yIdx) => {
                const yearReports = reportsByYear.get(year);
                yearReports.sort((a,b) => getTimestamp(b.timestamp) - getTimestamp(a.timestamp));
                
                html += `
                    <div class="mb-4 ml-2">
                        <button onclick="toggleAccordion('year-${studentIndex}-${yIdx}')" class="accordion-header w-full flex justify-between items-center p-3 bg-blue-100 border border-blue-300 rounded-lg">
                            <div class="flex items-center"><span class="text-xl mr-3">📅</span><h4 class="font-bold text-blue-800">${year}</h4></div>
                            <span id="year-${studentIndex}-${yIdx}-arrow" class="accordion-arrow text-blue-600">▼</span>
                        </button>
                        <div id="year-${studentIndex}-${yIdx}-content" class="accordion-content hidden ml-4 mt-2">
                `;
                
                yearReports.forEach((report, rIdx) => {
                    const date = formatDetailedDate(report.timestamp);
                    const isAssessment = report.type === 'assessment';
                    const typeLabel = isAssessment ? 'Assessment' : 'Monthly Report';
                    const sessionId = `${studentIndex}-${yIdx}-${rIdx}`;
                    
                    html += `
                        <div class="bg-white p-4 border rounded-lg mb-3 shadow-sm hover:shadow-md transition-shadow" id="report-block-${sessionId}">
                            <div class="flex justify-between items-center mb-2 border-b pb-2">
                                <h5 class="font-medium text-gray-800">${typeLabel} - ${date}</h5>
                                <button onclick="downloadReport('${sessionId}', '${safeText(fullName)}', '${report.type}')" 
                                        class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100">
                                    <span class="mr-1">📥</span> Download PDF
                                </button>
                            </div>
                            <div class="text-sm text-gray-700">
                                ${isAssessment ? `
                                    <div class="flex justify-between">
                                        <span><strong>Subject:</strong> ${safeText(report.subject)}</span>
                                        <span><strong>Score:</strong> ${report.score}/${report.totalScoreableQuestions || '?'}</span>
                                    </div>` 
                                : `
                                    <p><strong>Topics:</strong> ${safeText(report.topics)}</p>
                                    ${report.studentProgress ? `<p class="mt-1 bg-blue-50 p-2 rounded"><strong>Progress:</strong> ${safeText(report.studentProgress)}</p>` : ''}
                                `}
                            </div>
                        </div>`;
                });
                html += `</div></div>`;
            });
        }
        html += `</div></div>`;
        studentIndex++;
    }
    return html;
}

function toggleAccordion(id) {
    const content = document.getElementById(`${id}-content`);
    const arrow = document.getElementById(`${id}-arrow`);
    if (content && arrow) {
        if (content.classList.contains('hidden')) { content.classList.remove('hidden'); arrow.textContent = '▲'; }
        else { content.classList.add('hidden'); arrow.textContent = '▼'; }
    }
}

function downloadReport(sessionId, studentName, type) {
    const element = document.getElementById(`report-block-${sessionId}`);
    if (!element) return;
    showMessage('Generating PDF...', 'success');
    const opt = { margin: 0.5, filename: `${type}_${studentName.replace(/\s+/g, '_')}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    if (typeof html2pdf !== 'undefined') {
        html2pdf().from(element).set(opt).save();
    } else {
        showMessage('PDF library not loaded.', 'error');
    }
}

// ============================================================================
// SECTION 9: MESSAGING
// ============================================================================
function showComposeMessageModal() {
    const studentDropdown = document.getElementById('messageStudent');
    if (studentDropdown) {
        studentDropdown.innerHTML = '<option value="">Select student (optional)</option>';
        userChildren.forEach(name => {
            const option = document.createElement('option');
            option.value = safeText(name);
            option.textContent = capitalize(name);
            studentDropdown.appendChild(option);
        });
    }
    document.getElementById('composeMessageModal').classList.remove('hidden');
}

function hideComposeMessageModal() {
    document.getElementById('composeMessageModal').classList.add('hidden');
}

async function submitMessage() {
    const recipient = document.getElementById('messageRecipient').value;
    const subject = document.getElementById('messageSubject').value.trim();
    const content = document.getElementById('messageContent').value.trim();
    const student = document.getElementById('messageStudent').value;
    const isUrgent = document.getElementById('messageUrgent').checked;

    if (!subject || !content) { showMessage('Please fill all fields', 'error'); return; }

    const submitBtn = document.getElementById('submitMessageBtn');
    submitBtn.disabled = true;
    document.getElementById('submitMessageText').textContent = 'Sending...';
    document.getElementById('submitMessageSpinner').classList.remove('hidden');

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in');
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        let recipients = recipient === 'tutor' ? ['tutors'] : recipient === 'management' ? ['management'] : ['tutors', 'management'];

        await db.collection('tutor_messages').add({
            parentName: userData.parentName || 'Parent', parentPhone: userData.phone, parentUid: user.uid,
            studentName: student || 'General', recipients, subject, content, isUrgent,
            status: 'sent', timestamp: firebase.firestore.FieldValue.serverTimestamp(), type: 'parent_to_staff', readBy: []
        });
        showMessage('Message sent successfully!', 'success');
        hideComposeMessageModal();
    } catch (e) { showMessage('Failed to send.', 'error'); }
    finally {
        submitBtn.disabled = false;
        document.getElementById('submitMessageText').textContent = 'Send Message';
        document.getElementById('submitMessageSpinner').classList.add('hidden');
    }
}

function showMessagesModal() {
    document.getElementById('messagesModal').classList.remove('hidden');
    loadUnifiedMessages();
}
function hideMessagesModal() { document.getElementById('messagesModal').classList.add('hidden'); }

async function loadUnifiedMessages() {
    const container = document.getElementById('messagesContent');
    container.innerHTML = 'Loading...';
    const user = auth.currentUser;
    if (!user) return;
    const snap = await db.collection('tutor_messages').where('parentUid', '==', user.uid).get();
    let html = '';
    const msgs = snap.docs.map(d => d.data()).sort((a,b) => getTimestamp(b.timestamp) - getTimestamp(a.timestamp));
    msgs.forEach(msg => {
        html += `<div class="bg-white border p-4 mb-2 rounded shadow-sm"><div class="flex justify-between font-bold"><span>${safeText(msg.subject)}</span><span class="text-xs text-gray-500">${formatDetailedDate(msg.timestamp)}</span></div><p class="mt-2 text-gray-700">${safeText(msg.content)}</p></div>`;
    });
    container.innerHTML = html || 'No messages found.';
}

// ============================================================================
// SECTION 10: UNIFIED AUTH & DATA MANAGER (THE ENGINE)
// ============================================================================

class UnifiedAuthManager {
    constructor() {
        this.currentUser = null;
        this.authListener = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.lastProcessTime = 0;
        this.DEBOUNCE_MS = 2000;
    }

    initialize() {
        if (this.isInitialized) return;
        console.log("🔐 Initializing Unified Auth Manager");
        this.cleanup();
        this.authListener = auth.onAuthStateChanged((user) => this.handleAuthChange(user));
        this.isInitialized = true;
    }

    async handleAuthChange(user) {
        const now = Date.now();
        if (this.isProcessing || (now - this.lastProcessTime < this.DEBOUNCE_MS)) return;
        this.isProcessing = true;
        this.lastProcessTime = now;

        try {
            if (user) {
                console.log(`👤 User authenticated: ${user.uid}`);
                await this.loadUserDashboard(user);
            } else {
                console.log("🚪 User signed out");
                this.showAuthScreen();
            }
        } catch (error) {
            console.error("Auth Error:", error);
            showMessage("Authentication error. Please refresh.", "error");
        } finally {
            setTimeout(() => { this.isProcessing = false; }, 1000);
        }
    }

    async loadUserDashboard(user) {
        const authLoader = document.getElementById("authLoader");
        if (authLoader) authLoader.classList.remove("hidden");
        
        try {
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            
            this.currentUser = {
                uid: user.uid, email: userData.email, phone: userData.phone,
                normalizedPhone: userData.normalizedPhone || userData.phone,
                parentName: userData.parentName || 'Parent', referralCode: userData.referralCode
            };
            
            currentUserData = this.currentUser; 
            this.showDashboardUI();
            
            // COMPREHENSIVE CHILD FINDER
            const childrenData = await this.comprehensiveFindChildren(this.currentUser.normalizedPhone);
            userChildren = childrenData.studentNames;
            studentIdMap = childrenData.studentNameIdMap;
            
            // Load All Data
            await this.loadAllReports();
            await loadReferralRewards(this.currentUser.uid);
            await loadAcademicsData(); 
            
            this.addNavButtons();
            
        } catch (error) {
            console.error("Dashboard Load Error:", error);
            this.showAuthScreen();
        } finally {
            if (authLoader) authLoader.classList.add("hidden");
        }
    }

    async comprehensiveFindChildren(parentPhone) {
        const allChildren = new Map();
        const studentNameIdMap = new Map();
        const variations = this.generateAllPhoneVariations(parentPhone);
        const collections = ['students', 'pending_students'];
        
        for (const col of collections) {
            for (const phone of variations) {
                try {
                    const snap = await db.collection(col).where('parentPhone', '==', phone).get();
                    snap.forEach(doc => {
                        const name = safeText(doc.data().studentName || doc.data().name);
                        if (name) {
                            allChildren.set(doc.id, { id: doc.id, name, data: doc.data() });
                            studentNameIdMap.set(name, doc.id);
                        }
                    });
                } catch (e) {}
            }
        }
        return { studentNames: Array.from(studentNameIdMap.keys()), studentNameIdMap };
    }

    async loadAllReports() {
        const reportContent = document.getElementById("reportContent");
        try {
            // TARGETED SEARCH (Quota Safe)
            const variations = this.generateAllPhoneVariations(this.currentUser.normalizedPhone);
            const collections = ['tutor_submissions', 'student_results'];
            let allResults = [];

            for (const col of collections) {
                for (const phone of variations) {
                    try {
                        const snap = await db.collection(col).where('parentPhone', '==', phone).get();
                        snap.forEach(doc => allResults.push({ ...doc.data(), id: doc.id, type: col === 'student_results' ? 'assessment' : 'monthly' }));
                    } catch(e) {}
                }
            }
            
            // Deduplicate
            const uniqueResults = [];
            const ids = new Set();
            allResults.forEach(r => { if(!ids.has(r.id)){ ids.add(r.id); uniqueResults.push(r); }});

            const reportsByStudent = new Map();
            userChildren.forEach(name => reportsByStudent.set(name, { assessments: new Map(), monthly: new Map() }));

            uniqueResults.forEach(res => {
                const name = safeText(res.studentName || res.student);
                if (!name) return;
                if (!reportsByStudent.has(name)) {
                    reportsByStudent.set(name, { assessments: new Map(), monthly: new Map() });
                    if (!userChildren.includes(name)) userChildren.push(name);
                }
                const type = res.type === 'assessment' ? 'assessments' : 'monthly';
                const key = 'all';
                if (!reportsByStudent.get(name)[type].has(key)) reportsByStudent.get(name)[type].set(key, []);
                reportsByStudent.get(name)[type].get(key).push(res);
            });

            reportContent.innerHTML = createYearlyArchiveReportView(reportsByStudent);
        } catch (e) {
            console.error("Report Load Error", e);
            reportContent.innerHTML = 'Error loading reports.';
        }
    }

    generateAllPhoneVariations(phone) {
        const variations = new Set();
        if (!phone || typeof phone !== 'string') return [];
        variations.add(phone.trim());
        const basicCleaned = phone.replace(/[^\d+]/g, '');
        variations.add(basicCleaned);
        if (basicCleaned.startsWith('+')) variations.add(basicCleaned.substring(1)); 
        if (basicCleaned.startsWith('234')) variations.add('0' + basicCleaned.substring(3)); 
        if (basicCleaned.startsWith('0')) variations.add('+234' + basicCleaned.substring(1)); 
        if (!basicCleaned.startsWith('+') && !basicCleaned.startsWith('0')) {
            variations.add('+234' + basicCleaned);
            variations.add('0' + basicCleaned);
        }
        return Array.from(variations).filter(v => v.length > 5);
    }

    showDashboardUI() {
        document.getElementById("authArea").classList.add("hidden");
        document.getElementById("reportArea").classList.remove("hidden");
        const welcome = document.getElementById("welcomeMessage");
        if (welcome) welcome.textContent = `Welcome, ${this.currentUser.parentName}!`;
    }

    showAuthScreen() {
        document.getElementById("authArea").classList.remove("hidden");
        document.getElementById("reportArea").classList.add("hidden");
    }

    addNavButtons() {
        const welcomeSection = document.querySelector('.bg-green-50 .flex.gap-2');
        if (!welcomeSection) return;
        welcomeSection.innerHTML = ''; 
        
        const msgBtn = document.createElement('button');
        msgBtn.innerHTML = '📨 Messages';
        msgBtn.className = 'bg-blue-600 text-white px-4 py-2 rounded shadow btn-glow';
        msgBtn.onclick = showMessagesModal;
        welcomeSection.appendChild(msgBtn);
        
        const refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '🔄 Refresh';
        refreshBtn.className = 'bg-green-600 text-white px-4 py-2 rounded shadow ml-2 btn-glow';
        refreshBtn.onclick = () => authManager.loadUserDashboard(auth.currentUser);
        welcomeSection.appendChild(refreshBtn);

        const logoutBtn = document.createElement('button');
        logoutBtn.innerText = '🚪 Logout';
        logoutBtn.className = 'bg-red-600 text-white px-4 py-2 rounded shadow ml-2 btn-glow';
        logoutBtn.onclick = () => auth.signOut();
        welcomeSection.appendChild(logoutBtn);
    }

    cleanup() {
        if (this.authListener) this.authListener();
    }
}

const authManager = new UnifiedAuthManager();

// ============================================================================
// INITIALIZATION & TAB SWITCHING
// ============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Initializing Parent Portal V3 (Full Restore)");
    
    injectCustomCSS();
    createCountryCodeDropdown();
    authManager.initialize();
    
    // Auth Buttons
    document.getElementById("signInBtn")?.addEventListener("click", () => handleSignInFull(
        document.getElementById('loginIdentifier').value, document.getElementById('loginPassword').value, 
        document.getElementById("signInBtn"), document.getElementById("authLoader")
    ));
    document.getElementById("signUpBtn")?.addEventListener("click", () => handleSignUpFull(
        document.getElementById('countryCode').value, document.getElementById('signupPhone').value, 
        document.getElementById('signupEmail').value, document.getElementById('signupPassword').value, 
        document.getElementById('signupConfirmPassword').value, document.getElementById("signUpBtn"), document.getElementById("authLoader")
    ));
    
    // Message Buttons
    document.getElementById("submitMessageBtn")?.addEventListener("click", submitMessage);
    document.getElementById("cancelMessageBtn")?.addEventListener("click", hideComposeMessageModal);
    document.getElementById("cancelMessagesModalBtn")?.addEventListener("click", hideMessagesModal);
    
    // Password Reset
    document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => document.getElementById("passwordResetModal").classList.remove("hidden"));
    document.getElementById("cancelResetBtn")?.addEventListener("click", () => document.getElementById("passwordResetModal").classList.add("hidden"));
    document.getElementById("sendResetBtn")?.addEventListener("click", () => handlePasswordResetFull(document.getElementById("resetEmail").value, document.getElementById("sendResetBtn"), document.getElementById("resetLoader")));

    // Main Tab Logic
    const tabs = { 'reportTab': 'reports', 'academicsTab': 'academics', 'rewardsTab': 'rewards' };
    for (const [id, name] of Object.entries(tabs)) {
        document.getElementById(id)?.addEventListener('click', () => {
            document.querySelectorAll('.tab-active-main').forEach(el => {
                el.classList.remove('tab-active-main');
                el.classList.add('tab-inactive-main');
            });
            document.getElementById(id).classList.add('tab-active-main');
            document.getElementById(id).classList.remove('tab-inactive-main');
            
            ['reportContentArea', 'academicsContentArea', 'rewardsContentArea'].forEach(area => document.getElementById(area).classList.add('hidden'));
            document.getElementById(name === 'reports' ? 'reportContentArea' : name === 'academics' ? 'academicsContentArea' : 'rewardsContentArea').classList.remove('hidden');
            
            if (name === 'academics') loadAcademicsData();
            if (name === 'rewards' && auth.currentUser) loadReferralRewards(auth.currentUser.uid);
        });
    }

    // Sign In/Up Tab Logic
    const signInTab = document.getElementById("signInTab");
    const signUpTab = document.getElementById("signUpTab");
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if(signInTab) signInTab.addEventListener('click', () => {
        signInTab.classList.add('tab-active'); signInTab.classList.remove('tab-inactive');
        signUpTab.classList.remove('tab-active'); signUpTab.classList.add('tab-inactive');
        signInForm.classList.remove('hidden'); signUpForm.classList.add('hidden');
    });

    if(signUpTab) signUpTab.addEventListener('click', () => {
        signUpTab.classList.add('tab-active'); signUpTab.classList.remove('tab-inactive');
        signInTab.classList.remove('tab-active'); signInTab.classList.add('tab-inactive');
        signUpForm.classList.remove('hidden'); signInForm.classList.add('hidden');
    });
});
