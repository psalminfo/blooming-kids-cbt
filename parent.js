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

// =============================================================================
// PHONE NUMBER NORMALIZATION - FIX FOR REPORT MATCHING ISSUES
// =============================================================================

/**
 * Comprehensive phone number normalization for international numbers
 * Returns multiple search variations to find existing reports
 */
function normalizePhoneNumber(phone) {
    if (!phone) return [];
    
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    if (!cleaned) return [];
    
    const variations = new Set();
    variations.add(cleaned);
    
    // Handle Nigerian numbers
    if (cleaned.startsWith('+234')) {
        const withoutPlus = cleaned.substring(1);
        const without234 = '0' + cleaned.substring(4);
        const withoutPlus234 = cleaned.substring(4);
        
        variations.add(withoutPlus);
        variations.add(without234);
        variations.add(withoutPlus234);
    } 
    else if (cleaned.startsWith('234') && cleaned.length >= 13) {
        const withPlus = '+' + cleaned;
        const withZero = '0' + cleaned.substring(3);
        const without234 = cleaned.substring(3);
        
        variations.add(withPlus);
        variations.add(withZero);
        variations.add(without234);
    }
    else if (cleaned.startsWith('0') && cleaned.length === 11) {
        const with234 = '234' + cleaned.substring(1);
        const withPlus234 = '+234' + cleaned.substring(1);
        const withoutZero = cleaned.substring(1);
        
        variations.add(with234);
        variations.add(withPlus234);
        variations.add(withoutZero);
    }
    else if (!cleaned.startsWith('+') && !cleaned.startsWith('0') && cleaned.length === 10) {
        const withZero = '0' + cleaned;
        const with234 = '234' + cleaned;
        const withPlus234 = '+234' + cleaned;
        
        variations.add(withZero);
        variations.add(with234);
        variations.add(withPlus234);
    }
    
    // Handle UK numbers
    if (cleaned.startsWith('+44')) {
        const withoutPlus = cleaned.substring(1);
        const withZero = '0' + cleaned.substring(3);
        variations.add(withoutPlus);
        variations.add(withZero);
    }
    
    // Handle US/Canada numbers
    if (cleaned.startsWith('+1')) {
        const withoutPlus = cleaned.substring(1);
        variations.add(withoutPlus);
    }
    
    variations.add(cleaned);
    return Array.from(variations).filter(v => v && v.length >= 10);
}

/**
 * Simple cleaning for storage - keeps basic format
 */
function cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '').trim();
}

// =============================================================================
// SECURITY FIXES - INPUT SANITIZATION
// =============================================================================

/**
 * Basic HTML sanitization to prevent XSS attacks
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Safe text display - uses sanitized input
 */
function safeTextDisplay(text) {
    return sanitizeInput(String(text || ''));
}

// =============================================================================
// PERFORMANCE FIXES - MEMORY LEAK PREVENTION
// =============================================================================

// Track chart instances for cleanup
let chartInstances = [];

/**
 * Clean up chart instances to prevent memory leaks
 */
function cleanupCharts() {
    chartInstances.forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    chartInstances = [];
}

/**
 * Safe chart creation with tracking
 */
function createChart(ctx, config) {
    if (!ctx) return null;
    
    try {
        const chart = new Chart(ctx, config);
        chartInstances.push(chart);
        return chart;
    } catch (error) {
        console.error('Chart creation failed:', error);
        return null;
    }
}

// =============================================================================
// EXISTING CODE WITH INTEGRATED FIXES
// =============================================================================

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Global variables for user data
let currentUserData = null;
let userChildren = [];
let unreadResponsesCount = 0;

