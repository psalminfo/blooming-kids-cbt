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

// Load libphonenumber-js for phone number validation
const libphonenumberScript = document.createElement('script');
libphonenumberScript.src = 'https://cdn.jsdelivr.net/npm/libphonenumber-js@1.10.14/bundle/libphonenumber-js.min.js';
document.head.appendChild(libphonenumberScript);

// ==========================================
// UTILITY & HELPER FUNCTIONS
// ==========================================

function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone').parentNode;
    const container = document.createElement('div');
    container.className = 'flex gap-2';
    
    const countryCodeSelect = document.createElement('select');
    countryCodeSelect.id = 'countryCode';
    countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    countryCodeSelect.required = true;

    const countries = [
        { code: '+1', name: 'USA/Canada (+1)' },
        { code: '+234', name: 'Nigeria (+234)' },
        { code: '+44', name: 'UK (+44)' },
        { code: '+233', name: 'Ghana (+233)' },
        { code: '+254', name: 'Kenya (+254)' },
        { code: '+27', name: 'South Africa (+27)' },
        { code: '+91', name: 'India (+91)' },
        { code: '+971', name: 'UAE (+971)' },
        { code: '+966', name: 'Saudi Arabia (+966)' },
        { code: '+20', name: 'Egypt (+20)' },
        { code: '+237', name: 'Cameroon (+237)' },
        { code: '+256', name: 'Uganda (+256)' },
        { code: '+255', name: 'Tanzania (+255)' },
        { code: '+250', name: 'Rwanda (+250)' },
        { code: '+251', name: 'Ethiopia (+251)' },
        { code: '+41', name: 'Switzerland (+41)' },
        { code: '+86', name: 'China (+86)' },
        { code: '+33', name: 'France (+33)' },
        { code: '+49', name: 'Germany (+49)' },
        { code: '+61', name: 'Australia (+61)' },
        { code: '+55', name: 'Brazil (+55)' },
        { code: '+351', name: 'Portugal (+351)' },
        { code: '+34', name: 'Spain (+34)' },
        { code: '+39', name: 'Italy (+39)' },
        { code: '+31', name: 'Netherlands (+31)' },
        { code: '+32', name: 'Belgium (+32)' },
        { code: '+46', name: 'Sweden (+46)' },
        { code: '+47', name: 'Norway (+47)' },
        { code: '+45', name: 'Denmark (+45)' },
        { code: '+358', name: 'Finland (+358)' },
        { code: '+353', name: 'Ireland (+353)' },
        { code: '+48', name: 'Poland (+48)' },
        { code: '+90', name: 'Turkey (+90)' },
        { code: '+961', name: 'Lebanon (+961)' },
        { code: '+962', name: 'Jordan (+962)' },
        { code: '+81', name: 'Japan (+81)' },
        { code: '+82', name: 'South Korea (+82)' },
        { code: '+60', name: 'Malaysia (+60)' },
        { code: '+852', name: 'Hong Kong (+852)' },
        { code: '+52', name: 'Mexico (+52)' }
    ];

    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countryCodeSelect.appendChild(option);
    });

    countryCodeSelect.value = '+1'; // Default
    const phoneInput = document.getElementById('signupPhone');
    phoneInput.placeholder = 'Enter phone number without country code';
    phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    
    container.appendChild(countryCodeSelect);
    container.appendChild(phoneInput);
    phoneInputContainer.appendChild(container);
}

function multiNormalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, country: null, valid: false, error: 'Invalid input' };
    }
    const normalizationAttempts = [];
    try {
        let cleaned = phone.replace(/[^\d+]/g, '');
        // ATTEMPT 1: Standard
        try {
            const parsed1 = libphonenumber.parsePhoneNumberFromString(cleaned);
            if (parsed1 && parsed1.isValid()) {
                normalizationAttempts.push({ normalized: parsed1.format('E.164'), country: parsed1.country, valid: true, attempt: 'standard' });
            }
        } catch (e) {}

        // ATTEMPT 2: Country code correction
        try {
            if (cleaned.match(/^(1)?(469|214|972|713|281|832|210|817)/) && !cleaned.startsWith('+')) {
                const usNumber = '+1' + cleaned.replace(/^1/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(usNumber);
                if (parsed2 && parsed2.isValid()) normalizationAttempts.push({ normalized: parsed2.format('E.164'), country: parsed2.country, valid: true, attempt: 'us_correction' });
            }
            if (cleaned.match(/^(44)?(20|7|1|2|3|8|9)/) && !cleaned.startsWith('+')) {
                const ukNumber = '+44' + cleaned.replace(/^44/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(ukNumber);
                if (parsed2 && parsed2.isValid()) normalizationAttempts.push({ normalized: parsed2.format('E.164'), country: parsed2.country, valid: true, attempt: 'uk_correction' });
            }
            if (cleaned.match(/^(234)?(80|70|81|90|91)/) && !cleaned.startsWith('+')) {
                const ngNumber = '+234' + cleaned.replace(/^234/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(ngNumber);
                if (parsed2 && parsed2.isValid()) normalizationAttempts.push({ normalized: parsed2.format('E.164'), country: parsed2.country, valid: true, attempt: 'nigeria_correction' });
            }
        } catch (e) {}

        // ATTEMPT 3: Area code only
        try {
            const areaCodePatterns = [
                { code: '1', patterns: [/^(469|214|972|713|281|832|210|817)/] },
                { code: '44', patterns: [/^(20|7|1|2|3|8|9)/] },
                { code: '234', patterns: [/^(80|70|81|90|91)/] },
                { code: '33', patterns: [/^(1|2|3|4|5)/] },
                { code: '49', patterns: [/^(15|16|17|17)/] },
                { code: '91', patterns: [/^(98|99|90|80)/] },
            ];
            for (const country of areaCodePatterns) {
                for (const pattern of country.patterns) {
                    if (pattern.test(cleaned) && !cleaned.startsWith('+')) {
                        const correctedNumber = '+' + country.code + cleaned;
                        const parsed3 = libphonenumber.parsePhoneNumberFromString(correctedNumber);
                        if (parsed3 && parsed3.isValid()) {
                            normalizationAttempts.push({ normalized: parsed3.format('E.164'), country: parsed3.country, valid: true, attempt: 'area_code_correction' });
                            break;
                        }
                    }
                }
            }
        } catch (e) {}

        // ATTEMPT 4: Digits only
        try {
            const digitsOnly = cleaned.replace(/\D/g, '');
            if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
                normalizationAttempts.push({ normalized: digitsOnly, country: null, valid: true, attempt: 'digits_only' });
            }
        } catch (e) {}

        if (normalizationAttempts.length > 0) return normalizationAttempts;
        return [{ normalized: null, country: null, valid: false, error: 'No valid normalization found', attempt: 'failed' }];
    } catch (error) {
        return [{ normalized: null, country: null, valid: false, error: error.message, attempt: 'error' }];
    }
}

function cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.trim();
}

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Global variables
let currentUserData = null;
let userChildren = [];
let unreadResponsesCount = 0;
let realTimeListeners = [];

