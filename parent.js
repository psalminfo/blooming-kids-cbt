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

// Simple phone cleaning - just trim, no normalization
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

// Referral System Functions
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'BKH';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function ensureReferralCode(userId, userData) {
    try {
        const userDoc = await db.collection('parent_users').doc(userId).get();
        
        if (userDoc.exists) {
            const existingData = userDoc.data();
            // If referral code already exists, return it
            if (existingData.referralCode) {
                return existingData.referralCode;
            }
        }
        
        // Generate new referral code
        let referralCode;
        let isUnique = false;
        
        // Ensure code is unique
        while (!isUnique) {
            referralCode = generateReferralCode();
            const codeCheck = await db.collection('parent_users')
                .where('referralCode', '==', referralCode)
                .limit(1)
                .get();
            isUnique = codeCheck.empty;
        }
        
        // Initialize referral data
        const referralData = {
            referralCode: referralCode,
            referralEarnings: 0,
            referrals: [],
            totalEarned: 0,
            totalPaid: 0,
            pendingBalance: 0
        };
        
        // Update user document with referral data
        await db.collection('parent_users').doc(userId).set({
            ...userData,
            ...referralData
        }, { merge: true });
        
        console.log("Referral code generated:", referralCode);
        return referralCode;
        
    } catch (error) {
        console.error("Error ensuring referral code:", error);
        return null;
    }
}

// Rewards Dashboard Functions
function showRewardsDashboard() {
    document.getElementById('rewardsModal').classList.remove('hidden');
    loadRewardsData();
}

function hideRewardsDashboard() {
    document.getElementById('rewardsModal').classList.add('hidden');
}

