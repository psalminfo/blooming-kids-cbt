// =============================================================================
// COMPREHENSIVE PARENT PORTAL UPDATE - BLOOMING KIDS HOUSE
// =============================================================================

// Firebase config (will be moved to environment variables in production)
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
// STATE MANAGEMENT SYSTEM - REPLACES GLOBAL VARIABLES
// =============================================================================

class AppState {
    constructor() {
        this.state = {
            user: {
                data: null,
                children: [],
                isAuthenticated: false
            },
            ui: {
                loading: false,
                activeTab: 'reports',
                notifications: {
                    unreadResponses: 0,
                    showBadge: false
                }
            },
            cache: {
                reports: null,
                timestamp: null,
                version: '1.0'
            },
            session: {
                lastActivity: Date.now(),
                timeout: 24 * 60 * 60 * 1000 // 24 hours
            }
        };
        this.listeners = [];
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notifyListeners();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // Session management
    updateActivity() {
        this.state.session.lastActivity = Date.now();
    }

    isSessionExpired() {
        return Date.now() - this.state.session.lastActivity > this.state.session.timeout;
    }
}

const appState = new AppState();

// =============================================================================
// UNIFIED VALIDATION SERVICE
// =============================================================================

class ValidationService {
    static patterns = {
        phone: /^[\+]?[1-9][\d]{0,15}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        name: /^[a-zA-Z\s]{2,50}$/
    };

    static validatePhone(phone) {
        if (!phone) return { isValid: false, message: 'Phone number is required' };
        
        const cleaned = phone.replace(/[^\d+]/g, '');
        if (!cleaned) return { isValid: false, message: 'Please enter a valid phone number' };
        if (cleaned.length < 10) return { isValid: false, message: 'Phone number too short' };
        if (cleaned.length > 16) return { isValid: false, message: 'Phone number too long' };
        
        return { isValid: true, message: '' };
    }

    static validateEmail(email) {
        if (!email) return { isValid: false, message: 'Email is required' };
        if (!this.patterns.email.test(email)) return { isValid: false, message: 'Please enter a valid email address' };
        return { isValid: true, message: '' };
    }

    static validatePassword(password) {
        if (!password) return { isValid: false, message: 'Password is required' };
        if (password.length < 8) return { isValid: false, message: 'Password must be at least 8 characters' };
        if (!this.patterns.password.test(password)) {
            return { 
                isValid: false, 
                message: 'Password must include uppercase, lowercase, number, and special character' 
            };
        }
        return { isValid: true, message: '' };
    }

    static validateName(name) {
        if (!name) return { isValid: false, message: 'Name is required' };
        if (!this.patterns.name.test(name)) return { isValid: false, message: 'Please enter a valid name (2-50 characters)' };
        return { isValid: true, message: '' };
    }

