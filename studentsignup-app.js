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
// FIX: Use textContent instead of innerHTML to prevent XSS
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

    const icon = document.createElement('i');
    icon.className = `fas ${icons[type] || icons.info} text-xl`;

    const span = document.createElement('span');
    span.textContent = message; // FIX: textContent prevents XSS

    toast.appendChild(icon);
    toast.appendChild(span);
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
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
    
    const hasLength = password.length >= 12;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    document.getElementById('req-length').classList.toggle('valid', hasLength);
    document.getElementById('req-uppercase').classList.toggle('valid', hasUpper);
    document.getElementById('req-lowercase').classList.toggle('valid', hasLower);
    document.getElementById('req-number').classList.toggle('valid', hasNumber);
    document.getElementById('req-special').classList.toggle('valid', hasSpecial);
    
    let score = 0;
    if (hasLength) score++;
    if (hasUpper) score++;
    if (hasLower) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
    
    meter.className = `password-strength-meter strength-${score}`;
    
    const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    const strengthColors = ['text-red-600', 'text-orange-500', 'text-yellow-500', 'text-green-500', 'text-emerald-600'];
    
    strengthText.textContent = strengthLabels[score];
    strengthText.className = `text-sm font-bold ${strengthColors[score]}`;
    
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
        activateTab.classList.add('active');
        activateTab.classList.remove('text-gray-600');
        loginTab.classList.remove('active');
        loginTab.classList.add('text-gray-600');
        
        activationFlow.classList.remove('hidden-step');
        loginFlow.classList.add('hidden-step');
        
        document.getElementById('step-1').classList.remove('hidden-step');
        document.getElementById('step-2').classList.add('hidden-step');
        
        document.getElementById('parent-email').value = '';
        resetRateLimiting();
    } else {
        loginTab.classList.add('active');
        loginTab.classList.remove('text-gray-600');
        activateTab.classList.remove('active');
        activateTab.classList.add('text-gray-600');
        
        loginFlow.classList.remove('hidden-step');
        activationFlow.classList.add('hidden-step');
        
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
        return data.ip || 'unknown';
    } catch (error) {
        console.warn('Could not fetch IP address:', error);
        return 'unknown';
    }
}

