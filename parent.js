
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
    
    // FULL COUNTRY CODES LIST (40+ countries) - MAINTAINED GLOBAL
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
// ENHANCED PHONE VARIATION GENERATOR - FINDS ALL POSSIBLE FORMATS
// ============================================================================

/**
 * Generate ALL possible phone variations with MAXIMUM coverage
 * This ensures we find children/reports even if phones are stored differently
 */
function generateAllPhoneVariations(phone) {
    const variations = new Set();
    
    if (!phone || typeof phone !== 'string') return [];
    
    console.log(`🔧 Generating phone variations for: "${phone}"`);
    
    // Add original (trimmed)
    const trimmed = phone.trim();
    variations.add(trimmed);
    
    // BASIC CLEANING - multiple methods
    const cleaned1 = phone.replace(/\s+/g, ''); // Remove spaces only
    const cleaned2 = phone.replace(/[^\d+]/g, ''); // Remove all non-digit except +
    const cleaned3 = phone.replace(/[^0-9]/g, ''); // Remove everything except digits
    
    variations.add(cleaned1);
    variations.add(cleaned2);
    variations.add(cleaned3);
    
    // If it starts with +, add without +
    if (cleaned2.startsWith('+')) {
        variations.add(cleaned2.substring(1));
    }
    
    // Add with + if it doesn't have it
    if (!cleaned2.startsWith('+') && cleaned2.length > 5) {
        variations.add('+' + cleaned2);
    }
    
    // COMMON COUNTRY CODE PATTERNS (EXPANDED)
    const countryCodes = [
        '+1', '+234', '+44', '+91', '+86', '+33', '+49', '+81', '+61', '+55',
        '+7', '+20', '+27', '+34', '+39', '+52', '+62', '+82', '+90', '+92',
        '+966', '+971', '+233', '+254', '+255', '+256', '+237', '+251', '+250',
        '+41', '+351', '+31', '+32', '+46', '+47', '+45', '+358', '+353', '+48',
        '+961', '+962', '+60', '+852', '+63', '+65', '+64', '+380', '+30', '+43',
        '+420', '+36', '+40'
    ];
    
    // Try adding/removing country codes
    for (const code of countryCodes) {
        // If number starts with country code, remove it
        if (cleaned2.startsWith(code)) {
            const withoutCode = cleaned2.substring(code.length);
            variations.add(withoutCode);
            variations.add('0' + withoutCode); // Add leading zero
            variations.add('0' + withoutCode.substring(1)); // Try with single 0
        }
        
        // If number doesn't start with +, try adding country code
        if (!cleaned2.startsWith('+') && cleaned2.length >= 7) {
            variations.add(code + cleaned2);
            variations.add(code.substring(1) + cleaned2); // Without +
        }
        
        // Try with local number starting with 0
        if (cleaned2.startsWith('0') && cleaned2.length >= 10) {
            const withoutZero = cleaned2.substring(1);
            variations.add(code + withoutZero);
        }
    }
    
    // LOCAL FORMAT VARIATIONS
    const digitsOnly = cleaned3;
    
    if (digitsOnly.length >= 7) {
        // US/Canada formats (10 digits)
        if (digitsOnly.length === 10) {
            variations.add('+1' + digitsOnly);
            variations.add('1' + digitsOnly);
            variations.add('(' + digitsOnly.substring(0, 3) + ') ' + digitsOnly.substring(3, 6) + '-' + digitsOnly.substring(6));
            variations.add(digitsOnly.substring(0, 3) + '-' + digitsOnly.substring(3, 6) + '-' + digitsOnly.substring(6));
            variations.add(digitsOnly.substring(0, 3) + '.' + digitsOnly.substring(3, 6) + '.' + digitsOnly.substring(6));
        }
        
        // Nigeria formats (234) - 11 digits starting with 0
        if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
            variations.add('+234' + digitsOnly.substring(1));
            variations.add('234' + digitsOnly.substring(1));
            variations.add('0' + digitsOnly.substring(1)); // Sometimes stored as 080...
            variations.add(digitsOnly); // Original 080...
        }
        
        // UK formats (44) - 11 digits starting with 0
        if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
            variations.add('+44' + digitsOnly.substring(1));
            variations.add('44' + digitsOnly.substring(1));
        }
        
        // Generic international format
        variations.add('+' + digitsOnly);
        
        // Try adding common prefixes
        if (digitsOnly.length >= 9) {
            variations.add('0' + digitsOnly);
            variations.add('00' + digitsOnly);
        }
    }
    
    // SPACED/DASHED FORMATS for all variations
    const allVars = Array.from(variations);
    allVars.forEach(variation => {
        if (variation && variation.length >= 7) {
            const digits = variation.replace(/\D/g, '');
            
            if (digits.length === 10) {
                // XXX-XXX-XXXX
                const dashed = digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                if (dashed !== variation) variations.add(dashed);
                
                // (XXX) XXX-XXXX
                const parens = digits.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
                if (parens !== variation) variations.add(parens);
                
                // XXX.XXX.XXXX
                const dotted = digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1.$2.$3');
                if (dotted !== variation) variations.add(dotted);
                
                // XXX XXX XXXX
                const spaced = digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
                if (spaced !== variation) variations.add(spaced);
            }
            
            if (digits.length === 11) {
                // 1-XXX-XXX-XXXX
                const dashed11 = digits.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1-$2-$3-$4');
                if (dashed11 !== variation) variations.add(dashed11);
                
                // 1.XXX.XXX.XXXX
                const dotted11 = digits.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3.$4');
                if (dotted11 !== variation) variations.add(dotted11);
                
                // 1 XXX XXX XXXX
                const spaced11 = digits.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
                if (spaced11 !== variation) variations.add(spaced11);
            }
            
            // Generic formatting for any length
            if (digits.length >= 8 && digits.length <= 15) {
                // Try grouping by 2, 3, or 4 digits
                const groups3 = digits.match(/.{1,3}/g);
                if (groups3) {
                    const grouped3 = groups3.join('-');
                    if (grouped3 !== variation && grouped3.length >= 7) variations.add(grouped3);
                }
                
                const groups4 = digits.match(/.{1,4}/g);
                if (groups4) {
                    const grouped4 = groups4.join('-');
                    if (grouped4 !== variation && grouped4.length >= 7) variations.add(grouped4);
                }
            }
        }
    });
    
    // Filter and return
    const finalVariations = Array.from(variations)
        .filter(v => v && v.length >= 7)  // Minimum 7 chars (including country code)
        .filter(v => v.length <= 20)     // Maximum reasonable length
        .filter(v => !v.includes('undefined') && !v.includes('null') && !v.includes('NaN'))
        .filter(v => {
            // Remove obviously invalid variations
            const digits = v.replace(/\D/g, '');
            return digits.length >= 7; // At least 7 actual digits
        })
        .filter((v, i, arr) => arr.indexOf(v) === i); // Unique values only
    
    console.log(`📱 Generated ${finalVariations.length} phone variations`);
    
    // DEBUG: Show first 10 variations
    if (finalVariations.length > 0) {
        console.log("📱 Sample variations:", finalVariations.slice(0, 10));
    }
    
    return finalVariations;
}

// ============================================================================
// ENHANCED STUDENT SEARCH WITH ALL VARIATIONS
// ============================================================================

/**
 * Find ALL students for a parent using ALL phone variations
 */
async function findAllStudentsForParent(parentPhone) {
    console.log("🔍 Searching for ALL students with phone:", parentPhone);
    
    const phoneVariations = generateAllPhoneVariations(parentPhone);
    console.log(`📱 Using ${phoneVariations.length} phone variations`);
    
    const allStudents = [];
    const foundIds = new Set();
    
    // Search in students collection
    for (const phoneVar of phoneVariations) {
        try {
            const snapshot = await db.collection('students')
                .where('parentPhone', '==', phoneVar)
                .get();
            
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    if (!foundIds.has(doc.id)) {
                        const student = doc.data();
                        allStudents.push({
                            id: doc.id,
                            name: safeText(student.studentName || student.name || 'Unknown'),
                            phoneFoundWith: phoneVar,
                            source: 'students',
                            data: student,
                            isPending: false
                        });
                        foundIds.add(doc.id);
                        console.log(`✅ Found student: ${student.studentName} (with phone: ${phoneVar})`);
                    }
                });
            }
        } catch (error) {
            console.warn(`Error searching students with ${phoneVar}:`, error.message);
        }
    }
    
    // Search in pending_students collection
    for (const phoneVar of phoneVariations) {
        try {
            const snapshot = await db.collection('pending_students')
                .where('parentPhone', '==', phoneVar)
                .get();
            
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    if (!foundIds.has(doc.id)) {
                        const student = doc.data();
                        allStudents.push({
                            id: doc.id,
                            name: safeText(student.studentName || student.name || 'Unknown'),
                            phoneFoundWith: phoneVar,
                            source: 'pending_students',
                            data: student,
                            isPending: true
                        });
                        foundIds.add(doc.id);
                        console.log(`✅ Found pending student: ${student.studentName} (with phone: ${phoneVar})`);
                    }
                });
            }
        } catch (error) {
            console.warn(`Error searching pending_students with ${phoneVar}:`, error.message);
        }
    }
    
    console.log(`👥 TOTAL students found: ${allStudents.length}`);
    return allStudents;
}

// ============================================================================
// SECTION 3: GLOBAL VARIABLES & STATE MANAGEMENT
// ============================================================================

let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
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

// Find student IDs for a parent's phone number - ENHANCED TO FIND ALL CHILDREN
async function findStudentIdsForParent(parentPhone) {
    try {
        console.log("🔍 Finding ALL student IDs for parent phone:", parentPhone);
        
        // Normalize the phone number
        const normalizedPhone = normalizePhoneNumber(parentPhone);
        if (!normalizedPhone.valid) {
            console.log("Invalid phone number format");
            return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
        }

        let studentIds = [];
        let studentNameIdMap = new Map();
        let allStudentData = [];
        
        // DEBUG: Log what we're searching for
        console.log("🔍 Searching for normalized phone:", normalizedPhone.normalized);
        
        // GENERATE ALL PHONE VARIATIONS for thorough search
        const phoneVariations = generateAllPhoneVariations(parentPhone);
        console.log("📱 Phone variations to search:", phoneVariations);
        
        // Search in students collection - check ALL variations
        const studentsPromises = phoneVariations.map(phone => 
            db.collection("students")
                .where("parentPhone", "==", phone)
                .get()
                .catch(error => {
                    console.warn(`Error searching students with phone ${phone}:`, error);
                    return { empty: true, forEach: () => {} };
                })
        );
        
        // Search in pending_students collection - check ALL variations
        const pendingStudentsPromises = phoneVariations.map(phone =>
            db.collection("pending_students")
                .where("parentPhone", "==", phone)
                .get()
                .catch(error => {
                    console.warn(`Error searching pending_students with phone ${phone}:`, error);
                    return { empty: true, forEach: () => {} };
                })
        );
        
        // Wait for all searches to complete
        const allStudentsSnapshots = await Promise.all(studentsPromises);
        const allPendingSnapshots = await Promise.all(pendingStudentsPromises);
        
        // Process students collection results
        allStudentsSnapshots.forEach(snapshot => {
            if (snapshot.empty) return;
            
            snapshot.forEach(doc => {
                const studentData = doc.data();
                const studentId = doc.id;
                const studentName = safeText(studentData.studentName || studentData.name || 'Unknown');
                
                if (studentId && studentName && studentName !== 'Unknown') {
                    // Check if we already have this student (by ID or name)
                    const existingById = allStudentData.find(s => s.id === studentId);
                    const existingByName = allStudentData.find(s => s.name === studentName);
                    
                    if (!existingById && !existingByName) {
                        studentIds.push(studentId);
                        studentNameIdMap.set(studentName, studentId);
                        allStudentData.push({ 
                            id: studentId, 
                            name: studentName, 
                            data: studentData,
                            isPending: false 
                        });
                        console.log(`✅ Found student: ${studentName} (ID: ${studentId})`);
                    } else if (existingByName && existingByName.id !== studentId) {
                        // Same name, different ID - add with suffix
                        const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
                        studentIds.push(studentId);
                        studentNameIdMap.set(uniqueName, studentId);
                        allStudentData.push({ 
                            id: studentId, 
                            name: uniqueName, 
                            data: studentData,
                            isPending: false 
                        });
                        console.log(`✅ Found duplicate name student: ${uniqueName} (ID: ${studentId})`);
                    }
                }
            });
        });
        
        // Process pending_students collection results
        allPendingSnapshots.forEach(snapshot => {
            if (snapshot.empty) return;
            
            snapshot.forEach(doc => {
                const studentData = doc.data();
                const studentId = doc.id;
                const studentName = safeText(studentData.studentName || studentData.name || 'Unknown');
                
                if (studentId && studentName && studentName !== 'Unknown') {
                    // Check if we already have this student (by ID or name)
                    const existingById = allStudentData.find(s => s.id === studentId);
                    const existingByName = allStudentData.find(s => s.name === studentName);
                    
                    if (!existingById && !existingByName) {
                        studentIds.push(studentId);
                        studentNameIdMap.set(studentName, studentId);
                        allStudentData.push({ 
                            id: studentId, 
                            name: studentName, 
                            data: studentData, 
                            isPending: true 
                        });
                        console.log(`✅ Found pending student: ${studentName} (ID: ${studentId})`);
                    } else if (existingByName && existingByName.id !== studentId) {
                        // Same name, different ID - add with suffix
                        const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
                        studentIds.push(studentId);
                        studentNameIdMap.set(uniqueName, studentId);
                        allStudentData.push({ 
                            id: studentId, 
                            name: uniqueName, 
                            data: studentData,
                            isPending: true 
                        });
                        console.log(`✅ Found duplicate name pending student: ${uniqueName} (ID: ${studentId})`);
                    }
                }
            });
        });
        
        // Store the mapping globally
        studentIdMap = studentNameIdMap;
        
        console.log("📊 TOTAL student IDs found:", studentIds.length);
        console.log("👥 Student names found:", Array.from(studentNameIdMap.keys()));
        
        return { studentIds, studentNameIdMap, allStudentData };
    } catch (error) {
        console.error("❌ Error finding student IDs:", error);
        return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
    }
}