// ==========================================
// REFERRAL SYSTEM
// ==========================================

async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    let code;
    let isUnique = false;
    while (!isUnique) {
        let suffix = '';
        for (let i = 0; i < 6; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        code = prefix + suffix;
        const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snapshot.empty) isUnique = true;
    }
    return code;
}

async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';
    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) {
            rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found. Please sign in again.</p>';
            return;
        }
        const userData = userDoc.data();
        const referralCode = userData.referralCode || 'N/A';
        const totalEarnings = userData.referralEarnings || 0;
        
        const transactionsSnapshot = await db.collection('referral_transactions')
            .where('ownerUid', '==', parentUid)
            .orderBy('timestamp', 'desc')
            .get();
        
        let referralsHtml = '';
        let pendingCount = 0;
        let approvedCount = 0;
        let paidCount = 0;

        if (transactionsSnapshot.empty) {
            referralsHtml = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>`;
        } else {
            transactionsSnapshot.forEach(doc => {
                const data = doc.data();
                const status = data.status || 'pending';
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : 
                                    status === 'approved' ? 'bg-blue-100 text-blue-800' : 
                                    'bg-yellow-100 text-yellow-800';
                
                if (status === 'pending') pendingCount++;
                if (status === 'approved') approvedCount++;
                if (status === 'paid') paidCount++;

                const referredName = capitalize(data.referredStudentName || data.referredStudentPhone);
                const rewardAmount = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
                const referralDate = data.timestamp?.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';

                referralsHtml += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${referredName}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${referralDate}</td>
                        <td class="px-4 py-3 text-sm"><span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">${capitalize(status)}</span></td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${rewardAmount}</td>
                    </tr>`;
            });
        }
        
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2">Share this code with other parents. They use it when registering their child, and you earn **₦5,000** once their child completes their first month!</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600">
                    <p class="text-sm font-medium text-yellow-700">Approved (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600">
                    <p class="text-sm font-medium text-gray-700">Successful (Paid)</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred Parent/Student</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Used</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">${referralsHtml}</tbody>
                </table>
            </div>`;
    } catch (error) {
        console.error('Error loading referral rewards:', error);
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">An error occurred while loading your rewards data. Please try again later.</p>';
    }
}

// ==========================================
// AUTH & USER MANAGEMENT
// ==========================================

function setupRememberMe() {
    const rememberMe = localStorage.getItem('rememberMe');
    const savedEmail = localStorage.getItem('savedEmail');
    if (rememberMe === 'true' && savedEmail) {
        document.getElementById('loginIdentifier').value = savedEmail;
        document.getElementById('rememberMe').checked = true;
    }
}

function handleRememberMe() {
    const rememberMe = document.getElementById('rememberMe').checked;
    const identifier = document.getElementById('loginIdentifier').value.trim();
    if (rememberMe && identifier) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', identifier);
    } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
    }
}

function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [];
    const weaknesses = [];
    results.forEach(res => {
        const percentage = res.total > 0 ? (res.correct / res.total) * 100 : 0;
        const topicList = res.topics.length > 0 ? res.topics : [res.subject];
        if (percentage >= 75) strengths.push(...topicList);
        else if (percentage < 50) weaknesses.push(...topicList);
    });
    const uniqueStrengths = [...new Set(strengths)];
    const uniqueWeaknesses = [...new Set(weaknesses)];

    let praiseClause = "";
    if (uniqueStrengths.length > 2) praiseClause = `It was great to see ${studentName} demonstrate a solid understanding of several key concepts, particularly in areas like ${uniqueStrengths[0]} and ${uniqueStrengths[1]}. `;
    else if (uniqueStrengths.length > 0) praiseClause = `${studentName} showed strong potential, especially in the topic of ${uniqueStrengths.join(', ')}. `;
    else praiseClause = `${studentName} has put in a commendable effort on this initial assessment. `;

    let improvementClause = "";
    if (uniqueWeaknesses.length > 2) improvementClause = `Our next step will be to focus on building more confidence in a few areas, such as ${uniqueWeaknesses[0]} and ${uniqueWeaknesses[1]}. `;
    else if (uniqueWeaknesses.length > 0) improvementClause = `To continue this positive progress, our focus will be on the topic of ${uniqueWeaknesses.join(', ')}. `;
    else improvementClause = "We will continue to build on these fantastic results and explore more advanced topics. ";

    return praiseClause + improvementClause + `With personalized support from their tutor, ${tutorName}, at Blooming Kids House, we are very confident that ${studentName} will master these skills and unlock their full potential.`;
}

async function findParentNameFromStudents(parentPhone) {
    try {
        const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
        const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
        for (const version of validVersions) {
            const studentsSnapshot = await db.collection("students").where("normalizedParentPhone", "==", version.normalized).limit(1).get();
            if (!studentsSnapshot.empty) return studentsSnapshot.docs[0].data().parentName;
            
            const pendingStudentsSnapshot = await db.collection("pending_students").where("normalizedParentPhone", "==", version.normalized).limit(1).get();
            if (!pendingStudentsSnapshot.empty) return pendingStudentsSnapshot.docs[0].data().parentName;
            
            const fallbackStudentsSnapshot = await db.collection("students").where("parentPhone", "==", version.normalized).limit(1).get();
            if (!fallbackStudentsSnapshot.empty) return fallbackStudentsSnapshot.docs[0].data().parentName;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function handleSignUp() {
    const countryCode = document.getElementById('countryCode').value;
    const localPhone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!countryCode || !localPhone || !email || !password || !confirmPassword) {
        showMessage('Please fill in all fields including country code', 'error');
        return;
    }
    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }
    const fullPhoneNumber = countryCode + localPhone.replace(/\D/g, '');
    const phoneValidations = multiNormalizePhoneNumber(fullPhoneNumber);
    const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
    if (validVersions.length === 0) {
        showMessage('Invalid phone number format.', 'error');
        return;
    }
    const normalizedPhone = validVersions[0].normalized;
    
    const signUpBtn = document.getElementById('signUpBtn');
    const authLoader = document.getElementById('authLoader');
    signUpBtn.disabled = true;
    document.getElementById('signUpText').textContent = 'Creating Account...';
    document.getElementById('signUpSpinner').classList.remove('hidden');
    authLoader.classList.remove('hidden');

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const parentName = await findParentNameFromStudents(normalizedPhone);
        const referralCode = await generateReferralCode();
        
        await db.collection('parent_users').doc(user.uid).set({
            phone: fullPhoneNumber,
            normalizedPhone: normalizedPhone,
            countryCode: countryCode,
            localPhone: localPhone,
            email: email,
            parentName: parentName || 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
        });
        showMessage('Account created successfully!', 'success');
        await loadAllReportsForParent(normalizedPhone, user.uid);
    } catch (error) {
        let errorMessage = 'Account creation failed. ';
        if(error.code === 'auth/email-already-in-use') errorMessage += 'Email already in use.';
        else if(error.code === 'auth/invalid-email') errorMessage += 'Invalid email.';
        else errorMessage += error.message;
        showMessage(errorMessage, 'error');
    } finally {
        signUpBtn.disabled = false;
        document.getElementById('signUpText').textContent = 'Create Account';
        document.getElementById('signUpSpinner').classList.add('hidden');
        authLoader.classList.add('hidden');
    }
}

async function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!identifier || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    const signInBtn = document.getElementById('signInBtn');
    const authLoader = document.getElementById('authLoader');
    signInBtn.disabled = true;
    document.getElementById('signInText').textContent = 'Signing In...';
    document.getElementById('signInSpinner').classList.remove('hidden');
    authLoader.classList.remove('hidden');

    try {
        let userCredential, userPhone, userId, normalizedPhone;
        
        if (identifier.includes('@')) {
            userCredential = await auth.signInWithEmailAndPassword(identifier, password);
            userId = userCredential.user.uid;
            const userDoc = await db.collection('parent_users').doc(userId).get();
            if (userDoc.exists) {
                userPhone = userDoc.data().phone;
                normalizedPhone = userDoc.data().normalizedPhone;
            }
        } else {
            const phoneValidations = multiNormalizePhoneNumber(identifier);
            const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
            if (validVersions.length === 0) throw new Error(`Invalid phone number format.`);
            normalizedPhone = validVersions[0].normalized;
            
            let userFound = false;
            for (const version of validVersions) {
                const userQuery = await db.collection('parent_users').where('normalizedPhone', '==', version.normalized).limit(1).get();
                if (!userQuery.empty) {
                    const userData = userQuery.docs[0].data();
                    userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
                    userPhone = userData.phone;
                    userId = userCredential.user.uid;
                    userFound = true;
                    break;
                }
            }
            if (!userFound) {
                const fallbackQuery = await db.collection('parent_users').where('phone', '==', identifier).limit(1).get();
                if (fallbackQuery.empty) throw new Error('No account found with this phone number');
                const userData = fallbackQuery.docs[0].data();
                userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
                userPhone = identifier;
                userId = userCredential.user.uid;
            }
        }

        if (!normalizedPhone && userPhone) {
            const phoneValidations = multiNormalizePhoneNumber(userPhone);
            const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
            if (validVersions.length > 0) normalizedPhone = validVersions[0].normalized;
        }

        if (!normalizedPhone) throw new Error('Could not retrieve valid phone number for user');
        
        handleRememberMe();
        await loadAllReportsForParent(normalizedPhone, userId);
    } catch (error) {
        let errorMessage = 'Sign in failed. ';
        if(error.code === 'auth/user-not-found') errorMessage += 'No account found.';
        else if(error.code === 'auth/wrong-password') errorMessage += 'Incorrect password.';
        else errorMessage += error.message;
        showMessage(errorMessage, 'error');
    } finally {
        signInBtn.disabled = false;
        document.getElementById('signInText').textContent = 'Sign In';
        document.getElementById('signInSpinner').classList.add('hidden');
        authLoader.classList.add('hidden');
    }
}

async function handlePasswordReset() {
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }
    const sendResetBtn = document.getElementById('sendResetBtn');
    const resetLoader = document.getElementById('resetLoader');
    sendResetBtn.disabled = true;
    resetLoader.classList.remove('hidden');
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email.', 'success');
        document.getElementById('passwordResetModal').classList.add('hidden');
    } catch (error) {
        showMessage('Failed to send reset email: ' + error.message, 'error');
    } finally {
        sendResetBtn.disabled = false;
        resetLoader.classList.add('hidden');
    }
}

// ==========================================
// FEEDBACK & MESSAGING
// ==========================================

function showFeedbackModal() {
    populateStudentDropdown();
    document.getElementById('feedbackModal').classList.remove('hidden');
}

function hideFeedbackModal() {
    document.getElementById('feedbackModal').classList.add('hidden');
    document.getElementById('feedbackCategory').value = '';
    document.getElementById('feedbackPriority').value = '';
    document.getElementById('feedbackStudent').value = '';
    document.getElementById('feedbackMessage').value = '';
}

function populateStudentDropdown() {
    const studentDropdown = document.getElementById('feedbackStudent');
    studentDropdown.innerHTML = '<option value="">Select student</option>';
    // Find student names from the new accordion headers
    const studentHeaders = document.querySelectorAll('.student-accordion-btn span:first-child');
    if (studentHeaders.length === 0) {
        studentDropdown.innerHTML += '<option value="" disabled>No students found - please wait for reports to load</option>';
        return;
    }
    studentHeaders.forEach(header => {
        const studentName = header.textContent.trim();
        const option = document.createElement('option');
        option.value = studentName;
        option.textContent = studentName;
        studentDropdown.appendChild(option);
    });
}

async function submitFeedback() {
    const category = document.getElementById('feedbackCategory').value;
    const priority = document.getElementById('feedbackPriority').value;
    const student = document.getElementById('feedbackStudent').value;
    const message = document.getElementById('feedbackMessage').value;

    if (!category || !priority || !student || !message) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }
    if (message.length < 10) {
        showMessage('Please provide a more detailed message', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitFeedbackBtn');
    submitBtn.disabled = true;
    document.getElementById('submitFeedbackText').textContent = 'Submitting...';
    document.getElementById('submitFeedbackSpinner').classList.remove('hidden');

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in to submit feedback');
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        await db.collection('parent_feedback').add({
            parentName: currentUserData?.parentName || userData.parentName || 'Unknown Parent',
            parentPhone: userData.phone,
            parentEmail: userData.email,
            studentName: student,
            category: category,
            priority: priority,
            message: message,
            status: 'New',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            emailSent: false,
            parentUid: user.uid,
            responses: []
        });
        showMessage('Feedback submitted successfully.', 'success');
        hideFeedbackModal();
    } catch (error) {
        showMessage('Failed to submit feedback.', 'error');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('submitFeedbackText').textContent = 'Submit Feedback';
        document.getElementById('submitFeedbackSpinner').classList.add('hidden');
    }
}

function showResponsesModal() {
    document.getElementById('responsesModal').classList.remove('hidden');
    loadAdminResponses();
    resetNotificationCount();
}

function hideResponsesModal() {
    document.getElementById('responsesModal').classList.add('hidden');
}

async function loadAdminResponses() {
    const responsesContent = document.getElementById('responsesContent');
    responsesContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading responses...</p></div>';
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in');
        const feedbackSnapshot = await db.collection('parent_feedback').where('parentUid', '==', user.uid).get();
        
        if (feedbackSnapshot.empty) {
            responsesContent.innerHTML = `<div class="text-center py-12"><div class="text-6xl mb-4">📭</div><h3 class="text-xl font-bold text-gray-700 mb-2">No Responses Yet</h3><p class="text-gray-500 max-w-md mx-auto">We'll respond within 24-48 hours.</p></div>`;
            return;
        }

        const feedbackWithResponses = [];
        feedbackSnapshot.forEach(doc => {
            const feedback = { id: doc.id, ...doc.data() };
            if (feedback.responses && feedback.responses.length > 0) feedbackWithResponses.push(feedback);
        });

        if (feedbackWithResponses.length === 0) {
            responsesContent.innerHTML = `<div class="text-center py-12"><div class="text-6xl mb-4">📭</div><h3 class="text-xl font-bold text-gray-700 mb-2">No Responses Yet</h3><p class="text-gray-500 max-w-md mx-auto">We'll respond within 24-48 hours.</p></div>`;
            return;
        }

        feedbackWithResponses.sort((a, b) => {
            const aDate = a.responses[0]?.responseDate?.toDate() || new Date(0);
            const bDate = b.responses[0]?.responseDate?.toDate() || new Date(0);
            return bDate - aDate;
        });

        responsesContent.innerHTML = '';
        feedbackWithResponses.forEach((feedback) => {
            feedback.responses.forEach((response) => {
                const responseDate = response.responseDate?.toDate() || feedback.timestamp?.toDate() || new Date();
                const formattedDate = responseDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                responsesContent.innerHTML += `
                    <div class="bg-white border border-gray-200 rounded-xl p-6 mb-4 shadow-sm">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex flex-wrap gap-2">
                                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getCategoryColor(feedback.category)}">${feedback.category}</span>
                                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(feedback.priority)}">${feedback.priority} Priority</span>
                            </div>
                            <span class="text-sm text-gray-500">${formattedDate}</span>
                        </div>
                        <div class="mb-4">
                            <h4 class="font-semibold text-gray-800 mb-2">Regarding: ${feedback.studentName}</h4>
                            <p class="text-gray-700 bg-gray-50 p-4 rounded-lg border italic">"${feedback.message}"</p>
                        </div>
                        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                            <div class="font-bold text-blue-800 mb-1">📨 Response from ${response.responderName || 'Admin'}:</div>
                            <p class="text-gray-700">${response.responseText}</p>
                        </div>
                    </div>`;
            });
        });
    } catch (error) {
        responsesContent.innerHTML = `<div class="text-center py-8"><div class="text-4xl mb-4">❌</div><h3 class="text-xl font-bold text-red-700 mb-2">Error</h3><p class="text-gray-500">Unable to load responses.</p></div>`;
    }
}