    static validateMessage(message, minLength = 10) {
        if (!message) return { isValid: false, message: 'Message is required' };
        if (message.length < minLength) return { isValid: false, message: `Message must be at least ${minLength} characters` };
        return { isValid: true, message: '' };
    }
}

// =============================================================================
// PERFECTED PHONE NUMBER NORMALIZATION
// =============================================================================

class PhoneService {
    static normalizePhoneNumber(phone) {
        if (!phone) return [];
        
        // Remove all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (!cleaned) return [];
        
        const variations = new Set();
        variations.add(cleaned);
        
        // Handle Nigerian numbers - COMPREHENSIVE
        if (cleaned.startsWith('+234')) {
            const withoutPlus = cleaned.substring(1);
            const without234 = '0' + cleaned.substring(4);
            const withoutPlus234 = cleaned.substring(4);
            
            variations.add(withoutPlus);
            variations.add(without234);
            variations.add(withoutPlus234);
            
            // Also add variations without country code for matching
            if (cleaned.length === 14) { // +2348012345678
                variations.add('0' + cleaned.substring(4));
                variations.add(cleaned.substring(4));
            }
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
        
        // Handle UK numbers - COMPREHENSIVE
        if (cleaned.startsWith('+44')) {
            const withoutPlus = cleaned.substring(1);
            const withZero = '0' + cleaned.substring(3);
            variations.add(withoutPlus);
            variations.add(withZero);
            
            // Also generate +44 from local formats
            if (cleaned.startsWith('0') && cleaned.length === 12) {
                variations.add('44' + cleaned.substring(1));
                variations.add('+44' + cleaned.substring(1));
            }
        }
        else if (cleaned.startsWith('44') && cleaned.length >= 12) {
            const withPlus = '+' + cleaned;
            const withZero = '0' + cleaned.substring(2);
            variations.add(withPlus);
            variations.add(withZero);
        }
        else if (cleaned.startsWith('0') && cleaned.length === 11 && cleaned.startsWith('07')) {
            const with44 = '44' + cleaned.substring(1);
            const withPlus44 = '+44' + cleaned.substring(1);
            variations.add(with44);
            variations.add(withPlus44);
        }
        
        // Handle US/Canada numbers - PERFECTED BIDIRECTIONAL
        if (cleaned.startsWith('+1')) {
            const withoutPlus = cleaned.substring(1);
            variations.add(withoutPlus);
            
            // Ensure we have the +1 format for matching
            if (cleaned.length === 12) { // +11234567890
                variations.add(cleaned); // Keep original
            }
        }
        else if (cleaned.startsWith('1') && cleaned.length === 11) {
            const withPlus = '+' + cleaned;
            variations.add(withPlus);
            variations.add(cleaned); // Keep original
        }
        else if (!cleaned.startsWith('+') && !cleaned.startsWith('1') && cleaned.length === 10) {
            // US number without country code: 1234567890
            const with1 = '1' + cleaned;
            const withPlus1 = '+1' + cleaned;
            variations.add(with1);
            variations.add(withPlus1);
            variations.add(cleaned); // Keep original
        }
        
        // Always include the original cleaned version
        variations.add(cleaned);
        
        // Convert to array and filter out any empty or invalid values
        return Array.from(variations).filter(v => v && v.length >= 10);
    }

    static cleanPhoneNumber(phone) {
        if (!phone) return '';
        return phone.replace(/[^\d+]/g, '').trim();
    }

    static formatPhoneForDisplay(phone) {
        if (!phone) return '';
        const cleaned = this.cleanPhoneNumber(phone);
        
        // Format based on country detection
        if (cleaned.startsWith('+234') || cleaned.startsWith('234') || cleaned.startsWith('0')) {
            // Nigerian format: 0801 234 5678
            if (cleaned.startsWith('+234')) {
                const local = '0' + cleaned.substring(4);
                return local.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
            }
            if (cleaned.startsWith('234')) {
                const local = '0' + cleaned.substring(3);
                return local.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
            }
            if (cleaned.startsWith('0') && cleaned.length === 11) {
                return cleaned.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
            }
        }
        
        return cleaned; // Return as-is for international numbers
    }
}

// =============================================================================
// SECURITY & SANITIZATION SERVICE
// =============================================================================

class SecurityService {
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .replace(/\\/g, '&#x5C;')
            .replace(/`/g, '&#x60;');
    }

    static safeTextDisplay(text) {
        return this.sanitizeInput(String(text || ''));
    }

    static escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// =============================================================================
// PASSWORD STRENGTH SERVICE
// =============================================================================

class PasswordService {
    static checkStrength(password) {
        if (!password) return { strength: 0, message: 'Enter password' };
        
        let strength = 0;
        const messages = [];

        // Length check
        if (password.length >= 8) strength += 1;
        else messages.push('At least 8 characters');

        // Lowercase check
        if (/[a-z]/.test(password)) strength += 1;
        else messages.push('One lowercase letter');

        // Uppercase check  
        if (/[A-Z]/.test(password)) strength += 1;
        else messages.push('One uppercase letter');

        // Number check
        if (/[0-9]/.test(password)) strength += 1;
        else messages.push('One number');

        // Special character check
        if (/[@$!%*?&]/.test(password)) strength += 1;
        else messages.push('One special character (@$!%*?&)');

        // Determine strength level
        let level = 'weak';
        let color = 'red';
        
        if (strength >= 4) {
            level = 'strong';
            color = 'green';
        } else if (strength >= 3) {
            level = 'medium'; 
            color = 'orange';
        }

        return {
            strength,
            level,
            color,
            message: messages.length > 0 ? `Missing: ${messages.join(', ')}` : 'Strong password!',
            isStrong: strength >= 4
        };
    }

    static updatePasswordStrengthUI(password) {
        const strengthResult = this.checkStrength(password);
        const strengthBar = document.getElementById('passwordStrengthBar');
        const strengthText = document.getElementById('passwordStrengthText');
        
        if (strengthBar && strengthText) {
            strengthBar.style.width = `${(strengthResult.strength / 5) * 100}%`;
            strengthBar.style.backgroundColor = strengthResult.color;
            strengthText.textContent = strengthResult.message;
            strengthText.style.color = strengthResult.color;
        }
        
        return strengthResult;
    }
}

// =============================================================================
// ERROR HANDLING SERVICE
// =============================================================================

class ErrorHandler {
    static handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        
        // Categorize errors
        const errorInfo = this.categorizeError(error);
        
        // Show user-friendly message
        this.showUserMessage(errorInfo.userMessage, 'error');
        
        // Log for monitoring (in production, send to error tracking service)
        this.logError(error, context, errorInfo);
        
        return errorInfo;
    }

    static categorizeError(error) {
        // Network errors
        if (error.code === 'auth/network-request-failed' || error.message.includes('Failed to fetch')) {
            return {
                type: 'network',
                userMessage: 'Network error. Please check your internet connection and try again.',
                shouldRetry: true
            };
        }
        
        // Firebase auth errors
        if (error.code) {
            switch (error.code) {
                case 'auth/user-not-found':
                    return { type: 'auth', userMessage: 'No account found with these credentials.', shouldRetry: false };
                case 'auth/wrong-password':
                    return { type: 'auth', userMessage: 'Incorrect password.', shouldRetry: false };
                case 'auth/email-already-in-use':
                    return { type: 'auth', userMessage: 'Email address is already in use.', shouldRetry: false };
                case 'auth/too-many-requests':
                    return { type: 'auth', userMessage: 'Too many failed attempts. Account temporarily locked.', shouldRetry: false };
                case 'permission-denied':
                    return { type: 'firestore', userMessage: 'Access denied. Please contact support.', shouldRetry: false };
            }
        }
        
        // Generic errors
        return {
            type: 'unknown', 
            userMessage: 'Something went wrong. Please try again.',
            shouldRetry: true
        };
    }

    static showUserMessage(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm message-toast ${
            type === 'error' ? 'bg-red-500 text-white' : 
            type === 'success' ? 'bg-green-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        toast.textContent = `BKH: ${message}`;
        toast.style.animation = 'slideIn 0.3s ease-out';
        
        document.body.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    static logError(error, context, errorInfo) {
        // In production, this would send to error tracking service
        const errorLog = {
            timestamp: new Date().toISOString(),
            context,
            error: {
                message: error.message,
                code: error.code,
                stack: error.stack
            },
            errorInfo,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        console.log('Error Log:', errorLog);
        
        // Store in localStorage for debugging (limited to last 10 errors)
        try {
            const errorHistory = JSON.parse(localStorage.getItem('errorHistory') || '[]');
            errorHistory.unshift(errorLog);
            localStorage.setItem('errorHistory', JSON.stringify(errorHistory.slice(0, 10)));
        } catch (e) {
            console.error('Failed to save error history:', e);
        }
    }
}

// =============================================================================
// ACCOUNT LOCKOUT SERVICE
// =============================================================================

class AccountLockoutService {
    static MAX_ATTEMPTS = 5;
    static LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

    static getFailedAttempts(identifier) {
        const attempts = JSON.parse(localStorage.getItem('failedAttempts') || '{}');
        return attempts[identifier] || { count: 0, lastAttempt: 0 };
    }

    static recordFailedAttempt(identifier) {
        const attempts = JSON.parse(localStorage.getItem('failedAttempts') || '{}');
        const userAttempts = attempts[identifier] || { count: 0, lastAttempt: 0 };
        
        userAttempts.count++;
        userAttempts.lastAttempt = Date.now();
        attempts[identifier] = userAttempts;
        
        localStorage.setItem('failedAttempts', JSON.stringify(attempts));
        
        return userAttempts.count;
    }

    static clearFailedAttempts(identifier) {
        const attempts = JSON.parse(localStorage.getItem('failedAttempts') || '{}');
        delete attempts[identifier];
        localStorage.setItem('failedAttempts', JSON.stringify(attempts));
    }

    static isAccountLocked(identifier) {
        const attempts = this.getFailedAttempts(identifier);
        
        if (attempts.count >= this.MAX_ATTEMPTS) {
            const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
            if (timeSinceLastAttempt < this.LOCKOUT_DURATION) {
                const remainingTime = Math.ceil((this.LOCKOUT_DURATION - timeSinceLastAttempt) / 1000 / 60);
                return { 
                    locked: true, 
                    message: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
                    remainingTime 
                };
            } else {
                // Lockout period expired, reset attempts
                this.clearFailedAttempts(identifier);
            }
        }
        
        return { locked: false, message: '' };
    }

    static getRemainingAttempts(identifier) {
        const attempts = this.getFailedAttempts(identifier);
        return Math.max(0, this.MAX_ATTEMPTS - attempts.count);
    }
}

// =============================================================================
// SESSION MANAGEMENT SERVICE
// =============================================================================

class SessionService {
    static init() {
        // Update activity on user interactions
        ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
            document.addEventListener(event, () => appState.updateActivity(), { passive: true });
        });

        // Check session every minute
        setInterval(() => this.checkSession(), 60000);
    }

    static checkSession() {
        if (appState.state.user.isAuthenticated && appState.isSessionExpired()) {
            this.timeoutSession();
        }
    }

    static timeoutSession() {
        ErrorHandler.showUserMessage('Session expired due to inactivity. Please sign in again.', 'error');
        this.logout();
    }

    static logout() {
        auth.signOut().then(() => {
            appState.setState({
                user: { data: null, children: [], isAuthenticated: false },
                ui: { ...appState.state.ui, notifications: { unreadResponses: 0, showBadge: false } }
            });
            window.location.reload();
        });
    }

    static extendSession() {
        appState.updateActivity();
    }
}

// =============================================================================
// PERFORMANCE OPTIMIZATION SERVICES
// =============================================================================

class PerformanceService {
    static chartInstances = [];

    static cleanupCharts() {
        this.chartInstances.forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.chartInstances = [];
    }

    static createChart(ctx, config) {
        if (!ctx) return null;
        
        try {
            const chart = new Chart(ctx, config);
            this.chartInstances.push(chart);
            return chart;
        } catch (error) {
            ErrorHandler.handleError(error, 'chart creation');
            return null;
        }
    }

    static lazyLoadImages() {
        const images = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    static async batchQueries(queries) {
        try {
            const results = await Promise.all(queries);
            return results;
        } catch (error) {
            ErrorHandler.handleError(error, 'batch queries');
            throw error;
        }
    }
}

// =============================================================================
// AUTHENTICATION SERVICE
// =============================================================================

class AuthService {
    static async handleSignUp() {
        const phone = document.getElementById('signupPhone')?.value.trim() || '';
        const email = document.getElementById('signupEmail')?.value.trim() || '';
        const password = document.getElementById('signupPassword')?.value || '';
        const confirmPassword = document.getElementById('signupConfirmPassword')?.value || '';

        // Validate inputs
        const phoneValidation = ValidationService.validatePhone(phone);
        const emailValidation = ValidationService.validateEmail(email);
        const passwordValidation = ValidationService.validatePassword(password);

        if (!phoneValidation.isValid) {
            ErrorHandler.showUserMessage(phoneValidation.message, 'error');
            return;
        }
        if (!emailValidation.isValid) {
            ErrorHandler.showUserMessage(emailValidation.message, 'error');
            return;
        }
        if (!passwordValidation.isValid) {
            ErrorHandler.showUserMessage(passwordValidation.message, 'error');
            return;
        }
        if (password !== confirmPassword) {
            ErrorHandler.showUserMessage('Passwords do not match', 'error');
            return;
        }

        // Check account lockout
        const lockoutCheck = AccountLockoutService.isAccountLocked(email);
        if (lockoutCheck.locked) {
            ErrorHandler.showUserMessage(lockoutCheck.message, 'error');
            return;
        }

        const signUpBtn = document.getElementById('signUpBtn');
        const authLoader = document.getElementById('authLoader');

        this.setLoadingState(signUpBtn, authLoader, true, 'Creating Account...');

        try {
            // Create user with email and password
            const userCredential = await auth.createUserWithEmailAndPassword(
                SecurityService.sanitizeInput(email), 
                password
            );
            const user = userCredential.user;

            // Find parent name using perfected phone search
            const cleanedPhone = PhoneService.cleanPhoneNumber(phone);
            const parentName = await this.findParentNameWithVariations(cleanedPhone);
            
            // Generate referral code
            const referralCode = await this.generateReferralCode();

            // Store user data in Firestore
            await db.collection('parent_users').doc(user.uid).set({
                phone: cleanedPhone,
                email: SecurityService.sanitizeInput(email),
                parentName: parentName || 'Parent',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                referralCode: referralCode,
                referralEarnings: 0,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                emailVerified: false
            });

            // Clear any failed attempts
            AccountLockoutService.clearFailedAttempts(email);

            ErrorHandler.showUserMessage('Account created successfully!', 'success');
            
            // Load reports with perfected phone search
            await ReportService.loadAllReportsWithVariations(cleanedPhone, user.uid);

        } catch (error) {
            // Record failed attempt
            AccountLockoutService.recordFailedAttempt(email);
            const remaining = AccountLockoutService.getRemainingAttempts(email);
            
            if (remaining <= 2) {
                ErrorHandler.showUserMessage(`Failed attempt. ${remaining} attempts remaining.`, 'error');
            }
            
            ErrorHandler.handleError(error, 'sign up');
        } finally {
            this.setLoadingState(signUpBtn, authLoader, false, 'Create Account');
        }
    }

    static async handleSignIn() {
        const identifier = document.getElementById('loginIdentifier')?.value.trim() || '';
        const password = document.getElementById('loginPassword')?.value || '';

        if (!identifier || !password) {
            ErrorHandler.showUserMessage('Please fill in all fields', 'error');
            return;
        }

        // Check account lockout
        const lockoutCheck = AccountLockoutService.isAccountLocked(identifier);
        if (lockoutCheck.locked) {
            ErrorHandler.showUserMessage(lockoutCheck.message, 'error');
            return;
        }

        const signInBtn = document.getElementById('signInBtn');
        const authLoader = document.getElementById('authLoader');

        this.setLoadingState(signInBtn, authLoader, true, 'Signing In...');

        try {
            let userCredential;
            let userPhone;
            let userId;

            if (identifier.includes('@')) {
                // Sign in with email
                userCredential = await auth.signInWithEmailAndPassword(
                    SecurityService.sanitizeInput(identifier), 
                    password
                );
                userId = userCredential.user.uid;
                
                // Get phone from user profile
                const userDoc = await db.collection('parent_users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    userPhone = userData.phone;
                }
            } else {
                // Sign in with phone using perfected search
                const cleanedPhone = PhoneService.cleanPhoneNumber(identifier);
                userPhone = await this.findUserPhoneWithVariations(cleanedPhone, password);
                userId = auth.currentUser?.uid;
            }

            if (!userPhone) {
                throw new Error('Could not retrieve phone number for user');
            }

            // Update last login
            if (userId) {
                await db.collection('parent_users').doc(userId).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Handle Remember Me
            this.handleRememberMe();

            // Clear failed attempts on successful login
            AccountLockoutService.clearFailedAttempts(identifier);

            // Load reports with perfected phone search
            await ReportService.loadAllReportsWithVariations(userPhone, userId);

        } catch (error) {
            // Record failed attempt
            AccountLockoutService.recordFailedAttempt(identifier);
            const remaining = AccountLockoutService.getRemainingAttempts(identifier);
            
            if (remaining <= 2) {
                ErrorHandler.showUserMessage(`Failed attempt. ${remaining} attempts remaining.`, 'error');
            }
            
            ErrorHandler.handleError(error, 'sign in');
        } finally {
            this.setLoadingState(signInBtn, authLoader, false, 'Sign In');
        }
    }

    static async findUserPhoneWithVariations(phone, password) {
        const phoneVariations = PhoneService.normalizePhoneNumber(phone);
        
        for (const phoneVar of phoneVariations) {
            try {
                const userQuery = await db.collection('parent_users')
                    .where('phone', '==', phoneVar)
                    .limit(1)
                    .get();

                if (!userQuery.empty) {
                    const userData = userQuery.docs[0].data();
                    const userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
                    return userData.phone;
                }
            } catch (error) {
                // Continue to next variation
                continue;
            }
        }
        
        throw new Error('No account found with this phone number');
    }

    static async findParentNameWithVariations(parentPhone) {
        const phoneVariations = PhoneService.normalizePhoneNumber(parentPhone);
        
        for (const phoneVar of phoneVariations) {
            const parentName = await this.findParentNameFromStudents(phoneVar);
            if (parentName) {
                console.log(`Found parent name using phone variation: ${phoneVar} -> ${parentName}`);
                return parentName;
            }
        }
        
        console.log("No parent name found with any phone variation");
        return null;
    }

    static async findParentNameFromStudents(parentPhone) {
        try {
            // Search in students collection
            const studentsSnapshot = await db.collection("students")
                .where("parentPhone", "==", parentPhone)
                .limit(1)
                .get();

            if (!studentsSnapshot.empty) {
                const studentData = studentsSnapshot.docs[0].data();
                const parentName = studentData.parentName;
                if (parentName) return parentName;
            }

            // Search in pending_students collection
            const pendingSnapshot = await db.collection("pending_students")
                .where("parentPhone", "==", parentPhone)
                .limit(1)
                .get();

            if (!pendingSnapshot.empty) {
                const pendingData = pendingSnapshot.docs[0].data();
                const parentName = pendingData.parentName;
                if (parentName) return parentName;
            }

            // Search in tutor_submissions collection
            const submissionsSnapshot = await db.collection("tutor_submissions")
                .where("parentPhone", "==", parentPhone)
                .limit(1)
                .get();

            if (!submissionsSnapshot.empty) {
                const submissionData = submissionsSnapshot.docs[0].data();
                const parentName = submissionData.parentName;
                if (parentName) return parentName;
            }

            return null;
        } catch (error) {
            ErrorHandler.handleError(error, 'find parent name');
            return null;
        }
    }

    static async generateReferralCode() {
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

    static setLoadingState(button, loader, isLoading, text) {
        if (button) {
            button.disabled = isLoading;
            button.textContent = text;
        }
        if (loader) {
            isLoading ? loader.classList.remove('hidden') : loader.classList.add('hidden');
        }
    }

    static handleRememberMe() {
        const rememberMe = document.getElementById('rememberMe')?.checked;
        const identifier = document.getElementById('loginIdentifier')?.value.trim();
        
        if (rememberMe && identifier) {
            localStorage.setItem('rememberMe', 'true');
            localStorage.setItem('savedEmail', identifier);
        } else {
            localStorage.removeItem('rememberMe');
            localStorage.removeItem('savedEmail');
        }
    }

    static setupRememberMe() {
        const rememberMe = localStorage.getItem('rememberMe');
        const savedEmail = localStorage.getItem('savedEmail');
        
        if (rememberMe === 'true' && savedEmail) {
            const identifierInput = document.getElementById('loginIdentifier');
            const rememberMeCheckbox = document.getElementById('rememberMe');
            
            if (identifierInput) identifierInput.value = SecurityService.safeTextDisplay(savedEmail);
            if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
        }
    }
}

// =============================================================================
// REPORT SERVICE WITH PAGINATION & PERFORMANCE
// =============================================================================

class ReportService {
    static PAGE_SIZE = 10;
    static currentPage = 0;
    static allReports = [];
    static displayedReports = [];

    static async loadAllReportsWithVariations(parentPhone, userId) {
        const phoneVariations = PhoneService.normalizePhoneNumber(parentPhone);
        console.log("Searching for reports with phone variations:", phoneVariations);
        
        let reportsFound = false;
        
        for (const phoneVar of phoneVariations) {
            console.log(`Trying phone variation: ${phoneVar}`);
            try {
                const hasReports = await this.tryLoadReportsWithPhone(phoneVar, userId);
                if (hasReports) {
                    console.log(`Found reports using phone variation: ${phoneVar}`);
                    reportsFound = true;
                    break;
                }
            } catch (error) {
                console.error(`Error loading reports for variation ${phoneVar}:`, error);
                continue;
            }
        }
        
        if (!reportsFound) {
            ErrorHandler.showUserMessage(
                'No reports found for your account. Please contact Blooming Kids House if you believe this is an error.', 
                'info'
            );
        }
    }

    static async tryLoadReportsWithPhone(parentPhone, userId) {
        const reportArea = document.getElementById("reportArea");
        const reportContent = document.getElementById("reportContent");
        const authArea = document.getElementById("authArea");
        const authLoader = document.getElementById("authLoader");
        const welcomeMessage = document.getElementById("welcomeMessage");

        try {
            // Check cache first
            const cachedData = await this.checkCache(parentPhone, userId);
            if (cachedData) {
                this.displayCachedReports(cachedData, userId);
                return true;
            }

            // Find parent name with smart search
            let parentName = await AuthService.findParentNameWithVariations(parentPhone);
            
            // Get user data
            const userDocRef = db.collection('parent_users').doc(userId);
            const userDoc = await userDocRef.get();
            const userData = userDoc.data();

            // Ensure referral code exists
            if (!userData.referralCode) {
                await this.ensureReferralCode(userDocRef, userData);
            }

            // Set parent name
            parentName = parentName || userData.parentName || 'Parent';
            await this.updateParentNameIfNeeded(userDocRef, parentName, userData);

            // Update app state
            appState.setState({
                user: {
                    data: { ...userData, parentName },
                    children: [],
                    isAuthenticated: true
                }
            });

            // Update welcome message
            if (welcomeMessage) {
                welcomeMessage.textContent = `Welcome, ${SecurityService.safeTextDisplay(parentName)}!`;
            }

            // Load reports with batching for performance
            const reports = await this.loadReportsWithBatching(parentPhone, userData.email);
            
            if (reports.assessments.length === 0 && reports.monthly.length === 0) {
                return false;
            }

            // Store all reports for pagination
            this.allReports = this.combineAndSortReports(reports.assessments, reports.monthly);
            
            // Display first page
            this.displayPaginatedReports(0, userId);
            
            // Cache the results
            this.cacheReports(parentPhone, reportContent.innerHTML, userId);

            // Show main content
            if (authArea && reportArea) {
                authArea.classList.add("hidden");
                reportArea.classList.remove("hidden");
            }

            // Initialize other features
            this.initializePostReportFeatures(userId);

            return true;

        } catch (error) {
            ErrorHandler.handleError(error, 'load reports');
            return false;
        } finally {
            if (authLoader) {
                authLoader.classList.add("hidden");
            }
        }
    }

    static async loadReportsWithBatching(parentPhone, parentEmail) {
        // Batch all database queries for performance
        const queries = [
            // Assessment reports by phone
            db.collection("student_results").where("parentPhone", "==", parentPhone).get(),
            // Assessment reports by email (fallback)
            db.collection("student_results").where("parentEmail", "==", parentEmail).get(),
            // Monthly reports
            db.collection("tutor_submissions").where("parentPhone", "==", parentPhone).get()
        ];

        try {
            const [phoneAssessments, emailAssessments, monthlyReports] = 
                await PerformanceService.batchQueries(queries);

            console.log("📊 Batched query results:", {
                phoneAssessments: phoneAssessments.size,
                emailAssessments: emailAssessments.size,
                monthlyReports: monthlyReports.size
            });

            // Combine assessment results, removing duplicates
            const assessmentMap = new Map();
            
            [...phoneAssessments.docs, ...emailAssessments.docs].forEach(doc => {
                const data = doc.data();
                const key = `${data.studentName}-${data.submittedAt || data.timestamp}`;
                if (!assessmentMap.has(key)) {
                    assessmentMap.set(key, {
                        id: doc.id,
                        ...data,
                        timestamp: data.submittedAt?.seconds || data.timestamp || Date.now() / 1000,
                        type: 'assessment'
                    });
                }
            });

            const assessments = Array.from(assessmentMap.values());
            
            const monthly = monthlyReports.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().submittedAt?.seconds || Date.now() / 1000,
                type: 'monthly'
            }));

            return { assessments, monthly };

        } catch (error) {
            ErrorHandler.handleError(error, 'batch load reports');
            return { assessments: [], monthly: [] };
        }
    }

    static combineAndSortReports(assessments, monthly) {
        const allReports = [...assessments, ...monthly];
        
        // Sort by timestamp (newest first)
        return allReports.sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeB - timeA;
        });
    }

    static displayPaginatedReports(page, userId) {
        const reportContent = document.getElementById("reportContent");
        if (!reportContent) return;

        const startIndex = page * this.PAGE_SIZE;
        const endIndex = startIndex + this.PAGE_SIZE;
        const pageReports = this.allReports.slice(startIndex, endIndex);

        this.currentPage = page;
        this.displayedReports = pageReports;

        // Group reports by student
        const studentsMap = this.groupReportsByStudent(pageReports);
        
        // Generate HTML
        reportContent.innerHTML = this.generateReportsHTML(studentsMap, userId);
        
        // Add pagination controls if needed
        if (this.allReports.length > this.PAGE_SIZE) {
            this.addPaginationControls(reportContent);
        }

        // Initialize charts and lazy loading
        PerformanceService.cleanupCharts();
        this.initializeCharts();
        PerformanceService.lazyLoadImages();
    }

    static groupReportsByStudent(reports) {
        const studentsMap = new Map();
        
        reports.forEach(report => {
            const studentName = report.studentName;
            if (!studentsMap.has(studentName)) {
                studentsMap.set(studentName, { assessments: [], monthly: [] });
            }
            
            if (report.type === 'assessment') {
                studentsMap.get(studentName).assessments.push(report);
            } else {
                studentsMap.get(studentName).monthly.push(report);
            }
        });
        
        return studentsMap;
    }

    static generateReportsHTML(studentsMap, userId) {
        let html = '';
        let studentIndex = 0;

        for (const [studentName, reports] of studentsMap) {
            const fullName = this.capitalize(studentName);
            
            // Student header
            html += `
                <div class="bg-green-100 border-l-4 border-green-600 p-4 rounded-lg mb-6">
                    <h2 class="text-xl font-bold text-green-800">${SecurityService.safeTextDisplay(fullName)}</h2>
                    <p class="text-green-600">Showing reports for ${SecurityService.safeTextDisplay(fullName)}</p>
                </div>
            `;

            // Assessment reports
            if (reports.assessments.length > 0) {
                const uniqueSessions = this.groupAssessmentSessions(reports.assessments);
                html += this.generateAssessmentHTML(uniqueSessions, studentIndex, fullName);
            }
            
            // Monthly reports
            if (reports.monthly.length > 0) {
                const groupedMonthly = this.groupMonthlyReports(reports.monthly);
                html += this.generateMonthlyHTML(groupedMonthly, studentIndex, fullName);
            }
            
            studentIndex++;
        }

        return html;
    }

    static generateAssessmentHTML(sessions, studentIndex, fullName) {
        let html = '';
        let assessmentIndex = 0;

        for (const [sessionKey, session] of sessions) {
            const tutorEmail = session[0].tutorEmail || 'N/A';
            const studentCountry = session[0].studentCountry || 'N/A';
            const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
                dateStyle: 'long',
                timeStyle: 'short'
            });

            const results = this.processAssessmentResults(session);
            const tutorName = 'N/A'; // Would be fetched from tutors collection

            const tableRows = results.map(res => `
                <tr>
                    <td class="border px-2 py-1">${SecurityService.safeTextDisplay(res.subject.toUpperCase())}</td>
                    <td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td>
                </tr>
            `).join("");

            const topicsTableRows = results.map(res => `
                <tr>
                    <td class="border px-2 py-1 font-semibold">${SecurityService.safeTextDisplay(res.subject.toUpperCase())}</td>
                    <td class="border px-2 py-1">${SecurityService.safeTextDisplay(res.topics.join(', ') || 'N/A')}</td>
                </tr>
            `).join("");

            const recommendation = this.generateTemplatedRecommendation(fullName, tutorName, results);
            const creativeWritingAnswer = session[0].answers?.find(a => a.type === 'creative-writing');
            const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.';

            html += `
                <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${assessmentIndex}">
                    <div class="text-center mb-6 border-b pb-4">
                        <img data-src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                             alt="Blooming Kids House Logo" 
                             class="h-16 w-auto mx-auto mb-3 lazy">
                        <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                        <p class="text-gray-600">Date: ${SecurityService.safeTextDisplay(formattedDate)}</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                        <div>
                            <p><strong>Student's Name:</strong> ${SecurityService.safeTextDisplay(fullName)}</p>
                            <p><strong>Parent's Phone:</strong> ${SecurityService.safeTextDisplay(session[0].parentPhone || 'N/A')}</p>
                            <p><strong>Grade:</strong> ${SecurityService.safeTextDisplay(session[0].grade)}</p>
                        </div>
                        <div>
                            <p><strong>Tutor:</strong> ${SecurityService.safeTextDisplay(tutorName || 'N/A')}</p>
                            <p><strong>Location:</strong> ${SecurityService.safeTextDisplay(studentCountry || 'N/A')}</p>
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
                    <p class="mb-2 text-gray-700 leading-relaxed">${SecurityService.safeTextDisplay(recommendation)}</p>

                    ${creativeWritingAnswer ? `
                    <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3>
                    <p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${SecurityService.safeTextDisplay(tutorReport)}</p>
                    ` : ''}

                    ${results.length > 0 ? `
                    <canvas id="chart-${studentIndex}-${assessmentIndex}" class="w-full h-48 mb-4"></canvas>
                    ` : ''}
                    
                    <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                        <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                        <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${SecurityService.safeTextDisplay(fullName)} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                    </div>
                    
                    <div class="mt-6 text-center">
                        <button onclick="ReportService.downloadSessionReport(${studentIndex}, ${assessmentIndex}, '${fullName}', 'assessment')" 
                                class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                            Download Assessment PDF
                        </button>
                    </div>
                </div>
            `;

            assessmentIndex++;
        }

        return html;
    }

    static generateMonthlyHTML(groupedMonthly, studentIndex, fullName) {
        let html = '';
        let monthlyIndex = 0;

        for (const key in groupedMonthly) {
            const session = groupedMonthly[key];
            const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
                dateStyle: 'long',
                timeStyle: 'short'
            });

            session.forEach((monthlyReport, reportIndex) => {
                html += `
                    <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${studentIndex}-${monthlyIndex}">
                        <div class="text-center mb-6 border-b pb-4">
                            <img data-src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                                 alt="Blooming Kids House Logo" 
                                 class="h-16 w-auto mx-auto mb-3 lazy">
                            <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                            <p class="text-gray-600">Date: ${SecurityService.safeTextDisplay(formattedDate)}</p>
                        </div>
                        
                        <!-- Monthly report content would continue here -->
                        <div class="text-center mt-6">
                            <button onclick="ReportService.downloadMonthlyReport(${studentIndex}, ${monthlyIndex}, '${fullName}')" 
                                    class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                Download Monthly Report PDF
                            </button>
                        </div>
                    </div>
                `;
                monthlyIndex++;
            });
        }

        return html;
    }

    static addPaginationControls(container) {
        const totalPages = Math.ceil(this.allReports.length / this.PAGE_SIZE);
        
        const paginationHTML = `
            <div class="flex justify-center items-center space-x-4 mt-8 py-4 border-t">
                <button onclick="ReportService.previousPage()" 
                        ${this.currentPage === 0 ? 'disabled' : ''}
                        class="px-4 py-2 bg-gray-200 rounded-lg ${this.currentPage === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}">
                    Previous
                </button>
                <span class="text-sm text-gray-600">
                    Page ${this.currentPage + 1} of ${totalPages}
                </span>
                <button onclick="ReportService.nextPage()" 
                        ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}
                        class="px-4 py-2 bg-gray-200 rounded-lg ${this.currentPage >= totalPages - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-300'}">
                    Next
                </button>
            </div>
        `;
        
        container.innerHTML += paginationHTML;
    }

    static nextPage() {
        const totalPages = Math.ceil(this.allReports.length / this.PAGE_SIZE);
        if (this.currentPage < totalPages - 1) {
            this.displayPaginatedReports(this.currentPage + 1, appState.state.user.data?.uid);
        }
    }

    static previousPage() {
        if (this.currentPage > 0) {
            this.displayPaginatedReports(this.currentPage - 1, appState.state.user.data?.uid);
        }
    }
    } //

// =============================================================================
// FEEDBACK SERVICE WITH OFFLINE SUPPORT
// =============================================================================

class FeedbackService {
    static OFFLINE_QUEUE_KEY = 'offlineFeedbackQueue';
    static MAX_RETRIES = 3;

    static async submitFeedback() {
        const category = document.getElementById('feedbackCategory')?.value || '';
        const priority = document.getElementById('feedbackPriority')?.value || '';
        const student = document.getElementById('feedbackStudent')?.value || '';
        const message = document.getElementById('feedbackMessage')?.value || '';

        // Validate inputs
        const categoryValidation = ValidationService.validateName(category);
        const priorityValidation = ValidationService.validateName(priority);
        const studentValidation = ValidationService.validateName(student);
        const messageValidation = ValidationService.validateMessage(message, 10);

        if (!categoryValidation.isValid || !priorityValidation.isValid || 
            !studentValidation.isValid || !messageValidation.isValid) {
            ErrorHandler.showUserMessage('Please fill in all required fields correctly', 'error');
            return;
        }

        const submitBtn = document.getElementById('submitFeedbackBtn');
        this.setLoadingState(submitBtn, true, 'Submitting...');

        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Please sign in to submit feedback');
            }

            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            const userData = userDoc.data();

            const feedbackData = {
                parentName: SecurityService.safeTextDisplay(
                    appState.state.user.data?.parentName || userData.parentName || 'Unknown Parent'
                ),
                parentPhone: userData.phone,
                parentEmail: userData.email,
                studentName: SecurityService.safeTextDisplay(student),
                category: category,
                priority: priority,
                message: SecurityService.safeTextDisplay(message),
                status: 'New',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                emailSent: false,
                parentUid: user.uid,
                responses: [],
                retryCount: 0
            };

            // Try to submit online first
            await db.collection('parent_feedback').add(feedbackData);

            ErrorHandler.showUserMessage(
                'Thank you! Your feedback has been submitted successfully. We will respond within 24-48 hours.', 
                'success'
            );
            
            this.hideFeedbackModal();

        } catch (error) {
            if (error.code === 'failed-precondition' || error.message.includes('offline')) {
                // Save to offline queue
                this.queueOfflineFeedback({
                    category, priority, student, message,
                    timestamp: new Date().toISOString(),
                    retryCount: 0
                });
                
                ErrorHandler.showUserMessage(
                    'Feedback saved offline. It will be sent when you are back online.', 
                    'info'
                );
                this.hideFeedbackModal();
            } else {
                ErrorHandler.handleError(error, 'submit feedback');
            }
        } finally {
            this.setLoadingState(submitBtn, false, 'Submit Feedback');
        }
    }

    static queueOfflineFeedback(feedback) {
        try {
            const queue = JSON.parse(localStorage.getItem(this.OFFLINE_QUEUE_KEY) || '[]');
            queue.push(feedback);
            localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(queue));
            
            // Start monitoring for online status
            this.startOfflineSync();
        } catch (error) {
            console.error('Failed to queue offline feedback:', error);
        }
    }

    static async processOfflineQueue() {
        try {
            const queue = JSON.parse(localStorage.getItem(this.OFFLINE_QUEUE_KEY) || '[]');
            if (queue.length === 0) return;

            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            const userData = userDoc.data();

            const successfulSubmissions = [];
            const failedSubmissions = [];

            for (const [index, feedback] of queue.entries()) {
                try {
                    const feedbackData = {
                        parentName: SecurityService.safeTextDisplay(userData.parentName || 'Unknown Parent'),
                        parentPhone: userData.phone,
                        parentEmail: userData.email,
                        studentName: SecurityService.safeTextDisplay(feedback.student),
                        category: feedback.category,
                        priority: feedback.priority,
                        message: SecurityService.safeTextDisplay(feedback.message),
                        status: 'New',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        emailSent: false,
                        parentUid: user.uid,
                        responses: []
                    };

                    await db.collection('parent_feedback').add(feedbackData);
                    successfulSubmissions.push(index);
                    
                } catch (error) {
                    feedback.retryCount = (feedback.retryCount || 0) + 1;
                    
                    if (feedback.retryCount >= this.MAX_RETRIES) {
                        failedSubmissions.push(index);
                    }
                }
            }

            // Remove successful and permanently failed submissions
            const updatedQueue = queue.filter((_, index) => 
                !successfulSubmissions.includes(index) && !failedSubmissions.includes(index)
            );
            
            localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));

            if (successfulSubmissions.length > 0) {
                ErrorHandler.showUserMessage(
                    `${successfulSubmissions.length} offline feedback items submitted successfully.`, 
                    'success'
                );
            }

        } catch (error) {
            ErrorHandler.handleError(error, 'process offline queue');
        }
    }

    static startOfflineSync() {
        // Listen for online status
        window.addEventListener('online', () => {
            this.processOfflineQueue();
        });

        // Also try to process queue periodically
        setInterval(() => {
            if (navigator.onLine) {
                this.processOfflineQueue();
            }
        }, 30000); // Every 30 seconds
    }

    static showFeedbackModal() {
        this.populateStudentDropdown();
        const modal = document.getElementById('feedbackModal');
        if (modal) {
            modal.classList.remove('hidden');
            // Set focus for accessibility
            setTimeout(() => {
                const firstInput = modal.querySelector('input, select, textarea');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    }

    static hideFeedbackModal() {
        const modal = document.getElementById('feedbackModal');
        if (modal) {
            modal.classList.add('hidden');
            // Reset form
            this.resetFeedbackForm();
        }
    }

    static resetFeedbackForm() {
        document.getElementById('feedbackCategory').value = '';
        document.getElementById('feedbackPriority').value = '';
        document.getElementById('feedbackStudent').value = '';
        document.getElementById('feedbackMessage').value = '';
    }

    static populateStudentDropdown() {
        const studentDropdown = document.getElementById('feedbackStudent');
        if (!studentDropdown) return;

        studentDropdown.innerHTML = '<option value="">Select student</option>';
        
        const studentNames = this.getStudentNamesFromReports();
        
        if (studentNames.length === 0) {
            studentDropdown.innerHTML += '<option value="" disabled>No students found - please wait for reports to load</option>';
            return;
        }

        studentNames.forEach(studentName => {
            const option = document.createElement('option');
            option.value = studentName;
            option.textContent = studentName;
            studentDropdown.appendChild(option);
        });
    }

    static getStudentNamesFromReports() {
        const studentHeaders = document.querySelectorAll('[class*="bg-green-100"] h2');
        const studentNames = [];
        
        studentHeaders.forEach(header => {
            const studentName = header.textContent.trim();
            if (studentName && !studentNames.includes(studentName)) {
                studentNames.push(studentName);
            }
        });
        
        return studentNames;
    }

    static setLoadingState(button, isLoading, text) {
        if (button) {
            button.disabled = isLoading;
            button.textContent = text;
        }
    }
}

// =============================================================================
// ADMIN RESPONSES SERVICE WITH NOTIFICATIONS
// =============================================================================

class AdminResponseService {
    static async loadAdminResponses() {
        const responsesContent = document.getElementById('responsesContent');
        if (!responsesContent) return;

        responsesContent.innerHTML = this.getLoadingHTML('Loading responses...');

        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('Please sign in to view responses');
            }

            const feedbackSnapshot = await db.collection('parent_feedback')
                .where('parentUid', '==', user.uid)
                .orderBy('timestamp', 'desc')
                .get();

            if (feedbackSnapshot.empty) {
                responsesContent.innerHTML = this.getEmptyStateHTML();
                return;
            }

            const feedbackWithResponses = this.processFeedbackResponses(feedbackSnapshot);
            
            if (feedbackWithResponses.length === 0) {
                responsesContent.innerHTML = this.getEmptyStateHTML();
                return;
            }

            responsesContent.innerHTML = this.generateResponsesHTML(feedbackWithResponses);

        } catch (error) {
            ErrorHandler.handleError(error, 'load admin responses');
            responsesContent.innerHTML = this.getErrorHTML();
        }
    }

    static processFeedbackResponses(feedbackSnapshot) {
        const feedbackWithResponses = [];
        
        feedbackSnapshot.forEach(doc => {
            const feedback = { id: doc.id, ...doc.data() };
            if (feedback.responses && feedback.responses.length > 0) {
                // Sort responses by date (newest first)
                feedback.responses.sort((a, b) => {
                    const dateA = a.responseDate?.toDate() || new Date(0);
                    const dateB = b.responseDate?.toDate() || new Date(0);
                    return dateB - dateA;
                });
                feedbackWithResponses.push(feedback);
            }
        });

        // Sort feedback by most recent response
        return feedbackWithResponses.sort((a, b) => {
            const dateA = a.responses[0]?.responseDate?.toDate() || new Date(0);
            const dateB = b.responses[0]?.responseDate?.toDate() || new Date(0);
            return dateB - dateA;
        });
    }

    static generateResponsesHTML(feedbackWithResponses) {
        let html = '';

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

                html += `
                    <div class="bg-white border border-gray-200 rounded-xl p-6 mb-4" role="article" aria-label="Admin response">
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex flex-wrap gap-2" role="list">
                                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${this.getCategoryColor(feedback.category)}" role="listitem">
                                    ${SecurityService.safeTextDisplay(feedback.category)}
                                </span>
                                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${this.getPriorityColor(feedback.priority)}" role="listitem">
                                    ${SecurityService.safeTextDisplay(feedback.priority)} Priority
                                </span>
                            </div>
                            <span class="text-sm text-gray-500">${SecurityService.safeTextDisplay(formattedDate)}</span>
                        </div>
                        
