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

// ============================================================================
// SECTION 1: CYBER SECURITY & UTILITY FUNCTIONS
// ============================================================================

// XSS Protection - Escape HTML to prevent injection attacks
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '`': '&#x60;',
        '/': '&#x2F;',
        '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`/=]/g, function(m) { return map[m]; });
}

// Sanitize user input for safe rendering
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return escapeHtml(input.trim());
    }
    return input;
}

// Safe text content helper (doesn't escape HTML for rendering)
function safeText(text) {
    if (typeof text !== 'string') return text;
    return text.trim();
}

// Capitalize names safely
function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    const cleaned = safeText(str);
    return cleaned.replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================================================
// SECTION 2: APP CONFIGURATION & INITIALIZATION
// ============================================================================

// Inject custom CSS for smooth animations and transitions
function injectCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Smooth transitions */
        .accordion-content {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }
        
        .accordion-content.hidden {
            max-height: 0 !important;
            opacity: 0;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }
        
        .accordion-content:not(.hidden) {
            max-height: 5000px;
            opacity: 1;
        }
        
        .fade-in {
            animation: fadeIn 0.3s ease-in-out;
        }
        
        .slide-down {
            animation: slideDown 0.3s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideDown {
            from {
                transform: translateY(-10px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        /* Loading animations */
        .loading-spinner {
            border: 3px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 3px solid #10B981;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }
        
        .loading-spinner-small {
            border: 2px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 2px solid #10B981;
            width: 16px;
            height: 16px;
            animation: spin 1s linear infinite;
            display: inline-block;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Button glow effect */
        .btn-glow:hover {
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
        }
        
        /* Notification badge animations */
        .notification-pulse {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        /* Accordion styles */
        .accordion-header {
            transition: all 0.2s ease;
        }
        
        .accordion-header:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        /* Hide white spaces */
        .accordion-content.hidden {
            display: none !important;
        }
        
        /* Tab transitions */
        .tab-transition {
            transition: all 0.3s ease;
        }
    `;
    document.head.appendChild(style);
}

// Create country code dropdown with full list
function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone')?.parentNode;
    if (!phoneInputContainer) return;
    
    // Create container for country code and phone number
    const container = document.createElement('div');
    container.className = 'flex gap-2';
    
    // Create country code dropdown
    const countryCodeSelect = document.createElement('select');
    countryCodeSelect.id = 'countryCode';
    countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    countryCodeSelect.required = true;
    
    // FULL COUNTRY CODES LIST (50+ countries) - MAINTAINED GLOBAL
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
        { code: '+52', name: 'Mexico (+52)' },
        { code: '+63', name: 'Philippines (+63)' },
        { code: '+65', name: 'Singapore (+65)' },
        { code: '+64', name: 'New Zealand (+64)' },
        { code: '+7', name: 'Russia/Kazakhstan (+7)' },
        { code: '+380', name: 'Ukraine (+380)' },
        { code: '+30', name: 'Greece (+30)' },
        { code: '+43', name: 'Austria (+43)' },
        { code: '+420', name: 'Czech Republic (+420)' },
        { code: '+36', name: 'Hungary (+36)' },
        { code: '+40', name: 'Romania (+40)' }
    ];
    
    // Add options to dropdown
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = safeText(country.name);
        countryCodeSelect.appendChild(option);
    });
    
    // Set USA/Canada as default
    countryCodeSelect.value = '+1';
    
    // Get the existing phone input
    const phoneInput = document.getElementById('signupPhone');
    if (phoneInput) {
        phoneInput.placeholder = 'Enter phone number without country code';
        phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
        
        // Replace the original input with new structure
        container.appendChild(countryCodeSelect);
        container.appendChild(phoneInput);
        phoneInputContainer.appendChild(container);
    }
}

// ENHANCED PHONE NORMALIZATION FUNCTION - BETTER GLOBAL SUPPORT
function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, valid: false, error: 'Invalid input' };
    }

    console.log("🔧 Normalizing phone:", phone);
    
    try {
        // Clean the phone number - remove all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // If empty after cleaning, return error
        if (!cleaned) {
            return { normalized: null, valid: false, error: 'Empty phone number' };
        }
        
        // Check if it already has a country code
        if (cleaned.startsWith('+')) {
            // Already has country code, validate format
            // Remove any extra plus signs
            cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
            
            return {
                normalized: cleaned,
                valid: true,
                error: null
            };
        } else {
            // No country code, add +1 as default for global compatibility
            // Remove leading zeros if present
            cleaned = cleaned.replace(/^0+/, '');
            
            // Check if it looks like a local number that might need a country code
            if (cleaned.length <= 10) {
                // Local number, add +1 (USA/Canada default)
                cleaned = '+1' + cleaned;
            } else if (cleaned.length > 10) {
                // Might already have country code without +
                // Check if it starts with a known country code pattern
                const knownCodes = ['234', '44', '91', '86', '33', '49', '81', '61', '55', '7'];
                const possibleCode = cleaned.substring(0, 3);
                
                if (knownCodes.includes(possibleCode)) {
                    cleaned = '+' + cleaned;
                } else {
                    // Default to +1 for unknown long numbers
                    cleaned = '+1' + cleaned;
                }
            }
            
            // Ensure format is correct
            return {
                normalized: cleaned,
                valid: true,
                error: null
            };
        }
        
    } catch (error) {
        console.error("❌ Phone normalization error:", error);
        return { 
            normalized: null, 
            valid: false, 
            error: safeText(error.message)
        };
    }
}

// ============================================================================
// SECTION 3: GLOBAL VARIABLES & STATE MANAGEMENT
// ============================================================================

let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let allStudentData = [];
let unreadMessagesCount = 0;
let unreadAcademicsCount = 0;
let realTimeListeners = [];
let academicsNotifications = new Map(); // studentName -> {dailyTopics: count, homework: count}

// ============================================================================
// SECTION 4: UI MESSAGE SYSTEM
// ============================================================================

function showMessage(message, type) {
    // Remove any existing message
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    messageDiv.textContent = `BKH says: ${safeText(message)}`;
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// ============================================================================
// SECTION 5: REFERRAL SYSTEM FUNCTIONS
// ============================================================================

/**
 * Generates a unique, alphanumeric referral code prefixed with 'BKH'.
 */
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

        // Check uniqueness in Firestore
        const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snapshot.empty) {
            isUnique = true;
        }
    }
    return safeText(code);
}

/**
 * Loads the parent's referral data for the Rewards Dashboard.
 */
async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    if (!rewardsContent) return;
    
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';

    try {
        // Get the parent's referral code and current earnings
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) {
            rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found. Please sign in again.</p>';
            return;
        }
        const userData = userDoc.data();
        const referralCode = safeText(userData.referralCode || 'N/A');
        const totalEarnings = userData.referralEarnings || 0;
        
        // Query referral transactions
        const transactionsSnapshot = await db.collection('referral_transactions')
            .where('ownerUid', '==', parentUid)
            .get();

        let referralsHtml = '';
        let pendingCount = 0;
        let approvedCount = 0;
        let paidCount = 0;

        if (transactionsSnapshot.empty) {
            referralsHtml = `
                <tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>
            `;
        } else {
            const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Sort manually by timestamp descending
            transactions.sort((a, b) => {
                const aTime = a.timestamp?.toDate?.() || new Date(0);
                const bTime = b.timestamp?.toDate?.() || new Date(0);
                return bTime - aTime;
            });
            
            transactions.forEach(data => {
                const status = safeText(data.status || 'pending');
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : 
                                    status === 'approved' ? 'bg-blue-100 text-blue-800' : 
                                    'bg-yellow-100 text-yellow-800';
                
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
                        <td class="px-4 py-3 text-sm">
                            <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                                ${capitalize(status)}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${safeText(rewardAmount)}</td>
                    </tr>
                `;
            });
        }
        
        // Display the dashboard
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md slide-down">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2">Share this code with other parents. They use it when registering their child, and you earn **₦5,000** once their child completes their first month!</p>
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
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred Parent/Student</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Used</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${referralsHtml}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading referral rewards:', error);
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">An error occurred while loading your rewards data. Please try again later.</p>';
    }
}

// ============================================================================
// SECTION 6: AUTHENTICATION & USER MANAGEMENT (CORE IMPLEMENTATION)
// ============================================================================

/**
 * FULL SIGN IN LOGIC
 * Handles the actual Firebase authentication and UI updates.
 */
async function handleSignInFull(identifier, password, signInBtn, authLoader) {
    try {
        // 1. Attempt Sign In
        await auth.signInWithEmailAndPassword(identifier, password);
        
        console.log("✅ Sign in successful for:", identifier);
        // Success is handled by the UnifiedAuthManager

    } catch (error) {
        console.error("Sign In Error:", error);
        
        // 3. Handle Errors
        let errorMessage = "Failed to sign in. Please check your credentials.";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect password.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Invalid email address format.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = "Too many failed attempts. Please try again later.";
        }
        
        showMessage(errorMessage, 'error');
        
        // 4. Reset UI
        if (signInBtn) signInBtn.disabled = false;
        
        const signInText = document.getElementById('signInText');
        const signInSpinner = document.getElementById('signInSpinner');
        
        if (signInText) signInText.textContent = 'Sign In';
        if (signInSpinner) signInSpinner.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    }
}

/**
 * FULL SIGN UP LOGIC
 * Handles creating the user, normalizing phone, and saving to Firestore.
 */
async function handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader) {
    try {
        // 1. Normalize Phone Number
        let fullPhoneInput = localPhone;
        if (!localPhone.startsWith('+')) {
            fullPhoneInput = countryCode + localPhone;
        }
        
        const normalizedResult = normalizePhoneNumber(fullPhoneInput);
        
        if (!normalizedResult.valid) {
            throw new Error(`Invalid phone number: ${normalizedResult.error}`);
        }
        
        const finalPhone = normalizedResult.normalized;
        console.log("📱 Processing signup with normalized phone:", finalPhone);

        // 2. Create Authentication User
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 3. Generate Referral Code
        const referralCode = await generateReferralCode();

        // 4. Save User Data to Firestore
        await db.collection('parent_users').doc(user.uid).set({
            email: email,
            phone: finalPhone, // Normalized +CountryCode format
            normalizedPhone: finalPhone, // Explicit field for searching
            parentName: 'Parent', // Default name
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
            uid: user.uid
        });

        console.log("✅ Account created and profile saved for:", user.uid);
        showMessage('Account created successfully!', 'success');
        
        // Success is handled by UnifiedAuthManager

    } catch (error) {
        console.error("Sign Up Error:", error);
        
        let errorMessage = "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email is already registered. Please sign in instead.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Password should be at least 6 characters.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        showMessage(errorMessage, 'error');

        // Reset UI
        if (signUpBtn) signUpBtn.disabled = false;
        
        const signUpText = document.getElementById('signUpText');
        const signUpSpinner = document.getElementById('signUpSpinner');
        
        if (signUpText) signUpText.textContent = 'Create Account';
        if (signUpSpinner) signUpSpinner.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    }
}

/**
 * FULL PASSWORD RESET LOGIC
 */
async function handlePasswordResetFull(email, sendResetBtn, resetLoader) {
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email!', 'success');
        hidePasswordResetModal();
    } catch (error) {
        console.error("Reset Error:", error);
        let errorMessage = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email address.";
        }
        showMessage(errorMessage, 'error');
    } finally {
        if (sendResetBtn) sendResetBtn.disabled = false;
        if (resetLoader) resetLoader.classList.add('hidden');
    }
}

// ============================================================================
// SECTION 7: MESSAGING - DISABLED (REMOVED FOR NOW)
// ============================================================================

// All messaging functions removed as requested

// ============================================================================
// SECTION 8: PROACTIVE ACADEMICS TAB WITHOUT COMPLEX QUERIES
// ============================================================================

/**
 * Determines which months to show based on the 2nd Day Rule
 * @returns {Object} { showCurrentMonth: boolean, showPreviousMonth: boolean }
 */
function getMonthDisplayLogic() {
    const today = new Date();
    const currentDay = today.getDate();
    
    // 2nd Day Rule: Show previous month only on 1st or 2nd of current month
    if (currentDay === 1 || currentDay === 2) {
        return {
            showCurrentMonth: true,
            showPreviousMonth: true
        };
    } else {
        return {
            showCurrentMonth: true,
            showPreviousMonth: false
        };
    }
}

/**
 * Gets the current month and year
 * @returns {Object} { month: number, year: number, monthName: string }
 */
function getCurrentMonthYear() {
    const now = new Date();
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return {
        month: now.getMonth(),
        year: now.getFullYear(),
        monthName: monthNames[now.getMonth()]
    };
}

/**
 * Gets the previous month and year
 * @returns {Object} { month: number, year: number, monthName: string }
 */
function getPreviousMonthYear() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return {
        month: lastMonth.getMonth(),
        year: lastMonth.getFullYear(),
        monthName: monthNames[lastMonth.getMonth()]
    };
}

/**
 * Formats date with detailed format including time - ENHANCED FOR PARENT TIMEZONES
 * @param {Date|FirebaseTimestamp} date 
 * @param {boolean} showTimezone - Whether to show timezone info
 * @returns {string} Formatted date
 */
function formatDetailedDate(date, showTimezone = false) {
    let dateObj;
    
    // Handle Firebase Timestamp
    if (date?.toDate) {
        dateObj = date.toDate();
    } else if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        dateObj = new Date(date);
    } else if (typeof date === 'number') {
        // Handle seconds timestamp
        if (date < 10000000000) {
            dateObj = new Date(date * 1000);
        } else {
            dateObj = new Date(date);
        }
    } else {
        return 'Unknown date';
    }
    
    if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
    }
    
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    // Add timezone info if requested
    if (showTimezone) {
        options.timeZoneName = 'short';
    }
    
    // Get parent's local timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    let formatted = dateObj.toLocaleDateString('en-US', options);
    
    if (showTimezone) {
        formatted += ` (${timezone})`;
    }
    
    return formatted;
}

/**
 * Formats date for month filtering
 * @param {Date|FirebaseTimestamp} date 
 * @returns {Object} { year: number, month: number }
 */
function getYearMonthFromDate(date) {
    let dateObj;
    
    if (date?.toDate) {
        dateObj = date.toDate();
    } else if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        dateObj = new Date(date);
    } else if (typeof date === 'number') {
        if (date < 10000000000) {
            dateObj = new Date(date * 1000);
        } else {
            dateObj = new Date(date);
        }
    } else {
        return { year: 0, month: 0 };
    }
    
    if (isNaN(dateObj.getTime())) {
        return { year: 0, month: 0 };
    }
    
    return {
        year: dateObj.getFullYear(),
        month: dateObj.getMonth()
    };
}

