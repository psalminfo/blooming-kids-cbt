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

// SIMPLIFIED PHONE NORMALIZATION FUNCTION
function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, valid: false, error: 'Invalid input' };
    }

    console.log("🔧 Normalizing phone:", phone);
    
    try {
        // Clean the phone number - remove all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // Remove leading zeros if present
        cleaned = cleaned.replace(/^0+/, '');
        
        // If no country code, add +1 as default
        if (!cleaned.startsWith('+')) {
            cleaned = '+1' + cleaned;
        }
        
        // Ensure format is correct
        return {
            normalized: cleaned,
            valid: true,
            error: null
        };
        
    } catch (error) {
        console.error("❌ Phone normalization error:", error);
        return { 
            normalized: null, 
            valid: false, 
            error: error.message
        };
    }
}

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Global variables for user data
let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let unreadMessagesCount = 0;
let realTimeListeners = [];

// -------------------------------------------------------------------
// REFERRAL SYSTEM FUNCTIONS
// -------------------------------------------------------------------

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
    return code;
}

/**
 * Loads the parent's referral data for the Rewards Dashboard.
 */
async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';

    try {
        // Get the parent's referral code and current earnings
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) {
            rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found. Please sign in again.</p>';
            return;
        }
        const userData = userDoc.data();
        const referralCode = userData.referralCode || 'N/A';
        const totalEarnings = userData.referralEarnings || 0;
        
        // Query referral transactions - NO COMPOSITE INDEX NEEDED
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
                const status = data.status || 'pending';
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

// Find parent name from students collection
async function findParentNameFromStudents(parentPhone) {
    try {
        console.log("Searching for parent name with phone:", parentPhone);
        
        // Normalize the phone number
        const normalizedPhone = normalizePhoneNumber(parentPhone);
        if (!normalizedPhone.valid) {
            console.log("Invalid phone number format");
            return null;
        }

        // Search in students collection
        const studentsSnapshot = await db.collection("students")
            .where("parentPhone", "==", normalizedPhone.normalized)
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

        // Search in pending_students collection
        const pendingStudentsSnapshot = await db.collection("pending_students")
            .where("parentPhone", "==", normalizedPhone.normalized)
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

        console.log("No parent name found");
        return null;
    } catch (error) {
        console.error("Error finding parent name:", error);
        return null;
    }
}