                        <div class="mb-4">
                            <h4 class="font-semibold text-gray-800 mb-2">Regarding: ${SecurityService.safeTextDisplay(feedback.studentName)}</h4>
                            <p class="text-gray-700 bg-gray-50 p-4 rounded-lg border">${SecurityService.safeTextDisplay(feedback.message)}</p>
                        </div>
                        
                        <div class="response-bubble bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div class="response-header font-semibold text-blue-800 mb-2">
                                📨 Response from ${SecurityService.safeTextDisplay(response.responderName || 'Admin')}:
                            </div>
                            <p class="text-gray-700 mt-2">${SecurityService.safeTextDisplay(response.responseText)}</p>
                            <div class="text-sm text-gray-500 mt-2">
                                Responded by: ${SecurityService.safeTextDisplay(response.responderName || 'Admin Staff')} 
                                ${response.responderEmail ? `(${SecurityService.safeTextDisplay(response.responderEmail)})` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
        });

        return html;
    }

    static async checkForNewResponses() {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const feedbackSnapshot = await db.collection('parent_feedback')
                .where('parentUid', '==', user.uid)
                .get();

            let totalResponses = 0;
            let newResponses = 0;
            const lastCheck = localStorage.getItem('lastResponseCheck') || 0;
            
            feedbackSnapshot.forEach(doc => {
                const feedback = doc.data();
                if (feedback.responses && feedback.responses.length > 0) {
                    totalResponses += feedback.responses.length;
                    
                    // Check for new responses since last check
                    feedback.responses.forEach(response => {
                        const responseTime = response.responseDate?.toDate()?.getTime() || 0;
                        if (responseTime > lastCheck) {
                            newResponses++;
                        }
                    });
                }
            });

            // Update notification badge
            this.updateNotificationBadge(totalResponses, newResponses > 0);
            
            // Store for next check
            localStorage.setItem('lastResponseCheck', Date.now().toString());

        } catch (error) {
            ErrorHandler.handleError(error, 'check for new responses');
        }
    }

    static updateNotificationBadge(count, isNew = false) {
        let badge = document.getElementById('responseNotificationBadge');
        const viewResponsesBtn = document.getElementById('viewResponsesBtn');
        
        if (!viewResponsesBtn) return;
        
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'responseNotificationBadge';
            badge.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-6 h-6 flex items-center justify-center font-bold';
            badge.setAttribute('aria-live', 'polite');
            viewResponsesBtn.style.position = 'relative';
            viewResponsesBtn.appendChild(badge);
        }
        
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.classList.remove('hidden');
            
            if (isNew) {
                badge.classList.add('animate-pulse');
                // Send browser notification if permitted
                this.sendBrowserNotification(count);
            }
        } else {
            badge.classList.add('hidden');
        }
    }

    static sendBrowserNotification(responseCount) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Blooming Kids House', {
                body: `You have ${responseCount} new response${responseCount > 1 ? 's' : ''} from our team`,
                icon: 'https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg'
            });
        }
    }

    static requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    static showResponsesModal() {
        const modal = document.getElementById('responsesModal');
        if (modal) {
            modal.classList.remove('hidden');
            this.loadAdminResponses();
            this.resetNotificationCount();
            
            // Set focus for accessibility
            setTimeout(() => {
                const closeBtn = modal.querySelector('button[aria-label="Close modal"]');
                if (closeBtn) closeBtn.focus();
            }, 100);
        }
    }

    static hideResponsesModal() {
        const modal = document.getElementById('responsesModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    static resetNotificationCount() {
        this.updateNotificationBadge(0);
        appState.setState({
            ui: {
                ...appState.state.ui,
                notifications: { unreadResponses: 0, showBadge: false }
            }
        });
    }

    static getCategoryColor(category) {
        const colors = {
            'Feedback': 'bg-blue-100 text-blue-800',
            'Request': 'bg-green-100 text-green-800',
            'Complaint': 'bg-red-100 text-red-800',
            'Suggestion': 'bg-purple-100 text-purple-800'
        };
        return colors[category] || 'bg-gray-100 text-gray-800';
    }

    static getPriorityColor(priority) {
        const colors = {
            'Low': 'bg-gray-100 text-gray-800',
            'Medium': 'bg-yellow-100 text-yellow-800',
            'High': 'bg-orange-100 text-orange-800',
            'Urgent': 'bg-red-100 text-red-800'
        };
        return colors[priority] || 'bg-gray-100 text-gray-800';
    }

    static getLoadingHTML(message) {
        return `
            <div class="text-center py-8">
                <div class="loading-spinner mx-auto" style="width: 40px; height: 40px;" aria-label="Loading"></div>
                <p class="text-green-600 font-semibold mt-4">${message}</p>
            </div>
        `;
    }

    static getEmptyStateHTML() {
        return `
            <div class="text-center py-12" role="status" aria-label="No responses">
                <div class="text-6xl mb-4" aria-hidden="true">📭</div>
                <h3 class="text-xl font-bold text-gray-700 mb-2">No Responses Yet</h3>
                <p class="text-gray-500 max-w-md mx-auto">You haven't received any responses from our staff yet. We'll respond to your feedback within 24-48 hours.</p>
            </div>
        `;
    }

    static getErrorHTML() {
        return `
            <div class="text-center py-8" role="alert" aria-label="Error loading responses">
                <div class="text-4xl mb-4" aria-hidden="true">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Responses</h3>
                <p class="text-gray-500">Unable to load responses at this time. Please try again later.</p>
            </div>
        `;
    }
}