// -------------------------------------------------------------------
// START: NEW REFERRAL SYSTEM FUNCTIONS (PHASE 1 & 3)
// -------------------------------------------------------------------

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

                const referredName = capitalize(safeTextDisplay(data.referredStudentName || data.referredStudentPhone));
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
        
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${safeTextDisplay(referralCode)}</p>
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
        document.getElementById('loginIdentifier').value = safeTextDisplay(savedEmail);
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
        praiseClause = `It was great to see ${safeTextDisplay(studentName)} demonstrate a solid understanding of several key concepts, particularly in areas like ${safeTextDisplay(uniqueStrengths[0])} and ${safeTextDisplay(uniqueStrengths[1])}. `;
    } else if (uniqueStrengths.length > 0) {
        praiseClause = `${safeTextDisplay(studentName)} showed strong potential, especially in the topic of ${safeTextDisplay(uniqueStrengths.join(', '))}. `;
    } else {
        praiseClause = `${safeTextDisplay(studentName)} has put in a commendable effort on this initial assessment. `;
    }

    let improvementClause = "";
    if (uniqueWeaknesses.length > 2) {
        improvementClause = `Our next step will be to focus on building more confidence in a few areas, such as ${safeTextDisplay(uniqueWeaknesses[0])} and ${safeTextDisplay(uniqueWeaknesses[1])}. `;
    } else if (uniqueWeaknesses.length > 0) {
        improvementClause = `To continue this positive progress, our focus will be on the topic of ${safeTextDisplay(uniqueWeaknesses.join(', '))}. `;
    } else {
        improvementClause = "We will continue to build on these fantastic results and explore more advanced topics. ";
    }

    const closingStatement = `With personalized support from their tutor, ${safeTextDisplay(tutorName)}, at Blooming Kids House, we are very confident that ${safeTextDisplay(studentName)} will master these skills and unlock their full potential.`;

    return praiseClause + improvementClause + closingStatement;
}

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

// Enhanced parent search with phone variations
async function findParentNameFromStudentsWithVariations(parentPhone) {
    const phoneVariations = normalizePhoneNumber(parentPhone);
    
    for (const phoneVar of phoneVariations) {
        const parentName = await findParentNameFromStudents(phoneVar);
        if (parentName) {
            console.log(`Found parent name using phone variation: ${phoneVar} -> ${parentName}`);
            return parentName;
        }
    }
    
    console.log("No parent name found with any phone variation");
    return null;
}

async function findParentNameFromStudents(parentPhone) {
    try {
        console.log("Searching for parent name with phone:", parentPhone);
        
        const studentsSnapshot = await db.collection("students")
            .where("parentPhone", "==", parentPhone)
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

        const pendingStudentsSnapshot = await db.collection("pending_students")
            .where("parentPhone", "==", parentPhone)
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

        const submissionsSnapshot = await db.collection("tutor_submissions")
            .where("parentPhone", "==", parentPhone)
            .limit(1)
            .get();

        if (!submissionsSnapshot.empty) {
            const submissionDoc = submissionsSnapshot.docs[0];
            const submissionData = submissionDoc.data();
            const parentName = submissionData.parentName;
            
            if (parentName) {
                console.log("Found parent name in tutor_submissions:", parentName);
                return parentName;
            }
        }

        console.log("No parent name found in any collection");
        return null;
    } catch (error) {
        console.error("Error finding parent name:", error);
        return null;
    }
}