async function checkForNewResponses() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const feedbackSnapshot = await db.collection('parent_feedback').where('parentUid', '==', user.uid).get();
        let totalResponses = 0;
        feedbackSnapshot.forEach(doc => {
            const feedback = doc.data();
            if (feedback.responses && feedback.responses.length > 0) totalResponses += feedback.responses.length;
        });
        updateNotificationBadge(totalResponses);
        unreadResponsesCount = totalResponses;
    } catch (error) {
        console.error('Error checking responses:', error);
    }
}

function updateNotificationBadge(count) {
    let badge = document.getElementById('responseNotificationBadge');
    const viewResponsesBtn = document.getElementById('viewResponsesBtn');
    if (!viewResponsesBtn) return;
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'responseNotificationBadge';
        badge.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-6 h-6 flex items-center justify-center font-bold animate-pulse';
        viewResponsesBtn.style.position = 'relative';
        viewResponsesBtn.appendChild(badge);
    }
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function resetNotificationCount() {
    updateNotificationBadge(0);
    unreadResponsesCount = 0;
}

function getCategoryColor(category) {
    const colors = { 'Feedback': 'bg-blue-100 text-blue-800', 'Request': 'bg-green-100 text-green-800', 'Complaint': 'bg-red-100 text-red-800', 'Suggestion': 'bg-purple-100 text-purple-800' };
    return colors[category] || 'bg-gray-100 text-gray-800';
}