// ============================================================================
// SECTION 6: FIXED AUTHENTICATION & USER MANAGEMENT - ALLOWS DUPLICATE EMAILS
// ============================================================================

/**
 * ENHANCED SIGN-IN: Allows login with email OR phone, even if email was used elsewhere
 */
async function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const rememberMeCheckbox = document.getElementById('rememberMe');

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
        let userCredential;
        let userEmail = '';
        
        // Check if identifier is email or phone
        const isEmail = identifier.includes('@');
        
        if (isEmail) {
            // Try email login
            userEmail = identifier.toLowerCase();
            userCredential = await auth.signInWithEmailAndPassword(userEmail, password);
            console.log("✅ Signed in with email:", userEmail);
        } else {
            // Try phone login - need to find email first
            console.log("🔍 Identifier appears to be phone, finding email...");
            
            // Normalize phone
            const normalizedPhone = normalizePhoneNumber(identifier);
            if (!normalizedPhone.valid) {
                throw new Error('Invalid phone number format');
            }
            
            // Search for parent by phone in parent_users collection
            const parentSnapshot = await db.collection('parent_users')
                .where('phone', '==', normalizedPhone.normalized)
                .limit(1)
                .get();
            
            if (parentSnapshot.empty) {
                // Try normalizedPhone field
                const parentSnapshot2 = await db.collection('parent_users')
                    .where('normalizedPhone', '==', normalizedPhone.normalized)
                    .limit(1)
                    .get();
                
                if (parentSnapshot2.empty) {
                    throw new Error('No account found with this phone number');
                }
                
                const parentData = parentSnapshot2.docs[0].data();
                userEmail = parentData.email;
            } else {
                const parentData = parentSnapshot.docs[0].data();
                userEmail = parentData.email;
            }
            
            if (!userEmail) {
                throw new Error('Could not find email for this phone number');
            }
            
            // Sign in with found email
            userCredential = await auth.signInWithEmailAndPassword(userEmail, password);
            console.log("✅ Signed in with phone (found email):", userEmail);
        }

        // Handle Remember Me
        if (rememberMeCheckbox?.checked && userEmail) {
            localStorage.setItem('rememberMe', 'true');
            localStorage.setItem('savedEmail', safeText(userEmail));
        } else {
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('savedEmail');
        }

        showMessage('Successfully signed in!', 'success');
        
        // Auth state listener will handle the rest (dashboard loading)
        console.log("✅ Sign in successful, auth listener will handle dashboard");

    } catch (error) {
        console.error('Sign in error:', error);
        
        let errorMessage = 'Sign in failed. ';
        
        // User-friendly error messages
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage += 'Invalid email/phone or password.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email format.';
                break;
            case 'auth/too-many-requests':
                errorMessage += 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/network-request-failed':
                errorMessage += 'Network error. Please check your connection.';
                break;
            default:
                errorMessage += error.message || 'Please check your credentials.';
        }
        
        showMessage(errorMessage, 'error');
        
        // Reset button state
        signInBtn.disabled = false;
        document.getElementById('signInText').textContent = 'Sign In';
        document.getElementById('signInSpinner').classList.add('hidden');
        authLoader.classList.add('hidden');
    }
}

/**
 * ENHANCED SIGN-UP: Creates account even if email was used elsewhere
 * Now checks ALL phone variations and ALLOWS duplicate emails
 */
