// firebaseParentConfig.js - Use CommonJS format
var firebaseParentConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};
};
document.head.appendChild(firebaseConfigScript);

const db = firebase.firestore();
const auth = firebase.auth();

// Load libphonenumber-js for phone number validation
const libphonenumberScript = document.createElement('script');
libphonenumberScript.src = 'https://cdn.jsdelivr.net/npm/libphonenumber-js@1.10.14/bundle/libphonenumber-js.min.js';
document.head.appendChild(libphonenumberScript);

// Add this function to create the country dropdown
function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone').parentNode;
    
    // Create container for country code and phone number
    const container = document.createElement('div');
    container.className = 'flex gap-2';
    
    // Create country code dropdown
    const countryCodeSelect = document.createElement('select');
    countryCodeSelect.id = 'countryCode';
    countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    countryCodeSelect.required = true;
    
    // Country codes list (40 countries with USA/Canada as default)
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
    
    // Add options to dropdown
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countryCodeSelect.appendChild(option);
    });
    
    // Set USA/Canada as default
    countryCodeSelect.value = '+1';
    
    // Get the existing phone input
    const phoneInput = document.getElementById('signupPhone');
    phoneInput.placeholder = 'Enter phone number without country code';
    phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    
    // Replace the original input with new structure
    container.appendChild(countryCodeSelect);
    container.appendChild(phoneInput);
    phoneInputContainer.appendChild(container);
}

// ENHANCED MULTI-NORMALIZATION FUNCTION FOR ALL COUNTRIES
function multiNormalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, country: null, valid: false, error: 'Invalid input' };
    }

    console.log("🔧 Starting multi-normalization for:", phone);
    
    const normalizationAttempts = [];
    
    try {
        // Clean the phone number - remove all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // ATTEMPT 1: Standard normalization (current logic)
        let attempt1 = null;
        try {
            const parsed1 = libphonenumber.parsePhoneNumberFromString(cleaned);
            if (parsed1 && parsed1.isValid()) {
                attempt1 = {
                    normalized: parsed1.format('E.164'),
                    country: parsed1.country,
                    valid: true,
                    attempt: 'standard'
                };
                normalizationAttempts.push(attempt1);
                console.log("🔧 Attempt 1 (Standard):", attempt1.normalized);
            }
        } catch (e) {
            console.log("🔧 Attempt 1 failed:", e.message);
        }

        // ATTEMPT 2: Country code correction for common patterns
        let attempt2 = null;
        try {
            // US/Canada patterns
            if (cleaned.match(/^(1)?(469|214|972|713|281|832|210|817)/) && !cleaned.startsWith('+')) {
                const usNumber = '+1' + cleaned.replace(/^1/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(usNumber);
                if (parsed2 && parsed2.isValid()) {
                    attempt2 = {
                        normalized: parsed2.format('E.164'),
                        country: parsed2.country,
                        valid: true,
                        attempt: 'us_correction'
                    };
                    normalizationAttempts.push(attempt2);
                    console.log("🔧 Attempt 2 (US Correction):", attempt2.normalized);
                }
            }
            
            // UK patterns
            if (cleaned.match(/^(44)?(20|7|1|2|3|8|9)/) && !cleaned.startsWith('+')) {
                const ukNumber = '+44' + cleaned.replace(/^44/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(ukNumber);
                if (parsed2 && parsed2.isValid()) {
                    attempt2 = {
                        normalized: parsed2.format('E.164'),
                        country: parsed2.country,
                        valid: true,
                        attempt: 'uk_correction'
                    };
                    normalizationAttempts.push(attempt2);
                    console.log("🔧 Attempt 2 (UK Correction):", attempt2.normalized);
                }
            }
            
            // Nigeria patterns
            if (cleaned.match(/^(234)?(80|70|81|90|91)/) && !cleaned.startsWith('+')) {
                const ngNumber = '+234' + cleaned.replace(/^234/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(ngNumber);
                if (parsed2 && parsed2.isValid()) {
                    attempt2 = {
                        normalized: parsed2.format('E.164'),
                        country: parsed2.country,
                        valid: true,
                        attempt: 'nigeria_correction'
                    };
                    normalizationAttempts.push(attempt2);
                    console.log("🔧 Attempt 2 (Nigeria Correction):", attempt2.normalized);
                }
            }
        } catch (e) {
            console.log("🔧 Attempt 2 failed:", e.message);
        }

        // ATTEMPT 3: Area code only (for numbers that lost country code)
        let attempt3 = null;
        try {
            // Common area codes that might be missing country codes
            const areaCodePatterns = [
                { code: '1', patterns: [/^(469|214|972|713|281|832|210|817)/] }, // US
                { code: '44', patterns: [/^(20|7|1|2|3|8|9)/] }, // UK
                { code: '234', patterns: [/^(80|70|81|90|91)/] }, // Nigeria
                { code: '33', patterns: [/^(1|2|3|4|5)/] }, // France
                { code: '49', patterns: [/^(15|16|17|17)/] }, // Germany
                { code: '91', patterns: [/^(98|99|90|80)/] }, // India
            ];
            
            for (const country of areaCodePatterns) {
                for (const pattern of country.patterns) {
                    if (pattern.test(cleaned) && !cleaned.startsWith('+')) {
                        const correctedNumber = '+' + country.code + cleaned;
                        const parsed3 = libphonenumber.parsePhoneNumberFromString(correctedNumber);
                        if (parsed3 && parsed3.isValid()) {
                            attempt3 = {
                                normalized: parsed3.format('E.164'),
                                country: parsed3.country,
                                valid: true,
                                attempt: 'area_code_correction'
                            };
                            normalizationAttempts.push(attempt3);
                            console.log("🔧 Attempt 3 (Area Code Correction):", attempt3.normalized);
                            break;
                        }
                    }
                }
                if (attempt3) break;
            }
        } catch (e) {
            console.log("🔧 Attempt 3 failed:", e.message);
        }

        // ATTEMPT 4: Digits only (fallback)
        let attempt4 = null;
        try {
            const digitsOnly = cleaned.replace(/\D/g, '');
            if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
                attempt4 = {
                    normalized: digitsOnly,
                    country: null,
                    valid: true,
                    attempt: 'digits_only'
                };
                normalizationAttempts.push(attempt4);
                console.log("🔧 Attempt 4 (Digits Only):", attempt4.normalized);
            }
        } catch (e) {
            console.log("🔧 Attempt 4 failed:", e.message);
        }

        // Return all valid normalization attempts
        if (normalizationAttempts.length > 0) {
            console.log("🎯 Multi-normalization results:", normalizationAttempts.map(a => a.normalized));
            return normalizationAttempts;
        }

        return [{ 
            normalized: null, 
            country: null, 
            valid: false, 
            error: 'No valid normalization found',
            attempt: 'failed'
        }];
        
    } catch (error) {
        console.error("❌ Multi-normalization error:", error);
        return [{ 
            normalized: null, 
            country: null, 
            valid: false, 
            error: error.message,
            attempt: 'error'
        }];
    }
}

// Simple phone cleaning - fallback if library not loaded
function cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.trim();
}

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Global variables for user data
let currentUserData = null;
let userChildren = [];
let unreadResponsesCount = 0; // Track unread responses
let realTimeListeners = []; // Track real-time listeners
let childRealTimeListeners = {}; // Track per-child listeners

// -------------------------------------------------------------------
// START: NEW REFERRAL SYSTEM FUNCTIONS (PHASE 1 & 3)
// -------------------------------------------------------------------

/**
 * Generates a unique, alphanumeric referral code prefixed with 'BKH'.
 * Checks for uniqueness in the parent_users collection.
 * @returns {string} A unique referral code (e.g., BKH7A3X9M)
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
    return code;
}

/**
 * Loads the parent's referral data for the Rewards Dashboard.
 * @param {string} parentUid The UID of the current parent user.
 */