/**
 * Gets timestamp in milliseconds from various date formats
 * @param {any} dateInput 
 * @returns {number} Timestamp in milliseconds
 */
function getTimestamp(dateInput) {
    if (!dateInput) return 0;
    
    if (dateInput?.toDate) {
        return dateInput.toDate().getTime();
    } else if (dateInput instanceof Date) {
        return dateInput.getTime();
    } else if (typeof dateInput === 'string') {
        return new Date(dateInput).getTime();
    } else if (typeof dateInput === 'number') {
        // Handle seconds timestamp
        if (dateInput < 10000000000) {
            return dateInput * 1000; // Convert seconds to milliseconds
        }
        return dateInput; // Assume milliseconds
    }
    
    return 0;
}

/**
 * Gets timestamp in seconds from various date formats
 * @param {any} data - Data object containing timestamp fields
 * @returns {number} Timestamp in seconds
 */
function getTimestampFromData(data) {
    if (!data) return 0;
    
    // Try different timestamp fields
    const timestampFields = [
        'timestamp',
        'createdAt',
        'submittedAt',
        'date',
        'updatedAt',
        'assignedDate',
        'dueDate'
    ];
    
    for (const field of timestampFields) {
        if (data[field]) {
            const timestamp = getTimestamp(data[field]);
            if (timestamp > 0) {
                return Math.floor(timestamp / 1000); // Convert to seconds
            }
        }
    }
    
    // Fallback to current time
    return Math.floor(Date.now() / 1000);
}

/**
 * Loads academic data for ALL children (including those with no data)
 */
async function loadAcademicsData(selectedStudent = null) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;
    
    academicsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading academic data...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to view academic data');
        }

        // Use comprehensive find children to get ALL children
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        const parentPhone = userData.normalizedPhone || userData.phone;

        const childrenResult = await comprehensiveFindChildren(parentPhone);
        
        // Update global variables
        userChildren = childrenResult.studentNames;
        studentIdMap = childrenResult.studentNameIdMap;
        allStudentData = childrenResult.allStudentData;

        if (userChildren.length === 0) {
            academicsContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📚</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
                    <p class="text-gray-500 max-w-md mx-auto">No students are currently assigned to your account. Please contact administration if you believe this is an error.</p>
                </div>
            `;
            return;
        }

        // Determine which student to show - ALL children visible always
        let studentsToShow = [];
        if (selectedStudent && studentIdMap.has(selectedStudent)) {
            studentsToShow = [selectedStudent];
        } else {
            // Show ALL children
            studentsToShow = userChildren;
        }

        let academicsHtml = '';

        // Create student selector if multiple students
        if (studentIdMap.size > 1) {
            academicsHtml += `
                <div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm slide-down">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
                    <select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200" onchange="onStudentSelected(this.value)">
                        <option value="">All Students</option>
            `;
            
            userChildren.forEach(studentName => {
                const studentInfo = allStudentData.find(s => s.name === studentName);
                const isSelected = selectedStudent === studentName ? 'selected' : '';
                const studentStatus = studentInfo?.isPending ? ' (Pending Registration)' : '';
                
                academicsHtml += `<option value="${safeText(studentName)}" ${isSelected}>${capitalize(studentName)}${safeText(studentStatus)}</option>`;
            });
            
            academicsHtml += `
                    </select>
                </div>
            `;
        }

        // Load data for each student (ALL children, even with no data)
        for (const studentName of studentsToShow) {
            const studentId = studentIdMap.get(studentName);
            const studentInfo = allStudentData.find(s => s.name === studentName);
            
            const studentHeader = `
                <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6 slide-down" id="academics-student-${safeText(studentName)}">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}${studentInfo?.isPending ? ' <span class="text-yellow-600 text-sm">(Pending Registration)</span>' : ''}</h2>
                            <p class="text-green-600">Academic progress and assignments</p>
                        </div>
                    </div>
                </div>
            `;

            academicsHtml += studentHeader;

            // Student Information Section (always shown)
            academicsHtml += `
                <div class="mb-8 fade-in">
                    <div class="flex items-center mb-4">
                        <span class="text-2xl mr-3">👤</span>
                        <h3 class="text-lg font-semibold text-green-700">Student Information</h3>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-500">Status</p>
                                <p class="font-medium">${studentInfo?.isPending ? 'Pending Registration' : 'Active'}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Assigned Tutor</p>
                                <p class="font-medium">${safeText(studentInfo?.data?.tutorName || 'Not yet assigned')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Session Topics Section
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
                        <div class="flex items-center">
                            <span id="session-topics-${safeText(studentName)}-arrow" class="accordion-arrow text-blue-600 text-xl">▼</span>
                        </div>
                    </button>
                    <div id="session-topics-${safeText(studentName)}-content" class="accordion-content hidden">
            `;

            try {
                if (studentId) {
                    // Get all session topics from daily_topics collection
                    const sessionTopicsSnapshot = await db.collection('daily_topics')
                        .where('studentId', '==', studentId)
                        .get();

                    if (sessionTopicsSnapshot.empty) {
                        academicsHtml += `
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                                <p class="text-gray-500">No session topics recorded yet. Check back after your child's sessions!</p>
                            </div>
                        `;
                    } else {
                        const topics = [];
                        
                        // Process each document
                        sessionTopicsSnapshot.forEach(doc => {
                            const topicData = doc.data();
                            topics.push({ 
                                id: doc.id, 
                                ...topicData,
                                timestamp: getTimestamp(topicData.date || topicData.createdAt || topicData.timestamp)
                            });
                        });
                        
                        // Sort manually by date ASCENDING
                        topics.sort((a, b) => a.timestamp - b.timestamp);
                        
                        // Filter topics based on month display logic
                        const monthLogic = getMonthDisplayLogic();
                        const currentMonth = getCurrentMonthYear();
                        const previousMonth = getPreviousMonthYear();
                        
                        const filteredTopics = topics.filter(topic => {
                            const topicDate = new Date(topic.timestamp);
                            const { year, month } = getYearMonthFromDate(topicDate);
                            
                            // Always show topics from current month
                            if (year === currentMonth.year && month === currentMonth.month) {
                                return true;
                            }
                            
                            // Show previous month only if allowed by 2nd Day Rule
                            if (monthLogic.showPreviousMonth && 
                                year === previousMonth.year && 
                                month === previousMonth.month) {
                                return true;
                            }
                            
                            return false;
                        });
                        
                        if (filteredTopics.length === 0) {
                            academicsHtml += `
                                <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                                    <p class="text-gray-500">No session topics for the selected time period.</p>
                                </div>
                            `;
                        } else {
                            // Group by month
                            const topicsByMonth = {};
                            filteredTopics.forEach(topic => {
                                const topicDate = new Date(topic.timestamp);
                                const { year, month } = getYearMonthFromDate(topicDate);
                                const monthKey = `${year}-${month}`;
                                
                                if (!topicsByMonth[monthKey]) {
                                    topicsByMonth[monthKey] = [];
                                }
                                topicsByMonth[monthKey].push(topic);
                            });
                            
                            // Display topics grouped by month
                            for (const [monthKey, monthTopics] of Object.entries(topicsByMonth)) {
                                const [year, month] = monthKey.split('-').map(num => parseInt(num));
                                const monthNames = [
                                    'January', 'February', 'March', 'April', 'May', 'June',
                                    'July', 'August', 'September', 'October', 'November', 'December'
                                ];
                                const monthName = monthNames[month];
                                
                                academicsHtml += `
                                    <div class="mb-6">
                                        <h4 class="font-semibold text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">${monthName} ${year}</h4>
                                        <div class="space-y-4">
                                `;
                                
                                monthTopics.forEach(topicData => {
                                    const formattedDate = formatDetailedDate(new Date(topicData.timestamp), true);
                                    const safeTopics = safeText(topicData.topics || topicData.sessionTopics || 'No topics recorded for this session.');
                                    const tutorName = safeText(topicData.tutorName || topicData.updatedBy || 'Tutor');
                                    
                                    academicsHtml += `
                                        <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                                            <div class="flex justify-between items-start mb-3">
                                                <div>
                                                    <span class="font-medium text-gray-800 text-sm">${safeText(formattedDate)}</span>
                                                    <div class="mt-1 flex items-center">
                                                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">Session</span>
                                                        <span class="text-xs text-gray-600">By: ${tutorName}</span>
                                                    </div>
                                                </div>
                                                ${topicData.updatedAt ? 
                                                    `<span class="text-xs text-gray-500">Updated: ${formatDetailedDate(topicData.updatedAt, true)}</span>` : 
                                                    ''}
                                            </div>
                                            <div class="text-gray-700 bg-gray-50 p-3 rounded-md">
                                                <p class="whitespace-pre-wrap">${safeTopics}</p>
                                            </div>
                                            ${topicData.notes ? `
                                            <div class="mt-3 text-sm">
                                                <span class="font-medium text-gray-700">Additional Notes:</span>
                                                <p class="text-gray-600 mt-1 bg-yellow-50 p-2 rounded">${safeText(topicData.notes)}</p>
                                            </div>
                                            ` : ''}
                                        </div>
                                    `;
                                });
                                
                                academicsHtml += `
                                        </div>
                                    </div>
                                `;
                            }
                        }
                    }
                } else {
                    academicsHtml += `
                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                            <p class="text-gray-500">Student ID not found. Session topics cannot be loaded.</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading session topics:', error);
                academicsHtml += `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p class="text-yellow-700">Unable to load session topics at this time. Please try again later.</p>
                    </div>
                `;
            }

            academicsHtml += `
                    </div>
                </div>
            `;

            // Homework Assignments Section
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

            try {
                if (studentId) {
                    // Get all homework from homework_assignments collection
                    const homeworkSnapshot = await db.collection('homework_assignments')
                        .where('studentId', '==', studentId)
                        .get();

                    if (homeworkSnapshot.empty) {
                        academicsHtml += `
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                                <p class="text-gray-500">No homework assignments yet.</p>
                            </div>
                        `;
                    } else {
                        const homeworkList = [];
                        
                        // Process each document
                        homeworkSnapshot.forEach(doc => {
                            const homework = doc.data();
                            homeworkList.push({ 
                                id: doc.id, 
                                ...homework,
                                assignedTimestamp: getTimestamp(homework.assignedDate || homework.createdAt || homework.timestamp),
                                dueTimestamp: getTimestamp(homework.dueDate)
                            });
                        });
                        
                        const now = new Date().getTime();
                        
                        // Sort manually by due date ASCENDING
                        homeworkList.sort((a, b) => a.dueTimestamp - b.dueTimestamp);
                        
                        // Filter homework based on month display logic
                        const monthLogic = getMonthDisplayLogic();
                        const currentMonth = getCurrentMonthYear();
                        const previousMonth = getPreviousMonthYear();
                        
                        const filteredHomework = homeworkList.filter(homework => {
                            const dueDate = new Date(homework.dueTimestamp);
                            const { year, month } = getYearMonthFromDate(dueDate);
                            
                            // Always show current month homework
                            if (year === currentMonth.year && month === currentMonth.month) {
                                return true;
                            }
                            
                            // Show previous month homework if allowed by 2nd Day Rule
                            if (monthLogic.showPreviousMonth && 
                                year === previousMonth.year && 
                                month === previousMonth.month) {
                                return true;
                            }
                            
                            // Always show overdue assignments regardless of month
                            if (homework.dueTimestamp < now) {
                                return true;
                            }
                            
                            // Show upcoming assignments (next month)
                            const nextMonth = new Date(currentMonth.year, currentMonth.month + 1, 1);
                            if (dueDate <= nextMonth) {
                                return true;
                            }
                            
                            return false;
                        });
                        
                        if (filteredHomework.length === 0) {
                            academicsHtml += `
                                <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                                    <p class="text-gray-500">No homework for the selected time period.</p>
                                </div>
                            `;
                        } else {
                            // Group by month
                            const homeworkByMonth = {};
                            filteredHomework.forEach(homework => {
                                const dueDate = new Date(homework.dueTimestamp);
                                const { year, month } = getYearMonthFromDate(dueDate);
                                const monthKey = `${year}-${month}`;
                                
                                if (!homeworkByMonth[monthKey]) {
                                    homeworkByMonth[monthKey] = [];
                                }
                                homeworkByMonth[monthKey].push(homework);
                            });
                            
                            // Sort months in chronological order
                            const sortedMonthKeys = Object.keys(homeworkByMonth).sort((a, b) => {
                                const [aYear, aMonth] = a.split('-').map(Number);
                                const [bYear, bMonth] = b.split('-').map(Number);
                                return aYear - bYear || aMonth - bMonth;
                            });
                            
                            // Display homework grouped by month
                            for (const monthKey of sortedMonthKeys) {
                                const [year, month] = monthKey.split('-').map(num => parseInt(num));
                                const monthNames = [
                                    'January', 'February', 'March', 'April', 'May', 'June',
                                    'July', 'August', 'September', 'October', 'November', 'December'
                                ];
                                const monthName = monthNames[month];
                                const monthHomework = homeworkByMonth[monthKey];
                                
                                academicsHtml += `
                                    <div class="mb-6">
                                        <h4 class="font-semibold text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">${monthName} ${year}</h4>
                                        <div class="space-y-4">
                                `;
                                
                                monthHomework.forEach(homework => {
                                    const dueDate = new Date(homework.dueTimestamp);
                                    const assignedDate = new Date(homework.assignedTimestamp);
                                    const formattedDueDate = formatDetailedDate(dueDate, true);
                                    const formattedAssignedDate = formatDetailedDate(assignedDate, true);
                                    const isOverdue = homework.dueTimestamp < now;
                                    const isSubmitted = homework.status === 'submitted' || homework.status === 'completed';
                                    const statusColor = isOverdue ? 'bg-red-100 text-red-800' : 
                                                      isSubmitted ? 'bg-green-100 text-green-800' : 
                                                      'bg-blue-100 text-blue-800';
                                    const statusText = isOverdue ? 'Overdue' : 
                                                     isSubmitted ? 'Submitted' : 
                                                     'Pending';
                                    const safeTitle = safeText(homework.title || homework.subject || 'Untitled Assignment');
                                    const safeDescription = safeText(homework.description || homework.instructions || 'No description provided.');
                                    const tutorName = safeText(homework.tutorName || homework.assignedBy || 'Tutor');
                                    
                                    academicsHtml += `
                                        <div class="bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                                            <div class="flex justify-between items-start mb-3">
                                                <div>
                                                    <h5 class="font-medium text-gray-800 text-lg">${safeTitle}</h5>
                                                    <div class="mt-1 flex flex-wrap items-center gap-2">
                                                        <span class="text-xs ${statusColor} px-2 py-1 rounded-full">${statusText}</span>
                                                        <span class="text-xs text-gray-600">Assigned by: ${tutorName}</span>
                                                        ${homework.subject ? `<span class="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">${safeText(homework.subject)}</span>` : ''}
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <span class="text-sm font-medium text-gray-700">Due: ${safeText(formattedDueDate)}</span>
                                                    <div class="text-xs text-gray-500 mt-1">Assigned: ${safeText(formattedAssignedDate)}</div>
                                                </div>
                                            </div>
                                            
                                            <div class="text-gray-700 mb-4">
                                                <p class="whitespace-pre-wrap bg-gray-50 p-3 rounded-md">${safeDescription}</p>
                                            </div>
                                            
                                            <div class="flex justify-between items-center pt-3 border-t border-gray-100">
                                                <div class="flex items-center space-x-3">
                                                    ${homework.fileUrl ? `
                                                        <a href="${safeText(homework.fileUrl)}" target="_blank" class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm">
                                                            <span class="mr-1">📎</span> Download Attachment
                                                        </a>
                                                    ` : ''}
                                                    
                                                    ${homework.submissionUrl ? `
                                                        <a href="${safeText(homework.submissionUrl)}" target="_blank" class="text-blue-600 hover:text-blue-800 font-medium flex items-center text-sm">
                                                            <span class="mr-1">📤</span> View Submission
                                                        </a>
                                                    ` : ''}
                                                </div>
                                                
                                                ${homework.grade ? `
                                                    <div class="text-sm">
                                                        <span class="font-medium text-gray-700">Grade:</span>
                                                        <span class="ml-1 font-bold ${homework.grade >= 70 ? 'text-green-600' : homework.grade >= 50 ? 'text-yellow-600' : 'text-red-600'}">
                                                            ${homework.grade}%
                                                        </span>
                                                    </div>
                                                ` : ''}
                                            </div>
                                            
                                            ${homework.feedback ? `
                                            <div class="mt-4 pt-3 border-t border-gray-100">
                                                <span class="font-medium text-gray-700 text-sm">Tutor Feedback:</span>
                                                <p class="text-gray-600 text-sm mt-1 bg-blue-50 p-2 rounded">${safeText(homework.feedback)}</p>
                                            </div>
                                            ` : ''}
                                        </div>
                                    `;
                                });
                                
                                academicsHtml += `
                                        </div>
                                    </div>
                                `;
                            }
                        }
                    }
                } else {
                    academicsHtml += `
                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                            <p class="text-gray-500">Student ID not found. Homework cannot be loaded.</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading homework:', error);
                academicsHtml += `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p class="text-yellow-700">Unable to load homework assignments at this time. Please try again later.</p>
                    </div>
                `;
            }

            academicsHtml += `
                    </div>
                </div>
            `;
        }

        // Update academics content
        academicsContent.innerHTML = academicsHtml;

    } catch (error) {
        console.error('Error loading academics data:', error);
        academicsContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Academic Data</h3>
                <p class="text-gray-500">Unable to load academic data at this time. Please try again later.</p>
                <button onclick="loadAcademicsData()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200">
                    Try Again
                </button>
            </div>
        `;
    }
}

function toggleAcademicsAccordion(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const arrow = document.getElementById(`${sectionId}-arrow`);
    
    if (!content || !arrow) {
        console.error(`Could not find academics accordion elements for ${sectionId}`);
        return;
    }
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        arrow.textContent = '▼';
    }
}

