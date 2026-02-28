// studentsignup-app.js
// Production-ready Firebase authentication module

// IMPORTANT: Import Firebase modules
import { auth, db } from './firebaseConfig-studentsignupmodular.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    setDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    updateProfile, 
    signInWithPopup, 
    GoogleAuthProvider,
    sendPasswordResetEmail,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Security: Rate limiting variables
let failedAttempts = 0;
let lastAttemptTime = 0;
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// Toast notification system
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]} text-xl"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto-remove toast after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 400);
    }, duration);
}

// Password strength checker
window.checkPasswordStrength = () => {
    const password = document.getElementById('student-pass').value;
    const meter = document.getElementById('password-strength-meter');
    const strengthText = document.getElementById('strength-text');
    
    if (!password) {
        meter.className = 'password-strength-meter';
        strengthText.textContent = 'Weak';
        strengthText.className = 'text-sm font-bold text-red-600';
        document.querySelectorAll('#password-requirements li').forEach(li => {
            li.classList.remove('valid');
        });
        return;
    }
    
    // Check requirements
    const hasLength = password.length >= 12;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Update requirement indicators
    document.getElementById('req-length').classList.toggle('valid', hasLength);
    document.getElementById('req-uppercase').classList.toggle('valid', hasUpper);
    document.getElementById('req-lowercase').classList.toggle('valid', hasLower);
    document.getElementById('req-number').classList.toggle('valid', hasNumber);
    document.getElementById('req-special').classList.toggle('valid', hasSpecial);
    
    // Calculate strength score (0-4)
    let score = 0;
    if (hasLength) score++;
    if (hasUpper) score++;
    if (hasLower) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
    
    // Update strength meter and text
    meter.className = `password-strength-meter strength-${score}`;
    
    const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    const strengthColors = ['text-red-600', 'text-orange-500', 'text-yellow-500', 'text-green-500', 'text-emerald-600'];
    
    strengthText.textContent = strengthLabels[score];
    strengthText.className = `text-sm font-bold ${strengthColors[score]}`;
    
    // Enable/disable activation button based on minimum requirements
    const activateBtn = document.getElementById('activate-portal-btn');
    const minRequirementsMet = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
    activateBtn.disabled = !minRequirementsMet;
};

// Toggle password visibility
window.togglePasswordVisibility = (inputId) => {
    const input = document.getElementById(inputId);
    const eyeIcon = document.getElementById(`eye-icon-${inputId === 'student-pass' ? 'student' : 'login'}`);
    
    if (input.type === 'password') {
        input.type = 'text';
        eyeIcon.className = 'far fa-eye-slash';
    } else {
        input.type = 'password';
        eyeIcon.className = 'far fa-eye';
    }
};

// Tab switching
window.switchTab = (tab) => {
    const activateTab = document.getElementById('tab-activate');
    const loginTab = document.getElementById('tab-login');
    const activationFlow = document.getElementById('activation-flow');
    const loginFlow = document.getElementById('login-flow');
    
    if (tab === 'activate') {
        // Update tabs
        activateTab.classList.add('active');
        activateTab.classList.remove('text-gray-600');
        loginTab.classList.remove('active');
        loginTab.classList.add('text-gray-600');
        
        // Update flows
        activationFlow.classList.remove('hidden-step');
        loginFlow.classList.add('hidden-step');
        
        // Reset to step 1
        document.getElementById('step-1').classList.remove('hidden-step');
        document.getElementById('step-2').classList.add('hidden-step');
        
        // Clear form
        document.getElementById('parent-email').value = '';
        resetRateLimiting();
    } else {
        // Update tabs
        loginTab.classList.add('active');
        loginTab.classList.remove('text-gray-600');
        activateTab.classList.remove('active');
        activateTab.classList.add('text-gray-600');
        
        // Update flows
        loginFlow.classList.remove('hidden-step');
        activationFlow.classList.add('hidden-step');
        
        // Auto-fill remembered email
        const rememberedEmail = localStorage.getItem('student_email');
        if (rememberedEmail) {
            document.getElementById('login-email').value = rememberedEmail;
        }
        
        resetRateLimiting();
    }
};

// Go back to step 1
window.goBackToStep1 = () => {
    document.getElementById('step-1').classList.remove('hidden-step');
    document.getElementById('step-2').classList.add('hidden-step');
};

// Show/hide forgot password
window.showForgotPassword = () => {
    document.getElementById('forgot-password-modal').classList.remove('hidden-step');
};

window.hideForgotPassword = () => {
    document.getElementById('forgot-password-modal').classList.add('hidden-step');
    document.getElementById('reset-email').value = '';
};