function getPriorityColor(priority) {
    const colors = { 'Low': 'bg-gray-100 text-gray-800', 'Medium': 'bg-yellow-100 text-yellow-800', 'High': 'bg-orange-100 text-orange-800', 'Urgent': 'bg-red-100 text-red-800' };
    return colors[priority] || 'bg-gray-100 text-gray-800';
}

function addViewResponsesButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer || document.getElementById('viewResponsesBtn')) return;
    
    const viewResponsesBtn = document.createElement('button');
    viewResponsesBtn.id = 'viewResponsesBtn';
    viewResponsesBtn.onclick = showResponsesModal;
    viewResponsesBtn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 btn-glow flex items-center justify-center relative';
    viewResponsesBtn.innerHTML = '<span class="mr-2">📨</span> View Responses';
    
    buttonContainer.insertBefore(viewResponsesBtn, buttonContainer.lastElementChild);
    setTimeout(() => checkForNewResponses(), 1000);
}

// ==========================================
// SEARCH & MONITORING LOGIC
// ==========================================

async function performMultiLayerSearch(parentPhone, parentEmail, userId) {
    console.log("🔍 Starting multi-layer search for:", parentPhone);
    let assessmentResults = [];
    let monthlyResults = [];
    
    try {
        const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
        const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
        
        // Helper to perform queries and avoid dupes
        const fetchResults = async (collection, type, resultsArray) => {
             // 1. Normalized Phone
            for (const version of validVersions) {
                let snapshot = await db.collection(collection).where("normalizedParentPhone", "==", version.normalized).get();
                if (!snapshot.empty) {
                    snapshot.forEach(doc => {
                        if (!resultsArray.some(r => r.id === doc.id)) {
                            resultsArray.push({ id: doc.id, ...doc.data(), timestamp: doc.data().submittedAt?.seconds || Date.now() / 1000, type: type });
                        }
                    });
                    return true; // Found results
                }
            }
            // 2. Original Phone
            for (const version of validVersions) {
                let snapshot = await db.collection(collection).where("parentPhone", "==", version.normalized).get();
                if (!snapshot.empty) {
                    snapshot.forEach(doc => {
                        if (!resultsArray.some(r => r.id === doc.id)) {
                             resultsArray.push({ id: doc.id, ...doc.data(), timestamp: doc.data().submittedAt?.seconds || Date.now() / 1000, type: type });
                        }
                    });
                    return true;
                }
            }
            // 3. Email
            if (parentEmail) {
                let snapshot = await db.collection(collection).where("parentEmail", "==", parentEmail).get();
                if (!snapshot.empty) {
                    snapshot.forEach(doc => {
                        if (!resultsArray.some(r => r.id === doc.id)) {
                             resultsArray.push({ id: doc.id, ...doc.data(), timestamp: doc.data().submittedAt?.seconds || Date.now() / 1000, type: type });
                        }
                    });
                }
            }
        };

        await fetchResults("student_results", 'assessment', assessmentResults);
        await fetchResults("tutor_submissions", 'monthly', monthlyResults);

    } catch (error) {
        console.error("❌ Error during multi-layer search:", error);
    }
    return { assessmentResults, monthlyResults };
}

