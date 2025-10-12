// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDqLVTd6Lk7SM6Y2sBkK3Fm8q9V6Q8Z6T8",
    authDomain: "blooming-kids-house.firebaseapp.com",
    projectId: "blooming-kids-house",
    storageBucket: "blooming-kids-house.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const authArea = document.getElementById('authArea');
const reportArea = document.getElementById('reportArea');
const signInTab = document.getElementById('signInTab');
const signUpTab = document.getElementById('signUpTab');
const signInForm = document.getElementById('signInForm');
const signUpForm = document.getElementById('signUpForm');
const welcomeMessage = document.getElementById('welcomeMessage');
const reportContent = document.getElementById('reportContent');
const reportsLoading = document.getElementById('reportsLoading');
const reportsEmpty = document.getElementById('reportsEmpty');

// Current user data
let currentUser = null;
let parentData = null;

// Tab switching
signInTab.addEventListener('click', () => switchTab('signin'));
signUpTab.addEventListener('click', () => switchTab('signup'));

function switchTab(tab) {
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

// Authentication functions
document.getElementById('signInBtn').addEventListener('click', signIn);
document.getElementById('signUpBtn').addEventListener('click', signUp);
document.getElementById('forgotPasswordBtn').addEventListener('click', showPasswordResetModal);
document.getElementById('sendResetBtn').addEventListener('click', sendPasswordReset);
document.getElementById('cancelResetBtn').addEventListener('click', hidePasswordResetModal);

// Feedback functions
document.getElementById('submitFeedbackBtn').addEventListener('click', submitFeedback);

// Enter key support
document.getElementById('loginPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') signIn();
});
document.getElementById('signupConfirmPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') signUp();
});

async function signIn() {
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    const signInBtn = document.getElementById('signInBtn');
    const signInText = document.getElementById('signInText');
    const signInSpinner = document.getElementById('signInSpinner');

    if (!identifier || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    // Show loading state
    signInText.textContent = 'Signing In...';
    signInSpinner.classList.remove('hidden');
    signInBtn.disabled = true;

    try {
        let userCredential;
        
        // Check if identifier is email or phone number
        if (identifier.includes('@')) {
            // Email login
            userCredential = await auth.signInWithEmailAndPassword(identifier, password);
        } else {
            // Phone number login - we need to find the user by phone number first
            const usersSnapshot = await db.collection('parents')
                .where('phoneNumber', '==', identifier)
                .get();
            
            if (usersSnapshot.empty) {
                throw new Error('No account found with this phone number');
            }
            
            const userDoc = usersSnapshot.docs[0];
            const userData = userDoc.data();
            const email = userData.email;
            
            userCredential = await auth.signInWithEmailAndPassword(email, password);
        }

        currentUser = userCredential.user;
        await loadParentData();
        showReportsArea();
        showToast('Successfully signed in!', 'success');

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
                errorMessage += error.message;
        }
        
        showToast(errorMessage, 'error');
    } finally {
        // Reset loading state
        signInText.textContent = 'Sign In';
        signInSpinner.classList.add('hidden');
        signInBtn.disabled = false;
    }
}

async function signUp() {
    const phone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;
    const signUpBtn = document.getElementById('signUpBtn');
    const signUpText = document.getElementById('signUpText');
    const signUpSpinner = document.getElementById('signUpSpinner');

    if (!phone || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    // Show loading state
    signUpText.textContent = 'Creating Account...';
    signUpSpinner.classList.remove('hidden');
    signUpBtn.disabled = true;

    try {
        // Check if phone number already exists
        const phoneSnapshot = await db.collection('parents')
            .where('phoneNumber', '==', phone)
            .get();
        
        if (!phoneSnapshot.empty) {
            throw new Error('Phone number already registered');
        }

        // Check if email already exists
        const emailSnapshot = await db.collection('parents')
            .where('email', '==', email)
            .get();
        
        if (!emailSnapshot.empty) {
            throw new Error('Email already registered');
        }

        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;

        // Create parent document in Firestore
        const parentData = {
            uid: currentUser.uid,
            phoneNumber: phone,
            email: email,
            displayName: 'Parent', // Default name
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            children: [] // Will be populated by admin
        };

        await db.collection('parents').doc(currentUser.uid).set(parentData);
        
        showToast('Account created successfully!', 'success');
        await loadParentData();
        showReportsArea();

    } catch (error) {
        console.error('Sign up error:', error);
        let errorMessage = 'Account creation failed. ';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'Email already in use.';
                break;
            case 'auth/weak-password':
                errorMessage += 'Password is too weak.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address.';
                break;
            default:
                errorMessage += error.message;
        }
        
        showToast(errorMessage, 'error');
    } finally {
        // Reset loading state
        signUpText.textContent = 'Create Account';
        signUpSpinner.classList.add('hidden');
        signUpBtn.disabled = false;
    }
}