async function handleSignUp() {
    const countryCode = document.getElementById('countryCode')?.value;
    const localPhone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim().toLowerCase();
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

    try {
        console.log("🔍 Starting sign-up process...");
        
        // --- PHONE VALIDATION & SEARCH ---
        // Combine country code and local phone
        const fullPhone = countryCode + localPhone.replace(/[^\d]/g, '');
        console.log("📱 Full phone number:", fullPhone);
        
        // Normalize phone
        const normalizedPhone = normalizePhoneNumber(fullPhone);
        if (!normalizedPhone.valid) {
            throw new Error('Invalid phone number. Please check the format.');
        }
        
        // Check if phone already exists in parent_users (ALL variations)
        console.log("🔍 Checking for existing account with phone...");
        const phoneVariations = generateAllPhoneVariations(normalizedPhone.normalized);
        console.log("📱 Phone variations to check:", phoneVariations.length);
        
        let existingAccount = null;
        
        // Check each variation
        for (const phoneVar of phoneVariations) {
            try {
                const phoneSnapshot = await db.collection('parent_users')
                    .where('phone', '==', phoneVar)
                    .limit(1)
                    .get();
                
                if (!phoneSnapshot.empty) {
                    existingAccount = phoneSnapshot.docs[0];
                    console.log("⚠️ Found existing account with phone variation:", phoneVar);
                    break;
                }
                
                // Also check normalizedPhone field
                const normalizedSnapshot = await db.collection('parent_users')
                    .where('normalizedPhone', '==', phoneVar)
                    .limit(1)
                    .get();
                
                if (!normalizedSnapshot.empty) {
                    existingAccount = normalizedSnapshot.docs[0];
                    console.log("⚠️ Found existing account with normalized phone:", phoneVar);
                    break;
                }
            } catch (error) {
                console.warn(`Error checking phone variation ${phoneVar}:`, error.message);
                // Continue with other variations
            }
        }
        
        // --- CRITICAL CHANGE: ALLOW DUPLICATE EMAILS ---
        // We no longer check for duplicate emails in parent_users
        // Email might be used in assessments/enrollment, but that's OK
        
        console.log("✅ Allowing sign-up (email may be used elsewhere, that's OK)");
        
        // --- CREATE FIREBASE AUTH ACCOUNT ---
        console.log("🔥 Creating Firebase auth account...");
        let userCredential;
        
        try {
            userCredential = await auth.createUserWithEmailAndPassword(email, password);
        } catch (authError) {
            // If email already exists in auth, try to sign in instead
            if (authError.code === 'auth/email-already-in-use') {
                console.log("⚠️ Email already in Firebase auth, attempting sign in...");
                userCredential = await auth.signInWithEmailAndPassword(email, password);
                console.log("✅ Signed into existing Firebase auth account");
            } else {
                throw authError;
            }
        }
        
        const user = userCredential.user;
        console.log("✅ Firebase auth account created/signed in:", user.uid);
        
        // --- UPDATE/STORE USER DATA IN FIRESTORE ---
        console.log("💾 Storing user data in Firestore...");
        
        const parentData = {
            parentName: '', // Will be filled later when we find children
            email: email,
            phone: normalizedPhone.normalized,
            normalizedPhone: normalizedPhone.normalized,
            countryCode: countryCode,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // If existing account found (by phone), update it instead of creating new
        if (existingAccount) {
            console.log("🔄 Updating existing parent account...");
            await db.collection('parent_users').doc(existingAccount.id).update({
                ...parentData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("✅ Updated existing parent account:", existingAccount.id);
        } else {
            // Create new parent document
            console.log("🆕 Creating new parent account...");
            
            // Generate referral code for new accounts only
            const referralCode = await generateReferralCode();
            parentData.referralCode = referralCode;
            parentData.referralEarnings = 0;
            
            await db.collection('parent_users').doc(user.uid).set(parentData);
            console.log("✅ Created new parent account with referral code:", referralCode);
        }
        
        // --- FIND AND LINK STUDENTS ---
        console.log("🔍 Finding students for this parent...");
        
        // Search for students with ALL phone variations
        const foundStudents = [];
        const phoneVariationsForSearch = generateAllPhoneVariations(normalizedPhone.normalized);
        
        console.log("🔍 Searching for students with", phoneVariationsForSearch.length, "phone variations");
        
        for (const phoneVar of phoneVariationsForSearch) {
            try {
                // Search in students collection
                const studentsSnapshot = await db.collection('students')
                    .where('parentPhone', '==', phoneVar)
                    .get();
                
                if (!studentsSnapshot.empty) {
                    studentsSnapshot.forEach(doc => {
                        const student = doc.data();
                        foundStudents.push({
                            id: doc.id,
                            name: safeText(student.studentName || student.name),
                            phoneUsed: phoneVar,
                            source: 'students'
                        });
                    });
                }
                
                // Search in pending_students collection
                const pendingSnapshot = await db.collection('pending_students')
                    .where('parentPhone', '==', phoneVar)
                    .get();
                
                if (!pendingSnapshot.empty) {
                    pendingSnapshot.forEach(doc => {
                        const student = doc.data();
                        foundStudents.push({
                            id: doc.id,
                            name: safeText(student.studentName || student.name),
                            phoneUsed: phoneVar,
                            source: 'pending_students'
                        });
                    });
                }
            } catch (error) {
                console.warn(`Error searching students with phone ${phoneVar}:`, error.message);
            }
        }
        
        console.log("👥 Found students:", foundStudents.length);
        
        if (foundStudents.length > 0) {
            // Update parent name from first student (if available)
            const firstStudent = foundStudents[0];
            const studentDoc = await db.collection(firstStudent.source).doc(firstStudent.id).get();
            const studentData = studentDoc.data();
            
            if (studentData && studentData.parentName) {
                const updateData = {
                    parentName: safeText(studentData.parentName),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('parent_users').doc(user.uid).update(updateData);
                console.log("✅ Updated parent name from student:", studentData.parentName);
            }
            
            showMessage(`Account created successfully! Found ${foundStudents.length} student(s) linked to your account.`, 'success');
        } else {
            showMessage('Account created successfully! No students found yet. Please contact administration to link your children.', 'success');
        }
        
        // Success - auth state listener will handle the rest
        console.log("✅ Sign-up process completed successfully");

    } catch (error) {
        console.error('Sign up error:', error);
        
        let errorMessage = 'Sign up failed. ';
        
        // User-friendly error messages
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered. Please sign in instead.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled. Please contact support.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your connection.';
                break;
            default:
                if (error.message.includes('phone')) {
                    errorMessage = error.message;
                } else {
                    errorMessage += error.message || 'Please try again.';
                }
        }
        
        showMessage(errorMessage, 'error');
        
        // Reset button state
        signUpBtn.disabled = false;
        document.getElementById('signUpText').textContent = 'Sign Up';
        document.getElementById('signUpSpinner').classList.add('hidden');
        authLoader.classList.add('hidden');
    }
}

/**
 * ENHANCED PASSWORD RESET: Works even if email was used elsewhere
 */
async function handlePasswordReset() {
    const email = document.getElementById('resetEmail')?.value.trim().toLowerCase();
    
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }

    const sendResetBtn = document.getElementById('sendResetBtn');
    const resetLoader = document.getElementById('resetLoader');

    sendResetBtn.disabled = true;
    resetLoader.classList.remove('hidden');

    try {
        console.log("🔍 Sending password reset to:", email);
        
        // Check if email exists in ANY parent account
        const parentSnapshot = await db.collection('parent_users')
            .where('email', '==', email)
            .limit(1)
            .get();
        
        if (parentSnapshot.empty) {
            // Email might not be in parent_users but could be in Firebase Auth
            console.log("⚠️ Email not found in parent_users, but trying Firebase Auth reset anyway...");
        }
        
        // Send password reset email (Firebase will handle if email exists in auth)
        await auth.sendPasswordResetEmail(email);
        
        showMessage('Password reset email sent! Check your inbox (and spam folder).', 'success');
        hidePasswordResetModal();
        
    } catch (error) {
        console.error('Password reset error:', error);
        
        // Still show success message (for security, don't reveal if email exists)
        showMessage('If an account exists with this email, a reset link has been sent.', 'success');
        hidePasswordResetModal();
    } finally {
        sendResetBtn.disabled = false;
        resetLoader.classList.add('hidden');
    }
}

/**
 * HELPER: Find parent name from students (for welcome message)
 */
async function findParentNameFromStudents(parentPhone) {
    try {
        const phoneVariations = generateAllPhoneVariations(parentPhone);
        
        for (const phoneVar of phoneVariations) {
            // Search students collection
            const studentsSnapshot = await db.collection('students')
                .where('parentPhone', '==', phoneVar)
                .limit(1)
                .get();
            
            if (!studentsSnapshot.empty) {
                const studentData = studentsSnapshot.docs[0].data();
                if (studentData.parentName) {
                    return safeText(studentData.parentName);
                }
            }
            
            // Search pending_students collection
            const pendingSnapshot = await db.collection('pending_students')
                .where('parentPhone', '==', phoneVar)
                .limit(1)
                .get();
            
            if (!pendingSnapshot.empty) {
                const studentData = pendingSnapshot.docs[0].data();
                if (studentData.parentName) {
                    return safeText(studentData.parentName);
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error finding parent name:', error);
        return null;
    }
}

// ============================================================================
// SECTION 7: ENHANCED MESSAGING SYSTEM
// ============================================================================

function showComposeMessageModal() {
    populateStudentDropdownForMessages();
    document.getElementById('composeMessageModal').classList.remove('hidden');
}

function hideComposeMessageModal() {
    document.getElementById('composeMessageModal').classList.add('hidden');
    // Reset form
    document.getElementById('messageRecipient').value = 'tutor';
    document.getElementById('messageSubject').value = '';
    document.getElementById('messageStudent').value = '';
    document.getElementById('messageContent').value = '';
    document.getElementById('messageUrgent').checked = false;
}

function populateStudentDropdownForMessages() {
    const studentDropdown = document.getElementById('messageStudent');
    if (!studentDropdown) return;
    
    studentDropdown.innerHTML = '<option value="">Select student (optional)</option>';
    
    // Get student names from the userChildren array
    if (userChildren.length === 0) {
        studentDropdown.innerHTML += '<option value="" disabled>No students found</option>';
        return;
    }

    userChildren.forEach(studentName => {
        const option = document.createElement('option');
        option.value = safeText(studentName);
        option.textContent = capitalize(studentName);
        studentDropdown.appendChild(option);
    });
}

async function submitMessage() {
    const recipient = document.getElementById('messageRecipient')?.value;
    const subject = document.getElementById('messageSubject')?.value.trim();
    const student = document.getElementById('messageStudent')?.value;
    const content = document.getElementById('messageContent')?.value.trim();
    const isUrgent = document.getElementById('messageUrgent')?.checked;

    // Validation
    if (!recipient || !subject || !content) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    if (content.length < 10) {
        showMessage('Please provide a more detailed message (at least 10 characters)', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitMessageBtn');
    submitBtn.disabled = true;
    document.getElementById('submitMessageText').textContent = 'Sending...';
    document.getElementById('submitMessageSpinner').classList.remove('hidden');

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to send messages');
        }

        // Get user data
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        // Determine recipients based on selection
        let recipients = [];
        if (recipient === 'tutor') {
            recipients = ['tutors'];
        } else if (recipient === 'management') {
            recipients = ['management'];
        } else if (recipient === 'both') {
            recipients = ['tutors', 'management'];
        }

        // Sanitize all inputs
        const sanitizedStudent = student ? safeText(student) : 'General';
        const sanitizedSubject = safeText(subject);
        const sanitizedContent = safeText(content);

        // Create message document in tutor_messages collection
        const messageData = {
            parentName: currentUserData?.parentName || safeText(userData.parentName) || 'Unknown Parent',
            parentPhone: userData.phone,
            parentEmail: userData.email,
            parentUid: user.uid,
            studentName: sanitizedStudent,
            recipients: recipients,
            subject: sanitizedSubject,
            content: sanitizedContent,
            isUrgent: isUrgent,
            status: 'sent',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'parent_to_staff',
            readBy: []
        };

        // Save to Firestore
        await db.collection('tutor_messages').add(messageData);

        showMessage('Message sent successfully! Our team will respond within 24-48 hours.', 'success');
        
        // Close modal and reset form
        hideComposeMessageModal();

    } catch (error) {
        console.error('Message submission error:', error);
        showMessage('Failed to send message. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('submitMessageText').textContent = 'Send Message';
        document.getElementById('submitMessageSpinner').classList.add('hidden');
    }
}

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

async function loadAcademicsData(selectedStudent = null) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;
    
    academicsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading academic data...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to view academic data');
        }

        // Get user data to find phone
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        const parentPhone = userData.normalizedPhone || userData.phone;

        // Find student IDs for this parent - INCLUDES ALL STUDENTS
        const { studentIds, studentNameIdMap, allStudentData } = await findStudentIdsForParent(parentPhone);
        
        if (studentIds.length === 0) {
            academicsContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📚</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
                    <p class="text-gray-500 max-w-md mx-auto">No students are currently assigned to your account. Please contact administration if you believe this is an error.</p>
                </div>
            `;
            return;
        }

        // Determine which student to show
        let studentsToShow = [];
        if (selectedStudent && studentNameIdMap.has(selectedStudent)) {
            studentsToShow = [selectedStudent];
        } else {
            studentsToShow = Array.from(studentNameIdMap.keys());
        }

        let academicsHtml = '';
        let totalUnreadCount = 0;

        // Create student selector if multiple students
        if (studentNameIdMap.size > 1) {
            academicsHtml += `
                <div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm slide-down">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
                    <select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200" onchange="onStudentSelected(this.value)">
                        <option value="">All Students</option>
            `;
            
            Array.from(studentNameIdMap.keys()).forEach(studentName => {
                const isSelected = selectedStudent === studentName ? 'selected' : '';
                const studentStatus = allStudentData.find(s => s.name === studentName)?.isPending ? ' (Pending Registration)' : '';
                const studentNotifications = academicsNotifications.get(studentName) || { sessionTopics: 0, homework: 0 };
                const studentUnread = studentNotifications.sessionTopics + studentNotifications.homework;
                const badge = studentUnread > 0 ? `<span class="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 notification-pulse">${studentUnread}</span>` : '';
                
                academicsHtml += `<option value="${safeText(studentName)}" ${isSelected}>${capitalize(studentName)}${safeText(studentStatus)} ${badge}</option>`;
            });
            
            academicsHtml += `
                    </select>
                </div>
            `;
        }

        // Load data for each student
        for (const studentName of studentsToShow) {
            const studentId = studentNameIdMap.get(studentName);
            const studentData = allStudentData.find(s => s.name === studentName);
            
            if (!studentId) continue;

            // Get notification counts for this student
            const studentNotifications = academicsNotifications.get(studentName) || { sessionTopics: 0, homework: 0 };
            const studentUnread = studentNotifications.sessionTopics + studentNotifications.homework;
            totalUnreadCount += studentUnread;
            
            const notificationBadge = studentUnread > 0 ? 
                `<span class="ml-3 bg-red-500 text-white text-xs font-bold rounded-full px-3 py-1 animate-pulse">${studentUnread} NEW</span>` : '';

            const studentHeader = `
                <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6 slide-down" id="academics-student-${safeText(studentName)}">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}${studentData?.isPending ? ' <span class="text-yellow-600 text-sm">(Pending Registration)</span>' : ''}</h2>
                            <p class="text-green-600">Academic progress and assignments</p>
                        </div>
                        ${notificationBadge}
                    </div>
                </div>
            `;

            academicsHtml += studentHeader;

            // Student Information Section
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
                                <p class="font-medium">${studentData?.isPending ? 'Pending Registration' : 'Active'}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Assigned Tutor</p>
                                <p class="font-medium">${safeText(studentData?.data?.tutorName || 'Not yet assigned')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Get month display logic based on 2nd Day Rule
            const monthLogic = getMonthDisplayLogic();
            const currentMonth = getCurrentMonthYear();
            const previousMonth = getPreviousMonthYear();

            // Session Topics Section with Nested Accordion (was Daily Topics)
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
                            ${studentNotifications.sessionTopics > 0 ? `<span class="mr-3 bg-red-500 text-white text-xs rounded-full px-2 py-1">${studentNotifications.sessionTopics} new</span>` : ''}
                            <span id="session-topics-${safeText(studentName)}-arrow" class="accordion-arrow text-blue-600 text-xl">▼</span>
                        </div>
                    </button>
                    <div id="session-topics-${safeText(studentName)}-content" class="accordion-content hidden">
            `;

            try {
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
                            // Ensure we have a proper timestamp
                            timestamp: getTimestamp(topicData.date || topicData.createdAt || topicData.timestamp)
                        });
                    });
                    
                    // Sort manually by date ASCENDING (earliest first) for better readability
                    topics.sort((a, b) => {
                        return a.timestamp - b.timestamp;
                    });
                    
                    // Filter topics based on month display logic - CLIENT SIDE
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

            // Homework Assignments Section with Nested Accordion
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
                        <div class="flex items-center">
                            ${studentNotifications.homework > 0 ? `<span class="mr-3 bg-red-500 text-white text-xs rounded-full px-2 py-1">${studentNotifications.homework} new</span>` : ''}
                            <span id="homework-${safeText(studentName)}-arrow" class="accordion-arrow text-purple-600 text-xl">▼</span>
                        </div>
                    </button>
                    <div id="homework-${safeText(studentName)}-content" class="accordion-content hidden">
            `;

            try {
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
                            // Ensure we have proper timestamps
                            assignedTimestamp: getTimestamp(homework.assignedDate || homework.createdAt || homework.timestamp),
                            dueTimestamp: getTimestamp(homework.dueDate)
                        });
                    });
                    
                    const now = new Date().getTime();
                    
                    // Sort manually by due date ASCENDING (earliest due date first)
                    homeworkList.sort((a, b) => {
                        return a.dueTimestamp - b.dueTimestamp;
                    });
                    
                    // Filter homework based on month display logic - CLIENT SIDE
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
        
        // Update academics tab badge with proper styling
        updateAcademicsTabBadge(totalUnreadCount);

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

        // Find student IDs for this parent
        const { studentNameIdMap } = await findStudentIdsForParent(parentPhone);
        
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
// SECTION 9: UNIFIED MESSAGING INBOX
// ============================================================================

function showMessagesModal() {
    document.getElementById('messagesModal').classList.remove('hidden');
    loadUnifiedMessages();
    // Reset notification count when user views messages
    resetNotificationCount();
}

function hideMessagesModal() {
    document.getElementById('messagesModal').classList.add('hidden');
}

async function loadUnifiedMessages() {
    const messagesContent = document.getElementById('messagesContent');
    if (!messagesContent) return;
    
    messagesContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading messages...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to view messages');
        }

        // Get user data
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        // SIMPLIFIED QUERY: Get all messages and filter client-side
        const tutorMessagesSnapshot = await db.collection('tutor_messages')
            .where('parentUid', '==', user.uid)
            .get();

        // SIMPLIFIED QUERY: Get all feedback and filter client-side
        const feedbackSnapshot = await db.collection('parent_feedback')
            .where('parentUid', '==', user.uid)
            .get();

        const allMessages = [];

        // Process tutor messages
        tutorMessagesSnapshot.forEach(doc => {
            const message = doc.data();
            allMessages.push({
                id: doc.id,
                type: 'tutor_message',
                sender: safeText(message.parentName || 'Tutor/Admin'),
                senderRole: message.type === 'parent_to_staff' ? 'You' : 'Staff',
                subject: safeText(message.subject),
                content: message.type === 'parent_to_staff' ? `You wrote: ${safeText(message.content)}` : safeText(message.content),
                studentName: safeText(message.studentName),
                isUrgent: message.isUrgent || false,
                timestamp: message.timestamp,
                status: message.status || 'sent',
                isOutgoing: message.type === 'parent_to_staff'
            });
        });

        // Process feedback responses - filter client-side for responses
        feedbackSnapshot.forEach(doc => {
            const feedback = doc.data();
            if (feedback.responses && Array.isArray(feedback.responses) && feedback.responses.length > 0) {
                feedback.responses.forEach((response, index) => {
                    allMessages.push({
                        id: `${doc.id}_response_${index}`,
                        type: 'feedback_response',
                        sender: safeText(response.responderName || 'Admin'),
                        senderRole: 'Admin',
                        subject: `Re: ${safeText(feedback.category)} - ${safeText(feedback.studentName)}`,
                        content: safeText(response.responseText),
                        studentName: safeText(feedback.studentName),
                        isUrgent: feedback.priority === 'Urgent' || feedback.priority === 'High',
                        timestamp: response.responseDate || feedback.timestamp,
                        originalMessage: safeText(feedback.message)
                    });
                });
            }
        });

        // Sort all messages by timestamp (newest first) - client-side sorting
        allMessages.sort((a, b) => {
            const aDate = a.timestamp?.toDate?.() || new Date(0);
            const bDate = b.timestamp?.toDate?.() || new Date(0);
            return bDate - aDate;
        });

        if (allMessages.length === 0) {
            messagesContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📭</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Messages Yet</h3>
                    <p class="text-gray-500 max-w-md mx-auto">You haven't received any messages from our staff yet. Send a message using the "Compose" button!</p>
                    <button onclick="showComposeMessageModal()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200">
                        Compose Message
                    </button>
                </div>
            `;
            return;
        }

        messagesContent.innerHTML = '';

        allMessages.forEach((message) => {
            const messageDate = message.timestamp?.toDate?.() || new Date();
            const formattedDate = formatDetailedDate(messageDate, true);

            const urgentBadge = message.isUrgent ? 
                '<span class="inline-block ml-2 px-2 py-1 text-xs font-bold bg-red-100 text-red-800 rounded-full animate-pulse">URGENT</span>' : '';

            const outgoingIndicator = message.isOutgoing ? 
                '<span class="inline-block ml-2 px-2 py-1 text-xs font-bold bg-blue-100 text-blue-800 rounded-full">OUTGOING</span>' : '';

            const studentInfo = message.studentName && message.studentName !== 'General' ? 
                `<span class="text-sm text-gray-600">Regarding: ${message.studentName}</span>` : '';

            const messageTypeIcon = message.type === 'tutor_message' ? '📨' : '💬';

            const messageElement = document.createElement('div');
            messageElement.className = `bg-white border ${message.isUrgent ? 'border-red-300' : 'border-gray-200'} rounded-xl p-6 mb-4 hover:shadow-md transition-shadow duration-200 fade-in`;
            messageElement.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <div class="flex items-center">
                            <span class="text-xl mr-2">${messageTypeIcon}</span>
                            <h4 class="font-bold text-gray-800 text-lg">${message.subject}</h4>
                            ${urgentBadge}
                            ${outgoingIndicator}
                        </div>
                        <div class="flex items-center mt-1">
                            <span class="text-sm text-gray-700">
                                From: <span class="font-semibold">${message.sender}</span> (${message.senderRole})
                            </span>
                            ${studentInfo ? `<span class="mx-2">•</span>${studentInfo}` : ''}
                        </div>
                    </div>
                    <span class="text-sm text-gray-500">${safeText(formattedDate)}</span>
                </div>
                
                ${message.originalMessage ? `
                <div class="mb-4">
                    <p class="text-gray-600 text-sm mb-1">Your original message:</p>
                    <p class="text-gray-700 bg-gray-50 p-4 rounded-lg border text-sm">${message.originalMessage}</p>
                </div>
                ` : ''}
                
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p class="text-gray-700 leading-relaxed">${message.content}</p>
                </div>
            `;

            messagesContent.appendChild(messageElement);
        });

    } catch (error) {
        console.error('Error loading messages:', error);
        messagesContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Messages</h3>
                <p class="text-gray-500">Unable to load messages at this time. Please try again later.</p>
                <button onclick="loadUnifiedMessages()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    Try Again
                </button>
            </div>
        `;
    }
}

// ============================================================================
// SECTION 10: NOTIFICATION SYSTEM WITHOUT COMPLEX QUERIES
// ============================================================================

async function checkForNewMessages() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        let totalUnread = 0;
        
        // SIMPLIFIED QUERY: Get all messages and filter client-side
        const tutorMessagesSnapshot = await db.collection('tutor_messages')
            .where('parentUid', '==', user.uid)
            .get();
        
        // Filter client-side for incoming messages only
        tutorMessagesSnapshot.forEach(doc => {
            const message = doc.data();
            if (message.type !== 'parent_to_staff') {
                totalUnread++;
            }
        });
        
        // Check feedback responses
        const feedbackSnapshot = await db.collection('parent_feedback')
            .where('parentUid', '==', user.uid)
            .get();

        feedbackSnapshot.forEach(doc => {
            const feedback = doc.data();
            if (feedback.responses && Array.isArray(feedback.responses) && feedback.responses.length > 0) {
                totalUnread += feedback.responses.length;
            }
        });

        // Update notification badge
        updateNotificationBadge(totalUnread > 0 ? totalUnread : 0);
        
        // Store for later use
        unreadMessagesCount = totalUnread;

    } catch (error) {
        console.error('Error checking for new messages:', error);
        // Silently fail - don't show error to user for background check
    }
}