function setupRealTimeMonitoring(parentPhone, parentEmail, userId) {
    cleanupRealTimeListeners();
    console.log("🔍 Setting up real-time monitoring...");
    const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
    const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
    
    const monitor = (collection, type) => {
        validVersions.forEach(version => {
            const listener = db.collection(collection).where("normalizedParentPhone", "==", version.normalized)
                .onSnapshot((snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === "added") {
                            showNewReportNotification(type);
                            setTimeout(() => loadAllReportsForParent(parentPhone, userId), 2000);
                        }
                    });
                });
            realTimeListeners.push(listener);
        });
        if (parentEmail) {
             const listener = db.collection(collection).where("parentEmail", "==", parentEmail)
                .onSnapshot((snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === "added") {
                            showNewReportNotification(type);
                            setTimeout(() => loadAllReportsForParent(parentPhone, userId), 2000);
                        }
                    });
                });
            realTimeListeners.push(listener);
        }
    };

    monitor("student_results", 'assessment');
    monitor("tutor_submissions", 'monthly');
}

function cleanupRealTimeListeners() {
    realTimeListeners.forEach(unsubscribe => { if (typeof unsubscribe === 'function') unsubscribe(); });
    realTimeListeners = [];
}

function showNewReportNotification(type) {
    const reportType = type === 'assessment' ? 'Assessment Report' : 'Monthly Report';
    showMessage(`New ${reportType} available! Loading now...`, 'success');
}

async function manualRefreshReports() {
    const user = auth.currentUser;
    if (!user) return;
    const refreshBtn = document.getElementById('manualRefreshBtn');
    const originalText = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Checking...';
    refreshBtn.disabled = true;
    try {
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userPhone = userData.normalizedPhone || userData.phone;
            await loadAllReportsForParent(userPhone, user.uid, true);
            showMessage('Reports refreshed successfully!', 'success');
        }
    } catch (error) {
        showMessage('Refresh failed.', 'error');
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

function addManualRefreshButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer || document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = manualRefreshReports;
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
    refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Check for New Reports';
    buttonContainer.insertBefore(refreshBtn, buttonContainer.lastElementChild);
}

// ==========================================
// ACCORDION UI HELPERS
// ==========================================

function toggleAccordion(id) {
    const element = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);
    if (element.classList.contains('hidden')) {
        element.classList.remove('hidden');
        if(icon) icon.style.transform = 'rotate(180deg)';
    } else {
        element.classList.add('hidden');
        if(icon) icon.style.transform = 'rotate(0deg)';
    }
}

// ==========================================
// MAIN REPORT LOADING ENGINE
// ==========================================