// =============================================================================
// REFERRAL REWARDS SERVICE
// =============================================================================

class ReferralService {
    static async loadReferralRewards(parentUid) {
        const rewardsContent = document.getElementById('rewardsContent');
        if (!rewardsContent) return;

        rewardsContent.innerHTML = AdminResponseService.getLoadingHTML('Loading rewards data...');

        try {
            const userDoc = await db.collection('parent_users').doc(parentUid).get();
            if (!userDoc.exists) {
                rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found. Please sign in again.</p>';
                return;
            }

            const userData = userDoc.data();
            const referralCode = userData.referralCode || 'N/A';
            const totalEarnings = userData.referralEarnings || 0;

            // Batch transactions query with error handling
            let transactionsSnapshot;
            try {
                transactionsSnapshot = await db.collection('referral_transactions')
                    .where('ownerUid', '==', parentUid)
                    .orderBy('timestamp', 'desc')
                    .get();
            } catch (error) {
                console.warn('Could not load referral transactions:', error);
                transactionsSnapshot = { empty: true, forEach: () => {} };
            }

            const { referralsHtml, pendingCount, approvedCount, paidCount } = 
                this.processTransactions(transactionsSnapshot);

            rewardsContent.innerHTML = this.generateRewardsHTML(
                referralCode, totalEarnings, referralsHtml, pendingCount, approvedCount, paidCount
            );

        } catch (error) {
            ErrorHandler.handleError(error, 'load referral rewards');
            rewardsContent.innerHTML = `
                <p class="text-red-500 text-center py-8">
                    An error occurred while loading your rewards data. Please try again later.
                </p>
            `;
        }
    }