function updateNotificationBadge(count) {
    let badge = document.getElementById('messagesNotificationBadge');
    const viewMessagesBtn = document.getElementById('viewMessagesBtn');
    
    if (!viewMessagesBtn) return;
    
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'messagesNotificationBadge';
        badge.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-6 h-6 flex items-center justify-center font-bold animate-pulse';
        viewMessagesBtn.style.position = 'relative';
        viewMessagesBtn.appendChild(badge);
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
    unreadMessagesCount = 0;
}

// ============================================================================
// SECTION 11: NAVIGATION BUTTONS & DYNAMIC UI
// ============================================================================

// Add Messages button to the welcome section with notification badge
function addMessagesButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    // Check if button already exists
    if (document.getElementById('viewMessagesBtn')) return;
    
    const viewMessagesBtn = document.createElement('button');
    viewMessagesBtn.id = 'viewMessagesBtn';
    viewMessagesBtn.onclick = showMessagesModal;
    viewMessagesBtn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 btn-glow flex items-center justify-center relative';
    viewMessagesBtn.innerHTML = '<span class="mr-2">📨</span> Messages';
    
    // Insert before the logout button
    const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        buttonContainer.insertBefore(viewMessagesBtn, logoutBtn);
    } else {
        buttonContainer.appendChild(viewMessagesBtn);
    }
    
    // Add Compose button
    const composeBtn = document.createElement('button');
    composeBtn.id = 'composeMessageBtn';
    composeBtn.onclick = showComposeMessageModal;
    composeBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
    composeBtn.innerHTML = '<span class="mr-2">✏️</span> Compose';
    
    buttonContainer.insertBefore(composeBtn, viewMessagesBtn);
    
    // Check for messages to show notification
    setTimeout(() => {
        checkForNewMessages();
        checkForNewAcademics();
    }, 1000);
}

// MANUAL REFRESH FUNCTION
async function manualRefreshReports() {
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
            
            // Force reload reports
            await loadAllReportsForParent(userPhone, user.uid, true);
            
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
    refreshBtn.onclick = manualRefreshReports;
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
        
        // Search in ALL possible collections - EXPANDED LIST
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
            'performance_reports',
            'session_notes',
            'class_notes',
            'learning_reports',
            'evaluation_reports',
            'test_results',
            'exam_results',
            'quiz_results',
            'lesson_reports',
            'attendance_reports',
            'behavior_reports'
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
                        if (error.code !== 'failed-precondition' && error.code !== 'invalid-argument') {
                            console.warn(`Search error in ${collectionName}:`, error.message);
                        }
                        return [];
                    })
                );
            }
        }
        
        // Wait for all searches to complete
        const allResultsArrays = await Promise.all(searchPromises);
        
        // Combine all results
        allResults = allResultsArrays.flat();
        
        console.log("🎯 TOTAL REPORTS FOUND (standard search):", allResults.length);
        console.log("📊 Sources found:", Array.from(foundSources));
        
        // --- EMERGENCY SEARCH: If NO reports found ---
        if (allResults.length === 0) {
            console.warn("⚠️ No reports found with standard search. Starting EMERGENCY SEARCH...");
            const emergencyResults = await emergencyReportSearch(parentPhone, parentEmail);
            allResults = emergencyResults;
            console.log("🚨 EMERGENCY SEARCH found:", emergencyResults.length, "reports");
        }
        
        // --- SUPER EMERGENCY: Search by student names if we know them ---
        if (allResults.length === 0 && userChildren.length > 0) {
            console.warn("🚨🚨 SUPER EMERGENCY: Searching by student names...");
            const studentNameResults = await searchByStudentNames();
            allResults = studentNameResults;
            console.log("👤 STUDENT NAME SEARCH found:", studentNameResults.length, "reports");
        }
        
        // Remove duplicates
        const uniqueResults = [];
        const seenIds = new Set();
        
        allResults.forEach(result => {
            // Create unique key from multiple fields
            const uniqueKey = `${result.collection}_${result.id}_${result.studentName || ''}_${result.timestamp}_${result.createdAt || ''}_${result.date || ''}`;
            if (!seenIds.has(uniqueKey)) {
                seenIds.add(uniqueKey);
                uniqueResults.push(result);
            }
        });
        
        console.log("🎯 FINAL UNIQUE REPORTS:", uniqueResults.length);
        
        // Separate into assessment and monthly
        const assessmentResults = uniqueResults.filter(r => 
            r.type === 'assessment' || 
            r.collection.includes('assessment') || 
            r.collection.includes('progress') ||
            r.collection.includes('result') ||
            r.collection.includes('test') ||
            r.collection.includes('exam') ||
            r.collection.includes('quiz') ||
            (r.reportType && r.reportType.toLowerCase().includes('assessment')) ||
            (r.category && r.category.toLowerCase().includes('assessment')) ||
            (r.testType && r.testType.toLowerCase().includes('assessment'))
        );
        
        const monthlyResults = uniqueResults.filter(r => 
            r.type === 'monthly' || 
            r.collection.includes('monthly') ||
            r.collection.includes('submission') ||
            r.collection.includes('report') ||
            r.collection.includes('note') ||
            (r.reportType && r.reportType.toLowerCase().includes('monthly')) ||
            (r.category && r.category.toLowerCase().includes('progress')) ||
            (r.reportType && r.reportType.toLowerCase().includes('progress'))
        );
        
        // Sort by date (newest first)
        assessmentResults.sort((a, b) => b.timestamp - a.timestamp);
        monthlyResults.sort((a, b) => b.timestamp - a.timestamp);
        
        return { 
            assessmentResults, 
            monthlyResults, 
            searchStats: {
                totalFound: uniqueResults.length,
                assessmentCount: assessmentResults.length,
                monthlyCount: monthlyResults.length,
                sources: Array.from(foundSources),
                collectionsSearched: collectionsToSearch.length,
                queryCount: searchQueries.length,
                studentCount: userChildren.length,
                timestamp: Date.now()
            }
        };
        
    } catch (error) {
        console.error("❌ Ultimate search error:", error);
        return { 
            assessmentResults: [], 
            monthlyResults: [], 
            searchStats: { 
                error: error.message,
                timestamp: Date.now(),
                studentCount: userChildren.length
            }
        };
    }
}

/**
 * SUPER EMERGENCY: Search by student names
 */
