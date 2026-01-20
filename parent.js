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

// Global variables for user data
let currentUserData = null;
let userChildren = [];

// HTML structure for the Progress Report Tab
const progressReportHTML = `
<!-- Main Tabs Navigation -->
<div class="flex mb-8 border-b">
    <button id="reportTab" class="tab-active-main px-6 py-3 text-lg font-semibold text-green-700 border-b-2 border-green-600 bg-white transition-all duration-200">
        📊 Assessment Reports
    </button>
    <button id="rewardsTab" class="tab-inactive-main px-6 py-3 text-lg font-semibold text-gray-500 hover:text-green-600 transition-all duration-200">
        🏆 Rewards Dashboard
    </button>
</div>

<!-- Report Content Area -->
<div id="reportContentArea">
    <div class="bg-green-50 border-l-4 border-green-600 p-6 rounded-xl mb-8">
        <h1 id="welcomeMessage" class="text-2xl font-bold text-green-800 mb-2">Welcome!</h1>
        <p class="text-green-600 mb-4">View all your child's assessment and monthly reports here.</p>
        <div class="flex gap-2">
            <button onclick="showFeedbackModal()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center">
                <span class="mr-2">💬</span> Submit Feedback
            </button>
            <button onclick="logout()" class="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200">
                Logout
            </button>
        </div>
    </div>

    <!-- Reports will be loaded here -->
    <div id="reportContent" class="space-y-8"></div>
</div>

<!-- Rewards Content Area (Hidden by default) -->
<div id="rewardsContentArea" class="hidden">
    <div class="bg-green-50 border-l-4 border-green-600 p-6 rounded-xl mb-8">
        <h1 class="text-2xl font-bold text-green-800 mb-2">Rewards Dashboard</h1>
        <p class="text-green-600 mb-4">Track your referral earnings and rewards.</p>
    </div>
    
    <!-- Rewards content will be loaded here -->
    <div id="rewardsContent"></div>
</div>

<!-- Feedback Modal -->
<div id="feedbackModal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl mx-4">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-green-800">Submit Feedback</h2>
            <button onclick="hideFeedbackModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        
        <div class="space-y-4">
            <div>
                <label class="block text-gray-700 font-medium mb-2">Category *</label>
                <select id="feedbackCategory" class="w-full px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200">
                    <option value="">Select category</option>
                    <option value="Feedback">General Feedback</option>
                    <option value="Request">Special Request</option>
                    <option value="Complaint">Complaint</option>
                    <option value="Suggestion">Suggestion</option>
                </select>
            </div>
            
            <div>
                <label class="block text-gray-700 font-medium mb-2">Priority *</label>
                <select id="feedbackPriority" class="w-full px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200">
                    <option value="">Select priority</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                </select>
            </div>
            
            <div>
                <label class="block text-gray-700 font-medium mb-2">Student *</label>
                <select id="feedbackStudent" class="w-full px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200">
                    <option value="">Select student</option>
                </select>
            </div>
            
            <div>
                <label class="block text-gray-700 font-medium mb-2">Message *</label>
                <textarea id="feedbackMessage" rows="5" class="w-full px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200" placeholder="Please provide detailed feedback..."></textarea>
            </div>
        </div>
        
        <div class="flex justify-end gap-4 mt-8">
            <button onclick="hideFeedbackModal()" class="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-all duration-200">
                Cancel
            </button>
            <button id="submitFeedbackBtn" onclick="submitFeedback()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center">
                <span id="submitFeedbackText">Submit Feedback</span>
                <div id="submitFeedbackSpinner" class="hidden ml-2">
                    <div class="loading-spinner-small"></div>
                </div>
            </button>
        </div>
    </div>
</div>

<!-- Admin Responses Modal -->
<div id="responsesModal" class="hidden fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-4xl mx-4 max-h-[80vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-blue-800">Admin Responses</h2>
            <button onclick="hideResponsesModal()" class="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>
        
        <div id="responsesContent"></div>
        
        <div class="flex justify-end mt-8">
            <button onclick="hideResponsesModal()" class="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200">
                Close
            </button>
        </div>
    </div>
</div>
`;

// Main Tab Switching Function
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

// Referral Rewards Function
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

// Helper function
function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Generate recommendation template
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

// Name matching function
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

// Multi-normalization function
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

// Find parent name from students collection
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

