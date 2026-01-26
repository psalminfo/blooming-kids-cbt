// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

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
// SECTION 1: CORE UTILITIES & SECURITY (OPTIMIZED)
// ============================================================================

// XSS Protection
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#039;', '`': '&#x60;', '/': '&#x2F;', '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`/=]/g, m => map[m]);
}

// Sanitize input
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return escapeHtml(input.trim());
    }
    return input;
}

// Safe text (no HTML escaping for display)
function safeText(text) {
    if (typeof text !== 'string') return text;
    return text.trim();
}

// Capitalize names
function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    const cleaned = safeText(str);
    return cleaned.replace(/\b\w/g, l => l.toUpperCase());
}

// ========== UNIVERSAL PHONE MATCHING (FIXED - SUFFIX BASED) ==========
function comparePhonesByDigits(phone1, phone2) {
    if (!phone1 || !phone2) return false;
    
    try {
        // Convert to strings and extract only digits
        const digits1 = phone1.toString().replace(/\D/g, '');
        const digits2 = phone2.toString().replace(/\D/g, '');
        
        if (!digits1 || !digits2) return false;
        
        // SUFFIX MATCHING: Compare only last 10 digits
        const suffix1 = digits1.slice(-10);
        const suffix2 = digits2.slice(-10);
        
        // Also check full match for completeness
        return suffix1 === suffix2 || digits1 === digits2;
    } catch (error) {
        console.warn("Phone comparison error:", error);
        return false;
    }
}

// Extract suffix (last 10 digits) for searching
function extractPhoneSuffix(phone) {
    if (!phone) return '';
    const digits = phone.toString().replace(/\D/g, '');
    return digits.slice(-10); // Last 10 digits only
}

// Extract all digits
function extractPhoneDigits(phone) {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
}

// ============================================================================
// SECTION 2: GLOBAL STATE MANAGEMENT
// ============================================================================

let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let allStudentData = [];
let realTimeListeners = [];
let charts = new Map();
let pendingRequests = new Set();

// Initialize intervals array globally
if (!window.realTimeIntervals) {
    window.realTimeIntervals = [];
}

// ============================================================================
// SECTION 3: UI MESSAGE SYSTEM
// ============================================================================

function showMessage(message, type = 'info') {
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

// Show skeleton loader
function showSkeletonLoader(elementId, type = 'default') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let skeletonHtml = '';
    
    switch(type) {
        case 'dashboard':
            skeletonHtml = `
                <div class="space-y-6">
                    <div class="skeleton skeleton-title"></div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="skeleton skeleton-card"></div>
                        <div class="skeleton skeleton-card"></div>
                        <div class="skeleton skeleton-card"></div>
                    </div>
                    <div class="skeleton skeleton-card h-64"></div>
                </div>
            `;
            break;
        case 'reports':
            skeletonHtml = `
                <div class="space-y-4">
                    <div class="skeleton skeleton-title w-1/2"></div>
                    ${Array.from({length: 3}, (_, i) => `
                        <div class="border rounded-lg p-4">
                            <div class="skeleton skeleton-text w-3/4"></div>
                            <div class="skeleton skeleton-text w-1/2 mt-2"></div>
                            <div class="skeleton skeleton-text w-full mt-4 h-20"></div>
                        </div>
                    `).join('')}
                </div>
            `;
            break;
        default:
            skeletonHtml = `
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading...</p>
                </div>
            `;
    }
    
    element.innerHTML = skeletonHtml;
}

// ============================================================================
// SECTION 4: DATE & TIME UTILITIES
// ============================================================================

function formatDetailedDate(date, showTimezone = false) {
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
    
    if (showTimezone) {
        options.timeZoneName = 'short';
    }
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    let formatted = dateObj.toLocaleDateString('en-US', options);
    
    if (showTimezone) {
        formatted += ` (${timezone})`;
    }
    
    return formatted;
}

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

function getTimestamp(dateInput) {
    if (!dateInput) return 0;
    
    if (dateInput?.toDate) {
        return dateInput.toDate().getTime();
    } else if (dateInput instanceof Date) {
        return dateInput.getTime();
    } else if (typeof dateInput === 'string') {
        return new Date(dateInput).getTime();
    } else if (typeof dateInput === 'number') {
        if (dateInput < 10000000000) {
            return dateInput * 1000;
        }
        return dateInput;
    }
    
    return 0;
}

function getTimestampFromData(data) {
    if (!data) return 0;
    
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
                return Math.floor(timestamp / 1000);
            }
        }
    }
    
    return Math.floor(Date.now() / 1000);
}

// ============================================================================
// SECTION 5: MONTH DISPLAY LOGIC
// ============================================================================