function updateAcademicsTabBadge(count) {
    const academicsTab = document.getElementById('academicsTab');
    if (!academicsTab) return;
    
    // Remove existing badge
    const existingBadge = academicsTab.querySelector('.academics-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Add new badge if there are unread items
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'academics-badge absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs min-w-5 h-5 flex items-center justify-center font-bold animate-pulse px-1';
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.lineHeight = '1rem';
        badge.style.fontSize = '0.7rem';
        badge.style.padding = '0 4px';
        academicsTab.style.position = 'relative';
        academicsTab.appendChild(badge);
    }
}

function onStudentSelected(studentName) {
    loadAcademicsData(studentName || null);
}

// Update the checkForNewAcademics function to match
async function checkForNewAcademics() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        // Get user data to find phone
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        const parentPhone = userData.normalizedPhone || userData.phone;

        // Use comprehensive find children
        const childrenResult = await comprehensiveFindChildren(parentPhone);
        const studentNameIdMap = childrenResult.studentNameIdMap;
        
        // Reset notifications
        academicsNotifications.clear();
        let totalUnread = 0;

        // Check for new session topics and homework for each student
        for (const [studentName, studentId] of studentNameIdMap) {
            let studentUnread = { sessionTopics: 0, homework: 0 };
            
            try {
                // Get session topics from last 7 days
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                
                const sessionTopicsSnapshot = await db.collection('daily_topics')
                    .where('studentId', '==', studentId)
                    .get();
                
                // Filter client-side for recent topics (last 7 days)
                sessionTopicsSnapshot.forEach(doc => {
                    const topic = doc.data();
                    const topicDate = topic.date?.toDate?.() || topic.createdAt?.toDate?.() || new Date(0);
                    if (topicDate >= oneWeekAgo) {
                        studentUnread.sessionTopics++;
                    }
                });
                
                // Get homework from last 7 days
                const homeworkSnapshot = await db.collection('homework_assignments')
                    .where('studentId', '==', studentId)
                    .get();
                
                // Filter client-side for recent homework (last 7 days)
                homeworkSnapshot.forEach(doc => {
                    const homework = doc.data();
                    const assignedDate = homework.assignedDate?.toDate?.() || homework.createdAt?.toDate?.() || new Date(0);
                    if (assignedDate >= oneWeekAgo) {
                        studentUnread.homework++;
                    }
                });
                
            } catch (error) {
                console.error(`Error checking academics for ${studentName}:`, error);
                // Continue with other students
            }
            
            // Store student notifications
            academicsNotifications.set(studentName, studentUnread);
            
            // Add to total
            totalUnread += studentUnread.sessionTopics + studentUnread.homework;
        }
        
        // Update academics tab badge
        updateAcademicsTabBadge(totalUnread);

    } catch (error) {
        console.error('Error checking for new academics:', error);
    }
}

// ============================================================================
// SECTION 9: MESSAGING - DISABLED (REMOVED FOR NOW)
// ============================================================================

// All messaging functions removed as requested

// ============================================================================
// SECTION 10: NOTIFICATION SYSTEM WITHOUT COMPLEX QUERIES
// ============================================================================

async function checkForNewMessages() {
    // Function kept but not used since messaging is disabled
    return;
}

function updateNotificationBadge(count) {
    // Function kept but not used since messaging is disabled
    return;
}

function resetNotificationCount() {
    // Function kept but not used since messaging is disabled
    return;
}

// ============================================================================
// SECTION 11: NAVIGATION BUTTONS & DYNAMIC UI
// ============================================================================

// Add Messages button removed as requested

// MANUAL REFRESH FUNCTION
async function manualRefreshReportsV2() {
    const user = auth.currentUser;
    if (!user) return;
    
    const refreshBtn = document.getElementById('manualRefreshBtn');
    if (!refreshBtn) return;
    
    const originalText = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Checking...';
    refreshBtn.disabled = true;
    
    try {
        // Get user data
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userPhone = userData.normalizedPhone || userData.phone;
            
            // Force reload reports using auth manager
            if (window.authManager && typeof window.authManager.reloadDashboard === 'function') {
                await window.authManager.reloadDashboard();
            } else {
                // Fallback to old method
                await loadAllReportsForParent(userPhone, user.uid, true);
            }
            
            // Also check for new academics
            await checkForNewAcademics();
            
            showMessage('Reports refreshed successfully!', 'success');
        }
    } catch (error) {
        console.error('Manual refresh error:', error);
        showMessage('Refresh failed. Please try again.', 'error');
    } finally {
        // Restore button state
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// ADD MANUAL REFRESH BUTTON TO WELCOME SECTION
function addManualRefreshButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    // Check if button already exists
    if (document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = manualRefreshReportsV2;
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
    refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Check for New Reports';
    
    // Insert before the logout button
    const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        buttonContainer.insertBefore(refreshBtn, logoutBtn);
    } else {
        buttonContainer.appendChild(refreshBtn);
    }
}

// ADD LOGOUT BUTTON (with duplicate prevention)
function addLogoutButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    // Check if logout button already exists
    if (buttonContainer.querySelector('button[onclick="logout()"]')) return;
    
    const logoutBtn = document.createElement('button');
    logoutBtn.onclick = logout;
    logoutBtn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all duration-200 btn-glow flex items-center justify-center';
    logoutBtn.innerHTML = '<span class="mr-2">🚪</span> Logout';
    
    buttonContainer.appendChild(logoutBtn);
}

// ============================================================================
// SECTION 12: ULTIMATE REPORT SEARCH - GUARANTEED TO FIND ALL REPORTS
// ============================================================================

async function searchAllReportsForParent(parentPhone, parentEmail = '', parentUid = '') {
    console.log("🔍 ULTIMATE Search for:", { parentPhone, parentEmail, parentUid });
    
    let allResults = [];
    let foundSources = new Set();
    
    try {
        // Get ALL possible identifiers for this parent
        const searchQueries = await generateAllSearchQueries(parentPhone, parentEmail, parentUid);
        
        console.log("🔎 Generated search queries:", searchQueries.length);
        
        // Search in ALL possible collections
        const collectionsToSearch = [
            'tutor_submissions',
            'student_results', 
            'monthly_reports',
            'assessment_reports',
            'progress_reports',
            'reports',
            'student_reports',
            'parent_reports',
            'academic_reports',
            'session_reports',
            'performance_reports'
        ];
        
        // PARALLEL SEARCH: Search all collections with all queries
        const searchPromises = [];
        
        for (const collectionName of collectionsToSearch) {
            for (const query of searchQueries) {
                searchPromises.push(
                    searchInCollection(collectionName, query).then(results => {
                        if (results.length > 0) {
                            console.log(`✅ Found ${results.length} reports in ${collectionName} with ${query.field}=${query.value}`);
                            foundSources.add(`${collectionName}:${query.field}`);
                        }
                        return results;
                    }).catch(error => {
                        // Collection might not exist - that's OK
                        return [];
                    })
                );
            }
        }
        
        // Wait for all searches to complete
        const allResultsArrays = await Promise.all(searchPromises);
        
        // Combine all results
        allResults = allResultsArrays.flat();
        
        console.log("🎯 TOTAL RAW REPORTS FOUND:", allResults.length);
        console.log("📊 Sources found:", Array.from(foundSources));
        
        // If NO reports found, try emergency search
        if (allResults.length === 0) {
            console.warn("⚠️ No reports found with standard search. Starting EMERGENCY SEARCH...");
            const emergencyResults = await emergencyReportSearch(parentPhone, parentEmail);
            allResults = emergencyResults;
        }
        
        // Remove duplicates based on document ID and timestamp
        const uniqueResults = [];
        const seenIds = new Set();
        
        allResults.forEach(result => {
            const uniqueKey = `${result.collection}_${result.id}`;
            if (!seenIds.has(uniqueKey)) {
                seenIds.add(uniqueKey);
                uniqueResults.push(result);
            }
        });
        
        console.log("🎯 UNIQUE REPORTS AFTER DEDUPLICATION:", uniqueResults.length);
        
        // Now distribute reports to correct students
        const { assessmentResults, monthlyResults } = distributeReportsToStudents(uniqueResults);
        
        return { 
            assessmentResults, 
            monthlyResults, 
            allRawResults: uniqueResults, // Keep for debugging
            searchStats: {
                totalFound: uniqueResults.length,
                rawFound: allResults.length,
                sources: Array.from(foundSources),
                collectionsSearched: collectionsToSearch.length
            }
        };
        
    } catch (error) {
        console.error("❌ Ultimate search error:", error);
        return { assessmentResults: [], monthlyResults: [], searchStats: { error: error.message }};
    }
}

// NEW FUNCTION: Distribute reports to correct students
function distributeReportsToStudents(allReports) {
    console.log("📊 Distributing reports to students...");
    
    const assessmentResults = [];
    const monthlyResults = [];
    
    // Get current student mapping
    const studentNames = Array.from(studentIdMap.keys());
    console.log("👥 Available students for distribution:", studentNames);
    
    allReports.forEach(report => {
        // Try to determine which student this report belongs to
        const assignedStudent = findStudentForReport(report);
        
        if (assignedStudent) {
            console.log(`📝 Report assigned to student: ${assignedStudent}`, {
                reportId: report.id,
                collection: report.collection,
                studentIdInReport: report.studentId,
                studentNameInReport: report.studentName
            });
            
            // Add student info to the report for proper grouping
            report.assignedStudentName = assignedStudent;
            report.assignedStudentId = studentIdMap.get(assignedStudent);
            
            // Classify as assessment or monthly
            if (report.type === 'assessment' || 
                report.collection.includes('assessment') || 
                report.collection.includes('progress') ||
                (report.reportType && report.reportType.toLowerCase().includes('assessment'))) {
                assessmentResults.push(report);
            } else if (report.type === 'monthly' || 
                       report.collection.includes('monthly') ||
                       report.collection.includes('submission') ||
                       (report.reportType && report.reportType.toLowerCase().includes('monthly'))) {
                monthlyResults.push(report);
            }
        } else {
            console.warn("⚠️ Could not assign report to any student:", {
                reportId: report.id,
                collection: report.collection,
                studentId: report.studentId,
                studentName: report.studentName
            });
        }
    });
    
    console.log(`📊 Distribution complete: ${assessmentResults.length} assessments, ${monthlyResults.length} monthly reports`);
    
    return { assessmentResults, monthlyResults };
}