// Reset rate limiting
function resetRateLimiting() {
    failedAttempts = 0;
    document.getElementById('rate-limit-warning').classList.add('hidden');
    document.getElementById('failed-attempts-warning').classList.add('hidden');
}

// Check if rate limited
function checkRateLimit() {
    const now = Date.now();
    if (failedAttempts >= MAX_ATTEMPTS) {
        if (now - lastAttemptTime < LOCKOUT_TIME) {
            const remainingMinutes = Math.ceil((LOCKOUT_TIME - (now - lastAttemptTime)) / 60000);
            document.getElementById('rate-limit-message').textContent = 
                `Too many failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`;
            document.getElementById('rate-limit-warning').classList.remove('hidden');
            return true;
        } else {
            // Reset after lockout period
            failedAttempts = 0;
        }
    }
    return false;
}

// Get client IP address
async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.warn('Could not fetch IP address:', error);
        return 'unknown';
    }
}

// Find students by parent email
window.findStudents = async () => {
    // Check rate limiting
    if (checkRateLimit()) {
        return;
    }
    
    const email = document.getElementById('parent-email').value.trim();
    
    // Validate email
    if (!email) {
        showToast('Please enter the parent email.', 'error');
        return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    try {
        // Show loading
        document.getElementById('find-profile-text').classList.add('hidden');
        document.getElementById('find-profile-loading').classList.remove('hidden');
        document.getElementById('find-profile-btn').disabled = true;

        // Query students collection
        const q = query(collection(db, "students"), where("parentEmail", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showToast('No student records found for this email.', 'error');
            failedAttempts++;
            lastAttemptTime = Date.now();
            return;
        }

        const select = document.getElementById('student-select');
        select.innerHTML = '<option value="">Select your name</option>';
        let foundInactive = false;
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Only show students who haven't been activated yet
            if (!data.studentUid || data.status !== 'active') {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = data.studentName + (data.grade ? ` - Grade ${data.grade}` : '');
                select.appendChild(opt);
                foundInactive = true;
            }
        });
        
        if (foundInactive) {
            document.getElementById('step-1').classList.add('hidden-step');
            document.getElementById('step-2').classList.remove('hidden-step');
            showToast('Students found! Please select your name.', 'success');
        } else {
            showToast('All students under this email are already activated. Please login instead.', 'info');
            window.switchTab('login');
        }
    } catch (error) {
        console.error('Error finding students:', error);
        showToast('An error occurred. Please try again.', 'error');
        failedAttempts++;
        lastAttemptTime = Date.now();
    } finally {
        // Reset loading state
        document.getElementById('find-profile-text').classList.remove('hidden');
        document.getElementById('find-profile-loading').classList.add('hidden');
        document.getElementById('find-profile-btn').disabled = false;
    }
};