// Multi-layer search system
async function performMultiLayerSearch(parentPhone, parentEmail, userId) {
    console.log("🔍 Starting multi-layer search for:", parentPhone);
    
    let assessmentResults = [];
    let monthlyResults = [];
    
    try {
        // Get multiple normalized versions of the phone number
        const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
        const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
        
        console.log(`🎯 Searching with ${validVersions.length} normalized versions:`, validVersions.map(v => v.normalized));

        // --- ASSESSMENT REPORTS SEARCH ---
        for (const version of validVersions) {
            console.log(`📊 ASSESSMENT SEARCH - Attempt with: ${version.normalized} (${version.attempt})`);
            
            // Layer 1: Normalized phone search
            let assessmentSnapshot = await db.collection("student_results")
                .where("normalizedParentPhone", "==", version.normalized)
                .get();
            
            if (!assessmentSnapshot.empty) {
                console.log(`✅ Assessment FOUND with version: ${version.normalized}`);
                assessmentSnapshot.forEach(doc => {
                    const data = doc.data();
                    // Check if we already have this result to avoid duplicates
                    if (!assessmentResults.some(r => r.id === doc.id)) {
                        assessmentResults.push({ 
                            id: doc.id,
                            ...data,
                            timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                            type: 'assessment',
                            foundWith: version.normalized
                        });
                    }
                });
                break; // Stop searching if we found results
            }
        }

        // If no results from normalized search, try original fields
        if (assessmentResults.length === 0) {
            console.log("📊 ASSESSMENT SEARCH - Layer 2: Original phone fields");
            for (const version of validVersions) {
                let assessmentSnapshot = await db.collection("student_results")
                    .where("parentPhone", "==", version.normalized)
                    .get();
                
                if (!assessmentSnapshot.empty) {
                    console.log(`✅ Assessment FOUND in original fields with: ${version.normalized}`);
                    assessmentSnapshot.forEach(doc => {
                        const data = doc.data();
                        if (!assessmentResults.some(r => r.id === doc.id)) {
                            assessmentResults.push({ 
                                id: doc.id,
                                ...data,
                                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                                type: 'assessment',
                                foundWith: version.normalized
                            });
                        }
                    });
                    break;
                }
            }
        }

        // If still no results, try email search
        if (assessmentResults.length === 0 && parentEmail) {
            console.log("📊 ASSESSMENT SEARCH - Layer 3: Email search");
            let assessmentSnapshot = await db.collection("student_results")
                .where("parentEmail", "==", parentEmail)
                .get();
            
            if (!assessmentSnapshot.empty) {
                console.log("✅ Assessment FOUND with email");
                assessmentSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!assessmentResults.some(r => r.id === doc.id)) {
                        assessmentResults.push({ 
                            id: doc.id,
                            ...data,
                            timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                            type: 'assessment',
                            foundWith: 'email'
                        });
                    }
                });
            }
        }

        // --- MONTHLY REPORTS SEARCH ---
        for (const version of validVersions) {
            console.log(`📈 MONTHLY REPORTS SEARCH - Attempt with: ${version.normalized} (${version.attempt})`);
            
            // Layer 1: Normalized phone search
            let monthlySnapshot = await db.collection("tutor_submissions")
                .where("normalizedParentPhone", "==", version.normalized)
                .get();
            
            if (!monthlySnapshot.empty) {
                console.log(`✅ Monthly reports FOUND with version: ${version.normalized}`);
                monthlySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!monthlyResults.some(r => r.id === doc.id)) {
                        monthlyResults.push({ 
                            id: doc.id,
                            ...data,
                            timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                            type: 'monthly',
                            foundWith: version.normalized
                        });
                    }
                });
                break;
            }
        }

        // If no results from normalized search, try original fields
        if (monthlyResults.length === 0) {
            console.log("📈 MONTHLY REPORTS SEARCH - Layer 2: Original phone fields");
            for (const version of validVersions) {
                let monthlySnapshot = await db.collection("tutor_submissions")
                    .where("parentPhone", "==", version.normalized)
                    .get();
                
                if (!monthlySnapshot.empty) {
                    console.log(`✅ Monthly reports FOUND in original fields with: ${version.normalized}`);
                    monthlySnapshot.forEach(doc => {
                        const data = doc.data();
                        if (!monthlyResults.some(r => r.id === doc.id)) {
                            monthlyResults.push({ 
                                id: doc.id,
                                ...data,
                                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                                type: 'monthly',
                                foundWith: version.normalized
                            });
                        }
                    });
                    break;
                }
            }
        }

        // If still no results, try email search
        if (monthlyResults.length === 0 && parentEmail) {
            console.log("📈 MONTHLY REPORTS SEARCH - Layer 3: Email search");
            let monthlySnapshot = await db.collection("tutor_submissions")
                .where("parentEmail", "==", parentEmail)
                .get();
            
            if (!monthlySnapshot.empty) {
                console.log("✅ Monthly reports FOUND with email");
                monthlySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!monthlyResults.some(r => r.id === doc.id)) {
                        monthlyResults.push({ 
                            id: doc.id,
                            ...data,
                            timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                            type: 'monthly',
                            foundWith: 'email'
                        });
                    }
                });
            }
        }

        console.log("🎯 SEARCH SUMMARY - Assessments:", assessmentResults.length, "Monthly:", monthlyResults.length);
        
    } catch (error) {
        console.error("❌ Error during multi-layer search:", error);
    }
    
    return { assessmentResults, monthlyResults };
}