async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';

    try {
        // 1. Get the parent's referral code and current earnings
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) {
            rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found. Please sign in again.</p>';
            return;
        }
        const userData = userDoc.data();
        const referralCode = userData.referralCode || 'N/A';
        const totalEarnings = userData.referralEarnings || 0;
        
        // 2. Query the referral_transactions collection for all transactions belonging to this code owner
        const transactionsSnapshot = await db.collection('referral_transactions')
            .where('ownerUid', '==', parentUid)
            .orderBy('timestamp', 'desc')
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
                        <td class="px-4 py-3 text-sm">
                            <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                                ${capitalize(status)}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${rewardAmount}</td>
                    </tr>
                `;
            });
        }
        
        // Display the dashboard
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
                    <p class="text-sm font-medium text-yellow-700">Approved Rewards (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600">
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

// -------------------------------------------------------------------
// END: NEW REFERRAL SYSTEM FUNCTIONS
// -------------------------------------------------------------------

// Remember Me Functionality
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

// Find parent name from students collection (SAME AS TUTOR.JS)
async function findParentNameFromStudents(parentPhone) {
    try {
        console.log("Searching for parent name with phone:", parentPhone);
        
        // Use multi-normalization to get all possible phone versions
        const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
        const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
        
        // Search with each normalized version
        for (const version of validVersions) {
            console.log(`🔍 Searching parent name with: ${version.normalized} (${version.attempt})`);
            
            // PRIMARY SEARCH: students collection
            const studentsSnapshot = await db.collection("students")
                .where("normalizedParentPhone", "==", version.normalized)
                .limit(1)
                .get();

            if (!studentsSnapshot.empty) {
                const studentDoc = studentsSnapshot.docs[0];
                const studentData = studentDoc.data();
                const parentName = studentData.parentName;
                
                if (parentName) {
                    console.log("Found parent name in students collection:", parentName);
                    return parentName;
                }
            }

            // SECONDARY SEARCH: pending_students collection
            const pendingStudentsSnapshot = await db.collection("pending_students")
                .where("normalizedParentPhone", "==", version.normalized)
                .limit(1)
                .get();

            if (!pendingStudentsSnapshot.empty) {
                const pendingStudentDoc = pendingStudentsSnapshot.docs[0];
                const pendingStudentData = pendingStudentDoc.data();
                const parentName = pendingStudentData.parentName;
                
                if (parentName) {
                    console.log("Found parent name in pending_students collection:", parentName);
                    return parentName;
                }
            }

            // FALLBACK SEARCH: original phone fields
            const fallbackStudentsSnapshot = await db.collection("students")
                .where("parentPhone", "==", version.normalized)
                .limit(1)
                .get();

            if (!fallbackStudentsSnapshot.empty) {
                const studentDoc = fallbackStudentsSnapshot.docs[0];
                const studentData = studentDoc.data();
                const parentName = studentData.parentName;
                
                if (parentName) {
                    console.log("Found parent name in students collection (fallback):", parentName);
                    return parentName;
                }
            }
        }

        console.log("No parent name found in any collection with any normalization");
        return null;
    } catch (error) {
        console.error("Error finding parent name:", error);
        return null;
    }
}

// Authentication Functions
async function handleSignUp() {
    const countryCode = document.getElementById('countryCode').value;
    const localPhone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

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

    // Combine country code with local phone number
    const fullPhoneNumber = countryCode + localPhone.replace(/\D/g, '');
    
    // Use multi-normalization for phone validation
    const phoneValidations = multiNormalizePhoneNumber(fullPhoneNumber);
    const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
    
    if (validVersions.length === 0) {
        showMessage('Invalid phone number format. Please check your phone number.', 'error');
        return;
    }

    // Use the first valid normalized version
    const normalizedPhone = validVersions[0].normalized;

    const signUpBtn = document.getElementById('signUpBtn');
    const authLoader = document.getElementById('authLoader');

    signUpBtn.disabled = true;
    document.getElementById('signUpText').textContent = 'Creating Account...';
    document.getElementById('signUpSpinner').classList.remove('hidden');
    authLoader.classList.remove('hidden');

    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Find parent name from existing data (SAME SOURCE AS TUTOR.JS)
        const parentName = await findParentNameFromStudents(normalizedPhone);
        
        // Generate referral code
        const referralCode = await generateReferralCode();

        // Store user data in Firestore for easy retrieval
        await db.collection('parent_users').doc(user.uid).set({
            phone: fullPhoneNumber, // Store full number with country code
            normalizedPhone: normalizedPhone, // Store normalized version
            countryCode: countryCode, // Store selected country code
            localPhone: localPhone, // Store local number part
            email: email,
            parentName: parentName || 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
        });

        showMessage('Account created successfully!', 'success');
        
        // Automatically load reports after signup
        await loadParentDashboard(user.uid);

    } catch (error) {
        console.error('Sign up error:', error);
        let errorMessage = 'Account creation failed. ';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'Email address is already in use.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Email address is invalid.';
                break;
            case 'auth/weak-password':
                errorMessage += 'Password is too weak.';
                break;
            default:
                errorMessage += 'Please try again.';
        }
        
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
        let userCredential;
        let userPhone;
        let userId;
        let normalizedPhone;
        
        // Determine if identifier is email or phone
        if (identifier.includes('@')) {
            // Sign in with email
            userCredential = await auth.signInWithEmailAndPassword(identifier, password);
            userId = userCredential.user.uid;
            // Get phone from user profile
            const userDoc = await db.collection('parent_users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userPhone = userData.phone;
                normalizedPhone = userData.normalizedPhone;
            }
        } else {
            // Sign in with phone - use multi-normalization
            const phoneValidations = multiNormalizePhoneNumber(identifier);
            const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
            
            if (validVersions.length === 0) {
                throw new Error(`Invalid phone number format. Please try with country code (like +1234567890) or local format`);
            }
            
            normalizedPhone = validVersions[0].normalized;
            
            // Find user by any normalized phone version
            let userFound = false;
            for (const version of validVersions) {
                const userQuery = await db.collection('parent_users')
                    .where('normalizedPhone', '==', version.normalized)
                    .limit(1)
                    .get();

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
                // Fallback: search by original phone field
                const fallbackQuery = await db.collection('parent_users')
                    .where('phone', '==', identifier)
                    .limit(1)
                    .get();
                    
                if (fallbackQuery.empty) {
                    throw new Error('No account found with this phone number');
                }
                
                const userData = fallbackQuery.docs[0].data();
                userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
                userPhone = identifier;
                userId = userCredential.user.uid;
            }
        }

        if (!normalizedPhone && userPhone) {
            // Normalize the phone if we have it
            const phoneValidations = multiNormalizePhoneNumber(userPhone);
            const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
            if (validVersions.length > 0) {
                normalizedPhone = validVersions[0].normalized;
            }
        }

        if (!normalizedPhone) {
            throw new Error('Could not retrieve valid phone number for user');
        }
        
        // Handle Remember Me
        handleRememberMe();
        
        // Load parent dashboard
        await loadParentDashboard(userId);

    } catch (error) {
        console.error('Sign in error:', error);
        let errorMessage = 'Sign in failed. ';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account found with these credentials.';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email format.';
                break;
            default:
                errorMessage += error.message || 'Please check your credentials and try again.';
        }
        
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
        showMessage('Password reset link sent to your email. Please check your inbox.', 'success');
        document.getElementById('passwordResetModal').classList.add('hidden');
    } catch (error) {
        console.error('Password reset error:', error);
        let errorMessage = 'Failed to send reset email. ';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account found with this email address.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address.';
                break;
            default:
                errorMessage += 'Please try again.';
        }
        
        showMessage(errorMessage, 'error');
    } finally {
        sendResetBtn.disabled = false;
        resetLoader.classList.add('hidden');
    }
}

// ============================================
// NEW FEATURES: HELPER FUNCTIONS
// ============================================

// Format time function
function formatTime(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        let date;
        if (dateString.toDate) {
            date = dateString.toDate();
        } else if (typeof dateString === 'string') {
            date = new Date(dateString);
        } else if (dateString.seconds) {
            date = new Date(dateString.seconds * 1000);
        } else {
            date = new Date(dateString);
        }
        
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        console.error('Error formatting time:', error);
        return 'Invalid Time';
    }
}

// Format date function
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        let date;
        if (dateString.toDate) {
            date = dateString.toDate();
        } else if (dateString.seconds) {
            date = new Date(dateString.seconds * 1000);
        } else {
            date = new Date(dateString);
        }
        
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
}

// Format date without time
function formatDateOnly(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        let date;
        if (dateString.toDate) {
            date = dateString.toDate();
        } else if (dateString.seconds) {
            date = new Date(dateString.seconds * 1000);
        } else {
            date = new Date(dateString);
        }
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
}

// Get days remaining until due date
function getDaysRemaining(dueDate) {
    if (!dueDate) return null;
    
    try {
        let date;
        if (dueDate.toDate) {
            date = dueDate.toDate();
        } else if (dueDate.seconds) {
            date = new Date(dueDate.seconds * 1000);
        } else {
            date = new Date(dueDate);
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        
        const diffTime = date - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    } catch (error) {
        console.error('Error calculating days remaining:', error);
        return null;
    }
}

// Get homework status badge color
function getHomeworkStatusColor(status) {
    const colors = {
        'assigned': 'bg-blue-100 text-blue-800',
        'submitted': 'bg-yellow-100 text-yellow-800',
        'graded': 'bg-green-100 text-green-800',
        'overdue': 'bg-red-100 text-red-800',
        'completed': 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

// Format time from string (HH:MM)
function formatTimeFromString(timeString) {
    if (!timeString) return 'N/A';
    
    try {
        const [hours, minutes] = timeString.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        return timeString;
    }
}

// ============================================
// TODAY'S TOPICS MANAGEMENT
// ============================================

async function loadTodaysTopics(studentId, studentName) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    try {
        // Get today's topics
        const topicsSnapshot = await db.collection('daily_topics')
            .where('studentId', '==', studentId)
            .where('date', '>=', today)
            .where('date', '<', tomorrow)
            .orderBy('date', 'desc')
            .get();
        
        // Get past week's topics for history
        const historySnapshot = await db.collection('daily_topics')
            .where('studentId', '==', studentId)
            .where('date', '>=', weekAgo)
            .where('date', '<', today)
            .orderBy('date', 'desc')
            .get();
        
        let topicsContent = '';
        
        // Today's topics
        if (!topicsSnapshot.empty) {
            topicsSnapshot.forEach(doc => {
                const topic = doc.data();
                const formattedDate = formatDate(topic.date);
                
                topicsContent += `
                    <div class="bg-white border border-green-200 rounded-lg p-4 mb-3 shadow-sm">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-semibold text-green-700">${formattedDate}</h4>
                            <span class="text-sm text-gray-500">${topic.tutorName || 'Tutor'}</span>
                        </div>
                        <div class="topic-content">
                            ${topic.topics ? topic.topics.split('\n').map(line => 
                                `<p class="text-gray-700 mb-1">• ${line}</p>`
                            ).join('') : '<p class="text-gray-500">No topics listed</p>'}
                        </div>
                        ${topic.notes ? `
                            <div class="mt-3 pt-3 border-t">
                                <p class="text-sm text-gray-600"><strong>Tutor Notes:</strong> ${topic.notes}</p>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        } else {
            topicsContent = `
                <div class="text-center py-6">
                    <div class="text-4xl mb-3">📚</div>
                    <p class="text-gray-500">No topics recorded for today</p>
                </div>
            `;
        }
        
        // Historical topics
        let historyContent = '';
        if (!historySnapshot.empty) {
            historySnapshot.forEach(doc => {
                const topic = doc.data();
                const formattedDate = formatDate(topic.date);
                
                historyContent += `
                    <div class="border-b border-gray-100 py-3">
                        <div class="flex justify-between items-start">
                            <span class="font-medium text-gray-700">${formattedDate}</span>
                            <span class="text-xs text-gray-500">${topic.tutorName || ''}</span>
                        </div>
                        <p class="text-sm text-gray-600 mt-1 truncate">
                            ${topic.topics ? topic.topics.replace(/\n/g, ', ') : 'No topics'}
                        </p>
                    </div>
                `;
            });
        } else {
            historyContent = '<p class="text-gray-500 text-center py-4">No recent topics</p>';
        }
        
        // Create topics section
        const topicsSection = `
            <div class="mb-8">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-green-800">Today's Topics</h3>
                    <button onclick="showTopicsHistory('${studentId}', '${studentName}')" 
                            class="text-sm text-green-600 hover:text-green-800 font-medium">
                        View History →
                    </button>
                </div>
                
                <div id="todaysTopics-${studentId}">
                    ${topicsContent}
                </div>
                
                <div class="mt-6">
                    <h4 class="font-semibold text-gray-700 mb-3">Recent Topics (Last 7 Days)</h4>
                    <div class="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                        ${historyContent}
                    </div>
                </div>
            </div>
        `;
        
        // Add real-time listener for new topics
        setupTopicsListener(studentId);
        
        return topicsSection;
    } catch (error) {
        console.error('Error loading topics:', error);
        return `
            <div class="mb-8">
                <h3 class="text-lg font-bold text-green-800 mb-4">Today's Topics</h3>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-600">Error loading topics. Please try again.</p>
                </div>
            </div>
        `;
    }
}

function setupTopicsListener(studentId) {
    if (childRealTimeListeners[`topics-${studentId}`]) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const listener = db.collection('daily_topics')
        .where('studentId', '==', studentId)
        .where('date', '>=', today)
        .where('date', '<', tomorrow)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    showNotification('New topic added for today!', 'info');
                    // Update topic count
                    updateTopicCount(studentId, snapshot.size);
                }
            });
        });
    
    childRealTimeListeners[`topics-${studentId}`] = listener;
    realTimeListeners.push(listener);
}

function updateTopicCount(studentId, count) {
    const countElement = document.getElementById(`topicCount-${studentId}`);
    if (countElement) {
        countElement.textContent = `${count} topic${count !== 1 ? 's' : ''}`;
    }
}

function showTopicsHistory(studentId, studentName) {
    const modal = document.createElement('div');
    modal.id = 'topicsHistoryModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div class="flex justify-between items-center border-b p-6">
                <h3 class="text-xl font-bold text-green-800">Topic History - ${studentName}</h3>
                <button onclick="document.getElementById('topicsHistoryModal').remove()" 
                        class="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1">
                <div id="topicsHistoryContent" class="space-y-4">
                    <div class="text-center py-8">
                        <div class="loading-spinner mx-auto"></div>
                        <p class="text-green-600 font-semibold mt-4">Loading history...</p>
                    </div>
                </div>
            </div>
            
            <div class="border-t p-4 flex justify-between">
                <div class="text-sm text-gray-500">
                    Showing last 30 days of topics
                </div>
                <button onclick="document.getElementById('topicsHistoryModal').remove()" 
                        class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load history data
    loadTopicsHistory(studentId);
}

async function loadTopicsHistory(studentId) {
    const content = document.getElementById('topicsHistoryContent');
    
    try {
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        
        const snapshot = await db.collection('daily_topics')
            .where('studentId', '==', studentId)
            .where('date', '>=', monthAgo)
            .orderBy('date', 'desc')
            .get();
        
        if (snapshot.empty) {
            content.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-4xl mb-4">📚</div>
                    <h4 class="text-lg font-semibold text-gray-700 mb-2">No Topic History</h4>
                    <p class="text-gray-500">No topics have been recorded in the last 30 days.</p>
                </div>
            `;
            return;
        }
        
        let historyHTML = '';
        let currentDate = '';
        
        snapshot.forEach(doc => {
            const topic = doc.data();
            const topicDate = topic.date.toDate();
            const dateString = topicDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            if (dateString !== currentDate) {
                historyHTML += `
                    <div class="border-t border-gray-200 pt-4 mt-4">
                        <h4 class="font-bold text-green-700 text-lg mb-2">${dateString}</h4>
                `;
                currentDate = dateString;
            }
            
            historyHTML += `
                <div class="ml-4 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div class="flex justify-between items-start mb-2">
                        <span class="font-medium text-gray-800">Tutor: ${topic.tutorName || 'N/A'}</span>
                        <span class="text-sm text-gray-500">${formatTime(topic.date)}</span>
                    </div>
                    <div class="topic-content whitespace-pre-line text-gray-700">
                        ${topic.topics || 'No topics listed'}
                    </div>
                    ${topic.notes ? `
                        <div class="mt-2 pt-2 border-t border-gray-200">
                            <p class="text-sm text-gray-600"><strong>Notes:</strong> ${topic.notes}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        content.innerHTML = historyHTML;
    } catch (error) {
        console.error('Error loading topics history:', error);
        content.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-600">Error loading topic history. Please try again.</p>
            </div>
        `;
    }
}

// ============================================
// HOMEWORK MANAGEMENT
// ============================================

async function loadHomeworkAssignments(studentId, studentName) {
    try {
        // Get active assignments
        const snapshot = await db.collection('homework_assignments')
            .where('studentId', '==', studentId)
            .orderBy('dueDate', 'asc')
            .get();
        
        if (snapshot.empty) {
            return `
                <div class="mb-8">
                    <h3 class="text-lg font-bold text-green-800 mb-4">Homework Assignments</h3>
                    <div class="text-center py-8 bg-gray-50 rounded-lg">
                        <div class="text-4xl mb-3">📝</div>
                        <p class="text-gray-500">No homework assignments</p>
                        <p class="text-sm text-gray-400 mt-2">Check back later for new assignments</p>
                    </div>
                </div>
            `;
        }
        
        let assignmentsHTML = '';
        let pendingCount = 0;
        let overdueCount = 0;
        const today = new Date();
        
        snapshot.forEach(doc => {
            const assignment = { id: doc.id, ...doc.data() };
            const dueDate = assignment.dueDate?.toDate();
            const daysRemaining = getDaysRemaining(assignment.dueDate);
            let status = assignment.status || 'assigned';
            
            // Check if overdue
            if (dueDate && dueDate < today && status === 'assigned') {
                status = 'overdue';
                overdueCount++;
            }
            
            if (status === 'assigned') pendingCount++;
            
            const statusColor = getHomeworkStatusColor(status);
            const dueText = dueDate ? formatDateOnly(dueDate) : 'No due date';
            
            assignmentsHTML += `
                <div class="border border-gray-200 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-semibold text-gray-800">${assignment.title || 'Untitled Assignment'}</h4>
                        <span class="text-xs px-2 py-1 rounded-full ${statusColor}">
                            ${status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                    </div>
                    
                    <p class="text-gray-600 text-sm mb-3 line-clamp-2">
                        ${assignment.description || 'No description provided.'}
                    </p>
                    
                    <div class="flex flex-wrap justify-between items-center text-sm">
                        <div class="space-x-4">
                            <span class="text-gray-500">
                                <strong>Due:</strong> ${dueText}
                            </span>
                            ${daysRemaining !== null ? `
                                <span class="${daysRemaining <= 0 ? 'text-red-600' : 'text-green-600'}">
                                    ${daysRemaining <= 0 ? 'Overdue' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`}
                                </span>
                            ` : ''}
                        </div>
                        
                        <div class="flex gap-2 mt-2 sm:mt-0">
                            ${assignment.fileUrl ? `
                                <button onclick="downloadHomeworkFile('${assignment.fileUrl}', '${assignment.title || 'homework'}')" 
                                        class="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                                    <span class="mr-1">📎</span> Download
                                </button>
                            ` : ''}
                            <button onclick="viewHomeworkDetails('${studentId}', '${studentName}', '${doc.id}')" 
                                    class="text-green-600 hover:text-green-800 text-sm font-medium">
                                View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Add notification badges
        let notificationHTML = '';
        if (overdueCount > 0) {
            notificationHTML += `
                <span class="ml-2 bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">
                    ${overdueCount} overdue
                </span>
            `;
        }
        if (pendingCount > 0) {
            notificationHTML += `
                <span class="ml-2 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">
                    ${pendingCount} pending
                </span>
            `;
        }
        
        // Update homework count
        const totalCount = pendingCount + overdueCount;
        updateHomeworkCount(studentId, totalCount);
        
        return `
            <div class="mb-8">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-green-800 flex items-center">
                        Homework Assignments
                        ${notificationHTML}
                    </h3>
                    <button onclick="showAllHomework('${studentId}', '${studentName}')" 
                            class="text-sm text-green-600 hover:text-green-800 font-medium">
                        View All →
                    </button>
                </div>
                
                <div id="homeworkList-${studentId}">
                    ${assignmentsHTML}
                </div>
                
                <div class="mt-4 text-center">
                    <button onclick="toggleEmailReminders('${studentId}')" 
                            id="emailToggle-${studentId}"
                            class="text-sm text-gray-600 hover:text-gray-800">
                        ⏰ Email reminders: <span id="emailStatus-${studentId}">Enabled</span>
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading homework:', error);
        return `
            <div class="mb-8">
                <h3 class="text-lg font-bold text-green-800 mb-4">Homework Assignments</h3>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-600">Error loading homework assignments.</p>
                </div>
            </div>
        `;
    }
}

function downloadHomeworkFile(fileUrl, fileName) {
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'homework_file';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function viewHomeworkDetails(studentId, studentName, homeworkId) {
    const modal = document.createElement('div');
    modal.id = 'homeworkDetailsModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div class="flex justify-between items-center border-b p-6">
                <h3 class="text-xl font-bold text-green-800">Homework Details</h3>
                <button onclick="document.getElementById('homeworkDetailsModal').remove()" 
                        class="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1">
                <div id="homeworkDetailsContent">
                    <div class="text-center py-8">
                        <div class="loading-spinner mx-auto"></div>
                        <p class="text-green-600 font-semibold mt-4">Loading details...</p>
                    </div>
                </div>
            </div>
            
            <div class="border-t p-4 flex justify-end">
                <button onclick="document.getElementById('homeworkDetailsModal').remove()" 
                        class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load homework details
    loadHomeworkDetails(studentId, homeworkId);
}

async function loadHomeworkDetails(studentId, homeworkId) {
    const content = document.getElementById('homeworkDetailsContent');
    
    try {
        const doc = await db.collection('homework_assignments').doc(homeworkId).get();
        
        if (!doc.exists) {
            content.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-600">Homework assignment not found.</p>
                </div>
            `;
            return;
        }
        
        const assignment = { id: doc.id, ...doc.data() };
        const dueDate = assignment.dueDate?.toDate();
        const assignedDate = assignment.assignedDate?.toDate();
        const daysRemaining = getDaysRemaining(assignment.dueDate);
        let status = assignment.status || 'assigned';
        
        if (dueDate && dueDate < new Date() && status === 'assigned') {
            status = 'overdue';
        }
        
        const statusColor = getHomeworkStatusColor(status);
        
        content.innerHTML = `
            <div class="space-y-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="text-xl font-bold text-gray-800">${assignment.title || 'Untitled Assignment'}</h4>
                        <p class="text-gray-500 mt-1">Assigned: ${assignedDate ? formatDate(assignedDate) : 'N/A'}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm font-semibold ${statusColor}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div>
                        <p class="text-sm text-gray-600">Due Date</p>
                        <p class="font-semibold">${dueDate ? formatDate(dueDate) : 'No due date'}</p>
                        ${daysRemaining !== null ? `
                            <p class="text-sm ${daysRemaining <= 0 ? 'text-red-600' : 'text-green-600'} mt-1">
                                ${daysRemaining <= 0 ? 'Overdue' : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
                            </p>
                        ` : ''}
                    </div>
                    <div>
                        <p class="text-sm text-gray-600">Assigned By</p>
                        <p class="font-semibold">${assignment.tutorName || 'Tutor'}</p>
                        <p class="text-sm text-gray-500">${assignment.tutorEmail || ''}</p>
                    </div>
                </div>
                
                <div>
                    <h5 class="font-semibold text-gray-700 mb-2">Description</h5>
                    <div class="bg-white border border-gray-200 rounded-lg p-4 whitespace-pre-line">
                        ${assignment.description || 'No description provided.'}
                    </div>
                </div>
                
                ${assignment.instructions ? `
                    <div>
                        <h5 class="font-semibold text-gray-700 mb-2">Instructions</h5>
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 whitespace-pre-line">
                            ${assignment.instructions}
                        </div>
                    </div>
                ` : ''}
                
                ${assignment.fileUrl ? `
                    <div>
                        <h5 class="font-semibold text-gray-700 mb-2">Attached Files</h5>
                        <div class="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <span class="text-2xl mr-3">📎</span>
                            <div class="flex-1">
                                <p class="font-medium text-gray-800">Homework File</p>
                                <p class="text-sm text-gray-500">Click download to save</p>
                            </div>
                            <button onclick="downloadHomeworkFile('${assignment.fileUrl}', '${assignment.title || 'homework'}')" 
                                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                                Download
                            </button>
                        </div>
                    </div>
                ` : ''}
                
                ${assignment.submission ? `
                    <div>
                        <h5 class="font-semibold text-gray-700 mb-2">Submission</h5>
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p class="text-gray-800"><strong>Submitted:</strong> ${formatDate(assignment.submission.submittedAt)}</p>
                            ${assignment.submission.notes ? `
                                <p class="text-gray-800 mt-2"><strong>Notes:</strong> ${assignment.submission.notes}</p>
                            ` : ''}
                            ${assignment.submission.fileUrl ? `
                                <div class="mt-3">
                                    <button onclick="downloadHomeworkFile('${assignment.submission.fileUrl}', 'submission')" 
                                            class="text-green-600 hover:text-green-800 font-medium">
                                        📥 Download Submission
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
                
                ${assignment.grade ? `
                    <div>
                        <h5 class="font-semibold text-gray-700 mb-2">Grading</h5>
                        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p class="text-gray-800"><strong>Grade:</strong> ${assignment.grade.score || 'N/A'}</p>
                            ${assignment.grade.feedback ? `
                                <p class="text-gray-800 mt-2"><strong>Feedback:</strong> ${assignment.grade.feedback}</p>
                            ` : ''}
                            <p class="text-sm text-gray-500 mt-2">Graded on: ${formatDate(assignment.grade.gradedAt)}</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        console.error('Error loading homework details:', error);
        content.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-600">Error loading homework details. Please try again.</p>
            </div>
        `;
    }
}

function showAllHomework(studentId, studentName) {
    const modal = document.createElement('div');
    modal.id = 'allHomeworkModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div class="flex justify-between items-center border-b p-6">
                <h3 class="text-xl font-bold text-green-800">All Homework - ${studentName}</h3>
                <button onclick="document.getElementById('allHomeworkModal').remove()" 
                        class="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1">
                <div class="mb-4 flex gap-2">
                    <button onclick="filterHomework('all')" class="filter-btn active px-4 py-2 rounded-lg bg-green-100 text-green-800">
                        All
                    </button>
                    <button onclick="filterHomework('pending')" class="filter-btn px-4 py-2 rounded-lg bg-gray-100 text-gray-800">
                        Pending
                    </button>
                    <button onclick="filterHomework('overdue')" class="filter-btn px-4 py-2 rounded-lg bg-red-100 text-red-800">
                        Overdue
                    </button>
                    <button onclick="filterHomework('completed')" class="filter-btn px-4 py-2 rounded-lg bg-purple-100 text-purple-800">
                        Completed
                    </button>
                </div>
                <div id="allHomeworkContent" class="space-y-4">
                    <div class="text-center py-8">
                        <div class="loading-spinner mx-auto"></div>
                        <p class="text-green-600 font-semibold mt-4">Loading homework...</p>
                    </div>
                </div>
            </div>
            
            <div class="border-t p-4 flex justify-between">
                <div class="text-sm text-gray-500" id="homeworkCount">
                    
                </div>
                <button onclick="document.getElementById('allHomeworkModal').remove()" 
                        class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load all homework
    loadAllHomework(studentId);
}

async function loadAllHomework(studentId) {
    const content = document.getElementById('allHomeworkContent');
    
    try {
        const snapshot = await db.collection('homework_assignments')
            .where('studentId', '==', studentId)
            .orderBy('dueDate', 'desc')
            .get();
        
        if (snapshot.empty) {
            content.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-4xl mb-4">📝</div>
                    <h4 class="text-lg font-semibold text-gray-700 mb-2">No Homework Assignments</h4>
                    <p class="text-gray-500">No homework has been assigned yet.</p>
                </div>
            `;
            document.getElementById('homeworkCount').textContent = '0 assignments';
            return;
        }
        
        let assignments = [];
        snapshot.forEach(doc => {
            assignments.push({ id: doc.id, ...doc.data() });
        });
        
        // Update count
        document.getElementById('homeworkCount').textContent = `${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}`;
        
        // Render all assignments
        renderHomeworkList(assignments);
        
        // Setup filter functionality
        setupHomeworkFilters(assignments);
    } catch (error) {
        console.error('Error loading all homework:', error);
        content.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-600">Error loading homework. Please try again.</p>
            </div>
        `;
    }
}

function renderHomeworkList(assignments) {
    const content = document.getElementById('allHomeworkContent');
    const today = new Date();
    
    if (assignments.length === 0) {
        content.innerHTML = '<p class="text-gray-500 text-center py-8">No assignments match the filter.</p>';
        return;
    }
    
    let html = '';
    
    assignments.forEach(assignment => {
        const dueDate = assignment.dueDate?.toDate();
        const daysRemaining = getDaysRemaining(assignment.dueDate);
        let status = assignment.status || 'assigned';
        
        if (dueDate && dueDate < today && status === 'assigned') {
            status = 'overdue';
        }
        
        const statusColor = getHomeworkStatusColor(status);
        
        html += `
            <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow" data-status="${status}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h4 class="font-semibold text-gray-800">${assignment.title || 'Untitled Assignment'}</h4>
                        <p class="text-gray-600 text-sm mt-1 line-clamp-2">
                            ${assignment.description || 'No description'}
                        </p>
                    </div>
                    <span class="ml-3 px-3 py-1 rounded-full text-xs font-semibold ${statusColor} whitespace-nowrap">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </div>
                
                <div class="flex flex-wrap justify-between items-center mt-4 text-sm">
                    <div class="space-y-1">
                        <div class="text-gray-500">
                            <strong>Due:</strong> ${dueDate ? formatDate(dueDate) : 'No due date'}
                        </div>
                        <div>
                            ${assignment.tutorName ? `
                                <span class="text-gray-500">Tutor: ${assignment.tutorName}</span>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="flex gap-2 mt-2">
                        ${assignment.fileUrl ? `
                            <button onclick="downloadHomeworkFile('${assignment.fileUrl}', '${assignment.title}')" 
                                    class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                Download
                            </button>
                        ` : ''}
                        <button onclick="viewHomeworkDetails('${assignment.studentId}', '${assignment.studentName || ''}', '${assignment.id}')" 
                                class="text-green-600 hover:text-green-800 text-sm font-medium">
                            View
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    content.innerHTML = html;
}

function setupHomeworkFilters(assignments) {
    // Add click handlers to filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active', 'bg-green-100', 'text-green-800'));
            filterButtons.forEach(b => b.classList.add('bg-gray-100', 'text-gray-800'));
            this.classList.add('active', 'bg-green-100', 'text-green-800');
            this.classList.remove('bg-gray-100', 'text-gray-800');
            
            // Filter assignments
            const filter = this.textContent.toLowerCase();
            let filtered = assignments;
            
            if (filter === 'pending') {
                filtered = assignments.filter(a => (a.status || 'assigned') === 'assigned' && 
                    (!a.dueDate || a.dueDate.toDate() >= new Date()));
            } else if (filter === 'overdue') {
                filtered = assignments.filter(a => (a.status || 'assigned') === 'assigned' && 
                    a.dueDate && a.dueDate.toDate() < new Date());
            } else if (filter === 'completed') {
                filtered = assignments.filter(a => ['submitted', 'graded', 'completed'].includes(a.status || ''));
            }
            
            renderHomeworkList(filtered);
        });
    });
}

function updateHomeworkCount(studentId, count) {
    const countElement = document.getElementById(`hwCount-${studentId}`);
    if (countElement) {
        countElement.textContent = `${count} assignment${count !== 1 ? 's' : ''}`;
    }
}

function setupHomeworkListener(studentId) {
    if (childRealTimeListeners[`homework-${studentId}`]) return;
    
    const listener = db.collection('homework_assignments')
        .where('studentId', '==', studentId)
        .where('status', 'in', ['assigned', 'submitted'])
        .onSnapshot((snapshot) => {
            updateHomeworkCount(studentId, snapshot.size);
        });
    
    childRealTimeListeners[`homework-${studentId}`] = listener;
    realTimeListeners.push(listener);
}

function toggleEmailReminders(studentId) {
    const button = document.getElementById(`emailToggle-${studentId}`);
    const status = document.getElementById(`emailStatus-${studentId}`);
    
    if (!button || !status) return;
    
    // Toggle the status
    const currentStatus = status.textContent.toLowerCase();
    const newStatus = currentStatus === 'enabled' ? 'Disabled' : 'Enabled';
    const newColor = currentStatus === 'enabled' ? 'text-red-600' : 'text-green-600';
    
    status.textContent = newStatus;
    status.className = newColor;
    
    // Store preference in localStorage
    localStorage.setItem(`emailReminders-${studentId}`, newStatus.toLowerCase());
    
    showNotification(`Email reminders ${newStatus.toLowerCase()} for this student`, 'info');
}

// ============================================
// WEEKLY SCHEDULE CALENDAR
// ============================================

async function loadWeeklySchedule(studentId, studentName) {
    try {
        // Get schedule for student
        const snapshot = await db.collection('schedules')
            .where('studentId', '==', studentId)
            .limit(1)
            .get();
        
        let scheduleHTML = '';
        
        if (!snapshot.empty) {
            const scheduleData = snapshot.docs[0].data();
            const schedule = scheduleData.schedule || [];
            
            // Get tutor info if available
            let tutorInfo = {};
            if (scheduleData.tutorId) {
                try {
                    const tutorDoc = await db.collection('tutors').doc(scheduleData.tutorId).get();
                    if (tutorDoc.exists) {
                        tutorInfo = tutorDoc.data();
                    }
                } catch (error) {
                    console.error('Error fetching tutor info:', error);
                }
            }
            
            // Create weekly schedule
            scheduleHTML = createWeeklyScheduleView(schedule, tutorInfo);
            
            // Update next class
            updateNextClass(studentId, schedule);
        } else {
            scheduleHTML = `
                <div class="text-center py-8 bg-gray-50 rounded-lg">
                    <div class="text-4xl mb-3">📅</div>
                    <p class="text-gray-500">No schedule found for ${studentName}</p>
                    <p class="text-sm text-gray-400 mt-2">Contact the tutor to set up a schedule</p>
                </div>
            `;
        }
        
        return `
            <div class="mb-8">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-bold text-green-800">Weekly Schedule</h3>
                    <div class="flex gap-2">
                        <button onclick="printSchedule('${studentId}', '${studentName}')" 
                                class="text-sm text-green-600 hover:text-green-800 font-medium flex items-center">
                            <span class="mr-1">🖨️</span> Print
                        </button>
                        <button onclick="exportSchedule('${studentId}', '${studentName}')" 
                                class="text-sm text-green-600 hover:text-green-800 font-medium flex items-center">
                            <span class="mr-1">📥</span> Export
                        </button>
                    </div>
                </div>
                
                <div id="schedule-${studentId}" class="bg-white rounded-lg border overflow-hidden">
                    ${scheduleHTML}
                </div>
                
                <div class="mt-4 text-sm text-gray-500">
                    <p><strong>Note:</strong> Schedule may change due to tutor availability or holidays.</p>
                    ${scheduleHTML.includes('overnight-indicator') ? `
                        <p class="mt-1">🌙 Overnight classes extend past midnight</p>
                    ` : ''}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading schedule:', error);
        return `
            <div class="mb-8">
                <h3 class="text-lg font-bold text-green-800 mb-4">Weekly Schedule</h3>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-600">Error loading schedule.</p>
                </div>
            </div>
        `;
    }
}

function createWeeklyScheduleView(scheduleArray, tutorInfo) {
    // Define days of week
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Group by day
    const scheduleByDay = {};
    daysOfWeek.forEach(day => scheduleByDay[day] = []);
    
    scheduleArray.forEach(session => {
        const day = session.day || 'Monday';
        if (scheduleByDay[day]) {
            scheduleByDay[day].push(session);
        }
    });
    
    // Sort sessions by start time
    Object.keys(scheduleByDay).forEach(day => {
        scheduleByDay[day].sort((a, b) => {
            const timeA = a.startTime || '00:00';
            const timeB = b.startTime || '00:00';
            return timeA.localeCompare(timeB);
        });
    });
    
    // Create schedule HTML
    let scheduleHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-green-50">
                    <tr>
                        ${daysOfWeek.map(day => `
                            <th class="px-4 py-3 text-left text-xs font-medium text-green-800 uppercase tracking-wider border-r">
                                ${day}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    <tr>
                        ${daysOfWeek.map(day => `
                            <td class="px-4 py-4 text-sm border-r" style="min-height: 200px;">
                                ${renderDaySchedule(scheduleByDay[day], tutorInfo)}
                            </td>
                        `).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="border-t p-4 bg-gray-50">
            <div class="flex flex-wrap gap-4">
                ${tutorInfo.name ? `
                    <div class="flex items-center">
                        <span class="text-sm font-medium text-gray-700 mr-2">Tutor:</span>
                        <span class="text-sm text-gray-600">${tutorInfo.name}</span>
                    </div>
                ` : ''}
                ${tutorInfo.email ? `
                    <div class="flex items-center">
                        <span class="text-sm font-medium text-gray-700 mr-2">Email:</span>
                        <span class="text-sm text-gray-600">${tutorInfo.email}</span>
                    </div>
                ` : ''}
                ${tutorInfo.phone ? `
                    <div class="flex items-center">
                        <span class="text-sm font-medium text-gray-700 mr-2">Phone:</span>
                        <span class="text-sm text-gray-600">${tutorInfo.phone}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return scheduleHTML;
}

function renderDaySchedule(sessions, tutorInfo) {
    if (sessions.length === 0) {
        return `
            <div class="text-center py-8">
                <span class="text-gray-400">No classes</span>
            </div>
        `;
    }
    
    let sessionsHTML = '';
    
    sessions.forEach((session, index) => {
        const startTime = session.startTime || '00:00';
        const endTime = session.endTime || '00:00';
        const subject = session.subject || 'Class';
        
        // Check if overnight (end time is earlier than start time)
        const isOvernight = startTime > endTime;
        
        sessionsHTML += `
            <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg ${index > 0 ? 'mt-2' : ''}">
                <div class="font-medium text-blue-800 mb-1">${subject}</div>
                <div class="text-sm text-gray-600 mb-1">
                    ${formatTimeFromString(startTime)} - ${formatTimeFromString(endTime)}
                    ${isOvernight ? ' <span class="overnight-indicator">🌙</span>' : ''}
                </div>
                ${session.notes ? `
                    <div class="text-xs text-gray-500 mt-1">${session.notes}</div>
                ` : ''}
            </div>
        `;
    });
    
    return sessionsHTML;
}

function updateNextClass(studentId, scheduleArray) {
    if (!scheduleArray || scheduleArray.length === 0) {
        const nextClassElement = document.getElementById(`nextClass-${studentId}`);
        if (nextClassElement) {
            nextClassElement.textContent = 'No schedule';
        }
        return;
    }
    
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todaySchedule = scheduleArray.find(s => s.day === todayName);
    
    let nextClassText = 'Check schedule';
    if (todaySchedule) {
        nextClassText = `Today ${formatTimeFromString(todaySchedule.startTime)}`;
    }
    
    const nextClassElement = document.getElementById(`nextClass-${studentId}`);
    if (nextClassElement) {
        nextClassElement.textContent = nextClassText;
    }
}

function printSchedule(studentId, studentName) {
    const scheduleElement = document.getElementById(`schedule-${studentId}`);
    if (!scheduleElement) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Schedule - ${studentName}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #166534; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f0fdf4; color: #166534; }
                    .session { background-color: #eff6ff; margin: 5px 0; padding: 5px; border-radius: 3px; }
                    .footer { margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <h1>Weekly Schedule - ${studentName}</h1>
                <p>Printed on ${new Date().toLocaleDateString()}</p>
                ${scheduleElement.outerHTML}
                <div class="footer">
                    <p>Blooming Kids House - Parent Portal</p>
                </div>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function exportSchedule(studentId, studentName) {
    const scheduleElement = document.getElementById(`schedule-${studentId}`);
    if (!scheduleElement) return;
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>Schedule - ${studentName}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #166534; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f0fdf4; color: #166534; }
                    .session { background-color: #eff6ff; margin: 5px 0; padding: 5px; border-radius: 3px; }
                </style>
            </head>
            <body>
                <h1>Weekly Schedule - ${studentName}</h1>
                <p>Exported on ${new Date().toLocaleDateString()}</p>
                ${scheduleElement.outerHTML}
            </body>
        </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Schedule_${studentName}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================
// CHILD DETAILS VIEW
// ============================================

async function loadChildDetails(studentId) {
    const detailsContent = document.getElementById(`childDetails-${studentId}`);
    if (!detailsContent) return;
    
    try {
        // Get student details
        const studentDoc = await db.collection('students').doc(studentId).get();
        if (!studentDoc.exists) {
            detailsContent.innerHTML = '<p class="text-red-500">Student not found</p>';
            return;
        }
        
        const studentData = studentDoc.data();
        const studentName = studentData.fullName || studentId;
        
        // Show loading state
        detailsContent.innerHTML = `
            <div class="text-center py-8">
                <div class="loading-spinner mx-auto"></div>
                <p class="text-green-600 font-semibold mt-4">Loading ${studentName}'s details...</p>
            </div>
        `;
        
        // Load all sections
        const topicsHTML = await loadTodaysTopics(studentId, studentName);
        const homeworkHTML = await loadHomeworkAssignments(studentId, studentName);
        const scheduleHTML = await loadWeeklySchedule(studentId, studentName);
        
        // Combine all sections
        detailsContent.innerHTML = `
            <div class="space-y-8">
                ${topicsHTML}
                ${homeworkHTML}
                ${scheduleHTML}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading child details:', error);
        detailsContent.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-600">Error loading details. Please try again.</p>
            </div>
        `;
    }
}

function toggleChildDetails(studentId, studentName) {
    const detailsContent = document.getElementById(`childDetails-${studentId}`);
    const toggleBtn = document.getElementById(`toggleBtn-${studentId}`);
    
    if (!detailsContent || !toggleBtn) return;
    
    if (detailsContent.classList.contains('hidden')) {
        // Show details
        detailsContent.classList.remove('hidden');
        toggleBtn.innerHTML = `<span class="mr-1">▲</span> Hide Details`;
        
        // Load details if not already loaded
        if (detailsContent.innerHTML.trim() === '') {
            loadChildDetails(studentId);
        }
    } else {
        // Hide details
        detailsContent.classList.add('hidden');
        toggleBtn.innerHTML = `<span class="mr-1">▼</span> View Details`;
    }
}

// ============================================
// MAIN PARENT DASHBOARD
// ============================================

async function loadParentDashboard(parentUid) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    authLoader.classList.remove("hidden");

    try {
        // Get parent data
        const parentDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!parentDoc.exists) {
            showMessage('Parent data not found. Please sign in again.', 'error');
            return;
        }
        
        const parentData = parentDoc.data();
        const parentPhone = parentData.normalizedPhone || parentData.phone;
        const parentName = parentData.parentName || 'Parent';
        
        // Update welcome message
        welcomeMessage.textContent = `Welcome, ${parentName}!`;
        currentUserData = parentData;
        
        // Find parent's children
        const studentsSnapshot = await db.collection('students')
            .where('normalizedParentPhone', '==', parentPhone)
            .get();
        
        // Also check pending students
        const pendingSnapshot = await db.collection('pending_students')
            .where('normalizedParentPhone', '==', parentPhone)
            .get();
        
        if (studentsSnapshot.empty && pendingSnapshot.empty) {
            // No children found
            showNoChildrenView();
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
            return;
        }
        
        // Clear existing content
        reportContent.innerHTML = '';
        
        // Add CSS for new features
        addDashboardCSS();
        
        // Add notification badges to navigation
        addNotificationBadges();
        
        // Create children list
        let childrenHTML = `
            <div class="mb-8">
                <h2 class="text-2xl font-bold text-green-800 mb-6">Your Children</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        `;
        
        const allChildren = [];
        
        // Add active students
        studentsSnapshot.forEach((doc, index) => {
            const child = doc.data();
            const childId = doc.id;
            const childName = child.fullName || child.name || `Child ${index + 1}`;
            allChildren.push({ id: childId, name: childName, data: child, type: 'active' });
        });
        
        // Add pending students
        pendingSnapshot.forEach((doc, index) => {
            const child = doc.data();
            const childId = doc.id;
            const childName = child.fullName || child.name || `Pending Child ${index + 1}`;
            allChildren.push({ id: childId, name: childName, data: child, type: 'pending' });
        });
        
        // Display each child
        allChildren.forEach((child, index) => {
            const childId = child.id;
            const childName = child.name;
            const childType = child.type;
            const childData = child.data;
            
            childrenHTML += `
                <div class="child-card bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-lg font-bold text-green-800">${childName}</h3>
                            <p class="text-gray-600 text-sm">Grade: ${childData.grade || 'N/A'}</p>
                        </div>
                        <span class="${childType === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'} text-xs font-semibold px-3 py-1 rounded-full">
                            ${childType === 'active' ? 'Active' : 'Pending'}
                        </span>
                    </div>
                    
                    <div class="space-y-3 mb-6">
                        <div class="flex items-center text-sm">
                            <span class="mr-2">📚</span>
                            <span>Today's Topics: <span id="topicCount-${childId}" class="font-semibold">Loading...</span></span>
                        </div>
                        <div class="flex items-center text-sm">
                            <span class="mr-2">📝</span>
                            <span>Homework: <span id="hwCount-${childId}" class="font-semibold">Loading...</span></span>
                        </div>
                        <div class="flex items-center text-sm">
                            <span class="mr-2">📅</span>
                            <span>Next Class: <span id="nextClass-${childId}" class="font-semibold">Loading...</span></span>
                        </div>
                    </div>
                    
                    <button onclick="toggleChildDetails('${childId}', '${childName}')" 
                            id="toggleBtn-${childId}"
                            class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center">
                        <span class="mr-1">▼</span> View Details
                    </button>
                    
                    <div id="childDetails-${childId}" class="hidden mt-6 pt-6 border-t">
                        <!-- Details will be loaded here -->
                    </div>
                </div>
            `;
        });
        
        childrenHTML += `
                </div>
            </div>
        `;
        
        reportContent.innerHTML = childrenHTML;
        
        // Load initial counts and details for each child
        allChildren.forEach(async (child) => {
            const childId = child.id;
            const childName = child.name;
            
            // Load counts
            await loadChildCounts(childId, childName);
            
            // Setup real-time listeners
            setupChildListeners(childId);
        });
        
        // Show dashboard
        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        
        // Add buttons to welcome section
        addViewResponsesButton();
        addManualRefreshButton();
        
        // Load initial referral data for the rewards dashboard tab
        loadReferralRewards(parentUid);
        
    } catch (error) {
        console.error('Error loading parent dashboard:', error);
        showMessage('Error loading dashboard. Please try again.', 'error');
    } finally {
        authLoader.classList.add("hidden");
    }
}

async function loadChildCounts(childId, childName) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Load topic count
        const topicsSnapshot = await db.collection('daily_topics')
            .where('studentId', '==', childId)
            .where('date', '>=', today)
            .where('date', '<', tomorrow)
            .get();
        
        const topicCount = topicsSnapshot.size;
        updateTopicCount(childId, topicCount);
        
        // Load homework count
        const homeworkSnapshot = await db.collection('homework_assignments')
            .where('studentId', '==', childId)
            .where('status', 'in', ['assigned', 'submitted'])
            .get();
        
        const hwCount = homeworkSnapshot.size;
        updateHomeworkCount(childId, hwCount);
        
        // Load schedule for next class
        const scheduleSnapshot = await db.collection('schedules')
            .where('studentId', '==', childId)
            .limit(1)
            .get();
        
        let nextClassText = 'No schedule';
        if (!scheduleSnapshot.empty) {
            const schedule = scheduleSnapshot.docs[0].data().schedule || [];
            updateNextClass(childId, schedule);
        } else {
            updateNextClass(childId, null);
        }
        
    } catch (error) {
        console.error('Error loading child counts:', error);
    }
}

function setupChildListeners(childId) {
    // Setup topic listener
    setupTopicsListener(childId);
    
    // Setup homework listener
    setupHomeworkListener(childId);
    
    // Setup schedule listener
    setupScheduleListener(childId);
}

function setupScheduleListener(studentId) {
    if (childRealTimeListeners[`schedule-${studentId}`]) return;
    
    const listener = db.collection('schedules')
        .where('studentId', '==', studentId)
        .limit(1)
        .onSnapshot((snapshot) => {
            if (!snapshot.empty) {
                const schedule = snapshot.docs[0].data().schedule || [];
                updateNextClass(studentId, schedule);
            } else {
                updateNextClass(studentId, null);
            }
        });
    
    childRealTimeListeners[`schedule-${studentId}`] = listener;
    realTimeListeners.push(listener);
}

function addDashboardCSS() {
    // Check if CSS already added
    if (document.getElementById('parentDashboardCSS')) return;
    
    const style = document.createElement('style');
    style.id = 'parentDashboardCSS';
    style.textContent = `
        .overnight-indicator { color: #9333ea; }
        .filter-btn.active { background-color: #dcfce7; color: #166534; }
        .line-clamp-2 { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
        .preserve-whitespace { white-space: pre-wrap; }
        .loading-spinner { border: 3px solid #f3f3f3; border-top: 3px solid #10b981; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        .loading-spinner-small { border: 2px solid #f3f3f3; border-top: 2px solid #10b981; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .child-card { transition: all 0.3s ease; }
        .child-card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); }
        .tab-active-main { background-color: #10b981; color: white; }
        .tab-inactive-main { background-color: #f3f4f6; color: #4b5563; }
        .tab-active-main:hover { background-color: #059669; }
        .tab-inactive-main:hover { background-color: #e5e7eb; }
    `;
    document.head.appendChild(style);
}

function showNoChildrenView() {
    const reportContent = document.getElementById('reportContent');
    
    reportContent.innerHTML = `
        <div class="text-center py-16">
            <div class="text-6xl mb-6">👨‍👩‍👧‍👦</div>
            <h2 class="text-2xl font-bold text-gray-800 mb-4">No Children Linked</h2>
            <p class="text-gray-600 max-w-2xl mx-auto mb-6">
                We couldn't find any children linked to your account. This could be because:
            </p>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto mb-6">
                <ul class="text-left text-gray-700 space-y-3">
                    <li>• Your phone number doesn't match the one on file with the tutor</li>
                    <li>• The tutor hasn't registered your child yet</li>
                    <li>• There might be a mismatch in the phone number format</li>
                </ul>
            </div>
            <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button onclick="showFeedbackModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center">
                    <span class="mr-2">💬</span> Contact Support
                </button>
                <button onclick="location.reload()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center">
                    <span class="mr-2">🔄</span> Refresh Page
                </button>
            </div>
        </div>
    `;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'warning' ? 'bg-yellow-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// ============================================
// EXISTING FUNCTIONS (KEPT FOR COMPATIBILITY)
// ============================================

// Feedback System Functions (existing)
function showFeedbackModal() {
    populateStudentDropdown();
    document.getElementById('feedbackModal').classList.remove('hidden');
}

function hideFeedbackModal() {
    document.getElementById('feedbackModal').classList.add('hidden');
    // Reset form
    document.getElementById('feedbackCategory').value = '';
    document.getElementById('feedbackPriority').value = '';
    document.getElementById('feedbackStudent').value = '';
    document.getElementById('feedbackMessage').value = '';
}

function populateStudentDropdown() {
    const studentDropdown = document.getElementById('feedbackStudent');
    studentDropdown.innerHTML = '<option value="">Select student</option>';
    
    // Get student names from the dashboard
    const studentHeaders = document.querySelectorAll('.child-card h3');
    
    if (studentHeaders.length === 0) {
        studentDropdown.innerHTML += '<option value="" disabled>No students found</option>';
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

    // Validation
    if (!category || !priority || !student || !message) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    if (message.length < 10) {
        showMessage('Please provide a more detailed message (at least 10 characters)', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitFeedbackBtn');
    submitBtn.disabled = true;
    document.getElementById('submitFeedbackText').textContent = 'Submitting...';
    document.getElementById('submitFeedbackSpinner').classList.remove('hidden');

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to submit feedback');
        }

        // Get user data
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        // Create feedback document
        const feedbackData = {
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
            parentUid: user.uid, // Add parent UID for querying responses
            responses: [] // Initialize empty responses array
        };

        // Save to Firestore
        await db.collection('parent_feedback').add(feedbackData);

        showMessage('Thank you! Your feedback has been submitted successfully. We will respond within 24-48 hours.', 'success');
        
        // Close modal and reset form
        hideFeedbackModal();

    } catch (error) {
        console.error('Feedback submission error:', error);
        showMessage('Failed to submit feedback. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('submitFeedbackText').textContent = 'Submit Feedback';
        document.getElementById('submitFeedbackSpinner').classList.add('hidden');
    }
}

// Admin Responses Functions (existing)
function showResponsesModal() {
    document.getElementById('responsesModal').classList.remove('hidden');
    loadAdminResponses();
    // Reset notification count when user views responses
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
        if (!user) {
            throw new Error('Please sign in to view responses');
        }

        // Query feedback where parentUid matches current user AND responses array exists and is not empty
        const feedbackSnapshot = await db.collection('parent_feedback')
            .where('parentUid', '==', user.uid)
            .get();

        if (feedbackSnapshot.empty) {
            responsesContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📭</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Responses Yet</h3>
                    <p class="text-gray-500 max-w-md mx-auto">You haven't received any responses from our staff yet. We'll respond to your feedback within 24-48 hours.</p>
                </div>
            `;
            return;
        }

        // Filter feedback that has responses
        const feedbackWithResponses = [];
        feedbackSnapshot.forEach(doc => {
            const feedback = { id: doc.id, ...doc.data() };
            if (feedback.responses && feedback.responses.length > 0) {
                feedbackWithResponses.push(feedback);
            }
        });

        if (feedbackWithResponses.length === 0) {
            responsesContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📭</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Responses Yet</h3>
                    <p class="text-gray-500 max-w-md mx-auto">You haven't received any responses from our staff yet. We'll respond to your feedback within 24-48 hours.</p>
                </div>
            `;
            return;
        }

        // Sort by most recent response
        feedbackWithResponses.sort((a, b) => {
            const aDate = a.responses[0]?.responseDate?.toDate() || new Date(0);
            const bDate = b.responses[0]?.responseDate?.toDate() || new Date(0);
            return bDate - aDate;
        });

        responsesContent.innerHTML = '';

        feedbackWithResponses.forEach((feedback) => {
            feedback.responses.forEach((response, index) => {
                const responseDate = response.responseDate?.toDate() || feedback.timestamp?.toDate() || new Date();
                const formattedDate = responseDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const responseElement = document.createElement('div');
                responseElement.className = 'bg-white border border-gray-200 rounded-xl p-6 mb-4';
                responseElement.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex flex-wrap gap-2">
                            <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getCategoryColor(feedback.category)}">
                                ${feedback.category}
                            </span>
                            <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(feedback.priority)}">
                                ${feedback.priority} Priority
                            </span>
                        </div>
                        <span class="text-sm text-gray-500">${formattedDate}</span>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="font-semibold text-gray-800 mb-2">Regarding: ${feedback.studentName}</h4>
                        <p class="text-gray-700 bg-gray-50 p-4 rounded-lg border">${feedback.message}</p>
                    </div>
                    
                    <div class="response-bubble">
                        <div class="response-header">📨 Response from ${response.responderName || 'Admin'}:</div>
                        <p class="text-gray-700 mt-2">${response.responseText}</p>
                        <div class="text-sm text-gray-500 mt-2">
                            Responded by: ${response.responderName || 'Admin Staff'} 
                            ${response.responderEmail ? `(${response.responderEmail})` : ''}
                        </div>
                    </div>
                `;

                responsesContent.appendChild(responseElement);
            });
        });

    } catch (error) {
        console.error('Error loading responses:', error);
        responsesContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Responses</h3>
                <p class="text-gray-500">Unable to load responses at this time. Please try again later.</p>
            </div>
        `;
    }
}

// Notification System for Responses (existing)
async function checkForNewResponses() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const feedbackSnapshot = await db.collection('parent_feedback')
            .where('parentUid', '==', user.uid)
            .get();

        let totalResponses = 0;
        
        feedbackSnapshot.forEach(doc => {
            const feedback = doc.data();
            if (feedback.responses && feedback.responses.length > 0) {
                totalResponses += feedback.responses.length;
            }
        });

        // Update notification badge
        updateNotificationBadge(totalResponses > 0 ? totalResponses : 0);
        
        // Store for later use
        unreadResponsesCount = totalResponses;

    } catch (error) {
        console.error('Error checking for new responses:', error);
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
    // When user views responses, mark them as read and reset counter
    updateNotificationBadge(0);
    unreadResponsesCount = 0;
}

function getCategoryColor(category) {
    const colors = {
        'Feedback': 'bg-blue-100 text-blue-800',
        'Request': 'bg-green-100 text-green-800',
        'Complaint': 'bg-red-100 text-red-800',
        'Suggestion': 'bg-purple-100 text-purple-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
}

function getPriorityColor(priority) {
    const colors = {
        'Low': 'bg-gray-100 text-gray-800',
        'Medium': 'bg-yellow-100 text-yellow-800',
        'High': 'bg-orange-100 text-orange-800',
        'Urgent': 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
}

// Add View Responses button to the welcome section with notification badge
function addViewResponsesButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    // Check if button already exists
    if (document.getElementById('viewResponsesBtn')) return;
    
    const viewResponsesBtn = document.createElement('button');
    viewResponsesBtn.id = 'viewResponsesBtn';
    viewResponsesBtn.onclick = showResponsesModal;
    viewResponsesBtn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 btn-glow flex items-center justify-center relative';
    viewResponsesBtn.innerHTML = '<span class="mr-2">📨</span> View Responses';
    
    // Insert before the logout button
    buttonContainer.insertBefore(viewResponsesBtn, buttonContainer.lastElementChild);
    
    // Check for responses to show notification
    setTimeout(() => {
        checkForNewResponses();
    }, 1000);
}

// MANUAL REFRESH FUNCTION (existing)
async function manualRefreshReports() {
    const user = auth.currentUser;
    if (!user) return;
    
    const refreshBtn = document.getElementById('manualRefreshBtn');
    const originalText = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Checking...';
    refreshBtn.disabled = true;
    
    try {
        // Force reload dashboard
        await loadParentDashboard(user.uid);
        
        showMessage('Dashboard refreshed successfully!', 'success');
    } catch (error) {
        console.error('Manual refresh error:', error);
        showMessage('Refresh failed. Please try again.', 'error');
    } finally {
        // Restore button state
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// ADD MANUAL REFRESH BUTTON TO WELCOME SECTION (existing)
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
    refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Check for New Updates';
    
    // Insert before the logout button
    buttonContainer.insertBefore(refreshBtn, buttonContainer.lastElementChild);
}

// Clean up listeners on logout
function cleanupListeners() {
    // Clean up global listeners
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    realTimeListeners = [];
    
    // Clean up child-specific listeners
    Object.keys(childRealTimeListeners).forEach(key => {
        const unsubscribe = childRealTimeListeners[key];
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    childRealTimeListeners = {};
    
    console.log("🧹 Cleaned up all real-time listeners");
}

function logout() {
    // Clear remember me on logout
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    
    // Clean up real-time listeners
    cleanupListeners();
    
    auth.signOut().then(() => {
        window.location.reload();
    });
}

function showMessage(message, type) {
    // Remove any existing message
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    messageDiv.textContent = `BKH says: ${message}`;
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function switchTab(tab) {
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if (tab === 'signin') {
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
}

function switchMainTab(tab) {
    const reportTab = document.getElementById('reportTab');
    const rewardsTab = document.getElementById('rewardsTab');
    
    const reportContentArea = document.getElementById('reportContentArea');
    const rewardsContentArea = document.getElementById('rewardsContentArea');
    
    // Deactivate all tabs
    reportTab?.classList.remove('tab-active-main');
    reportTab?.classList.add('tab-inactive-main');
    rewardsTab?.classList.remove('tab-active-main');
    rewardsTab?.classList.add('tab-inactive-main');
    
    // Hide all content areas
    reportContentArea?.classList.add('hidden');
    rewardsContentArea?.classList.add('hidden');
    
    // Activate selected tab and show content
    if (tab === 'reports') {
        reportTab?.classList.remove('tab-inactive-main');
        reportTab?.classList.add('tab-active-main');
        reportContentArea?.classList.remove('hidden');
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

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Setup Remember Me
    setupRememberMe();
    
    // Create country code dropdown when page loads
    createCountryCodeDropdown();
    
    // Check authentication state
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in, load their dashboard
            loadParentDashboard(user.uid);
        } else {
            // User signed out - clean up listeners
            cleanupListeners();
        }
    });

    // Set up event listeners
    document.getElementById("signInBtn").addEventListener("click", handleSignIn);
    document.getElementById("signUpBtn").addEventListener("click", handleSignUp);
    document.getElementById("sendResetBtn").addEventListener("click", handlePasswordReset);
    document.getElementById("submitFeedbackBtn").addEventListener("click", submitFeedback);
    
    document.getElementById("signInTab").addEventListener("click", () => switchTab('signin'));
    document.getElementById("signUpTab").addEventListener("click", () => switchTab('signup'));
    
    document.getElementById("forgotPasswordBtn").addEventListener("click", () => {
        document.getElementById("passwordResetModal").classList.remove("hidden");
    });
    
    document.getElementById("cancelResetBtn").addEventListener("click", () => {
        document.getElementById("passwordResetModal").classList.add("hidden");
    });

    document.getElementById("rememberMe").addEventListener("change", handleRememberMe);

    // Allow Enter key to submit forms
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignIn();
    });
    
    document.getElementById('signupConfirmPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignUp();
    });
    
    document.getElementById('resetEmail').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePasswordReset();
    });
    
    // --- START: NEW MAIN TAB SWITCHING LISTENERS (PHASE 3) ---
    document.getElementById("reportTab")?.addEventListener("click", () => switchMainTab('reports'));
    document.getElementById("rewardsTab")?.addEventListener("click", () => switchMainTab('rewards'));
    // --- END: NEW MAIN TAB SWITCHING LISTENERS (PHASE 3) ---
});