// Enhanced authentication with smart phone search
async function handleSignUp() {
    const phone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!phone || !email || !password || !confirmPassword) {
        showMessage('Please fill in all fields', 'error');
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

    const cleanedPhone = cleanPhoneNumber(phone);
    if (!cleanedPhone) {
        showMessage('Please enter a valid phone number', 'error');
        return;
    }

    const signUpBtn = document.getElementById('signUpBtn');
    const authLoader = document.getElementById('authLoader');

    signUpBtn.disabled = true;
    signUpBtn.textContent = 'Creating Account...';
    authLoader.classList.remove('hidden');

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(sanitizeInput(email), password);
        const user = userCredential.user;

        const parentName = await findParentNameFromStudentsWithVariations(cleanedPhone);
        const referralCode = await generateReferralCode();

        await db.collection('parent_users').doc(user.uid).set({
            phone: cleanedPhone,
            email: sanitizeInput(email),
            parentName: parentName || 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
        });

        showMessage('Account created successfully!', 'success');
        await loadAllReportsForParentWithVariations(cleanedPhone, user.uid);

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
        signUpBtn.textContent = 'Create Account';
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
    signInBtn.textContent = 'Signing In...';
    authLoader.classList.remove('hidden');

    try {
        let userCredential;
        let userPhone;
        let userId;
        
        if (identifier.includes('@')) {
            userCredential = await auth.signInWithEmailAndPassword(sanitizeInput(identifier), password);
            userId = userCredential.user.uid;
            const userDoc = await db.collection('parent_users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userPhone = userData.phone;
            }
        } else {
            const cleanedPhone = cleanPhoneNumber(identifier);
            const phoneVariations = normalizePhoneNumber(cleanedPhone);
            
            let userQuery;
            for (const phoneVar of phoneVariations) {
                userQuery = await db.collection('parent_users')
                    .where('phone', '==', phoneVar)
                    .limit(1)
                    .get();
                    
                if (!userQuery.empty) break;
            }

            if (!userQuery || userQuery.empty) {
                throw new Error('No account found with this phone number');
            }

            const userData = userQuery.docs[0].data();
            userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
            userPhone = userData.phone;
            userId = userCredential.user.uid;
        }

        if (!userPhone) {
            throw new Error('Could not retrieve phone number for user');
        }
        
        handleRememberMe();
        await loadAllReportsForParentWithVariations(userPhone, userId);

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
        signInBtn.textContent = 'Sign In';
        authLoader.classList.add('hidden');
    }
}

// Enhanced report loading with smart phone search
async function loadAllReportsForParentWithVariations(parentPhone, userId) {
    const phoneVariations = normalizePhoneNumber(parentPhone);
    console.log("Searching for reports with phone variations:", phoneVariations);
    
    for (const phoneVar of phoneVariations) {
        console.log(`Trying phone variation: ${phoneVar}`);
        const hasReports = await tryLoadReportsWithPhone(phoneVar, userId);
        if (hasReports) {
            console.log(`Found reports using phone variation: ${phoneVar}`);
            return;
        }
    }
    
    showMessage(`No reports found for your account. Please contact Blooming Kids House if you believe this is an error.`, 'info');
}