function getMonthDisplayLogic() {
    const today = new Date();
    const currentDay = today.getDate();
    
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

// ============================================================================
// SECTION 6: APP CONFIGURATION & INITIALIZATION
// ============================================================================

// Inject optimized CSS with skeleton loaders
function injectCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Skeleton Loaders */
        .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            border-radius: 4px;
        }
        
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        .skeleton-text {
            height: 1em;
            margin-bottom: 0.5em;
        }
        
        .skeleton-title {
            height: 1.8em;
            margin-bottom: 1em;
            width: 70%;
        }
        
        .skeleton-card {
            height: 150px;
            border-radius: 8px;
            margin-bottom: 1rem;
        }
        
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
        
        /* Chart containers */
        .chart-container {
            position: relative;
            height: 300px;
            width: 100%;
        }
        
        /* Progress report specific accordion styles */
        .progress-accordion-content {
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }
        
        .progress-accordion-content.hidden {
            max-height: 0 !important;
            opacity: 0;
            transform: translateY(-10px);
        }
        
        .progress-accordion-content:not(.hidden) {
            max-height: 5000px;
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Performance indicator colors */
        .performance-excellent {
            color: #10B981;
            background-color: #D1FAE5;
        }
        
        .performance-good {
            color: #F59E0B;
            background-color: #FEF3C7;
        }
        
        .performance-needs-improvement {
            color: #EF4444;
            background-color: #FEE2E2;
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
            .mobile-stack {
                flex-direction: column !important;
            }
            
            .mobile-full-width {
                width: 100% !important;
            }
            
            .mobile-padding {
                padding: 1rem !important;
            }
        }
    `;
    document.head.appendChild(style);
}

// Phone normalization (optimized)
function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, valid: false, error: 'Invalid input' };
    }

    try {
        // Clean the phone number - remove all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // If empty after cleaning, return error
        if (!cleaned) {
            return { normalized: null, valid: false, error: 'Empty phone number' };
        }
        
        // Check if it already has a country code
        if (cleaned.startsWith('+')) {
            // Already has country code
            cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
            
            return {
                normalized: cleaned,
                valid: true,
                error: null
            };
        } else {
            // No country code, add +1 as default
            cleaned = cleaned.replace(/^0+/, '');
            
            // Add default country code
            cleaned = '+1' + cleaned;
            
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

// Create country code dropdown
function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone')?.parentNode;
    if (!phoneInputContainer) return;
    
    // Create container for country code and phone number
    const container = document.createElement('div');
    container.className = 'flex gap-2 mobile-stack';
    
    // Create country code dropdown
    const countryCodeSelect = document.createElement('select');
    countryCodeSelect.id = 'countryCode';
    countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200 mobile-full-width';
    countryCodeSelect.required = true;
    
    // FULL COUNTRY CODES LIST
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
        phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200 mobile-full-width';
        
        // Replace the original input with new structure
        container.appendChild(countryCodeSelect);
        container.appendChild(phoneInput);
        phoneInputContainer.appendChild(container);
    }
}

// ============================================================================
// SECTION 7: AUTHENTICATION FUNCTIONS
// ============================================================================

async function handleSignInFull(identifier, password, signInBtn, authLoader) {
    const requestId = `signin_${Date.now()}`;
    pendingRequests.add(requestId);
    
    try {
        await auth.signInWithEmailAndPassword(identifier, password);
        console.log("✅ Sign in successful");
        // Auth listener will handle the rest
    } catch (error) {
        if (!pendingRequests.has(requestId)) return;
        
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
        
        if (signInBtn) signInBtn.disabled = false;
        
        const signInText = document.getElementById('signInText');
        const signInSpinner = document.getElementById('signInSpinner');
        
        if (signInText) signInText.textContent = 'Sign In';
        if (signInSpinner) signInSpinner.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    } finally {
        pendingRequests.delete(requestId);
    }
}

async function handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader) {
    const requestId = `signup_${Date.now()}`;
    pendingRequests.add(requestId);
    
    try {
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

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const referralCode = await generateReferralCode();

        await db.collection('parent_users').doc(user.uid).set({
            email: email,
            phone: finalPhone,
            normalizedPhone: finalPhone,
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
            uid: user.uid
        });

        console.log("✅ Account created and profile saved");
        showMessage('Account created successfully!', 'success');
        
    } catch (error) {
        if (!pendingRequests.has(requestId)) return;
        
        let errorMessage = "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email is already registered. Please sign in instead.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Password should be at least 6 characters.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        showMessage(errorMessage, 'error');

        if (signUpBtn) signUpBtn.disabled = false;
        
        const signUpText = document.getElementById('signUpText');
        const signUpSpinner = document.getElementById('signUpSpinner');
        
        if (signUpText) signUpText.textContent = 'Create Account';
        if (signUpSpinner) signUpSpinner.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    } finally {
        pendingRequests.delete(requestId);
    }
}

async function handlePasswordResetFull(email, sendResetBtn, resetLoader) {
    const requestId = `reset_${Date.now()}`;
    pendingRequests.add(requestId);
    
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email!', 'success');
        hidePasswordResetModal();
    } catch (error) {
        if (!pendingRequests.has(requestId)) return;
        
        let errorMessage = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email address.";
        }
        showMessage(errorMessage, 'error');
    } finally {
        pendingRequests.delete(requestId);
        if (sendResetBtn) sendResetBtn.disabled = false;
        if (resetLoader) resetLoader.classList.add('hidden');
    }
}

// ============================================================================
// SECTION 8: REFERRAL SYSTEM
// ============================================================================

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
        if (snapshot.empty) {
            isUnique = true;
        }
    }
    return safeText(code);
}

async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    if (!rewardsContent) return;
    
    showSkeletonLoader('rewardsContent', 'reports');

    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) {
            rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found.</p>';
            return;
        }
        
        const userData = userDoc.data();
        const referralCode = safeText(userData.referralCode || 'N/A');
        const totalEarnings = userData.referralEarnings || 0;
        
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
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">Error loading rewards.</p>';
    }
}

// ============================================================================
// SECTION 9: COMPREHENSIVE CHILDREN FINDER (WITH SUFFIX MATCHING)
// ============================================================================

async function comprehensiveFindChildren(parentPhone) {
    console.log("🔍 COMPREHENSIVE SUFFIX SEARCH for children with phone:", parentPhone);

    const allChildren = new Map();
    const studentNameIdMap = new Map();
    
    const parentSuffix = extractPhoneSuffix(parentPhone);
    
    if (!parentSuffix) {
        console.warn("⚠️ No valid suffix in parent phone:", parentPhone);
        return {
            studentIds: [],
            studentNameIdMap: new Map(),
            allStudentData: [],
            studentNames: []
        };
    }

    try {
        // Search in students and pending_students collections in parallel
        const [studentsSnapshot, pendingSnapshot] = await Promise.all([
            db.collection('students').get().catch(() => ({ forEach: () => {} })),
            db.collection('pending_students').get().catch(() => ({ forEach: () => {} }))
        ]);
        
        // Process students
        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            const studentId = doc.id;
            const studentName = safeText(data.studentName || data.name || 'Unknown');
            
            if (studentName === 'Unknown') return;
            
            const phoneFields = [
                data.parentPhone,
                data.guardianPhone,
                data.motherPhone,
                data.fatherPhone,
                data.contactPhone,
                data.phone,
                data.parentPhone1,
                data.parentPhone2,
                data.emergencyPhone
            ];
            
            let isMatch = false;
            let matchedField = '';
            
            for (const fieldPhone of phoneFields) {
                if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                    isMatch = true;
                    matchedField = fieldPhone;
                    break;
                }
            }
            
            if (isMatch && !allChildren.has(studentId)) {
                console.log(`✅ SUFFIX MATCH: Parent ${parentSuffix} = ${matchedField} → Student ${studentName}`);
                
                allChildren.set(studentId, {
                    id: studentId,
                    name: studentName,
                    data: data,
                    isPending: false,
                    collection: 'students'
                });
                
                if (studentNameIdMap.has(studentName)) {
                    const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
                    studentNameIdMap.set(uniqueName, studentId);
                } else {
                    studentNameIdMap.set(studentName, studentId);
                }
            }
        });
        
        // Process pending students
        pendingSnapshot.forEach(doc => {
            const data = doc.data();
            const studentId = doc.id;
            const studentName = safeText(data.studentName || data.name || 'Unknown');
            
            if (studentName === 'Unknown') return;
            
            const phoneFields = [
                data.parentPhone,
                data.guardianPhone,
                data.motherPhone,
                data.fatherPhone,
                data.contactPhone,
                data.phone
            ];
            
            let isMatch = false;
            let matchedField = '';
            
            for (const fieldPhone of phoneFields) {
                if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                    isMatch = true;
                    matchedField = fieldPhone;
                    break;
                }
            }
            
            if (isMatch && !allChildren.has(studentId)) {
                console.log(`✅ PENDING SUFFIX MATCH: Parent ${parentSuffix} = ${matchedField} → Student ${studentName}`);
                
                allChildren.set(studentId, {
                    id: studentId,
                    name: studentName,
                    data: data,
                    isPending: true,
                    collection: 'pending_students'
                });
                
                if (studentNameIdMap.has(studentName)) {
                    const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
                    studentNameIdMap.set(uniqueName, studentId);
                } else {
                    studentNameIdMap.set(studentName, studentId);
                }
            }
        });

        // Email matching (backup)
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
                            console.log(`✅ EMAIL MATCH: ${userData.email} → Student ${studentName}`);
                            
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
                    console.warn("Email search error:", error.message);
                }
            }
        }

        const studentNames = Array.from(studentNameIdMap.keys());
        const studentIds = Array.from(allChildren.keys());
        const allStudentData = Array.from(allChildren.values());

        console.log(`🎯 SUFFIX SEARCH RESULTS: ${studentNames.length} students found`);

        return {
            studentIds,
            studentNameIdMap,
            allStudentData,
            studentNames
        };

    } catch (error) {
        console.error("❌ Comprehensive suffix search error:", error);
        return {
            studentIds: [],
            studentNameIdMap: new Map(),
            allStudentData: [],
            studentNames: []
        };
    }
}

// ============================================================================
// SECTION 10: UNIVERSAL REPORT SEARCH WITH SUFFIX MATCHING
// ============================================================================

async function searchAllReportsForParent(parentPhone, parentEmail = '', parentUid = '') {
    console.log("🔍 SUFFIX-MATCHING Search for:", { parentPhone });
    
    let assessmentResults = [];
    let monthlyResults = [];
    
    try {
        // Get parent's phone suffix for comparison
        const parentSuffix = extractPhoneSuffix(parentPhone);
        
        if (!parentSuffix) {
            console.warn("⚠️ No valid suffix in parent phone");
            return { assessmentResults: [], monthlyResults: [] };
        }

        console.log(`🎯 Searching with suffix: ${parentSuffix}`);

        // --- PARALLEL SEARCHES ---
        const searchPromises = [];
        
        // 1. Search assessment reports
        searchPromises.push(
            db.collection("student_results").limit(500).get().then(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    
                    // Check ALL phone fields with suffix matching
                    const phoneFields = [
                        data.parentPhone,
                        data.parent_phone,
                        data.guardianPhone,
                        data.motherPhone,
                        data.fatherPhone,
                        data.phone,
                        data.contactPhone,
                        data.normalizedParentPhone
                    ];
                    
                    for (const fieldPhone of phoneFields) {
                        if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                            assessmentResults.push({ 
                                id: doc.id,
                                collection: 'student_results',
                                matchType: 'suffix-match',
                                matchedField: fieldPhone,
                                ...data,
                                timestamp: getTimestampFromData(data),
                                type: 'assessment'
                            });
                            break;
                        }
                    }
                });
                console.log(`✅ Found ${assessmentResults.length} assessment reports (suffix match)`);
            }).catch(error => {
                console.log("ℹ️ Assessment search error:", error.message);
            })
        );
        
        // 2. Search monthly reports
        searchPromises.push(
            db.collection("tutor_submissions").limit(500).get().then(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    
                    const phoneFields = [
                        data.parentPhone,
                        data.parent_phone,
                        data.guardianPhone,
                        data.motherPhone,
                        data.fatherPhone,
                        data.phone,
                        data.contactPhone,
                        data.normalizedParentPhone
                    ];
                    
                    for (const fieldPhone of phoneFields) {
                        if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                            monthlyResults.push({ 
                                id: doc.id,
                                collection: 'tutor_submissions',
                                matchType: 'suffix-match',
                                matchedField: fieldPhone,
                                ...data,
                                timestamp: getTimestampFromData(data),
                                type: 'monthly'
                            });
                            break;
                        }
                    }
                });
                console.log(`✅ Found ${monthlyResults.length} monthly reports (suffix match)`);
            }).catch(error => {
                console.log("ℹ️ Monthly search error:", error.message);
            })
        );
        
        // 3. Email search (backup)
        if (parentEmail) {
            searchPromises.push(
                db.collection("student_results")
                    .where("parentEmail", "==", parentEmail)
                    .limit(100)
                    .get()
                    .then(snapshot => {
                        if (!snapshot.empty) {
                            snapshot.forEach(doc => {
                                const data = doc.data();
                                const existing = assessmentResults.find(r => r.id === doc.id);
                                if (!existing) {
                                    assessmentResults.push({ 
                                        id: doc.id,
                                        collection: 'student_results',
                                        matchType: 'email',
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: 'assessment'
                                    });
                                }
                            });
                            console.log(`✅ Found ${snapshot.size} reports by email`);
                        }
                    }).catch(() => {})
            );
        }
        
        // Wait for all searches to complete
        await Promise.all(searchPromises);
        
        // Remove duplicates
        assessmentResults = [...new Map(assessmentResults.map(item => [item.id, item])).values()];
        monthlyResults = [...new Map(monthlyResults.map(item => [item.id, item])).values()];
        
        console.log("🎯 SEARCH SUMMARY:", {
            assessments: assessmentResults.length,
            monthly: monthlyResults.length,
            parentSuffix: parentSuffix
        });
        
    } catch (error) {
        console.error("❌ Suffix-matching search error:", error);
    }
    
    return { assessmentResults, monthlyResults };
}

// ============================================================================
// SECTION 11: PROACTIVE ACADEMICS TAB
// ============================================================================

async function loadAcademicsData(selectedStudent = null) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;
    
    showSkeletonLoader('academicsContent', 'reports');

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to view academic data');
        }

        // Get user data
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        const parentPhone = userData.normalizedPhone || userData.phone;

        // Load children data
        const childrenResult = await comprehensiveFindChildren(parentPhone);
        
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

        let studentsToShow = [];
        if (selectedStudent && studentIdMap.has(selectedStudent)) {
            studentsToShow = [selectedStudent];
        } else {
            studentsToShow = userChildren;
        }

        let academicsHtml = '';

        // Student selector
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

        // Load data for each student in parallel
        const studentPromises = studentsToShow.map(async (studentName) => {
            const studentId = studentIdMap.get(studentName);
            const studentInfo = allStudentData.find(s => s.name === studentName);
            
            let sessionTopicsHtml = '';
            let homeworkHtml = '';
            
            // Load session topics and homework in parallel
            if (studentId) {
                const [sessionTopicsSnapshot, homeworkSnapshot] = await Promise.all([
                    db.collection('daily_topics').where('studentId', '==', studentId).get().catch(() => ({ empty: true })),
                    db.collection('homework_assignments').where('studentId', '==', studentId).get().catch(() => ({ empty: true }))
                ]);
                
                // Process session topics
                if (sessionTopicsSnapshot.empty) {
                    sessionTopicsHtml = `
                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                            <p class="text-gray-500">No session topics recorded yet. Check back after your child's sessions!</p>
                        </div>
                    `;
                } else {
                    const topics = [];
                    sessionTopicsSnapshot.forEach(doc => {
                        const topicData = doc.data();
                        topics.push({ 
                            id: doc.id, 
                            ...topicData,
                            timestamp: getTimestamp(topicData.date || topicData.createdAt || topicData.timestamp)
                        });
                    });
                    
                    topics.sort((a, b) => a.timestamp - b.timestamp);
                    
                    const monthLogic = getMonthDisplayLogic();
                    const currentMonth = getCurrentMonthYear();
                    const previousMonth = getPreviousMonthYear();
                    
                    const filteredTopics = topics.filter(topic => {
                        const topicDate = new Date(topic.timestamp);
                        const { year, month } = getYearMonthFromDate(topicDate);
                        
                        if (year === currentMonth.year && month === currentMonth.month) {
                            return true;
                        }
                        
                        if (monthLogic.showPreviousMonth && 
                            year === previousMonth.year && 
                            month === previousMonth.month) {
                            return true;
                        }
                        
                        return false;
                    });
                    
                    if (filteredTopics.length === 0) {
                        sessionTopicsHtml = `
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                                <p class="text-gray-500">No session topics for the selected time period.</p>
                            </div>
                        `;
                    } else {
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
                        
                        for (const [monthKey, monthTopics] of Object.entries(topicsByMonth)) {
                            const [year, month] = monthKey.split('-').map(num => parseInt(num));
                            const monthNames = [
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                            ];
                            const monthName = monthNames[month];
                            
                            sessionTopicsHtml += `
                                <div class="mb-6">
                                    <h4 class="font-semibold text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">${monthName} ${year}</h4>
                                    <div class="space-y-4">
                            `;
                            
                            monthTopics.forEach(topicData => {
                                const formattedDate = formatDetailedDate(new Date(topicData.timestamp), true);
                                const safeTopics = safeText(topicData.topics || topicData.sessionTopics || 'No topics recorded for this session.');
                                const tutorName = safeText(topicData.tutorName || topicData.updatedBy || 'Tutor');
                                
                                sessionTopicsHtml += `
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
                            
                            sessionTopicsHtml += `
                                    </div>
                                </div>
                            `;
                        }
                    }
                }
                
                // Process homework
                if (homeworkSnapshot.empty) {
                    homeworkHtml = `
                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                            <p class="text-gray-500">No homework assignments yet.</p>
                        </div>
                    `;
                } else {
                    const homeworkList = [];
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
                    homeworkList.sort((a, b) => a.dueTimestamp - b.dueTimestamp);
                    
                    const monthLogic = getMonthDisplayLogic();
                    const currentMonth = getCurrentMonthYear();
                    const previousMonth = getPreviousMonthYear();
                    
                    const filteredHomework = homeworkList.filter(homework => {
                        const dueDate = new Date(homework.dueTimestamp);
                        const { year, month } = getYearMonthFromDate(dueDate);
                        
                        if (year === currentMonth.year && month === currentMonth.month) {
                            return true;
                        }
                        
                        if (monthLogic.showPreviousMonth && 
                            year === previousMonth.year && 
                            month === previousMonth.month) {
                            return true;
                        }
                        
                        if (homework.dueTimestamp < now) {
                            return true;
                        }
                        
                        const nextMonth = new Date(currentMonth.year, currentMonth.month + 1, 1);
                        if (dueDate <= nextMonth) {
                            return true;
                        }
                        
                        return false;
                    });
                    
                    if (filteredHomework.length === 0) {
                        homeworkHtml = `
                            <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                                <p class="text-gray-500">No homework for the selected time period.</p>
                            </div>
                        `;
                    } else {
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
                        
                        const sortedMonthKeys = Object.keys(homeworkByMonth).sort((a, b) => {
                            const [aYear, aMonth] = a.split('-').map(Number);
                            const [bYear, bMonth] = b.split('-').map(Number);
                            return aYear - bYear || aMonth - bMonth;
                        });
                        
                        for (const monthKey of sortedMonthKeys) {
                            const [year, month] = monthKey.split('-').map(num => parseInt(num));
                            const monthNames = [
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                            ];
                            const monthName = monthNames[month];
                            const monthHomework = homeworkByMonth[monthKey];
                            
                            homeworkHtml += `
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
                                
                                homeworkHtml += `
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
                            
                            homeworkHtml += `
                                    </div>
                                </div>
                            `;
                        }
                    }
                }
            } else {
                sessionTopicsHtml = `
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                        <p class="text-gray-500">Student ID not found. Session topics cannot be loaded.</p>
                    </div>
                `;
                homeworkHtml = `
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                        <p class="text-gray-500">Student ID not found. Homework cannot be loaded.</p>
                    </div>
                `;
            }
            
            return {
                studentName,
                studentInfo,
                sessionTopicsHtml,
                homeworkHtml
            };
        });
        
        const studentResults = await Promise.all(studentPromises);
        
        // Build final HTML
        studentResults.forEach(({ studentName, studentInfo, sessionTopicsHtml, homeworkHtml }) => {
            academicsHtml += `
                <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6 slide-down" id="academics-student-${safeText(studentName)}">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}${studentInfo?.isPending ? ' <span class="text-yellow-600 text-sm">(Pending Registration)</span>' : ''}</h2>
                            <p class="text-green-600">Academic progress and assignments</p>
                        </div>
                    </div>
                </div>
            `;

            // Student Information
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
                        ${sessionTopicsHtml}
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
                        ${homeworkHtml}
                    </div>
                </div>
            `;
        });

        academicsContent.innerHTML = academicsHtml;
        
        // Initialize Google Classroom buttons
        setTimeout(scanAndInjectButtons, 100);

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

function onStudentSelected(studentName) {
    loadAcademicsData(studentName || null);
}

// ============================================================================
// SECTION 12: OPTIMIZED REAL-TIME MONITORING
// ============================================================================

function cleanupRealTimeListeners() {
    console.log("🧹 Cleaning up real-time listeners...");
    
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    realTimeListeners = [];
    
    if (window.realTimeIntervals) {
        window.realTimeIntervals.forEach(id => clearInterval(id));
        window.realTimeIntervals = [];
    }
    
    // Clean up charts
    charts.forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts.clear();
}

function setupRealTimeMonitoring(parentPhone, userId) {
    console.log("📡 Setting up OPTIMIZED real-time monitoring...");
    
    cleanupRealTimeListeners();
    
    if (!window.realTimeIntervals) {
        window.realTimeIntervals = [];
    }
    
    const parentSuffix = extractPhoneSuffix(parentPhone);
    if (!parentSuffix) {
        console.warn("⚠️ Cannot setup monitoring - invalid parent phone:", parentPhone);
        return;
    }

    console.log("📡 Monitoring for phone suffix:", parentSuffix);
    
    // Function to check for new reports
    const checkForNewReports = async () => {
        try {
            const lastCheckKey = `lastReportCheck_${userId}`;
            const lastCheckTime = parseInt(localStorage.getItem(lastCheckKey) || '0');
            const now = Date.now();
            
            let foundNew = false;
            
            // Check all collections in parallel
            const collections = ['tutor_submissions', 'student_results'];
            
            await Promise.all(collections.map(async (collection) => {
                try {
                    const snapshot = await db.collection(collection).limit(200).get();
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const docPhone = data.parentPhone || data.parent_phone || data.phone;
                        
                        if (docPhone && extractPhoneSuffix(docPhone) === parentSuffix) {
                            const docTime = getTimestamp(data.timestamp || data.createdAt || data.submittedAt);
                            
                            if (docTime > lastCheckTime) {
                                foundNew = true;
                                console.log(`🆕 NEW ${collection} DETECTED:`, doc.id);
                            }
                        }
                    });
                } catch (error) {
                    console.error(`${collection} check error:`, error);
                }
            }));
            
            if (foundNew) {
                showNewReportNotification();
            }
            
            localStorage.setItem(lastCheckKey, now.toString());
            
        } catch (error) {
            console.error("Real-time check error:", error);
        }
    };
    
    // Check for new reports every 60 seconds
    const reportInterval = setInterval(checkForNewReports, 60000);
    window.realTimeIntervals.push(reportInterval);
    realTimeListeners.push(() => clearInterval(reportInterval));
    
    // Run initial check after 2 seconds
    setTimeout(checkForNewReports, 2000);
    
    console.log("✅ Real-time monitoring setup complete");
}

function showNewReportNotification() {
    showMessage('New reports available! Refresh to view.', 'success');
    
    const existingIndicator = document.getElementById('newReportIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'newReportIndicator';
    indicator.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse fade-in';
    indicator.innerHTML = '📄 New Reports Available!';
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        indicator.remove();
    }, 5000);
    
    const refreshBtn = document.getElementById('manualRefreshBtn');
    if (refreshBtn) {
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<span class="mr-2">🔄</span> <span class="animate-pulse">Check for New Reports</span>';
        
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
        }, 3000);
    }
}

// ============================================================================
// SECTION 13: YEARLY ARCHIVES REPORTS SYSTEM
// ============================================================================

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

function createYearlyArchiveReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    
    const sortedStudents = Array.from(reportsByStudent.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [studentName, reports] of sortedStudents) {
        const fullName = capitalize(studentName);
        const studentData = reports.studentData;
        
        const assessmentCount = Array.from(reports.assessments.values()).flat().length;
        const monthlyCount = Array.from(reports.monthly.values()).flat().length;
        const totalCount = assessmentCount + monthlyCount;
        
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
            const reportsByYear = new Map();
            
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
            
            const sortedYears = Array.from(reportsByYear.keys()).sort((a, b) => b - a);
            
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
                        <div id="year-${studentIndex}-${yearIndex}-content" class="progress-accordion-content hidden ml-6 mt-3">
                `;
                
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
                    
                    const assessmentsByMonth = new Map();
                    yearData.assessments.forEach(({ sessionKey, reports: sessionReports, date }) => {
                        const month = date.getMonth();
                        if (!assessmentsByMonth.has(month)) {
                            assessmentsByMonth.set(month, []);
                        }
                        assessmentsByMonth.get(month).push({ sessionKey, reports: sessionReports, date });
                    });
                    
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
                    
                    const monthlyByMonth = new Map();
                    yearData.monthly.forEach(({ sessionKey, reports: sessionReports, date }) => {
                        const month = date.getMonth();
                        if (!monthlyByMonth.has(month)) {
                            monthlyByMonth.set(month, []);
                        }
                        monthlyByMonth.get(month).push({ sessionKey, reports: sessionReports, date });
                    });
                    
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
    
    let tutorName = 'N/A';
    const tutorEmail = firstReport.tutorEmail;
    
    const results = sessionReports.map(testResult => {
        const topics = [...new Set(testResult.answers?.map(a => safeText(a.topic)).filter(t => t))] || [];
        return {
            subject: safeText(testResult.subject || testResult.testSubject || 'General'),
            correct: testResult.score !== undefined ? testResult.score : 0,
            total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0,
            topics: topics,
        };
    });

    const recommendation = generateTemplatedRecommendation(fullName, tutorName, results);

    const tableRows = results.map(res => `
        <tr>
            <td class="border px-2 py-1">${res.subject.toUpperCase()}</td>
            <td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td>
        </tr>
    `).join("");

    const topicsTableRows = results.map(res => `
        <tr>
            <td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td>
            <td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td>
        </tr>
    `).join("");

    const creativeWritingAnswer = firstReport.answers?.find(a => a.type === 'creative-writing');
    const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.';

    const chartId = `chart-${studentIndex}-${sessionId}`;
    const chartConfig = {
        type: 'bar',
        data: {
            labels: results.map(r => r.subject.toUpperCase()),
            datasets: [
                { 
                    label: 'Correct Answers', 
                    data: results.map(s => s.correct), 
                    backgroundColor: '#4CAF50' 
                }, 
                { 
                    label: 'Incorrect/Unanswered', 
                    data: results.map(s => s.total - s.correct), 
                    backgroundColor: '#FFCD56' 
                }
            ]
        },
        options: {
            responsive: true,
            scales: { 
                x: { stacked: true }, 
                y: { stacked: true, beginAtZero: true } 
            },
            plugins: { 
                title: { 
                    display: true, 
                    text: 'Score Distribution by Subject' 
                } 
            }
        }
    };

    return `
        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${sessionId}">
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
                    <p><strong>Parent's Phone:</strong> ${firstReport.parentPhone || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${firstReport.grade}</p>
                </div>
                <div>
                    <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
                    <p><strong>Location:</strong> ${firstReport.studentCountry || 'N/A'}</p>
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
            <canvas id="${chartId}" class="w-full h-48 mb-4"></canvas>
            ` : ''}
            
            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
            </div>
            
            <div class="mt-6 text-center">
                <button onclick="downloadSessionReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    Download Assessment PDF
                </button>
            </div>
        </div>
        <script>
            setTimeout(() => {
                const ctx = document.getElementById('${chartId}');
                if (ctx) {
                    const chart = new Chart(ctx, ${JSON.stringify(chartConfig)});
                    window.charts.set('${chartId}', chart);
                }
            }, 100);
        </script>
    `;
}

function createMonthlyReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
    const firstReport = sessionReports[0];
    const formattedDate = formatDetailedDate(date || new Date(firstReport.timestamp * 1000), true);
    
    return `
        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${studentIndex}-${sessionId}">
            <div class="text-center mb-6 border-b pb-4">
                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                     alt="Blooming Kids House Logo" 
                     class="h-16 w-auto mx-auto mb-3">
                <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                <p class="text-gray-600">Date: ${formattedDate}</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                <div>
                    <p><strong>Student's Name:</strong> ${firstReport.studentName || 'N/A'}</p>
                    <p><strong>Parent's Name:</strong> ${firstReport.parentName || 'N/A'}</p>
                    <p><strong>Parent's Phone:</strong> ${firstReport.parentPhone || 'N/A'}</p>
                </div>
                <div>
                    <p><strong>Grade:</strong> ${firstReport.grade || 'N/A'}</p>
                    <p><strong>Tutor's Name:</strong> ${firstReport.tutorName || 'N/A'}</p>
                </div>
            </div>

            ${firstReport.introduction ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">INTRODUCTION</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.introduction)}</p>
            </div>
            ` : ''}

            ${firstReport.topics ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.topics)}</p>
            </div>
            ` : ''}

            ${firstReport.progress ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.progress)}</p>
            </div>
            ` : ''}

            ${firstReport.strengthsWeaknesses ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.strengthsWeaknesses)}</p>
            </div>
            ` : ''}

            ${firstReport.recommendations ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.recommendations)}</p>
            </div>
            ` : ''}

            ${firstReport.generalComments ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.generalComments)}</p>
            </div>
            ` : ''}

            <div class="text-right mt-8 pt-4 border-t">
                <p class="text-gray-600">Best regards,</p>
                <p class="font-semibold text-green-800">${firstReport.tutorName || 'N/A'}</p>
            </div>

            <div class="mt-6 text-center">
                <button onclick="downloadMonthlyReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    Download Monthly Report PDF
                </button>
            </div>
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
// SECTION 14: PARALLEL REPORT LOADING
// ============================================================================