async function loadParentData() {
    if (!currentUser) return;

    try {
        const parentDoc = await db.collection('parents').doc(currentUser.uid).get();
        
        if (parentDoc.exists) {
            parentData = parentDoc.data();
            
            // Update welcome message with parent's name
            const parentName = parentData.displayName || 'Parent';
            welcomeMessage.textContent = `Welcome, ${parentName}!`;
            
            // Load children's reports
            await loadChildrenReports();
            
            // Populate student dropdown for feedback
            populateStudentDropdown();
        } else {
            showToast('Parent data not found', 'error');
        }
    } catch (error) {
        console.error('Error loading parent data:', error);
        showToast('Error loading your data', 'error');
    }
}

async function loadChildrenReports() {
    if (!parentData || !parentData.children || parentData.children.length === 0) {
        reportsLoading.classList.add('hidden');
        reportsEmpty.classList.remove('hidden');
        return;
    }

    reportsLoading.classList.remove('hidden');
    reportsEmpty.classList.add('hidden');
    reportContent.innerHTML = '';

    try {
        const childrenIds = parentData.children;
        let allReports = [];

        // Get reports for all children
        for (const childId of childrenIds) {
            const reportsSnapshot = await db.collection('reports')
                .where('studentId', '==', childId)
                .orderBy('date', 'desc')
                .get();
            
            reportsSnapshot.forEach(doc => {
                allReports.push({
                    id: doc.id,
                    ...doc.data(),
                    childId: childId
                });
            });
        }

        // Sort all reports by date (newest first)
        allReports.sort((a, b) => {
            const dateA = a.date?.toDate() || new Date(0);
            const dateB = b.date?.toDate() || new Date(0);
            return dateB - dateA;
        });

        if (allReports.length === 0) {
            reportsLoading.classList.add('hidden');
            reportsEmpty.classList.remove('hidden');
            return;
        }

        // Display reports
        allReports.forEach(report => {
            const reportElement = createReportElement(report);
            reportContent.appendChild(reportElement);
        });

        reportsLoading.classList.add('hidden');

    } catch (error) {
        console.error('Error loading reports:', error);
        reportsLoading.classList.add('hidden');
        showToast('Error loading reports', 'error');
    }
}

function createReportElement(report) {
    const reportDate = report.date?.toDate() || new Date();
    const formattedDate = reportDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const reportDiv = document.createElement('div');
    reportDiv.className = 'bg-white rounded-2xl card-glow p-6';
    reportDiv.innerHTML = `
        <div class="flex justify-between items-start mb-4">
            <div>
                <h3 class="text-xl font-bold text-green-800">${report.studentName || 'Student'}</h3>
                <p class="text-green-600">${formattedDate}</p>
            </div>
            <button onclick="downloadReport('${report.id}')" 
                    class="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow">
                📄 Download PDF
            </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-green-50 p-4 rounded-lg">
                <h4 class="font-semibold text-green-800 mb-2">Academic Progress</h4>
                <p class="text-gray-700">${report.academicProgress || 'No academic progress reported.'}</p>
            </div>
            
            <div class="bg-blue-50 p-4 rounded-lg">
                <h4 class="font-semibold text-blue-800 mb-2">Behavior & Social Skills</h4>
                <p class="text-gray-700">${report.behavior || 'No behavior notes.'}</p>
            </div>
            
            <div class="bg-yellow-50 p-4 rounded-lg">
                <h4 class="font-semibold text-yellow-800 mb-2">Teacher Comments</h4>
                <p class="text-gray-700">${report.teacherComments || 'No teacher comments.'}</p>
            </div>
            
            <div class="bg-purple-50 p-4 rounded-lg">
                <h4 class="font-semibold text-purple-800 mb-2">Areas for Improvement</h4>
                <p class="text-gray-700">${report.improvementAreas || 'No specific areas for improvement noted.'}</p>
            </div>
        </div>
        
        ${report.overallGrade ? `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800 mb-2">Overall Grade</h4>
                <p class="text-2xl font-bold text-green-600">${report.overallGrade}</p>
            </div>
        ` : ''}
    `;

    return reportDiv;
}