// NEW FUNCTION: Find which student a report belongs to
function findStudentForReport(report) {
    // Method 1: Match by studentId
    if (report.studentId) {
        // Check if this studentId exists in our studentIdMap (value = studentId, key = studentName)
        for (const [studentName, studentId] of studentIdMap.entries()) {
            if (studentId === report.studentId) {
                return studentName;
            }
        }
        
        // Also check if report.studentId matches any of our student IDs directly
        if (Array.from(studentIdMap.values()).includes(report.studentId)) {
            // Find the student name for this ID
            for (const [studentName, studentId] of studentIdMap.entries()) {
                if (studentId === report.studentId) {
                    return studentName;
                }
            }
        }
    }
    
    // Method 2: Match by studentName (exact match)
    if (report.studentName) {
        const reportStudentName = safeText(report.studentName);
        
        // Check exact match
        for (const studentName of userChildren) {
            if (safeText(studentName) === reportStudentName) {
                return studentName;
            }
        }
        
        // Check partial match (case-insensitive)
        for (const studentName of userChildren) {
            if (studentName.toLowerCase().includes(reportStudentName.toLowerCase()) ||
                reportStudentName.toLowerCase().includes(studentName.toLowerCase())) {
                return studentName;
            }
        }
    }
    
    // Method 3: Match by student field (alternative field name)
    if (report.student) {
        const reportStudent = safeText(report.student);
        
        for (const studentName of userChildren) {
            if (safeText(studentName) === reportStudent) {
                return studentName;
            }
        }
    }
    
    // Method 4: If parent has only one child, assign to that child
    if (userChildren.length === 1) {
        console.log(`📝 Assigning report to only child: ${userChildren[0]}`);
        return userChildren[0];
    }
    
    // Method 5: Last resort - check if any student data matches
    if (allStudentData.length > 0) {
        for (const student of allStudentData) {
            if (student.data) {
                // Check various fields in student data
                const studentFields = [
                    student.data.studentId,
                    student.data.studentName,
                    student.data.name,
                    student.data.id
                ];
                
                const reportFields = [
                    report.studentId,
                    report.studentName,
                    report.student,
                    report.id
                ];
                
                // Check for any match
                for (const studentField of studentFields) {
                    for (const reportField of reportFields) {
                        if (studentField && reportField && 
                            safeText(studentField) === safeText(reportField)) {
                            return student.name;
                        }
                    }
                }
            }
        }
    }
    
    return null;
}