async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    if (auth.currentUser && authArea && reportArea) {
        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        authLoader.classList.add("hidden");
        localStorage.setItem('isAuthenticated', 'true');
    } else {
        localStorage.removeItem('isAuthenticated');
    }

    if (authLoader) authLoader.classList.remove("hidden");
    
    // Show skeleton loader immediately
    showSkeletonLoader('reportContent', 'dashboard');

    try {
        // PARALLEL DATA LOADING
        const [userDoc, searchResults] = await Promise.all([
            db.collection('parent_users').doc(userId).get(),
            searchAllReportsForParent(parentPhone, '', userId)
        ]);
        
        if (!userDoc.exists) {
            throw new Error("User profile not found");
        }
        
        const userData = userDoc.data();
        
        // Update UI immediately
        currentUserData = {
            parentName: userData.parentName || 'Parent',
            parentPhone: parentPhone,
            email: userData.email || ''
        };

        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;
        }

        const { assessmentResults, monthlyResults } = searchResults;

        console.log("📊 PARALLEL LOAD: Found", assessmentResults.length, "assessments and", monthlyResults.length, "monthly reports");

        if (assessmentResults.length === 0 && monthlyResults.length === 0) {
            reportContent.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-6xl mb-6">📊</div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">Waiting for Your Child's First Report</h2>
                    <p class="text-gray-600 max-w-2xl mx-auto mb-6">
                        No reports found for your account yet. This usually means:
                    </p>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto mb-6">
                        <ul class="text-left text-gray-700 space-y-3">
                            <li>• Your child's tutor hasn't submitted their first assessment or monthly report yet</li>
                            <li>• The phone number/email used doesn't match what the tutor has on file</li>
                            <li>• Reports are being processed and will appear soon</li>
                        </ul>
                    </div>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-6 max-w-2xl mx-auto">
                        <h3 class="font-semibold text-green-800 mb-2">What happens next?</h3>
                        <p class="text-green-700 mb-4">
                            <strong>We're automatically monitoring for new reports!</strong> When your child's tutor submits 
                            their first report, it will appear here automatically. You don't need to do anything.
                        </p>
                        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button onclick="manualRefreshReportsV2()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center">
                                <span class="mr-2">🔄</span> Check Now
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Setup monitoring in background
            setTimeout(() => {
                setupRealTimeMonitoring(parentPhone, userId);
            }, 1000);
            
            return;
        }

        // Process reports
        let reportsHtml = '';
        const studentReportsMap = new Map();

        [...assessmentResults, ...monthlyResults].forEach(report => {
            const studentName = report.studentName;
            if (!studentName) return;
            
            if (!studentReportsMap.has(studentName)) {
                studentReportsMap.set(studentName, {
                    assessments: [],
                    monthly: []
                });
            }
            
            if (report.type === 'assessment') {
                studentReportsMap.get(studentName).assessments.push(report);
            } else if (report.type === 'monthly') {
                studentReportsMap.get(studentName).monthly.push(report);
            }
        });

        userChildren = Array.from(studentReportsMap.keys());
        
        const formattedReportsByStudent = new Map();
        
        for (const [studentName, reports] of studentReportsMap) {
            const assessmentsBySession = new Map();
            reports.assessments.forEach(report => {
                const sessionKey = Math.floor(report.timestamp / 86400);
                if (!assessmentsBySession.has(sessionKey)) {
                    assessmentsBySession.set(sessionKey, []);
                }
                assessmentsBySession.get(sessionKey).push(report);
            });
            
            const monthlyBySession = new Map();
            reports.monthly.forEach(report => {
                const sessionKey = Math.floor(report.timestamp / 86400);
                if (!monthlyBySession.has(sessionKey)) {
                    monthlyBySession.set(sessionKey, []);
                }
                monthlyBySession.get(sessionKey).push(report);
            });
            
            formattedReportsByStudent.set(studentName, {
                assessments: assessmentsBySession,
                monthly: monthlyBySession,
                studentData: { name: studentName, isPending: false }
            });
        }

        reportsHtml = createYearlyArchiveReportView(formattedReportsByStudent);
        reportContent.innerHTML = reportsHtml;

        // Setup other features in background
        setTimeout(() => {
            if (authArea && reportArea) {
                authArea.classList.add("hidden");
                reportArea.classList.remove("hidden");
            }
            
            setupRealTimeMonitoring(parentPhone, userId);
            addManualRefreshButton();
            addLogoutButton();
        }, 100);

    } catch (error) {
        console.error("❌ PARALLEL LOAD Error:", error);
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
                            <div class="mt-4">
                                <button onclick="window.location.reload()" 
                                        class="bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors duration-200">
                                    🔄 Reload Page
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
// SECTION 15: UNIFIED AUTH MANAGER
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
        if (this.isInitialized) {
            return;
        }

        console.log("🔐 Initializing Optimized Auth Manager");

        this.cleanup();

        this.authListener = auth.onAuthStateChanged(
            (user) => this.handleAuthChange(user),
            (error) => this.handleAuthError(error)
        );

        this.isInitialized = true;
        console.log("✅ Auth manager initialized");
    }

    async handleAuthChange(user) {
        const now = Date.now();
        const timeSinceLastProcess = now - this.lastProcessTime;

        if (this.isProcessing) {
            return;
        }

        if (timeSinceLastProcess < this.DEBOUNCE_MS) {
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
            setTimeout(() => {
                this.isProcessing = false;
            }, 1000);
        }
    }

    handleAuthError(error) {
        console.error("❌ Auth listener error:", error);
        showMessage("Authentication error occurred", "error");
    }

    async loadUserDashboard(user) {
        console.log("📊 Loading OPTIMIZED dashboard for user");

        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        const authLoader = document.getElementById("authLoader");

        if (authLoader) authLoader.classList.remove("hidden");

        try {
            // PARALLEL DATA LOADING
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

            // Update UI immediately
            this.showDashboardUI();

            // Load remaining data in parallel
            await Promise.all([
                loadAllReportsForParent(this.currentUser.normalizedPhone, user.uid),
                loadReferralRewards(user.uid),
                loadAcademicsData()
            ]);

            // Setup monitoring and UI
            this.setupRealtimeMonitoring();
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

    showAuthScreen() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");

        if (authArea) authArea.classList.remove("hidden");
        if (reportArea) reportArea.classList.add("hidden");

        localStorage.removeItem('isAuthenticated');
        cleanupRealTimeListeners();
    }

    setupRealtimeMonitoring() {
        if (this.currentUser) {
            setupRealTimeMonitoring(this.currentUser.normalizedPhone, this.currentUser.uid);
        }
    }

    setupUIComponents() {
        addManualRefreshButton();
        addLogoutButton();
    }

    cleanup() {
        if (this.authListener && typeof this.authListener === 'function') {
            this.authListener();
            this.authListener = null;
        }
        this.isInitialized = false;
    }

    async reloadDashboard() {
        if (!this.currentUser) {
            console.warn("⚠️ No user to reload dashboard for");
            return;
        }

        console.log("🔄 Force reloading dashboard");
        await loadAllReportsForParent(this.currentUser.normalizedPhone, this.currentUser.uid, true);
    }
}

