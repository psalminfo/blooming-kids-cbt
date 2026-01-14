// ============================================
// FIREBASE INITIALIZATION (DIRECT CONFIG)
// ============================================

// Direct Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

// Initialize Firebase
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
}

const db = firebase.firestore();
const auth = firebase.auth();

// ============================================
// GLOBAL VARIABLES
// ============================================

let currentUserData = null;
let userChildren = [];
let unreadResponsesCount = 0;
let realTimeListeners = [];
let currentStudentTab = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

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
    
    countryCodeSelect.value = '+1';
    
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

    console.log("🔧 Starting multi-normalization for:", phone);
    
    const normalizationAttempts = [];
    
    try {
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // For now, return simple normalization until libphonenumber loads
        if (cleaned.startsWith('+')) {
            normalizationAttempts.push({
                normalized: cleaned,
                country: null,
                valid: true,
                attempt: 'simple'
            });
        } else if (cleaned.length >= 10) {
            normalizationAttempts.push({
                normalized: '+' + cleaned,
                country: null,
                valid: true,
                attempt: 'simple'
            });
        }
        
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

function cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.trim();
}

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

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

async function findParentNameFromStudents(parentPhone) {
    try {
        console.log("Searching for parent name with phone:", parentPhone);
        
        const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
        const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
        
        for (const version of validVersions) {
            console.log(`🔍 Searching parent name with: ${version.normalized}`);
            
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
        showMessage('Invalid phone number format. Please check your phone number.', 'error');
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
        
        if (identifier.includes('@')) {
            userCredential = await auth.signInWithEmailAndPassword(identifier, password);
            userId = userCredential.user.uid;
            const userDoc = await db.collection('parent_users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userPhone = userData.phone;
                normalizedPhone = userData.normalizedPhone;
            }
        } else {
            const phoneValidations = multiNormalizePhoneNumber(identifier);
            const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
            
            if (validVersions.length === 0) {
                throw new Error(`Invalid phone number format. Please try with country code (like +1234567890) or local format`);
            }
            
            normalizedPhone = validVersions[0].normalized;
            
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
            const phoneValidations = multiNormalizePhoneNumber(userPhone);
            const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
            if (validVersions.length > 0) {
                normalizedPhone = validVersions[0].normalized;
            }
        }

        if (!normalizedPhone) {
            throw new Error('Could not retrieve valid phone number for user');
        }
        
        handleRememberMe();
        
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
// NEW FEATURES: HELPER FUNCTIONS (FIXED)
// ============================================

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
// TODAY'S TOPICS MANAGEMENT (FIXED - NO INDEX REQUIRED)
// ============================================

async function loadTodaysTopics(studentId, studentName) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
        // Get all topics for student (simple query - no index needed)
        const topicsSnapshot = await db.collection('daily_topics')
            .where('studentId', '==', studentId)
            .get();
        
        let todaysTopics = [];
        let historicalTopics = [];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        // Filter in JavaScript instead of Firestore query
        topicsSnapshot.forEach(doc => {
            const topic = doc.data();
            const topicDate = topic.date?.toDate();
            
            if (topicDate) {
                const isToday = topicDate.getDate() === today.getDate() &&
                               topicDate.getMonth() === today.getMonth() &&
                               topicDate.getFullYear() === today.getFullYear();
                
                if (isToday) {
                    todaysTopics.push({ ...topic, id: doc.id });
                } else if (topicDate >= weekAgo) {
                    historicalTopics.push({ ...topic, id: doc.id });
                }
            }
        });
        
        // Sort by date
        todaysTopics.sort((a, b) => (b.date?.toDate() || 0) - (a.date?.toDate() || 0));
        historicalTopics.sort((a, b) => (b.date?.toDate() || 0) - (a.date?.toDate() || 0));
        
        let topicsContent = '';
        
        // Today's topics
        if (todaysTopics.length > 0) {
            todaysTopics.forEach(topic => {
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
        if (historicalTopics.length > 0) {
            historicalTopics.forEach(topic => {
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
        
        // Update topic count
        updateTopicCount(studentId, todaysTopics.length);
        
        // Create topics section
        return `
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
    
    loadTopicsHistory(studentId);
}

async function loadTopicsHistory(studentId) {
    const content = document.getElementById('topicsHistoryContent');
    
    try {
        // Simple query - get all topics and filter in JavaScript
        const snapshot = await db.collection('daily_topics')
            .where('studentId', '==', studentId)
            .get();
        
        if (snapshot.empty) {
            content.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-4xl mb-4">📚</div>
                    <h4 class="text-lg font-semibold text-gray-700 mb-2">No Topic History</h4>
                    <p class="text-gray-500">No topics have been recorded.</p>
                </div>
            `;
            return;
        }
        
        let topics = [];
        snapshot.forEach(doc => {
            topics.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by date descending
        topics.sort((a, b) => (b.date?.toDate() || 0) - (a.date?.toDate() || 0));
        
        // Take only last 30 days worth
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        topics = topics.filter(topic => {
            const topicDate = topic.date?.toDate();
            return topicDate && topicDate >= monthAgo;
        });
        
        if (topics.length === 0) {
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
        
        topics.forEach(topic => {
            const topicDate = topic.date?.toDate();
            if (!topicDate) return;
            
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
        // Get all assignments for student
        const snapshot = await db.collection('homework_assignments')
            .where('studentId', '==', studentId)
            .get();
        
        if (snapshot.empty) {
            updateHomeworkCount(studentId, 0);
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
        
        let assignments = [];
        let pendingCount = 0;
        let overdueCount = 0;
        const today = new Date();
        
        snapshot.forEach(doc => {
            const assignment = { id: doc.id, ...doc.data() };
            assignments.push(assignment);
            
            const dueDate = assignment.dueDate?.toDate();
            let status = assignment.status || 'assigned';
            
            if (dueDate && dueDate < today && status === 'assigned') {
                status = 'overdue';
                overdueCount++;
            }
            
            if (status === 'assigned') pendingCount++;
        });
        
        // Sort by due date
        assignments.sort((a, b) => {
            const dateA = a.dueDate?.toDate() || new Date(0);
            const dateB = b.dueDate?.toDate() || new Date(0);
            return dateA - dateB;
        });
        
        let assignmentsHTML = '';
        
        assignments.forEach(assignment => {
            const dueDate = assignment.dueDate?.toDate();
            const daysRemaining = getDaysRemaining(assignment.dueDate);
            let status = assignment.status || 'assigned';
            
            if (dueDate && dueDate < today && status === 'assigned') {
                status = 'overdue';
            }
            
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
                            <button onclick="viewHomeworkDetails('${studentId}', '${studentName}', '${assignment.id}')" 
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

function updateHomeworkCount(studentId, count) {
    const countElement = document.getElementById(`hwCount-${studentId}`);
    if (countElement) {
        countElement.textContent = `${count} assignment${count !== 1 ? 's' : ''}`;
    }
}

function toggleEmailReminders(studentId) {
    const button = document.getElementById(`emailToggle-${studentId}`);
    const status = document.getElementById(`emailStatus-${studentId}`);
    
    if (!button || !status) return;
    
    const currentStatus = status.textContent.toLowerCase();
    const newStatus = currentStatus === 'enabled' ? 'Disabled' : 'Enabled';
    const newColor = currentStatus === 'enabled' ? 'text-red-600' : 'text-green-600';
    
    status.textContent = newStatus;
    status.className = newColor;
    
    localStorage.setItem(`emailReminders-${studentId}`, newStatus.toLowerCase());
    
    showNotification(`Email reminders ${newStatus.toLowerCase()} for this student`, 'info');
}

// ============================================
// WEEKLY SCHEDULE CALENDAR
// ============================================

async function loadWeeklySchedule(studentId, studentName) {
    try {
        const snapshot = await db.collection('schedules')
            .where('studentId', '==', studentId)
            .limit(1)
            .get();
        
        let scheduleHTML = '';
        
        if (!snapshot.empty) {
            const scheduleData = snapshot.docs[0].data();
            const schedule = scheduleData.schedule || [];
            
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
            
            scheduleHTML = createWeeklyScheduleView(schedule, tutorInfo);
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
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    const scheduleByDay = {};
    daysOfWeek.forEach(day => scheduleByDay[day] = []);
    
    scheduleArray.forEach(session => {
        const day = session.day || 'Monday';
        if (scheduleByDay[day]) {
            scheduleByDay[day].push(session);
        }
    });
    
    Object.keys(scheduleByDay).forEach(day => {
        scheduleByDay[day].sort((a, b) => {
            const timeA = a.startTime || '00:00';
            const timeB = b.startTime || '00:00';
            return timeA.localeCompare(timeB);
        });
    });
    
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
        
        sessionsHTML += `
            <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg ${index > 0 ? 'mt-2' : ''}">
                <div class="font-medium text-blue-800 mb-1">${subject}</div>
                <div class="text-sm text-gray-600 mb-1">
                    ${formatTimeFromString(startTime)} - ${formatTimeFromString(endTime)}
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

// ============================================
// MAIN PARENT DASHBOARD WITH STUDENT TABS
// ============================================

async function loadParentDashboard(parentUid) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    authLoader.classList.remove("hidden");

    try {
        const parentDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!parentDoc.exists) {
            showMessage('Parent data not found. Please sign in again.', 'error');
            return;
        }
        
        const parentData = parentDoc.data();
        const parentPhone = parentData.normalizedPhone || parentData.phone;
        const parentName = parentData.parentName || 'Parent';
        
        welcomeMessage.textContent = `Welcome, ${parentName}!`;
        currentUserData = parentData;
        
        // Find parent's children
        const studentsSnapshot = await db.collection('students')
            .where('normalizedParentPhone', '==', parentPhone)
            .get();
        
        const pendingSnapshot = await db.collection('pending_students')
            .where('normalizedParentPhone', '==', parentPhone)
            .get();
        
        if (studentsSnapshot.empty && pendingSnapshot.empty) {
            showNoChildrenView();
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
            return;
        }
        
        // Clear existing content
        reportContent.innerHTML = '';
        
        // Add CSS for new features
        addDashboardCSS();
        
        // Combine all children
        const allChildren = [];
        
        studentsSnapshot.forEach((doc, index) => {
            const child = doc.data();
            const childId = doc.id;
            const childName = child.fullName || child.name || `Child ${index + 1}`;
            allChildren.push({ id: childId, name: childName, data: child, type: 'active' });
        });
        
        pendingSnapshot.forEach((doc, index) => {
            const child = doc.data();
            const childId = doc.id;
            const childName = child.fullName || child.name || `Pending Child ${index + 1}`;
            allChildren.push({ id: childId, name: childName, data: child, type: 'pending' });
        });
        
        // Store children globally
        userChildren = allChildren;
        
        // Create tabs for each student
        let tabsHTML = `
            <div class="mb-6">
                <div class="flex flex-wrap gap-2 border-b">
        `;
        
        // Add "All Children" tab first
        tabsHTML += `
            <button onclick="switchStudentTab('all')" 
                    id="studentTab-all"
                    class="px-4 py-2 font-medium rounded-t-lg student-tab active-student-tab">
                👨‍👩‍👧‍👦 All Children
            </button>
        `;
        
        // Add tab for each child
        allChildren.forEach((child, index) => {
            const childId = child.id;
            const childName = child.name;
            const childType = child.type;
            const tabClass = childType === 'active' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700';
            
            tabsHTML += `
                <button onclick="switchStudentTab('${childId}')" 
                        id="studentTab-${childId}"
                        class="px-4 py-2 font-medium rounded-t-lg student-tab ${tabClass}">
                    ${childName} ${childType === 'pending' ? '(Pending)' : ''}
                </button>
            `;
        });
        
        tabsHTML += `
                </div>
            </div>
            
            <div id="studentContentArea">
                <div id="studentContent-all" class="student-content active-student-content">
                    <!-- All children view will be loaded here -->
                </div>
        `;
        
        // Add content area for each child
        allChildren.forEach(child => {
            const childId = child.id;
            tabsHTML += `
                <div id="studentContent-${childId}" class="student-content hidden">
                    <!-- Individual child content will be loaded here -->
                </div>
            `;
        });
        
        tabsHTML += `</div>`;
        
        reportContent.innerHTML = tabsHTML;
        
        // Load content for "All Children" tab
        await loadAllChildrenView(allChildren);
        
        // Load content for each child tab
        allChildren.forEach(async (child) => {
            await loadStudentContent(child.id, child.name, child.type);
        });
        
        // Show dashboard
        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        
        // Add navigation buttons
        addViewResponsesButton();
        addManualRefreshButton();
        
        // Load referral data
        loadReferralRewards(parentUid);
        
    } catch (error) {
        console.error('Error loading parent dashboard:', error);
        showMessage('Error loading dashboard. Please try again.', 'error');
    } finally {
        authLoader.classList.add("hidden");
    }
}

async function loadAllChildrenView(children) {
    const contentArea = document.getElementById('studentContent-all');
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="text-center py-8">
            <div class="loading-spinner mx-auto"></div>
            <p class="text-green-600 font-semibold mt-4">Loading children overview...</p>
        </div>
    `;
    
    try {
        let childrenHTML = `
            <div class="mb-8">
                <h2 class="text-2xl font-bold text-green-800 mb-6">All Your Children</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        `;
        
        for (const child of children) {
            const childId = child.id;
            const childName = child.name;
            const childType = child.type;
            const childData = child.data;
            
            // Get counts for this child
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Get topic count
            const topicsSnapshot = await db.collection('daily_topics')
                .where('studentId', '==', childId)
                .get();
            
            let todaysTopicCount = 0;
            topicsSnapshot.forEach(doc => {
                const topic = doc.data();
                const topicDate = topic.date?.toDate();
                if (topicDate) {
                    const isToday = topicDate.getDate() === today.getDate() &&
                                   topicDate.getMonth() === today.getMonth() &&
                                   topicDate.getFullYear() === today.getFullYear();
                    if (isToday) todaysTopicCount++;
                }
            });
            
            // Get homework count
            const homeworkSnapshot = await db.collection('homework_assignments')
                .where('studentId', '==', childId)
                .where('status', 'in', ['assigned', 'submitted'])
                .get();
            
            const hwCount = homeworkSnapshot.size;
            
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
                            <span>Today's Topics: <span class="font-semibold">${todaysTopicCount} topic${todaysTopicCount !== 1 ? 's' : ''}</span></span>
                        </div>
                        <div class="flex items-center text-sm">
                            <span class="mr-2">📝</span>
                            <span>Homework: <span class="font-semibold">${hwCount} assignment${hwCount !== 1 ? 's' : ''}</span></span>
                        </div>
                        <div class="flex items-center text-sm">
                            <span class="mr-2">📅</span>
                            <span>Status: <span class="font-semibold">${childType === 'active' ? 'Active' : 'Pending Registration'}</span></span>
                        </div>
                    </div>
                    
                    <button onclick="switchStudentTab('${childId}')" 
                            class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                        View ${childName}'s Details
                    </button>
                </div>
            `;
        }
        
        childrenHTML += `
                </div>
            </div>
            
            <div class="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-lg">
                <h3 class="text-xl font-bold text-blue-800 mb-3">Quick Actions</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button onclick="showFeedbackModal()" class="bg-white border border-blue-200 rounded-lg p-4 hover:bg-blue-50 transition-colors">
                        <div class="text-2xl mb-2">💬</div>
                        <h4 class="font-semibold text-blue-700">Send Feedback</h4>
                        <p class="text-sm text-gray-600 mt-1">Contact tutors or admins</p>
                    </button>
                    <button onclick="showResponsesModal()" class="bg-white border border-green-200 rounded-lg p-4 hover:bg-green-50 transition-colors">
                        <div class="text-2xl mb-2">📨</div>
                        <h4 class="font-semibold text-green-700">View Responses</h4>
                        <p class="text-sm text-gray-600 mt-1">Check admin replies</p>
                    </button>
                    <button onclick="switchMainTab('rewards')" class="bg-white border border-yellow-200 rounded-lg p-4 hover:bg-yellow-50 transition-colors">
                        <div class="text-2xl mb-2">💰</div>
                        <h4 class="font-semibold text-yellow-700">Referral Rewards</h4>
                        <p class="text-sm text-gray-600 mt-1">Earn ₦5,000 per referral</p>
                    </button>
                </div>
            </div>
        `;
        
        contentArea.innerHTML = childrenHTML;
        
    } catch (error) {
        console.error('Error loading all children view:', error);
        contentArea.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-600">Error loading children overview. Please try again.</p>
            </div>
        `;
    }
}

async function loadStudentContent(studentId, studentName, studentType) {
    const contentArea = document.getElementById(`studentContent-${studentId}`);
    if (!contentArea) return;
    
    contentArea.innerHTML = `
        <div class="text-center py-8">
            <div class="loading-spinner mx-auto"></div>
            <p class="text-green-600 font-semibold mt-4">Loading ${studentName}'s details...</p>
        </div>
    `;
    
    try {
        // Load all sections for this student
        const topicsHTML = await loadTodaysTopics(studentId, studentName);
        const homeworkHTML = await loadHomeworkAssignments(studentId, studentName);
        const scheduleHTML = await loadWeeklySchedule(studentId, studentName);
        
        const studentInfo = userChildren.find(c => c.id === studentId);
        const studentData = studentInfo?.data || {};
        
        contentArea.innerHTML = `
            <div class="mb-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div class="flex flex-wrap justify-between items-start">
                    <div>
                        <h2 class="text-2xl font-bold text-green-800 mb-2">${studentName}</h2>
                        <div class="flex flex-wrap gap-4">
                            <div class="text-sm">
                                <span class="text-gray-600">Grade:</span>
                                <span class="font-semibold ml-1">${studentData.grade || 'N/A'}</span>
                            </div>
                            <div class="text-sm">
                                <span class="text-gray-600">Status:</span>
                                <span class="font-semibold ml-1 ${studentType === 'active' ? 'text-green-600' : 'text-yellow-600'}">
                                    ${studentType === 'active' ? 'Active' : 'Pending Registration'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onclick="switchStudentTab('all')" 
                            class="text-green-600 hover:text-green-800 font-medium">
                        ← Back to All Children
                    </button>
                </div>
            </div>
            
            <div class="space-y-8">
                ${topicsHTML}
                ${homeworkHTML}
                ${scheduleHTML}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading student content:', error);
        contentArea.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-600">Error loading ${studentName}'s details. Please try again.</p>
            </div>
        `;
    }
}

function switchStudentTab(studentId) {
    // Update current tab
    currentStudentTab = studentId;
    
    // Hide all content areas
    document.querySelectorAll('.student-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('active-student-content');
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.student-tab').forEach(tab => {
        tab.classList.remove('active-student-tab', 'bg-green-100', 'text-green-800');
        tab.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    // Activate selected tab
    const selectedTab = document.getElementById(`studentTab-${studentId}`);
    if (selectedTab) {
        selectedTab.classList.remove('bg-gray-100', 'text-gray-700');
        selectedTab.classList.add('active-student-tab', 'bg-green-100', 'text-green-800');
    }
    
    // Show selected content
    const selectedContent = document.getElementById(`studentContent-${studentId}`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
        selectedContent.classList.add('active-student-content');
    }
}

function addDashboardCSS() {
    if (document.getElementById('parentDashboardCSS')) return;
    
    const style = document.createElement('style');
    style.id = 'parentDashboardCSS';
    style.textContent = `
        .student-tab {
            transition: all 0.2s ease;
            border: 1px solid transparent;
            margin-bottom: -1px;
        }
        .active-student-tab {
            background-color: #10b981 !important;
            color: white !important;
            border-color: #059669;
            border-bottom-color: white;
        }
        .student-content {
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .line-clamp-2 { 
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
        }
        .loading-spinner { 
            border: 3px solid #f3f3f3;
            border-top: 3px solid #10b981;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin { 
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .child-card { 
            transition: all 0.3s ease;
        }
        .child-card:hover { 
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// REFERRAL SYSTEM FUNCTIONS
// ============================================

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
    if (!rewardsContent) return;
    
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

// ============================================
// OTHER FUNCTIONS (FEEDBACK, RESPONSES, ETC.)
// ============================================

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
    messageDiv.textContent = `BKH says: ${message}`;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
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

function logout() {
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
    });
    realTimeListeners = [];
    
    auth.signOut().then(() => {
        window.location.reload();
    });
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

// ============================================
// PAGE INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    setupRememberMe();
    createCountryCodeDropdown();
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            loadParentDashboard(user.uid);
        } else {
            realTimeListeners.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') unsubscribe();
            });
            realTimeListeners = [];
        }
    });

    // Event listeners
    document.getElementById("signInBtn").addEventListener("click", handleSignIn);
    document.getElementById("signUpBtn").addEventListener("click", handleSignUp);
    document.getElementById("sendResetBtn").addEventListener("click", handlePasswordReset);
    document.getElementById("submitFeedbackBtn")?.addEventListener("click", submitFeedback);
    
    document.getElementById("signInTab").addEventListener("click", () => switchTab('signin'));
    document.getElementById("signUpTab").addEventListener("click", () => switchTab('signup'));
    
    document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => {
        document.getElementById("passwordResetModal").classList.remove("hidden");
    });
    
    document.getElementById("cancelResetBtn")?.addEventListener("click", () => {
        document.getElementById("passwordResetModal").classList.add("hidden");
    });

    document.getElementById("rememberMe")?.addEventListener("change", handleRememberMe);

    // Enter key support
    document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignIn();
    });
    
    document.getElementById('signupConfirmPassword')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignUp();
    });
    
    document.getElementById('resetEmail')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePasswordReset();
    });
    
    // Main tab switching
    document.getElementById("reportTab")?.addEventListener("click", () => switchMainTab('reports'));
    document.getElementById("rewardsTab")?.addEventListener("click", () => switchMainTab('rewards'));
});
