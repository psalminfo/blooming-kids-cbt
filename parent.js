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
        console.log("🔍 [FIND STUDENTS] Starting search for parent phone:", parentPhone);
        
        // Normalize the phone number
        const normalizedPhone = normalizePhoneNumber(parentPhone);
        if (!normalizedPhone.valid) {
            console.log("❌ Invalid phone number format");
            return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
        }

        console.log("📱 Normalized phone:", normalizedPhone.normalized);
        
        // Generate ALL possible phone variations for thorough search
        const phoneVariations = generateAllPhoneVariations(parentPhone);
        console.log(`📱 Generated ${phoneVariations.length} phone variations`);
        
        // For debugging: Log first 5 variations
        if (phoneVariations.length > 0) {
            console.log("📱 Sample variations:", phoneVariations.slice(0, 5));
        }

        let studentIds = [];
        let studentNameIdMap = new Map();
        let allStudentData = [];
        let foundStudents = new Set(); // Track by ID to avoid duplicates
        
        // SEARCH STRATEGY 1: Search in students collection with ALL variations
        console.log("🔍 Searching in 'students' collection...");
        for (const phone of phoneVariations) {
            try {
                const studentsSnapshot = await db.collection("students")
                    .where("parentPhone", "==", phone)
                    .get();
                
                if (!studentsSnapshot.empty) {
                    console.log(`✅ Found ${studentsSnapshot.size} students with phone: ${phone}`);
                    
                    studentsSnapshot.forEach(doc => {
                        const studentData = doc.data();
                        const studentId = doc.id;
                        const studentName = safeText(studentData.studentName || studentData.name || studentData.fullName || 'Unknown Student');
                        
                        // Skip if already processed
                        if (foundStudents.has(studentId)) {
                            console.log(`⏭️ Skipping duplicate student ID: ${studentId}`);
                            return;
                        }
                        
                        if (studentId && studentName && studentName !== 'Unknown Student') {
                            foundStudents.add(studentId);
                            studentIds.push(studentId);
                            
                            // Handle duplicate names by adding parent info
                            let displayName = studentName;
                            if (studentNameIdMap.has(studentName)) {
                                const parentInfo = studentData.parentName ? ` (${safeText(studentData.parentName)}'s child)` : '';
                                displayName = `${studentName}${parentInfo}`;
                            }
                            
                            studentNameIdMap.set(displayName, studentId);
                            allStudentData.push({ 
                                id: studentId, 
                                name: displayName,
                                originalName: studentName,
                                data: studentData,
                                isPending: false,
                                collection: 'students',
                                matchedPhone: phone
                            });
                            
                            console.log(`✅ Added student: ${displayName} (ID: ${studentId}) from phone: ${phone}`);
                        }
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Error searching students with phone ${phone}:`, error.message);
            }
        }
        
        // SEARCH STRATEGY 2: Search in pending_students collection with ALL variations
        console.log("🔍 Searching in 'pending_students' collection...");
        for (const phone of phoneVariations) {
            try {
                const pendingSnapshot = await db.collection("pending_students")
                    .where("parentPhone", "==", phone)
                    .get();
                
                if (!pendingSnapshot.empty) {
                    console.log(`✅ Found ${pendingSnapshot.size} pending students with phone: ${phone}`);
                    
                    pendingSnapshot.forEach(doc => {
                        const studentData = doc.data();
                        const studentId = doc.id;
                        const studentName = safeText(studentData.studentName || studentData.name || studentData.fullName || 'Unknown Student');
                        
                        // Skip if already processed (might be in both collections)
                        if (foundStudents.has(studentId)) {
                            console.log(`⏭️ Skipping duplicate pending student ID: ${studentId}`);
                            return;
                        }
                        
                        if (studentId && studentName && studentName !== 'Unknown Student') {
                            foundStudents.add(studentId);
                            studentIds.push(studentId);
                            
                            // Handle duplicate names
                            let displayName = studentName;
                            if (studentNameIdMap.has(studentName)) {
                                const parentInfo = studentData.parentName ? ` (${safeText(studentData.parentName)}'s child)` : '';
                                displayName = `${studentName}${parentInfo}`;
                            }
                            
                            studentNameIdMap.set(displayName, studentId);
                            allStudentData.push({ 
                                id: studentId, 
                                name: displayName,
                                originalName: studentName,
                                data: studentData, 
                                isPending: true,
                                collection: 'pending_students',
                                matchedPhone: phone
                            });
                            
                            console.log(`✅ Added pending student: ${displayName} (ID: ${studentId}) from phone: ${phone}`);
                        }
                    });
                }
            } catch (error) {
                console.warn(`⚠️ Error searching pending_students with phone ${phone}:`, error.message);
            }
        }
        
        // SEARCH STRATEGY 3: Search by parent name/email (fallback)
        if (studentIds.length === 0 && currentUserData?.parentName) {
            console.log("🔍 Trying fallback search by parent name...");
            try {
                // Search by parent name in students collection
                const nameSnapshot = await db.collection("students")
                    .where("parentName", "==", currentUserData.parentName)
                    .get();
                
                if (!nameSnapshot.empty) {
                    console.log(`✅ Found ${nameSnapshot.size} students by parent name: ${currentUserData.parentName}`);
                    
                    nameSnapshot.forEach(doc => {
                        const studentData = doc.data();
                        const studentId = doc.id;
                        const studentName = safeText(studentData.studentName || studentData.name || 'Unknown Student');
                        
                        if (!foundStudents.has(studentId)) {
                            foundStudents.add(studentId);
                            studentIds.push(studentId);
                            studentNameIdMap.set(studentName, studentId);
                            allStudentData.push({ 
                                id: studentId, 
                                name: studentName,
                                originalName: studentName,
                                data: studentData,
                                isPending: false,
                                collection: 'students',
                                matchedBy: 'parentName'
                            });
                            
                            console.log(`✅ Added student by parent name: ${studentName} (ID: ${studentId})`);
                        }
                    });
                }
            } catch (error) {
                console.warn("⚠️ Error searching by parent name:", error.message);
            }
        }
        
        // Store the mapping globally
        studentIdMap = studentNameIdMap;
        
        console.log("📊 [FIND STUDENTS] FINAL RESULTS:");
        console.log(`   Total student IDs found: ${studentIds.length}`);
        console.log(`   Total student names found: ${studentNameIdMap.size}`);
        console.log(`   All student data entries: ${allStudentData.length}`);
        
        // Log all found students for debugging
        if (studentNameIdMap.size > 0) {
            console.log("👥 Found students:");
            Array.from(studentNameIdMap.entries()).forEach(([name, id]) => {
                const studentInfo = allStudentData.find(s => s.name === name);
                console.log(`   - ${name} (ID: ${id}, Pending: ${studentInfo?.isPending || false}, Collection: ${studentInfo?.collection})`);
            });
        }
        
        return { studentIds, studentNameIdMap, allStudentData };
    } catch (error) {
        console.error("❌ [FIND STUDENTS] Critical error:", error);
        console.error("❌ Error stack:", error.stack);
        return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
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
        
        console.log("🎯 TOTAL REPORTS FOUND:", allResults.length);
        console.log("📊 Sources found:", Array.from(foundSources));
        
        // If NO reports found, try emergency search
        if (allResults.length === 0) {
            console.warn("⚠️ No reports found with standard search. Starting EMERGENCY SEARCH...");
            const emergencyResults = await emergencyReportSearch(parentPhone, parentEmail);
            allResults = emergencyResults;
        }
        
        // Remove duplicates
        const uniqueResults = [];
        const seenIds = new Set();
        
        allResults.forEach(result => {
            const uniqueKey = `${result.collection}_${result.id}_${result.studentName}_${result.timestamp}`;
            if (!seenIds.has(uniqueKey)) {
                seenIds.add(uniqueKey);
                uniqueResults.push(result);
            }
        });
        
        // Separate into assessment and monthly
        const assessmentResults = uniqueResults.filter(r => 
            r.type === 'assessment' || 
            r.collection.includes('assessment') || 
            r.collection.includes('progress') ||
            (r.reportType && r.reportType.toLowerCase().includes('assessment'))
        );
        
        const monthlyResults = uniqueResults.filter(r => 
            r.type === 'monthly' || 
            r.collection.includes('monthly') ||
            r.collection.includes('submission') ||
            (r.reportType && r.reportType.toLowerCase().includes('monthly'))
        );
        
        // Sort by date (newest first)
        assessmentResults.sort((a, b) => b.timestamp - a.timestamp);
        monthlyResults.sort((a, b) => b.timestamp - a.timestamp);
        
        return { assessmentResults, monthlyResults, searchStats: {
            totalFound: uniqueResults.length,
            sources: Array.from(foundSources),
            collectionsSearched: collectionsToSearch.length
        }};
        
    } catch (error) {
        console.error("❌ Ultimate search error:", error);
        return { assessmentResults: [], monthlyResults: [], searchStats: { error: error.message }};
    }
}

