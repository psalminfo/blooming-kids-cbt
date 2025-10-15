

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

        // Store user data in Firestore for easy retrieval
        await db.collection('parent_users').doc(user.uid).set({
            phone: cleanedPhone,
            email: email,
            parentName: parentName || 'Parent', // Use found name or default
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

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

// MAIN REPORT LOADING FUNCTION - COMPLETE AND INTACT
async function loadAllReportsForParent(parentPhone, userId) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    authLoader.classList.remove("hidden");

    try {
        // --- CACHE IMPLEMENTATION ---
        const cacheKey = `reportCache_${parentPhone}`;
        const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
        
        try {
            const cachedItem = localStorage.getItem(cacheKey);
            if (cachedItem) {
                const { timestamp, html, chartConfigs, userData } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < twoWeeksInMillis) {
                    console.log("Loading reports from cache.");
                    reportContent.innerHTML = html;
                    
                    // Set welcome message from cache - THIS IS WHERE PARENT NAME IS SET FROM CACHE
                    if (userData && userData.parentName) {
                        welcomeMessage.textContent = `Welcome, ${userData.parentName}!`;
                        currentUserData = userData;
                    } else {
                        // Fallback if no parent name in cache
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
                    
                    // Add View Responses button to welcome section
                    addViewResponsesButton();
                    return;
                }
            }
        } catch (e) {
            console.error("Could not read from cache:", e);
            localStorage.removeItem(cacheKey);
        }
        // --- END CACHE IMPLEMENTATION ---

        // FIND PARENT NAME FROM SAME SOURCES AS TUTOR.JS
        let parentName = await findParentNameFromStudents(parentPhone);
        
        // If not found in students collections, try user document
        if (!parentName && userId) {
            const userDoc = await db.collection('parent_users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                parentName = userData.parentName;
            }
        }

        // Final fallback
        if (!parentName) {
            parentName = 'Parent';
        }

        // Store user data globally - THIS IS CRITICAL FOR PARENT NAME DISPLAY
        currentUserData = {
            parentName: parentName,
            parentPhone: parentPhone
        };

        // UPDATE WELCOME MESSAGE WITH PARENT NAME - THIS IS WHAT SHOWS IT!
        welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;

        // Update parent name in user document if we found a better one
        if (userId && parentName && parentName !== 'Parent') {
            try {
                await db.collection('parent_users').doc(userId).update({
                    parentName: parentName
                });
            } catch (error) {
                console.error('Error updating parent name:', error);
            }
        }

        // Add CSS for preserving whitespace dynamically
        if (!document.querySelector('#whitespace-style')) {
            const style = document.createElement('style');
            style.id = 'whitespace-style';
            style.textContent = `
                .preserve-whitespace {
                    white-space: pre-line !important;
                    line-height: 1.6 !important;
                }
                .response-bubble {
                    background-color: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 12px;
                    padding: 12px;
                    margin-top: 8px;
                }
                .response-header {
                    font-weight: 600;
                    color: #065f46;
                    margin-bottom: 4px;
                }
                .loading-spinner {
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #10b981;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    animation: spin 1s linear infinite;
                    display: inline-block;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        // --- HIGHLY OPTIMIZED READS ---
        // Query collections using the exact parent phone number (as stored in existing reports)
        const assessmentQuery = db.collection("student_results").where("parentPhone", "==", parentPhone).get();
        const monthlyQuery = db.collection("tutor_submissions").where("parentPhone", "==", parentPhone).get();
        
        const [assessmentSnapshot, monthlySnapshot] = await Promise.all([assessmentQuery, monthlyQuery]);

        const studentResults = [];
        assessmentSnapshot.forEach(doc => {
            const data = doc.data();
            studentResults.push({ 
                id: doc.id,
                ...data,
                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                type: 'assessment'
            });
        });

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

        if (studentResults.length === 0 && monthlyReports.length === 0) {
            showMessage(`No reports found for your account. Please contact Blooming Kids House if you believe this is an error.`, 'info');
            authLoader.classList.add("hidden");
            return;
        }
        
        reportContent.innerHTML = "";
        const chartConfigsToCache = [];

        // Group reports by student name and extract parent name
        const studentsMap = new Map();

        // Process assessment reports
        studentResults.forEach(result => {
            const studentName = result.studentName;
            if (!studentsMap.has(studentName)) {
                studentsMap.set(studentName, { assessments: [], monthly: [] });
            }
            studentsMap.get(studentName).assessments.push(result);
        });

        // Process monthly reports
        monthlyReports.forEach(report => {
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

            // Display Assessment Reports for this student
            if (reports.assessments.length > 0) {
                const groupedAssessments = {};
                reports.assessments.forEach((result) => {
                    const sessionKey = Math.floor(result.timestamp / 86400); 
                    if (!groupedAssessments[sessionKey]) groupedAssessments[sessionKey] = [];
                    groupedAssessments[sessionKey].push(result);
                });

                let assessmentIndex = 0;
                for (const key in groupedAssessments) {
                    const session = groupedAssessments[key];
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

        // Add View Responses button to welcome section
        addViewResponsesButton();

    } catch (error) {
        console.error("Error loading reports:", error);
        showMessage("Sorry, there was an error loading the reports. Please try again.", "error");
    } finally {
        authLoader.classList.add("hidden");
    }
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
    // Clear remember me on logout
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    
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

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Setup Remember Me
    setupRememberMe();
    
    // Check authentication state
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in, load their reports
            // Get phone from Firestore user document
            db.collection('parent_users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userPhone = doc.data().phone;
                        loadAllReportsForParent(userPhone, user.uid);
                    }
                })
                .catch((error) => {
                    console.error('Error getting user data:', error);
                });
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
});