// Complete registration
window.completeRegistration = async () => {
    const docId = document.getElementById('student-select').value;
    const email = document.getElementById('student-email-input').value.trim();
    const password = document.getElementById('student-pass').value;
    const rememberMe = document.getElementById('remember-me-activation').checked;

    // Validate selection
    if (!docId || docId === "") {
        showToast('Please select your name from the list.', 'error');
        return;
    }

    // Validate email
    if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    // Validate password strength
    const hasLength = password.length >= 12;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        showToast('Please ensure your password meets all requirements.', 'error');
        return;
    }

    try {
        // Show loading
        document.getElementById('activate-text').classList.add('hidden');
        document.getElementById('activate-loading').classList.remove('hidden');
        document.getElementById('activate-portal-btn').disabled = true;

        // Set persistence based on "Remember Me"
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        // Check if email already exists in students collection
        const emailCheck = query(collection(db, "students"), where("studentEmail", "==", email));
        const emailSnapshot = await getDocs(emailCheck);
        
        if (!emailSnapshot.empty) {
            showToast('This email is already registered. Please use a different email or login.', 'error');
            return;
        }

        // Create user in Firebase Auth
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const studentName = document.getElementById('student-select').options[document.getElementById('student-select').selectedIndex].text.split(' - ')[0];
        
        // Update the students collection
        await updateDoc(doc(db, "students", docId), {
            studentUid: userCred.user.uid,
            studentEmail: email,
            status: 'active',
            activatedAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            security: {
                passwordChangedAt: serverTimestamp(),
                mfaEnabled: false
            }
        });

        // Create audit log
        await setDoc(doc(collection(db, "audit_logs")), {
            action: 'student_activation',
            studentId: docId,
            studentName: studentName,
            email: email,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            ip: await getClientIP()
        });

        // Update user profile
        await updateProfile(userCred.user, { 
            displayName: studentName
        });

        // Store session info
        if (rememberMe) {
            localStorage.setItem('student_remember_me', 'true');
            localStorage.setItem('student_email', email);
        }

        showToast('Account activated successfully! Redirecting...', 'success');
        
        // Redirect after delay
        setTimeout(() => {
            window.location.href = 'bkhstudentportal.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle specific Firebase errors
        if (error.code === 'auth/email-already-in-use') {
            showToast('Email already registered. Please login instead.', 'error');
            window.switchTab('login');
        } else if (error.code === 'auth/weak-password') {
            showToast('Password is too weak. Please use a stronger password.', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email format.', 'error');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Registration failed: ' + error.message, 'error');
        }
    } finally {
        // Reset loading state
        document.getElementById('activate-text').classList.remove('hidden');
        document.getElementById('activate-loading').classList.add('hidden');
        document.getElementById('activate-portal-btn').disabled = false;
    }
};

// Login student
window.loginStudent = async () => {
    // Check rate limiting
    if (checkRateLimit()) {
        return;
    }
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me-login').checked;

    // Validate inputs
    if (!email || !password) {
        showToast('Please enter both email and password.', 'error');
        return;
    }

    try {
        // Show loading
        document.getElementById('login-text').classList.add('hidden');
        document.getElementById('login-loading').classList.remove('hidden');
        document.getElementById('login-portal-btn').disabled = true;

        // Set persistence
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        // Attempt login
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        
        // Verify the user exists in students collection
        const q = query(collection(db, "students"), where("studentUid", "==", userCred.user.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            await signOut(auth);
            showToast('Student account not found in database. Please contact support.', 'error');
            failedAttempts++;
            lastAttemptTime = Date.now();
            return;
        }

        // Update last login
        const studentDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "students", studentDoc.id), {
            lastLogin: serverTimestamp(),
            failedAttempts: 0 // Reset on successful login
        });

        // Create audit log
        await setDoc(doc(collection(db, "audit_logs")), {
            action: 'student_login',
            studentId: studentDoc.id,
            studentName: studentDoc.data().studentName,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            rememberMe: rememberMe,
            ip: await getClientIP()
        });

        // Store session info
        if (rememberMe) {
            localStorage.setItem('student_remember_me', 'true');
            localStorage.setItem('student_email', email);
        } else {
            localStorage.removeItem('student_remember_me');
            localStorage.removeItem('student_email');
        }

        // Reset failed attempts
        failedAttempts = 0;
        
        showToast('Login successful! Redirecting...', 'success');
        
        // Redirect after delay
        setTimeout(() => {
            window.location.href = 'bkhstudentportal.html';
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        failedAttempts++;
        lastAttemptTime = Date.now();
        
        // Update failed attempts warning
        const remainingAttempts = MAX_ATTEMPTS - failedAttempts;
        if (remainingAttempts > 0) {
            document.getElementById('failed-attempts-message').textContent = 
                `Invalid credentials. ${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining.`;
            document.getElementById('failed-attempts-warning').classList.remove('hidden');
        } else {
            document.getElementById('failed-attempts-message').textContent = 
                `Account locked. Please try again in 15 minutes or reset your password.`;
            document.getElementById('failed-attempts-warning').classList.remove('hidden');
        }

        // Handle specific Firebase errors
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            showToast('Invalid email or password.', 'error');
        } else if (error.code === 'auth/user-disabled') {
            showToast('Account disabled. Please contact support.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Too many failed attempts. Account temporarily locked.', 'error');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Login failed: ' + error.message, 'error');
        }
        
        // Shake animation for failed login
        document.getElementById('login-flow').classList.add('shake');
        setTimeout(() => {
            document.getElementById('login-flow').classList.remove('shake');
        }, 500);
    } finally {
        // Reset loading state
        document.getElementById('login-text').classList.remove('hidden');
        document.getElementById('login-loading').classList.add('hidden');
        document.getElementById('login-portal-btn').disabled = false;
    }
};

// Google Sign-in functions
window.signInWithGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        // Set persistence based on checkbox
        const rememberMe = document.getElementById('remember-me-login').checked;
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if this Google user is in our students collection
        const q = query(collection(db, "students"), where("studentUid", "==", user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Update last login
            const studentDoc = querySnapshot.docs[0];
            await updateDoc(doc(db, "students", studentDoc.id), {
                lastLogin: serverTimestamp()
            });

            // Store session info
            if (rememberMe) {
                localStorage.setItem('student_remember_me', 'true');
                localStorage.setItem('student_email', user.email);
            }
            
            window.location.href = 'bkhstudentportal.html';
            return;
        }

        // Check if they have a matching email in students collection
        const emailQ = query(collection(db, "students"), where("studentEmail", "==", user.email));
        const emailSnapshot = await getDocs(emailQ);
        
        if (!emailSnapshot.empty) {
            // Link the Google account to existing student record
            const docId = emailSnapshot.docs[0].id;
            await updateDoc(doc(db, "students", docId), {
                studentUid: user.uid,
                lastLogin: serverTimestamp()
            });
            
            if (rememberMe) {
                localStorage.setItem('student_remember_me', 'true');
                localStorage.setItem('student_email', user.email);
            }
            
            window.location.href = 'bkhstudentportal.html';
            return;
        }

        // No matching account found
        await signOut(auth);
        showToast('No student account found for this Google account. Please activate your account first.', 'error');
        
    } catch (error) {
        console.error("Google sign-in error:", error);
        
        // Handle specific Google OAuth errors
        if (error.code === 'auth/unauthorized-domain') {
            showToast('Google sign-in not configured for this domain. Please contact administrator.', 'error');
        } else if (error.code === 'auth/popup-blocked') {
            showToast('Popup blocked. Please allow popups for this site.', 'error');
        } else if (error.code === 'auth/popup-closed-by-user') {
            showToast('Sign-in cancelled.', 'info');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Google sign-in failed: ' + error.message, 'error');
        }
    }
};