function populateStudentDropdown() {
    const feedbackStudent = document.getElementById('feedbackStudent');
    feedbackStudent.innerHTML = '<option value="">Select student</option>';
    
    if (parentData && parentData.children && parentData.children.length > 0) {
        // In a real app, you would fetch the actual student names
        parentData.children.forEach((childId, index) => {
            const option = document.createElement('option');
            option.value = childId;
            option.textContent = `Student ${index + 1}`; // Placeholder - you'll need to get actual names
            feedbackStudent.appendChild(option);
        });
    }
}

async function submitFeedback() {
    const category = document.getElementById('feedbackCategory').value;
    const priority = document.getElementById('feedbackPriority').value;
    const studentId = document.getElementById('feedbackStudent').value;
    const message = document.getElementById('feedbackMessage').value.trim();
    const submitBtn = document.getElementById('submitFeedbackBtn');
    const submitText = document.getElementById('submitFeedbackText');
    const submitSpinner = document.getElementById('submitFeedbackSpinner');

    if (!category || !priority || !studentId || !message) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    // Show loading state
    submitText.textContent = 'Submitting...';
    submitSpinner.classList.remove('hidden');
    submitBtn.disabled = true;

    try {
        const feedbackData = {
            parentId: currentUser.uid,
            parentName: parentData?.displayName || 'Parent',
            parentEmail: parentData?.email || currentUser.email,
            category: category,
            priority: priority,
            studentId: studentId,
            message: message,
            status: 'submitted',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            adminResponse: null,
            respondedAt: null
        };

        await db.collection('feedback').add(feedbackData);
        
        showToast('Feedback submitted successfully!', 'success');
        hideFeedbackModal();
        
        // Clear form
        document.getElementById('feedbackCategory').value = '';
        document.getElementById('feedbackPriority').value = '';
        document.getElementById('feedbackStudent').value = '';
        document.getElementById('feedbackMessage').value = '';

    } catch (error) {
        console.error('Error submitting feedback:', error);
        showToast('Error submitting feedback', 'error');
    } finally {
        // Reset loading state
        submitText.textContent = 'Submit Feedback';
        submitSpinner.classList.add('hidden');
        submitBtn.disabled = false;
    }
}

// Modal functions
function showFeedbackModal() {
    document.getElementById('feedbackModal').classList.remove('hidden');
}

function hideFeedbackModal() {
    document.getElementById('feedbackModal').classList.add('hidden');
}

function showPasswordResetModal() {
    document.getElementById('passwordResetModal').classList.remove('hidden');
}

function hidePasswordResetModal() {
    document.getElementById('passwordResetModal').classList.add('hidden');
}

function showResponsesModal() {
    document.getElementById('responsesModal').classList.remove('hidden');
    loadAdminResponses();
}

function hideResponsesModal() {
    document.getElementById('responsesModal').classList.add('hidden');
}