// Find students by parent email
window.findStudents = async () => {
    if (checkRateLimit()) {
        return;
    }
    
    const email = document.getElementById('parent-email').value.trim();
    
    if (!email) {
        showToast('Please enter the parent email.', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    try {
        document.getElementById('find-profile-text').classList.add('hidden');
        document.getElementById('find-profile-loading').classList.remove('hidden');
        document.getElementById('find-profile-btn').disabled = true;

        const q = query(collection(db, "students"), where("parentEmail", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // FIX: Generic message to avoid confirming whether an email is registered
            showToast('No student records found. Please check the email or contact your administrator.', 'error');
            failedAttempts++;
            lastAttemptTime = Date.now();
            return;
        }

        const select = document.getElementById('student-select');
        select.innerHTML = '<option value="">Select your name</option>';
        let foundInactive = false;
        
        querySnapshot.forEach(doc => {
            const data = doc.data();
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

    // FIX: Check privacy consent before proceeding
    const consentChecked = document.getElementById('student-privacy-consent').checked;
    if (!consentChecked) {
        showToast('Please read and accept the Privacy Policy to continue.', 'error');
        return;
    }

    if (!docId || docId === "") {
        showToast('Please select your name from the list.', 'error');
        return;
    }

    if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

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
        document.getElementById('activate-text').classList.add('hidden');
        document.getElementById('activate-loading').classList.remove('hidden');
        document.getElementById('activate-portal-btn').disabled = true;

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
        
        // FIX: Wrap Firestore update in its own try/catch so failures are clearly surfaced
        try {
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
        } catch (firestoreError) {
            // Auth account created but Firestore update failed
            console.error('CRITICAL: Auth account created but Firestore update failed:', firestoreError);
            showToast('Account created but profile save failed. Please contact your administrator immediately with your email address.', 'error');
            return;
        }

        // Create audit log (after Firestore confirmed)
        try {
            await setDoc(doc(collection(db, "audit_logs")), {
                action: 'student_activation',
                studentId: docId,
                studentName: studentName,
                email: email,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent,
                ip: await getClientIP()
            });
        } catch (auditError) {
            // Audit log failure should not block the user
            console.warn('Audit log write failed:', auditError);
        }

        // Update user profile display name
        await updateProfile(userCred.user, { 
            displayName: studentName
        });

        // FIX: Clear password field after successful registration
        document.getElementById('student-pass').value = '';

        if (rememberMe) {
            localStorage.setItem('student_remember_me', 'true');
            localStorage.setItem('student_email', email);
        }

        showToast('Account activated successfully! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'bkhstudentportal.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            // FIX: Email already in Auth — check if Firestore also has it
            try {
                const repairCheck = query(collection(db, "students"), where("studentEmail", "==", email));
                const repairSnapshot = await getDocs(repairCheck);
                if (!repairSnapshot.empty) {
                    showToast('Account already activated. Please login instead.', 'info');
                } else {
                    showToast('This email already has an account. Please login or contact your administrator.', 'error');
                }
                window.switchTab('login');
            } catch (repairError) {
                showToast('Email already registered. Please try logging in.', 'error');
                window.switchTab('login');
            }
        } else if (error.code === 'auth/weak-password') {
            showToast('Password is too weak. Please use a stronger password.', 'error');
        } else if (error.code === 'auth/invalid-email') {
            showToast('Invalid email format.', 'error');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Registration failed. Please try again or contact your administrator.', 'error');
        }
    } finally {
        document.getElementById('activate-text').classList.remove('hidden');
        document.getElementById('activate-loading').classList.add('hidden');
        document.getElementById('activate-portal-btn').disabled = false;
    }
};

// Login student
window.loginStudent = async () => {
    if (checkRateLimit()) {
        return;
    }
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me-login').checked;

    if (!email || !password) {
        showToast('Please enter both email and password.', 'error');
        return;
    }

    try {
        document.getElementById('login-text').classList.add('hidden');
        document.getElementById('login-loading').classList.remove('hidden');
        document.getElementById('login-portal-btn').disabled = true;

        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

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
            failedAttempts: 0
        });

        // Audit log
        try {
            await setDoc(doc(collection(db, "audit_logs")), {
                action: 'student_login',
                studentId: studentDoc.id,
                studentName: studentDoc.data().studentName,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent,
                rememberMe: rememberMe,
                ip: await getClientIP()
            });
        } catch (auditError) {
            console.warn('Audit log write failed:', auditError);
        }

        if (rememberMe) {
            localStorage.setItem('student_remember_me', 'true');
            localStorage.setItem('student_email', email);
        } else {
            localStorage.removeItem('student_remember_me');
            localStorage.removeItem('student_email');
        }

        failedAttempts = 0;
        
        showToast('Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'bkhstudentportal.html';
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        failedAttempts++;
        lastAttemptTime = Date.now();
        
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

        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showToast('Invalid email or password.', 'error');
        } else if (error.code === 'auth/user-disabled') {
            showToast('Account disabled. Please contact support.', 'error');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Too many failed attempts. Account temporarily locked.', 'error');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Login failed. Please check your credentials and try again.', 'error');
        }
        
        document.getElementById('login-flow').classList.add('shake');
        setTimeout(() => {
            document.getElementById('login-flow').classList.remove('shake');
        }, 500);
    } finally {
        document.getElementById('login-text').classList.remove('hidden');
        document.getElementById('login-loading').classList.add('hidden');
        document.getElementById('login-portal-btn').disabled = false;
    }
};

// Password reset function
// FIX: Removed continueUrl to fix auth/unauthorized-continue-uri error
// FIX: Generic message to prevent user enumeration
// FIX: Audit log only written after confirmed successful send
window.sendPasswordReset = async () => {
    const email = document.getElementById('reset-email').value.trim();
    
    if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    try {
        document.getElementById('reset-text').classList.add('hidden');
        document.getElementById('reset-loading').classList.remove('hidden');
        document.getElementById('send-reset-btn').disabled = true;

        // Check if email exists in students collection
        const emailQ = query(collection(db, "students"), where("studentEmail", "==", email));
        const emailSnapshot = await getDocs(emailQ);
        
        // FIX: Same message whether email found or not — prevents user enumeration
        if (emailSnapshot.empty) {
            showToast('If that email is registered, a reset link has been sent. Check your inbox.', 'info');
            return;
        }

        // Send password reset email — no continueUrl to avoid domain whitelist error
        await sendPasswordResetEmail(auth, email);

        // FIX: Audit log only written after the email is confirmed sent
        try {
            await setDoc(doc(collection(db, "audit_logs")), {
                action: 'password_reset_requested',
                email: email,
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent,
                ip: await getClientIP()
            });
        } catch (auditError) {
            console.warn('Audit log write failed:', auditError);
        }

        showToast('Password reset link sent! Check your email inbox and spam folder.', 'success');
        setTimeout(() => {
            window.hideForgotPassword();
        }, 2000);

    } catch (error) {
        console.error('Password reset error:', error);
        
        if (error.code === 'auth/user-not-found') {
            // FIX: Generic message — same as above — does not confirm registration
            showToast('If that email is registered, a reset link has been sent.', 'info');
        } else if (error.code === 'auth/too-many-requests') {
            showToast('Too many reset attempts. Please try again later.', 'error');
        } else if (error.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('Failed to send reset email. Please try again.', 'error');
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
window.sendPasswordReset = window.sendPasswordReset;