// Google sign-in for activation
window.signInWithGoogleForActivation = async () => {
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');

        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if this Google user already has a student account
        const q = query(collection(db, "students"), where("studentUid", "==", user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            showToast('You already have an activated account. Please login instead.', 'info');
            window.switchTab('login');
            await signOut(auth);
            return;
        }

        // Proceed to step 2 for profile selection
        document.getElementById('student-email-input').value = user.email;
        document.getElementById('step-1').classList.add('hidden-step');
        document.getElementById('step-2').classList.remove('hidden-step');
        showToast('Google account linked. Please select your name and create a password.', 'success');
        
    } catch (error) {
        console.error("Google sign-in error:", error);
        
        if (error.code === 'auth/unauthorized-domain') {
            showToast('Google sign-in not configured for this domain. Please contact administrator.', 'error');
        } else if (error.code === 'auth/popup-blocked') {
            showToast('Popup blocked. Please allow popups for this site.', 'error');
        } else if (error.code === 'auth/popup-closed-by-user') {
            showToast('Sign-in cancelled.', 'info');
        } else {
            showToast('Google sign-in failed: ' + error.message, 'error');
        }
    }
};

// Password reset function
window.sendPasswordReset = async () => {
    const email = document.getElementById('reset-email').value.trim();
    
    if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    try {
        // Show loading
        document.getElementById('reset-text').classList.add('hidden');
        document.getElementById('reset-loading').classList.remove('hidden');
        document.getElementById('send-reset-btn').disabled = true;

        // Check if email exists in students collection
        const emailQ = query(collection(db, "students"), where("studentEmail", "==", email));
        const emailSnapshot = await getDocs(emailQ);
        
        if (emailSnapshot.empty) {
            showToast('No student account found with this email.', 'error');
            return;
        }

        // Send password reset email
        await sendPasswordResetEmail(auth, email, {
            url: window.location.origin + '/studentsignup.html',
            handleCodeInApp: false
        });

        // Create audit log
        await setDoc(doc(collection(db, "audit_logs")), {
            action: 'password_reset_requested',
            email: email,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            ip: await getClientIP()
        });

        showToast('Password reset link sent! Check your email.', 'success');
        setTimeout(() => {
            window.hideForgotPassword();
        }, 2000);

    } catch (error) {
        console.error('Password reset error:', error);
        
        if (error.code === 'auth/user-not-found') {
            showToast('No account found with this email.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Too many reset attempts. Please try again later.', 'error');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Failed to send reset email: ' + error.message, 'error');
        }
    } finally {
        document.getElementById('reset-text').classList.remove('hidden');
        document.getElementById('reset-loading').classList.add('hidden');
        document.getElementById('send-reset-btn').disabled = false;
    }
};

// Make functions available globally
window.showToast = showToast;
window.checkPasswordStrength = window.checkPasswordStrength;
window.togglePasswordVisibility = window.togglePasswordVisibility;
window.switchTab = window.switchTab;
window.goBackToStep1 = window.goBackToStep1;
window.showForgotPassword = window.showForgotPassword;
window.hideForgotPassword = window.hideForgotPassword;
window.findStudents = window.findStudents;
window.completeRegistration = window.completeRegistration;
window.loginStudent = window.loginStudent;
window.signInWithGoogle = window.signInWithGoogle;
window.signInWithGoogleForActivation = window.signInWithGoogleForActivation;
window.sendPasswordReset = window.sendPasswordReset;