async function loadAdminResponses() {
    const responsesContent = document.getElementById('responsesContent');
    responsesContent.innerHTML = '<p class="text-center text-gray-500">Loading responses...</p>';

    try {
        const feedbackSnapshot = await db.collection('feedback')
            .where('parentId', '==', currentUser.uid)
            .where('adminResponse', '!=', null)
            .orderBy('respondedAt', 'desc')
            .get();

        if (feedbackSnapshot.empty) {
            responsesContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">📭</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Responses Yet</h3>
                    <p class="text-gray-500">You haven't received any responses from our staff yet.</p>
                </div>
            `;
            return;
        }

        responsesContent.innerHTML = '';

        feedbackSnapshot.forEach(doc => {
            const feedback = doc.data();
            const responseDate = feedback.respondedAt?.toDate() || new Date();
            const formattedDate = responseDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const responseElement = document.createElement('div');
            responseElement.className = 'bg-white border border-gray-200 rounded-xl p-6';
            responseElement.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getCategoryColor(feedback.category)}">
                            ${feedback.category}
                        </span>
                        <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ml-2 ${getPriorityColor(feedback.priority)}">
                            ${feedback.priority} Priority
                        </span>
                    </div>
                    <span class="text-sm text-gray-500">${formattedDate}</span>
                </div>
                
                <div class="mb-4">
                    <h4 class="font-semibold text-gray-800 mb-2">Your Feedback:</h4>
                    <p class="text-gray-700 bg-gray-50 p-3 rounded-lg">${feedback.message}</p>
                </div>
                
                <div class="response-bubble">
                    <div class="response-header">Admin Response:</div>
                    <p class="text-gray-700">${feedback.adminResponse}</p>
                </div>
            `;

            responsesContent.appendChild(responseElement);
        });

    } catch (error) {
        console.error('Error loading responses:', error);
        responsesContent.innerHTML = '<p class="text-center text-red-500">Error loading responses</p>';
    }
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

async function sendPasswordReset() {
    const email = document.getElementById('resetEmail').value.trim();
    const sendResetBtn = document.getElementById('sendResetBtn');
    const sendResetText = document.getElementById('sendResetText');
    const sendResetSpinner = document.getElementById('sendResetSpinner');

    if (!email) {
        showToast('Please enter your email address', 'error');
        return;
    }

    // Show loading state
    sendResetText.textContent = 'Sending...';
    sendResetSpinner.classList.remove('hidden');
    sendResetBtn.disabled = true;

    try {
        await auth.sendPasswordResetEmail(email);
        showToast('Password reset email sent! Check your inbox.', 'success');
        hidePasswordResetModal();
    } catch (error) {
        console.error('Password reset error:', error);
        let errorMessage = 'Failed to send reset email. ';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account found with this email.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address.';
                break;
            default:
                errorMessage += error.message;
        }
        
        showToast(errorMessage, 'error');
    } finally {
        // Reset loading state
        sendResetText.textContent = 'Send Reset Link';
        sendResetSpinner.classList.add('hidden');
        sendResetBtn.disabled = false;
    }
}

function downloadReport(reportId) {
    showToast('PDF download functionality would be implemented here', 'success');
    // In a real implementation, you would generate and download PDF
}

function showReportsArea() {
    authArea.classList.add('hidden');
    reportArea.classList.remove('hidden');
}

function showAuthArea() {
    reportArea.classList.add('hidden');
    authArea.classList.remove('hidden');
}

function logout() {
    auth.signOut().then(() => {
        currentUser = null;
        parentData = null;
        showAuthArea();
        showToast('Successfully logged out', 'success');
    }).catch(error => {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    toast.textContent = message;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// Auth state listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadParentData();
        showReportsArea();
    } else {
        currentUser = null;
        parentData = null;
        showAuthArea();
    }
});

// Also update the welcome section HTML to include the View Responses button
// Add this to your HTML in the welcome section div (after the feedback button):
document.addEventListener('DOMContentLoaded', function() {
    // Add View Responses button to the welcome section
    const welcomeSection = document.querySelector('.bg-green-50');
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    
    const viewResponsesBtn = document.createElement('button');
    viewResponsesBtn.onclick = showResponsesModal;
    viewResponsesBtn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 btn-glow flex items-center justify-center';
    viewResponsesBtn.innerHTML = '<span class="mr-2">📨</span> View Responses';
    
    buttonContainer.insertBefore(viewResponsesBtn, buttonContainer.lastElementChild);
});