const authManager = new UnifiedAuthManager();

// ============================================================================
// SECTION 16: NAVIGATION BUTTONS & DYNAMIC UI
// ============================================================================

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
        if (window.authManager && typeof window.authManager.reloadDashboard === 'function') {
            await window.authManager.reloadDashboard();
        } else {
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const userPhone = userData.normalizedPhone || userData.phone;
                await loadAllReportsForParent(userPhone, user.uid, true);
            }
        }
        
        await checkForNewAcademics();
        
        showMessage('Reports refreshed successfully!', 'success');
    } catch (error) {
        console.error('Manual refresh error:', error);
        showMessage('Refresh failed. Please try again.', 'error');
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// ADD MANUAL REFRESH BUTTON
function addManualRefreshButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    if (document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = manualRefreshReportsV2;
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
    refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Check for New Reports';
    
    const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        buttonContainer.insertBefore(refreshBtn, logoutBtn);
    } else {
        buttonContainer.appendChild(refreshBtn);
    }
}

// ADD LOGOUT BUTTON
function addLogoutButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    if (buttonContainer.querySelector('button[onclick="logout()"]')) return;
    
    const logoutBtn = document.createElement('button');
    logoutBtn.onclick = logout;
    logoutBtn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all duration-200 btn-glow flex items-center justify-center';
    logoutBtn.innerHTML = '<span class="mr-2">🚪</span> Logout';
    
    buttonContainer.appendChild(logoutBtn);
}