async function tryLoadReportsWithPhone(parentPhone, userId) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    try {
        const cacheKey = `reportCache_${parentPhone}`;
        const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
        
        try {
            const cachedItem = localStorage.getItem(cacheKey);
            if (cachedItem) {
                const { timestamp, html, chartConfigs, userData } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < twoWeeksInMillis) {
                    console.log("Loading reports from cache for phone:", parentPhone);
                    reportContent.innerHTML = html;
                    
                    if (userData && userData.parentName) {
                        welcomeMessage.textContent = `Welcome, ${safeTextDisplay(userData.parentName)}!`;
                        currentUserData = userData;
                    } else {
                        welcomeMessage.textContent = `Welcome!`;
                    }
                    
                    if (chartConfigs && chartConfigs.length > 0) {
                        setTimeout(() => {
                            cleanupCharts();
                            chartConfigs.forEach(chart => {
                                const ctx = document.getElementById(chart.canvasId);
                                if (ctx) createChart(ctx, chart.config);
                            });
                        }, 0);
                    }

                    authArea.classList.add("hidden");
                    reportArea.classList.remove("hidden");
                    addViewResponsesButton();
                    loadReferralRewards(userId);
                    return true;
                }
            }
        } catch (e) {
            console.error("Could not read from cache:", e);
            localStorage.removeItem(cacheKey);
        }

        let parentName = await findParentNameFromStudentsWithVariations(parentPhone);
        const userDocRef = db.collection('parent_users').doc(userId);
        let userDoc = await userDocRef.get();
        let userData = userDoc.data();
        const parentEmail = userData.email;

        if (!userData.referralCode) {
            console.log("Existing user detected without a referral code. Generating and assigning now.");
            try {
                const newReferralCode = await generateReferralCode();
                await userDocRef.update({
                    referralCode: newReferralCode,
                    referralEarnings: userData.referralEarnings || 0
                });
                userDoc = await userDocRef.get();
                userData = userDoc.data();
            } catch (error) {
                console.error('Error auto-assigning referral code:', error);
            }
        }

        if (!parentName && userId) {
            if (userDoc.exists) {
                parentName = userData.parentName;
            }
        }

        if (!parentName) {
            parentName = 'Parent';
        }

        currentUserData = {
            parentName: parentName,
            parentPhone: parentPhone
        };

        welcomeMessage.textContent = `Welcome, ${safeTextDisplay(currentUserData.parentName)}!`;

        if (userId && parentName && parentName !== 'Parent' && userData.parentName !== parentName) {
            try {
                await userDocRef.update({
                    parentName: parentName
                });
            } catch (error) {
                console.error('Error updating parent name:', error);
            }
        }

        console.log("🔍 Searching reports with phone:", parentPhone);

        let assessmentSnapshot;
        let foundReports = false;

        try {
            assessmentSnapshot = await db.collection("student_results").where("parentPhone", "==", parentPhone).get();
            console.log("📊 Assessment results (phone search):", assessmentSnapshot.size);
            
            if (assessmentSnapshot.empty) {
                console.log("🔍 No results from phone search, trying email search...");
                assessmentSnapshot = await db.collection("student_results").where("parentEmail", "==", parentEmail).get();
                console.log("📊 Assessment results (email search):", assessmentSnapshot.size);
            }
            
            foundReports = !assessmentSnapshot.empty;
        } catch (error) {
            console.error("Error searching assessments:", error);
            assessmentSnapshot = { empty: true, forEach: () => {} };
        }

        if (!foundReports) {
            const monthlySnapshot = await db.collection("tutor_submissions").where("parentPhone", "==", parentPhone).get();
            if (monthlySnapshot.empty) {
                return false;
            }
        }

        // Continue with original report loading logic
        return await loadAllReportsForParent(parentPhone, userId);

    } catch (error) {
        console.error("Error in tryLoadReportsWithPhone:", error);
        return false;
    }
}