// Main report loading function
async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    authLoader.classList.remove("hidden");

    try {
        // --- CACHE IMPLEMENTATION (skip if force refresh) ---
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
                        
                        // Set welcome message from cache
                        if (userData && userData.parentName) {
                            welcomeMessage.textContent = `Welcome, ${userData.parentName}!`;
                            currentUserData = userData;
                        } else {
                            welcomeMessage.textContent = `Welcome!`;
                        }
                        
                        // Re-initialize charts from cached configuration
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
                        
                        // Load initial referral data
                        loadReferralRewards(userId);

                        return;
                    }
                }
            } catch (e) {
                console.error("Could not read from cache:", e);
                localStorage.removeItem(cacheKey);
            }
        }
        // --- END CACHE IMPLEMENTATION ---

        // FIND PARENT NAME FROM SAME SOURCES AS TUTOR.JS
        let parentName = await findParentNameFromStudents(parentPhone);
        
        // Get parent's email and latest user data from their account document
        const userDocRef = db.collection('parent_users').doc(userId);
        let userDoc = await userDocRef.get();
        let userData = userDoc.data();
        const parentEmail = userData.email;

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
            parentName: parentName,
            parentPhone: parentPhone
        };

        // UPDATE WELCOME MESSAGE WITH PARENT NAME
        welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;

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

        console.log("🔍 Starting enhanced multi-layer search for:", parentPhone);

        // --- USE ENHANCED MULTI-LAYER SEARCH SYSTEM ---
        const { assessmentResults, monthlyResults } = await performMultiLayerSearch(parentPhone, parentEmail, userId);

        if (assessmentResults.length === 0 && monthlyResults.length === 0) {
            // NO REPORTS FOUND - SHOW WAITING STATE
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
                            <button onclick="showFeedbackModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center">
                                <span class="mr-2">💬</span> Contact Support
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
            
            // Load initial referral data for the rewards dashboard tab even if no reports
            loadReferralRewards(userId);

            return;
        }
        
        // REPORTS FOUND - DISPLAY THEM
        reportContent.innerHTML = "";
        const chartConfigsToCache = [];

        // Group reports by student name and extract parent name
        const studentsMap = new Map();

        // Process assessment reports
        assessmentResults.forEach(result => {
            const studentName = result.studentName;
            if (!studentsMap.has(studentName)) {
                studentsMap.set(studentName, { assessments: [], monthly: [] });
            }
            studentsMap.get(studentName).assessments.push(result);
        });

        // Process monthly reports
        monthlyResults.forEach(report => {
            const studentName = report.studentName;
            if (!studentsMap.has(studentName)) {
                studentsMap.set(studentName, { assessments: [], monthly: [] });
            }
            studentsMap.get(studentName).monthly.push(report);
        });

        userChildren = Array.from(studentsMap.keys());

        // Display reports for each student
        let studentIndex = 0;
        for (const [studentName, reports] of studentsMap) {
            const fullName = capitalize(studentName);
            
            // Add student header
            const studentHeader = `
                <div class="bg-green-100 border-l-4 border-green-600 p-4 rounded-lg mb-6">
                    <h2 class="text-xl font-bold text-green-800">${fullName}</h2>
                    <p class="text-green-600">Showing all reports for ${fullName}</p>
                </div>
            `;
            reportContent.innerHTML += studentHeader;

            // Display Assessment Reports for this student - NO DUPLICATES
            if (reports.assessments.length > 0) {
                // Group by unique test sessions using timestamp
                const uniqueSessions = new Map();
                
                reports.assessments.forEach((result) => {
                    const sessionKey = Math.floor(result.timestamp / 86400); // Group by day
                    if (!uniqueSessions.has(sessionKey)) {
                        uniqueSessions.set(sessionKey, []);
                    }
                    uniqueSessions.get(sessionKey).push(result);
                });

                let assessmentIndex = 0;
                for (const [sessionKey, session] of uniqueSessions) {
                    const tutorEmail = session[0].tutorEmail || 'N/A';
                    const studentCountry = session[0].studentCountry || 'N/A';
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
                        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${assessmentIndex}">
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
                            <canvas id="chart-${studentIndex}-${assessmentIndex}" class="w-full h-48 mb-4"></canvas>
                            ` : ''}
                            
                            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                                <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                            </div>
                            
                            <div class="mt-6 text-center">
                                <button onclick="downloadSessionReport(${studentIndex}, ${assessmentIndex}, '${fullName}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                    Download Assessment PDF
                                </button>
                            </div>
                        </div>
                    `;

                    reportContent.innerHTML += assessmentBlock;

                    if (results.length > 0) {
                        const ctx = document.getElementById(`chart-${studentIndex}-${assessmentIndex}`);
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
                            chartConfigsToCache.push({ canvasId: `chart-${studentIndex}-${assessmentIndex}`, config: chartConfig });
                        }
                    }
                    assessmentIndex++;
                }
            }
            
            // Display Monthly Reports for this student
            if (reports.monthly.length > 0) {
                const groupedMonthly = {};
                reports.monthly.forEach((result) => {
                    const sessionKey = Math.floor(result.timestamp / 86400); 
                    if (!groupedMonthly[sessionKey]) groupedMonthly[sessionKey] = [];
                    groupedMonthly[sessionKey].push(result);
                });

                let monthlyIndex = 0;
                for (const key in groupedMonthly) {
                    const session = groupedMonthly[key];
                    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
                        dateStyle: 'long',
                        timeStyle: 'short'
                    });

                    session.forEach((monthlyReport, reportIndex) => {
                        const monthlyBlock = `
                            <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${studentIndex}-${monthlyIndex}">
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
                                    <button onclick="downloadMonthlyReport(${studentIndex}, ${monthlyIndex}, '${fullName}')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                        Download Monthly Report PDF
                                    </button>
                                </div>
                            </div>
                        `;
                        reportContent.innerHTML += monthlyBlock;
                        monthlyIndex++;
                    });
                }
            }
            
            studentIndex++;
        }
        
        // --- CACHE SAVING LOGIC ---
        try {
            const dataToCache = {
                timestamp: Date.now(),
                html: reportContent.innerHTML,
                chartConfigs: chartConfigsToCache,
                userData: currentUserData
            };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
            console.log("Report data cached successfully.");
        } catch (e) {
            console.error("Could not write to cache:", e);
        }
        // --- END CACHE SAVING ---

        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");

        // Load initial referral data for the rewards dashboard tab
        loadReferralRewards(userId);

    } catch (error) {
        console.error("Error loading reports:", error);
        showMessage("Sorry, there was an error loading the reports. Please try again.", "error");
    } finally {
        authLoader.classList.add("hidden");
    }
}