// ============================================================================
// SECTION 17: SETTINGS MANAGER
// ============================================================================

class SettingsManager {
    constructor() {
        this.isActive = false;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.injectSettingsUI());
        } else {
            this.injectSettingsUI();
        }
    }

    injectSettingsUI() {
        const navContainer = document.querySelector('.bg-green-50 .flex.gap-2');
        
        if (navContainer && !document.getElementById('settingsBtn')) {
            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'settingsBtn';
            settingsBtn.onclick = () => this.openSettingsTab();
            settingsBtn.className = 'bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200 btn-glow flex items-center justify-center';
            settingsBtn.innerHTML = '<span class="mr-2">⚙️</span> Settings';
            
            const logoutBtn = navContainer.querySelector('button[onclick="logout()"]');
            if (logoutBtn) {
                navContainer.insertBefore(settingsBtn, logoutBtn);
            } else {
                navContainer.appendChild(settingsBtn);
            }
        }

        const mainContainer = document.getElementById('reportArea');
        if (mainContainer && !document.getElementById('settingsContentArea')) {
            const settingsDiv = document.createElement('div');
            settingsDiv.id = 'settingsContentArea';
            settingsDiv.className = 'hidden max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in';
            settingsDiv.innerHTML = `
                <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div class="bg-gray-800 px-6 py-4 flex justify-between items-center">
                        <h2 class="text-xl font-bold text-white flex items-center">
                            <span class="mr-2">⚙️</span> Family Profile & Settings
                        </h2>
                        <button onclick="switchMainTab('reports')" class="text-gray-300 hover:text-white text-sm">
                            ← Back to Dashboard
                        </button>
                    </div>
                    <div id="settingsDynamicContent" class="p-6">
                        <div class="loading-spinner mx-auto"></div>
                    </div>
                </div>
            `;
            mainContainer.appendChild(settingsDiv);
        }
    }

    openSettingsTab() {
        ['reportContentArea', 'academicsContentArea', 'rewardsContentArea'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        ['reportTab', 'academicsTab', 'rewardsTab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('tab-active-main');
                el.classList.add('tab-inactive-main');
            }
        });

        const settingsArea = document.getElementById('settingsContentArea');
        if (settingsArea) {
            settingsArea.classList.remove('hidden');
            this.loadSettingsData();
        }
    }

    async loadSettingsData() {
        const content = document.getElementById('settingsDynamicContent');
        const user = auth.currentUser;
        if (!user) return;

        try {
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            const userData = userDoc.data();
            
            const childrenResult = await comprehensiveFindChildren(userData.normalizedPhone || userData.phone);
            const students = childrenResult.allStudentData;

            this.renderSettingsForm(userData, students);

        } catch (error) {
            console.error("Settings load error:", error);
            content.innerHTML = `<p class="text-red-500">Error loading settings: ${error.message}</p>`;
        }
    }

    renderSettingsForm(userData, students) {
        const content = document.getElementById('settingsDynamicContent');
        
        let html = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1 space-y-6">
                    <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Parent Profile</h3>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                        <input type="text" id="settingParentName" value="${safeText(userData.parentName || 'Parent')}" 
                            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Primary Phone (Login)</label>
                        <input type="text" value="${safeText(userData.phone)}" disabled 
                            class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed">
                        <p class="text-xs text-gray-500 mt-1">To change login phone, please contact support.</p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input type="email" id="settingParentEmail" value="${safeText(userData.email || '')}" 
                            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <button onclick="window.settingsManager.saveParentProfile()" 
                        class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Update My Profile
                    </button>
                </div>

                <div class="md:col-span-2 space-y-6">
                    <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Children & Linked Contacts</h3>
                    
                    ${students.length === 0 ? '<p class="text-gray-500 italic">No students linked yet.</p>' : ''}
                    
                    <div class="space-y-6">
        `;

        students.forEach((student, index) => {
            const data = student.data;
            const gender = data.gender || '';
            const motherPhone = data.motherPhone || '';
            const fatherPhone = data.fatherPhone || '';
            const guardianEmail = data.guardianEmail || '';

            html += `
                <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Student Name</label>
                            <input type="text" id="studentName_${student.id}" value="${safeText(student.name)}" 
                                class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 font-semibold text-gray-800">
                        </div>

                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                            <select id="studentGender_${student.id}" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 bg-white">
                                <option value="" ${gender === '' ? 'selected' : ''}>Select Gender...</option>
                                <option value="Male" ${gender === 'Male' ? 'selected' : ''}>Male</option>
                                <option value="Female" ${gender === 'Female' ? 'selected' : ''}>Female</option>
                            </select>
                        </div>

                        <div class="col-span-2 border-t border-gray-200 pt-3 mt-1">
                            <p class="text-sm font-semibold text-blue-800 mb-2">📞 Additional Contacts (For Access)</p>
                            <p class="text-xs text-gray-500 mb-3">Add Father/Mother numbers here. Anyone with these numbers can log in or view reports.</p>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs text-gray-500">Mother's Phone</label>
                                    <input type="tel" id="motherPhone_${student.id}" value="${safeText(motherPhone)}" placeholder="+1..."
                                        class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500">Father's Phone</label>
                                    <input type="tel" id="fatherPhone_${student.id}" value="${safeText(fatherPhone)}" placeholder="+1..."
                                        class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-xs text-gray-500">Secondary Email (CC for Reports)</label>
                                    <input type="email" id="guardianEmail_${student.id}" value="${safeText(guardianEmail)}" 
                                        class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                            </div>
                        </div>

                        <div class="col-span-2 mt-2 flex justify-end">
                            <button onclick="window.settingsManager.updateStudent('${student.id}', '${student.collection}')" 
                                class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center">
                                <span>💾 Save ${safeText(student.name)}'s Details</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = html;
    }

    async saveParentProfile() {
        const user = auth.currentUser;
        if (!user) return;

        const name = document.getElementById('settingParentName').value.trim();
        const email = document.getElementById('settingParentEmail').value.trim();

        if (!name) return showMessage('Name is required', 'error');

        try {
            const btn = document.querySelector('button[onclick="window.settingsManager.saveParentProfile()"]');
            const originalText = btn ? btn.innerHTML : 'Update My Profile';
            
            if (btn) {
                btn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Saving...';
                btn.disabled = true;
            }

            await db.collection('parent_users').doc(user.uid).update({
                parentName: name,
                email: email
            });

            const welcomeMsg = document.getElementById('welcomeMessage');
            if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${name}!`;

            showMessage('Profile updated successfully!', 'success');
            
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            showMessage('Failed to update profile.', 'error');
        }
    }

    async updateStudent(studentId, collectionName) {
        try {
            const nameInput = document.getElementById(`studentName_${studentId}`);
            const genderInput = document.getElementById(`studentGender_${studentId}`);
            const motherInput = document.getElementById(`motherPhone_${studentId}`);
            const fatherInput = document.getElementById(`fatherPhone_${studentId}`);
            const emailInput = document.getElementById(`guardianEmail_${studentId}`);

            const newName = nameInput.value.trim();
            const gender = genderInput.value;
            const motherPhone = motherInput.value.trim();
            const fatherPhone = fatherInput.value.trim();
            const email = emailInput.value.trim();

            if (!newName) return showMessage('Student name cannot be empty', 'error');

            const btn = document.querySelector(`button[onclick="window.settingsManager.updateStudent('${studentId}', '${collectionName}')"]`);
            const originalText = btn ? btn.innerHTML : 'Save Details';
            
            if (btn) {
                btn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Updating Everywhere...';
                btn.disabled = true;
            }

            const updateData = {
                studentName: newName,
                name: newName,
                gender: gender,
                motherPhone: motherPhone,
                fatherPhone: fatherPhone,
                guardianEmail: email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection(collectionName).doc(studentId).update(updateData);

            this.propagateStudentNameChange(studentId, newName);

            showMessage(`${newName}'s details updated successfully!`, 'success');
            
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }

            if (window.authManager) {
                setTimeout(() => window.authManager.reloadDashboard(), 1000);
            }

        } catch (error) {
            console.error("Update error:", error);
            showMessage('Error updating student details.', 'error');
        }
    }

    async propagateStudentNameChange(studentId, newName) {
        console.log(`🔄 Propagating name change for ${studentId} to: ${newName}`);
        
        const collections = ['tutor_submissions', 'student_results'];
        
        for (const col of collections) {
            try {
                const snapshot = await db.collection(col)
                    .where('studentId', '==', studentId)
                    .limit(50)
                    .get();

                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        const ref = db.collection(col).doc(doc.id);
                        batch.update(ref, { 
                            studentName: newName,
                            student: newName 
                        });
                    });
                    await batch.commit();
                    console.log(`✅ Updated ${snapshot.size} documents in ${col}`);
                }
            } catch (err) {
                console.warn(`Background update for ${col} failed:`, err);
            }
        }
    }
}