async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    authLoader.classList.remove("hidden");
    
    try {
        // --- CACHE ---
        const cacheKey = `reportCache_${parentPhone}`;
        const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
        if (!forceRefresh) {
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { timestamp, html, chartConfigs, userData } = JSON.parse(cachedItem);
                    if (Date.now() - timestamp < twoWeeksInMillis) {
                        console.log("Loading reports from cache.");
                        reportContent.innerHTML = html;
                        if (userData && userData.parentName) {
                            welcomeMessage.textContent = `Welcome, ${userData.parentName}!`;
                            currentUserData = userData;
                        }
                        if (chartConfigs && chartConfigs.length > 0) {
                            setTimeout(() => {
                                chartConfigs.forEach(chart => {
                                    const ctx = document.getElementById(chart.canvasId);
                                    if (ctx) new Chart(ctx, chart.config);
                                });
                            }, 0);
                        }
                        authArea.classList.add("hidden");
                        reportArea.classList.remove("hidden");
                        addViewResponsesButton();
                        addManualRefreshButton();
                        loadReferralRewards(userId);
                        return;
                    }
                }
            } catch (e) { localStorage.removeItem(cacheKey); }
        }

        // --- FETCH DATA ---
        let parentName = await findParentNameFromStudents(parentPhone);
        const userDocRef = db.collection('parent_users').doc(userId);
        let userDoc = await userDocRef.get();
        let userData = userDoc.data();
        const parentEmail = userData.email;

        // Auto-assign referral if missing
        if (!userData.referralCode) {
            const newReferralCode = await generateReferralCode();
            await userDocRef.update({ referralCode: newReferralCode, referralEarnings: userData.referralEarnings || 0 });
            userDoc = await userDocRef.get();
            userData = userDoc.data();
        }

        if (!parentName && userData.parentName) parentName = userData.parentName;
        if (!parentName) parentName = 'Parent';
        currentUserData = { parentName: parentName, parentPhone: parentPhone };
        welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;
        if (userData.parentName !== parentName) await userDocRef.update({ parentName: parentName });

        const { assessmentResults, monthlyResults } = await performMultiLayerSearch(parentPhone, parentEmail, userId);
        setupRealTimeMonitoring(parentPhone, parentEmail, userId);

        if (assessmentResults.length === 0 && monthlyResults.length === 0) {
            // EMPTY STATE
            reportContent.innerHTML = `
                <div class="text-center py-16 bg-white rounded-xl shadow-lg border border-gray-100">
                    <div class="text-6xl mb-6 animate-pulse">📊</div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">Waiting for Your Child's First Report</h2>
                    <p class="text-gray-600 max-w-2xl mx-auto mb-6">No reports found yet. This usually means the tutor hasn't submitted their first assessment or monthly report yet.</p>
                    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
                        <button onclick="manualRefreshReports()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center">
                            <span class="mr-2">🔄</span> Check Now
                        </button>
                    </div>
                </div>`;
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
            addViewResponsesButton();
            addManualRefreshButton();
            loadReferralRewards(userId);
            return;
        }

        // --- STRUCTURE DATA FOR ACCORDION (Student -> Year -> Type -> Reports) ---
        reportContent.innerHTML = "";
        const chartConfigsToCache = [];
        const structuredData = {};

        // Helper to process assessment structure
        assessmentResults.forEach(res => {
            const student = capitalize(res.studentName || 'Unknown Student');
            const date = new Date(res.timestamp * 1000);
            const year = date.getFullYear().toString();
            
            if (!structuredData[student]) structuredData[student] = {};
            if (!structuredData[student][year]) structuredData[student][year] = { assessments: [], monthly: [] };
            
            structuredData[student][year].assessments.push(res);
        });

        // Helper to process monthly structure
        monthlyResults.forEach(res => {
            const student = capitalize(res.studentName || 'Unknown Student');
            const date = new Date(res.timestamp * 1000);
            const year = date.getFullYear().toString();

            if (!structuredData[student]) structuredData[student] = {};
            if (!structuredData[student][year]) structuredData[student][year] = { assessments: [], monthly: [] };
            
            structuredData[student][year].monthly.push(res);
        });

        // --- RENDER HTML ---
        let studentIdx = 0;
        for (const [studentName, yearsData] of Object.entries(structuredData)) {
            const studentId = `student-${studentIdx}`;
            
            // STUDENT HEADER (Level 1)
            let studentHtml = `
            <div class="mb-6 border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <button onclick="toggleAccordion('${studentId}')" class="student-accordion-btn w-full flex justify-between items-center p-5 bg-gradient-to-r from-green-50 to-white hover:bg-green-100 transition-colors">
                    <span class="text-xl font-bold text-green-900 flex items-center gap-3">
                        <span class="bg-green-200 text-green-800 p-2 rounded-lg">🎓</span> ${studentName}
                    </span>
                    <svg id="icon-${studentId}" class="w-6 h-6 text-green-700 transform transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div id="${studentId}" class="hidden bg-white p-4">
            `;

            // Sort years descending
            const years = Object.keys(yearsData).sort((a, b) => b - a);

            years.forEach((year, yearIdx) => {
                const yearId = `${studentId}-year-${year}`;
                const reports = yearsData[year];
                const assessmentCount = reports.assessments.length;
                const monthlyCount = reports.monthly.length;

                // YEAR HEADER (Level 2)
                studentHtml += `
                <div class="mb-4 ml-2 border-l-4 border-green-300 rounded-r-lg bg-gray-50">
                    <button onclick="toggleAccordion('${yearId}')" class="w-full flex justify-between items-center p-4 hover:bg-gray-100 transition-colors text-left">
                        <div>
                            <span class="text-lg font-bold text-gray-700 block">${year}</span>
                            <span class="text-xs text-gray-500 font-medium">${assessmentCount} Assessments • ${monthlyCount} Monthly Reports</span>
                        </div>
                        <svg id="icon-${yearId}" class="w-5 h-5 text-gray-500 transform transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div id="${yearId}" class="hidden p-4 space-y-6">
                `;

                // ASSESSMENTS GRID
                if (assessmentCount > 0) {
                    studentHtml += `
                        <div>
                            <h4 class="text-sm uppercase tracking-wide text-gray-500 font-bold mb-3 border-b pb-2">📊 Assessment Reports</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    `;
                    
                    // Group assessments by session (same day)
                    const uniqueSessions = new Map();
                    reports.assessments.forEach(r => {
                        const sessionKey = Math.floor(r.timestamp / 86400); 
                        if (!uniqueSessions.has(sessionKey)) uniqueSessions.set(sessionKey, []);
                        uniqueSessions.get(sessionKey).push(r);
                    });

                    let sessionIdx = 0;
                    for (const [key, session] of uniqueSessions) {
                        // Calculate session stats
                        const date = new Date(session[0].timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        const fullDate = new Date(session[0].timestamp * 1000).toLocaleDateString();
                        
                        // Process scores for chart and display
                        const subjects = session.map(t => t.subject);
                        const scores = session.map(t => t.score || t.correct || 0);
                        const totals = session.map(t => t.totalScoreableQuestions || t.total || 0);
                        const totalScore = scores.reduce((a, b) => a + b, 0);
                        const maxScore = totals.reduce((a, b) => a + b, 0);
                        const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
                        
                        // Badge Color
                        let badgeColor = 'bg-red-100 text-red-800';
                        if (percentage >= 75) badgeColor = 'bg-green-100 text-green-800';
                        else if (percentage >= 50) badgeColor = 'bg-yellow-100 text-yellow-800';

                        // Unique ID for chart
                        const chartId = `chart-${studentIdx}-${yearIdx}-${sessionIdx}`;
                        const divId = `assessment-${studentIdx}-${yearIdx}-${sessionIdx}`;

                        studentHtml += `
                            <div class="bg-white border rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col" id="${divId}">
                                <div class="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                                    <span class="font-bold text-gray-700">${date}</span>
                                    <span class="px-2 py-1 rounded text-xs font-bold ${badgeColor}">${percentage}% Score</span>
                                </div>
                                <div class="p-4 flex-grow">
                                    <canvas id="${chartId}" class="w-full h-32 mb-2"></canvas>
                                    <div class="space-y-1 text-sm text-gray-600 mt-2">
                                        <p><strong>Subjects:</strong> ${subjects.join(', ').substring(0, 30)}${subjects.join(', ').length > 30 ? '...' : ''}</p>
                                        <p><strong>Tutor:</strong> ${session[0].tutorEmail ? 'Assigned' : 'N/A'}</p>
                                    </div>
                                </div>
                                <div class="p-4 bg-gray-50 rounded-b-lg mt-auto text-center">
                                    <button onclick="downloadSessionReport(${studentIdx}, ${yearIdx}, ${sessionIdx}, '${studentName}', 'assessment', '${divId}')" class="text-green-600 hover:text-green-800 font-semibold text-sm flex items-center justify-center w-full">
                                        📄 Download PDF
                                    </button>
                                </div>
                                <div class="hidden detailed-pdf-content">
                                    <div class="p-8">
                                        <div class="text-center mb-6"><h1 class="text-2xl font-bold">Assessment Report - ${fullDate}</h1><p>${studentName}</p></div>
                                        <table class="w-full border-collapse border mb-4">
                                            <tr class="bg-gray-100"><th class="border p-2">Subject</th><th class="border p-2">Score</th></tr>
                                            ${session.map((s, i) => `<tr><td class="border p-2">${s.subject}</td><td class="border p-2">${scores[i]}/${totals[i]}</td></tr>`).join('')}
                                        </table>
                                        <p class="mt-4"><strong>Recommendation:</strong> ${generateTemplatedRecommendation(studentName, 'Tutor', session.map((s,i) => ({subject:s.subject, correct:scores[i], total:totals[i], topics:s.answers?.map(a=>a.topic)||[]} )))}</p>
                                    </div>
                                </div>
                            </div>
                        `;

                        // Add chart config
                        chartConfigsToCache.push({
                            canvasId: chartId,
                            config: {
                                type: 'doughnut',
                                data: {
                                    labels: ['Correct', 'Incorrect'],
                                    datasets: [{
                                        data: [totalScore, maxScore - totalScore],
                                        backgroundColor: ['#4CAF50', '#eeeeee'],
                                        borderWidth: 0
                                    }]
                                },
                                options: { cutout: '70%', plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
                            }
                        });
                        sessionIdx++;
                    }
                    studentHtml += `</div></div>`;
                }

                // MONTHLY REPORTS GRID
                if (monthlyCount > 0) {
                    studentHtml += `
                        <div class="mt-6">
                            <h4 class="text-sm uppercase tracking-wide text-gray-500 font-bold mb-3 border-b pb-2">📅 Monthly Reports</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    `;
                    
                    reports.monthly.forEach((report, mIdx) => {
                        const date = new Date(report.timestamp * 1000).toLocaleDateString('en-US', { month: 'long' });
                        const divId = `monthly-${studentIdx}-${yearIdx}-${mIdx}`;
                        
                        studentHtml += `
                            <div class="bg-white border rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col group relative overflow-hidden" id="${divId}">
                                <div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                <div class="p-5 flex-grow">
                                    <h3 class="text-xl font-bold text-gray-800 mb-1">${date}</h3>
                                    <p class="text-xs text-gray-500 uppercase tracking-wider mb-4">Monthly Learning Summary</p>
                                    <p class="text-sm text-gray-600 line-clamp-3 italic">"${report.introduction || report.generalComments || 'Progress report available.'}"</p>
                                </div>
                                <div class="p-4 bg-gray-50 border-t flex justify-between items-center">
                                    <span class="text-xs text-gray-500">By: ${report.tutorName || 'Tutor'}</span>
                                    <button onclick="downloadMonthlyReportGlobal('${divId}', '${studentName}', '${date}')" class="text-blue-600 hover:text-blue-800 font-semibold text-sm">
                                        Download PDF ⬇️
                                    </button>
                                </div>
                                <div class="hidden detailed-pdf-content">
                                    <div class="p-8">
                                        <h1 class="text-2xl font-bold mb-4">Monthly Report: ${date}</h1>
                                        <div class="mb-4"><strong>Student:</strong> ${studentName}</div>
                                        ${report.introduction ? `<div class="mb-4"><h3 class="font-bold">Introduction</h3><p>${report.introduction}</p></div>` : ''}
                                        ${report.topics ? `<div class="mb-4"><h3 class="font-bold">Topics</h3><p>${report.topics}</p></div>` : ''}
                                        ${report.progress ? `<div class="mb-4"><h3 class="font-bold">Progress</h3><p>${report.progress}</p></div>` : ''}
                                        ${report.recommendations ? `<div class="mb-4"><h3 class="font-bold">Recommendations</h3><p>${report.recommendations}</p></div>` : ''}
                                        <div class="mt-8 border-t pt-4">Tutor: ${report.tutorName}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    studentHtml += `</div></div>`;
                }

                studentHtml += `</div></div>`; // End Year Accordion
            });

            studentHtml += `</div></div>`; // End Student Accordion
            reportContent.innerHTML += studentHtml;
            studentIdx++;
        }

        // --- CACHE SAVE ---
        try {
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                html: reportContent.innerHTML,
                chartConfigs: chartConfigsToCache,
                userData: currentUserData
            }));
        } catch (e) {}

        // --- RENDER CHARTS ---
        setTimeout(() => {
            chartConfigsToCache.forEach(chart => {
                const ctx = document.getElementById(chart.canvasId);
                if (ctx) new Chart(ctx, chart.config);
            });
            // Open first student by default
            if(document.querySelector('.student-accordion-btn')) {
                // toggleAccordion('student-0'); // Optional: auto-open first
            }
        }, 100);

        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        addViewResponsesButton();
        addManualRefreshButton();
        loadReferralRewards(userId);

    } catch (error) {
        console.error("Error loading reports:", error);
        showMessage("Error loading reports.", "error");
    } finally {
        authLoader.classList.add("hidden");
    }
}

// ==========================================
// DOWNLOAD HANDLERS
// ==========================================

function downloadSessionReport(sIdx, yIdx, sessIdx, studentName, type, elementId) {
    const container = document.getElementById(elementId);
    const hiddenContent = container.querySelector('.detailed-pdf-content');
    
    // Temporarily make visible for PDF generation
    const printArea = document.createElement('div');
    printArea.innerHTML = hiddenContent.innerHTML;
    printArea.style.background = 'white';
    printArea.style.padding = '20px';
    printArea.style.width = '800px';
    document.body.appendChild(printArea);

    const fileName = `Assessment_Report_${studentName.replace(/ /g, '_')}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    
    html2pdf().from(printArea).set(opt).save().then(() => {
        document.body.removeChild(printArea);
    });
}

function downloadMonthlyReportGlobal(elementId, studentName, dateStr) {
    const container = document.getElementById(elementId);
    const hiddenContent = container.querySelector('.detailed-pdf-content');
    
    const printArea = document.createElement('div');
    printArea.innerHTML = hiddenContent.innerHTML;
    printArea.style.background = 'white';
    printArea.style.padding = '20px';
    printArea.style.width = '800px';
    document.body.appendChild(printArea);

    const fileName = `Monthly_Report_${studentName}_${dateStr}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    
    html2pdf().from(printArea).set(opt).save().then(() => {
        document.body.removeChild(printArea);
    });
}

// ==========================================
// UI UTILS
// ==========================================

function logout() {
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    cleanupRealTimeListeners();
    auth.signOut().then(() => window.location.reload());
}

function showMessage(message, type) {
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) existingMessage.remove();
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white`;
    messageDiv.textContent = `BKH says: ${message}`;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 5000);
}

function switchTab(tab) {
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if (tab === 'signin') {
        signInTab.classList.replace('tab-inactive', 'tab-active');
        signUpTab.classList.replace('tab-active', 'tab-inactive');
        signInForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
    } else {
        signUpTab.classList.replace('tab-inactive', 'tab-active');
        signInTab.classList.replace('tab-active', 'tab-inactive');
        signUpForm.classList.remove('hidden');
        signInForm.classList.add('hidden');
    }
}

function switchMainTab(tab) {
    const reportTab = document.getElementById('reportTab');
    const rewardsTab = document.getElementById('rewardsTab');
    const reportContentArea = document.getElementById('reportContentArea');
    const rewardsContentArea = document.getElementById('rewardsContentArea');
    
    reportTab?.classList.replace('tab-active-main', 'tab-inactive-main');
    rewardsTab?.classList.replace('tab-active-main', 'tab-inactive-main');
    reportContentArea?.classList.add('hidden');
    rewardsContentArea?.classList.add('hidden');

    if (tab === 'reports') {
        reportTab?.classList.replace('tab-inactive-main', 'tab-active-main');
        reportContentArea?.classList.remove('hidden');
    } else if (tab === 'rewards') {
        rewardsTab?.classList.replace('tab-inactive-main', 'tab-active-main');
        rewardsContentArea?.classList.remove('hidden');
        const user = auth.currentUser;
        if (user) loadReferralRewards(user.uid);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupRememberMe();
    createCountryCodeDropdown();
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            db.collection('parent_users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const d = doc.data();
                        loadAllReportsForParent(d.normalizedPhone || d.phone, user.uid);
                    }
                })
                .catch(console.error);
        } else {
            cleanupRealTimeListeners();
        }
    });

    document.getElementById("signInBtn").addEventListener("click", handleSignIn);
    document.getElementById("signUpBtn").addEventListener("click", handleSignUp);
    document.getElementById("sendResetBtn").addEventListener("click", handlePasswordReset);
    document.getElementById("submitFeedbackBtn").addEventListener("click", submitFeedback);
    document.getElementById("signInTab").addEventListener("click", () => switchTab('signin'));
    document.getElementById("signUpTab").addEventListener("click", () => switchTab('signup'));
    document.getElementById("forgotPasswordBtn").addEventListener("click", () => document.getElementById("passwordResetModal").classList.remove("hidden"));
    document.getElementById("cancelResetBtn").addEventListener("click", () => document.getElementById("passwordResetModal").classList.add("hidden"));
    document.getElementById("rememberMe").addEventListener("change", handleRememberMe);
    document.getElementById('loginPassword').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSignIn(); });
    document.getElementById('signupConfirmPassword').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSignUp(); });
    document.getElementById('resetEmail').addEventListener('keypress', (e) => { if (e.key === 'Enter') handlePasswordReset(); });
    document.getElementById("reportTab")?.addEventListener("click", () => switchMainTab('reports'));
    document.getElementById("rewardsTab")?.addEventListener("click", () => switchMainTab('rewards'));
});