// Generate ALL possible search queries
async function generateAllSearchQueries(parentPhone, parentEmail, parentUid) {
    const queries = [];
    
    // Phone variations - USING ENHANCED FUNCTION
    const phoneVariations = generateAllPhoneVariations(parentPhone);
    console.log(`📱 Generated ${phoneVariations.length} phone variations for search`);
    
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
            const phoneFields = ['parentPhone', 'parentphone', 'parent_phone', 'phone', 'guardianPhone', 'contact_number'];
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
        { code: '+1', length: 11 },      // USA/Canada
        { code: '+234', length: 14 },    // Nigeria
        { code: '+44', length: 13 },     // UK
        { code: '+91', length: 13 },     // India
        { code: '+86', length: 14 },     // China
        { code: '+33', length: 12 },     // France
        { code: '+49', length: 13 },     // Germany
        { code: '+81', length: 13 },     // Japan
        { code: '+61', length: 12 },     // Australia
        { code: '+55', length: 13 },     // Brazil
        { code: '+7', length: 12 },      // Russia/Kazakhstan
        { code: '+20', length: 13 },     // Egypt
        { code: '+27', length: 12 },     // South Africa
        { code: '+34', length: 12 },     // Spain
        { code: '+39', length: 12 },     // Italy
        { code: '+52', length: 13 },     // Mexico
        { code: '+62', length: 13 },     // Indonesia
        { code: '+82', length: 13 },     // South Korea
        { code: '+90', length: 13 },     // Turkey
        { code: '+92', length: 13 },     // Pakistan
        { code: '+966', length: 14 },    // Saudi Arabia
        { code: '+971', length: 13 },    // UAE
        { code: '+233', length: 13 },    // Ghana
        { code: '+254', length: 13 },    // Kenya
        { code: '+255', length: 13 },    // Tanzania
        { code: '+256', length: 13 },    // Uganda
        { code: '+237', length: 13 },    // Cameroon
        { code: '+251', length: 13 },    // Ethiopia
        { code: '+250', length: 13 },    // Rwanda
        { code: '+260', length: 13 },    // Zambia
        { code: '+263', length: 13 },    // Zimbabwe
        { code: '+265', length: 13 },    // Malawi
        { code: '+267', length: 13 },    // Botswana
        { code: '+268', length: 13 },    // Eswatini
        { code: '+269', length: 13 },    // Comoros
        { code: '+290', length: 11 },    // Saint Helena
        { code: '+291', length: 11 },    // Eritrea
        { code: '+297', length: 10 },    // Aruba
        { code: '+298', length: 9 },     // Faroe Islands
        { code: '+299', length: 9 },     // Greenland
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
        .filter(v => v && v.length >= 7)  // Minimum 7 characters for a valid phone (including country code)
        .filter(v => v.length <= 20)      // Maximum reasonable length
        .filter(v => !v.includes('undefined'))  // Remove any undefined values
        .filter((v, i, arr) => arr.indexOf(v) === i);  // Remove duplicates
    
    console.log(`📱 Generated ${finalVariations.length} phone variations`);
    
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
    console.log("📄 Creating yearly archive view for", reportsByStudent.size, "students");
    
    let html = '';
    let studentIndex = 0;
    
    // Check if we have any students
    if (reportsByStudent.size === 0) {
        return `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">👨‍👩‍👧‍👦</div>
                <h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
                <p class="text-gray-500 max-w-md mx-auto">No students are currently assigned to your account. Please contact administration if you believe this is an error.</p>
                <button onclick="runReportSearchDiagnostics()" class="mt-4 bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-all duration-200">
                    Run Diagnostics
                </button>
            </div>
        `;
    }
    
    // Sort students alphabetically for better organization
    const sortedStudents = Array.from(reportsByStudent.entries())
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
    
    console.log(`📄 Processing ${sortedStudents.length} students for display`);
    
    for (const [studentName, reports] of sortedStudents) {
        const fullName = capitalize(studentName);
        const studentData = reports.studentData;
        
        // Count reports for this student
        const assessmentCount = Array.from(reports.assessments.values()).flat().length;
        const monthlyCount = Array.from(reports.monthly.values()).flat().length;
        const totalCount = assessmentCount + monthlyCount;
        const hasReports = totalCount > 0;
        
        console.log(`📄 Student ${studentIndex + 1}: ${fullName} - ${assessmentCount} assessments, ${monthlyCount} monthly reports`);
        
        // Create student accordion header
        html += `
            <div class="accordion-item mb-4 fade-in" id="student-accordion-${studentIndex}">
                <button onclick="toggleAccordion('student-${studentIndex}')" 
                        class="accordion-header w-full flex justify-between items-center p-4 ${hasReports ? 'bg-gradient-to-r from-green-100 to-green-50 border border-green-300' : 'bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-300'} rounded-lg hover:shadow-md transition-all duration-200">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">${hasReports ? '👤' : '👤'}</span>
                        <div class="text-left">
                            <h3 class="font-bold ${hasReports ? 'text-green-800' : 'text-gray-700'} text-lg">${fullName}</h3>
                            <p class="${hasReports ? 'text-green-600' : 'text-gray-500'} text-sm">
                                ${hasReports ? 
                                    `${assessmentCount} Assessment(s), ${monthlyCount} Monthly Report(s) • Total: ${totalCount}` : 
                                    'No reports yet'}
                                ${studentData?.isPending ? ' • <span class="text-yellow-600">(Pending Registration)</span>' : ''}
                                ${studentData?.collection ? ` • <span class="text-blue-600 text-xs">${studentData.collection}</span>` : ''}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center">
                        ${!hasReports ? `<span class="text-xs text-gray-500 mr-3">No reports</span>` : ''}
                        <span id="student-${studentIndex}-arrow" class="accordion-arrow ${hasReports ? 'text-green-600' : 'text-gray-500'} text-xl">▼</span>
                    </div>
                </button>
                <div id="student-${studentIndex}-content" class="accordion-content hidden">
        `;
        
        // Student info section (always show)
        html += `
            <div class="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-semibold text-blue-800 mb-3 flex items-center">
                    <span class="mr-2">📋</span> Student Information
                </h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p class="text-blue-600">Status</p>
                        <p class="font-medium">${studentData?.isPending ? 'Pending Registration' : 'Active'}</p>
                    </div>
                    <div>
                        <p class="text-blue-600">Collection</p>
                        <p class="font-medium">${safeText(studentData?.collection || 'Not specified')}</p>
                    </div>
                    ${studentData?.data?.tutorName ? `
                    <div>
                        <p class="text-blue-600">Assigned Tutor</p>
                        <p class="font-medium">${safeText(studentData.data.tutorName)}</p>
                    </div>
                    ` : ''}
                    ${studentData?.data?.gradeLevel ? `
                    <div>
                        <p class="text-blue-600">Grade Level</p>
                        <p class="font-medium">${safeText(studentData.data.gradeLevel)}</p>
                    </div>
                    ` : ''}
                </div>
                ${studentData?.matchedPhone ? `
                <div class="mt-3 text-xs text-gray-500">
                    Matched by phone: ${safeText(studentData.matchedPhone)}
                </div>
                ` : ''}
            </div>
        `;
        
        // If no reports, show empty state
        if (!hasReports) {
            html += `
                <div class="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center mb-4">
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
            
            console.log(`📅 ${fullName} has reports in ${sortedYears.length} year(s):`, sortedYears);
            
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
                    
                    // Sort months in descending order (newest first)
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
                    
                    // Sort months in descending order (newest first)
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
    
    // Add a summary at the top
    const totalStudents = sortedStudents.length;
    const studentsWithReports = sortedStudents.filter(([_, reports]) => {
        const assessmentCount = Array.from(reports.assessments.values()).flat().length;
        const monthlyCount = Array.from(reports.monthly.values()).flat().length;
        return (assessmentCount + monthlyCount) > 0;
    }).length;
    
    const summaryHtml = `
        <div class="bg-gradient-to-r from-blue-100 to-blue-50 border-l-4 border-blue-600 p-6 rounded-lg mb-8 shadow-md slide-down">
            <h2 class="text-2xl font-bold text-blue-800 mb-3">📊 Progress Reports Summary</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div class="bg-white p-4 rounded-lg border border-blue-200">
                    <p class="text-sm font-medium text-blue-700">Total Children</p>
                    <p class="text-3xl font-extrabold text-blue-900 mt-1">${totalStudents}</p>
                </div>
                <div class="bg-white p-4 rounded-lg border border-green-200">
                    <p class="text-sm font-medium text-green-700">Children with Reports</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">${studentsWithReports}</p>
                </div>
                <div class="bg-white p-4 rounded-lg border border-gray-200">
                    <p class="text-sm font-medium text-gray-700">Children without Reports</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${totalStudents - studentsWithReports}</p>
                </div>
            </div>
            <p class="text-blue-700">Click on each child's name below to expand and view their progress reports.</p>
        </div>
    `;
    
    return summaryHtml + html;
}

// ============================================================================
// SECTION 15: MAIN REPORT LOADING FUNCTION WITH IMPROVED STUDENT HANDLING
// ============================================================================

async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    console.log("🚀 [LOAD REPORTS] Starting with parentPhone:", parentPhone, "userId:", userId);
    
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    // Show dashboard if user is authenticated
    const user = auth.currentUser;
    if (user && authArea && reportArea) {
        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        authLoader.classList.add("hidden");
        
        // Store auth state in localStorage to persist across page refreshes
        localStorage.setItem('isAuthenticated', 'true');
    } else {
        localStorage.removeItem('isAuthenticated');
    }

    if (authLoader) authLoader.classList.remove("hidden");

    try {
        // --- CACHE IMPLEMENTATION (skip if force refresh) ---
        const cacheKey = `reportCache_${parentPhone}_${userId}`;
        const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
        
        if (!forceRefresh) {
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const cacheData = JSON.parse(cachedItem);
                    if (Date.now() - cacheData.timestamp < twoWeeksInMillis) {
                        console.log("📦 Loading reports from cache.");
                        if (reportContent) reportContent.innerHTML = cacheData.html;
                        
                        // Set welcome message from cache
                        if (cacheData.userData && cacheData.userData.parentName && welcomeMessage) {
                            welcomeMessage.textContent = `Welcome, ${cacheData.userData.parentName}!`;
                            currentUserData = cacheData.userData;
                        } else if (welcomeMessage) {
                            welcomeMessage.textContent = `Welcome!`;
                        }

                        if (authArea && reportArea) {
                            authArea.classList.add("hidden");
                            reportArea.classList.remove("hidden");
                        }
                        
                        // Add buttons to welcome section
                        addMessagesButton();
                        addManualRefreshButton();
                        addLogoutButton();
                        
                        // Setup real-time monitoring
                        const userDoc = await db.collection('parent_users').doc(userId).get();
                        const userData = userDoc.data();
                        setupRealTimeMonitoring(parentPhone, userId);
                        
                        // Load initial referral data
                        loadReferralRewards(userId);
                        
                        // Load academics data
                        loadAcademicsData();

                        return;
                    } else {
                        console.log("🗑️ Cache expired, refreshing...");
                    }
                }
            } catch (e) {
                console.error("❌ Could not read from cache:", e);
                localStorage.removeItem(cacheKey);
            }
        }
        // --- END CACHE IMPLEMENTATION ---

        // FIND PARENT NAME
        let parentName = await findParentNameFromStudents(parentPhone);
        
        // Get parent's email and latest user data from their account document
        const userDocRef = db.collection('parent_users').doc(userId);
        let userDoc = await userDocRef.get();
        let userData = userDoc.data();

        // Store email in currentUserData for report searching
        if (userData?.email) {
            currentUserData = {
                ...currentUserData,
                email: userData.email
            };
        }

        // REFERRAL CODE CHECK/GENERATION FOR EXISTING USERS
        if (!userData.referralCode) {
            console.log("Existing user detected without a referral code. Generating and assigning now.");
            try {
                const newReferralCode = await generateReferralCode();
                await userDocRef.update({
                    referralCode: newReferralCode,
                    referralEarnings: userData.referralEarnings || 0
                });
                
                // Re-fetch updated user data
                userDoc = await userDocRef.get();
                userData = userDoc.data();
                console.log("Referral code assigned successfully:", newReferralCode);
                
            } catch (error) {
                console.error('Error auto-assigning referral code:', error);
                // Non-critical failure, continue loading reports
            }
        }

        // If not found in students collections, use name from user document
        if (!parentName && userId) {
            if (userDoc.exists) {
                parentName = userData.parentName;
            }
        }

        // Final fallback
        if (!parentName) {
            parentName = 'Parent';
        }

        // Store user data globally
        currentUserData = {
            parentName: safeText(parentName),
            parentPhone: parentPhone,
            email: userData?.email || ''
        };

        // UPDATE WELCOME MESSAGE WITH PARENT NAME
        if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;

        // Update parent name in user document if we found a better one
        if (userId && parentName && parentName !== 'Parent' && userData.parentName !== parentName) {
            try {
                await userDocRef.update({
                    parentName: parentName
                });
            } catch (error) {
                console.error('Error updating parent name:', error);
            }
        }

        console.log("🔍 [LOAD REPORTS] Starting ULTIMATE search for reports with:", { 
            parentPhone, 
            email: currentUserData.email, 
            uid: userId,
            parentName: currentUserData.parentName
        });

        // --- FIRST: GET ALL STUDENTS ASSIGNED TO THIS PARENT (CRITICAL STEP) ---
        console.log("👥 [LOAD REPORTS] Step 1: Finding ALL students for parent...");
        const { studentIds, studentNameIdMap, allStudentData } = await findStudentIdsForParent(parentPhone);
        
        // Store student names globally - CRITICAL: Store ALL students found
        userChildren = Array.from(studentNameIdMap.keys());
        
        console.log("👥 [LOAD REPORTS] Step 1 COMPLETE - Students found:");
        console.log(`   Count: ${userChildren.length}`);
        console.log(`   Names: ${JSON.stringify(userChildren)}`);
        console.log(`   IDs: ${JSON.stringify(studentIds)}`);
        console.log(`   Data entries: ${allStudentData.length}`);

        // --- USE ULTIMATE SEARCH SYSTEM ---
        console.log("🔍 [LOAD REPORTS] Step 2: Searching for reports...");
        const { assessmentResults, monthlyResults, searchStats } = await searchAllReportsForParent(
            parentPhone, 
            currentUserData.email || userData?.email || '',
            userId
        );

        console.log("📊 [LOAD REPORTS] Search Statistics:", searchStats);
        console.log("📊 [LOAD REPORTS] Report counts - Assessments:", assessmentResults.length, "Monthly:", monthlyResults.length);

        // --- GROUP REPORTS BY STUDENT ---
        console.log("📊 [LOAD REPORTS] Step 3: Grouping reports by student...");
        
        // Initialize reportsByStudent map with ALL students (even those without reports)
        const reportsByStudent = new Map();
        
        // CRITICAL FIX: Initialize ALL students in the map FIRST
        console.log("📋 Initializing ALL students in reports map:");
        for (const studentName of userChildren) {
            const studentInfo = allStudentData.find(s => s.name === studentName);
            reportsByStudent.set(studentName, { 
                assessments: new Map(), 
                monthly: new Map(),
                studentData: studentInfo, // Store student data
                hasReports: false // Track if we find any reports for this student
            });
            console.log(`   - ${studentName} (Pending: ${studentInfo?.isPending || false}, Collection: ${studentInfo?.collection || 'unknown'})`);
        }

        // DEBUG: Check what students we initialized
        console.log(`📋 Total students initialized: ${reportsByStudent.size}`);

        // If no reports found at all, show all students with empty state
        if (assessmentResults.length === 0 && monthlyResults.length === 0) {
            console.log("⚠️ [LOAD REPORTS] No reports found for any student, showing all registered students");
            
            // Show message to user
            if (userChildren.length > 0) {
                showMessage(`Found ${userChildren.length} child(ren) but no reports yet. Reports will appear here once tutors submit them.`, 'info');
            } else {
                showMessage('No students found for your account. Please contact administration.', 'warning');
            }
            
            // Create empty report view with all students
            if (reportContent) {
                const reportsHtml = createYearlyArchiveReportView(reportsByStudent);
                reportContent.innerHTML = reportsHtml;
            }
            
            // --- CACHE SAVING LOGIC ---
            try {
                const dataToCache = {
                    timestamp: Date.now(),
                    html: reportContent ? reportContent.innerHTML : '',
                    userData: currentUserData,
                    studentCount: userChildren.length,
                    reportCount: 0
                };
                localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
                console.log("✅ Report data cached successfully.");
            } catch (e) {
                console.error("❌ Could not write to cache:", e);
            }
            // --- END CACHE SAVING ---

            if (authArea && reportArea) {
                authArea.classList.add("hidden");
                reportArea.classList.remove("hidden");
            }

            // Add buttons to welcome section
            addMessagesButton();
            addManualRefreshButton();
            addLogoutButton();
            
            // Load initial referral data for the rewards dashboard tab
            loadReferralRewards(userId);
            
            // Load academics data
            loadAcademicsData();

            return; // Exit early since no reports
        }

        // Process assessment reports
        console.log("📊 Processing assessment reports...");
        const assessmentGroups = new Map();
        assessmentResults.forEach(result => {
            const studentName = safeText(result.studentName || result.student || result.studentName || 'Unknown Student');
            if (!assessmentGroups.has(studentName)) {
                assessmentGroups.set(studentName, []);
            }
            assessmentGroups.get(studentName).push(result);
        });

        // Add assessment reports to student map
        for (const [studentName, assessments] of assessmentGroups) {
            const sessionGroups = new Map();
            
            assessments.forEach(result => {
                const sessionKey = Math.floor(result.timestamp / 86400); // Group by day
                if (!sessionGroups.has(sessionKey)) {
                    sessionGroups.set(sessionKey, []);
                }
                sessionGroups.get(sessionKey).push(result);
            });
            
            if (reportsByStudent.has(studentName)) {
                // Student already in map, add assessments
                reportsByStudent.get(studentName).assessments = sessionGroups;
                reportsByStudent.get(studentName).hasReports = true;
                console.log(`✅ Added ${assessments.length} assessment(s) to existing student: ${studentName}`);
            } else {
                // Student has reports but wasn't in userChildren? Add them
                console.log(`📝 Adding ${studentName} to reports (found in assessment results but not in student list)`);
                reportsByStudent.set(studentName, { 
                    assessments: sessionGroups, 
                    monthly: new Map(),
                    studentData: null,
                    hasReports: true
                });
                // Also add to userChildren for consistency
                if (!userChildren.includes(studentName)) {
                    userChildren.push(studentName);
                    console.log(`➕ Added ${studentName} to userChildren list`);
                }
            }
        }

        // Process monthly reports
        console.log("📊 Processing monthly reports...");
        const monthlyGroups = new Map();
        monthlyResults.forEach(result => {
            const studentName = safeText(result.studentName || result.student || result.studentName || 'Unknown Student');
            if (!monthlyGroups.has(studentName)) {
                monthlyGroups.set(studentName, []);
            }
            monthlyGroups.get(studentName).push(result);
        });

        // Add monthly reports to student map
        for (const [studentName, monthlies] of monthlyGroups) {
            const sessionGroups = new Map();
            
            monthlies.forEach(result => {
                const sessionKey = Math.floor(result.timestamp / 86400); // Group by day
                if (!sessionGroups.has(sessionKey)) {
                    sessionGroups.set(sessionKey, []);
                }
                sessionGroups.get(sessionKey).push(result);
            });
            
            if (reportsByStudent.has(studentName)) {
                // Student already in map, add monthly reports
                reportsByStudent.get(studentName).monthly = sessionGroups;
                reportsByStudent.get(studentName).hasReports = true;
                console.log(`✅ Added ${monthlies.length} monthly report(s) to existing student: ${studentName}`);
            } else {
                // Student has reports but wasn't in userChildren? Add them
                console.log(`📝 Adding ${studentName} to reports (found in monthly results but not in student list)`);
                const existingData = reportsByStudent.get(studentName) || { assessments: new Map() };
                reportsByStudent.set(studentName, { 
                    ...existingData,
                    monthly: sessionGroups,
                    studentData: existingData.studentData || null,
                    hasReports: true
                });
                // Also add to userChildren for consistency
                if (!userChildren.includes(studentName)) {
                    userChildren.push(studentName);
                    console.log(`➕ Added ${studentName} to userChildren list`);
                }
            }
        }

        // DEBUG: Log which students will be shown
        console.log("📊 [LOAD REPORTS] Step 4: Final student display list:");
        let totalStudentsWithReports = 0;
        let totalStudentsWithoutReports = 0;
        
        for (const [studentName, data] of reportsByStudent) {
            const assessmentCount = Array.from(data.assessments.values()).flat().length;
            const monthlyCount = Array.from(data.monthly.values()).flat().length;
            const hasStudentData = !!data.studentData;
            const hasReports = data.hasReports || (assessmentCount > 0 || monthlyCount > 0);
            
            if (hasReports) {
                totalStudentsWithReports++;
                console.log(`   ✅ ${studentName}: ${assessmentCount} assessments, ${monthlyCount} monthly reports, Has data: ${hasStudentData}`);
            } else {
                totalStudentsWithoutReports++;
                console.log(`   ⏭️ ${studentName}: No reports yet (will still be displayed)`);
            }
        }
        
        console.log(`📊 Total students with reports: ${totalStudentsWithReports}`);
        console.log(`📊 Total students without reports: ${totalStudentsWithoutReports}`);
        console.log(`📊 Grand total students to display: ${reportsByStudent.size}`);

        // Create yearly archive accordion view - This will show ALL students
        if (reportContent) {
            console.log("📄 [LOAD REPORTS] Step 5: Creating HTML view...");
            const reportsHtml = createYearlyArchiveReportView(reportsByStudent);
            reportContent.innerHTML = reportsHtml;
            console.log("✅ HTML view created successfully");
        }
        
        // --- CACHE SAVING LOGIC ---
        try {
            const dataToCache = {
                timestamp: Date.now(),
                html: reportContent ? reportContent.innerHTML : '',
                userData: currentUserData,
                studentCount: userChildren.length,
                reportCount: assessmentResults.length + monthlyResults.length,
                studentsWithReports: totalStudentsWithReports,
                studentsWithoutReports: totalStudentsWithoutReports
            };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
            console.log("✅ Report data cached successfully.");
        } catch (e) {
            console.error("❌ Could not write to cache:", e);
        }
        // --- END CACHE SAVING ---

        if (authArea && reportArea) {
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
        }

        // Add buttons to welcome section
        addMessagesButton();
        addManualRefreshButton();
        addLogoutButton();
        
        // Setup real-time monitoring AFTER reports are loaded
        setupRealTimeMonitoring(parentPhone, userId);
        
        // Load initial referral data for the rewards dashboard tab
        loadReferralRewards(userId);
        
        // Load academics data
        loadAcademicsData();

    } catch (error) {
        console.error("❌ [LOAD REPORTS] Critical error loading reports:", error);
        console.error("❌ Error stack:", error.stack);
        
        if (reportContent) {
            reportContent.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-6xl mb-6">❌</div>
                    <h2 class="text-2xl font-bold text-red-800 mb-4">Error Loading Reports</h2>
                    <p class="text-gray-600 max-w-2xl mx-auto mb-6">
                        Sorry, there was an error loading your reports. Please try again.
                        <br><br>
                        <small class="text-red-500">Error: ${safeText(error.message)}</small>
                    </p>
                    <div class="bg-yellow-50 border border-yellow-300 rounded-lg p-6 mb-6 max-w-2xl mx-auto text-left">
                        <h3 class="font-bold text-yellow-800 mb-3">Debug Information:</h3>
                        <p class="text-sm text-yellow-700">
                            Parent Phone: ${safeText(parentPhone)}<br>
                            User ID: ${safeText(userId)}<br>
                            Found Students: ${userChildren.length}<br>
                            Error: ${safeText(error.message)}
                        </p>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button onclick="window.location.reload()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center">
                            <span class="mr-2">🔄</span> Reload Page
                        </button>
                        <button onclick="showComposeMessageModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center">
                            <span class="mr-2">💬</span> Contact Support
                        </button>
                        <button onclick="runReportSearchDiagnostics()" class="bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-all duration-200 flex items-center">
                            <span class="mr-2">🔧</span> Run Diagnostics
                        </button>
                    </div>
                </div>
            `;
        }
    } finally {
        if (authLoader) authLoader.classList.add("hidden");
        console.log("🏁 [LOAD REPORTS] Process completed");
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
// SECTION 18: INITIALIZATION - FIXED RELOADING ISSUE WITH ALL DEPENDENCIES
// ============================================================================

// Track auth state to prevent loops
let authStateInitialized = false;
let authChangeInProgress = false;
let lastAuthChangeTime = 0;
const AUTH_DEBOUNCE_MS = 1000; // Minimum 1 second between auth changes
let authUnsubscribe = null; // To store the unsubscribe function

// ============================================================================
// CRITICAL AUTHENTICATION FUNCTIONS (moved from SECTION 6 for initialization)
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

// Basic handleSignIn function for event listeners (full version is in SECTION 6)
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

    // Call the full implementation from SECTION 6
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

    // Call the full implementation from SECTION 6
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

    // Call the full implementation from SECTION 6
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

// ============================================================================
// MAIN INITIALIZATION FUNCTIONS
// ============================================================================

// Robust initialization with loop prevention
function initializeParentPortal() {
    console.log("🚀 Initializing parent portal with reload protection");
    
    // Setup Remember Me FIRST (before any other operations)
    setupRememberMe();
    
    // Inject custom CSS for animations
    injectCustomCSS();
    
    // Create country code dropdown when page loads
    createCountryCodeDropdown();
    
    // Set up all event listeners (before auth checks)
    setupEventListeners();
    
    // Setup global error handler
    setupGlobalErrorHandler();
    
    // Initialize auth with debouncing and loop prevention
    initializeAuthWithProtection();
    
    console.log("✅ Parent portal initialized with reload protection");
}

// Initialize auth with protection against loops
function initializeAuthWithProtection() {
    console.log("🔐 Setting up protected auth state listener");
    
    // Clean up any existing listener first
    if (authUnsubscribe && typeof authUnsubscribe === 'function') {
        console.log("🧹 Cleaning up previous auth listener");
        authUnsubscribe();
        authUnsubscribe = null;
    }
    
    // Setup a single, protected auth state listener
    authUnsubscribe = auth.onAuthStateChanged(handleAuthStateChangeProtected);
    
    // Also check initial state after a short delay
    setTimeout(() => {
        const user = auth.currentUser;
        if (user && !authStateInitialized) {
            console.log("🔄 Checking initial auth state");
            handleAuthStateChangeProtected(user);
        }
    }, 100);
}

// Protected auth state change handler with debouncing
function handleAuthStateChangeProtected(user) {
    const now = Date.now();
    const timeSinceLastChange = now - lastAuthChangeTime;
    
    // Prevent rapid auth state changes (debouncing)
    if (authChangeInProgress) {
        console.log("⏸️ Auth change already in progress, skipping");
        return;
    }
    
    if (timeSinceLastChange < AUTH_DEBOUNCE_MS) {
        console.log("⏸️ Debouncing auth change (too soon)");
        setTimeout(() => handleAuthStateChangeProtected(user), AUTH_DEBOUNCE_MS - timeSinceLastChange);
        return;
    }
    
    // Mark that we're processing an auth change
    authChangeInProgress = true;
    lastAuthChangeTime = now;
    
    try {
        console.log(`🔄 Auth state change: ${user ? 'SIGNED IN' : 'SIGNED OUT'}`, 
                    user ? `(UID: ${user.uid.substring(0, 8)}...)` : '');
        
        if (user) {
            handleUserSignedIn(user);
        } else {
            handleUserSignedOut();
        }
        
        authStateInitialized = true;
        
    } catch (error) {
        console.error("❌ Auth state change error:", error);
        showMessage('Authentication error. Please try refreshing the page.', 'error');
    } finally {
        // Reset the flag after a minimum delay
        setTimeout(() => {
            authChangeInProgress = false;
        }, 500);
    }
}

// Handle user sign in (protected)
function handleUserSignedIn(user) {
    console.log("👤 User signed in, loading dashboard...");
    
    const authArea = document.getElementById("authArea");
    const reportArea = document.getElementById("reportArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");
    
    // Hide auth area, show dashboard
    if (authArea && reportArea) {
        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
    }
    
    // Hide loader if present
    if (authLoader) {
        authLoader.classList.add("hidden");
    }
    
    // Update welcome message immediately
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome!`;
    }
    
    // Store auth state (but don't rely on it for critical decisions)
    localStorage.setItem('isAuthenticated', 'true');
    
    // Get user data and load reports
    db.collection('parent_users').doc(user.uid).get()
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                const userPhone = userData.phone;
                const normalizedPhone = userData.normalizedPhone;
                
                // Update welcome message with actual name
                if (welcomeMessage && userData.parentName) {
                    welcomeMessage.textContent = `Welcome, ${safeText(userData.parentName)}!`;
                }
                
                // Load reports
                loadAllReportsForParent(normalizedPhone || userPhone, user.uid);
                
                // Add navigation buttons
                setTimeout(() => {
                    addMessagesButton();
                    addManualRefreshButton();
                    addLogoutButton();
                }, 300);
                
            } else {
                console.error("User document not found in Firestore");
                showMessage('User profile not found. Please contact support.', 'error');
            }
        })
        .catch((error) => {
            console.error('Error getting user data:', error);
            showMessage('Could not load user data. Please try again.', 'error');
        });
}

// Handle user sign out (protected)
function handleUserSignedOut() {
    console.log("🚪 User signed out, showing login form");
    
    const authArea = document.getElementById("authArea");
    const reportArea = document.getElementById("reportArea");
    const authLoader = document.getElementById("authLoader");
    
    // Clean up real-time listeners FIRST
    cleanupRealTimeListeners();
    
    // Clear auth state from localStorage
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('savedEmail'); // Also clear saved email for security
    
    // Show auth area, hide dashboard
    if (authArea && reportArea) {
        authArea.classList.remove("hidden");
        reportArea.classList.add("hidden");
    }
    
    // Hide loader if present
    if (authLoader) {
        authLoader.classList.add("hidden");
    }
    
    // Reset form fields
    const loginIdentifier = document.getElementById('loginIdentifier');
    const loginPassword = document.getElementById('loginPassword');
    
    if (loginPassword) loginPassword.value = '';
    
    // Don't clear identifier if remember me is checked
    const rememberMe = document.getElementById('rememberMe');
    if (loginIdentifier && (!rememberMe || !rememberMe.checked)) {
        loginIdentifier.value = '';
    }
    
    // Switch to sign in tab
    switchTab('signin');
    
    console.log("✅ User signed out cleanly");
}

// Setup all event listeners
function setupEventListeners() {
    console.log("🔧 Setting up event listeners");
    
    // Authentication buttons
    const signInBtn = document.getElementById("signInBtn");
    const signUpBtn = document.getElementById("signUpBtn");
    const sendResetBtn = document.getElementById("sendResetBtn");
    const submitMessageBtn = document.getElementById("submitMessageBtn");
    
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
    
    if (submitMessageBtn) {
        submitMessageBtn.removeEventListener("click", submitMessage);
        submitMessageBtn.addEventListener("click", submitMessage);
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
    
    // Dynamic button handlers (event delegation)
    setupDynamicEventDelegation();
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

// Dynamic event delegation for buttons created after page load
function setupDynamicEventDelegation() {
    document.addEventListener('click', function(event) {
        // Check if cancel message button was clicked
        if (event.target.id === 'cancelMessageBtn' || 
            event.target.closest('#cancelMessageBtn')) {
            event.preventDefault();
            hideComposeMessageModal();
        }
        
        // Check if cancel messages modal button was clicked
        if (event.target.id === 'cancelMessagesModalBtn' ||
            event.target.closest('#cancelMessagesModalBtn')) {
            event.preventDefault();
            hideMessagesModal();
        }
        
        // Check if manual refresh button was clicked
        if (event.target.id === 'manualRefreshBtn' ||
            event.target.closest('#manualRefreshBtn')) {
            event.preventDefault();
            const user = auth.currentUser;
            if (user) {
                manualRefreshReports();
            }
        }
        
        // Check if view messages button was clicked
        if (event.target.id === 'viewMessagesBtn' ||
            event.target.closest('#viewMessagesBtn')) {
            event.preventDefault();
            showMessagesModal();
        }
        
        // Check if compose message button was clicked
        if (event.target.id === 'composeMessageBtn' ||
            event.target.closest('#composeMessageBtn')) {
            event.preventDefault();
            showComposeMessageModal();
        }
    });
}

// Setup global error handler
function setupGlobalErrorHandler() {
    // Prevent unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault(); // Prevent browser error reporting
    });
    
    // Global error handler
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        // Don't show error messages for auth-related errors to avoid loops
        if (!e.error?.message?.includes('auth') && 
            !e.error?.message?.includes('permission-denied')) {
            showMessage('An unexpected error occurred. Please refresh the page.', 'error');
        }
        e.preventDefault(); // Prevent default error handling
    });
    
    // Network error handling
    window.addEventListener('offline', function() {
        console.warn('Network offline');
        showMessage('You are offline. Some features may not work.', 'warning');
    });
    
    window.addEventListener('online', function() {
        console.log('Network back online');
        showMessage('Connection restored.', 'success');
    });
}

// Cleanup function for page unload
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
// WRAPPER FUNCTIONS TO CALL FULL IMPLEMENTATIONS FROM SECTION 6
// ============================================================================

// Now we need to update SECTION 6 to rename the original functions and add wrapper calls

// In SECTION 6, rename the original functions:
// 1. Change "async function handleSignIn()" to "async function handleSignInFull(identifier, password, signInBtn, authLoader)"
// 2. Change "async function handleSignUp()" to "async function handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader)"
// 3. Change "async function handlePasswordReset()" to "async function handlePasswordResetFull(email, sendResetBtn, resetLoader)"

// ============================================================================
// PAGE INITIALIZATION
// ============================================================================

// Initialize the page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM Content Loaded - Starting robust initialization");
    
    // Setup cleanup before page unload
    window.addEventListener('beforeunload', cleanupBeforeUnload);
    window.addEventListener('pagehide', cleanupBeforeUnload);
    
    // Initialize the portal
    initializeParentPortal();
    
    console.log("🎉 Parent portal initialization complete");
});