// Initialize settings manager
let settingsManager = new SettingsManager();

// ============================================================================
// SECTION 18: GOOGLE CLASSROOM HOMEWORK
// ============================================================================

const CLOUDINARY_CONFIG = {
    cloudName: 'dwjq7j5zp',
    uploadPreset: 'tutor_homework'
};

// Inject dependencies
(function() {
    if (!document.getElementById('cloudinary-script')) {
        const script = document.createElement('script');
        script.id = 'cloudinary-script';
        script.src = 'https://upload-widget.cloudinary.com/global/all.js';
        document.head.appendChild(script);
    }

    const style = document.createElement('style');
    style.textContent = `
        .gc-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); animation: fadeIn 0.2s; }
        .gc-modal-container { background: #fff; width: 90%; max-width: 1000px; height: 90vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.2); }
        .gc-header { padding: 16px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
        .gc-body { display: flex; flex: 1; overflow-y: auto; background: #fff; }
        .gc-main { flex: 1; padding: 24px; border-right: 1px solid #f0f0f0; }
        .gc-sidebar { width: 350px; padding: 24px; background: #fff; }
        .gc-title { font-size: 2rem; color: #1967d2; margin-bottom: 8px; font-weight: 400; }
        .gc-card { background: #fff; border: 1px solid #dadce0; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(60,64,67,0.3); margin-bottom: 16px; }
        .gc-btn-add { display: flex; align-items: center; justify-content: center; width: 100%; padding: 10px; margin-bottom: 10px; background: #fff; border: 1px solid #dadce0; border-radius: 4px; color: #1967d2; font-weight: 500; cursor: pointer; transition: 0.2s; }
        .gc-btn-add:hover { background: #f8f9fa; color: #174ea6; }
        .gc-btn-primary { width: 100%; padding: 10px; background: #1967d2; border: none; border-radius: 4px; color: #fff; font-weight: 500; cursor: pointer; transition: 0.2s; }
        .gc-btn-primary:hover { background: #185abc; }
        .gc-btn-primary:disabled { background: #e0e0e0; cursor: not-allowed; }
        .gc-btn-unsubmit { width: 100%; padding: 10px; background: #fff; border: 1px solid #dadce0; border-radius: 4px; color: #3c4043; font-weight: 500; cursor: pointer; margin-top: 10px; }
        .gc-btn-unsubmit:hover { background: #f1f3f4; }
        .gc-attachment { display: flex; align-items: center; border: 1px solid #dadce0; border-radius: 4px; padding: 8px; margin-bottom: 12px; cursor: pointer; }
        .gc-att-icon { width: 36px; height: 36px; background: #f1f3f4; color: #1967d2; display: flex; align-items: center; justify-content: center; margin-right: 12px; border-radius: 4px; }
        .gc-inject-btn { transition: opacity 0.3s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 768px) { .gc-body { flex-direction: column; } .gc-sidebar { width: 100%; border-top: 1px solid #e0e0e0; } }
    `;
    document.head.appendChild(style);
})();