async function searchByStudentNames() {
    const results = [];
    
    if (userChildren.length === 0) return results;
    
    try {
        const collectionsToSearch = [
            'tutor_submissions',
            'student_results',
            'monthly_reports',
            'assessment_reports',
            'progress_reports',
            'reports'
        ];
        
        for (const studentName of userChildren) {
            console.log(`🔍 Searching for reports for student: ${studentName}`);
            
            for (const collection of collectionsToSearch) {
                try {
                    // Method 1: Exact match
                    const exactSnapshot = await db.collection(collection)
                        .where('studentName', '==', studentName)
                        .get();
                    
                    exactSnapshot.forEach(doc => {
                        const data = doc.data();
                        results.push({
                            id: doc.id,
                            collection: collection,
                            emergencyMatch: 'student_name_exact',
                            matchedField: 'studentName',
                            matchedValue: studentName,
                            ...data,
                            timestamp: getTimestampFromData(data),
                            type: determineReportType(collection, data)
                        });
                    });
                    
                    // Method 2: Partial match (case-insensitive)
                    const partialSnapshot = await db.collection(collection)
                        .where('studentName', '>=', studentName.toLowerCase())
                        .where('studentName', '<=', studentName.toLowerCase() + '\uf8ff')
                        .get();
                    
                    partialSnapshot.forEach(doc => {
                        const data = doc.data();
                        const docStudentName = safeText(data.studentName || data.student || '');
                        
                        // Check if it's actually a match (avoid false positives)
                        if (docStudentName.toLowerCase().includes(studentName.toLowerCase())) {
                            // Check if we already have this result
                            const exists = results.some(r => 
                                r.id === doc.id && 
                                r.collection === collection
                            );
                            
                            if (!exists) {
                                results.push({
                                    id: doc.id,
                                    collection: collection,
                                    emergencyMatch: 'student_name_partial',
                                    matchedField: 'studentName',
                                    matchedValue: studentName,
                                    ...data,
                                    timestamp: getTimestampFromData(data),
                                    type: determineReportType(collection, data)
                                });
                            }
                        }
                    });
                    
                } catch (error) {
                    console.warn(`Error searching ${collection} for ${studentName}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.error("Student name search error:", error);
    }
    
    return results;
}

// Generate ALL possible search queries
async function generateAllSearchQueries(parentPhone, parentEmail, parentUid) {
    const queries = [];
    
    // Phone variations - USING ENHANCED FUNCTION
    const phoneVariations = generateAllPhoneVariations(parentPhone);
    console.log(`📱 Generated ${phoneVariations.length} phone variations for search`);
    
    // --- PHONE QUERIES ---
    for (const phone of phoneVariations) {
        // All possible phone field names
        const phoneFields = [
            'parentPhone', 'parentphone', 'parent_phone', 'phone', 
            'guardianPhone', 'motherPhone', 'fatherPhone', 'contactPhone',
            'parent_contact', 'contact_number', 'mobile', 'mobilePhone',
            'telephone', 'tel', 'phoneNumber', 'phonenumber',
            'parentPhoneNumber', 'guardianPhoneNumber', 'contactPhoneNumber'
        ];
        
        phoneFields.forEach(field => {
            queries.push({ field: field, value: phone });
        });
    }
    
    // --- EMAIL QUERIES ---
    if (parentEmail) {
        const emailVariations = [
            parentEmail.toLowerCase(),
            parentEmail.toUpperCase(),
            parentEmail.trim()
        ];
        
        const emailFields = [
            'parentEmail', 'parentemail', 'email', 'guardianEmail',
            'parent_email', 'contact_email', 'emailAddress', 'email_address',
            'parentEmailAddress', 'guardianEmailAddress'
        ];
        
        for (const email of emailVariations) {
            emailFields.forEach(field => {
                queries.push({ field: field, value: email });
            });
        }
    }
    
    // --- UID QUERIES ---
    if (parentUid) {
        const uidFields = [
            'parentUid', 'parentuid', 'userId', 'user_id', 
            'createdBy', 'ownerUid', 'uid', 'userUid',
            'createdById', 'ownerId', 'parentId', 'guardianId'
        ];
        
        uidFields.forEach(field => {
            queries.push({ field: field, value: parentUid });
        });
    }
    
    // --- STUDENT ID QUERIES ---
    try {
        // Find students by parent phone - CHECK ALL PHONE VARIATIONS
        const foundStudents = [];
        
        for (const phoneVar of phoneVariations) {
            try {
                // Search in students collection
                const studentsSnapshot = await db.collection('students')
                    .where('parentPhone', '==', phoneVar)
                    .get();
                
                if (!studentsSnapshot.empty) {
                    studentsSnapshot.forEach(doc => {
                        const studentId = doc.id;
                        const studentData = doc.data();
                        
                        foundStudents.push({
                            id: studentId,
                            name: safeText(studentData.studentName || studentData.name || ''),
                            data: studentData
                        });
                    });
                }
                
                // Search in pending_students collection
                const pendingSnapshot = await db.collection('pending_students')
                    .where('parentPhone', '==', phoneVar)
                    .get();
                
                if (!pendingSnapshot.empty) {
                    pendingSnapshot.forEach(doc => {
                        const studentId = doc.id;
                        const studentData = doc.data();
                        
                        foundStudents.push({
                            id: studentId,
                            name: safeText(studentData.studentName || studentData.name || ''),
                            data: studentData,
                            isPending: true
                        });
                    });
                }
            } catch (error) {
                console.warn(`Error searching students with phone ${phoneVar}:`, error.message);
            }
        }
        
        // Add student ID queries for each found student
        foundStudents.forEach(student => {
            const studentIdFields = [
                'studentId', 'studentID', 'student_id', 'studentUid',
                'learnerId', 'learner_id', 'childId', 'child_id'
            ];
            
            studentIdFields.forEach(field => {
                queries.push({ field: field, value: student.id });
                queries.push({ field: field, value: student.id.toLowerCase() });
                queries.push({ field: field, value: student.id.toUpperCase() });
            });
            
            // Add student name queries
            if (student.name && student.name !== 'Unknown') {
                const studentNameFields = [
                    'studentName', 'student_name', 'student', 'learnerName',
                    'learner_name', 'childName', 'child_name', 'name'
                ];
                
                studentNameFields.forEach(field => {
                    queries.push({ field: field, value: student.name });
                    queries.push({ field: field, value: student.name.toLowerCase() });
                    queries.push({ field: field, value: student.name.toUpperCase() });
                });
            }
        });
        
        console.log(`👥 Found ${foundStudents.length} students for query generation`);
        
    } catch (error) {
        console.warn("Could not find students for search queries:", error);
    }
    
    console.log(`🔍 Total search queries generated: ${queries.length}`);
    
    // Remove duplicates (same field and value)
    const uniqueQueries = [];
    const seenQueries = new Set();
    
    queries.forEach(query => {
        const key = `${query.field}:${query.value}`;
        if (!seenQueries.has(key)) {
            seenQueries.add(key);
            uniqueQueries.push(query);
        }
    });
    
    console.log(`🔍 Unique search queries: ${uniqueQueries.length}`);
    
    return uniqueQueries;
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
                type: determineReportType(collectionName, data),
                searchDate: Date.now()
            });
        });
        
        return results;
    } catch (error) {
        // Collection or field doesn't exist - that's OK
        if (error.code !== 'failed-precondition' && error.code !== 'invalid-argument') {
            console.warn(`Search error in ${collectionName} for ${query.field}=${query.value}:`, error.message);
        }
        return [];
    }
}

// EMERGENCY SEARCH - Last resort (scans entire collections)
async function emergencyReportSearch(parentPhone, parentEmail) {
    console.log("🚨 EMERGENCY SEARCH ACTIVATED");
    const results = [];
    
    try {
        const phoneVariations = generateAllPhoneVariations(parentPhone);
        console.log(`📱 Using ${phoneVariations.length} phone variations for emergency search`);
        
        // Collections to scan in emergency mode
        const emergencyCollections = [
            'tutor_submissions',
            'student_results',
            'monthly_reports',
            'assessment_reports'
        ];
        
        // Scan each collection
        for (const collectionName of emergencyCollections) {
            try {
                console.log(`🔍 Emergency scanning ${collectionName}...`);
                const allDocs = await db.collection(collectionName).limit(2000).get();
                
                console.log(`📄 Scanning ${allDocs.size} documents in ${collectionName}`);
                
                allDocs.forEach(doc => {
                    const data = doc.data();
                    let matched = false;
                    
                    // --- CHECK PHONE ---
                    const phoneFields = [
                        'parentPhone', 'parentphone', 'parent_phone', 'phone',
                        'guardianPhone', 'contactPhone', 'mobile', 'telephone'
                    ];
                    
                    for (const field of phoneFields) {
                        if (data[field]) {
                            const fieldValue = String(data[field]).trim();
                            
                            // Check against ALL phone variations
                            for (const phoneVar of phoneVariations) {
                                // Exact match
                                if (fieldValue === phoneVar) {
                                    results.push({
                                        id: doc.id,
                                        collection: collectionName,
                                        emergencyMatch: 'phone_exact',
                                        matchedField: field,
                                        matchedValue: fieldValue,
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: determineReportType(collectionName, data)
                                    });
                                    matched = true;
                                    break;
                                }
                                
                                // Contains match (partial)
                                if (fieldValue.includes(phoneVar) || phoneVar.includes(fieldValue)) {
                                    results.push({
                                        id: doc.id,
                                        collection: collectionName,
                                        emergencyMatch: 'phone_partial',
                                        matchedField: field,
                                        matchedValue: fieldValue,
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: determineReportType(collectionName, data)
                                    });
                                    matched = true;
                                    break;
                                }
                                
                                // Digit-only comparison
                                const fieldDigits = fieldValue.replace(/\D/g, '');
                                const phoneVarDigits = phoneVar.replace(/\D/g, '');
                                
                                if (fieldDigits === phoneVarDigits && fieldDigits.length >= 7) {
                                    results.push({
                                        id: doc.id,
                                        collection: collectionName,
                                        emergencyMatch: 'phone_digits',
                                        matchedField: field,
                                        matchedValue: fieldValue,
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: determineReportType(collectionName, data)
                                    });
                                    matched = true;
                                    break;
                                }
                            }
                            if (matched) break;
                        }
                    }
                    
                    // --- CHECK EMAIL ---
                    if (!matched && parentEmail) {
                        const emailFields = ['parentEmail', 'parentemail', 'email', 'guardianEmail'];
                        
                        for (const field of emailFields) {
                            if (data[field]) {
                                const fieldValue = String(data[field]).trim().toLowerCase();
                                const searchEmail = parentEmail.toLowerCase();
                                
                                if (fieldValue === searchEmail) {
                                    results.push({
                                        id: doc.id,
                                        collection: collectionName,
                                        emergencyMatch: 'email_exact',
                                        matchedField: field,
                                        matchedValue: fieldValue,
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: determineReportType(collectionName, data)
                                    });
                                    matched = true;
                                    break;
                                }
                                
                                // Partial email match (same domain)
                                if (fieldValue.includes('@') && searchEmail.includes('@')) {
                                    const fieldDomain = fieldValue.split('@')[1];
                                    const searchDomain = searchEmail.split('@')[1];
                                    
                                    if (fieldDomain === searchDomain) {
                                        results.push({
                                            id: doc.id,
                                            collection: collectionName,
                                            emergencyMatch: 'email_domain',
                                            matchedField: field,
                                            matchedValue: fieldValue,
                                            ...data,
                                            timestamp: getTimestampFromData(data),
                                            type: determineReportType(collectionName, data)
                                        });
                                        matched = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    // --- CHECK STUDENT NAMES ---
                    if (!matched && userChildren.length > 0) {
                        const studentNameFields = ['studentName', 'student_name', 'student', 'name'];
                        const docStudentName = data.studentName || data.student || data.name || '';
                        
                        if (docStudentName) {
                            const docNameLower = safeText(docStudentName).toLowerCase();
                            
                            for (const studentName of userChildren) {
                                const searchNameLower = studentName.toLowerCase();
                                
                                // Exact match
                                if (docNameLower === searchNameLower) {
                                    results.push({
                                        id: doc.id,
                                        collection: collectionName,
                                        emergencyMatch: 'student_name_exact',
                                        matchedField: 'studentName',
                                        matchedValue: studentName,
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: determineReportType(collectionName, data)
                                    });
                                    matched = true;
                                    break;
                                }
                                
                                // Contains match
                                if (docNameLower.includes(searchNameLower) || searchNameLower.includes(docNameLower)) {
                                    results.push({
                                        id: doc.id,
                                        collection: collectionName,
                                        emergencyMatch: 'student_name_partial',
                                        matchedField: 'studentName',
                                        matchedValue: studentName,
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: determineReportType(collectionName, data)
                                    });
                                    matched = true;
                                    break;
                                }
                                
                                // First name match
                                const docFirstName = docNameLower.split(' ')[0];
                                const searchFirstName = searchNameLower.split(' ')[0];
                                
                                if (docFirstName && searchFirstName && docFirstName === searchFirstName) {
                                    results.push({
                                        id: doc.id,
                                        collection: collectionName,
                                        emergencyMatch: 'student_first_name',
                                        matchedField: 'studentName',
                                        matchedValue: studentName,
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: determineReportType(collectionName, data)
                                    });
                                    matched = true;
                                    break;
                                }
                            }
                        }
                    }
                });
                
                console.log(`✅ Emergency scan of ${collectionName} complete. Found: ${results.length} total so far`);
                
            } catch (error) {
                console.error(`Error in emergency scan of ${collectionName}:`, error);
            }
        }
        
        console.log(`🚨 EMERGENCY SEARCH COMPLETE. Found: ${results.length} reports`);
        
    } catch (error) {
        console.error("Emergency search failed:", error);
    }
    
    return results;
}

// Generate ALL possible phone variations with better global support
function generateAllPhoneVariations(phone) {
    const variations = new Set();
    
    if (!phone || typeof phone !== 'string') return [];
    
    console.log(`🔧 Generating phone variations for: "${phone}"`);
    
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
        { code: '+1', name: 'USA/Canada' },
        { code: '+234', name: 'Nigeria' },
        { code: '+44', name: 'UK' },
        { code: '+91', name: 'India' },
        { code: '+86', name: 'China' },
        { code: '+33', name: 'France' },
        { code: '+49', name: 'Germany' },
        { code: '+81', name: 'Japan' },
        { code: '+61', name: 'Australia' },
        { code: '+55', name: 'Brazil' },
        { code: '+7', name: 'Russia/Kazakhstan' },
        { code: '+20', name: 'Egypt' },
        { code: '+27', name: 'South Africa' },
        { code: '+34', name: 'Spain' },
        { code: '+39', name: 'Italy' },
        { code: '+52', name: 'Mexico' },
        { code: '+62', name: 'Indonesia' },
        { code: '+82', name: 'South Korea' },
        { code: '+90', name: 'Turkey' },
        { code: '+92', name: 'Pakistan' },
        { code: '+966', name: 'Saudi Arabia' },
        { code: '+971', name: 'UAE' },
        { code: '+233', name: 'Ghana' },
        { code: '+254', name: 'Kenya' },
        { code: '+255', name: 'Tanzania' },
        { code: '+256', name: 'Uganda' },
        { code: '+237', name: 'Cameroon' },
        { code: '+251', name: 'Ethiopia' },
        { code: '+250', name: 'Rwanda' },
        { code: '+260', name: 'Zambia' },
        { code: '+263', name: 'Zimbabwe' },
        { code: '+265', name: 'Malawi' },
        { code: '+267', name: 'Botswana' },
        { code: '+268', name: 'Eswatini' },
        { code: '+269', name: 'Comoros' },
        { code: '+41', name: 'Switzerland' },
        { code: '+351', name: 'Portugal' },
        { code: '+31', name: 'Netherlands' },
        { code: '+32', name: 'Belgium' },
        { code: '+46', name: 'Sweden' },
        { code: '+47', name: 'Norway' },
        { code: '+45', name: 'Denmark' },
        { code: '+358', name: 'Finland' },
        { code: '+353', name: 'Ireland' },
        { code: '+48', name: 'Poland' },
        { code: '+961', name: 'Lebanon' },
        { code: '+962', name: 'Jordan' },
        { code: '+60', name: 'Malaysia' },
        { code: '+852', name: 'Hong Kong' },
        { code: '+63', name: 'Philippines' },
        { code: '+65', name: 'Singapore' },
        { code: '+64', name: 'New Zealand' },
        { code: '+380', name: 'Ukraine' },
        { code: '+30', name: 'Greece' },
        { code: '+43', name: 'Austria' },
        { code: '+420', name: 'Czech Republic' },
        { code: '+36', name: 'Hungary' },
        { code: '+40', name: 'Romania' }
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
            if (pattern.code !== '+1' || localNumber.length === 10) { // Special handling for US/Canada
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
                variations.add('+1' + basicCleaned);  // USA/Canada
            } else if (basicCleaned.length === 11 && basicCleaned.startsWith('1')) {
                variations.add('+' + basicCleaned);   // USA/Canada with 1
                variations.add('+1' + basicCleaned.substring(1));
            } else if (basicCleaned.length === 11 && basicCleaned.startsWith('0')) {
                variations.add('+234' + basicCleaned.substring(1));  // Nigeria
                variations.add('+44' + basicCleaned.substring(1));   // UK
                variations.add('+91' + basicCleaned.substring(1));   // India
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
                
                // XXX-XXX-XXXX format
                const dashed = digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                if (dashed !== variation) variations.add(dashed);
                
                // XXX.XXX.XXXX format
                const dotted = digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '$1.$2.$3');
                if (dotted !== variation) variations.add(dotted);
            } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
                // 1 XXX XXX XXXX format (US/Canada with country code)
                const spaced3 = digitsOnly.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
                if (spaced3 !== variation) variations.add(spaced3);
                
                // 1-XXX-XXX-XXXX
                const dashed3 = digitsOnly.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1-$2-$3-$4');
                if (dashed3 !== variation) variations.add(dashed3);
            } else if (digitsOnly.length >= 10) {
                // Generic spacing for other lengths
                const spacedGeneric = digitsOnly.replace(/(\d{3})(?=\d)/g, '$1 ');
                if (spacedGeneric !== variation) variations.add(spacedGeneric);
                
                // Generic dashing
                const dashedGeneric = digitsOnly.replace(/(\d{3})(?=\d)/g, '$1-');
                if (dashedGeneric !== variation) variations.add(dashedGeneric);
            }
            
            // Add dash-separated versions for any length
            if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
                const dashedAny = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1-');
                if (dashedAny !== variation && dashedAny.length >= 7) variations.add(dashedAny);
            }
        }
    });
    
    // Filter out invalid variations and return
    const finalVariations = Array.from(variations)
        .filter(v => v && v.length >= 7)  // Minimum 7 characters for a valid phone (including country code)
        .filter(v => v.length <= 20)      // Maximum reasonable length
        .filter(v => !v.includes('undefined') && !v.includes('null') && !v.includes('NaN'))
        .filter((v, i, arr) => arr.indexOf(v) === i);  // Remove duplicates
    
    console.log(`📱 Generated ${finalVariations.length} phone variations`);
    
    return finalVariations;
}

// Determine report type
function determineReportType(collectionName, data) {
    if (collectionName.includes('monthly') || collectionName.includes('submission')) {
        return 'monthly';
    }
    if (collectionName.includes('assessment') || 
        collectionName.includes('progress') || 
        collectionName.includes('result') ||
        collectionName.includes('test') ||
        collectionName.includes('exam') ||
        collectionName.includes('quiz')) {
        return 'assessment';
    }
    if (data.reportType) {
        const rt = data.reportType.toLowerCase();
        if (rt.includes('assessment') || rt.includes('test') || rt.includes('exam')) return 'assessment';
        if (rt.includes('monthly') || rt.includes('progress') || rt.includes('report')) return 'monthly';
        return rt;
    }
    if (data.type) {
        const t = data.type.toLowerCase();
        if (t.includes('assessment') || t.includes('test')) return 'assessment';
        if (t.includes('monthly') || t.includes('progress')) return 'monthly';
        return t;
    }
    if (data.category) {
        const c = data.category.toLowerCase();
        if (c.includes('assessment') || c.includes('test')) return 'assessment';
        if (c.includes('monthly') || c.includes('progress')) return 'monthly';
    }
    return 'unknown';
}

// Get timestamp from various date formats
function getTimestampFromData(data) {
    if (!data) return Math.floor(Date.now() / 1000);
    
    // Try different timestamp fields
    const timestampFields = [
        'timestamp',
        'createdAt',
        'submittedAt',
        'date',
        'updatedAt',
        'assignedDate',
        'dueDate',
        'completedAt',
        'assessmentDate',
        'reportDate',
        'sessionDate',
        'created'
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

// Convert various date formats to timestamp
function getTimestamp(dateInput) {
    if (!dateInput) return 0;
    
    if (dateInput?.toDate) {
        return dateInput.toDate().getTime();
    } else if (dateInput instanceof Date) {
        return dateInput.getTime();
    } else if (typeof dateInput === 'string') {
        const date = new Date(dateInput);
        return isNaN(date.getTime()) ? 0 : date.getTime();
    } else if (typeof dateInput === 'number') {
        // Handle seconds timestamp
        if (dateInput < 10000000000) {
            return dateInput * 1000; // Convert seconds to milliseconds
        }
        return dateInput; // Assume milliseconds
    }
    
    return 0;
}

// ============================================================================
// SECTION 13: REAL-TIME MONITORING WITHOUT COMPLEX QUERIES
// ============================================================================

function setupRealTimeMonitoring(parentPhone, userId) {
    // Clear any existing listeners
    cleanupRealTimeListeners();
    
    console.log("🔍 Setting up real-time monitoring for:", parentPhone);
    
    // Normalize phone
    const normalizedPhone = normalizePhoneNumber(parentPhone);
    if (!normalizedPhone.valid) {
        console.log("Invalid phone number for monitoring");
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
                    // Reload reports after a short delay
                    setTimeout(() => {
                        loadAllReportsForParent(parentPhone, userId);
                    }, 2000);
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
                    setTimeout(() => {
                        loadAllReportsForParent(parentPhone, userId);
                    }, 2000);
                }
            });
        }, (error) => {
            console.error("Assessment reports listener error:", error);
        });
    realTimeListeners.push(assessmentListener);
    
    // Monitor tutor messages (simple query without type filter)
    const messagesListener = db.collection("tutor_messages")
        .where("parentUid", "==", userId)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const message = change.doc.data();
                    // Filter client-side for incoming messages
                    if (message.type !== 'parent_to_staff') {
                        console.log("🆕 NEW MESSAGE DETECTED!");
                        checkForNewMessages();
                    }
                }
            });
        }, (error) => {
            console.error("Messages listener error:", error);
        });
    realTimeListeners.push(messagesListener);
    
    // Monitor academics with simplified approach
    // We'll check periodically instead of real-time to avoid complex queries
    setInterval(() => {
        checkForNewAcademics();
    }, 30000); // Check every 30 seconds
    
    console.log("✅ Real-time monitoring setup complete");
}

function cleanupRealTimeListeners() {
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    realTimeListeners = [];
    console.log("🧹 Cleaned up real-time listeners");
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
// ============================================================================
// SECTION 14: YEARLY ARCHIVES REPORTS SYSTEM WITH ACCORDIONS
// ============================================================================

/**
 * Creates a hierarchical accordion view for reports
 * Student Name → Year → Report Type (Assessments/Monthly)
 */
function createYearlyArchiveReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    
    for (const [studentName, reports] of reportsByStudent) {
        const fullName = capitalize(studentName);
        const studentData = reports.studentData;
        
        // Count reports for this student
        const assessmentCount = Array.from(reports.assessments.values()).flat().length;
        const monthlyCount = Array.from(reports.monthly.values()).flat().length;
        const totalCount = assessmentCount + monthlyCount;
        
        // Create student accordion header
        html += `
            <div class="accordion-item mb-4 fade-in">
                <button onclick="toggleAccordion('student-${studentIndex}')" 
                        class="accordion-header w-full flex justify-between items-center p-4 bg-gradient-to-r from-green-100 to-green-50 border border-green-300 rounded-lg hover:bg-green-200 transition-all duration-200 hover:shadow-md">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">👤</span>
                        <div class="text-left">
                            <h3 class="font-bold text-green-800 text-lg">${fullName}</h3>
                            <p class="text-green-600 text-sm">
                                ${assessmentCount} Assessment(s), ${monthlyCount} Monthly Report(s) • Total: ${totalCount}
                                ${studentData?.isPending ? ' • <span class="text-yellow-600">(Pending Registration)</span>' : ''}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <span id="student-${studentIndex}-arrow" class="accordion-arrow text-green-600 text-xl">▼</span>
                    </div>
                </button>
                <div id="student-${studentIndex}-content" class="accordion-content hidden">
        `;
        
        // If no reports, show empty state
        if (totalCount === 0) {
            html += `
                <div class="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <div class="text-4xl mb-3">📄</div>
                    <h4 class="text-lg font-semibold text-gray-700 mb-2">No Reports Yet</h4>
                    <p class="text-gray-500">No reports have been generated for ${fullName} yet.</p>
                    <p class="text-gray-400 text-sm mt-2">Reports will appear here once tutors or assessors submit them.</p>
                    ${studentData?.isPending ? 
                        '<p class="text-yellow-600 text-sm mt-2">⚠️ This student is pending registration. Reports will be available after registration is complete.</p>' : 
                        ''}
                </div>
            `;
        } else {
            // Group reports by year
            const reportsByYear = new Map();
            
            // Process assessment reports by year
            for (const [sessionKey, session] of reports.assessments) {
                session.forEach(report => {
                    const year = new Date(report.timestamp * 1000).getFullYear();
                    if (!reportsByYear.has(year)) {
                        reportsByYear.set(year, { assessments: [], monthly: [] });
                    }
                    reportsByYear.get(year).assessments.push({ sessionKey, session });
                });
            }
            
            // Process monthly reports by year
            for (const [sessionKey, session] of reports.monthly) {
                session.forEach(report => {
                    const year = new Date(report.timestamp * 1000).getFullYear();
                    if (!reportsByYear.has(year)) {
                        reportsByYear.set(year, { assessments: [], monthly: [] });
                    }
                    reportsByYear.get(year).monthly.push({ sessionKey, session });
                });
            }
            
            // Sort years in descending order
            const sortedYears = Array.from(reportsByYear.keys()).sort((a, b) => b - a);
            
            // Create year accordions
            let yearIndex = 0;
            for (const year of sortedYears) {
                const yearData = reportsByYear.get(year);
                const yearAssessmentCount = yearData.assessments.length;
                const yearMonthlyCount = yearData.monthly.length;
                
                html += `
                    <div class="mb-4 ml-4">
                        <button onclick="toggleAccordion('year-${studentIndex}-${yearIndex}')" 
                                class="accordion-header w-full flex justify-between items-center p-3 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-all duration-200">
                            <div class="flex items-center">
                                <span class="text-xl mr-3">📅</span>
                                <div class="text-left">
                                    <h4 class="font-bold text-blue-800">${year}</h4>
                                    <p class="text-blue-600 text-sm">
                                        ${yearAssessmentCount} Assessment(s), ${yearMonthlyCount} Monthly Report(s)
                                    </p>
                                </div>
                            </div>
                            <span id="year-${studentIndex}-${yearIndex}-arrow" class="accordion-arrow text-blue-600">▼</span>
                        </button>
                        <div id="year-${studentIndex}-${yearIndex}-content" class="accordion-content hidden ml-4 mt-2">
                `;
                
                // Assessment Reports for this year
                if (yearAssessmentCount > 0) {
                    html += `
                        <div class="mb-4">
                            <h5 class="font-semibold text-gray-700 mb-3 flex items-center">
                                <span class="mr-2">📊</span> Assessment Reports
                            </h5>
                    `;
                    
                    // Group assessments by month
                    const assessmentsByMonth = new Map();
                    yearData.assessments.forEach(({ sessionKey, session }) => {
                        session.forEach(report => {
                            const date = new Date(report.timestamp * 1000);
                            const month = date.getMonth();
                            const monthNames = [
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                            ];
                            
                            if (!assessmentsByMonth.has(month)) {
                                assessmentsByMonth.set(month, []);
                            }
                            assessmentsByMonth.get(month).push({ sessionKey, session });
                        });
                    });
                    
                    // Sort months in descending order
                    const sortedMonths = Array.from(assessmentsByMonth.keys()).sort((a, b) => b - a);
                    
                    sortedMonths.forEach(month => {
                        const monthName = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ][month];
                        
                        html += `<h6 class="font-medium text-gray-600 mb-2 ml-2">${monthName}</h6>`;
                        
                        assessmentsByMonth.get(month).forEach(({ sessionKey, session }, sessionIndex) => {
                            html += createAssessmentReportHTML(session, studentIndex, `${year}-${month}-${sessionIndex}`, fullName);
                        });
                    });
                    
                    html += `</div>`;
                }
                
                // Monthly Reports for this year
                if (yearMonthlyCount > 0) {
                    html += `
                        <div class="mb-4">
                            <h5 class="font-semibold text-gray-700 mb-3 flex items-center">
                                <span class="mr-2">📈</span> Monthly Reports
                            </h5>
                    `;
                    
                    // Group monthly reports by month
                    const monthlyByMonth = new Map();
                    yearData.monthly.forEach(({ sessionKey, session }) => {
                        session.forEach(report => {
                            const date = new Date(report.timestamp * 1000);
                            const month = date.getMonth();
                            const monthNames = [
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                            ];
                            
                            if (!monthlyByMonth.has(month)) {
                                monthlyByMonth.set(month, []);
                            }
                            monthlyByMonth.get(month).push({ sessionKey, session });
                        });
                    });
                    
                    // Sort months in descending order
                    const sortedMonths = Array.from(monthlyByMonth.keys()).sort((a, b) => b - a);
                    
                    sortedMonths.forEach(month => {
                        const monthName = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ][month];
                        
                        html += `<h6 class="font-medium text-gray-600 mb-2 ml-2">${monthName}</h6>`;
                        
                        monthlyByMonth.get(month).forEach(({ sessionKey, session }, sessionIndex) => {
                            html += createMonthlyReportHTML(session, studentIndex, `${year}-${month}-${sessionIndex}`, fullName);
                        });
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

function createAssessmentReportHTML(session, studentIndex, sessionId, fullName) {
    const firstReport = session[0];
    const formattedDate = formatDetailedDate(new Date(firstReport.timestamp * 1000), true);
    
    const results = session.map(testResult => {
        const topics = [...new Set(testResult.answers?.map(a => safeText(a.topic)).filter(t => t))] || [];
        return {
            subject: safeText(testResult.subject),
            correct: testResult.score !== undefined ? testResult.score : 0,
            total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0,
            topics: topics,
        };
    });
    
    const tableRows = results.map(res => `
        <tr>
            <td class="border px-3 py-2">${res.subject.toUpperCase()}</td>
            <td class="border px-3 py-2 text-center">${res.correct} / ${res.total}</td>
            <td class="border px-3 py-2 text-sm">${res.topics.join(', ')}</td>
        </tr>
    `).join("");
    
    return `
        <div class="border rounded-lg shadow mb-4 p-4 bg-white hover:shadow-md transition-shadow duration-200" id="assessment-block-${studentIndex}-${sessionId}">
            <div class="flex justify-between items-center mb-3 border-b pb-2">
                <h5 class="font-medium text-gray-800">Assessment - ${safeText(formattedDate)}</h5>
                <button onclick="downloadSessionReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}', 'assessment')" 
                        class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100 transition-all duration-200">
                    <span class="mr-1">📥</span> Download PDF
                </button>
            </div>
            
            <table class="w-full text-sm mb-3 border border-collapse">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="border px-3 py-2 text-left">Subject</th>
                        <th class="border px-3 py-2 text-center">Score</th>
                        <th class="border px-3 py-2 text-left">Topics</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    `;
}

function createMonthlyReportHTML(session, studentIndex, sessionId, fullName) {
    const firstReport = session[0];
    const formattedDate = formatDetailedDate(new Date(firstReport.timestamp * 1000), true);
    const safeTopics = safeText(firstReport.topics ? firstReport.topics.substring(0, 150) + (firstReport.topics.length > 150 ? '...' : '') : 'N/A');
    
    return `
        <div class="border rounded-lg shadow mb-4 p-4 bg-white hover:shadow-md transition-shadow duration-200" id="monthly-block-${studentIndex}-${sessionId}">
            <div class="flex justify-between items-center mb-3 border-b pb-2">
                <h5 class="font-medium text-gray-800">Monthly Report - ${safeText(formattedDate)}</h5>
                <button onclick="downloadMonthlyReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}')" 
                        class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100 transition-all duration-200">
                    <span class="mr-1">📥</span> Download PDF
                </button>
            </div>
            
            <div class="text-sm text-gray-700 space-y-2">
                <p><strong class="text-gray-800">Tutor:</strong> ${safeText(firstReport.tutorName || 'N/A')}</p>
                <p><strong class="text-gray-800">Month:</strong> ${safeText(formattedDate.split(' ')[0])} ${new Date(firstReport.timestamp * 1000).getFullYear()}</p>
                <div>
                    <strong class="text-gray-800">Topics Covered:</strong>
                    <p class="mt-1 bg-gray-50 p-3 rounded border">${safeTopics}</p>
                </div>
                ${firstReport.studentProgress ? `
                <div>
                    <strong class="text-gray-800">Progress Notes:</strong>
                    <p class="mt-1 bg-blue-50 p-3 rounded border">${safeText(firstReport.studentProgress)}</p>
                </div>
                ` : ''}
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
    
    // Show loading message
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
        // 2. CACHE CHECK (Performance Optimization)
        const cacheKey = `reportCache_${parentPhone}`;
        const cacheDuration = 60 * 60 * 1000; // 1 hour
        
        if (!forceRefresh) {
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const cacheData = JSON.parse(cachedItem);
                    if (Date.now() - cacheData.timestamp < cacheDuration) {
                        console.log("⚡ GOD MODE: Loading data from fast cache.");
                        
                        // Restore global state
                        currentUserData = cacheData.userData;
                        userChildren = cacheData.studentList || [];
                        
                        if (reportContent) reportContent.innerHTML = cacheData.html;
                        
                        // UI Restoration
                        if (welcomeMessage && currentUserData.parentName) {
                            welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;
                        }

                        // Re-initialize dynamic components
                        addMessagesButton();
                        addManualRefreshButton();
                        addLogoutButton();
                        loadReferralRewards(userId);
                        loadAcademicsData();
                        setupRealTimeMonitoring(parentPhone, userId);
                        
                        return;
                    }
                }
            } catch (e) {
                console.warn("Cache invalid, forcing fresh load.");
                localStorage.removeItem(cacheKey);
            }
        }

        // 3. CRITICAL: FETCH ALL LINKED CHILDREN (The "Entity-First" Step)
        const { studentIds, studentNameIdMap, allStudentData } = await findStudentIdsForParent(parentPhone);
        
        // Update Global State
        userChildren = Array.from(studentNameIdMap.keys());
        
        console.log("👥 GOD MODE: Verified Student Entity List:", userChildren);

        // 4. USER PROFILE & REFERRAL SYNC
        // [FIX]: We extract parent name from the students we just fetched instead of calling a missing function
        let parentName = null;
        if (allStudentData && allStudentData.length > 0) {
            // Find the first student record that has a parent name attached
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

        // 5. REPORT AGGREGATION (The "Ultimate Search")
        const { assessmentResults, monthlyResults } = await searchAllReportsForParent(
            parentPhone, 
            currentUserData.email, 
            userId
        );

        // 6. DATA MAPPING (The "Container" Logic)
        const reportsByStudent = new Map();

        // A. Initialize containers for ALL known students (Empty or Not)
        userChildren.forEach(studentName => {
            const studentInfo = allStudentData.find(s => s.name === studentName);
            reportsByStudent.set(studentName, { 
                assessments: new Map(), 
                monthly: new Map(),
                studentData: studentInfo || { name: studentName, isPending: false }
            });
        });

        // B. Populate containers with Assessment Data
        assessmentResults.forEach(result => {
            const rawName = result.studentName || result.student;
            if (!rawName) return;
            
            const studentName = safeText(rawName);
            
            // If report belongs to a student NOT in our initial list (rare), add them now
            if (!reportsByStudent.has(studentName)) {
                reportsByStudent.set(studentName, { 
                    assessments: new Map(), 
                    monthly: new Map(),
                    studentData: { name: studentName, isPending: false } 
                });
                userChildren.push(studentName); // Update global list
            }

            const sessionKey = Math.floor(result.timestamp / 86400);
            const studentRecord = reportsByStudent.get(studentName);
            
            if (!studentRecord.assessments.has(sessionKey)) {
                studentRecord.assessments.set(sessionKey, []);
            }
            studentRecord.assessments.get(sessionKey).push(result);
        });

        // C. Populate containers with Monthly Report Data
        monthlyResults.forEach(result => {
            const rawName = result.studentName || result.student;
            if (!rawName) return;
            
            const studentName = safeText(rawName);
            
            if (!reportsByStudent.has(studentName)) {
                reportsByStudent.set(studentName, { 
                    assessments: new Map(), 
                    monthly: new Map(),
                    studentData: { name: studentName, isPending: false } 
                });
                userChildren.push(studentName);
            }

            const sessionKey = Math.floor(result.timestamp / 86400);
            const studentRecord = reportsByStudent.get(studentName);
            
            if (!studentRecord.monthly.has(sessionKey)) {
                studentRecord.monthly.set(sessionKey, []);
            }
            studentRecord.monthly.get(sessionKey).push(result);
        });

        // 7. RENDER (Generate the UI)
        if (reportContent) {
            // Check if we truly have zero students
            if (reportsByStudent.size === 0) {
                reportContent.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                        <div class="text-6xl mb-4">👋</div>
                        <h3 class="text-xl font-bold text-gray-700 mb-2">Welcome to BKH!</h3>
                        <p class="text-gray-500 max-w-md mx-auto mb-6">We don't see any students linked to your account yet.</p>
                        <p class="text-sm text-gray-400">If you have registered, please contact support to link your account.</p>
                    </div>
                `;
            } else {
                // Pass the map containing ALL students (empty or full) to the view generator
                const reportsHtml = createYearlyArchiveReportView(reportsByStudent);
                reportContent.innerHTML = reportsHtml;
            }
        }

        // 8. UPDATE CACHE
        try {
            const dataToCache = {
                timestamp: Date.now(),
                html: reportContent ? reportContent.innerHTML : '',
                userData: currentUserData,
                studentList: userChildren
            };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        } catch (e) {
            console.error("Cache write failed:", e);
        }

        // 9. FINAL UI COMPONENTS
        if (authArea && reportArea) {
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
        }
        
        addMessagesButton();
        addManualRefreshButton();
        addLogoutButton();
        setupRealTimeMonitoring(parentPhone, userId);
        loadReferralRewards(userId);
        loadAcademicsData();

    } catch (error) {
        console.error("❌ CRITICAL FAILURE in Report Loading:", error);
        if (reportContent) {
            reportContent.innerHTML = `
                <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-md">
                    <div class="flex">
                        <div class="flex-shrink-0"><span class="text-2xl">⚠️</span></div>
                        <div class="ml-3">
                            <h3 class="text-lg font-medium text-red-800">System Error</h3>
                            <p class="text-sm text-red-700 mt-1">We encountered an issue loading your dashboard: ${safeText(error.message)}</p>
                            <button onclick="window.location.reload()" class="mt-3 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200">
                                Reload Page
                            </button>
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
    const studentsSnapshot = await db.collection('students')
        .where('parentPhone', '==', userData?.normalizedPhone || userData?.phone)
        .get();
    
    diagnosticsHtml += `<p><strong>Linked Students:</strong> ${studentsSnapshot.size}</p>`;
    
    if (studentsSnapshot.size > 0) {
        diagnosticsHtml += `<ul class="list-disc pl-5 mt-2">`;
        studentsSnapshot.forEach(doc => {
            const student = doc.data();
            diagnosticsHtml += `<li>${student.studentName} (ID: ${doc.id})</li>`;
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
    
    console.log("🔍 RUNNING DIAGNOSTICS...");
    
    // 1. Check what data exists
    console.log("📋 Parent Data:", userData);
    
    // 2. Find linked students
    const students = await findStudentIdsForParent(userData?.normalizedPhone || userData?.phone);
    console.log("👥 Linked Students:", students);
    
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
// SECTION 18: FIXED AUTHENTICATION SYSTEM - NO RELOADING LOOPS
// ============================================================================

// Global state tracking
let authStateInitialized = false;
let authChangeInProgress = false;
let lastAuthChangeTime = 0;
const AUTH_DEBOUNCE_MS = 1500; // Increased to 1.5 seconds
let authUnsubscribe = null;
let currentAuthUser = null; // Track current user to prevent duplicate processing

// ============================================================================
// SIMPLE, ROBUST AUTHENTICATION HANDLERS
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

// ============================================================================
// SINGLE SOURCE OF TRUTH: AUTH STATE MANAGER
// ============================================================================

/**
 * MAIN AUTHENTICATION MANAGER - Only this function handles auth state changes
 */
function initializeAuthManager() {
    console.log("🔐 Initializing single auth manager");
    
    // Clean up any existing listener
    if (authUnsubscribe && typeof authUnsubscribe === 'function') {
        authUnsubscribe();
        authUnsubscribe = null;
    }
    
    // Clear any pending operations
    authChangeInProgress = false;
    authStateInitialized = false;
    currentAuthUser = null;
    
    // Set up ONE SINGLE auth state listener
    authUnsubscribe = auth.onAuthStateChanged(
        (user) => {
            // Skip if we're already processing or this is a duplicate
            if (authChangeInProgress) {
                console.log("⏸️ Auth change already in progress, skipping duplicate");
                return;
            }
            
            // Check if this is the same user we already processed
            if (currentAuthUser && user && currentAuthUser.uid === user.uid) {
                console.log("🔄 Same user detected, no action needed");
                return;
            }
            
            // Start processing with debouncing
            const now = Date.now();
            if (now - lastAuthChangeTime < AUTH_DEBOUNCE_MS) {
                console.log("⏸️ Debouncing auth change");
                setTimeout(() => processAuthChange(user), AUTH_DEBOUNCE_MS);
                return;
            }
            
            // Process immediately
            processAuthChange(user);
        },
        (error) => {
            console.error("❌ Auth state error:", error);
            // Don't show error messages that might cause loops
            if (!error.message.includes('network') && !error.message.includes('permission')) {
                showMessage('Authentication error. Please refresh.', 'error');
            }
        }
    );
    
    console.log("✅ Auth manager initialized successfully");
}

/**
 * Process auth changes safely without loops
 */
function processAuthChange(user) {
    // Mark as in progress
    authChangeInProgress = true;
    lastAuthChangeTime = Date.now();
    
    // Store current user to prevent duplicate processing
    currentAuthUser = user;
    
    console.log(`🔐 Auth change: ${user ? `SIGNED IN (${user.email})` : 'SIGNED OUT'}`);
    
    try {
        if (user) {
            handleUserSignedInSafe(user);
        } else {
            handleUserSignedOutSafe();
        }
        
        authStateInitialized = true;
        
    } catch (error) {
        console.error("❌ Error processing auth change:", error);
        // Don't show errors that might cause more loops
    } finally {
        // Reset after a safe delay
        setTimeout(() => {
            authChangeInProgress = false;
            console.log("✅ Auth processing complete");
        }, 1000);
    }
}

/**
 * SAFE user sign-in handler
 */
function handleUserSignedInSafe(user) {
    console.log("👤 User signed in safely, loading dashboard...");
    
    const authArea = document.getElementById("authArea");
    const reportArea = document.getElementById("reportArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");
    
    // IMMEDIATE UI UPDATE (no async operations here)
    if (authArea && reportArea) {
        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
    }
    
    if (authLoader) {
        authLoader.classList.add("hidden");
    }
    
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome!`;
    }
    
    // Store auth state
    localStorage.setItem('isAuthenticated', 'true');
    
    // Load user data and reports ASYNCHRONOUSLY
    setTimeout(() => {
        loadUserDataAndReports(user);
    }, 300);
}

/**
 * Load user data and reports (separated from UI update)
 */
async function loadUserDataAndReports(user) {
    try {
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const welcomeMessage = document.getElementById("welcomeMessage");
            
            // Update welcome message
            if (welcomeMessage && userData.parentName) {
                welcomeMessage.textContent = `Welcome, ${safeText(userData.parentName)}!`;
            }
            
            // Store current user data globally
            currentUserData = {
                parentName: safeText(userData.parentName || 'Parent'),
                parentPhone: userData.phone,
                normalizedPhone: userData.normalizedPhone,
                email: userData.email || ''
            };
            
            // Load reports with the phone number
            const userPhone = userData.normalizedPhone || userData.phone;
            await loadAllReportsForParent(userPhone, user.uid);
            
            // Add UI buttons
            addNavigationButtons();
            
            // Setup real-time monitoring AFTER everything is loaded
            setTimeout(() => {
                if (!window.realTimeMonitoringSetup) {
                    setupRealTimeMonitoring(userPhone, user.uid);
                    window.realTimeMonitoringSetup = true;
                }
            }, 1000);
            
        } else {
            console.error("User document not found");
            showMessage('Profile not found. Please contact support.', 'error');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showMessage('Could not load your data. Please try again.', 'error');
    }
}

/**
 * Add all navigation buttons at once
 */
function addNavigationButtons() {
    // Remove any existing buttons first
    const existingButtons = [
        'viewMessagesBtn',
        'composeMessageBtn', 
        'manualRefreshBtn'
    ];
    
    existingButtons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.remove();
    });
    
    // Add fresh buttons
    setTimeout(() => {
        addMessagesButton();
        addManualRefreshButton();
        addLogoutButton();
    }, 500);
}

/**
 * SAFE user sign-out handler
 */
function handleUserSignedOutSafe() {
    console.log("🚪 User signed out safely");
    
    const authArea = document.getElementById("authArea");
    const reportArea = document.getElementById("reportArea");
    const authLoader = document.getElementById("authLoader");
    
    // Clean up FIRST
    cleanupRealTimeListeners();
    window.realTimeMonitoringSetup = false;
    
    // Clear state
    localStorage.removeItem('isAuthenticated');
    currentAuthUser = null;
    currentUserData = null;
    userChildren = [];
    studentIdMap.clear();
    
    // Update UI
    if (authArea && reportArea) {
        authArea.classList.remove("hidden");
        reportArea.classList.add("hidden");
    }
    
    if (authLoader) {
        authLoader.classList.add("hidden");
    }
    
    // Reset form (preserve email if remember me is checked)
    const loginPassword = document.getElementById('loginPassword');
    const rememberMe = document.getElementById('rememberMe');
    const loginIdentifier = document.getElementById('loginIdentifier');
    
    if (loginPassword) loginPassword.value = '';
    
    if (loginIdentifier && (!rememberMe || !rememberMe.checked)) {
        loginIdentifier.value = '';
    }
    
    // Switch to sign in tab
    switchTab('signin');
    
    // Clear any leftover buttons
    setTimeout(() => {
        const welcomeSection = document.querySelector('.bg-green-50');
        if (welcomeSection) {
            const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
            if (buttonContainer) {
                // Keep only logout button if it exists
                const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
                buttonContainer.innerHTML = '';
                if (logoutBtn) {
                    buttonContainer.appendChild(logoutBtn);
                }
            }
        }
    }, 100);
}

// ============================================================================
// SIMPLE EVENT LISTENER SETUP
// ============================================================================

function setupSimpleEventListeners() {
    console.log("🔧 Setting up event listeners");
    
    // Remove all existing listeners first
    const removeListeners = (element, event, handler) => {
        if (element) {
            element.removeEventListener(event, handler);
        }
    };
    
    // Sign in
    const signInBtn = document.getElementById("signInBtn");
    if (signInBtn) {
        removeListeners(signInBtn, "click", handleSignIn);
        signInBtn.addEventListener("click", handleSignIn);
    }
    
    // Sign up
    const signUpBtn = document.getElementById("signUpBtn");
    if (signUpBtn) {
        removeListeners(signUpBtn, "click", handleSignUp);
        signUpBtn.addEventListener("click", handleSignUp);
    }
    
    // Password reset
    const sendResetBtn = document.getElementById("sendResetBtn");
    if (sendResetBtn) {
        removeListeners(sendResetBtn, "click", handlePasswordReset);
        sendResetBtn.addEventListener("click", handlePasswordReset);
    }
    
    // Forgot password
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    if (forgotPasswordBtn) {
        removeListeners(forgotPasswordBtn, "click", showPasswordResetModal);
        forgotPasswordBtn.addEventListener("click", showPasswordResetModal);
    }
    
    // Cancel reset
    const cancelResetBtn = document.getElementById("cancelResetBtn");
    if (cancelResetBtn) {
        removeListeners(cancelResetBtn, "click", hidePasswordResetModal);
        cancelResetBtn.addEventListener("click", hidePasswordResetModal);
    }
    
    // Remember me
    const rememberMeCheckbox = document.getElementById("rememberMe");
    if (rememberMeCheckbox) {
        removeListeners(rememberMeCheckbox, "change", handleRememberMe);
        rememberMeCheckbox.addEventListener("change", handleRememberMe);
    }
    
    // Tabs
    const signInTab = document.getElementById("signInTab");
    if (signInTab) {
        removeListeners(signInTab, "click", () => switchTab('signin'));
        signInTab.addEventListener("click", () => switchTab('signin'));
    }
    
    const signUpTab = document.getElementById("signUpTab");
    if (signUpTab) {
        removeListeners(signUpTab, "click", () => switchTab('signup'));
        signUpTab.addEventListener("click", () => switchTab('signup'));
    }
    
    // Message submission
    const submitMessageBtn = document.getElementById("submitMessageBtn");
    if (submitMessageBtn) {
        removeListeners(submitMessageBtn, "click", submitMessage);
        submitMessageBtn.addEventListener("click", submitMessage);
    }
    
    // Main navigation tabs
    const reportTab = document.getElementById("reportTab");
    if (reportTab) {
        removeListeners(reportTab, "click", () => switchMainTab('reports'));
        reportTab.addEventListener("click", () => switchMainTab('reports'));
    }
    
    const academicsTab = document.getElementById("academicsTab");
    if (academicsTab) {
        removeListeners(academicsTab, "click", () => switchMainTab('academics'));
        academicsTab.addEventListener("click", () => switchMainTab('academics'));
    }
    
    const rewardsTab = document.getElementById("rewardsTab");
    if (rewardsTab) {
        removeListeners(rewardsTab, "click", () => switchMainTab('rewards'));
        rewardsTab.addEventListener("click", () => switchMainTab('rewards'));
    }
    
    // Enter key support
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        removeListeners(loginPassword, 'keypress', handleLoginEnter);
        loginPassword.addEventListener('keypress', handleLoginEnter);
    }
    
    const signupConfirmPassword = document.getElementById('signupConfirmPassword');
    if (signupConfirmPassword) {
        removeListeners(signupConfirmPassword, 'keypress', handleSignupEnter);
        signupConfirmPassword.addEventListener('keypress', handleSignupEnter);
    }
    
    const resetEmail = document.getElementById('resetEmail');
    if (resetEmail) {
        removeListeners(resetEmail, 'keypress', handleResetEnter);
        resetEmail.addEventListener('keypress', handleResetEnter);
    }
    
    // Dynamic button delegation (for buttons created after page load)
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        // Cancel message modal
        if (target.id === 'cancelMessageBtn' || target.closest('#cancelMessageBtn')) {
            event.preventDefault();
            hideComposeMessageModal();
        }
        
        // Cancel messages modal
        if (target.id === 'cancelMessagesModalBtn' || target.closest('#cancelMessagesModalBtn')) {
            event.preventDefault();
            hideMessagesModal();
        }
    });
}

// ============================================================================
// ENTER KEY HANDLERS
// ============================================================================

function handleLoginEnter(e) {
    if (e.key === 'Enter') handleSignIn();
}

function handleSignupEnter(e) {
    if (e.key === 'Enter') handleSignUp();
}

function handleResetEnter(e) {
    if (e.key === 'Enter') handlePasswordReset();
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function showPasswordResetModal() {
    const modal = document.getElementById("passwordResetModal");
    if (modal) {
        modal.classList.remove("hidden");
        // Focus on email field
        const resetEmail = document.getElementById("resetEmail");
        if (resetEmail) resetEmail.focus();
    }
}

function hidePasswordResetModal() {
    const modal = document.getElementById("passwordResetModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

function cleanupBeforeUnload() {
    console.log("🧹 Cleaning up before page unload");
    
    // Clean up auth listener
    if (authUnsubscribe && typeof authUnsubscribe === 'function') {
        authUnsubscribe();
        authUnsubscribe = null;
    }
    
    // Clean up real-time listeners
    cleanupRealTimeListeners();
    
    // Clear any intervals
    const maxIntervalId = setTimeout(() => {}, 0);
    for (let i = 0; i < maxIntervalId; i++) {
        clearInterval(i);
    }
}

// ============================================================================
// MAIN INITIALIZATION - SINGLE ENTRY POINT
// ============================================================================

function initializeParentPortal() {
    console.log("🚀 Initializing parent portal (single entry point)");
    
    // Clear any existing timeouts/intervals first
    const maxTimeoutId = setTimeout(() => {}, 0);
    for (let i = 0; i < maxTimeoutId; i++) {
        clearTimeout(i);
        clearInterval(i);
    }
    
    // Reset global state
    authStateInitialized = false;
    authChangeInProgress = false;
    lastAuthChangeTime = 0;
    currentAuthUser = null;
    window.realTimeMonitoringSetup = false;
    
    // Setup core functionality
    setupRememberMe();
    injectCustomCSS();
    createCountryCodeDropdown();
    setupSimpleEventListeners();
    
    // Initialize auth manager (ONCE)
    initializeAuthManager();
    
    // Setup cleanup
    window.addEventListener('beforeunload', cleanupBeforeUnload);
    window.addEventListener('pagehide', cleanupBeforeUnload);
    
    console.log("✅ Parent portal initialized successfully");
}

// ============================================================================
// PAGE INITIALIZATION - RUN ONLY ONCE
// ============================================================================

// Track if we've already initialized
let portalInitialized = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM Content Loaded");
    
    // Only initialize once
    if (portalInitialized) {
        console.log("⚠️ Portal already initialized, skipping");
        return;
    }
    
    // Check for hash in URL that might cause reloads
    if (window.location.hash) {
        console.log("🔗 Removing hash from URL to prevent reloads");
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
    }
    
    // Initialize
    initializeParentPortal();
    portalInitialized = true;
    
    console.log("🎉 Portal initialization complete");
});

// Prevent multiple initializations
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (!portalInitialized) {
        console.log("📄 Document already loaded, initializing now");
        setTimeout(() => {
            initializeParentPortal();
            portalInitialized = true;
        }, 100);
    }
}