    static processTransactions(transactionsSnapshot) {
        let referralsHtml = '';
        let pendingCount = 0;
        let approvedCount = 0;
        let paidCount = 0;

        if (transactionsSnapshot.empty) {
            referralsHtml = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-gray-500" role="cell">
                        No one has used your referral code yet.
                    </td>
                </tr>
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

                const referredName = this.capitalize(
                    SecurityService.safeTextDisplay(data.referredStudentName || data.referredStudentPhone)
                );
                const rewardAmount = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
                const referralDate = data.timestamp?.toDate().toLocaleDateString('en-US', { 
                    year: 'numeric', month: 'short', day: 'numeric' 
                }) || 'N/A';

                referralsHtml += `
                    <tr class="hover:bg-gray-50" role="row">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900" role="cell">${referredName}</td>
                        <td class="px-4 py-3 text-sm text-gray-500" role="cell">${referralDate}</td>
                        <td class="px-4 py-3 text-sm" role="cell">
                            <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}" role="status">
                                ${this.capitalize(status)}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold" role="cell">${rewardAmount}</td>
                    </tr>
                `;
            });
        }

        return { referralsHtml, pendingCount, approvedCount, paidCount };
    }

    static generateRewardsHTML(referralCode, totalEarnings, referralsHtml, pendingCount, approvedCount, paidCount) {
        return `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md" role="region" aria-label="Your Referral Code">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all" 
                   role="text" aria-label="Referral code: ${referralCode}">
                    ${SecurityService.safeTextDisplay(referralCode)}
                </p>
                <p class="text-blue-700 mt-2">
                    Share this code with other parents. They use it when registering their child, and you earn <strong>₦5,000</strong> once their child completes their first month!
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" role="list">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600" role="listitem">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600" role="listitem">
                    <p class="text-sm font-medium text-yellow-700">Approved Rewards (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600" role="listitem">
                    <p class="text-sm font-medium text-gray-700">Total Successful Referrals (Paid)</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>

            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow" role="region" aria-label="Referral History">
                <table class="min-w-full divide-y divide-gray-200" role="table">
                    <thead class="bg-gray-50" role="rowgroup">
                        <tr role="row">
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader">Referred Parent/Student</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader">Date Used</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader">Status</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" role="columnheader">Reward</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200" role="rowgroup">
                        ${referralsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    static capitalize(str) {
        if (!str) return "";
        return str.replace(/\b\w/g, l => l.toUpperCase());
    }
}

// =============================================================================
// ACCESSIBILITY SERVICE
// =============================================================================

class AccessibilityService {
    static init() {
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.setupScreenReaderSupport();
        this.setupColorContrast();
    }

    static setupKeyboardNavigation() {
        // Trap focus in modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCurrentModal();
            }
            
            if (e.key === 'Tab') {
                this.handleTabInModal(e);
            }
        });

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        this.switchToTab('reports');
                        break;
                    case '2':
                        e.preventDefault();
                        this.switchToTab('rewards');
                        break;
                    case '?':
                        e.preventDefault();
                        this.showKeyboardShortcuts();
                        break;
                }
            }
        });
    }

    static setupFocusManagement() {
        // When modals open, move focus to first interactive element
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList?.contains('modal')) {
                        const firstInput = node.querySelector('input, select, textarea, button');
                        if (firstInput) {
                            setTimeout(() => firstInput.focus(), 100);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    static setupScreenReaderSupport() {
        // Add ARIA live regions for dynamic content
        const liveRegion = document.createElement('div');
        liveRegion.id = 'aria-live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);

        // Announce page changes
        appState.subscribe((state) => {
            if (state.ui.activeTab) {
                this.announce(`Switched to ${state.ui.activeTab} tab`);
            }
        });
    }

    static setupColorContrast() {
        // Ensure sufficient color contrast
        const style = document.createElement('style');
        style.textContent = `
            .sr-only {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            }
            
            .focus-visible:focus {
                outline: 2px solid #3b82f6;
                outline-offset: 2px;
            }
            
            @media (prefers-reduced-motion: reduce) {
                * {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    static announce(message) {
        const liveRegion = document.getElementById('aria-live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
        }
    }

    static handleTabInModal(e) {
        const modal = document.querySelector('.modal:not(.hidden)');
        if (!modal) return;

        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }

    static closeCurrentModal() {
        const openModal = document.querySelector('.modal:not(.hidden)');
        if (openModal) {
            openModal.classList.add('hidden');
            this.announce('Modal closed');
        }
    }

    static switchToTab(tabName) {
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.click();
            this.announce(`Switched to ${tabName} tab`);
        }
    }

    static showKeyboardShortcuts() {
        const shortcuts = [
            { key: 'Ctrl+1', action: 'Switch to Reports tab' },
            { key: 'Ctrl+2', action: 'Switch to Rewards tab' },
            { key: 'Escape', action: 'Close modal' },
            { key: 'Ctrl+?', action: 'Show this help' }
        ];

        let helpText = 'Keyboard shortcuts:\n';
        shortcuts.forEach(shortcut => {
            helpText += `${shortcut.key}: ${shortcut.action}\n`;
        });

        alert(helpText);
    }
}

// =============================================================================
// PROFILE MANAGEMENT SERVICE
// =============================================================================

class ProfileService {
    static async showProfileModal() {
        const modal = document.getElementById('profileModal');
        if (!modal) return;

        await this.loadProfileData();
        modal.classList.remove('hidden');
        
        // Set focus for accessibility
        setTimeout(() => {
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    static hideProfileModal() {
        const modal = document.getElementById('profileModal');
        if (modal) {
            modal.classList.add('hidden');
            this.resetProfileForm();
        }
    }

    static async loadProfileData() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                this.populateProfileForm(userData);
            }
        } catch (error) {
            ErrorHandler.handleError(error, 'load profile data');
        }
    }

    static populateProfileForm(userData) {
        const fields = {
            'profileName': userData.parentName || '',
            'profileEmail': userData.email || '',
            'profilePhone': PhoneService.formatPhoneForDisplay(userData.phone) || ''
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.value = SecurityService.safeTextDisplay(value);
            }
        });
    }

    static resetProfileForm() {
        const fields = ['profileName', 'profileEmail', 'profilePhone'];
        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) element.value = '';
        });
    }

    static async updateProfile() {
        const name = document.getElementById('profileName')?.value.trim() || '';
        const email = document.getElementById('profileEmail')?.value.trim() || '';
        const phone = document.getElementById('profilePhone')?.value.trim() || '';

        // Validate inputs
        const nameValidation = ValidationService.validateName(name);
        const emailValidation = ValidationService.validateEmail(email);
        const phoneValidation = ValidationService.validatePhone(phone);

        if (!nameValidation.isValid || !emailValidation.isValid || !phoneValidation.isValid) {
            ErrorHandler.showUserMessage('Please check your profile information', 'error');
            return;
        }

        const updateBtn = document.getElementById('updateProfileBtn');
        this.setLoadingState(updateBtn, true, 'Updating...');

        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Please sign in to update profile');

            const cleanedPhone = PhoneService.cleanPhoneNumber(phone);
            const updates = {
                parentName: SecurityService.safeTextDisplay(name),
                phone: cleanedPhone,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Update email in Firebase Auth if changed
            if (email !== user.email) {
                await user.updateEmail(email);
                updates.email = SecurityService.safeTextDisplay(email);
            }

            // Update Firestore document
            await db.collection('parent_users').doc(user.uid).update(updates);

            // Update app state
            appState.setState({
                user: {
                    ...appState.state.user,
                    data: { ...appState.state.user.data, ...updates }
                }
            });

            // Update welcome message
            const welcomeMessage = document.getElementById('welcomeMessage');
            if (welcomeMessage) {
                welcomeMessage.textContent = `Welcome, ${SecurityService.safeTextDisplay(name)}!`;
            }

            ErrorHandler.showUserMessage('Profile updated successfully!', 'success');
            this.hideProfileModal();

        } catch (error) {
            ErrorHandler.handleError(error, 'update profile');
        } finally {
            this.setLoadingState(updateBtn, false, 'Update Profile');
        }
    }

    static setLoadingState(button, isLoading, text) {
        if (button) {
            button.disabled = isLoading;
            button.textContent = text;
        }
    }
}