// Find student IDs for a parent's phone number - FIXED TO SHOW ALL STUDENTS
async function findStudentIdsForParent(parentPhone) {
    try {
        console.log("Finding student IDs for parent phone:", parentPhone);
        
        // Normalize the phone number
        const normalizedPhone = normalizePhoneNumber(parentPhone);
        if (!normalizedPhone.valid) {
            console.log("Invalid phone number format");
            return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
        }

        let studentIds = [];
        let studentNameIdMap = new Map();
        let allStudentData = [];
        
        // Search in students collection
        const studentsSnapshot = await db.collection("students")
            .where("parentPhone", "==", normalizedPhone.normalized)
            .get();

        studentsSnapshot.forEach(doc => {
            const studentData = doc.data();
            const studentId = doc.id;
            const studentName = studentData.studentName;
            
            if (studentId && studentName) {
                if (!studentIds.includes(studentId)) {
                    studentIds.push(studentId);
                }
                studentNameIdMap.set(studentName, studentId);
                allStudentData.push({ id: studentId, name: studentName, data: studentData });
                console.log(`Found student: ${studentName} (ID: ${studentId})`);
            }
        });

        // Search in pending_students collection
        const pendingStudentsSnapshot = await db.collection("pending_students")
            .where("parentPhone", "==", normalizedPhone.normalized)
            .get();

        pendingStudentsSnapshot.forEach(doc => {
            const studentData = doc.data();
            const studentId = doc.id;
            const studentName = studentData.studentName;
            
            if (studentId && studentName) {
                if (!studentIds.includes(studentId)) {
                    studentIds.push(studentId);
                }
                studentNameIdMap.set(studentName, studentId);
                allStudentData.push({ id: studentId, name: studentName, data: studentData, isPending: true });
                console.log(`Found pending student: ${studentName} (ID: ${studentId})`);
            }
        });

        // Store the mapping globally
        studentIdMap = studentNameIdMap;
        
        console.log("Total student IDs found:", studentIds.length);
        console.log("Student name to ID mapping:", Object.fromEntries(studentNameIdMap));
        
        return { studentIds, studentNameIdMap, allStudentData };
    } catch (error) {
        console.error("Error finding student IDs:", error);
        return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
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
    
    // Normalize phone
    const normalizedPhone = normalizePhoneNumber(fullPhoneNumber);
    
    if (!normalizedPhone.valid) {
        showMessage('Invalid phone number format. Please check your phone number.', 'error');
        return;
    }

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

        // Find parent name from existing data
        const parentName = await findParentNameFromStudents(normalizedPhone.normalized);
        
        // Generate referral code
        const referralCode = await generateReferralCode();

        // Store user data in Firestore for easy retrieval
        await db.collection('parent_users').doc(user.uid).set({
            phone: fullPhoneNumber,
            normalizedPhone: normalizedPhone.normalized,
            countryCode: countryCode,
            localPhone: localPhone,
            email: email,
            parentName: parentName || 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
        });

        showMessage('Account created successfully!', 'success');
        
        // Automatically load reports after signup
        await loadAllReportsForParent(normalizedPhone.normalized, user.uid);

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
            // Sign in with phone - normalize the input
            const phoneValidation = normalizePhoneNumber(identifier);
            if (!phoneValidation.valid) {
                throw new Error(`Invalid phone number format. Please try with country code (like +1234567890) or local format`);
            }
            
            normalizedPhone = phoneValidation.normalized;
            
            // Find user by phone
            const userQuery = await db.collection('parent_users')
                .where('normalizedPhone', '==', normalizedPhone)
                .limit(1)
                .get();

            if (!userQuery.empty) {
                const userData = userQuery.docs[0].data();
                userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
                userPhone = userData.phone;
                userId = userCredential.user.uid;
            } else {
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
            const phoneValidation = normalizePhoneNumber(userPhone);
            if (phoneValidation.valid) {
                normalizedPhone = phoneValidation.normalized;
            }
        }

        if (!normalizedPhone) {
            throw new Error('Could not retrieve valid phone number for user');
        }
        
        // Handle Remember Me
        handleRememberMe();
        
        // Load all reports for the parent using the normalized phone number
        await loadAllReportsForParent(normalizedPhone, userId);

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

// -------------------------------------------------------------------
// ENHANCED MESSAGING SYSTEM - FIXED FOR NO INDEXES
// -------------------------------------------------------------------

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
    studentDropdown.innerHTML = '<option value="">Select student (optional)</option>';
    
    // Get student names from the userChildren array
    if (userChildren.length === 0) {
        studentDropdown.innerHTML += '<option value="" disabled>No students found</option>';
        return;
    }

    userChildren.forEach(studentName => {
        const option = document.createElement('option');
        option.value = studentName;
        option.textContent = capitalize(studentName);
        studentDropdown.appendChild(option);
    });
}

async function submitMessage() {
    const recipient = document.getElementById('messageRecipient').value;
    const subject = document.getElementById('messageSubject').value.trim();
    const student = document.getElementById('messageStudent').value;
    const content = document.getElementById('messageContent').value.trim();
    const isUrgent = document.getElementById('messageUrgent').checked;

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

        // Create message document in tutor_messages collection
        const messageData = {
            parentName: currentUserData?.parentName || userData.parentName || 'Unknown Parent',
            parentPhone: userData.phone,
            parentEmail: userData.email,
            parentUid: user.uid,
            studentName: student || 'General',
            recipients: recipients,
            subject: subject,
            content: content,
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

// -------------------------------------------------------------------
// ACADEMICS TAB FUNCTIONS - FIXED DATE ERROR
// -------------------------------------------------------------------

async function loadAcademicsData(selectedStudent = null) {
    const academicsContent = document.getElementById('academicsContent');
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

        // Create student selector if multiple students
        if (studentNameIdMap.size > 1) {
            academicsHtml += `
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
                    <select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" onchange="onStudentSelected(this.value)">
                        <option value="">All Students</option>
            `;
            
            Array.from(studentNameIdMap.keys()).forEach(studentName => {
                const isSelected = selectedStudent === studentName ? 'selected' : '';
                const studentStatus = allStudentData.find(s => s.name === studentName)?.isPending ? ' (Pending Registration)' : '';
                academicsHtml += `<option value="${studentName}" ${isSelected}>${capitalize(studentName)}${studentStatus}</option>`;
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

            const studentHeader = studentsToShow.length > 1 ? `
                <div class="bg-green-100 border-l-4 border-green-600 p-4 rounded-lg mb-6">
                    <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}${studentData?.isPending ? ' (Pending Registration)' : ''}</h2>
                    <p class="text-green-600">Academic progress and assignments</p>
                </div>
            ` : '';

            academicsHtml += studentHeader;

            // Student Information Section
            academicsHtml += `
                <div class="mb-8">
                    <h3 class="text-lg font-semibold text-green-700 mb-4 flex items-center">
                        <span class="mr-2">👤</span> Student Information
                    </h3>
                    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-500">Status</p>
                                <p class="font-medium">${studentData?.isPending ? 'Pending Registration' : 'Active'}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Assigned Tutor</p>
                                <p class="font-medium">${studentData?.data?.tutorName || 'Not yet assigned'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Daily Topics Section - FIXED DATE HANDLING
            academicsHtml += `
                <div class="mb-8">
                    <h3 class="text-lg font-semibold text-green-700 mb-4 flex items-center">
                        <span class="mr-2">📅</span> Daily Topics
                    </h3>
            `;

            try {
                // Fetch daily topics - NO ORDER BY TO AVOID INDEX
                const dailyTopicsSnapshot = await db.collection('daily_topics')
                    .where('studentId', '==', studentId)
                    .get();

                if (dailyTopicsSnapshot.empty) {
                    academicsHtml += `
                        <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                            <p class="text-gray-500">No daily topics recorded yet. Check back after your child's first session!</p>
                        </div>
                    `;
                } else {
                    const topics = dailyTopicsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    // Sort manually by date descending (most recent first)
                    topics.sort((a, b) => {
                        // Handle both Firestore Timestamp and string dates
                        let aDate = a.date;
                        let bDate = b.date;
                        
                        if (a.date?.toDate) {
                            aDate = a.date.toDate();
                        } else if (typeof a.date === 'string') {
                            aDate = new Date(a.date);
                        }
                        
                        if (b.date?.toDate) {
                            bDate = b.date.toDate();
                        } else if (typeof b.date === 'string') {
                            bDate = new Date(b.date);
                        }
                        
                        return (bDate || new Date(0)) - (aDate || new Date(0));
                    }).slice(0, 10); // Limit to 10 most recent
                    
                    academicsHtml += `<div class="space-y-4">`;
                    
                    topics.forEach(topicData => {
                        let date = topicData.date;
                        if (date?.toDate) {
                            date = date.toDate();
                        } else if (typeof date === 'string') {
                            date = new Date(date);
                        }
                        
                        const formattedDate = date instanceof Date ? date.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                        }) : 'Unknown date';
                        
                        academicsHtml += `
                            <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="font-medium text-gray-800">${formattedDate}</span>
                                    <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Daily Session</span>
                                </div>
                                <div class="text-gray-700">
                                    <p class="whitespace-pre-wrap">${topicData.topics || 'No topics recorded for this session.'}</p>
                                </div>
                            </div>
                        `;
                    });
                    
                    academicsHtml += `</div>`;
                }
            } catch (error) {
                console.error('Error loading daily topics:', error);
                academicsHtml += `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p class="text-yellow-700">Unable to load daily topics at this time.</p>
                    </div>
                `;
            }

            academicsHtml += `</div>`;

            // Homework Assignments Section
            academicsHtml += `
                <div class="mb-8">
                    <h3 class="text-lg font-semibold text-green-700 mb-4 flex items-center">
                        <span class="mr-2">📝</span> Homework Assignments
                    </h3>
            `;

            try {
                // Fetch homework assignments - NO ORDER BY TO AVOID INDEX
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
                    const homeworkList = homeworkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const now = new Date();
                    
                    // Sort manually by due date
                    homeworkList.sort((a, b) => {
                        let aDate = a.dueDate;
                        let bDate = b.dueDate;
                        
                        if (a.dueDate?.toDate) {
                            aDate = a.dueDate.toDate();
                        } else if (typeof a.dueDate === 'string') {
                            aDate = new Date(a.dueDate);
                        }
                        
                        if (b.dueDate?.toDate) {
                            bDate = b.dueDate.toDate();
                        } else if (typeof b.dueDate === 'string') {
                            bDate = new Date(b.dueDate);
                        }
                        
                        return (aDate || new Date(0)) - (bDate || new Date(0));
                    });
                    
                    academicsHtml += `<div class="space-y-4">`;
                    
                    homeworkList.forEach(homework => {
                        let dueDate = homework.dueDate;
                        if (dueDate?.toDate) {
                            dueDate = dueDate.toDate();
                        } else if (typeof dueDate === 'string') {
                            dueDate = new Date(dueDate);
                        }
                        
                        const formattedDueDate = dueDate instanceof Date ? dueDate.toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                        }) : 'No due date';
                        
                        const isOverdue = dueDate instanceof Date && dueDate < now;
                        const statusColor = isOverdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
                        const statusText = isOverdue ? 'Overdue' : 'Pending';
                        
                        academicsHtml += `
                            <div class="bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                                <div class="flex justify-between items-start mb-2">
                                    <span class="font-medium text-gray-800">${homework.title || 'Untitled Assignment'}</span>
                                    <span class="text-xs ${statusColor} px-2 py-1 rounded-full">${statusText}</span>
                                </div>
                                <div class="text-gray-700 mb-3">
                                    <p class="whitespace-pre-wrap">${homework.description || 'No description provided.'}</p>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-sm text-gray-500">Due: ${formattedDueDate}</span>
                                    ${homework.fileUrl ? `
                                        <a href="${homework.fileUrl}" target="_blank" class="text-green-600 hover:text-green-800 font-medium flex items-center">
                                            <span class="mr-1">📎</span> Download Attachment
                                        </a>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    });
                    
                    academicsHtml += `</div>`;
                }
            } catch (error) {
                console.error('Error loading homework:', error);
                academicsHtml += `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p class="text-yellow-700">Unable to load homework assignments at this time.</p>
                    </div>
                `;
            }

            academicsHtml += `</div>`;
        }

        academicsContent.innerHTML = academicsHtml;

    } catch (error) {
        console.error('Error loading academics data:', error);
        academicsContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Academic Data</h3>
                <p class="text-gray-500">Unable to load academic data at this time. Please try again later.</p>
                <button onclick="loadAcademicsData()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    Try Again
                </button>
            </div>
        `;
    }
}

function onStudentSelected(studentName) {
    loadAcademicsData(studentName || null);
}

// -------------------------------------------------------------------
// UNIFIED MESSAGING INBOX - FIXED FOR NO INDEXES
// -------------------------------------------------------------------

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
    messagesContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading messages...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to view messages');
        }

        // Get user data
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        // Fetch messages from tutor_messages - NO ORDER BY TO AVOID INDEX
        const tutorMessagesSnapshot = await db.collection('tutor_messages')
            .where('parentUid', '==', user.uid)
            .get();

        // Fetch all feedback and filter client-side
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
                sender: message.parentName || 'Tutor/Admin',
                senderRole: message.type === 'parent_to_staff' ? 'You' : 'Staff',
                subject: message.subject,
                content: message.type === 'parent_to_staff' ? `You wrote: ${message.content}` : message.content,
                studentName: message.studentName,
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
                        sender: response.responderName || 'Admin',
                        senderRole: 'Admin',
                        subject: `Re: ${feedback.category} - ${feedback.studentName}`,
                        content: response.responseText,
                        studentName: feedback.studentName,
                        isUrgent: feedback.priority === 'Urgent' || feedback.priority === 'High',
                        timestamp: response.responseDate || feedback.timestamp,
                        originalMessage: feedback.message
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
                    <button onclick="showComposeMessageModal()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                        Compose Message
                    </button>
                </div>
            `;
            return;
        }

        messagesContent.innerHTML = '';

        allMessages.forEach((message) => {
            const messageDate = message.timestamp?.toDate?.() || new Date();
            const formattedDate = messageDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const urgentBadge = message.isUrgent ? 
                '<span class="inline-block ml-2 px-2 py-1 text-xs font-bold bg-red-100 text-red-800 rounded-full animate-pulse">URGENT</span>' : '';

            const outgoingIndicator = message.isOutgoing ? 
                '<span class="inline-block ml-2 px-2 py-1 text-xs font-bold bg-blue-100 text-blue-800 rounded-full">OUTGOING</span>' : '';

            const studentInfo = message.studentName && message.studentName !== 'General' ? 
                `<span class="text-sm text-gray-600">Regarding: ${message.studentName}</span>` : '';

            const messageTypeIcon = message.type === 'tutor_message' ? '📨' : '💬';

            const messageElement = document.createElement('div');
            messageElement.className = `bg-white border ${message.isUrgent ? 'border-red-300' : 'border-gray-200'} rounded-xl p-6 mb-4 hover:shadow-md transition-shadow duration-200`;
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
                    <span class="text-sm text-gray-500">${formattedDate}</span>
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

// -------------------------------------------------------------------
// NOTIFICATION SYSTEM - FIXED FOR NO INDEXES
// -------------------------------------------------------------------

async function checkForNewMessages() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        let totalUnread = 0;
        
        // Check tutor messages - simple query, no composite index
        const tutorMessagesSnapshot = await db.collection('tutor_messages')
            .where('parentUid', '==', user.uid)
            .get();

        totalUnread += tutorMessagesSnapshot.size;
        
        // Check feedback responses - filter client-side
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
    buttonContainer.insertBefore(viewMessagesBtn, buttonContainer.lastElementChild);
    
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
    }, 1000);
}

// SIMPLIFIED SEARCH SYSTEM - ONLY SEARCHES BY PARENTPHONE IN TUTOR_SUBMISSIONS
async function searchReportsByParentPhone(parentPhone) {
    console.log("🔍 Searching reports for parent phone:", parentPhone);
    
    let assessmentResults = [];
    let monthlyResults = [];
    
    try {
        // Normalize phone
        const normalizedPhone = normalizePhoneNumber(parentPhone);
        if (!normalizedPhone.valid) {
            console.log("Invalid phone number format");
            return { assessmentResults, monthlyResults };
        }

        // --- MONTHLY REPORTS SEARCH (tutor_submissions) ---
        console.log("📈 MONTHLY REPORTS SEARCH - Looking in tutor_submissions");
        
        const monthlySnapshot = await db.collection("tutor_submissions")
            .where("parentPhone", "==", normalizedPhone.normalized)
            .get();
        
        if (!monthlySnapshot.empty) {
            console.log(`✅ Monthly reports FOUND: ${monthlySnapshot.size} results`);
            monthlySnapshot.forEach(doc => {
                const data = doc.data();
                if (!monthlyResults.some(r => r.id === doc.id)) {
                    monthlyResults.push({ 
                        id: doc.id,
                        ...data,
                        timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                        type: 'monthly'
                    });
                }
            });
        }

        // --- ASSESSMENT REPORTS SEARCH (student_results) ---
        console.log("📊 ASSESSMENT SEARCH - Looking in student_results");
        
        const assessmentSnapshot = await db.collection("student_results")
            .where("parentPhone", "==", normalizedPhone.normalized)
            .get();
        
        if (!assessmentSnapshot.empty) {
            console.log(`✅ Assessment reports FOUND: ${assessmentSnapshot.size} results`);
            assessmentSnapshot.forEach(doc => {
                const data = doc.data();
                if (!assessmentResults.some(r => r.id === doc.id)) {
                    assessmentResults.push({ 
                        id: doc.id,
                        ...data,
                        timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                        type: 'assessment'
                    });
                }
            });
        }

        console.log("🎯 SEARCH SUMMARY - Assessments:", assessmentResults.length, "Monthly:", monthlyResults.length);
        
    } catch (error) {
        console.error("❌ Error during search:", error);
    }
    
    return { assessmentResults, monthlyResults };
}

// REAL-TIME MONITORING SYSTEM
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
        });
    realTimeListeners.push(assessmentListener);
    
    // Monitor tutor messages - simple query
    const messagesListener = db.collection("tutor_messages")
        .where("parentUid", "==", userId)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    console.log("🆕 NEW MESSAGE DETECTED!");
                    checkForNewMessages();
                }
            });
        });
    realTimeListeners.push(messagesListener);
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
    indicator.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse';
    indicator.innerHTML = `📄 New ${reportType} Available!`;
    document.body.appendChild(indicator);
    
    // Remove after 5 seconds
    setTimeout(() => {
        indicator.remove();
    }, 5000);
}

// -------------------------------------------------------------------
// ACCORDION SYSTEM FUNCTIONS (RESTORED AND FIXED)
// -------------------------------------------------------------------

function createAccordionReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    
    for (const [studentName, reports] of reportsByStudent) {
        const fullName = capitalize(studentName);
        
        // Create accordion header
        html += `
            <div class="accordion-item mb-4">
                <button onclick="toggleAccordion('student-${studentIndex}')" 
                        class="accordion-header w-full flex justify-between items-center p-4 bg-green-100 border border-green-300 rounded-lg hover:bg-green-200 transition-all duration-200">
                    <div class="flex items-center">
                        <span class="text-xl mr-3">👤</span>
                        <div class="text-left">
                            <h3 class="font-bold text-green-800 text-lg">${fullName}</h3>
                            <p class="text-green-600 text-sm">
                                ${reports.assessments.size} Assessment(s), ${reports.monthly.size} Monthly Report(s)
                            </p>
                        </div>
                    </div>
                    <span id="student-${studentIndex}-arrow" class="accordion-arrow text-green-600 text-xl">▼</span>
                </button>
                <div id="student-${studentIndex}-content" class="accordion-content hidden p-4 bg-white border border-t-0 border-gray-200 rounded-b-lg">
        `;
        
        // Assessment Reports
        if (reports.assessments.size > 0) {
            html += `<h4 class="font-semibold text-gray-700 mb-3 mt-2">📊 Assessment Reports</h4>`;
            
            let assessmentIndex = 0;
            for (const [sessionKey, session] of reports.assessments) {
                html += createAssessmentReportHTML(session, studentIndex, assessmentIndex, fullName);
                assessmentIndex++;
            }
        } else {
            html += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center mb-4">
                <p class="text-gray-500">No assessment reports yet for ${fullName}.</p>
            </div>`;
        }
        
        // Monthly Reports
        if (reports.monthly.size > 0) {
            html += `<h4 class="font-semibold text-gray-700 mb-3 mt-6">📈 Monthly Reports</h4>`;
            
            let monthlyIndex = 0;
            for (const [sessionKey, session] of reports.monthly) {
                html += createMonthlyReportHTML(session, studentIndex, monthlyIndex, fullName);
                monthlyIndex++;
            }
        } else {
            html += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <p class="text-gray-500">No monthly reports yet for ${fullName}.</p>
            </div>`;
        }
        
        html += `
                </div>
            </div>
        `;
        
        studentIndex++;
    }
    
    return html;
}

// FIXED: This function now properly handles the accordion toggle
function toggleAccordion(studentId) {
    const content = document.getElementById(`${studentId}-content`);
    const arrow = document.getElementById(`${studentId}-arrow`);
    
    if (!content || !arrow) {
        console.error(`Could not find accordion elements for ${studentId}`);
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

function createAssessmentReportHTML(session, studentIndex, assessmentIndex, fullName) {
    const tutorEmail = session[0].tutorEmail || 'N/A';
    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short'
    });
    
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
    
    return `
        <div class="border rounded-lg shadow mb-6 p-4 bg-white" id="assessment-block-${studentIndex}-${assessmentIndex}">
            <div class="flex justify-between items-center mb-3 border-b pb-2">
                <h5 class="font-medium text-gray-800">Assessment - ${formattedDate}</h5>
                <button onclick="downloadSessionReport(${studentIndex}, ${assessmentIndex}, '${fullName}', 'assessment')" 
                        class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm">
                    <span class="mr-1">📥</span> Download
                </button>
            </div>
            
            <table class="w-full text-sm mb-3 border border-collapse">
                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>
    `;
}

function createMonthlyReportHTML(session, studentIndex, monthlyIndex, fullName) {
    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
        dateStyle: 'long',
        timeStyle: 'short'
    });
    
    return `
        <div class="border rounded-lg shadow mb-6 p-4 bg-white" id="monthly-block-${studentIndex}-${monthlyIndex}">
            <div class="flex justify-between items-center mb-3 border-b pb-2">
                <h5 class="font-medium text-gray-800">Monthly Report - ${formattedDate}</h5>
                <button onclick="downloadMonthlyReport(${studentIndex}, ${monthlyIndex}, '${fullName}')" 
                        class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm">
                    <span class="mr-1">📥</span> Download
                </button>
            </div>
            
            <div class="text-sm text-gray-700">
                <p class="mb-1"><strong>Tutor:</strong> ${session[0].tutorName || 'N/A'}</p>
                <p class="mb-2"><strong>Topics Covered:</strong> ${session[0].topics ? session[0].topics.substring(0, 100) + '...' : 'N/A'}</p>
            </div>
        </div>
    `;
}

function downloadSessionReport(studentIndex, sessionIndex, studentName, type) {
    const element = document.getElementById(`${type}-block-${studentIndex}-${sessionIndex}`);
    if (!element) {
        showMessage('Report element not found for download', 'error');
        return;
    }
    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().from(element).set(opt).save();
}

function downloadMonthlyReport(studentIndex, monthlyIndex, studentName) {
    downloadSessionReport(studentIndex, monthlyIndex, studentName, 'monthly');
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
    buttonContainer.insertBefore(refreshBtn, buttonContainer.lastElementChild);
}

// MAIN REPORT LOADING FUNCTION WITH ACCORDION SYSTEM
async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
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
        const cacheKey = `reportCache_${parentPhone}`;
        const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
        
        if (!forceRefresh) {
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { timestamp, html, userData } = JSON.parse(cachedItem);
                    if (Date.now() - timestamp < twoWeeksInMillis) {
                        console.log("Loading reports from cache.");
                        if (reportContent) reportContent.innerHTML = html;
                        
                        // Set welcome message from cache
                        if (userData && userData.parentName && welcomeMessage) {
                            welcomeMessage.textContent = `Welcome, ${userData.parentName}!`;
                            currentUserData = userData;
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
                        
                        // Setup real-time monitoring
                        const userDoc = await db.collection('parent_users').doc(userId).get();
                        const userData = userDoc.data();
                        setupRealTimeMonitoring(parentPhone, userId);
                        
                        // Load initial referral data
                        loadReferralRewards(userId);
                        
                        // Load academics data
                        loadAcademicsData();

                        return;
                    }
                }
            } catch (e) {
                console.error("Could not read from cache:", e);
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
            parentName: parentName,
            parentPhone: parentPhone
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

        console.log("🔍 Starting search for reports with parent phone:", parentPhone);

        // --- USE SIMPLIFIED SEARCH SYSTEM ---
        const { assessmentResults, monthlyResults } = await searchReportsByParentPhone(parentPhone);
        
        // --- GET ALL STUDENTS ASSIGNED TO THIS PARENT ---
        const { studentIds, studentNameIdMap, allStudentData } = await findStudentIdsForParent(parentPhone);
        
        // Store student names globally
        userChildren = Array.from(studentNameIdMap.keys());

        // SETUP REAL-TIME MONITORING
        setupRealTimeMonitoring(parentPhone, userId);

        // Group reports by student name
        const reportsByStudent = new Map();

        // Initialize all students in the map (even those without reports)
        for (const studentName of userChildren) {
            reportsByStudent.set(studentName, { assessments: new Map(), monthly: new Map() });
        }

        // Group assessment reports by student
        const assessmentGroups = new Map();
        assessmentResults.forEach(result => {
            const studentName = result.studentName;
            if (!assessmentGroups.has(studentName)) {
                assessmentGroups.set(studentName, []);
            }
            assessmentGroups.get(studentName).push(result);
        });

        // Group assessment reports by session (day)
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
                reportsByStudent.get(studentName).assessments = sessionGroups;
            }
        }

        // Group monthly reports by student
        const monthlyGroups = new Map();
        monthlyResults.forEach(result => {
            const studentName = result.studentName;
            if (!monthlyGroups.has(studentName)) {
                monthlyGroups.set(studentName, []);
            }
            monthlyGroups.get(studentName).push(result);
        });

        // Group monthly reports by session (day)
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
                reportsByStudent.get(studentName).monthly = sessionGroups;
            }
        }

        // Create accordion view
        if (reportContent) reportContent.innerHTML = createAccordionReportView(reportsByStudent);
        
        // --- CACHE SAVING LOGIC ---
        try {
            const dataToCache = {
                timestamp: Date.now(),
                html: reportContent ? reportContent.innerHTML : '',
                userData: currentUserData
            };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
            console.log("Report data cached successfully.");
        } catch (e) {
            console.error("Could not write to cache:", e);
        }
        // --- END CACHE SAVING ---

        if (authArea && reportArea) {
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
        }

        // Add buttons to welcome section
        addMessagesButton();
        addManualRefreshButton();
        
        // Load initial referral data for the rewards dashboard tab
        loadReferralRewards(userId);
        
        // Load academics data
        loadAcademicsData();

    } catch (error) {
        console.error("Error loading reports:", error);
        if (reportContent) {
            reportContent.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-6xl mb-6">❌</div>
                    <h2 class="text-2xl font-bold text-red-800 mb-4">Error Loading Reports</h2>
                    <p class="text-gray-600 max-w-2xl mx-auto mb-6">
                        Sorry, there was an error loading your reports. Please try again.
                    </p>
                    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button onclick="window.location.reload()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center">
                            <span class="mr-2">🔄</span> Reload Page
                        </button>
                        <button onclick="showComposeMessageModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center">
                            <span class="mr-2">💬</span> Contact Support
                        </button>
                    </div>
                </div>
            `;
        }
    } finally {
        if (authLoader) authLoader.classList.add("hidden");
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
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
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

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Setup Remember Me
    setupRememberMe();
    
    // Create country code dropdown when page loads
    createCountryCodeDropdown();
    
    // Check if user was previously authenticated (persists across page refreshes)
    const wasAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    
    // CRITICAL SESSION PERSISTENCE FIX
    // Check authentication state IMMEDIATELY on page load
    auth.onAuthStateChanged((user) => {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        const authLoader = document.getElementById("authLoader");
        
        if (user) {
            // User is signed in - IMMEDIATELY switch to dashboard
            console.log("User authenticated, showing dashboard immediately");
            
            if (authArea && reportArea) {
                authArea.classList.add("hidden");
                reportArea.classList.remove("hidden");
            }
            
            if (authLoader) {
                authLoader.classList.add("hidden");
            }
            
            // Store auth state
            localStorage.setItem('isAuthenticated', 'true');
            
            // Get phone from Firestore user document and load reports
            db.collection('parent_users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userPhone = doc.data().phone;
                        const normalizedPhone = doc.data().normalizedPhone;
                        loadAllReportsForParent(normalizedPhone || userPhone, user.uid);
                        
                        // Add navigation buttons
                        setTimeout(() => {
                            addMessagesButton();
                            addManualRefreshButton();
                        }, 500);
                    }
                })
                .catch((error) => {
                    console.error('Error getting user data:', error);
                });
        } else {
            // User signed out - clean up listeners and show auth
            console.log("User not authenticated, showing auth form");
            cleanupRealTimeListeners();
            localStorage.removeItem('isAuthenticated');
            
            if (authArea && reportArea) {
                authArea.classList.remove("hidden");
                reportArea.classList.add("hidden");
            }
            
            // Only show loader briefly then hide
            if (authLoader) {
                setTimeout(() => {
                    authLoader.classList.add("hidden");
                }, 500);
            }
        }
    });

    // Set up event listeners
    const signInBtn = document.getElementById("signInBtn");
    const signUpBtn = document.getElementById("signUpBtn");
    const sendResetBtn = document.getElementById("sendResetBtn");
    const submitMessageBtn = document.getElementById("submitMessageBtn");
    
    if (signInBtn) signInBtn.addEventListener("click", handleSignIn);
    if (signUpBtn) signUpBtn.addEventListener("click", handleSignUp);
    if (sendResetBtn) sendResetBtn.addEventListener("click", handlePasswordReset);
    if (submitMessageBtn) submitMessageBtn.addEventListener("click", submitMessage);
    
    const signInTab = document.getElementById("signInTab");
    const signUpTab = document.getElementById("signUpTab");
    
    if (signInTab) signInTab.addEventListener("click", () => switchTab('signin'));
    if (signUpTab) signUpTab.addEventListener("click", () => switchTab('signup'));
    
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener("click", () => {
            document.getElementById("passwordResetModal").classList.remove("hidden");
        });
    }
    
    const cancelResetBtn = document.getElementById("cancelResetBtn");
    if (cancelResetBtn) {
        cancelResetBtn.addEventListener("click", () => {
            document.getElementById("passwordResetModal").classList.add("hidden");
        });
    }
    
    // FIXED: Added event listener for cancel message button
    const cancelMessageBtn = document.getElementById("cancelMessageBtn");
    if (cancelMessageBtn) {
        cancelMessageBtn.addEventListener("click", hideComposeMessageModal);
    }
    
    const cancelMessagesModalBtn = document.getElementById("cancelMessagesModalBtn");
    if (cancelMessagesModalBtn) {
        cancelMessagesModalBtn.addEventListener("click", hideMessagesModal);
    }

    const rememberMeCheckbox = document.getElementById("rememberMe");
    if (rememberMeCheckbox) {
        rememberMeCheckbox.addEventListener("change", handleRememberMe);
    }

    // Allow Enter key to submit forms
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSignIn();
        });
    }
    
    const signupConfirmPassword = document.getElementById('signupConfirmPassword');
    if (signupConfirmPassword) {
        signupConfirmPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSignUp();
        });
    }
    
    const resetEmail = document.getElementById('resetEmail');
    if (resetEmail) {
        resetEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handlePasswordReset();
        });
    }
    
    // Main tab switching listeners
    const reportTab = document.getElementById("reportTab");
    const academicsTab = document.getElementById("academicsTab");
    const rewardsTab = document.getElementById("rewardsTab");
    
    if (reportTab) reportTab.addEventListener("click", () => switchMainTab('reports'));
    if (academicsTab) academicsTab.addEventListener("click", () => switchMainTab('academics'));
    if (rewardsTab) rewardsTab.addEventListener("click", () => switchMainTab('rewards'));
});