// Generate ALL possible search queries
async function generateAllSearchQueries(parentPhone, parentEmail, parentUid) {
    const queries = [];
    
    // Phone variations - USING ENHANCED FUNCTION WITH FORMATS
const phoneVariations = generateAllPhoneVariations(parentPhone);
const phoneFormats = generateAllPhoneFormatsForSearch(parentPhone);
const allPhoneVersions = [...new Set([...phoneVariations, ...phoneFormats])];
console.log(`📱 Generated ${allPhoneVersions.length} phone versions for search (${phoneVariations.length} variations + ${phoneFormats.length} formats)`);

for (const phone of allPhoneVersions) {
    queries.push({ field: 'parentPhone', value: phone });
    queries.push({ field: 'parentphone', value: phone });
    queries.push({ field: 'parent_phone', value: phone });
    queries.push({ field: 'guardianPhone', value: phone });
    queries.push({ field: 'motherPhone', value: phone });
    queries.push({ field: 'fatherPhone', value: phone });
    queries.push({ field: 'phone', value: phone });
    queries.push({ field: 'parent_contact', value: phone });
    queries.push({ field: 'contact_number', value: phone });
    queries.push({ field: 'contactPhone', value: phone });
    // ADD THIS CRITICAL FIELD:
    queries.push({ field: 'normalizedParentPhone', value: phone });
}
    
    for (const phone of phoneVariations) {
        queries.push({ field: 'parentPhone', value: phone });
        queries.push({ field: 'parentphone', value: phone });
        queries.push({ field: 'parent_phone', value: phone });
        queries.push({ field: 'guardianPhone', value: phone });
        queries.push({ field: 'motherPhone', value: phone });
        queries.push({ field: 'fatherPhone', value: phone });
        queries.push({ field: 'phone', value: phone });
        queries.push({ field: 'parent_contact', value: phone });
        queries.push({ field: 'contact_number', value: phone });
        queries.push({ field: 'contactPhone', value: phone });
    }
        // ENHANCED FUNCTION: Search for reports with ALL possible phone formats
function generateAllPhoneFormatsForSearch(phone) {
    const formats = new Set();
    
    if (!phone) return Array.from(formats);
    
    // Get the normalized version first
    const normalized = normalizePhoneNumber(phone);
    if (normalized.valid) {
        formats.add(normalized.normalized);
    }
    
    // Add the original
    formats.add(phone);
    
    // Add common formatted versions
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        // US/Canada format: +1 (XXX) XXX-XXXX
        const formatted1 = `+1 (${digitsOnly.substring(1, 4)}) ${digitsOnly.substring(4, 7)}-${digitsOnly.substring(7)}`;
        formats.add(formatted1);
        
        // Another common format: +1-XXX-XXX-XXXX
        const formatted2 = `+1-${digitsOnly.substring(1, 4)}-${digitsOnly.substring(4, 7)}-${digitsOnly.substring(7)}`;
        formats.add(formatted2);
    }
    
    // Also add with spaces: +1 XXX XXX XXXX
    if (digitsOnly.length >= 10) {
        const withSpaces = `+${digitsOnly.substring(0, 1)} ${digitsOnly.substring(1, 4)} ${digitsOnly.substring(4, 7)} ${digitsOnly.substring(7)}`;
        formats.add(withSpaces);
    }
    
    return Array.from(formats);
}
    
    // Email variations
    if (parentEmail) {
        const emailVariations = [
            parentEmail.toLowerCase(),
            parentEmail.toUpperCase(),
            parentEmail
        ];
        for (const email of emailVariations) {
            queries.push({ field: 'parentEmail', value: email });
            queries.push({ field: 'parentemail', value: email });
            queries.push({ field: 'email', value: email });
            queries.push({ field: 'guardianEmail', value: email });
            queries.push({ field: 'parent_email', value: email });
            queries.push({ field: 'contact_email', value: email });
        }
    }
    
    // UID variations
    if (parentUid) {
        queries.push({ field: 'parentUid', value: parentUid });
        queries.push({ field: 'parentuid', value: parentUid });
        queries.push({ field: 'userId', value: parentUid });
        queries.push({ field: 'user_id', value: parentUid });
        queries.push({ field: 'createdBy', value: parentUid });
        queries.push({ field: 'ownerUid', value: parentUid });
    }
    
    // Try to find students first, then use student IDs
    try {
        const normalizedPhone = normalizePhoneNumber(parentPhone);
        if (normalizedPhone.valid) {
            // Find students by parent phone - CHECK ALL PHONE VARIATIONS
            for (const phoneVar of phoneVariations) {
                try {
                    const studentsSnapshot = await db.collection('students')
                        .where('parentPhone', '==', phoneVar)
                        .get();
                    
                    if (!studentsSnapshot.empty) {
                        studentsSnapshot.forEach(doc => {
                            const studentId = doc.id;
                            const studentData = doc.data();
                            
                            // Add student ID queries
                            queries.push({ field: 'studentId', value: studentId });
                            queries.push({ field: 'studentID', value: studentId });
                            queries.push({ field: 'student_id', value: studentId });
                            queries.push({ field: 'studentId', value: studentId.toLowerCase() });
                            queries.push({ field: 'studentId', value: studentId.toUpperCase() });
                            
                            // Also add student name queries
                            if (studentData.studentName) {
                                const studentName = safeText(studentData.studentName);
                                queries.push({ field: 'studentName', value: studentName });
                                queries.push({ field: 'student_name', value: studentName });
                                queries.push({ field: 'student', value: studentName });
                            }
                        });
                    }
                } catch (error) {
                    console.warn(`Error searching students with phone ${phoneVar}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.warn("Could not find students for search:", error);
    }
    
    console.log(`🔍 Total search queries generated: ${queries.length}`);
    return queries;
}

// Search in a specific collection
async function searchInCollection(collectionName, query) {
    try {
        const snapshot = await db.collection(collectionName)
            .where(query.field, '==', query.value)
            .get();
        
        const results = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            results.push({
                id: doc.id,
                collection: collectionName,
                fieldMatched: query.field,
                valueMatched: query.value,
                ...data,
                timestamp: getTimestampFromData(data),
                type: determineReportType(collectionName, data)
            });
        });
        
        return results;
    } catch (error) {
        // Collection or field doesn't exist
        if (error.code !== 'failed-precondition' && error.code !== 'invalid-argument') {
            console.warn(`Search error in ${collectionName} for ${query.field}=${query.value}:`, error.message);
        }
        return [];
    }
}

// EMERGENCY SEARCH - Last resort
async function emergencyReportSearch(parentPhone, parentEmail) {
    console.log("🚨 EMERGENCY SEARCH ACTIVATED");
    const results = [];
    
    try {
        // 1. Get ALL tutor_submissions and filter client-side
        const allSubmissions = await db.collection('tutor_submissions').limit(1000).get();
        const phoneVariations = generateAllPhoneVariations(parentPhone);
        
        console.log(`🔍 Emergency scanning ${allSubmissions.size} tutor submissions`);
        
        allSubmissions.forEach(doc => {
            const data = doc.data();
            let matched = false;
            
            // Check ALL phone fields with ALL variations
            const phoneFields = ['parentPhone', 'parentphone', 'parent_phone', 'phone', 'guardianPhone', 'contact_number, 'normalizedParentPhone'];
            for (const field of phoneFields) {
                if (data[field]) {
                    const fieldValue = String(data[field]).trim();
                    for (const phoneVar of phoneVariations) {
                        if (fieldValue === phoneVar || fieldValue.includes(phoneVar)) {
                            results.push({
                                id: doc.id,
                                collection: 'tutor_submissions',
                                emergencyMatch: true,
                                matchedField: field,
                                matchedValue: fieldValue,
                                ...data,
                                timestamp: getTimestampFromData(data),
                                type: 'monthly'
                            });
                            matched = true;
                            break;
                        }
                    }
                    if (matched) break;
                }
            }
            
            // Check by email
            if (!matched && parentEmail) {
                const emailFields = ['parentEmail', 'parentemail', 'email', 'guardianEmail'];
                for (const field of emailFields) {
                    if (data[field] && data[field].toLowerCase() === parentEmail.toLowerCase()) {
                        results.push({
                            id: doc.id,
                            collection: 'tutor_submissions',
                            emergencyMatch: true,
                            matchedField: field,
                            matchedValue: data[field],
                            ...data,
                            timestamp: getTimestampFromData(data),
                            type: 'monthly'
                        });
                        matched = true;
                        break;
                    }
                }
            }
            
            // Check by student name (if we have students in userChildren)
            if (!matched && userChildren.length > 0) {
                const studentName = data.studentName || data.student;
                if (studentName && userChildren.includes(safeText(studentName))) {
                    results.push({
                        id: doc.id,
                        collection: 'tutor_submissions',
                        emergencyMatch: true,
                        matchedField: 'studentName',
                        matchedValue: studentName,
                        ...data,
                        timestamp: getTimestampFromData(data),
                        type: 'monthly'
                    });
                }
            }
        });
        
        // 2. Get ALL student_results and filter client-side
        const allAssessments = await db.collection('student_results').limit(1000).get();
        
        console.log(`🔍 Emergency scanning ${allAssessments.size} assessment results`);
        
        allAssessments.forEach(doc => {
            const data = doc.data();
            let matched = false;
            
            // Check ALL phone fields with ALL variations
            const phoneFields = ['parentPhone', 'parentphone', 'parent_phone', 'phone'];
            for (const field of phoneFields) {
                if (data[field]) {
                    const fieldValue = String(data[field]).trim();
                    for (const phoneVar of phoneVariations) {
                        if (fieldValue === phoneVar || fieldValue.includes(phoneVar)) {
                            results.push({
                                id: doc.id,
                                collection: 'student_results',
                                emergencyMatch: true,
                                matchedField: field,
                                matchedValue: fieldValue,
                                ...data,
                                timestamp: getTimestampFromData(data),
                                type: 'assessment'
                            });
                            matched = true;
                            break;
                        }
                    }
                    if (matched) break;
                }
            }
            
            // Check by email
            if (!matched && parentEmail) {
                const emailFields = ['parentEmail', 'parentemail', 'email'];
                for (const field of emailFields) {
                    if (data[field] && data[field].toLowerCase() === parentEmail.toLowerCase()) {
                        results.push({
                            id: doc.id,
                            collection: 'student_results',
                            emergencyMatch: true,
                            matchedField: field,
                            matchedValue: data[field],
                            ...data,
                            timestamp: getTimestampFromData(data),
                            type: 'assessment'
                        });
                        matched = true;
                        break;
                    }
                }
            }
            
            // Check by student name (if we have students in userChildren)
            if (!matched && userChildren.length > 0) {
                const studentName = data.studentName || data.student;
                if (studentName && userChildren.includes(safeText(studentName))) {
                    results.push({
                        id: doc.id,
                        collection: 'student_results',
                        emergencyMatch: true,
                        matchedField: 'studentName',
                        matchedValue: studentName,
                        ...data,
                        timestamp: getTimestampFromData(data),
                        type: 'assessment'
                    });
                }
            }
        });
        
        console.log(`🚨 EMERGENCY SEARCH found: ${results.length} reports`);
        
    } catch (error) {
        console.error("Emergency search failed:", error);
    }
    
    return results;
}

// Generate ALL possible phone variations with better global support
function generateAllPhoneVariations(phone) {
    const variations = new Set();
    
    if (!phone || typeof phone !== 'string') return [];
    
    // Add original
    variations.add(phone.trim());
    
    // Basic cleaned version (remove all non-digits except +)
    const basicCleaned = phone.replace(/[^\d+]/g, '');
    variations.add(basicCleaned);
    
    // If starts with +, add without +
    if (basicCleaned.startsWith('+')) {
        variations.add(basicCleaned.substring(1));
    }
    
    // Global phone number handling patterns
    const countryCodePatterns = [
        { code: '+1', length: 11 },
        { code: '+234', length: 14 },
        { code: '+44', length: 13 },
        { code: '+91', length: 13 },
        { code: '+86', length: 14 },
        { code: '+33', length: 12 },
        { code: '+49', length: 13 },
        { code: '+81', length: 13 },
        { code: '+61', length: 12 },
        { code: '+55', length: 13 },
        { code: '+7', length: 12 },
        { code: '+20', length: 13 },
        { code: '+27', length: 12 },
        { code: '+34', length: 12 },
        { code: '+39', length: 12 },
        { code: '+52', length: 13 },
        { code: '+62', length: 13 },
        { code: '+82', length: 13 },
        { code: '+90', length: 13 },
        { code: '+92', length: 13 },
        { code: '+966', length: 14 },
        { code: '+971', length: 13 },
        { code: '+233', length: 13 },
        { code: '+254', length: 13 },
        { code: '+255', length: 13 },
        { code: '+256', length: 13 },
        { code: '+237', length: 13 },
        { code: '+251', length: 13 },
        { code: '+250', length: 13 },
        { code: '+260', length: 13 },
        { code: '+263', length: 13 },
        { code: '+265', length: 13 },
        { code: '+267', length: 13 },
        { code: '+268', length: 13 },
        { code: '+269', length: 13 }
    ];
    
    // Try to identify and generate variations for each country code pattern
    for (const pattern of countryCodePatterns) {
        if (basicCleaned.startsWith(pattern.code)) {
            // Remove country code
            const withoutCode = basicCleaned.substring(pattern.code.length);
            variations.add(withoutCode);
            
            // Add with 0 prefix (common in many countries)
            variations.add('0' + withoutCode);
            
            // Add with country code without +
            variations.add(pattern.code.substring(1) + withoutCode);
            
            // Add local format variations
            if (withoutCode.length >= 7) {
                // Common local formats based on country
                if (pattern.code === '+1') {
                    // US/Canada format: (XXX) XXX-XXXX
                    if (withoutCode.length === 10) {
                        variations.add('(' + withoutCode.substring(0, 3) + ') ' + withoutCode.substring(3, 6) + '-' + withoutCode.substring(6));
                    }
                } else if (pattern.code === '+44') {
                    // UK format: 0XXX XXX XXXX
                    if (withoutCode.length === 10) {
                        variations.add('0' + withoutCode.substring(0, 4) + ' ' + withoutCode.substring(4, 7) + ' ' + withoutCode.substring(7));
                    }
                } else {
                    // Generic formats for other countries
                    if (withoutCode.length >= 10) {
                        variations.add(withoutCode.substring(0, 3) + '-' + withoutCode.substring(3));
                        variations.add(withoutCode.substring(0, 4) + '-' + withoutCode.substring(4));
                        variations.add('(' + withoutCode.substring(0, 3) + ') ' + withoutCode.substring(3));
                    }
                }
            }
        }
    }
    
    // If starts with 0 (local number), try adding common country codes
    if (basicCleaned.startsWith('0') && basicCleaned.length > 1) {
        const localNumber = basicCleaned.substring(1);
        
        // Try adding common country codes from our list
        for (const pattern of countryCodePatterns) {
            if (pattern.code !== '+1' || localNumber.length === 10) {
                variations.add(pattern.code + localNumber);
                variations.add(pattern.code.substring(1) + localNumber);
            }
        }
        
        // Also try without the 0
        variations.add(localNumber);
    }
    
    // If it's just digits (no +), try adding + and common codes
    if (/^\d+$/.test(basicCleaned)) {
        // Check if it might already include a country code
        if (basicCleaned.length >= 9) {
            variations.add('+' + basicCleaned);
            
            // Try to match with known country codes
            for (const pattern of countryCodePatterns) {
                const codeWithoutPlus = pattern.code.substring(1);
                if (basicCleaned.startsWith(codeWithoutPlus)) {
                    const localPart = basicCleaned.substring(codeWithoutPlus.length);
                    variations.add(pattern.code + localPart);
                }
            }
            
            // Special handling for common patterns
            if (basicCleaned.length === 10) {
                variations.add('+1' + basicCleaned);
            } else if (basicCleaned.length === 11 && basicCleaned.startsWith('1')) {
                variations.add('+' + basicCleaned);
                variations.add('+1' + basicCleaned.substring(1));
            } else if (basicCleaned.length === 11 && basicCleaned.startsWith('0')) {
                variations.add('+234' + basicCleaned.substring(1));
            }
        }
    }
    
    // Add formatted versions with spaces/dashes for all variations
    const allVariations = Array.from(variations);
    allVariations.forEach(variation => {
        if (variation && variation.length >= 7) {
            // Remove any existing formatting first
            const digitsOnly = variation.replace(/[^\d+]/g, '');
            
            // Add space-separated versions (common formats)
            if (digitsOnly.length === 10) {
                // XXX XXX XXXX format
                const spaced1 = digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
                if (spaced1 !== variation) variations.add(spaced1);
                
                // (XXX) XXX-XXXX format
                const spaced2 = digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
                if (spaced2 !== variation) variations.add(spaced2);
            } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
                // 1 XXX XXX XXXX format (US/Canada with country code)
                const spaced3 = digitsOnly.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
                if (spaced3 !== variation) variations.add(spaced3);
            } else if (digitsOnly.length >= 10) {
                // Generic spacing for other lengths
                const spacedGeneric = digitsOnly.replace(/(\d{3})(?=\d)/g, '$1 ');
                if (spacedGeneric !== variation) variations.add(spacedGeneric);
            }
            
            // Add dash-separated versions
            if (digitsOnly.length >= 10) {
                const dashed = digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                if (dashed !== variation) variations.add(dashed);
            }
        }
    });
    
    // Filter out invalid variations and return
    const finalVariations = Array.from(variations)
        .filter(v => v && v.length >= 7)
        .filter(v => v.length <= 20)
        .filter(v => !v.includes('undefined'))
        .filter((v, i, arr) => arr.indexOf(v) === i);
    
    return finalVariations;
}

// Determine report type
function determineReportType(collectionName, data) {
    if (collectionName.includes('monthly') || collectionName.includes('submission')) {
        return 'monthly';
    }
    if (collectionName.includes('assessment') || collectionName.includes('progress')) {
        return 'assessment';
    }
    if (data.reportType) {
        return data.reportType.toLowerCase();
    }
    if (data.type) {
        return data.type;
    }
    if (data.collection) {
        return data.collection.toLowerCase();
    }
    return 'unknown';
}

// ============================================================================
// SECTION 13: REAL-TIME MONITORING WITHOUT COMPLEX QUERIES
// ============================================================================

function setupRealTimeMonitoring(parentPhone, userId) {
    // Clear any existing listeners
    cleanupRealTimeListeners();
    
    // Normalize phone
    const normalizedPhone = normalizePhoneNumber(parentPhone);
    if (!normalizedPhone.valid) {
        return;
    }
    
    // Monitor monthly reports
    const monthlyListener = db.collection("tutor_submissions")
        .where("parentPhone", "==", normalizedPhone.normalized)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    console.log("🆕 NEW MONTHLY REPORT DETECTED!");
                    showNewReportNotification('monthly');
                }
            });
        }, (error) => {
            console.error("Monthly reports listener error:", error);
        });
    realTimeListeners.push(monthlyListener);
    
    // Monitor assessment reports
    const assessmentListener = db.collection("student_results")
        .where("parentPhone", "==", normalizedPhone.normalized)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    console.log("🆕 NEW ASSESSMENT REPORT DETECTED!");
                    showNewReportNotification('assessment');
                }
            });
        }, (error) => {
            console.error("Assessment reports listener error:", error);
        });
    realTimeListeners.push(assessmentListener);
    
    // Monitor academics periodically
    setInterval(() => {
        checkForNewAcademics();
    }, 30000);
}

function cleanupRealTimeListeners() {
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    realTimeListeners = [];
}

function showNewReportNotification(type) {
    const reportType = type === 'assessment' ? 'Assessment Report' : 
                      type === 'monthly' ? 'Monthly Report' : 'New Update';
    
    showMessage(`New ${reportType} available!`, 'success');
    
    // Add a visual indicator in the UI
    const existingIndicator = document.getElementById('newReportIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'newReportIndicator';
    indicator.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse fade-in';
    indicator.innerHTML = `📄 New ${safeText(reportType)} Available!`;
    document.body.appendChild(indicator);
    
    // Remove after 5 seconds
    setTimeout(() => {
        indicator.remove();
    }, 5000);
}

// ============================================================================
// SECTION 14: YEARLY ARCHIVES REPORTS SYSTEM WITH ACCORDIONS
// ============================================================================

/**
 * Creates a hierarchical accordion view for reports
 * Student Name → Year → Month → Report Type (Assessments/Monthly)
 */
function createYearlyArchiveReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    
    // Sort students alphabetically
    const sortedStudents = Array.from(reportsByStudent.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [studentName, reports] of sortedStudents) {
        const fullName = capitalize(studentName);
        const studentData = reports.studentData;
        
        // Count reports for this student
        const assessmentCount = Array.from(reports.assessments.values()).flat().length;
        const monthlyCount = Array.from(reports.monthly.values()).flat().length;
        const totalCount = assessmentCount + monthlyCount;
        
        // Create student accordion header with beautiful design
        html += `
            <div class="accordion-item mb-6 fade-in">
                <button onclick="toggleAccordion('student-${studentIndex}')" 
                        class="accordion-header w-full flex justify-between items-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1">
                    <div class="flex items-center">
                        <div class="mr-4 p-3 bg-green-100 rounded-full">
                            <span class="text-2xl text-green-600">👤</span>
                        </div>
                        <div class="text-left">
                            <h3 class="font-bold text-green-900 text-xl">${fullName}</h3>
                            <div class="flex items-center mt-1">
                                <span class="text-green-600 text-sm">
                                    ${assessmentCount} Assessment(s) • ${monthlyCount} Monthly Report(s)
                                </span>
                                ${studentData?.isPending ? 
                                    '<span class="ml-3 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Pending Registration</span>' : 
                                    '<span class="ml-3 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Active</span>'}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <span class="text-green-700 font-semibold">Total: ${totalCount}</span>
                        <span id="student-${studentIndex}-arrow" class="accordion-arrow text-green-600 text-2xl transform transition-transform duration-300">▼</span>
                    </div>
                </button>
                <div id="student-${studentIndex}-content" class="accordion-content hidden mt-4">
        `;
        
        // If no reports, show beautiful empty state
        if (totalCount === 0) {
            html += `
                <div class="p-8 bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-xl text-center shadow-sm">
                    <div class="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                        <span class="text-3xl text-blue-600">📄</span>
                    </div>
                    <h4 class="text-lg font-semibold text-gray-800 mb-2">No Reports Yet</h4>
                    <p class="text-gray-600 max-w-md mx-auto mb-4">No reports have been generated for ${fullName} yet. Reports will appear here once tutors or assessors submit them.</p>
                    <div class="inline-flex items-center text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                        <span class="mr-2">🕒</span>
                        Check back after your child's sessions
                    </div>
                    ${studentData?.isPending ? 
                        '<div class="mt-4 inline-flex items-center text-sm text-yellow-700 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">⚠️ This student is pending registration. Reports will be available after registration is complete.</div>' : 
                        ''}
                </div>
            `;
        } else {
            // Group reports by year
            const reportsByYear = new Map();
            
            // Process assessment reports by year
            for (const [sessionKey, sessionReports] of reports.assessments) {
                sessionReports.forEach(report => {
                    const year = new Date(report.timestamp * 1000).getFullYear();
                    if (!reportsByYear.has(year)) {
                        reportsByYear.set(year, { assessments: [], monthly: [] });
                    }
                    reportsByYear.get(year).assessments.push({ 
                        sessionKey, 
                        reports: sessionReports,
                        date: new Date(report.timestamp * 1000)
                    });
                });
            }
            
            // Process monthly reports by year
            for (const [sessionKey, sessionReports] of reports.monthly) {
                sessionReports.forEach(report => {
                    const year = new Date(report.timestamp * 1000).getFullYear();
                    if (!reportsByYear.has(year)) {
                        reportsByYear.set(year, { assessments: [], monthly: [] });
                    }
                    reportsByYear.get(year).monthly.push({ 
                        sessionKey, 
                        reports: sessionReports,
                        date: new Date(report.timestamp * 1000)
                    });
                });
            }
            
            // Sort years in descending order (newest first)
            const sortedYears = Array.from(reportsByYear.keys()).sort((a, b) => b - a);
            
            // Create year accordions
            let yearIndex = 0;
            for (const year of sortedYears) {
                const yearData = reportsByYear.get(year);
                const yearAssessmentCount = yearData.assessments.length;
                const yearMonthlyCount = yearData.monthly.length;
                const yearTotal = yearAssessmentCount + yearMonthlyCount;
                
                html += `
                    <div class="mb-4 ml-2">
                        <button onclick="toggleAccordion('year-${studentIndex}-${yearIndex}')" 
                                class="accordion-header w-full flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-300">
                            <div class="flex items-center">
                                <div class="mr-3 p-2 bg-blue-100 rounded-lg">
                                    <span class="text-xl text-blue-600">📅</span>
                                </div>
                                <div class="text-left">
                                    <h4 class="font-bold text-blue-900">${year}</h4>
                                    <p class="text-blue-600 text-sm">
                                        ${yearAssessmentCount} Assessment(s) • ${yearMonthlyCount} Monthly Report(s)
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center space-x-3">
                                <span class="text-blue-700 font-medium">${yearTotal} total</span>
                                <span id="year-${studentIndex}-${yearIndex}-arrow" class="accordion-arrow text-blue-600 transform transition-transform duration-300">▼</span>
                            </div>
                        </button>
                        <div id="year-${studentIndex}-${yearIndex}-content" class="accordion-content hidden ml-6 mt-3">
                `;
                
                // Assessment Reports for this year
                if (yearAssessmentCount > 0) {
                    html += `
                        <div class="mb-6">
                            <div class="flex items-center mb-4 p-3 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-100 rounded-lg">
                                <div class="mr-3 p-2 bg-purple-100 rounded-lg">
                                    <span class="text-xl text-purple-600">📊</span>
                                </div>
                                <div>
                                    <h5 class="font-bold text-purple-800">Assessment Reports</h5>
                                    <p class="text-purple-600 text-sm">Test scores and performance metrics</p>
                                </div>
                                <span class="ml-auto bg-purple-100 text-purple-800 text-xs font-medium px-3 py-1 rounded-full">${yearAssessmentCount} reports</span>
                            </div>
                    `;
                    
                    // Group assessments by month
                    const assessmentsByMonth = new Map();
                    yearData.assessments.forEach(({ sessionKey, reports: sessionReports, date }) => {
                        const month = date.getMonth();
                        if (!assessmentsByMonth.has(month)) {
                            assessmentsByMonth.set(month, []);
                        }
                        assessmentsByMonth.get(month).push({ sessionKey, reports: sessionReports, date });
                    });
                    
                    // Sort months in descending order (newest first)
                    const sortedMonths = Array.from(assessmentsByMonth.keys()).sort((a, b) => b - a);
                    
                    sortedMonths.forEach(month => {
                        const monthName = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ][month];
                        const monthAssessments = assessmentsByMonth.get(month);
                        
                        html += `
                            <div class="mb-4 ml-2">
                                <h6 class="font-semibold text-gray-700 mb-3 flex items-center">
                                    <span class="mr-2 text-gray-500">📌</span>
                                    ${monthName}
                                    <span class="ml-2 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">${monthAssessments.length} assessments</span>
                                </h6>
                                <div class="space-y-4">
                        `;
                        
                        monthAssessments.forEach(({ sessionKey, reports: sessionReports, date }, sessionIndex) => {
                            html += createAssessmentReportHTML(sessionReports, studentIndex, `${year}-${month}-${sessionIndex}`, fullName, date);
                        });
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `</div>`;
                }
                
                // Monthly Reports for this year
                if (yearMonthlyCount > 0) {
                    html += `
                        <div class="mb-6">
                            <div class="flex items-center mb-4 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100 rounded-lg">
                                <div class="mr-3 p-2 bg-teal-100 rounded-lg">
                                    <span class="text-xl text-teal-600">📈</span>
                                </div>
                                <div>
                                    <h5 class="font-bold text-teal-800">Monthly Reports</h5>
                                    <p class="text-teal-600 text-sm">Progress updates and session summaries</p>
                                </div>
                                <span class="ml-auto bg-teal-100 text-teal-800 text-xs font-medium px-3 py-1 rounded-full">${yearMonthlyCount} reports</span>
                            </div>
                    `;
                    
                    // Group monthly reports by month
                    const monthlyByMonth = new Map();
                    yearData.monthly.forEach(({ sessionKey, reports: sessionReports, date }) => {
                        const month = date.getMonth();
                        if (!monthlyByMonth.has(month)) {
                            monthlyByMonth.set(month, []);
                        }
                        monthlyByMonth.get(month).push({ sessionKey, reports: sessionReports, date });
                    });
                    
                    // Sort months in descending order (newest first)
                    const sortedMonths = Array.from(monthlyByMonth.keys()).sort((a, b) => b - a);
                    
                    sortedMonths.forEach(month => {
                        const monthName = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ][month];
                        const monthReports = monthlyByMonth.get(month);
                        
                        html += `
                            <div class="mb-4 ml-2">
                                <h6 class="font-semibold text-gray-700 mb-3 flex items-center">
                                    <span class="mr-2 text-gray-500">📌</span>
                                    ${monthName}
                                    <span class="ml-2 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">${monthReports.length} reports</span>
                                </h6>
                                <div class="space-y-4">
                        `;
                        
                        monthReports.forEach(({ sessionKey, reports: sessionReports, date }, sessionIndex) => {
                            html += createMonthlyReportHTML(sessionReports, studentIndex, `${year}-${month}-${sessionIndex}`, fullName, date);
                        });
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `</div>`;
                }
                
                html += `
                        </div>
                    </div>
                `;
                
                yearIndex++;
            }
        }
        
        html += `
                </div>
            </div>
        `;
        
        studentIndex++;
    }
    
    return html;
}

function createAssessmentReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
    const firstReport = sessionReports[0];
    const formattedDate = formatDetailedDate(date || new Date(firstReport.timestamp * 1000), true);
    
    // Calculate overall stats
    let totalCorrect = 0;
    let totalQuestions = 0;
    let overallPercentage = 0;
    
    const results = sessionReports.map(testResult => {
        const topics = [...new Set(testResult.answers?.map(a => safeText(a.topic)).filter(t => t))] || [];
        const correct = testResult.score !== undefined ? testResult.score : 0;
        const total = testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0;
        
        totalCorrect += correct;
        totalQuestions += total;
        
        return {
            subject: safeText(testResult.subject || testResult.testSubject || 'General'),
            correct: correct,
            total: total,
            percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
            topics: topics,
        };
    });
    
    if (totalQuestions > 0) {
        overallPercentage = Math.round((totalCorrect / totalQuestions) * 100);
    }
    
    // Determine performance color
    let performanceColor = 'text-red-600';
    let performanceBg = 'bg-red-100';
    if (overallPercentage >= 80) {
        performanceColor = 'text-green-600';
        performanceBg = 'bg-green-100';
    } else if (overallPercentage >= 60) {
        performanceColor = 'text-yellow-600';
        performanceBg = 'bg-yellow-100';
    }
    
    const tableRows = results.map(res => `
        <tr class="hover:bg-gray-50 transition-colors duration-200">
            <td class="border border-gray-200 px-4 py-3 font-medium text-gray-800">${res.subject.toUpperCase()}</td>
            <td class="border border-gray-200 px-4 py-3 text-center">
                <span class="font-bold ${res.percentage >= 80 ? 'text-green-600' : res.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}">
                    ${res.correct} / ${res.total}
                </span>
                <span class="block text-sm ${res.percentage >= 80 ? 'text-green-500' : res.percentage >= 60 ? 'text-yellow-500' : 'text-red-500'}">
                    ${res.percentage}%
                </span>
            </td>
            <td class="border border-gray-200 px-4 py-3 text-sm text-gray-600">
                ${res.topics.length > 0 ? res.topics.slice(0, 3).join(', ') : 'Various topics'}
                ${res.topics.length > 3 ? `<span class="text-gray-400 text-xs ml-1">+${res.topics.length - 3} more</span>` : ''}
            </td>
        </tr>
    `).join("");
    
    return `
        <div class="border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-5 bg-white" id="assessment-block-${studentIndex}-${sessionId}">
            <div class="flex justify-between items-start mb-4 pb-4 border-b border-gray-100">
                <div>
                    <div class="flex items-center mb-2">
                        <span class="text-green-600 mr-2">📊</span>
                        <h5 class="font-bold text-gray-800 text-lg">Assessment Report</h5>
                        <span class="ml-3 ${performanceBg} ${performanceColor} text-xs font-bold px-3 py-1 rounded-full">
                            ${overallPercentage}% Overall
                        </span>
                    </div>
                    <p class="text-gray-600 text-sm">
                        <span class="font-medium">Date:</span> ${safeText(formattedDate)}
                        ${firstReport.tutorName ? ` • <span class="font-medium">Tutor:</span> ${safeText(firstReport.tutorName)}` : ''}
                    </p>
                </div>
                <button onclick="downloadSessionReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}', 'assessment')" 
                        class="flex items-center bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5">
                    <span class="mr-2">📥</span>
                    <span class="font-medium text-sm">Download PDF</span>
                </button>
            </div>
            
            <div class="mb-4">
                <div class="grid grid-cols-3 gap-4 mb-4">
                    <div class="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <p class="text-xs text-blue-600 font-medium">Total Score</p>
                        <p class="text-xl font-bold text-blue-700">${totalCorrect}/${totalQuestions}</p>
                    </div>
                    <div class="bg-green-50 p-3 rounded-lg border border-green-100">
                        <p class="text-xs text-green-600 font-medium">Overall Percentage</p>
                        <p class="text-xl font-bold ${performanceColor}">${overallPercentage}%</p>
                    </div>
                    <div class="bg-purple-50 p-3 rounded-lg border border-purple-100">
                        <p class="text-xs text-purple-600 font-medium">Subjects Tested</p>
                        <p class="text-xl font-bold text-purple-700">${results.length}</p>
                    </div>
                </div>
                
                <div class="overflow-x-auto rounded-lg border border-gray-200">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Subject</th>
                                <th class="border-b border-gray-200 px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Score</th>
                                <th class="border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Topics Covered</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
            
            ${firstReport.notes || firstReport.comments ? `
            <div class="mt-4 pt-4 border-t border-gray-100">
                <div class="flex items-center mb-2">
                    <span class="text-yellow-500 mr-2">💡</span>
                    <h6 class="font-semibold text-gray-700">Additional Notes</h6>
                </div>
                <p class="text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-sm">
                    ${safeText(firstReport.notes || firstReport.comments || 'No additional notes provided.')}
                </p>
            </div>
            ` : ''}
        </div>
    `;
}

function createMonthlyReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
    const firstReport = sessionReports[0];
    const formattedDate = formatDetailedDate(date || new Date(firstReport.timestamp * 1000), true);
    const safeTopics = safeText(firstReport.topics ? firstReport.topics : 'No topics recorded for this session.');
    const safeProgress = safeText(firstReport.studentProgress || firstReport.progressNotes || 'No progress notes provided.');
    
    // Extract month and year for display
    const reportDate = date || new Date(firstReport.timestamp * 1000);
    const monthName = reportDate.toLocaleString('default', { month: 'long' });
    const year = reportDate.getFullYear();
    
    return `
        <div class="border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-5 bg-white" id="monthly-block-${studentIndex}-${sessionId}">
            <div class="flex justify-between items-start mb-4 pb-4 border-b border-gray-100">
                <div>
                    <div class="flex items-center mb-2">
                        <span class="text-blue-600 mr-2">📈</span>
                        <h5 class="font-bold text-gray-800 text-lg">Monthly Progress Report</h5>
                        <span class="ml-3 bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                            ${monthName} ${year}
                        </span>
                    </div>
                    <p class="text-gray-600 text-sm">
                        <span class="font-medium">Submitted:</span> ${safeText(formattedDate)}
                        ${firstReport.tutorName ? ` • <span class="font-medium">Tutor:</span> ${safeText(firstReport.tutorName)}` : ''}
                    </p>
                </div>
                <button onclick="downloadMonthlyReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}')" 
                        class="flex items-center bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5">
                    <span class="mr-2">📥</span>
                    <span class="font-medium text-sm">Download PDF</span>
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div class="flex items-center mb-3">
                        <span class="text-green-500 mr-2">📚</span>
                        <h6 class="font-semibold text-gray-700">Topics Covered</h6>
                    </div>
                    <p class="text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-gray-100 text-sm">${safeTopics}</p>
                </div>
                
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div class="flex items-center mb-3">
                        <span class="text-purple-500 mr-2">📝</span>
                        <h6 class="font-semibold text-gray-700">Progress Notes</h6>
                    </div>
                    <p class="text-gray-700 whitespace-pre-wrap bg-white p-3 rounded border border-gray-100 text-sm">${safeProgress}</p>
                </div>
            </div>
            
            ${firstReport.areasOfImprovement || firstReport.recommendations ? `
            <div class="mt-4 pt-4 border-t border-gray-100">
                <div class="flex items-center mb-3">
                    <span class="text-orange-500 mr-2">🎯</span>
                    <h6 class="font-semibold text-gray-700">Areas for Improvement & Recommendations</h6>
                </div>
                <div class="bg-orange-50 p-4 rounded-lg border border-orange-100">
                    <p class="text-gray-700 whitespace-pre-wrap text-sm">
                        ${safeText(firstReport.areasOfImprovement || firstReport.recommendations || 'No specific recommendations provided.')}
                    </p>
                </div>
            </div>
            ` : ''}
            
            ${firstReport.nextSteps || firstReport.futureGoals ? `
            <div class="mt-4 pt-4 border-t border-gray-100">
                <div class="flex items-center mb-3">
                    <span class="text-teal-500 mr-2">🚀</span>
                    <h6 class="font-semibold text-gray-700">Next Steps & Goals</h6>
                </div>
                <div class="bg-teal-50 p-4 rounded-lg border border-teal-100">
                    <p class="text-gray-700 whitespace-pre-wrap text-sm">
                        ${safeText(firstReport.nextSteps || firstReport.futureGoals || 'No specific goals set for next period.')}
                    </p>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function downloadSessionReport(studentIndex, sessionId, studentName, type) {
    const element = document.getElementById(`${type}-block-${studentIndex}-${sessionId}`);
    if (!element) {
        showMessage('Report element not found for download', 'error');
        return;
    }
    const safeStudentName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}_${Date.now()}.pdf`;
    
    const opt = {
        margin: 0.5,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff'
        },
        jsPDF: { 
            unit: 'in', 
            format: 'letter', 
            orientation: 'portrait' 
        }
    };
    
    showMessage('Generating PDF download...', 'success');
    
    html2pdf().from(element).set(opt).save();
}

function downloadMonthlyReport(studentIndex, sessionId, studentName) {
    downloadSessionReport(studentIndex, sessionId, studentName, 'monthly');
}

// FIXED: Accordion toggle function
function toggleAccordion(elementId) {
    const content = document.getElementById(`${elementId}-content`);
    const arrow = document.getElementById(`${elementId}-arrow`);
    
    if (!content || !arrow) {
        console.error(`Could not find accordion elements for ${elementId}`);
        return;
    }
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        arrow.textContent = '▼';
    }
}

// ============================================================================
// SECTION 15: MAIN REPORT LOADING FUNCTION (FIXED & VERIFIED)
// ============================================================================

async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    // 1. UI STATE MANAGEMENT
    if (auth.currentUser && authArea && reportArea) {
        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        authLoader.classList.add("hidden");
        localStorage.setItem('isAuthenticated', 'true');
    } else {
        localStorage.removeItem('isAuthenticated');
    }

    if (authLoader) authLoader.classList.remove("hidden");

    try {
        // 2. CACHE CHECK (Short-lived: 5 minutes)
        const cacheKey = `reportCache_${parentPhone}`;
        const cacheDuration = 5 * 60 * 1000; // 5 minutes
        
        if (!forceRefresh) {
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const cacheData = JSON.parse(cachedItem);
                    if (Date.now() - cacheData.timestamp < cacheDuration) {
                        
                        // Restore global state
                        currentUserData = cacheData.userData;
                        userChildren = cacheData.studentList || [];
                        
                        if (reportContent) reportContent.innerHTML = cacheData.html;
                        
                        // UI Restoration
                        if (welcomeMessage && currentUserData.parentName) {
                            welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;
                        }

                        // Re-initialize dynamic components
                        addManualRefreshButton();
                        addLogoutButton();
                        loadReferralRewards(userId);
                        loadAcademicsData();
                        setupRealTimeMonitoring(parentPhone, userId);
                        
                        return;
                    }
                }
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }

        // 3. CRITICAL: FIND ALL CHILDREN FIRST
        const childrenResult = await comprehensiveFindChildren(parentPhone);
        
        // Update Global State BEFORE searching for reports
        userChildren = childrenResult.studentNames;
        studentIdMap = childrenResult.studentNameIdMap;
        allStudentData = childrenResult.allStudentData;

        console.log("👥 Found children for report distribution:", userChildren);
        console.log("🆔 Student ID Map:", Array.from(studentIdMap.entries()));

        // 4. USER PROFILE & REFERRAL SYNC
        let parentName = null;
        if (allStudentData && allStudentData.length > 0) {
            const studentWithParentInfo = allStudentData.find(s => 
                s.data && (s.data.parentName || s.data.guardianName || s.data.fatherName || s.data.motherName)
            );
            
            if (studentWithParentInfo) {
                parentName = studentWithParentInfo.data.parentName || 
                             studentWithParentInfo.data.guardianName || 
                             studentWithParentInfo.data.fatherName || 
                             studentWithParentInfo.data.motherName;
            }
        }

        const userDocRef = db.collection('parent_users').doc(userId);
        let userDoc = await userDocRef.get();
        let userData = userDoc.data();

        // Ensure referral code exists
        if (userDoc.exists && !userData.referralCode) {
            const newCode = await generateReferralCode();
            await userDocRef.update({ referralCode: newCode });
        }

        // Parent Name Fallback Logic
        if (!parentName && userData?.parentName) parentName = userData.parentName;
        if (!parentName) parentName = 'Parent';

        // Update Global User Data
        currentUserData = {
            parentName: safeText(parentName),
            parentPhone: parentPhone,
            email: userData?.email || ''
        };

        if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;

        // 5. REPORT AGGREGATION WITH PROPER DISTRIBUTION
        console.log("🔍 Starting report search with student mapping ready...");
        const { assessmentResults, monthlyResults, searchStats } = await searchAllReportsForParent(
            parentPhone, 
            currentUserData.email, 
            userId
        );

        console.log("📊 Report distribution results:", {
            totalAssessments: assessmentResults.length,
            totalMonthly: monthlyResults.length,
            searchStats: searchStats
        });

        // 6. DATA MAPPING - Group reports by student
        const reportsByStudent = new Map();

        // A. Initialize containers for ALL known students (Empty or Not)
        userChildren.forEach(studentName => {
            const studentInfo = allStudentData.find(s => s.name === studentName);
            reportsByStudent.set(studentName, { 
                assessments: new Map(), 
                monthly: new Map(),
                studentData: studentInfo || { name: studentName, isPending: false }
            });
            
            console.log(`📁 Created container for student: ${studentName}`);
        });

        // B. Populate containers with Assessment Data - PROPERLY ASSIGNED
        console.log("📝 Assigning assessment reports to students...");
        assessmentResults.forEach((report, index) => {
            const studentName = report.assignedStudentName;
            
            if (studentName && reportsByStudent.has(studentName)) {
                const sessionKey = Math.floor(report.timestamp / 86400);
                const studentRecord = reportsByStudent.get(studentName);
                
                if (!studentRecord.assessments.has(sessionKey)) {
                    studentRecord.assessments.set(sessionKey, []);
                }
                studentRecord.assessments.get(sessionKey).push(report);
                
                console.log(`✅ Assessment ${index + 1} assigned to ${studentName}`);
            } else {
                console.warn(`⚠️ Assessment ${index + 1} could not be assigned:`, {
                    studentName: studentName,
                    availableStudents: Array.from(reportsByStudent.keys())
                });
            }
        });

        // C. Populate containers with Monthly Report Data - PROPERLY ASSIGNED
        console.log("📝 Assigning monthly reports to students...");
        monthlyResults.forEach((report, index) => {
            const studentName = report.assignedStudentName;
            
            if (studentName && reportsByStudent.has(studentName)) {
                const sessionKey = Math.floor(report.timestamp / 86400);
                const studentRecord = reportsByStudent.get(studentName);
                
                if (!studentRecord.monthly.has(sessionKey)) {
                    studentRecord.monthly.set(sessionKey, []);
                }
                studentRecord.monthly.get(sessionKey).push(report);
                
                console.log(`✅ Monthly report ${index + 1} assigned to ${studentName}`);
            } else {
                console.warn(`⚠️ Monthly report ${index + 1} could not be assigned:`, {
                    studentName: studentName,
                    availableStudents: Array.from(reportsByStudent.keys())
                });
            }
        });

        // 7. DEBUG: Show distribution summary
        console.log("📊 FINAL REPORT DISTRIBUTION SUMMARY:");
        for (const [studentName, reports] of reportsByStudent) {
            const assessmentCount = Array.from(reports.assessments.values()).flat().length;
            const monthlyCount = Array.from(reports.monthly.values()).flat().length;
            console.log(`   ${studentName}: ${assessmentCount} assessments, ${monthlyCount} monthly reports`);
        }

        // 8. RENDER (Generate the UI with beautiful design)
        if (reportContent) {
            const reportsHtml = createYearlyArchiveReportView(reportsByStudent);
            reportContent.innerHTML = reportsHtml;
        }

        // 9. UPDATE CACHE (Short-lived)
        try {
            const dataToCache = {
                timestamp: Date.now(),
                html: reportContent ? reportContent.innerHTML : '',
                userData: currentUserData,
                studentList: userChildren,
                distributionSummary: Array.from(reportsByStudent.entries()).map(([name, reports]) => ({
                    student: name,
                    assessments: Array.from(reports.assessments.values()).flat().length,
                    monthly: Array.from(reports.monthly.values()).flat().length
                }))
            };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        } catch (e) {
            console.error("Cache write failed:", e);
        }

        // 10. FINAL UI COMPONENTS
        if (authArea && reportArea) {
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
        }
        
        addManualRefreshButton();
        addLogoutButton();
        setupRealTimeMonitoring(parentPhone, userId);
        loadReferralRewards(userId);
        loadAcademicsData();

    } catch (error) {
        console.error("❌ CRITICAL FAILURE in Report Loading:", error);
        if (reportContent) {
            reportContent.innerHTML = `
                <div class="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 p-6 rounded-xl shadow-md">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <span class="text-2xl text-red-600">⚠️</span>
                            </div>
                        </div>
                        <div class="ml-4">
                            <h3 class="text-lg font-bold text-red-800">System Error</h3>
                            <p class="text-sm text-red-700 mt-1">We encountered an issue loading your dashboard: ${safeText(error.message)}</p>
                            <div class="mt-4 flex space-x-3">
                                <button onclick="window.location.reload()" 
                                        class="bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors duration-200">
                                    🔄 Reload Page
                                </button>
                                <button onclick="showDiagnostics()" 
                                        class="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-200 transition-colors duration-200">
                                    🛠️ Show Diagnostics
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    } finally {
        if (authLoader) authLoader.classList.add("hidden");
    }
}

// ============================================================================
// SECTION 16: ADMIN DIAGNOSTICS FUNCTIONS
// ============================================================================

// Add this to help diagnose missing reports
async function showDiagnostics() {
    const user = auth.currentUser;
    if (!user) return;
    
    const userDoc = await db.collection('parent_users').doc(user.uid).get();
    const userData = userDoc.data();
    
    let diagnosticsHtml = `
        <div class="bg-yellow-50 border border-yellow-300 rounded-lg p-6 mt-4">
            <h3 class="text-lg font-bold text-yellow-800 mb-4">📊 Diagnostics</h3>
            <div class="space-y-3">
                <p><strong>Parent Phone:</strong> ${userData?.phone || 'Not set'}</p>
                <p><strong>Normalized Phone:</strong> ${userData?.normalizedPhone || 'Not set'}</p>
                <p><strong>Parent Email:</strong> ${userData?.email || 'Not set'}</p>
                <p><strong>Parent UID:</strong> ${user.uid}</p>
    `;
    
    // Check what students are linked
    const childrenResult = await comprehensiveFindChildren(userData?.normalizedPhone || userData?.phone);
    
    diagnosticsHtml += `<p><strong>Linked Students:</strong> ${childrenResult.studentNames.length}</p>`;
    
    if (childrenResult.studentNames.length > 0) {
        diagnosticsHtml += `<ul class="list-disc pl-5 mt-2">`;
        childrenResult.studentNames.forEach(studentName => {
            diagnosticsHtml += `<li>${studentName}</li>`;
        });
        diagnosticsHtml += `</ul>`;
    }
    
    diagnosticsHtml += `
            </div>
            <button onclick="runReportSearchDiagnostics()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded">
                Run Diagnostics
            </button>
        </div>
    `;
    
    // Add to page temporarily
    const reportContent = document.getElementById('reportContent');
    if (reportContent) {
        reportContent.innerHTML = diagnosticsHtml + reportContent.innerHTML;
    }
}

// Run diagnostics
async function runReportSearchDiagnostics() {
    const user = auth.currentUser;
    if (!user) return;
    
    const userDoc = await db.collection('parent_users').doc(user.uid).get();
    const userData = userDoc.data();
    
    // 1. Check what data exists
    console.log("📋 Parent Data:", userData);
    
    // 2. Find linked students
    const children = await comprehensiveFindChildren(userData?.normalizedPhone || userData?.phone);
    console.log("👥 Linked Students:", children);
    
    // 3. Search for reports
    const searchResults = await searchAllReportsForParent(
        userData?.normalizedPhone || userData?.phone,
        userData?.email,
        user.uid
    );
    
    console.log("📊 Search Results:", searchResults);
    
    showMessage(`Diagnostics complete. Found ${searchResults.assessmentResults.length + searchResults.monthlyResults.length} reports.`, 'success');
}

// ============================================================================
// SECTION 17: TAB MANAGEMENT & NAVIGATION
// ============================================================================

function switchMainTab(tab) {
    const reportTab = document.getElementById('reportTab');
    const academicsTab = document.getElementById('academicsTab');
    const rewardsTab = document.getElementById('rewardsTab');
    
    const reportContentArea = document.getElementById('reportContentArea');
    const academicsContentArea = document.getElementById('academicsContentArea');
    const rewardsContentArea = document.getElementById('rewardsContentArea');
    
    // Deactivate all tabs
    reportTab?.classList.remove('tab-active-main');
    reportTab?.classList.add('tab-inactive-main');
    academicsTab?.classList.remove('tab-active-main');
    academicsTab?.classList.add('tab-inactive-main');
    rewardsTab?.classList.remove('tab-active-main');
    rewardsTab?.classList.add('tab-inactive-main');
    
    // Hide all content areas
    reportContentArea?.classList.add('hidden');
    academicsContentArea?.classList.add('hidden');
    rewardsContentArea?.classList.add('hidden');
    
    // Activate selected tab and show content
    if (tab === 'reports') {
        reportTab?.classList.remove('tab-inactive-main');
        reportTab?.classList.add('tab-active-main');
        reportContentArea?.classList.remove('hidden');
    } else if (tab === 'academics') {
        academicsTab?.classList.remove('tab-inactive-main');
        academicsTab?.classList.add('tab-active-main');
        academicsContentArea?.classList.remove('hidden');
        
        // Load academics data when the tab is clicked
        loadAcademicsData();
    } else if (tab === 'rewards') {
        rewardsTab?.classList.remove('tab-inactive-main');
        rewardsTab?.classList.add('tab-active-main');
        rewardsContentArea?.classList.remove('hidden');
        
        // Reload rewards data when the tab is clicked to ensure it's up-to-date
        const user = auth.currentUser;
        if (user) {
            loadReferralRewards(user.uid);
        }
    }
}

function logout() {
    // Clear remember me on logout
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('isAuthenticated');
    
    // Clean up real-time listeners
    cleanupRealTimeListeners();
    
    auth.signOut().then(() => {
        window.location.reload();
    });
}

// ============================================================================
// SECTION 18: UNIFIED AUTH & DATA MANAGER - FIXES RELOADING & MISSING CHILDREN
// ============================================================================

class UnifiedAuthManager {
    constructor() {
        this.currentUser = null;
        this.authListener = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.lastProcessTime = 0;
        this.DEBOUNCE_MS = 2000; // 2 second minimum between auth changes
    }

    /**
     * Initialize auth listener - CALL ONLY ONCE
     */
    initialize() {
        if (this.isInitialized) {
            return;
        }

        console.log("🔐 Initializing Unified Auth Manager");

        // Remove any existing listeners first
        this.cleanup();

        // Set up single auth listener
        this.authListener = auth.onAuthStateChanged(
            (user) => this.handleAuthChange(user),
            (error) => this.handleAuthError(error)
        );

        this.isInitialized = true;
        console.log("✅ Auth manager initialized");
    }

    /**
     * Handle auth state changes with debouncing
     */
    async handleAuthChange(user) {
        const now = Date.now();
        const timeSinceLastProcess = now - this.lastProcessTime;

        // Prevent rapid successive calls
        if (this.isProcessing) {
            console.log("⏸️ Auth change already processing, ignoring");
            return;
        }

        // Debounce to prevent loops
        if (timeSinceLastProcess < this.DEBOUNCE_MS) {
            console.log(`⏸️ Debouncing auth change (${timeSinceLastProcess}ms since last)`);
            return;
        }

        this.isProcessing = true;
        this.lastProcessTime = now;

        try {
            if (user && user.uid) {
                console.log(`👤 User authenticated: ${user.uid.substring(0, 8)}...`);
                await this.loadUserDashboard(user);
            } else {
                console.log("🚪 User signed out");
                this.showAuthScreen();
            }
        } catch (error) {
            console.error("❌ Auth change error:", error);
            showMessage("Authentication error. Please refresh.", "error");
        } finally {
            // Reset processing flag after delay
            setTimeout(() => {
                this.isProcessing = false;
            }, 1000);
        }
    }

    /**
     * Handle auth errors
     */
    handleAuthError(error) {
        console.error("❌ Auth listener error:", error);
        showMessage("Authentication error occurred", "error");
    }

    /**
     * Load user dashboard - SINGLE ENTRY POINT
     */
    async loadUserDashboard(user) {
        console.log("📊 Loading dashboard for user");

        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        const authLoader = document.getElementById("authLoader");

        // Show loading state
        if (authLoader) authLoader.classList.remove("hidden");

        try {
            // 1. Get user data from Firestore
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                throw new Error("User profile not found");
            }

            const userData = userDoc.data();
            this.currentUser = {
                uid: user.uid,
                email: userData.email,
                phone: userData.phone,
                normalizedPhone: userData.normalizedPhone || userData.phone,
                parentName: userData.parentName || 'Parent',
                referralCode: userData.referralCode
            };

            console.log("👤 User data loaded:", this.currentUser.parentName);

            // 2. Update UI immediately (prevent feeling of lag)
            this.showDashboardUI();

            // 3. Load all data in parallel (faster)
            await Promise.all([
                this.loadAllChildrenAndReports(),
                this.loadReferralsData(),
                this.loadAcademicsData(),
                this.setupRealtimeMonitoring()
            ]);

            // 4. Setup UI components
            this.setupUIComponents();

            console.log("✅ Dashboard fully loaded");

        } catch (error) {
            console.error("❌ Dashboard load error:", error);
            showMessage(error.message || "Failed to load dashboard", "error");
            this.showAuthScreen();
        } finally {
            if (authLoader) authLoader.classList.add("hidden");
        }
    }

    /**
     * Show dashboard UI
     */
    showDashboardUI() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        const welcomeMessage = document.getElementById("welcomeMessage");

        if (authArea) authArea.classList.add("hidden");
        if (reportArea) reportArea.classList.remove("hidden");
        
        if (welcomeMessage && this.currentUser) {
            welcomeMessage.textContent = `Welcome, ${this.currentUser.parentName}!`;
        }

        localStorage.setItem('isAuthenticated', 'true');
    }

    /**
     * Show auth screen
     */
    showAuthScreen() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");

        if (authArea) authArea.classList.remove("hidden");
        if (reportArea) reportArea.classList.add("hidden");

        localStorage.removeItem('isAuthenticated');
        cleanupRealTimeListeners();
    }

    /**
     * Load all children and reports - COMPREHENSIVE SEARCH
     */
    async loadAllChildrenAndReports() {
        console.log("🔍 Searching for all children and reports");

        try {
            // Use the comprehensive search
            const childrenData = await comprehensiveFindChildren(this.currentUser.normalizedPhone);
            
            // Store globally
            userChildren = childrenData.studentNames;
            studentIdMap = childrenData.studentNameIdMap;
            allStudentData = childrenData.allStudentData;

            console.log(`✅ Found ${userChildren.length} children:`, userChildren);

            // Load reports for all children
            await loadAllReportsForParent(
                this.currentUser.normalizedPhone,
                this.currentUser.uid,
                false // Don't force refresh
            );

        } catch (error) {
            console.error("❌ Error loading children/reports:", error);
            throw error;
        }
    }

    /**
     * Load referrals data
     */
    async loadReferralsData() {
        try {
            await loadReferralRewards(this.currentUser.uid);
        } catch (error) {
            console.error("⚠️ Error loading referrals:", error);
            // Non-critical, don't throw
        }
    }

    /**
     * Load academics data
     */
    async loadAcademicsData() {
        try {
            await loadAcademicsData();
        } catch (error) {
            console.error("⚠️ Error loading academics:", error);
            // Non-critical, don't throw
        }
    }

    /**
     * Setup realtime monitoring
     */
    async setupRealtimeMonitoring() {
        try {
            setupRealTimeMonitoring(this.currentUser.normalizedPhone, this.currentUser.uid);
        } catch (error) {
            console.error("⚠️ Error setting up monitoring:", error);
            // Non-critical, don't throw
        }
    }

    /**
     * Setup UI components
     */
    setupUIComponents() {
        addManualRefreshButton();
        addLogoutButton();
    }

    /**
     * Cleanup auth listener
     */
    cleanup() {
        if (this.authListener && typeof this.authListener === 'function') {
            this.authListener();
            this.authListener = null;
        }
        this.isInitialized = false;
    }

    /**
     * Force reload dashboard
     */
    async reloadDashboard() {
        if (!this.currentUser) {
            console.warn("⚠️ No user to reload dashboard for");
            return;
        }

        console.log("🔄 Force reloading dashboard");
        await this.loadAllChildrenAndReports();
    }
}

// Create singleton instance
const authManager = new UnifiedAuthManager();

// ============================================================================
// 2. COMPREHENSIVE CHILDREN FINDER (Finds ALL Children)
// ============================================================================

/**
 * Comprehensive search for all children linked to a parent
 * This searches EVERY possible phone variation across multiple collections
 */
async function comprehensiveFindChildren(parentPhone) {
    console.log("🔍 COMPREHENSIVE SEARCH for children with phone:", parentPhone);

    const allChildren = new Map(); // studentId -> studentData
    const studentNameIdMap = new Map(); // studentName -> studentId

    try {
        // 1. Generate ALL phone variations
        const phoneVariations = generateAllPhoneVariations(parentPhone);

        // 2. Search in students collection
        for (const phoneVar of phoneVariations) {
            try {
                const snapshot = await db.collection('students')
                    .where('parentPhone', '==', phoneVar)
                    .get();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const studentId = doc.id;
                    const studentName = safeText(data.studentName || data.name || 'Unknown');

                    if (studentName !== 'Unknown' && !allChildren.has(studentId)) {
                        allChildren.set(studentId, {
                            id: studentId,
                            name: studentName,
                            data: data,
                            isPending: false,
                            collection: 'students'
                        });
                        
                        // Handle duplicate names
                        if (studentNameIdMap.has(studentName)) {
                            const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
                            studentNameIdMap.set(uniqueName, studentId);
                        } else {
                            studentNameIdMap.set(studentName, studentId);
                        }
                    }
                });
            } catch (error) {
                // Silently continue
            }
        }

        // 3. Search in pending_students collection
        for (const phoneVar of phoneVariations) {
            try {
                const snapshot = await db.collection('pending_students')
                    .where('parentPhone', '==', phoneVar)
                    .get();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const studentId = doc.id;
                    const studentName = safeText(data.studentName || data.name || 'Unknown');

                    if (studentName !== 'Unknown' && !allChildren.has(studentId)) {
                        allChildren.set(studentId, {
                            id: studentId,
                            name: studentName,
                            data: data,
                            isPending: true,
                            collection: 'pending_students'
                        });
                        
                        // Handle duplicate names
                        if (studentNameIdMap.has(studentName)) {
                            const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
                            studentNameIdMap.set(uniqueName, studentId);
                        } else {
                            studentNameIdMap.set(studentName, studentId);
                        }
                    }
                });
            } catch (error) {
                // Silently continue
            }
        }

        // 4. Emergency backup search - check by email if available
        const userDoc = await db.collection('parent_users')
            .where('normalizedPhone', '==', parentPhone)
            .limit(1)
            .get();

        if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            if (userData.email) {
                try {
                    const emailSnapshot = await db.collection('students')
                        .where('parentEmail', '==', userData.email)
                        .get();

                    emailSnapshot.forEach(doc => {
                        const data = doc.data();
                        const studentId = doc.id;
                        const studentName = safeText(data.studentName || data.name || 'Unknown');

                        if (studentName !== 'Unknown' && !allChildren.has(studentId)) {
                            allChildren.set(studentId, {
                                id: studentId,
                                name: studentName,
                                data: data,
                                isPending: false,
                                collection: 'students'
                            });
                            
                            if (!studentNameIdMap.has(studentName)) {
                                studentNameIdMap.set(studentName, studentId);
                            }
                        }
                    });
                } catch (error) {
                    // Silently continue
                }
            }
        }

        // 5. Return results
        const studentNames = Array.from(studentNameIdMap.keys());
        const studentIds = Array.from(allChildren.keys());
        const allStudentData = Array.from(allChildren.values());

        return {
            studentIds,
            studentNameIdMap,
            allStudentData,
            studentNames
        };

    } catch (error) {
        console.error("❌ Comprehensive search error:", error);
        return {
            studentIds: [],
            studentNameIdMap: new Map(),
            allStudentData: [],
            studentNames: []
        };
    }
}

// ============================================================================
// 3. NEW INITIALIZATION FUNCTION
// ============================================================================

/**
 * NEW initialization function
 */
function initializeParentPortalV2() {
    console.log("🚀 Initializing Parent Portal V2 (No Reload Edition)");

    // 1. Setup UI first
    setupRememberMe();
    injectCustomCSS();
    createCountryCodeDropdown();
    setupEventListeners();
    setupGlobalErrorHandler();

    // 2. Initialize auth manager (SINGLE SOURCE OF TRUTH)
    authManager.initialize();

    // 3. Setup cleanup
    window.addEventListener('beforeunload', () => {
        authManager.cleanup();
        cleanupRealTimeListeners();
    });

    console.log("✅ Parent Portal V2 initialized");
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Setup Remember Me Functionality
function setupRememberMe() {
    const rememberMe = localStorage.getItem('rememberMe');
    const savedEmail = localStorage.getItem('savedEmail');
    
    if (rememberMe === 'true' && savedEmail) {
        const loginIdentifier = document.getElementById('loginIdentifier');
        const rememberMeCheckbox = document.getElementById('rememberMe');
        
        if (loginIdentifier) {
            loginIdentifier.value = safeText(savedEmail);
        }
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = true;
        }
    }
}

// Handle Remember Me checkbox change
function handleRememberMe() {
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const identifier = document.getElementById('loginIdentifier');
    
    if (!rememberMeCheckbox || !identifier) return;
    
    const rememberMe = rememberMeCheckbox.checked;
    const email = identifier.value.trim();
    
    if (rememberMe && email) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', safeText(email));
    } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
    }
}

// Basic handleSignIn function for event listeners
function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

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

    handleSignInFull(identifier, password, signInBtn, authLoader);
}

// Basic handleSignUp function for event listeners
function handleSignUp() {
    const countryCode = document.getElementById('countryCode')?.value;
    const localPhone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;

    // Validation
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

    const signUpBtn = document.getElementById('signUpBtn');
    const authLoader = document.getElementById('authLoader');

    signUpBtn.disabled = true;
    document.getElementById('signUpText').textContent = 'Creating Account...';
    document.getElementById('signUpSpinner').classList.remove('hidden');
    authLoader.classList.remove('hidden');

    handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader);
}

// Basic password reset function
function handlePasswordReset() {
    const email = document.getElementById('resetEmail')?.value.trim();
    
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }

    const sendResetBtn = document.getElementById('sendResetBtn');
    const resetLoader = document.getElementById('resetLoader');

    sendResetBtn.disabled = true;
    resetLoader.classList.remove('hidden');

    handlePasswordResetFull(email, sendResetBtn, resetLoader);
}

// Basic tab switching functions
function switchTab(tab) {
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if (tab === 'signin') {
        signInTab?.classList.remove('tab-inactive');
        signInTab?.classList.add('tab-active');
        signUpTab?.classList.remove('tab-active');
        signUpTab?.classList.add('tab-inactive');
        signInForm?.classList.remove('hidden');
        signUpForm?.classList.add('hidden');
    } else {
        signUpTab?.classList.remove('tab-inactive');
        signUpTab?.classList.add('tab-active');
        signInTab?.classList.remove('tab-active');
        signInTab?.classList.add('tab-inactive');
        signUpForm?.classList.remove('hidden');
        signInForm?.classList.add('hidden');
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Authentication buttons
    const signInBtn = document.getElementById("signInBtn");
    const signUpBtn = document.getElementById("signUpBtn");
    const sendResetBtn = document.getElementById("sendResetBtn");
    
    if (signInBtn) {
        signInBtn.removeEventListener("click", handleSignIn);
        signInBtn.addEventListener("click", handleSignIn);
    }
    
    if (signUpBtn) {
        signUpBtn.removeEventListener("click", handleSignUp);
        signUpBtn.addEventListener("click", handleSignUp);
    }
    
    if (sendResetBtn) {
        sendResetBtn.removeEventListener("click", handlePasswordReset);
        sendResetBtn.addEventListener("click", handlePasswordReset);
    }
    
    // Tab switching
    const signInTab = document.getElementById("signInTab");
    const signUpTab = document.getElementById("signUpTab");
    
    if (signInTab) {
        signInTab.removeEventListener("click", () => switchTab('signin'));
        signInTab.addEventListener("click", () => switchTab('signin'));
    }
    
    if (signUpTab) {
        signUpTab.removeEventListener("click", () => switchTab('signup'));
        signUpTab.addEventListener("click", () => switchTab('signup'));
    }
    
    // Password reset
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    if (forgotPasswordBtn) {
        forgotPasswordBtn.removeEventListener("click", showPasswordResetModal);
        forgotPasswordBtn.addEventListener("click", showPasswordResetModal);
    }
    
    const cancelResetBtn = document.getElementById("cancelResetBtn");
    if (cancelResetBtn) {
        cancelResetBtn.removeEventListener("click", hidePasswordResetModal);
        cancelResetBtn.addEventListener("click", hidePasswordResetModal);
    }
    
    // Remember me
    const rememberMeCheckbox = document.getElementById("rememberMe");
    if (rememberMeCheckbox) {
        rememberMeCheckbox.removeEventListener("change", handleRememberMe);
        rememberMeCheckbox.addEventListener("change", handleRememberMe);
    }
    
    // Enter key support
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.removeEventListener('keypress', handleLoginEnter);
        loginPassword.addEventListener('keypress', handleLoginEnter);
    }
    
    const signupConfirmPassword = document.getElementById('signupConfirmPassword');
    if (signupConfirmPassword) {
        signupConfirmPassword.removeEventListener('keypress', handleSignupEnter);
        signupConfirmPassword.addEventListener('keypress', handleSignupEnter);
    }
    
    const resetEmail = document.getElementById('resetEmail');
    if (resetEmail) {
        resetEmail.removeEventListener('keypress', handleResetEnter);
        resetEmail.addEventListener('keypress', handleResetEnter);
    }
    
    // Main tab switching
    const reportTab = document.getElementById("reportTab");
    const academicsTab = document.getElementById("academicsTab");
    const rewardsTab = document.getElementById("rewardsTab");
    
    if (reportTab) {
        reportTab.removeEventListener("click", () => switchMainTab('reports'));
        reportTab.addEventListener("click", () => switchMainTab('reports'));
    }
    
    if (academicsTab) {
        academicsTab.removeEventListener("click", () => switchMainTab('academics'));
        academicsTab.addEventListener("click", () => switchMainTab('academics'));
    }
    
    if (rewardsTab) {
        rewardsTab.removeEventListener("click", () => switchMainTab('rewards'));
        rewardsTab.addEventListener("click", () => switchMainTab('rewards'));
    }
}

// Helper functions for enter key handling
function handleLoginEnter(e) {
    if (e.key === 'Enter') handleSignIn();
}

function handleSignupEnter(e) {
    if (e.key === 'Enter') handleSignUp();
}

function handleResetEnter(e) {
    if (e.key === 'Enter') handlePasswordReset();
}

// Modal functions
function showPasswordResetModal() {
    const modal = document.getElementById("passwordResetModal");
    if (modal) {
        modal.classList.remove("hidden");
    }
}

function hidePasswordResetModal() {
    const modal = document.getElementById("passwordResetModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// Setup global error handler
function setupGlobalErrorHandler() {
    // Prevent unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault();
    });
    
    // Global error handler
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        if (!e.error?.message?.includes('auth') && 
            !e.error?.message?.includes('permission-denied')) {
            showMessage('An unexpected error occurred. Please refresh the page.', 'error');
        }
        e.preventDefault();
    });
    
    // Network error handling
    window.addEventListener('offline', function() {
        showMessage('You are offline. Some features may not work.', 'warning');
    });
    
    window.addEventListener('online', function() {
        showMessage('Connection restored.', 'success');
    });
}

// ============================================================================
// PAGE INITIALIZATION
// ============================================================================

// Initialize the page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM Content Loaded - Starting V2 initialization");
    
    // Initialize the NEW portal
    initializeParentPortalV2();
    
    console.log("🎉 Parent Portal V2 initialized");
});

// Make auth manager globally accessible for debugging
window.authManager = authManager;
window.comprehensiveFindChildren = comprehensiveFindChildren;
window.manualRefreshReportsV2 = manualRefreshReportsV2;