// =============================================================================
// SMART CACHE SERVICE
// =============================================================================

class CacheService {
    static CACHE_VERSION = '2.0';
    static MAX_CACHE_SIZE = 50; // MB
    static CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

    static async getCachedReports(parentPhone) {
        const cacheKey = `reportCache_${parentPhone}_v${this.CACHE_VERSION}`;
        
        try {
            const cachedItem = localStorage.getItem(cacheKey);
            if (!cachedItem) return null;

            const { timestamp, html, chartConfigs, userData, version } = JSON.parse(cachedItem);
            
            // Check if cache is valid
            if (this.isCacheValid(timestamp, version)) {
                console.log("Loading reports from cache");
                return { html, chartConfigs, userData };
            } else {
                // Clear expired cache
                localStorage.removeItem(cacheKey);
                return null;
            }
        } catch (error) {
            console.error("Cache read error:", error);
            return null;
        }
    }

    static async cacheReports(parentPhone, html, chartConfigs, userData) {
        const cacheKey = `reportCache_${parentPhone}_v${this.CACHE_VERSION}`;
        
        try {
            const cacheItem = {
                timestamp: Date.now(),
                html,
                chartConfigs,
                userData,
                version: this.CACHE_VERSION
            };

            // Check cache size before storing
            if (await this.isCacheWithinLimits(cacheItem)) {
                localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
                console.log("Reports cached successfully");
            } else {
                await this.cleanupOldCache();
                localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
            }
        } catch (error) {
            console.error("Cache write error:", error);
        }
    }