let homeworkListenerUnsub = null;

function openGoogleClassroomModal(initialHwData, studentId) {
    document.body.style.overflow = 'hidden';
    
    const modalHTML = `
        <div class="gc-modal-overlay" id="gcModal">
            <div class="gc-modal-container">
                <div class="gc-header">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-100 rounded-full text-blue-600">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" /></svg>
                        </div>
                        <span class="font-medium text-gray-600">Assignment Details</span>
                    </div>
                    <button onclick="closeGoogleClassroomModal()" class="text-2xl text-gray-500 hover:text-black transition-colors">×</button>
                </div>
                <div class="gc-body" id="gcBodyContent">
                    <div class="flex justify-center items-center h-full w-full"><div class="loading-spinner"></div></div>
                </div>
            </div>
        </div>`;
    
    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);

    const hwRef = db.collection('homework_assignments').doc(initialHwData.id);
    homeworkListenerUnsub = hwRef.onSnapshot((doc) => {
        if (doc.exists) {
            const freshData = { id: doc.id, ...doc.data() };
            if (!freshData.dueTimestamp && freshData.dueDate) {
                freshData.dueTimestamp = getTimestamp(freshData.dueDate);
            }
            renderGoogleClassroomContent(freshData, studentId);
        }
    });
}

function renderGoogleClassroomContent(homework, studentId) {
    const container = document.getElementById('gcBodyContent');
    if (!container) return;

    const isGraded = homework.status === 'graded';
    const isSubmitted = ['submitted', 'completed', 'graded'].includes(homework.status);
    const now = Date.now();
    const isOverdue = !isSubmitted && homework.dueTimestamp && homework.dueTimestamp < now;

    let statusText = 'Assigned';
    let statusClass = 'text-green-700';

    if (isGraded) { statusText = 'Graded'; statusClass = 'text-black font-bold'; }
    else if (isSubmitted) { statusText = 'Handed in'; statusClass = 'text-green-700 font-bold'; }
    else if (isOverdue) { statusText = 'Missing'; statusClass = 'text-red-600 font-bold'; }

    container.innerHTML = `
        <div class="gc-main">
            <h1 class="gc-title">${safeText(homework.title || homework.subject)}</h1>
            <div class="text-gray-500 text-sm mb-6 flex gap-3">
                <span>${safeText(homework.tutorName || 'Tutor')}</span> • 
                <span>Due ${formatDetailedDate(homework.dueTimestamp)}</span> • 
                <span class="${statusClass}">${statusText}</span>
            </div>
            <div class="border-b mb-6"></div>
            
            <div class="text-gray-800 leading-relaxed whitespace-pre-wrap mb-8">
                ${safeText(homework.description || homework.instructions || 'No instructions provided.')}
            </div>
            
            ${homework.fileUrl ? `
                <div class="mt-4">
                    <h4 class="text-sm font-medium text-gray-500 mb-2">Reference Materials</h4>
                    <a href="${homework.fileUrl}" target="_blank" class="gc-attachment hover:bg-gray-50">
                        <div class="gc-att-icon">📎</div>
                        <div class="text-sm font-medium text-blue-900 truncate flex-1">Download Assignment File</div>
                    </a>
                </div>` : ''}
        </div>

        <div class="gc-sidebar">
            <div class="gc-card">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-lg font-medium text-gray-800">Your work</h2>
                    <div class="text-xs uppercase font-bold ${statusClass}">${statusText}</div>
                </div>

                <div id="gc-file-area" class="mb-4">
                    ${homework.submissionUrl ? `
                        <div class="gc-attachment">
                            <div class="gc-att-icon">📄</div>
                            <div class="flex-1 truncate text-sm">Submitted File</div>
                            <a href="${homework.submissionUrl}" target="_blank" class="text-blue-600 text-xs font-bold px-2">VIEW</a>
                        </div>` : ''}
                </div>

                ${!isSubmitted ? `
                    <button class="gc-btn-add" onclick="triggerCloudinaryUpload('${homework.id}', '${studentId}')">
                        <span class="mr-2 text-xl">+</span> Add or create
                    </button>
                    <button id="btn-turn-in" class="gc-btn-primary" 
                        onclick="submitHomeworkToFirebase('${homework.id}')" ${!homework.submissionUrl ? 'disabled style="opacity:0.5"' : ''}>
                        Mark as done
                    </button>
                    <p class="text-xs text-gray-500 mt-2 text-center">Upload a file to enable submission</p>
                ` : `
                    ${isGraded ? `
                        <div class="text-center py-4 bg-gray-50 rounded border border-gray-200">
                            <div class="text-3xl font-bold text-gray-800">${homework.grade || homework.score || '-'}%</div>
                            <div class="text-xs text-gray-500">Overall Grade</div>
                        </div>
                    ` : `
                        <button class="gc-btn-unsubmit" onclick="unsubmitHomework('${homework.id}')">Unsubmit</button>
                        <p class="text-xs text-gray-500 mt-2 text-center">Unsubmit to add or change attachments.</p>
                    `}
                `}
            </div>

            ${homework.feedback ? `
                <div class="gc-card mt-4">
                    <h2 class="text-sm font-medium mb-2">Private comments</h2>
                    <div class="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100">${safeText(homework.feedback)}</div>
                    <div class="text-xs text-gray-400 mt-1 text-right">From Tutor</div>
                </div>` : ''}
        </div>
    `;
}

function closeGoogleClassroomModal() {
    if (homeworkListenerUnsub) homeworkListenerUnsub();
    const modal = document.getElementById('gcModal');
    if (modal) modal.remove();
    document.body.style.overflow = 'auto';
}

function triggerCloudinaryUpload(homeworkId, studentId) {
    if (!window.cloudinary) {
        showMessage('Upload widget is loading. Please try again in a few seconds.', 'error');
        return;
    }
    
    const widget = cloudinary.createUploadWidget({
        cloudName: CLOUDINARY_CONFIG.cloudName,
        uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
        sources: ['local', 'camera', 'google_drive'],
        folder: `homework_submissions/${studentId}`,
        tags: [homeworkId, 'homework_submission'],
        multiple: false
    }, async (error, result) => {
        if (!error && result && result.event === "success") {
            await db.collection('homework_assignments').doc(homeworkId).update({
                submissionUrl: result.info.secure_url,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showMessage('File uploaded!', 'success');
        } else if (error) {
            showMessage('Upload failed. Please try again.', 'error');
        }
    });
    widget.open();
}

async function submitHomeworkToFirebase(homeworkId) {
    if (!confirm("Are you ready to turn in your work?")) return;
    
    const btn = document.getElementById('btn-turn-in');
    if(btn) { btn.disabled = true; btn.textContent = "Turning in..."; }

    try {
        await db.collection('homework_assignments').doc(homeworkId).update({
            status: 'submitted',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            submissionDate: new Date().toISOString()
        });
        showMessage('Assignment turned in!', 'success');
    } catch (e) {
        console.error(e);
        showMessage('Error turning in work.', 'error');
        if(btn) { btn.disabled = false; btn.textContent = "Mark as done"; }
    }
}

async function unsubmitHomework(homeworkId) {
    if (!confirm("Unsubmit this assignment?")) return;
    await db.collection('homework_assignments').doc(homeworkId).update({
        status: 'assigned',
        submissionUrl: firebase.firestore.FieldValue.delete()
    });
}

// RELIABLE SCANNER
function scanAndInjectButtons() {
    const cards = document.querySelectorAll('#academicsContent .bg-white.border.rounded-lg');

    cards.forEach(card => {
        if (card.querySelector('.gc-inject-btn')) return;

        const textContent = card.textContent || "";
        if (!textContent.includes('Due:')) return;

        const btnContainer = document.createElement('div');
        btnContainer.className = 'mt-4 pt-3 border-t border-gray-100 flex justify-end gc-inject-btn fade-in';
        btnContainer.innerHTML = `
            <button class="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm group">
                <span class="group-hover:scale-110 transition-transform">📤</span> 
                <span>Turn In / View Details</span>
            </button>
        `;

        const btn = btnContainer.querySelector('button');
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const titleEl = card.querySelector('h5');
            const titleText = titleEl ? titleEl.textContent.trim() : '';
            if (titleText) findAndOpenHomework(titleText);
        };

        card.appendChild(btnContainer);
    });
}

function findAndOpenHomework(titleText) {
    const selector = document.getElementById('studentSelector');
    let studentName = selector ? selector.value : null;
    if (!studentName && userChildren.length > 0) studentName = userChildren[0];
    
    if (!studentName) {
        showMessage('Please select a student first.', 'error');
        return;
    }
    
    const studentId = studentIdMap.get(studentName);
    if (!studentId) {
        showMessage('Student ID not found.', 'error');
        return;
    }

    showMessage('Opening classroom...', 'success');

    db.collection('homework_assignments')
        .where('studentId', '==', studentId)
        .where('title', '==', titleText)
        .limit(1)
        .get()
        .then(snapshot => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const hwData = { id: doc.id, ...doc.data() };
                if (!hwData.dueTimestamp && hwData.dueDate) {
                    hwData.dueTimestamp = getTimestamp(hwData.dueDate);
                }
                openGoogleClassroomModal(hwData, studentId);
            } else {
                db.collection('homework_assignments')
                    .where('studentId', '==', studentId)
                    .get()
                    .then(snap => {
                        const found = snap.docs.find(d => {
                            const dData = d.data();
                            return (dData.title || dData.subject) === titleText;
                        });
                        if (found) {
                            const hwData = { id: found.id, ...found.data() };
                            if (!hwData.dueTimestamp && hwData.dueDate) {
                                hwData.dueTimestamp = getTimestamp(hwData.dueDate);
                            }
                            openGoogleClassroomModal(hwData, studentId);
                        } else {
                            showMessage('Could not find assignment details.', 'error');
                        }
                    });
            }
        })
        .catch(err => {
            console.error("Error finding homework:", err);
            showMessage('Error loading assignment.', 'error');
        });
}