async function loadRewardsData() {
    const rewardsContent = document.getElementById('rewardsContent');
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to view rewards');
        }

        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error('User data not found');
        }

        const userData = userDoc.data();
        const referralCode = userData.referralCode;
        const referralEarnings = userData.referralEarnings || 0;
        const referrals = userData.referrals || [];
        const pendingBalance = userData.pendingBalance || 0;
        const totalEarned = userData.totalEarned || 0;
        const totalPaid = userData.totalPaid || 0;

        // Build rewards dashboard HTML
        let rewardsHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 class="text-xl font-bold text-green-800 mb-4">Your Referral Code</h3>
                <div class="flex items-center justify-between bg-green-50 p-4 rounded-lg border border-green-200">
                    <span class="text-2xl font-mono font-bold text-green-700">${referralCode}</span>
                    <button onclick="copyReferralCode('${referralCode}')" class="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center">
                        <span class="mr-2">📋</span> Copy Code
                    </button>
                </div>
                <p class="text-gray-600 mt-3 text-sm">Share this code with friends and earn ₦5,000 when they join Blooming Kids House!</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold text-green-700">₦${pendingBalance.toLocaleString()}</div>
                    <div class="text-green-600 font-semibold">Pending Balance</div>
                    <div class="text-xs text-gray-500 mt-1">Available for payout</div>
                </div>
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold text-blue-700">₦${totalEarned.toLocaleString()}</div>
                    <div class="text-blue-600 font-semibold">Total Earned</div>
                    <div class="text-xs text-gray-500 mt-1">All time earnings</div>
                </div>
                <div class="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                    <div class="text-2xl font-bold text-purple-700">${referrals.length}</div>
                    <div class="text-purple-600 font-semibold">Total Referrals</div>
                    <div class="text-xs text-gray-500 mt-1">Successful referrals</div>
                </div>
            </div>
        `;

        if (referrals.length > 0) {
            rewardsHTML += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 class="text-xl font-bold text-green-800 mb-4">Your Referrals</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-2 text-left font-semibold text-gray-700">Student Name</th>
                                    <th class="px-4 py-2 text-left font-semibold text-gray-700">Date Referred</th>
                                    <th class="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                                    <th class="px-4 py-2 text-left font-semibold text-gray-700">Reward</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">
            `;

            referrals.forEach((referral, index) => {
                const referredDate = referral.timestamp?.toDate ? referral.timestamp.toDate() : new Date();
                const formattedDate = referredDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                const statusColors = {
                    'pending': 'bg-yellow-100 text-yellow-800',
                    'approved': 'bg-green-100 text-green-800',
                    'paid': 'bg-blue-100 text-blue-800'
                };

                rewardsHTML += `
                    <tr class="${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}">
                        <td class="px-4 py-3 font-medium text-gray-900">${referral.studentName}</td>
                        <td class="px-4 py-3 text-gray-600">${formattedDate}</td>
                        <td class="px-4 py-3">
                            <span class="inline-block px-2 py-1 rounded-full text-xs font-semibold ${statusColors[referral.status] || 'bg-gray-100 text-gray-800'}">
                                ${referral.status?.charAt(0).toUpperCase() + referral.status?.slice(1) || 'Pending'}
                            </span>
                        </td>
                        <td class="px-4 py-3 font-semibold ${referral.status === 'paid' ? 'text-green-600' : 'text-gray-600'}">
                            ${referral.status === 'paid' ? '₦5,000' : 'Pending'}
                        </td>
                    </tr>
                `;
            });

            rewardsHTML += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            rewardsHTML += `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <div class="text-6xl mb-4">👥</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Referrals Yet</h3>
                    <p class="text-gray-500 max-w-md mx-auto mb-6">Share your referral code with friends and family to start earning rewards!</p>
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
                        <h4 class="font-semibold text-yellow-800 mb-2">How it works:</h4>
                        <ul class="text-sm text-yellow-700 text-left space-y-1">
                            <li>• Share your unique referral code</li>
                            <li>• Friend signs up using your code</li>
                            <li>• Earn ₦5,000 when they receive their first monthly report</li>
                            <li>• Get paid after approval</li>
                        </ul>
                    </div>
                </div>
            `;
        }

        rewardsContent.innerHTML = rewardsHTML;

    } catch (error) {
        console.error('Error loading rewards data:', error);
        rewardsContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Rewards</h3>
                <p class="text-gray-500">Unable to load rewards data at this time. Please try again later.</p>
            </div>
        `;
    }
}

function copyReferralCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showMessage('Referral code copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showMessage('Referral code copied to clipboard!', 'success');
    });
}

// Add Rewards button to the welcome section
function addRewardsButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    // Check if button already exists
    if (document.getElementById('rewardsBtn')) return;
    
    const rewardsBtn = document.createElement('button');
    rewardsBtn.id = 'rewardsBtn';
    rewardsBtn.onclick = showRewardsDashboard;
    rewardsBtn.className = 'bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-all duration-200 btn-glow flex items-center justify-center';
    rewardsBtn.innerHTML = '<span class="mr-2">🎁</span> Rewards';
    
    // Insert before the logout button
    buttonContainer.insertBefore(rewardsBtn, buttonContainer.lastElementChild);
}

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
        
        // PRIMARY SEARCH: students collection (same as tutor.js)
        const studentsSnapshot = await db.collection("students")
            .where("parentPhone", "==", parentPhone)
            .limit(1)
            .get();

        if (!studentsSnapshot.empty) {
            const studentDoc = studentsSnapshot.docs[0];
            const studentData = studentDoc.data();
            
            // Use parentName field (same as tutor.js)
            const parentName = studentData.parentName;
            
            if (parentName) {
                console.log("Found parent name in students collection:", parentName);
                return parentName;
            }
        }

        // SECONDARY SEARCH: pending_students collection (same as tutor.js)
        const pendingStudentsSnapshot = await db.collection("pending_students")
            .where("parentPhone", "==", parentPhone)
            .limit(1)
            .get();

        if (!pendingStudentsSnapshot.empty) {
            const pendingStudentDoc = pendingStudentsSnapshot.docs[0];
            const pendingStudentData = pendingStudentDoc.data();
            
            // Use parentName field (same as tutor.js)
            const parentName = pendingStudentData.parentName;
            
            if (parentName) {
                console.log("Found parent name in pending_students collection:", parentName);
                return parentName;
            }
        }

        // FALLBACK SEARCH: tutor_submissions (for historical data)
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

// Authentication Functions
async function handleSignUp() {
    const phone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    // Validation
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
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Find parent name from existing data (SAME SOURCE AS TUTOR.JS)
        const parentName = await findParentNameFromStudents(cleanedPhone);

        // Prepare user data
        const userData = {
            phone: cleanedPhone,
            email: email,
            parentName: parentName || 'Parent', // Use found name or default
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Store user data in Firestore with referral code
        await ensureReferralCode(user.uid, userData);

        showMessage('Account created successfully!', 'success');
        
        // Automatically load reports after signup
        await loadAllReportsForParent(cleanedPhone, user.uid);

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
            }
        } else {
            // Sign in with phone - find the user's email first
            const cleanedPhone = cleanPhoneNumber(identifier);
            const userQuery = await db.collection('parent_users')
                .where('phone', '==', cleanedPhone)
                .limit(1)
                .get();

            if (userQuery.empty) {
                throw new Error('No account found with this phone number');
            }

            const userData = userQuery.docs[0].data();
            userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
            userPhone = cleanedPhone;
            userId = userCredential.user.uid;
        }

        if (!userPhone) {
            throw new Error('Could not retrieve phone number for user');
        }
        
        // Handle Remember Me
        handleRememberMe();
        
        // Ensure referral code exists for existing users
        const userDoc = await db.collection('parent_users').doc(userId).get();
        if (userDoc.exists && !userDoc.data().referralCode) {
            await ensureReferralCode(userId, userDoc.data());
        }
        
        // Load all reports for the parent using the exact phone number as stored
        await loadAllReportsForParent(userPhone, userId);

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
    submitBtn.textContent = 'Submitting...';

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
        submitBtn.textContent = 'Submit Feedback';
    }
}

// Admin Responses Functions with Notification Counter
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

// Notification System for Responses
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
    unreadResponsesCount = 0;
    updateNotificationBadge(0);
}

// Utility Functions
function getCategoryColor(category) {
    const colors = {
        'Academic Progress': 'bg-blue-100 text-blue-800',
        'Behavior': 'bg-orange-100 text-orange-800',
        'Communication': 'bg-purple-100 text-purple-800',
        'Scheduling': 'bg-green-100 text-green-800',
        'Technical Issue': 'bg-red-100 text-red-800',
        'General Feedback': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
}

function getPriorityColor(priority) {
    const colors = {
        'Low': 'bg-green-100 text-green-800',
        'Medium': 'bg-yellow-100 text-yellow-800',
        'High': 'bg-orange-100 text-orange-800',
        'Urgent': 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg font-semibold shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    messageDiv.classList.remove('hidden');
    
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}

function toggleAuthMode() {
    const container = document.getElementById('authContainer');
    const toggleBtn = document.getElementById('authToggleBtn');
    const isLogin = container.classList.contains('login-mode');
    
    if (isLogin) {
        // Switch to signup
        container.classList.remove('login-mode');
        container.classList.add('signup-mode');
        toggleBtn.textContent = 'Already have an account? Sign In';
        document.getElementById('authTitle').textContent = 'Create Parent Account';
    } else {
        // Switch to login
        container.classList.remove('signup-mode');
        container.classList.add('login-mode');
        toggleBtn.textContent = "Don't have an account? Sign Up";
        document.getElementById('authTitle').textContent = 'Parent Portal Sign In';
    }
}

function showPasswordResetModal() {
    document.getElementById('passwordResetModal').classList.remove('hidden');
}

function hidePasswordResetModal() {
    document.getElementById('passwordResetModal').classList.add('hidden');
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
}

// Report Loading Functions
async function loadAllReportsForParent(parentPhone, userId) {
    const reportsContainer = document.getElementById('reportsContainer');
    const welcomeSection = document.getElementById('welcomeSection');
    const authSection = document.getElementById('authSection');
    
    // Show loading state
    reportsContainer.innerHTML = `
        <div class="text-center py-12">
            <div class="loading-spinner mx-auto" style="width: 50px; height: 50px;"></div>
            <p class="text-green-600 font-semibold mt-4">Loading your child's reports...</p>
        </div>
    `;
    
    try {
        // Get user data for welcome message
        const userDoc = await db.collection('parent_users').doc(userId).get();
        if (userDoc.exists) {
            currentUserData = userDoc.data();
        }
        
        // Build welcome message
        const welcomeName = currentUserData?.parentName || 'Parent';
        document.getElementById('welcomeName').textContent = welcomeName;
        
        // Show welcome section, hide auth
        welcomeSection.classList.remove('hidden');
        authSection.classList.add('hidden');
        
        // Add Rewards button to welcome section
        addRewardsButton();
        
        // Query for all reports for this parent's phone number
        const reportsQuery = db.collection("tutor_submissions")
            .where("parentPhone", "==", parentPhone)
            .orderBy("submissionDate", "desc");
            
        const querySnapshot = await reportsQuery.get();
        
        if (querySnapshot.empty) {
            reportsContainer.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📊</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Reports Yet</h3>
                    <p class="text-gray-500 max-w-md mx-auto">Assessment reports for your children will appear here once they are completed by our tutors.</p>
                </div>
            `;
            return;
        }
        
        // Group reports by student name
        const reportsByStudent = {};
        
        querySnapshot.forEach((doc) => {
            const reportData = doc.data();
            const studentName = reportData.studentName;
            
            if (!reportsByStudent[studentName]) {
                reportsByStudent[studentName] = [];
            }
            
            reportsByStudent[studentName].push({
                id: doc.id,
                ...reportData
            });
        });
        
        // Display reports grouped by student
        reportsContainer.innerHTML = '';
        
        for (const [studentName, reports] of Object.entries(reportsByStudent)) {
            const studentSection = document.createElement('div');
            studentSection.className = 'mb-8';
            
            // Student header
            studentSection.innerHTML = `
                <div class="bg-green-100 border border-green-300 rounded-xl p-4 mb-4">
                    <h2 class="text-xl font-bold text-green-800">${studentName}'s Assessment Reports</h2>
                </div>
                <div class="space-y-4">
                    ${reports.map(report => createReportCard(report)).join('')}
                </div>
            `;
            
            reportsContainer.appendChild(studentSection);
        }
        
        // Start checking for new responses
        setInterval(checkForNewResponses, 30000); // Check every 30 seconds
        await checkForNewResponses(); // Initial check
        
    } catch (error) {
        console.error("Error loading reports:", error);
        reportsContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Reports</h3>
                <p class="text-gray-500">Unable to load assessment reports at this time. Please try again later.</p>
            </div>
        `;
    }
}

function createReportCard(report) {
    const submissionDate = report.submissionDate?.toDate() || new Date();
    const formattedDate = submissionDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Calculate overall performance
    const totalQuestions = report.results.reduce((sum, result) => sum + result.total, 0);
    const totalCorrect = report.results.reduce((sum, result) => sum + result.correct, 0);
    const overallPercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    
    // Get performance label and color
    const performance = getPerformanceLabel(overallPercentage);
    
    // Generate recommendation
    const recommendation = generateTemplatedRecommendation(
        report.studentName,
        report.tutorName,
        report.results
    );
    
    return `
        <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div class="flex flex-wrap justify-between items-start gap-4 mb-4">
                <div>
                    <h3 class="text-lg font-semibold text-gray-800">Assessment Report</h3>
                    <p class="text-gray-600 text-sm">Submitted by ${report.tutorName} on ${formattedDate}</p>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold ${performance.color}">${overallPercentage}%</div>
                    <div class="text-sm font-semibold ${performance.color}">${performance.label}</div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">Subject Performance</h4>
                    <div class="space-y-2">
                        ${report.results.map(result => {
                            const percentage = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
                            const subjectPerformance = getPerformanceLabel(percentage);
                            return `
                                <div class="flex justify-between items-center">
                                    <span class="text-sm font-medium text-gray-600">${result.subject}</span>
                                    <div class="flex items-center gap-2">
                                        <span class="text-sm font-semibold ${subjectPerformance.color}">${percentage}%</span>
                                        <div class="w-16 bg-gray-200 rounded-full h-2">
                                            <div class="h-2 rounded-full ${subjectPerformance.color.split(' ')[0]}" style="width: ${percentage}%"></div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div>
                    <h4 class="font-semibold text-gray-700 mb-2">Recommendation</h4>
                    <p class="text-gray-600 text-sm leading-relaxed">${recommendation}</p>
                </div>
            </div>
            
            ${report.additionalNotes ? `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 class="font-semibold text-blue-700 mb-1">Additional Notes from Tutor</h4>
                    <p class="text-blue-600 text-sm">${report.additionalNotes}</p>
                </div>
            ` : ''}
        </div>
    `;
}

function getPerformanceLabel(percentage) {
    if (percentage >= 90) return { label: 'Excellent', color: 'text-green-600' };
    if (percentage >= 80) return { label: 'Very Good', color: 'text-green-500' };
    if (percentage >= 70) return { label: 'Good', color: 'text-blue-500' };
    if (percentage >= 60) return { label: 'Satisfactory', color: 'text-yellow-500' };
    if (percentage >= 50) return { label: 'Needs Improvement', color: 'text-orange-500' };
    return { label: 'Requires Attention', color: 'text-red-500' };
}

function signOut() {
    auth.signOut().then(() => {
        // Reset UI
        document.getElementById('welcomeSection').classList.add('hidden');
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('reportsContainer').innerHTML = '';
        
        // Reset form
        document.getElementById('loginIdentifier').value = '';
        document.getElementById('loginPassword').value = '';
        
        // Hide any modals
        document.getElementById('feedbackModal').classList.add('hidden');
        document.getElementById('responsesModal').classList.add('hidden');
        document.getElementById('rewardsModal').classList.add('hidden');
        
        showMessage('Signed out successfully', 'success');
    }).catch((error) => {
        console.error('Sign out error:', error);
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set up Remember Me
    setupRememberMe();
    
    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            console.log("User signed in:", user.uid);
            
            // Get user data and ensure referral code exists
            db.collection('parent_users').doc(user.uid).get().then((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    if (!userData.referralCode) {
                        ensureReferralCode(user.uid, userData);
                    }
                }
            });
            
        } else {
            // User is signed out
            console.log("User signed out");
        }
    });
});

// Add Rewards Modal to the DOM
document.addEventListener('DOMContentLoaded', function() {
    // Create Rewards Modal if it doesn't exist
    if (!document.getElementById('rewardsModal')) {
        const rewardsModal = document.createElement('div');
        rewardsModal.id = 'rewardsModal';
        rewardsModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
        rewardsModal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
                <div class="bg-gradient-to-r from-purple-600 to-green-600 p-6 text-white">
                    <div class="flex justify-between items-center">
                        <h2 class="text-2xl font-bold">🎁 Your Rewards Dashboard</h2>
                        <button onclick="hideRewardsDashboard()" class="text-white hover:text-gray-200 text-2xl font-bold">&times;</button>
                    </div>
                    <p class="mt-2 opacity-90">Track your referrals and earnings</p>
                </div>
                <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div id="rewardsContent">
                        <!-- Rewards content will be loaded here -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(rewardsModal);
    }
});
[file content end]