    static isCacheValid(timestamp, version) {
        const isFresh = Date.now() - timestamp < this.CACHE_DURATION;
        const isCurrentVersion = version === this.CACHE_VERSION;
        return isFresh && isCurrentVersion;
    }

    static async isCacheWithinLimits(newItem) {
        try {
            let totalSize = 0;
            const newItemSize = JSON.stringify(newItem).length;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('reportCache_')) {
                    const item = localStorage.getItem(key);
                    totalSize += item.length;
                }
            }

            totalSize += newItemSize;
            const sizeInMB = totalSize / (1024 * 1024);
            
            return sizeInMB <= this.MAX_CACHE_SIZE;
        } catch (error) {
            return false;
        }
    }

    static async cleanupOldCache() {
        try {
            const cacheItems = [];
            
            // Collect all cache items
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('reportCache_')) {
                    const item = localStorage.getItem(key);
                    const data = JSON.parse(item);
                    cacheItems.push({ key, timestamp: data.timestamp, size: item.length });
                }
            }

            // Sort by timestamp (oldest first)
            cacheItems.sort((a, b) => a.timestamp - b.timestamp);

            // Remove oldest items until under limit
            let totalSize = cacheItems.reduce((sum, item) => sum + item.size, 0);
            let sizeInMB = totalSize / (1024 * 1024);

            while (sizeInMB > this.MAX_CACHE_SIZE && cacheItems.length > 0) {
                const oldest = cacheItems.shift();
                localStorage.removeItem(oldest.key);
                totalSize -= oldest.size;
                sizeInMB = totalSize / (1024 * 1024);
            }

            console.log(`Cache cleanup completed. Current size: ${sizeInMB.toFixed(2)}MB`);
        } catch (error) {
            console.error("Cache cleanup error:", error);
        }
    }

    static async preloadCommonData() {
        // Preload common images
        const images = [
            'https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg'
        ];

        images.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }
}

// =============================================================================
// SEARCH AND FILTER SERVICE
// =============================================================================

class SearchService {
    static init() {
        this.setupSearchInput();
        this.setupFilterControls();
    }

    static setupSearchInput() {
        const searchInput = document.getElementById('reportSearch');
        if (!searchInput) return;

        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 300);
        });

        // Add clear button functionality
        const clearButton = searchInput.parentNode.querySelector('.clear-search');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                searchInput.value = '';
                this.clearSearch();
            });
        }
    }

    static setupFilterControls() {
        const filterSelect = document.getElementById('reportFilter');
        if (!filterSelect) return;

        filterSelect.addEventListener('change', (e) => {
            this.applyFilters(e.target.value);
        });
    }

    static performSearch(query) {
        if (!query.trim()) {
            this.clearSearch();
            return;
        }

        const searchTerm = query.toLowerCase().trim();
        const reportBlocks = document.querySelectorAll('[class*="block-"]');
        let resultsFound = 0;

        reportBlocks.forEach(block => {
            const textContent = block.textContent.toLowerCase();
            const isMatch = textContent.includes(searchTerm);
            
            if (isMatch) {
                block.style.display = 'block';
                this.highlightText(block, searchTerm);
                resultsFound++;
            } else {
                block.style.display = 'none';
            }
        });

        this.showSearchResults(resultsFound, searchTerm);
    }

    static highlightText(element, searchTerm) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.textContent.toLowerCase().includes(searchTerm)) {
                nodes.push(node);
            }
        }

        nodes.forEach(node => {
            const span = document.createElement('span');
            span.className = 'bg-yellow-200 text-yellow-900 px-1 rounded';
            span.textContent = node.textContent;
            node.parentNode.replaceChild(span, node);
        });
    }

    static applyFilters(filterType) {
        const reportBlocks = document.querySelectorAll('[class*="block-"]');
        
        reportBlocks.forEach(block => {
            switch (filterType) {
                case 'assessments':
                    block.style.display = block.id.includes('assessment') ? 'block' : 'none';
                    break;
                case 'monthly':
                    block.style.display = block.id.includes('monthly') ? 'block' : 'none';
                    break;
                case 'recent':
                    // Show only reports from last 30 days
                    const reportDate = this.extractReportDate(block);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    block.style.display = reportDate >= thirtyDaysAgo ? 'block' : 'none';
                    break;
                default:
                    block.style.display = 'block';
            }
        });

        AccessibilityService.announce(`Filtered by ${filterType}`);
    }

    static extractReportDate(block) {
        const dateElement = block.querySelector('.text-gray-600');
        if (dateElement) {
            const dateText = dateElement.textContent;
            return new Date(dateText.replace('Date: ', ''));
        }
        return new Date(0);
    }

    static clearSearch() {
        // Remove highlights
        document.querySelectorAll('.bg-yellow-200').forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });

        // Show all reports
        document.querySelectorAll('[class*="block-"]').forEach(block => {
            block.style.display = 'block';
        });

        // Hide search results info
        const resultsInfo = document.getElementById('searchResultsInfo');
        if (resultsInfo) {
            resultsInfo.classList.add('hidden');
        }
    }

    static showSearchResults(count, term) {
        let resultsInfo = document.getElementById('searchResultsInfo');
        if (!resultsInfo) {
            resultsInfo = document.createElement('div');
            resultsInfo.id = 'searchResultsInfo';
            resultsInfo.className = 'bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded';
            
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                searchContainer.parentNode.insertBefore(resultsInfo, searchContainer.nextSibling);
            }
        }

        if (count === 0) {
            resultsInfo.innerHTML = `
                <p class="text-blue-700">
                    No results found for "<strong>${SecurityService.safeTextDisplay(term)}</strong>".
                    Try different keywords or check the spelling.
                </p>
            `;
        } else {
            resultsInfo.innerHTML = `
                <p class="text-blue-700">
                    Found <strong>${count}</strong> result${count === 1 ? '' : 's'} for "<strong>${SecurityService.safeTextDisplay(term)}</strong>".
                </p>
            `;
        }

        resultsInfo.classList.remove('hidden');
        AccessibilityService.announce(`Found ${count} results for ${term}`);
    }
}

// =============================================================================
// DARK MODE SERVICE
// =============================================================================

class DarkModeService {
    static init() {
        this.loadPreference();
        this.setupToggle();
        this.applyTheme();
    }

    static loadPreference() {
        const saved = localStorage.getItem('darkMode');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        appState.setState({
            ui: {
                ...appState.state.ui,
                darkMode: saved ? saved === 'true' : prefersDark
            }
        });
    }

    static setupToggle() {
        const toggle = document.getElementById('darkModeToggle');
        if (!toggle) return;

        toggle.addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // Update toggle state when theme changes
        appState.subscribe((state) => {
            if (toggle) {
                toggle.textContent = state.ui.darkMode ? '☀️' : '🌙';
                toggle.setAttribute('aria-label', state.ui.darkMode ? 'Switch to light mode' : 'Switch to dark mode');
            }
        });
    }

    static toggleDarkMode() {
        const newMode = !appState.state.ui.darkMode;
        
        appState.setState({
            ui: {
                ...appState.state.ui,
                darkMode: newMode
            }
        });

        localStorage.setItem('darkMode', newMode.toString());
        this.applyTheme();
        
        AccessibilityService.announce(`Switched to ${newMode ? 'dark' : 'light'} mode`);
    }

    static applyTheme() {
        const isDark = appState.state.ui.darkMode;
        
        if (isDark) {
            document.documentElement.classList.add('dark');
            document.body.classList.add('bg-gray-900', 'text-gray-100');
        } else {
            document.documentElement.classList.remove('dark');
            document.body.classList.remove('bg-gray-900', 'text-gray-100');
        }

        // Update meta theme color
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', isDark ? '#1f2937' : '#ffffff');
        }
    }
}

// =============================================================================
// PULL TO REFRESH SERVICE
// =============================================================================

class PullToRefreshService {
    static init() {
        if (!this.isTouchDevice()) return;

        let startY;
        const container = document.getElementById('reportContentArea');

        if (!container) return;

        container.addEventListener('touchstart', (e) => {
            startY = e.touches[0].pageY;
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!startY) return;

            const y = e.touches[0].pageY;
            const refreshThreshold = 80;

            if (y > startY + refreshThreshold && window.scrollY === 0) {
                this.triggerRefresh();
                startY = null;
            }
        }, { passive: true });
    }

    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    static async triggerRefresh() {
        const user = auth.currentUser;
        if (!user) return;

        // Show refresh indicator
        this.showRefreshIndicator();

        try {
            // Clear cache to force fresh data
            await CacheService.cleanupOldCache();
            
            // Reload reports
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                await ReportService.loadAllReportsWithVariations(userData.phone, user.uid);
            }

            ErrorHandler.showUserMessage('Reports refreshed successfully', 'success');
        } catch (error) {
            ErrorHandler.handleError(error, 'pull to refresh');
        } finally {
            this.hideRefreshIndicator();
        }
    }

    static showRefreshIndicator() {
        let indicator = document.getElementById('refreshIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'refreshIndicator';
            indicator.className = 'fixed top-0 left-0 right-0 bg-blue-500 text-white text-center py-2 z-50';
            indicator.textContent = 'Refreshing reports...';
            document.body.appendChild(indicator);
        }
        
        indicator.classList.remove('hidden');
    }

    static hideRefreshIndicator() {
        const indicator = document.getElementById('refreshIndicator');
        if (indicator) {
            setTimeout(() => {
                indicator.classList.add('hidden');
            }, 1000);
        }
    }
}