// Download functions
function downloadSessionReport(studentIndex, sessionIndex, studentName, type) {
    const element = document.getElementById(`${type}-block-${studentIndex}-${sessionIndex}`);
    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().from(element).set(opt).save();
}

function downloadMonthlyReport(studentIndex, monthlyIndex, studentName) {
    downloadSessionReport(studentIndex, monthlyIndex, studentName, 'monthly');
}

// Feedback System Functions
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
    
    // Get student names from the report headers that are already displayed
    const studentHeaders = document.querySelectorAll('[class*="bg-green-100"] h2');
    
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

// Admin Responses Functions
function showResponsesModal() {
    document.getElementById('responsesModal').classList.remove('hidden');
    loadAdminResponses();
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

// Helper functions for modal styling
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

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.reload();
    });
}

// Message display function
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

// Initialize the Progress Report Tab
function initializeProgressReportTab(containerId) {
    // Insert the HTML into the container
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = progressReportHTML;
        
        // Set up event listeners for tab switching
        document.getElementById("reportTab")?.addEventListener("click", () => switchMainTab('reports'));
        document.getElementById("rewardsTab")?.addEventListener("click", () => switchMainTab('rewards'));
        
        // Set up feedback form listener
        document.getElementById("submitFeedbackBtn")?.addEventListener("click", submitFeedback);
        
        // Initialize auth state listener
        auth.onAuthStateChanged((user) => {
            if (user) {
                // User is signed in, load their reports
                db.collection('parent_users').doc(user.uid).get()
                    .then((doc) => {
                        if (doc.exists) {
                            const userPhone = doc.data().phone;
                            const normalizedPhone = doc.data().normalizedPhone;
                            loadAllReportsForParent(normalizedPhone || userPhone, user.uid);
                        }
                    })
                    .catch((error) => {
                        console.error('Error getting user data:', error);
                    });
            }
        });
    }
}

// Export for use in other files
window.initializeProgressReportTab = initializeProgressReportTab;
window.switchMainTab = switchMainTab;
window.loadReferralRewards = loadReferralRewards;
window.showFeedbackModal = showFeedbackModal;
window.hideFeedbackModal = hideFeedbackModal;
window.showResponsesModal = showResponsesModal;
window.hideResponsesModal = hideResponsesModal;
window.logout = logout;
window.downloadMonthlyReport = downloadMonthlyReport;
window.downloadSessionReport = downloadSessionReport;