// Original report loading function (with security and performance enhancements)
async function loadAllReportsForParent(parentPhone, userId) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    authLoader.classList.remove("hidden");

    try {
        const cacheKey = `reportCache_${parentPhone}`;
        const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
        
        try {
            const cachedItem = localStorage.getItem(cacheKey);
            if (cachedItem) {
                const { timestamp, html, chartConfigs, userData } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < twoWeeksInMillis) {
                    console.log("Loading reports from cache.");
                    reportContent.innerHTML = html;
                    
                    if (userData && userData.parentName) {
                        welcomeMessage.textContent = `Welcome, ${safeTextDisplay(userData.parentName)}!`;
                        currentUserData = userData;
                    } else {
                        welcomeMessage.textContent = `Welcome!`;
                    }
                    
                    if (chartConfigs && chartConfigs.length > 0) {
                        setTimeout(() => {
                            cleanupCharts();
                            chartConfigs.forEach(chart => {
                                const ctx = document.getElementById(chart.canvasId);
                                if (ctx) createChart(ctx, chart.config);
                            });
                        }, 0);
                    }

                    authArea.classList.add("hidden");
                    reportArea.classList.remove("hidden");
                    addViewResponsesButton();
                    loadReferralRewards(userId);
                    return;
                }
            }
        } catch (e) {
            console.error("Could not read from cache:", e);
            localStorage.removeItem(cacheKey);
        }

        let parentName = await findParentNameFromStudents(parentPhone);
        const userDocRef = db.collection('parent_users').doc(userId);
        let userDoc = await userDocRef.get();
        let userData = userDoc.data();
        const parentEmail = userData.email;

        if (!userData.referralCode) {
            console.log("Existing user detected without a referral code. Generating and assigning now.");
            try {
                const newReferralCode = await generateReferralCode();
                await userDocRef.update({
                    referralCode: newReferralCode,
                    referralEarnings: userData.referralEarnings || 0
                });
                userDoc = await userDocRef.get();
                userData = userDoc.data();
            } catch (error) {
                console.error('Error auto-assigning referral code:', error);
            }
        }

        if (!parentName && userId) {
            if (userDoc.exists) {
                parentName = userData.parentName;
            }
        }

        if (!parentName) {
            parentName = 'Parent';
        }

        currentUserData = {
            parentName: parentName,
            parentPhone: parentPhone
        };

        welcomeMessage.textContent = `Welcome, ${safeTextDisplay(currentUserData.parentName)}!`;

        if (userId && parentName && parentName !== 'Parent' && userData.parentName !== parentName) {
            try {
                await userDocRef.update({
                    parentName: parentName
                });
            } catch (error) {
                console.error('Error updating parent name:', error);
            }
        }

        console.log("🔍 Searching reports with:", { parentPhone, parentEmail });

        let assessmentSnapshot;
        try {
            assessmentSnapshot = await db.collection("student_results").where("parentPhone", "==", parentPhone).get();
            console.log("📊 Assessment results (phone search):", assessmentSnapshot.size);
            
            if (assessmentSnapshot.empty) {
                console.log("🔍 No results from phone search, trying email search...");
                assessmentSnapshot = await db.collection("student_results").where("parentEmail", "==", parentEmail).get();
                console.log("📊 Assessment results (email search):", assessmentSnapshot.size);
            }
        } catch (error) {
            console.error("Error searching assessments:", error);
            assessmentSnapshot = { empty: true, forEach: () => {} };
        }

        let studentResults = [];
        assessmentSnapshot.forEach(doc => {
            const data = doc.data();
            studentResults.push({ 
                id: doc.id,
                ...data,
                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                type: 'assessment'
            });
        });

        const monthlySnapshot = await db.collection("tutor_submissions").where("parentPhone", "==", parentPhone).get();
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

        console.log("📊 Assessment results (unique):", studentResults.length);
        console.log("📊 Monthly reports:", monthlySnapshot.size);

        if (studentResults.length === 0 && monthlyReports.length === 0) {
            showMessage(`No reports found for your account. Please contact Blooming Kids House if you believe this is an error.`, 'info');
            authLoader.classList.add("hidden");
            loadReferralRewards(userId);
            return;
        }
        
        reportContent.innerHTML = "";
        const chartConfigsToCache = [];

        const studentsMap = new Map();
        studentResults.forEach(result => {
            const studentName = result.studentName;
            if (!studentsMap.has(studentName)) {
                studentsMap.set(studentName, { assessments: [], monthly: [] });
            }
            studentsMap.get(studentName).assessments.push(result);
        });

        monthlyReports.forEach(report => {
            const studentName = report.studentName;
            if (!studentsMap.has(studentName)) {
                studentsMap.set(studentName, { assessments: [], monthly: [] });
            }
            studentsMap.get(studentName).monthly.push(report);
        });

        userChildren = Array.from(studentsMap.keys());
        let studentIndex = 0;

        for (const [studentName, reports] of studentsMap) {
            const fullName = capitalize(studentName);
            
            const studentHeader = `
                <div class="bg-green-100 border-l-4 border-green-600 p-4 rounded-lg mb-6">
                    <h2 class="text-xl font-bold text-green-800">${safeTextDisplay(fullName)}</h2>
                    <p class="text-green-600">Showing all reports for ${safeTextDisplay(fullName)}</p>
                </div>
            `;
            reportContent.innerHTML += studentHeader;

            if (reports.assessments.length > 0) {
                const uniqueSessions = new Map();
                
                reports.assessments.forEach((result) => {
                    const sessionKey = Math.floor(result.timestamp / 86400);
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
                        } catch (error) {}
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

                    const tableRows = results.map(res => `<tr><td class="border px-2 py-1">${safeTextDisplay(res.subject.toUpperCase())}</td><td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td></tr>`).join("");
                    const topicsTableRows = results.map(res => `<tr><td class="border px-2 py-1 font-semibold">${safeTextDisplay(res.subject.toUpperCase())}</td><td class="border px-2 py-1">${safeTextDisplay(res.topics.join(', ') || 'N/A')}</td></tr>`).join("");

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
                                <p class="text-gray-600">Date: ${safeTextDisplay(formattedDate)}</p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                                <div>
                                    <p><strong>Student's Name:</strong> ${safeTextDisplay(fullName)}</p>
                                    <p><strong>Parent's Phone:</strong> ${safeTextDisplay(session[0].parentPhone || 'N/A')}</p>
                                    <p><strong>Grade:</strong> ${safeTextDisplay(session[0].grade)}</p>
                                </div>
                                <div>
                                    <p><strong>Tutor:</strong> ${safeTextDisplay(tutorName || 'N/A')}</p>
                                    <p><strong>Location:</strong> ${safeTextDisplay(studentCountry || 'N/A')}</p>
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
                            <p class="mb-2 text-gray-700 leading-relaxed">${safeTextDisplay(recommendation)}</p>

                            ${creativeWritingAnswer ? `
                            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3>
                            <p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${safeTextDisplay(tutorReport)}</p>
                            ` : ''}

                            ${results.length > 0 ? `
                            <canvas id="chart-${studentIndex}-${assessmentIndex}" class="w-full h-48 mb-4"></canvas>
                            ` : ''}
                            
                            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                                <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${safeTextDisplay(fullName)} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
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
                                    labels: results.map(r => safeTextDisplay(r.subject.toUpperCase())),
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
                            createChart(ctx, chartConfig);
                            chartConfigsToCache.push({ canvasId: `chart-${studentIndex}-${assessmentIndex}`, config: chartConfig });
                        }
                    }
                    assessmentIndex++;
                }
            }
            
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
                                    <p class="text-gray-600">Date: ${safeTextDisplay(formattedDate)}</p>
                                </div>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                                    <div>
                                        <p><strong>Student's Name:</strong> ${safeTextDisplay(monthlyReport.studentName || 'N/A')}</p>
                                        <p><strong>Parent's Name:</strong> ${safeTextDisplay(monthlyReport.parentName || 'N/A')}</p>
                                        <p><strong>Parent's Phone:</strong> ${safeTextDisplay(monthlyReport.parentPhone || 'N/A')}</p>
                                    </div>
                                    <div>
                                        <p><strong>Grade:</strong> ${safeTextDisplay(monthlyReport.grade || 'N/A')}</p>
                                        <p><strong>Tutor's Name:</strong> ${safeTextDisplay(monthlyReport.tutorName || 'N/A')}</p>
                                    </div>
                                </div>

                                ${monthlyReport.introduction ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">INTRODUCTION</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeTextDisplay(monthlyReport.introduction)}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.topics ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeTextDisplay(monthlyReport.topics)}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.progress ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeTextDisplay(monthlyReport.progress)}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.strengthsWeaknesses ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeTextDisplay(monthlyReport.strengthsWeaknesses)}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.recommendations ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeTextDisplay(monthlyReport.recommendations)}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.generalComments ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeTextDisplay(monthlyReport.generalComments)}</p>
                                </div>
                                ` : ''}

                                <div class="text-right mt-8 pt-4 border-t">
                                    <p class="text-gray-600">Best regards,</p>
                                    <p class="font-semibold text-green-800">${safeTextDisplay(monthlyReport.tutorName || 'N/A')}</p>
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

        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        addViewResponsesButton();
        loadReferralRewards(userId);

    } catch (error) {
        console.error("Error loading reports:", error);
        showMessage("Sorry, there was an error loading the reports. Please try again.", "error");
    } finally {
        authLoader.classList.add("hidden");
    }
}

// =============================================================================
// EXISTING FUNCTIONS (with security enhancements)
// =============================================================================

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
        await auth.sendPasswordResetEmail(sanitizeInput(email));
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
    submitBtn.textContent = 'Submitting...';

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to submit feedback');
        }

        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        const feedbackData = {
            parentName: safeTextDisplay(currentUserData?.parentName || userData.parentName || 'Unknown Parent'),
            parentPhone: userData.phone,
            parentEmail: userData.email,
            studentName: safeTextDisplay(student),
            category: category,
            priority: priority,
            message: safeTextDisplay(message),
            status: 'New',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            emailSent: false,
            parentUid: user.uid,
            responses: []
        };

        await db.collection('parent_feedback').add(feedbackData);

        showMessage('Thank you! Your feedback has been submitted successfully. We will respond within 24-48 hours.', 'success');
        hideFeedbackModal();

    } catch (error) {
        console.error('Feedback submission error:', error);
        showMessage('Failed to submit feedback. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
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
        if (!user) {
            throw new Error('Please sign in to view responses');
        }

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
                                ${safeTextDisplay(feedback.category)}
                            </span>
                            <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(feedback.priority)}">
                                ${safeTextDisplay(feedback.priority)} Priority
                            </span>
                        </div>
                        <span class="text-sm text-gray-500">${safeTextDisplay(formattedDate)}</span>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="font-semibold text-gray-800 mb-2">Regarding: ${safeTextDisplay(feedback.studentName)}</h4>
                        <p class="text-gray-700 bg-gray-50 p-4 rounded-lg border">${safeTextDisplay(feedback.message)}</p>
                    </div>
                    
                    <div class="response-bubble">
                        <div class="response-header">📨 Response from ${safeTextDisplay(response.responderName || 'Admin')}:</div>
                        <p class="text-gray-700 mt-2">${safeTextDisplay(response.responseText)}</p>
                        <div class="text-sm text-gray-500 mt-2">
                            Responded by: ${safeTextDisplay(response.responderName || 'Admin Staff')} 
                            ${response.responderEmail ? `(${safeTextDisplay(response.responderEmail)})` : ''}
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

        updateNotificationBadge(totalResponses > 0 ? totalResponses : 0);
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

function addViewResponsesButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    if (document.getElementById('viewResponsesBtn')) return;
    
    const viewResponsesBtn = document.createElement('button');
    viewResponsesBtn.id = 'viewResponsesBtn';
    viewResponsesBtn.onclick = showResponsesModal;
    viewResponsesBtn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 btn-glow flex items-center justify-center relative';
    viewResponsesBtn.innerHTML = '<span class="mr-2">📨</span> View Responses';
    
    buttonContainer.insertBefore(viewResponsesBtn, buttonContainer.lastElementChild);
    
    setTimeout(() => {
        checkForNewResponses();
    }, 1000);
}

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

function logout() {
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    cleanupCharts();
    auth.signOut().then(() => {
        window.location.reload();
    });
}

function showMessage(message, type) {
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
    messageDiv.textContent = `BKH says: ${safeTextDisplay(message)}`;
    
    document.body.appendChild(messageDiv);
    
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
    
    reportTab?.classList.remove('tab-active-main');
    reportTab?.classList.add('tab-inactive-main');
    rewardsTab?.classList.remove('tab-active-main');
    rewardsTab?.classList.add('tab-inactive-main');
    
    reportContentArea?.classList.add('hidden');
    rewardsContentArea?.classList.add('hidden');
    
    if (tab === 'reports') {
        reportTab?.classList.remove('tab-inactive-main');
        reportTab?.classList.add('tab-active-main');
        reportContentArea?.classList.remove('hidden');
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

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    setupRememberMe();
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            db.collection('parent_users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userPhone = doc.data().phone;
                        loadAllReportsForParentWithVariations(userPhone, user.uid);
                    }
                })
                .catch((error) => {
                    console.error('Error getting user data:', error);
                });
        } else {
            cleanupCharts();
        }
    });

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

    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignIn();
    });
    
    document.getElementById('signupConfirmPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignUp();
    });
    
    document.getElementById('resetEmail').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePasswordReset();
    });
    
    document.getElementById("reportTab")?.addEventListener("click", () => switchMainTab('reports'));
    document.getElementById("rewardsTab")?.addEventListener("click", () => switchMainTab('rewards'));
});

// Clean up on page unload
window.addEventListener('beforeunload', cleanupCharts);