// =============================================================================
// MAIN APPLICATION INITIALIZATION
// =============================================================================

class ParentPortalApp {
    static async init() {
        try {
            // Initialize core services
            this.initializeServices();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Check authentication state
            this.setupAuthStateListener();
            
            // Preload common data
            await CacheService.preloadCommonData();
            
            // Request notification permission
            AdminResponseService.requestNotificationPermission();

            console.log('Parent Portal initialized successfully');

        } catch (error) {
            ErrorHandler.handleError(error, 'app initialization');
        }
    }

    static initializeServices() {
        // State management
        appState.subscribe(this.handleStateChange.bind(this));
        
        // Security services
        SessionService.init();
        AccountLockoutService.clearFailedAttempts(); // Clean up on app start
        
        // UX services
        AccessibilityService.init();
        DarkModeService.init();
        SearchService.init();
        PullToRefreshService.init();
        
        // Offline support
        FeedbackService.startOfflineSync();
    }

    static setupEventListeners() {
        // Authentication
        document.getElementById('signInBtn')?.addEventListener('click', () => AuthService.handleSignIn());
        document.getElementById('signUpBtn')?.addEventListener('click', () => AuthService.handleSignUp());
        document.getElementById('sendResetBtn')?.addEventListener('click', () => this.handlePasswordReset());
        document.getElementById('submitFeedbackBtn')?.addEventListener('click', () => FeedbackService.submitFeedback());
        
        // Navigation
        document.getElementById('signInTab')?.addEventListener('click', () => this.switchTab('signin'));
        document.getElementById('signUpTab')?.addEventListener('click', () => this.switchTab('signup'));
        document.getElementById('reportTab')?.addEventListener('click', () => this.switchMainTab('reports'));
        document.getElementById('rewardsTab')?.addEventListener('click', () => this.switchMainTab('rewards'));
        
        // Modals
        document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => this.showModal('passwordResetModal'));
        document.getElementById('cancelResetBtn')?.addEventListener('click', () => this.hideModal('passwordResetModal'));
        document.getElementById('feedbackBtn')?.addEventListener('click', () => FeedbackService.showFeedbackModal());
        document.getElementById('closeFeedbackBtn')?.addEventListener('click', () => FeedbackService.hideFeedbackModal());
        document.getElementById('viewResponsesBtn')?.addEventListener('click', () => AdminResponseService.showResponsesModal());
        document.getElementById('closeResponsesBtn')?.addEventListener('click', () => AdminResponseService.hideResponsesModal());
        document.getElementById('profileBtn')?.addEventListener('click', () => ProfileService.showProfileModal());
        document.getElementById('closeProfileBtn')?.addEventListener('click', () => ProfileService.hideProfileModal());
        document.getElementById('updateProfileBtn')?.addEventListener('click', () => ProfileService.updateProfile());
        
        // Remember me
        document.getElementById('rememberMe')?.addEventListener('change', () => AuthService.handleRememberMe());
        
        // Password strength
        const passwordInput = document.getElementById('signupPassword');
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => {
                PasswordService.updatePasswordStrengthUI(e.target.value);
            });
        }

        // Enter key support
        this.setupEnterKeySupport();
    }

    static setupAuthStateListener() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in
                const userDoc = await db.collection('parent_users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    appState.setState({
                        user: {
                            data: userData,
                            children: [],
                            isAuthenticated: true
                        }
                    });

                    // Load user's reports
                    await ReportService.loadAllReportsWithVariations(userData.phone, user.uid);
                    
                    // Check for new responses
                    await AdminResponseService.checkForNewResponses();
                    
                    // Set up periodic response checking
                    setInterval(() => {
                        AdminResponseService.checkForNewResponses();
                    }, 300000); // Every 5 minutes
                }
            } else {
                // User is signed out
                appState.setState({
                    user: {
                        data: null,
                        children: [],
                        isAuthenticated: false
                    },
                    ui: {
                        ...appState.state.ui,
                        notifications: { unreadResponses: 0, showBadge: false }
                    }
                });
                
                PerformanceService.cleanupCharts();
            }
        });
    }

    static handleStateChange(state) {
        // Update UI based on state changes
        this.updateUI(state);
    }

    static updateUI(state) {
        // Update active tabs
        this.updateTabStates(state.ui.activeTab);
        
        // Update notification badge
        if (state.ui.notifications.showBadge) {
            AdminResponseService.updateNotificationBadge(state.ui.notifications.unreadResponses, true);
        }
        
        // Update welcome message
        if (state.user.data?.parentName) {
            const welcomeMessage = document.getElementById('welcomeMessage');
            if (welcomeMessage) {
                welcomeMessage.textContent = `Welcome, ${SecurityService.safeTextDisplay(state.user.data.parentName)}!`;
            }
        }
    }

    static switchTab(tab) {
        const signInTab = document.getElementById('signInTab');
        const signUpTab = document.getElementById('signUpTab');
        const signInForm = document.getElementById('signInForm');
        const signUpForm = document.getElementById('signUpForm');

        if (tab === 'signin') {
            signInTab?.classList.remove('tab-inactive');
            signInTab?.classList.add('tab-active');
            signUpTab?.classList.remove('tab-active');
            signUpTab?.classList.add('tab-inactive');
            signInForm?.classList.remove('hidden');
            signUpForm?.classList.add('hidden');
        } else {
            signUpTab?.classList.remove('tab-inactive');
            signUpTab?.classList.add('tab-active');
            signInTab?.classList.remove('tab-active');
            signInTab?.classList.add('tab-inactive');
            signUpForm?.classList.remove('hidden');
            signInForm?.classList.add('hidden');
        }
    }

    static switchMainTab(tab) {
        const reportTab = document.getElementById('reportTab');
        const rewardsTab = document.getElementById('rewardsTab');
        const reportContentArea = document.getElementById('reportContentArea');
        const rewardsContentArea = document.getElementById('rewardsContentArea');

        // Update tab states
        reportTab?.classList.remove('tab-active-main');
        reportTab?.classList.add('tab-inactive-main');
        rewardsTab?.classList.remove('tab-active-main');
        rewardsTab?.classList.add('tab-inactive-main');

        // Hide all content areas
        reportContentArea?.classList.add('hidden');
        rewardsContentArea?.classList.add('hidden');

        // Activate selected tab
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
                ReferralService.loadReferralRewards(user.uid);
            }
        }

        appState.setState({
            ui: { ...appState.state.ui, activeTab: tab }
        });

        AccessibilityService.announce(`Switched to ${tab} tab`);
    }

    static updateTabStates(activeTab) {
        // This would update visual states of tabs based on current active tab
        // Implementation depends on your specific CSS classes
    }

    static async handlePasswordReset() {
        const email = document.getElementById('resetEmail')?.value.trim() || '';
        
        if (!email) {
            ErrorHandler.showUserMessage('Please enter your email address', 'error');
            return;
        }

        const emailValidation = ValidationService.validateEmail(email);
        if (!emailValidation.isValid) {
            ErrorHandler.showUserMessage(emailValidation.message, 'error');
            return;
        }

        const sendResetBtn = document.getElementById('sendResetBtn');
        const resetLoader = document.getElementById('resetLoader');

        this.setLoadingState(sendResetBtn, resetLoader, true);

        try {
            await auth.sendPasswordResetEmail(SecurityService.sanitizeInput(email));
            ErrorHandler.showUserMessage('Password reset link sent to your email. Please check your inbox.', 'success');
            this.hideModal('passwordResetModal');
        } catch (error) {
            ErrorHandler.handleError(error, 'password reset');
        } finally {
            this.setLoadingState(sendResetBtn, resetLoader, false);
        }
    }

    static setLoadingState(button, loader, isLoading) {
        if (button) button.disabled = isLoading;
        if (loader) {
            isLoading ? loader.classList.remove('hidden') : loader.classList.add('hidden');
        }
    }

    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            AccessibilityService.announce(`${modalId} modal opened`);
        }
    }

    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            AccessibilityService.announce(`${modalId} modal closed`);
        }
    }

    static setupEnterKeySupport() {
        // Sign in form
        document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') AuthService.handleSignIn();
        });
        
        // Sign up form
        document.getElementById('signupConfirmPassword')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') AuthService.handleSignUp();
        });
        
        // Password reset form
        document.getElementById('resetEmail')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handlePasswordReset();
        });
        
        // Feedback form
        document.getElementById('feedbackMessage')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                FeedbackService.submitFeedback();
            }
        });
    }

    static logout() {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
        PerformanceService.cleanupCharts();
        
        auth.signOut().then(() => {
            window.location.reload();
        });
    }
}

// =============================================================================
// GLOBAL FUNCTIONS FOR HTML EVENT HANDLERS
// =============================================================================

// Make essential functions globally available for HTML onclick handlers
window.downloadSessionReport = (studentIndex, sessionIndex, studentName, type) => {
    ReportService.downloadSessionReport(studentIndex, sessionIndex, studentName, type);
};

window.downloadMonthlyReport = (studentIndex, monthlyIndex, studentName) => {
    ReportService.downloadMonthlyReport(studentIndex, monthlyIndex, studentName);
};

window.logout = () => {
    ParentPortalApp.logout();
};

// =============================================================================
// APPLICATION STARTUP
// =============================================================================

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Setup Remember Me
    AuthService.setupRememberMe();
    
    // Initialize the main application
    ParentPortalApp.init();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    PerformanceService.cleanupCharts();
});

// Service Worker registration for offline support (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('SW registered: ', registration);
        }).catch(function(registrationError) {
            console.log('SW registration failed: ', registrationError);
        });
    });
}

// =============================================================================
// COMPREHENSIVE PARENT.JS UPDATE COMPLETE
// =============================================================================