// ============================================================================
// SECTION 19: HELPER FUNCTIONS
// ============================================================================

async function checkForNewAcademics() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        const parentPhone = userData.normalizedPhone || userData.phone;

        const childrenResult = await comprehensiveFindChildren(parentPhone);
        
        let totalUnread = 0;

        for (const [studentName, studentId] of childrenResult.studentNameIdMap) {
            try {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                
                const [sessionTopicsSnapshot, homeworkSnapshot] = await Promise.all([
                    db.collection('daily_topics').where('studentId', '==', studentId).get(),
                    db.collection('homework_assignments').where('studentId', '==', studentId).get()
                ]);
                
                let studentUnread = 0;
                
                sessionTopicsSnapshot.forEach(doc => {
                    const topic = doc.data();
                    const topicDate = topic.date?.toDate?.() || topic.createdAt?.toDate?.() || new Date(0);
                    if (topicDate >= oneWeekAgo) {
                        studentUnread++;
                    }
                });
                
                homeworkSnapshot.forEach(doc => {
                    const homework = doc.data();
                    const assignedDate = homework.assignedDate?.toDate?.() || homework.createdAt?.toDate?.() || new Date(0);
                    if (assignedDate >= oneWeekAgo) {
                        studentUnread++;
                    }
                });
                
                totalUnread += studentUnread;
                
            } catch (error) {
                console.error(`Error checking academics for ${studentName}:`, error);
            }
        }
        
        updateAcademicsTabBadge(totalUnread);

    } catch (error) {
        console.error('Error checking for new academics:', error);
    }
}

function updateAcademicsTabBadge(count) {
    const academicsTab = document.getElementById('academicsTab');
    if (!academicsTab) return;
    
    const existingBadge = academicsTab.querySelector('.academics-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
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

// ============================================================================
// SECTION 20: INITIALIZATION & UTILITIES
// ============================================================================

function initializeParentPortalV2() {
    console.log("🚀 Initializing Parent Portal V2 (Production Edition)");

    setupRememberMe();
    injectCustomCSS();
    createCountryCodeDropdown();
    setupEventListeners();
    setupGlobalErrorHandler();

    authManager.initialize();

    window.addEventListener('beforeunload', () => {
        authManager.cleanup();
        cleanupRealTimeListeners();
    });

    console.log("✅ Parent Portal V2 initialized");
}

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

function handleSignUp() {
    const countryCode = document.getElementById('countryCode')?.value;
    const localPhone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;

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

function switchMainTab(tab) {
    const reportTab = document.getElementById('reportTab');
    const academicsTab = document.getElementById('academicsTab');
    const rewardsTab = document.getElementById('rewardsTab');
    
    const reportContentArea = document.getElementById('reportContentArea');
    const academicsContentArea = document.getElementById('academicsContentArea');
    const rewardsContentArea = document.getElementById('rewardsContentArea');
    const settingsContentArea = document.getElementById('settingsContentArea');
    
    reportTab?.classList.remove('tab-active-main');
    reportTab?.classList.add('tab-inactive-main');
    academicsTab?.classList.remove('tab-active-main');
    academicsTab?.classList.add('tab-inactive-main');
    rewardsTab?.classList.remove('tab-active-main');
    rewardsTab?.classList.add('tab-inactive-main');
    
    reportContentArea?.classList.add('hidden');
    academicsContentArea?.classList.add('hidden');
    rewardsContentArea?.classList.add('hidden');
    settingsContentArea?.classList.add('hidden');
    
    if (tab === 'reports') {
        reportTab?.classList.remove('tab-inactive-main');
        reportTab?.classList.add('tab-active-main');
        reportContentArea?.classList.remove('hidden');
    } else if (tab === 'academics') {
        academicsTab?.classList.remove('tab-inactive-main');
        academicsTab?.classList.add('tab-active-main');
        academicsContentArea?.classList.remove('hidden');
        loadAcademicsData();
    } else if (tab === 'rewards') {
        rewardsTab?.classList.remove('tab-inactive-main');
        rewardsTab?.classList.add('tab-active-main');
        rewardsContentArea?.classList.remove('hidden');
        
        const user = auth.currentUser;
        if (user) {
            loadReferralRewards(user.uid);
        }
    }
}

function setupEventListeners() {
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
    
    const rememberMeCheckbox = document.getElementById("rememberMe");
    if (rememberMeCheckbox) {
        rememberMeCheckbox.removeEventListener("change", handleRememberMe);
        rememberMeCheckbox.addEventListener("change", handleRememberMe);
    }
    
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

function handleLoginEnter(e) {
    if (e.key === 'Enter') handleSignIn();
}

function handleSignupEnter(e) {
    if (e.key === 'Enter') handleSignUp();
}

function handleResetEnter(e) {
    if (e.key === 'Enter') handlePasswordReset();
}

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

function logout() {
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('isAuthenticated');
    
    cleanupRealTimeListeners();
    
    auth.signOut().then(() => {
        window.location.reload();
    });
}

function setupGlobalErrorHandler() {
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault();
    });
    
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        if (!e.error?.message?.includes('auth') && 
            !e.error?.message?.includes('permission-denied')) {
            showMessage('An unexpected error occurred. Please refresh the page.', 'error');
        }
        e.preventDefault();
    });
    
    window.addEventListener('offline', function() {
        showMessage('You are offline. Some features may not work.', 'warning');
    });
    
    window.addEventListener('online', function() {
        showMessage('Connection restored.', 'success');
    });
}

// ============================================================================
// PAGE INITIALIZATION & GOOGLE CLASSROOM SETUP
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM Content Loaded - Starting V2 initialization");
    
    initializeParentPortalV2();
    
    // Initialize Google Classroom scanner
    setTimeout(scanAndInjectButtons, 500);
    
    const observer = new MutationObserver(() => {
        setTimeout(scanAndInjectButtons, 100);
    });
    
    const target = document.getElementById('academicsContent');
    if (target) observer.observe(target, { childList: true, subtree: true });
    
    // Fallback interval (every 2 seconds)
    setInterval(scanAndInjectButtons, 2000);
    
    console.log("🎉 Parent Portal V2 fully initialized");
});

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

// Make global for debugging
window.authManager = authManager;
window.comprehensiveFindChildren = comprehensiveFindChildren;
window.manualRefreshReportsV2 = manualRefreshReportsV2;
window.loadAcademicsData = loadAcademicsData;
window.onStudentSelected = onStudentSelected;
window.toggleAcademicsAccordion = toggleAcademicsAccordion;
window.toggleAccordion = toggleAccordion;
window.downloadSessionReport = downloadSessionReport;
window.downloadMonthlyReport = downloadMonthlyReport;
window.switchMainTab = switchMainTab;
window.logout = logout;
window.showPasswordResetModal = showPasswordResetModal;
window.hidePasswordResetModal = hidePasswordResetModal;
window.switchTab = switchTab;
window.settingsManager = settingsManager;

// ============================================================================
// END OF PARENT.JS - PRODUCTION READY
// ============================================================================
