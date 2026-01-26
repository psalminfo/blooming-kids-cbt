// ============================================================================
// BLOOMING KIDS HOUSE PARENT PORTAL
// World-Class Edition - Optimized for Global Scale & Stability
// ============================================================================

// Firebase Configuration
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

// ============================================================================
// SECTION 1: GLOBAL CONFIGURATION & UTILITIES
// ============================================================================

// WORLD-CLASS PHONE MATCHING: UNIVERSAL SUFFIX MATCH
function comparePhonesByUniversalSuffix(phone1, phone2) {
    if (!phone1 || !phone2) return false;
    
    try {
        // Extract only digits
        const digits1 = phone1.toString().replace(/\D/g, '');
        const digits2 = phone2.toString().replace(/\D/g, '');
        
        if (!digits1 || !digits2) return false;
        
        // CRITICAL FIX: Compare last 10 digits only (Universal Suffix Match)
        // This handles all international/local format mismatches
        const suffix1 = digits1.slice(-10);
        const suffix2 = digits2.slice(-10);
        
        return suffix1 === suffix2;
    } catch (error) {
        console.warn("Universal suffix match error:", error);
        return false;
    }
}

// Extract last 10 digits for matching (used throughout)
function extractPhoneSuffix(phone) {
    if (!phone) return '';
    const digits = phone.toString().replace(/\D/g, '');
    return digits.slice(-10) || digits; // Last 10 digits or all if less
}

// Enhanced phone normalization with suffix preservation
function normalizePhoneNumberGlobal(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, valid: false, error: 'Invalid input' };
    }

    try {
        // Clean the phone number
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        if (!cleaned) {
            return { normalized: null, valid: false, error: 'Empty phone number' };
        }
        
        // If starts with +, keep as is
        if (cleaned.startsWith('+')) {
            cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
            return {
                normalized: cleaned,
                suffix: extractPhoneSuffix(cleaned),
                valid: true,
                error: null
            };
        } else {
            // Remove leading zeros for international compatibility
            cleaned = cleaned.replace(/^0+/, '');
            
            // Determine if we need to add country code
            if (cleaned.length <= 10) {
                // Local number, add +1 as default
                cleaned = '+1' + cleaned;
            } else if (cleaned.length > 10 && !cleaned.startsWith('1')) {
                // Already has country code without +
                cleaned = '+' + cleaned;
            } else {
                // Default to +1
                cleaned = '+1' + cleaned;
            }
            
            return {
                normalized: cleaned,
                suffix: extractPhoneSuffix(cleaned),
                valid: true,
                error: null
            };
        }
    } catch (error) {
        console.error("Global phone normalization error:", error);
        return { 
            normalized: null, 
            suffix: null,
            valid: false, 
            error: safeText(error.message)
        };
    }
}

// Security utilities
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '`': '&#x60;',
        '/': '&#x2F;',
        '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`/=]/g, m => map[m]);
}

function sanitizeInput(input) {
    if (typeof input === 'string') {
        return escapeHtml(input.trim());
    }
    return input;
}

function safeText(text) {
    if (typeof text !== 'string') return text;
    return text.trim();
}

function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    const cleaned = safeText(str);
    return cleaned.replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================================================
// SECTION 2: WORLD-CLASS UI COMPONENTS - SKELETON LOADERS
// ============================================================================

// Inject production-grade CSS with skeleton loaders
function injectWorldClassCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* ===== SKELETON LOADERS ===== */
        .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
        }
        
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        
        .skeleton-card {
            height: 120px;
            margin-bottom: 16px;
            border-radius: 8px;
        }
        
        .skeleton-line {
            height: 20px;
            margin-bottom: 12px;
            border-radius: 4px;
        }
        
        .skeleton-line.short {
            width: 60%;
        }
        
        .skeleton-line.medium {
            width: 80%;
        }
        
        .skeleton-circle {
            width: 40px;
            height: 40px;
            border-radius: 50%;
        }
        
        /* ===== SMOOTH TRANSITIONS ===== */
        .fade-in {
            animation: fadeIn 0.3s ease-in-out;
        }
        
        .slide-down {
            animation: slideDown 0.3s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideDown {
            from {
                transform: translateY(-10px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        /* ===== ACCORDION SYSTEM ===== */
        .accordion-content {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }
        
        .accordion-content.hidden {
            max-height: 0 !important;
            opacity: 0;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }
        
        .accordion-content:not(.hidden) {
            max-height: 5000px;
            opacity: 1;
        }
        
        .progress-accordion-content {
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }
        
        .progress-accordion-content.hidden {
            max-height: 0 !important;
            opacity: 0;
            transform: translateY(-10px);
        }
        
        .progress-accordion-content:not(.hidden) {
            max-height: 5000px;
            opacity: 1;
            transform: translateY(0);
        }
        
        /* ===== BUTTONS & INTERACTIONS ===== */
        .btn-glow:hover {
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
        }
        
        /* ===== NOTIFICATION SYSTEM ===== */
        .notification-pulse {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        /* ===== GOOGLE CLASSROOM STYLES ===== */
        .gc-modal-overlay { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(0,0,0,0.6); 
            z-index: 9999; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            backdrop-filter: blur(4px); 
            animation: fadeIn 0.2s; 
        }
        
        .gc-modal-container { 
            background: #fff; 
            width: 90%; 
            max-width: 1000px; 
            height: 90vh; 
            border-radius: 8px; 
            display: flex; 
            flex-direction: column; 
            overflow: hidden; 
            box-shadow: 0 4px 24px rgba(0,0,0,0.2); 
        }
        
        .gc-header { 
            padding: 16px 24px; 
            border-bottom: 1px solid #e0e0e0; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
        }
        
        .gc-body { 
            display: flex; 
            flex: 1; 
            overflow-y: auto; 
            background: #fff; 
        }
        
        .gc-main { 
            flex: 1; 
            padding: 24px; 
            border-right: 1px solid #f0f0f0; 
        }
        
        .gc-sidebar { 
            width: 350px; 
            padding: 24px; 
            background: #fff; 
        }
        
        .gc-title { 
            font-size: 2rem; 
            color: #1967d2; 
            margin-bottom: 8px; 
            font-weight: 400; 
        }
        
        .gc-card { 
            background: #fff; 
            border: 1px solid #dadce0; 
            border-radius: 8px; 
            padding: 16px; 
            box-shadow: 0 1px 2px rgba(60,64,67,0.3); 
            margin-bottom: 16px; 
        }
        
        .gc-btn-add { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            width: 100%; 
            padding: 10px; 
            margin-bottom: 10px; 
            background: #fff; 
            border: 1px solid #dadce0; 
            border-radius: 4px; 
            color: #1967d2; 
            font-weight: 500; 
            cursor: pointer; 
            transition: 0.2s; 
        }
        
        .gc-btn-add:hover { 
            background: #f8f9fa; 
            color: #174ea6; 
        }
        
        .gc-btn-primary { 
            width: 100%; 
            padding: 10px; 
            background: #1967d2; 
            border: none; 
            border-radius: 4px; 
            color: #fff; 
            font-weight: 500; 
            cursor: pointer; 
            transition: 0.2s; 
        }
        
        .gc-btn-primary:hover { 
            background: #185abc; 
        }
        
        .gc-btn-primary:disabled { 
            background: #e0e0e0; 
            cursor: not-allowed; 
        }
        
        .gc-btn-unsubmit { 
            width: 100%; 
            padding: 10px; 
            background: #fff; 
            border: 1px solid #dadce0; 
            border-radius: 4px; 
            color: #3c4043; 
            font-weight: 500; 
            cursor: pointer; 
            margin-top: 10px; 
        }
        
        .gc-btn-unsubmit:hover { 
            background: #f1f3f4; 
        }
        
        .gc-attachment { 
            display: flex; 
            align-items: center; 
            border: 1px solid #dadce0; 
            border-radius: 4px; 
            padding: 8px; 
            margin-bottom: 12px; 
            cursor: pointer; 
        }
        
        .gc-att-icon { 
            width: 36px; 
            height: 36px; 
            background: #f1f3f4; 
            color: #1967d2; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            margin-right: 12px; 
            border-radius: 4px; 
        }
        
        @media (max-width: 768px) { 
            .gc-body { 
                flex-direction: column; 
            } 
            .gc-sidebar { 
                width: 100%; 
                border-top: 1px solid #e0e0e0; 
            } 
        }
        
        /* ===== RESPONSIVE DESIGN ===== */
        @media (max-width: 640px) {
            .container-padding {
                padding-left: 1rem;
                padding-right: 1rem;
            }
            
            .mobile-stack {
                flex-direction: column !important;
            }
            
            .mobile-full {
                width: 100% !important;
            }
        }
        
        /* ===== PERFORMANCE INDICATORS ===== */
        .performance-excellent {
            color: #10B981;
            background-color: #D1FAE5;
        }
        
        .performance-good {
            color: #F59E0B;
            background-color: #FEF3C7;
        }
        
        .performance-needs-improvement {
            color: #EF4444;
            background-color: #FEE2E2;
        }
    `;
    document.head.appendChild(style);
}

// Create skeleton loader HTML
function createSkeletonLoader(type = 'dashboard') {
    switch(type) {
        case 'dashboard':
            return `
                <div class="space-y-6">
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                </div>
            `;
        case 'reports':
            return `
                <div class="space-y-4">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="skeleton skeleton-circle"></div>
                        <div class="flex-1">
                            <div class="skeleton skeleton-line medium"></div>
                            <div class="skeleton skeleton-line short mt-2"></div>
                        </div>
                    </div>
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line short"></div>
                </div>
            `;
        case 'academics':
            return `
                <div class="space-y-6">
                    <div class="skeleton skeleton-card"></div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="skeleton skeleton-card"></div>
                        <div class="skeleton skeleton-card"></div>
                    </div>
                </div>
            `;
        default:
            return `<div class="skeleton skeleton-card"></div>`;
    }
}

// ============================================================================
// SECTION 3: PARALLEL DATA LOADING SYSTEM
// ============================================================================

class ParallelDataLoader {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Load all dashboard data in parallel
     */
    async loadDashboardData(user) {
        console.log("🚀 PARALLEL LOADING: Starting all data loads");
        
        const startTime = Date.now();
        
        try {
            // 1. Get user data first (prerequisite)
            const userData = await this.getUserData(user.uid);
            
            // 2. Fire all data loads in parallel
            const [childrenData, reportsData, rewardsData, academicsData] = await Promise.all([
                this.findChildrenParallel(userData.normalizedPhone),
                this.searchReportsParallel(userData.normalizedPhone, userData.email, user.uid),
                this.loadRewardsParallel(user.uid),
                this.loadAcademicsPreviewParallel(userData.normalizedPhone)
            ]);
            
            const loadTime = Date.now() - startTime;
            console.log(`✅ PARALLEL LOAD COMPLETE: ${loadTime}ms`);
            
            return {
                userData,
                childrenData,
                reportsData,
                rewardsData,
                academicsData,
                loadTime
            };
            
        } catch (error) {
            console.error("❌ Parallel load error:", error);
            throw error;
        }
    }

    /**
     * Get user data with caching
     */
    async getUserData(userId) {
        const cacheKey = `user_${userId}`;
        const cached = this.getFromCache(cacheKey);
        
        if (cached) return cached;
        
        const doc = await db.collection('parent_users').doc(userId).get();
        if (!doc.exists) throw new Error("User profile not found");
        
        const data = doc.data();
        const normalized = normalizePhoneNumberGlobal(data.phone || '');
        
        const result = {
            ...data,
            normalizedPhone: normalized.normalized,
            phoneSuffix: normalized.suffix,
            uid: userId
        };
        
        this.saveToCache(cacheKey, result);
        return result;
    }

    /**
     * Find children using universal suffix matching
     */
    async findChildrenParallel(parentPhone) {
        console.log("🔍 PARALLEL: Finding children...");
        
        const normalized = normalizePhoneNumberGlobal(parentPhone);
        const parentSuffix = normalized.suffix;
        
        if (!parentSuffix) {
            return {
                studentIds: [],
                studentNameIdMap: new Map(),
                allStudentData: [],
                studentNames: []
            };
        }

        try {
            // Load both collections in parallel
            const [studentsSnapshot, pendingSnapshot] = await Promise.all([
                db.collection('students').get(),
                db.collection('pending_students').get()
            ]);

            const allChildren = new Map();
            const studentNameIdMap = new Map();

            // Process students with suffix matching
            const processCollection = (snapshot, isPending = false) => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const studentId = doc.id;
                    const studentName = safeText(data.studentName || data.name || 'Unknown');
                    
                    if (studentName === 'Unknown') return;
                    
                    // Check ALL phone fields with suffix matching
                    const phoneFields = [
                        data.parentPhone,
                        data.guardianPhone,
                        data.motherPhone,
                        data.fatherPhone,
                        data.contactPhone,
                        data.phone,
                        data.parentPhone1,
                        data.parentPhone2,
                        data.emergencyPhone
                    ];
                    
                    let isMatch = false;
                    
                    for (const fieldPhone of phoneFields) {
                        if (fieldPhone && comparePhonesByUniversalSuffix(fieldPhone, parentPhone)) {
                            isMatch = true;
                            break;
                        }
                    }
                    
                    if (isMatch && !allChildren.has(studentId)) {
                        allChildren.set(studentId, {
                            id: studentId,
                            name: studentName,
                            data: data,
                            isPending: isPending,
                            collection: isPending ? 'pending_students' : 'students'
                        });
                        
                        // Handle duplicate names
                        if (studentNameIdMap.has(studentName)) {
                            const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
                            studentNameIdMap.set(uniqueName, studentId);
                        } else {
                            studentNameIdMap.set(studentName, studentId);
                        }
                    }
                });
            };

            processCollection(studentsSnapshot);
            processCollection(pendingSnapshot, true);

            return {
                studentIds: Array.from(allChildren.keys()),
                studentNameIdMap,
                allStudentData: Array.from(allChildren.values()),
                studentNames: Array.from(studentNameIdMap.keys())
            };

        } catch (error) {
            console.error("Parallel children search error:", error);
            return {
                studentIds: [],
                studentNameIdMap: new Map(),
                allStudentData: [],
                studentNames: []
            };
        }
    }

    /**
     * Search reports using suffix matching
     */
    async searchReportsParallel(parentPhone, parentEmail, parentUid) {
        console.log("📊 PARALLEL: Searching reports...");
        
        const parentSuffix = extractPhoneSuffix(parentPhone);
        const searchPromises = [];
        
        // Search in all report collections in parallel
        const collections = ['student_results', 'tutor_submissions', 'monthly_reports'];
        
        collections.forEach(collection => {
            searchPromises.push(
                this.searchInCollection(collection, parentSuffix, parentEmail)
            );
        });
        
        try {
            const results = await Promise.all(searchPromises);
            
            // Combine results
            const assessmentResults = [];
            const monthlyResults = [];
            
            results.forEach((result, index) => {
                const collection = collections[index];
                const isAssessment = collection === 'student_results';
                
                if (isAssessment) {
                    assessmentResults.push(...result);
                } else {
                    monthlyResults.push(...result);
                }
            });
            
            console.log(`✅ PARALLEL REPORTS: ${assessmentResults.length} assessments, ${monthlyResults.length} monthly`);
            
            return { assessmentResults, monthlyResults };
            
        } catch (error) {
            console.error("Parallel report search error:", error);
            return { assessmentResults: [], monthlyResults: [] };
        }
    }

    /**
     * Search in a specific collection with suffix matching
     */
    async searchInCollection(collection, parentSuffix, parentEmail) {
        try {
            // First try exact matches
            const snapshot = await db.collection(collection)
                .where('normalizedParentPhone', '>=', parentSuffix)
                .where('normalizedParentPhone', '<=', parentSuffix + '\uf8ff')
                .limit(100)
                .get();
            
            const results = [];
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const docSuffix = extractPhoneSuffix(data.parentPhone || data.normalizedParentPhone || '');
                
                // Universal suffix match
                if (docSuffix === parentSuffix) {
                    results.push({
                        id: doc.id,
                        collection: collection,
                        matchType: 'suffix',
                        ...data,
                        timestamp: this.getTimestampFromData(data),
                        type: collection === 'student_results' ? 'assessment' : 'monthly'
                    });
                }
            });
            
            return results;
            
        } catch (error) {
            console.log(`Collection ${collection} search skipped:`, error.message);
            return [];
        }
    }

    /**
     * Load rewards data
     */
    async loadRewardsParallel(userId) {
        try {
            const [userDoc, transactionsSnapshot] = await Promise.all([
                db.collection('parent_users').doc(userId).get(),
                db.collection('referral_transactions')
                    .where('ownerUid', '==', userId)
                    .get()
            ]);
            
            if (!userDoc.exists) {
                throw new Error("User data not found");
            }
            
            const userData = userDoc.data();
            const transactions = transactionsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            return {
                referralCode: userData.referralCode || 'N/A',
                totalEarnings: userData.referralEarnings || 0,
                transactions: transactions.sort((a, b) => {
                    const aTime = a.timestamp?.toDate?.() || new Date(0);
                    const bTime = b.timestamp?.toDate?.() || new Date(0);
                    return bTime - aTime;
                })
            };
            
        } catch (error) {
            console.error("Parallel rewards load error:", error);
            return {
                referralCode: 'N/A',
                totalEarnings: 0,
                transactions: []
            };
        }
    }

    /**
     * Load academics preview (lightweight version)
     */
    async loadAcademicsPreviewParallel(parentPhone) {
        try {
            const childrenData = await this.findChildrenParallel(parentPhone);
            
            if (childrenData.studentIds.length === 0) {
                return { students: [], notifications: new Map() };
            }
            
            // Get recent topics and homework for notifications
            const notificationPromises = childrenData.studentIds.map(studentId => 
                this.checkStudentNotifications(studentId)
            );
            
            const notifications = await Promise.all(notificationPromises);
            const notificationMap = new Map();
            
            notifications.forEach((notification, index) => {
                const studentName = childrenData.allStudentData[index].name;
                notificationMap.set(studentName, notification);
            });
            
            return {
                students: childrenData.allStudentData,
                notifications: notificationMap
            };
            
        } catch (error) {
            console.error("Parallel academics preview error:", error);
            return { students: [], notifications: new Map() };
        }
    }

    /**
     * Check notifications for a single student
     */
    async checkStudentNotifications(studentId) {
        try {
            const [topicsSnapshot, homeworkSnapshot] = await Promise.all([
                db.collection('daily_topics')
                    .where('studentId', '==', studentId)
                    .limit(10)
                    .get(),
                db.collection('homework_assignments')
                    .where('studentId', '==', studentId)
                    .limit(10)
                    .get()
            ]);
            
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            let sessionTopics = 0;
            let homework = 0;
            
            topicsSnapshot.forEach(doc => {
                const topic = doc.data();
                const topicDate = topic.date?.toDate?.() || topic.createdAt?.toDate?.() || new Date(0);
                if (topicDate >= oneWeekAgo) sessionTopics++;
            });
            
            homeworkSnapshot.forEach(doc => {
                const hw = doc.data();
                const assignedDate = hw.assignedDate?.toDate?.() || hw.createdAt?.toDate?.() || new Date(0);
                if (assignedDate >= oneWeekAgo) homework++;
            });
            
            return { sessionTopics, homework };
            
        } catch (error) {
            console.error("Student notification check error:", error);
            return { sessionTopics: 0, homework: 0 };
        }
    }

    // Helper methods
    getTimestampFromData(data) {
        const timestampFields = ['timestamp', 'createdAt', 'submittedAt', 'date'];
        
        for (const field of timestampFields) {
            if (data[field]) {
                const date = data[field]?.toDate?.() || new Date(data[field]);
                if (!isNaN(date.getTime())) {
                    return Math.floor(date.getTime() / 1000);
                }
            }
        }
        
        return Math.floor(Date.now() / 1000);
    }

    getFromCache(key) {
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < this.cacheDuration) {
            return item.data;
        }
        return null;
    }

    saveToCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }
}

// ============================================================================
// SECTION 4: WORLD-CLASS AUTH MANAGER
// ============================================================================

class WorldClassAuthManager {
    constructor() {
        this.currentUser = null;
        this.authListener = null;
        this.isInitialized = false;
        this.parallelLoader = new ParallelDataLoader();
        this.loadingStates = new Map();
        this.lastAuthTime = 0;
        this.AUTH_DEBOUNCE = 1000;
    }

    /**
     * Initialize with debounced auth handling
     */
    initialize() {
        if (this.isInitialized) return;
        
        console.log("🔐 Initializing World-Class Auth Manager");
        
        this.cleanup();
        
        this.authListener = auth.onAuthStateChanged(
            user => this.debouncedAuthChange(user),
            error => this.handleAuthError(error)
        );
        
        this.isInitialized = true;
        console.log("✅ Auth manager initialized");
    }

    /**
     * Debounce auth changes to prevent rapid successive calls
     */
    debouncedAuthChange(user) {
        const now = Date.now();
        
        if (now - this.lastAuthTime < this.AUTH_DEBOUNCE) {
            return;
        }
        
        this.lastAuthTime = now;
        
        if (user) {
            this.handleUserAuthenticated(user);
        } else {
            this.handleUserSignedOut();
        }
    }

    /**
     * Handle authenticated user with parallel loading
     */
    async handleUserAuthenticated(user) {
        console.log(`👤 User authenticated: ${user.uid.substring(0, 8)}...`);
        
        // Show skeleton immediately
        this.showSkeletonUI();
        
        try {
            // Parallel load all data
            const dashboardData = await this.parallelLoader.loadDashboardData(user);
            
            // Update global state
            this.currentUser = {
                uid: user.uid,
                ...dashboardData.userData
            };
            
            // Update global variables used by other functions
            window.userChildren = dashboardData.childrenData.studentNames;
            window.studentIdMap = dashboardData.childrenData.studentNameIdMap;
            window.allStudentData = dashboardData.childrenData.allStudentData;
            
            // Render dashboard with loaded data
            this.renderDashboard(dashboardData);
            
            // Setup real-time features
            this.setupRealtimeFeatures();
            
            console.log(`✅ Dashboard loaded in ${dashboardData.loadTime}ms`);
            
        } catch (error) {
            console.error("Dashboard load error:", error);
            this.showErrorMessage(error);
            this.showAuthScreen();
        }
    }

    /**
     * Show skeleton loader UI
     */
    showSkeletonUI() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        
        if (authArea) authArea.classList.add("hidden");
        if (reportArea) {
            reportArea.classList.remove("hidden");
            // Inject skeleton loaders
            const reportContent = document.getElementById("reportContent");
            const academicsContent = document.getElementById("academicsContent");
            const rewardsContent = document.getElementById("rewardsContent");
            
            if (reportContent) reportContent.innerHTML = createSkeletonLoader('reports');
            if (academicsContent) academicsContent.innerHTML = createSkeletonLoader('academics');
            if (rewardsContent) rewardsContent.innerHTML = createSkeletonLoader();
        }
    }

    /**
     * Render dashboard with loaded data
     */
    async renderDashboard(dashboardData) {
        // Update welcome message
        const welcomeMessage = document.getElementById("welcomeMessage");
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${dashboardData.userData.parentName || 'Parent'}!`;
        }
        
        // Render reports tab
        await this.renderReportsTab(dashboardData.reportsData, dashboardData.childrenData);
        
        // Render academics preview
        this.renderAcademicsPreview(dashboardData.academicsData);
        
        // Render rewards
        this.renderRewardsTab(dashboardData.rewardsData);
        
        // Add UI controls
        this.addDashboardControls();
        
        // Switch to reports tab by default
        this.switchMainTab('reports');
    }

    /**
     * Render reports tab
     */
    async renderReportsTab(reportsData, childrenData) {
        const reportContent = document.getElementById("reportContent");
        if (!reportContent) return;
        
        if (reportsData.assessmentResults.length === 0 && reportsData.monthlyResults.length === 0) {
            reportContent.innerHTML = this.createEmptyReportsState();
            return;
        }
        
        // Group reports by student
        const reportsByStudent = this.groupReportsByStudent(
            reportsData.assessmentResults,
            reportsData.monthlyResults,
            childrenData
        );
        
        // Create hierarchical view
        reportContent.innerHTML = this.createYearlyArchiveReportView(reportsByStudent);
    }

    /**
     * Group reports by student
     */
    groupReportsByStudent(assessments, monthly, childrenData) {
        const reportsByStudent = new Map();
        
        // Initialize with all children (even those without reports)
        childrenData.allStudentData.forEach(student => {
            reportsByStudent.set(student.name, {
                assessments: new Map(),
                monthly: new Map(),
                studentData: student
            });
        });
        
        // Add assessment reports
        assessments.forEach(report => {
            const studentName = report.studentName;
            if (!studentName) return;
            
            if (!reportsByStudent.has(studentName)) {
                reportsByStudent.set(studentName, {
                    assessments: new Map(),
                    monthly: new Map(),
                    studentData: { name: studentName, isPending: false }
                });
            }
            
            const sessionKey = Math.floor(report.timestamp / 86400);
            if (!reportsByStudent.get(studentName).assessments.has(sessionKey)) {
                reportsByStudent.get(studentName).assessments.set(sessionKey, []);
            }
            reportsByStudent.get(studentName).assessments.get(sessionKey).push(report);
        });
        
        // Add monthly reports
        monthly.forEach(report => {
            const studentName = report.studentName;
            if (!studentName) return;
            
            if (!reportsByStudent.has(studentName)) {
                reportsByStudent.set(studentName, {
                    assessments: new Map(),
                    monthly: new Map(),
                    studentData: { name: studentName, isPending: false }
                });
            }
            
            const sessionKey = Math.floor(report.timestamp / 86400);
            if (!reportsByStudent.get(studentName).monthly.has(sessionKey)) {
                reportsByStudent.get(studentName).monthly.set(sessionKey, []);
            }
            reportsByStudent.get(studentName).monthly.get(sessionKey).push(report);
        });
        
        return reportsByStudent;
    }

    /**
     * Create empty reports state
     */
    createEmptyReportsState() {
        return `
            <div class="text-center py-16 fade-in">
                <div class="text-6xl mb-6">📊</div>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Waiting for Your Child's First Report</h2>
                <p class="text-gray-600 max-w-2xl mx-auto mb-6">
                    No reports found for your account yet. This usually means:
                </p>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto mb-6">
                    <ul class="text-left text-gray-700 space-y-3">
                        <li>• Your child's tutor hasn't submitted their first assessment or monthly report yet</li>
                        <li>• Reports are being processed and will appear soon</li>
                        <li>• We're automatically monitoring for new reports</li>
                    </ul>
                </div>
                <div class="bg-green-50 border border-green-200 rounded-lg p-6 max-w-2xl mx-auto">
                    <h3 class="font-semibold text-green-800 mb-2">What happens next?</h3>
                    <p class="text-green-700 mb-4">
                        <strong>We're automatically monitoring for new reports!</strong> When your child's tutor submits 
                        their first report, it will appear here automatically.
                    </p>
                    <button onclick="window.authManager.refreshDashboard()" 
                        class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center mx-auto">
                        <span class="mr-2">🔄</span> Check Now
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render academics preview
     */
    renderAcademicsPreview(academicsData) {
        const academicsTab = document.getElementById("academicsTab");
        if (!academicsTab) return;
        
        // Update notification badge
        let totalNotifications = 0;
        academicsData.notifications.forEach(notification => {
            totalNotifications += notification.sessionTopics + notification.homework;
        });
        
        this.updateAcademicsBadge(totalNotifications);
    }

    /**
     * Update academics badge
     */
    updateAcademicsBadge(count) {
        const academicsTab = document.getElementById('academicsTab');
        if (!academicsTab) return;
        
        const existingBadge = academicsTab.querySelector('.academics-badge');
        if (existingBadge) existingBadge.remove();
        
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'academics-badge absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs min-w-5 h-5 flex items-center justify-center font-bold animate-pulse px-1';
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.lineHeight = '1rem';
            badge.style.fontSize = '0.7rem';
            academicsTab.style.position = 'relative';
            academicsTab.appendChild(badge);
        }
    }

    /**
     * Render rewards tab
     */
    renderRewardsTab(rewardsData) {
        const rewardsContent = document.getElementById('rewardsContent');
        if (!rewardsContent) return;
        
        let referralsHtml = '';
        
        if (rewardsData.transactions.length === 0) {
            referralsHtml = `
                <tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>
            `;
        } else {
            rewardsData.transactions.forEach(data => {
                const status = safeText(data.status || 'pending');
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : 
                                    status === 'approved' ? 'bg-blue-100 text-blue-800' : 
                                    'bg-yellow-100 text-yellow-800';
                
                const referredName = capitalize(data.referredStudentName || data.referredStudentPhone);
                const rewardAmount = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
                const referralDate = data.timestamp?.toDate?.().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                }) || 'N/A';

                referralsHtml += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${referredName}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${safeText(referralDate)}</td>
                        <td class="px-4 py-3 text-sm">
                            <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                                ${capitalize(status)}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${safeText(rewardAmount)}</td>
                    </tr>
                `;
            });
        }
        
        const pendingCount = rewardsData.transactions.filter(t => t.status === 'pending').length;
        const approvedCount = rewardsData.transactions.filter(t => t.status === 'approved').length;
        const paidCount = rewardsData.transactions.filter(t => t.status === 'paid').length;
        
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md slide-down">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">
                    ${rewardsData.referralCode}
                </p>
                <p class="text-blue-700 mt-2">
                    Share this code with other parents. They use it when registering their child, 
                    and you earn <strong>₦5,000</strong> once their child completes their first month!
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600 fade-in">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${rewardsData.totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600 fade-in">
                    <p class="text-sm font-medium text-yellow-700">Approved Rewards (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600 fade-in">
                    <p class="text-sm font-medium text-gray-700">Total Successful Referrals (Paid)</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>

            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Referred Parent/Student
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date Used
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Reward
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${referralsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Add dashboard controls
     */
    addDashboardControls() {
        const welcomeSection = document.querySelector('.bg-green-50');
        if (!welcomeSection) return;
        
        const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
        if (!buttonContainer) return;
        
        // Add refresh button
        if (!document.getElementById('globalRefreshBtn')) {
            const refreshBtn = document.createElement('button');
            refreshBtn.id = 'globalRefreshBtn';
            refreshBtn.onclick = () => this.refreshDashboard();
            refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
            refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Refresh Dashboard';
            
            const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
            if (logoutBtn) {
                buttonContainer.insertBefore(refreshBtn, logoutBtn);
            } else {
                buttonContainer.appendChild(refreshBtn);
            }
        }
        
        // Add settings button
        if (!document.getElementById('globalSettingsBtn')) {
            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'globalSettingsBtn';
            settingsBtn.onclick = () => window.settingsManager.openSettingsTab();
            settingsBtn.className = 'bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200 btn-glow flex items-center justify-center';
            settingsBtn.innerHTML = '<span class="mr-2">⚙️</span> Settings';
            
            buttonContainer.appendChild(settingsBtn);
        }
    }

    /**
     * Setup real-time features
     */
    setupRealtimeFeatures() {
        if (!this.currentUser) return;
        
        // Clean up existing listeners
        if (window.realTimeListeners) {
            window.realTimeListeners.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') unsubscribe();
            });
            window.realTimeListeners = [];
        }
        
        // Setup real-time monitoring
        this.setupRealTimeMonitoring();
        
        // Start Google Classroom scanner
        this.startGoogleClassroomScanner();
    }

    /**
     * Setup real-time monitoring
     */
    setupRealTimeMonitoring() {
        const parentPhone = this.currentUser.normalizedPhone;
        const userId = this.currentUser.uid;
        
        if (!parentPhone) return;
        
        // Check for new reports every 30 seconds
        const reportInterval = setInterval(async () => {
            try {
                const lastCheckKey = `lastReportCheck_${userId}`;
                const lastCheckTime = parseInt(localStorage.getItem(lastCheckKey) || '0');
                const now = Date.now();
                
                // Check for new reports
                const newReports = await this.checkForNewReports(parentPhone, lastCheckTime);
                
                if (newReports > 0) {
                    this.showNewReportNotification();
                }
                
                localStorage.setItem(lastCheckKey, now.toString());
                
            } catch (error) {
                console.error("Real-time check error:", error);
            }
        }, 30000);
        
        window.realTimeListeners = window.realTimeListeners || [];
        window.realTimeListeners.push(() => clearInterval(reportInterval));
    }

    /**
     * Check for new reports
     */
    async checkForNewReports(parentPhone, sinceTime) {
        const parentSuffix = extractPhoneSuffix(parentPhone);
        let newCount = 0;
        
        // Check both collections
        const collections = ['student_results', 'tutor_submissions'];
        
        for (const collection of collections) {
            try {
                const snapshot = await db.collection(collection)
                    .where('normalizedParentPhone', '>=', parentSuffix)
                    .where('normalizedParentPhone', '<=', parentSuffix + '\uf8ff')
                    .limit(20)
                    .get();
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const docTime = data.timestamp?.toDate?.()?.getTime() || 
                                  data.createdAt?.toDate?.()?.getTime() || 0;
                    
                    if (docTime > sinceTime) {
                        const docSuffix = extractPhoneSuffix(data.parentPhone || '');
                        if (docSuffix === parentSuffix) {
                            newCount++;
                        }
                    }
                });
                
            } catch (error) {
                console.error(`Check ${collection} error:`, error);
            }
        }
        
        return newCount;
    }

    /**
     * Show new report notification
     */
    showNewReportNotification() {
        // Remove existing indicator
        const existingIndicator = document.getElementById('newReportIndicator');
        if (existingIndicator) existingIndicator.remove();
        
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.id = 'newReportIndicator';
        indicator.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse fade-in';
        indicator.innerHTML = '📄 New Report Available!';
        document.body.appendChild(indicator);
        
        // Remove after 5 seconds
        setTimeout(() => indicator.remove(), 5000);
        
        // Update refresh button
        const refreshBtn = document.getElementById('globalRefreshBtn');
        if (refreshBtn) {
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<span class="mr-2 animate-pulse">🔄</span> <span class="animate-pulse">New Reports Available!</span>';
            
            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
            }, 3000);
        }
        
        // Show toast message
        this.showMessage('New report available!', 'success');
    }

    /**
     * Start Google Classroom scanner
     */
    startGoogleClassroomScanner() {
        // Initial scan
        setTimeout(() => this.scanForGoogleClassroomButtons(), 1000);
        
        // Periodic scan
        const scanInterval = setInterval(() => {
            this.scanForGoogleClassroomButtons();
        }, 2000);
        
        window.realTimeListeners = window.realTimeListeners || [];
        window.realTimeListeners.push(() => clearInterval(scanInterval));
    }

    /**
     * Scan for Google Classroom buttons
     */
    scanForGoogleClassroomButtons() {
        const cards = document.querySelectorAll('#academicsContent .bg-white.border.rounded-lg');
        
        cards.forEach(card => {
            if (card.querySelector('.gc-inject-btn')) return;
            
            const textContent = card.textContent || "";
            if (!textContent.includes('Due:')) return;
            
            const btnContainer = document.createElement('div');
            btnContainer.className = 'mt-4 pt-3 border-t border-gray-100 flex justify-end gc-inject-btn fade-in';
            btnContainer.innerHTML = `
                <button class="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm group">
                    <span class="group-hover:scale-110 transition-transform">📤</span> 
                    <span>Turn In / View Details</span>
                </button>
            `;
            
            const btn = btnContainer.querySelector('button');
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const titleEl = card.querySelector('h5');
                const titleText = titleEl ? titleEl.textContent.trim() : '';
                if (titleText) this.openGoogleClassroomModal(titleText);
            };
            
            card.appendChild(btnContainer);
        });
    }

    /**
     * Open Google Classroom modal
     */
    openGoogleClassroomModal(titleText) {
        const selector = document.getElementById('studentSelector');
        let studentName = selector ? selector.value : null;
        if (!studentName && window.userChildren && window.userChildren.length > 0) {
            studentName = window.userChildren[0];
        }
        
        if (!studentName) {
            this.showMessage('Please select a student first.', 'error');
            return;
        }
        
        const studentId = window.studentIdMap ? window.studentIdMap.get(studentName) : null;
        if (!studentId) {
            this.showMessage('Student ID not found.', 'error');
            return;
        }
        
        this.showMessage('Opening classroom...', 'success');
        
        // Find homework by title
        db.collection('homework_assignments')
            .where('studentId', '==', studentId)
            .where('title', '==', titleText)
            .limit(1)
            .get()
            .then(snapshot => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    const hwData = { id: doc.id, ...doc.data() };
                    
                    // Open the modal
                    this.openHomeworkModal(hwData, studentId);
                } else {
                    // Fallback search
                    db.collection('homework_assignments')
                        .where('studentId', '==', studentId)
                        .get()
                        .then(snap => {
                            const found = snap.docs.find(d => {
                                const dData = d.data();
                                return (dData.title || dData.subject) === titleText;
                            });
                            
                            if (found) {
                                const hwData = { id: found.id, ...found.data() };
                                this.openHomeworkModal(hwData, studentId);
                            } else {
                                this.showMessage('Could not find assignment details.', 'error');
                            }
                        });
                }
            })
            .catch(err => {
                console.error("Error finding homework:", err);
                this.showMessage('Error loading assignment.', 'error');
            });
    }

    /**
     * Open homework modal
     */
    openHomeworkModal(homework, studentId) {
        // Create modal HTML
        const modalHTML = `
            <div class="gc-modal-overlay" id="gcModal">
                <div class="gc-modal-container">
                    <div class="gc-header">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-blue-100 rounded-full text-blue-600">
                                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <span class="font-medium text-gray-600">Assignment Details</span>
                        </div>
                        <button onclick="window.authManager.closeHomeworkModal()" class="text-2xl text-gray-500 hover:text-black transition-colors">×</button>
                    </div>
                    <div class="gc-body" id="gcBodyContent">
                        <div class="flex justify-center items-center h-full w-full">
                            <div class="loading-spinner"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        
        const div = document.createElement('div');
        div.innerHTML = modalHTML;
        document.body.appendChild(div.firstElementChild);
        
        // Start real-time listener
        const hwRef = db.collection('homework_assignments').doc(homework.id);
        const unsubscribe = hwRef.onSnapshot((doc) => {
            if (doc.exists) {
                const freshData = { id: doc.id, ...doc.data() };
                this.renderHomeworkModalContent(freshData, studentId);
            }
        });
        
        // Store listener for cleanup
        window.homeworkListenerUnsub = unsubscribe;
        
        // Initial render
        this.renderHomeworkModalContent(homework, studentId);
    }

    /**
     * Render homework modal content
     */
    renderHomeworkModalContent(homework, studentId) {
        const container = document.getElementById('gcBodyContent');
        if (!container) return;
        
        // Status logic
        const isGraded = homework.status === 'graded';
        const isSubmitted = ['submitted', 'completed', 'graded'].includes(homework.status);
        const now = Date.now();
        const dueTimestamp = homework.dueDate?.toDate?.()?.getTime() || 
                            new Date(homework.dueDate || 0).getTime();
        const isOverdue = !isSubmitted && dueTimestamp && dueTimestamp < now;
        
        let statusText = 'Assigned';
        let statusClass = 'text-green-700';
        
        if (isGraded) { 
            statusText = 'Graded'; 
            statusClass = 'text-black font-bold'; 
        } else if (isSubmitted) { 
            statusText = 'Handed in'; 
            statusClass = 'text-green-700 font-bold'; 
        } else if (isOverdue) { 
            statusText = 'Missing'; 
            statusClass = 'text-red-600 font-bold'; 
        }
        
        // Format date
        const formatDate = (timestamp) => {
            if (!timestamp) return 'Not set';
            const date = new Date(timestamp);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };
        
        container.innerHTML = `
            <div class="gc-main">
                <h1 class="gc-title">${safeText(homework.title || homework.subject)}</h1>
                <div class="text-gray-500 text-sm mb-6 flex gap-3">
                    <span>${safeText(homework.tutorName || 'Tutor')}</span> • 
                    <span>Due ${formatDate(dueTimestamp)}</span> • 
                    <span class="${statusClass}">${statusText}</span>
                </div>
                <div class="border-b mb-6"></div>
                
                <div class="text-gray-800 leading-relaxed whitespace-pre-wrap mb-8">
                    ${safeText(homework.description || homework.instructions || 'No instructions provided.')}
                </div>
                
                ${homework.fileUrl ? `
                    <div class="mt-4">
                        <h4 class="text-sm font-medium text-gray-500 mb-2">Reference Materials</h4>
                        <a href="${homework.fileUrl}" target="_blank" class="gc-attachment hover:bg-gray-50">
                            <div class="gc-att-icon">📎</div>
                            <div class="text-sm font-medium text-blue-900 truncate flex-1">Download Assignment File</div>
                        </a>
                    </div>` : ''}
            </div>

            <div class="gc-sidebar">
                <div class="gc-card">
                    <div class="flex justify-between items-start mb-4">
                        <h2 class="text-lg font-medium text-gray-800">Your work</h2>
                        <div class="text-xs uppercase font-bold ${statusClass}">${statusText}</div>
                    </div>

                    <div id="gc-file-area" class="mb-4">
                        ${homework.submissionUrl ? `
                            <div class="gc-attachment">
                                <div class="gc-att-icon">📄</div>
                                <div class="flex-1 truncate text-sm">Submitted File</div>
                                <a href="${homework.submissionUrl}" target="_blank" class="text-blue-600 text-xs font-bold px-2">VIEW</a>
                            </div>` : ''}
                    </div>

                    ${!isSubmitted ? `
                        <button class="gc-btn-add" onclick="window.authManager.triggerCloudinaryUpload('${homework.id}', '${studentId}')">
                            <span class="mr-2 text-xl">+</span> Add or create
                        </button>
                        <button id="btn-turn-in" class="gc-btn-primary" 
                            onclick="window.authManager.submitHomework('${homework.id}')" 
                            ${!homework.submissionUrl ? 'disabled style="opacity:0.5"' : ''}>
                            Mark as done
                        </button>
                        <p class="text-xs text-gray-500 mt-2 text-center">Upload a file to enable submission</p>
                    ` : `
                        ${isGraded ? `
                            <div class="text-center py-4 bg-gray-50 rounded border border-gray-200">
                                <div class="text-3xl font-bold text-gray-800">${homework.grade || homework.score || '-'}%</div>
                                <div class="text-xs text-gray-500">Overall Grade</div>
                            </div>
                        ` : `
                            <button class="gc-btn-unsubmit" onclick="window.authManager.unsubmitHomework('${homework.id}')">Unsubmit</button>
                            <p class="text-xs text-gray-500 mt-2 text-center">Unsubmit to add or change attachments.</p>
                        `}
                    `}
                </div>

                ${homework.feedback ? `
                    <div class="gc-card mt-4">
                        <h2 class="text-sm font-medium mb-2">Private comments</h2>
                        <div class="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100">
                            ${safeText(homework.feedback)}
                        </div>
                        <div class="text-xs text-gray-400 mt-1 text-right">From Tutor</div>
                    </div>` : ''}
            </div>
        `;
    }

    /**
     * Close homework modal
     */
    closeHomeworkModal() {
        if (window.homeworkListenerUnsub) {
            window.homeworkListenerUnsub();
            window.homeworkListenerUnsub = null;
        }
        
        const modal = document.getElementById('gcModal');
        if (modal) modal.remove();
        document.body.style.overflow = 'auto';
    }

    /**
     * Trigger Cloudinary upload
     */
    triggerCloudinaryUpload(homeworkId, studentId) {
        if (!window.cloudinary) {
            this.showMessage("Upload widget is loading. Please try again in a few seconds.", "error");
            return;
        }
        
        const widget = cloudinary.createUploadWidget({
            cloudName: 'dwjq7j5zp',
            uploadPreset: 'tutor_homework',
            sources: ['local', 'camera', 'google_drive'],
            folder: `homework_submissions/${studentId}`,
            tags: [homeworkId, 'homework_submission'],
            multiple: false
        }, async (error, result) => {
            if (!error && result && result.event === "success") {
                try {
                    await db.collection('homework_assignments').doc(homeworkId).update({
                        submissionUrl: result.info.secure_url,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    this.showMessage('File uploaded successfully!', 'success');
                } catch (err) {
                    console.error("Upload update error:", err);
                    this.showMessage('Error saving upload.', 'error');
                }
            }
        });
        
        widget.open();
    }

    /**
     * Submit homework
     */
    async submitHomework(homeworkId) {
        if (!confirm("Are you ready to turn in your work?")) return;
        
        const btn = document.getElementById('btn-turn-in');
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Turning in...";
        }
        
        try {
            await db.collection('homework_assignments').doc(homeworkId).update({
                status: 'submitted',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                submissionDate: new Date().toISOString()
            });
            this.showMessage('Assignment turned in successfully!', 'success');
        } catch (error) {
            console.error("Submit error:", error);
            this.showMessage('Error turning in work.', 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Mark as done";
            }
        }
    }

    /**
     * Unsubmit homework
     */
    async unsubmitHomework(homeworkId) {
        if (!confirm("Unsubmit this assignment?")) return;
        
        try {
            await db.collection('homework_assignments').doc(homeworkId).update({
                status: 'assigned',
                submissionUrl: firebase.firestore.FieldValue.delete()
            });
            this.showMessage('Assignment unsubmitted.', 'success');
        } catch (error) {
            console.error("Unsubmit error:", error);
            this.showMessage('Error unsubmitting assignment.', 'error');
        }
    }

    /**
     * Handle user signed out
     */
    handleUserSignedOut() {
        console.log("🚪 User signed out");
        this.showAuthScreen();
        
        // Clear cache
        this.parallelLoader.clearCache();
        
        // Clean up listeners
        if (window.realTimeListeners) {
            window.realTimeListeners.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') unsubscribe();
            });
            window.realTimeListeners = [];
        }
        
        if (window.homeworkListenerUnsub) {
            window.homeworkListenerUnsub();
            window.homeworkListenerUnsub = null;
        }
    }

    /**
     * Show auth screen
     */
    showAuthScreen() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        
        if (authArea) authArea.classList.remove("hidden");
        if (reportArea) reportArea.classList.add("hidden");
        
        localStorage.removeItem('isAuthenticated');
        this.currentUser = null;
    }

    /**
     * Show error message
     */
    showErrorMessage(error) {
        const errorMessage = error.message || "An unknown error occurred";
        this.showMessage(`System Error: ${errorMessage}`, 'error');
        
        const reportContent = document.getElementById("reportContent");
        if (reportContent) {
            reportContent.innerHTML = `
                <div class="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 p-6 rounded-xl shadow-md fade-in">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <span class="text-2xl text-red-600">⚠️</span>
                            </div>
                        </div>
                        <div class="ml-4">
                            <h3 class="text-lg font-bold text-red-800">System Error</h3>
                            <p class="text-sm text-red-700 mt-1">${safeText(errorMessage)}</p>
                            <div class="mt-4">
                                <button onclick="window.location.reload()" 
                                        class="bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors duration-200">
                                    🔄 Reload Page
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Show message toast
     */
    showMessage(message, type = 'info') {
        // Remove existing message
        const existingMessage = document.querySelector('.message-toast');
        if (existingMessage) existingMessage.remove();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
            type === 'error' ? 'bg-red-500 text-white' : 
            type === 'success' ? 'bg-green-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        messageDiv.textContent = `BKH says: ${safeText(message)}`;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) messageDiv.remove();
        }, 5000);
    }

    /**
     * Handle auth error
     */
    handleAuthError(error) {
        console.error("Auth listener error:", error);
        this.showMessage("Authentication error occurred", "error");
    }

    /**
     * Refresh dashboard
     */
    async refreshDashboard() {
        if (!this.currentUser) return;
        
        const refreshBtn = document.getElementById('globalRefreshBtn');
        const originalText = refreshBtn ? refreshBtn.innerHTML : '';
        
        if (refreshBtn) {
            refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Refreshing...';
            refreshBtn.disabled = true;
        }
        
        try {
            // Clear cache for fresh data
            this.parallelLoader.clearCache();
            
            // Reload data
            const user = auth.currentUser;
            const dashboardData = await this.parallelLoader.loadDashboardData(user);
            
            // Update UI
            await this.renderReportsTab(dashboardData.reportsData, dashboardData.childrenData);
            
            this.showMessage('Dashboard refreshed successfully!', 'success');
            
        } catch (error) {
            console.error("Refresh error:", error);
            this.showMessage('Refresh failed. Please try again.', 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }
        }
    }

    /**
     * Switch main tab
     */
    switchMainTab(tab) {
        const reportTab = document.getElementById('reportTab');
        const academicsTab = document.getElementById('academicsTab');
        const rewardsTab = document.getElementById('rewardsTab');
        
        const reportContentArea = document.getElementById('reportContentArea');
        const academicsContentArea = document.getElementById('academicsContentArea');
        const rewardsContentArea = document.getElementById('rewardsContentArea');
        
        // Deactivate all tabs
        [reportTab, academicsTab, rewardsTab].forEach(t => {
            if (t) {
                t.classList.remove('tab-active-main');
                t.classList.add('tab-inactive-main');
            }
        });
        
        // Hide all content areas
        [reportContentArea, academicsContentArea, rewardsContentArea].forEach(area => {
            if (area) area.classList.add('hidden');
        });
        
        // Activate selected tab
        if (tab === 'reports') {
            if (reportTab) {
                reportTab.classList.remove('tab-inactive-main');
                reportTab.classList.add('tab-active-main');
            }
            if (reportContentArea) reportContentArea.classList.remove('hidden');
        } else if (tab === 'academics') {
            if (academicsTab) {
                academicsTab.classList.remove('tab-inactive-main');
                academicsTab.classList.add('tab-active-main');
            }
            if (academicsContentArea) {
                academicsContentArea.classList.remove('hidden');
                this.loadAcademicsTab();
            }
        } else if (tab === 'rewards') {
            if (rewardsTab) {
                rewardsTab.classList.remove('tab-inactive-main');
                rewardsTab.classList.add('tab-active-main');
            }
            if (rewardsContentArea) rewardsContentArea.classList.remove('hidden');
        }
    }

    /**
     * Load academics tab
     */
    async loadAcademicsTab() {
        const academicsContent = document.getElementById('academicsContent');
        if (!academicsContent) return;
        
        academicsContent.innerHTML = createSkeletonLoader('academics');
        
        try {
            if (!this.currentUser) throw new Error('Please sign in');
            
            // Use parallel loader to find children
            const childrenData = await this.parallelLoader.findChildrenParallel(
                this.currentUser.normalizedPhone
            );
            
            if (childrenData.studentNames.length === 0) {
                academicsContent.innerHTML = `
                    <div class="text-center py-12 fade-in">
                        <div class="text-6xl mb-4">📚</div>
                        <h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
                        <p class="text-gray-500 max-w-md mx-auto">
                            No students are currently assigned to your account. 
                            Please contact administration if you believe this is an error.
                        </p>
                    </div>
                `;
                return;
            }
            
            // Load academics data for all students
            let academicsHtml = '';
            
            // Student selector for multiple students
            if (childrenData.studentNameIdMap.size > 1) {
                academicsHtml += `
                    <div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm slide-down">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
                        <select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                                onchange="window.authManager.onStudentSelected(this.value)">
                            <option value="">All Students</option>
                `;
                
                childrenData.studentNames.forEach(studentName => {
                    const studentInfo = childrenData.allStudentData.find(s => s.name === studentName);
                    const studentStatus = studentInfo?.isPending ? ' (Pending Registration)' : '';
                    academicsHtml += `<option value="${safeText(studentName)}">${capitalize(studentName)}${safeText(studentStatus)}</option>`;
                });
                
                academicsHtml += `
                        </select>
                    </div>
                `;
            }
            
            // Load data for each student
            for (const studentName of childrenData.studentNames) {
                const studentId = childrenData.studentNameIdMap.get(studentName);
                const studentInfo = childrenData.allStudentData.find(s => s.name === studentName);
                
                academicsHtml += this.createStudentAcademicsSection(studentName, studentId, studentInfo);
            }
            
            academicsContent.innerHTML = academicsHtml;
            
            // Update global variables
            window.userChildren = childrenData.studentNames;
            window.studentIdMap = childrenData.studentNameIdMap;
            window.allStudentData = childrenData.allStudentData;
            
        } catch (error) {
            console.error('Error loading academics:', error);
            academicsContent.innerHTML = `
                <div class="text-center py-8 fade-in">
                    <div class="text-4xl mb-4">❌</div>
                    <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Academic Data</h3>
                    <p class="text-gray-500">Unable to load academic data at this time.</p>
                    <button onclick="window.authManager.loadAcademicsTab()" 
                            class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    /**
     * Create student academics section
     */
    createStudentAcademicsSection(studentName, studentId, studentInfo) {
        return `
            <div class="mb-8 fade-in" id="academics-student-${safeText(studentName)}">
                <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6 slide-down">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}${studentInfo?.isPending ? 
                                ' <span class="text-yellow-600 text-sm">(Pending Registration)</span>' : ''}</h2>
                            <p class="text-green-600">Academic progress and assignments</p>
                        </div>
                    </div>
                </div>
                
                <div class="mb-6">
                    <div class="flex items-center mb-4">
                        <span class="text-2xl mr-3">👤</span>
                        <h3 class="text-lg font-semibold text-green-700">Student Information</h3>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-500">Status</p>
                                <p class="font-medium">${studentInfo?.isPending ? 'Pending Registration' : 'Active'}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Assigned Tutor</p>
                                <p class="font-medium">${safeText(studentInfo?.data?.tutorName || 'Not yet assigned')}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mb-6">
                    <button onclick="window.authManager.toggleAcademicsAccordion('session-topics-${safeText(studentName)}')" 
                            class="accordion-header w-full flex justify-between items-center p-4 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-all duration-200 mb-4">
                        <div class="flex items-center">
                            <span class="text-xl mr-3">📝</span>
                            <div class="text-left">
                                <h3 class="font-bold text-blue-800 text-lg">Session Topics</h3>
                                <p class="text-blue-600 text-sm">What your child learned in each session</p>
                            </div>
                        </div>
                        <div class="flex items-center">
                            <span id="session-topics-${safeText(studentName)}-arrow" class="accordion-arrow text-blue-600 text-xl">▼</span>
                        </div>
                    </button>
                    <div id="session-topics-${safeText(studentName)}-content" class="accordion-content hidden">
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <div class="loading-spinner mx-auto"></div>
                            <p class="text-center text-gray-500 mt-2">Loading session topics...</p>
                        </div>
                    </div>
                </div>
                
                <div class="mb-6">
                    <button onclick="window.authManager.toggleAcademicsAccordion('homework-${safeText(studentName)}')" 
                            class="accordion-header w-full flex justify-between items-center p-4 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 transition-all duration-200 mb-4">
                        <div class="flex items-center">
                            <span class="text-xl mr-3">📚</span>
                            <div class="text-left">
                                <h3 class="font-bold text-purple-800 text-lg">Homework Assignments</h3>
                                <p class="text-purple-600 text-sm">Assignments and due dates</p>
                            </div>
                        </div>
                        <span id="homework-${safeText(studentName)}-arrow" class="accordion-arrow text-purple-600 text-xl">▼</span>
                    </button>
                    <div id="homework-${safeText(studentName)}-content" class="accordion-content hidden">
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <div class="loading-spinner mx-auto"></div>
                            <p class="text-center text-gray-500 mt-2">Loading homework assignments...</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                // Load data for this student
                setTimeout(() => {
                    window.authManager.loadStudentAcademicsData('${studentName}', '${studentId}');
                }, 100);
            </script>
        `;
    }

    /**
     * Load student academics data
     */
    async loadStudentAcademicsData(studentName, studentId) {
        if (!studentId) return;
        
        try {
            // Load topics and homework in parallel
            const [topicsSnapshot, homeworkSnapshot] = await Promise.all([
                db.collection('daily_topics')
                    .where('studentId', '==', studentId)
                    .get(),
                db.collection('homework_assignments')
                    .where('studentId', '==', studentId)
                    .get()
            ]);
            
            // Update topics section
            this.updateTopicsSection(studentName, topicsSnapshot);
            
            // Update homework section
            this.updateHomeworkSection(studentName, homeworkSnapshot);
            
        } catch (error) {
            console.error(`Error loading academics for ${studentName}:`, error);
        }
    }

    /**
     * Update topics section
     */
    updateTopicsSection(studentName, snapshot) {
        const contentId = `session-topics-${studentName}-content`;
        const content = document.getElementById(contentId);
        if (!content) return;
        
        if (snapshot.empty) {
            content.innerHTML = `
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <p class="text-gray-500">No session topics recorded yet. Check back after your child's sessions!</p>
                </div>
            `;
            return;
        }
        
        const topics = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.date?.toDate?.()?.getTime() || 
                            data.createdAt?.toDate?.()?.getTime() || 
                            Date.now();
            topics.push({ ...data, timestamp });
        });
        
        // Sort by date
        topics.sort((a, b) => b.timestamp - a.timestamp);
        
        // Filter by month (2nd day rule)
        const now = new Date();
        const currentDay = now.getDate();
        const showPreviousMonth = currentDay === 1 || currentDay === 2;
        
        const filteredTopics = topics.filter(topic => {
            const topicDate = new Date(topic.timestamp);
            const topicMonth = topicDate.getMonth();
            const topicYear = topicDate.getFullYear();
            
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            // Always show current month
            if (topicMonth === currentMonth && topicYear === currentYear) {
                return true;
            }
            
            // Show previous month only on 1st or 2nd
            if (showPreviousMonth) {
                const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                
                if (topicMonth === prevMonth && topicYear === prevYear) {
                    return true;
                }
            }
            
            return false;
        });
        
        if (filteredTopics.length === 0) {
            content.innerHTML = `
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <p class="text-gray-500">No session topics for the selected time period.</p>
                </div>
            `;
            return;
        }
        
        let topicsHtml = '';
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        // Group by month
        const topicsByMonth = {};
        filteredTopics.forEach(topic => {
            const date = new Date(topic.timestamp);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            
            if (!topicsByMonth[monthKey]) {
                topicsByMonth[monthKey] = [];
            }
            topicsByMonth[monthKey].push(topic);
        });
        
        // Display by month
        Object.entries(topicsByMonth).forEach(([monthKey, monthTopics]) => {
            const [year, month] = monthKey.split('-').map(Number);
            const monthName = monthNames[month];
            
            topicsHtml += `
                <div class="mb-6">
                    <h4 class="font-semibold text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">${monthName} ${year}</h4>
                    <div class="space-y-4">
            `;
            
            monthTopics.forEach(topic => {
                const date = new Date(topic.timestamp);
                const formattedDate = date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                topicsHtml += `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <span class="font-medium text-gray-800 text-sm">${formattedDate}</span>
                                <div class="mt-1 flex items-center">
                                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">Session</span>
                                    <span class="text-xs text-gray-600">By: ${safeText(topic.tutorName || topic.updatedBy || 'Tutor')}</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-gray-700 bg-gray-50 p-3 rounded-md">
                            <p class="whitespace-pre-wrap">${safeText(topic.topics || topic.sessionTopics || 'No topics recorded.')}</p>
                        </div>
                        ${topic.notes ? `
                        <div class="mt-3 text-sm">
                            <span class="font-medium text-gray-700">Additional Notes:</span>
                            <p class="text-gray-600 mt-1 bg-yellow-50 p-2 rounded">${safeText(topic.notes)}</p>
                        </div>
                        ` : ''}
                    </div>
                `;
            });
            
            topicsHtml += `
                    </div>
                </div>
            `;
        });
        
        content.innerHTML = topicsHtml;
    }

    /**
     * Update homework section
     */
    updateHomeworkSection(studentName, snapshot) {
        const contentId = `homework-${studentName}-content`;
        const content = document.getElementById(contentId);
        if (!content) return;
        
        if (snapshot.empty) {
            content.innerHTML = `
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <p class="text-gray-500">No homework assignments yet.</p>
                </div>
            `;
            return;
        }
        
        const homeworkList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const dueTimestamp = data.dueDate?.toDate?.()?.getTime() || 
                               new Date(data.dueDate || 0).getTime();
            const assignedTimestamp = data.assignedDate?.toDate?.()?.getTime() || 
                                    data.createdAt?.toDate?.()?.getTime() || 
                                    Date.now();
            
            homeworkList.push({
                id: doc.id,
                ...data,
                dueTimestamp,
                assignedTimestamp
            });
        });
        
        // Sort by due date
        homeworkList.sort((a, b) => a.dueTimestamp - b.dueTimestamp);
        
        // Apply month filtering (2nd day rule)
        const now = new Date();
        const currentDay = now.getDate();
        const showPreviousMonth = currentDay === 1 || currentDay === 2;
        
        const filteredHomework = homeworkList.filter(homework => {
            const dueDate = new Date(homework.dueTimestamp);
            const dueMonth = dueDate.getMonth();
            const dueYear = dueDate.getFullYear();
            
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            // Always show current month
            if (dueMonth === currentMonth && dueYear === currentYear) {
                return true;
            }
            
            // Show previous month only on 1st or 2nd
            if (showPreviousMonth) {
                const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                
                if (dueMonth === prevMonth && dueYear === prevYear) {
                    return true;
                }
            }
            
            // Always show overdue assignments
            if (homework.dueTimestamp < now.getTime()) {
                return true;
            }
            
            // Show upcoming assignments (next month)
            const nextMonth = new Date(currentYear, currentMonth + 1, 1);
            if (dueDate <= nextMonth) {
                return true;
            }
            
            return false;
        });
        
        if (filteredHomework.length === 0) {
            content.innerHTML = `
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <p class="text-gray-500">No homework for the selected time period.</p>
                </div>
            `;
            return;
        }
        
        let homeworkHtml = '';
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        // Group by month
        const homeworkByMonth = {};
        filteredHomework.forEach(homework => {
            const dueDate = new Date(homework.dueTimestamp);
            const monthKey = `${dueDate.getFullYear()}-${dueDate.getMonth()}`;
            
            if (!homeworkByMonth[monthKey]) {
                homeworkByMonth[monthKey] = [];
            }
            homeworkByMonth[monthKey].push(homework);
        });
        
        // Sort months
        const sortedMonths = Object.keys(homeworkByMonth).sort((a, b) => {
            const [aYear, aMonth] = a.split('-').map(Number);
            const [bYear, bMonth] = b.split('-').map(Number);
            return bYear - aYear || bMonth - aMonth;
        });
        
        // Display by month
        sortedMonths.forEach(monthKey => {
            const [year, month] = monthKey.split('-').map(Number);
            const monthName = monthNames[month];
            const monthHomework = homeworkByMonth[monthKey];
            
            homeworkHtml += `
                <div class="mb-6">
                    <h4 class="font-semibold text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">${monthName} ${year}</h4>
                    <div class="space-y-4">
            `;
            
            monthHomework.forEach(homework => {
                const dueDate = new Date(homework.dueTimestamp);
                const assignedDate = new Date(homework.assignedTimestamp);
                const isOverdue = !homework.status && homework.dueTimestamp < Date.now();
                const isSubmitted = ['submitted', 'completed', 'graded'].includes(homework.status);
                
                const statusColor = isOverdue ? 'bg-red-100 text-red-800' : 
                                  isSubmitted ? 'bg-green-100 text-green-800' : 
                                  'bg-blue-100 text-blue-800';
                const statusText = isOverdue ? 'Overdue' : 
                                 isSubmitted ? 'Submitted' : 
                                 'Pending';
                
                homeworkHtml += `
                    <div class="bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h5 class="font-medium text-gray-800 text-lg">${safeText(homework.title || homework.subject || 'Untitled Assignment')}</h5>
                                <div class="mt-1 flex flex-wrap items-center gap-2">
                                    <span class="text-xs ${statusColor} px-2 py-1 rounded-full">${statusText}</span>
                                    <span class="text-xs text-gray-600">Assigned by: ${safeText(homework.tutorName || homework.assignedBy || 'Tutor')}</span>
                                    ${homework.subject ? `<span class="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">${safeText(homework.subject)}</span>` : ''}
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-sm font-medium text-gray-700">Due: ${dueDate.toLocaleDateString()}</span>
                                <div class="text-xs text-gray-500 mt-1">Assigned: ${assignedDate.toLocaleDateString()}</div>
                            </div>
                        </div>
                        
                        <div class="text-gray-700 mb-4">
                            <p class="whitespace-pre-wrap bg-gray-50 p-3 rounded-md">${safeText(homework.description || homework.instructions || 'No description provided.')}</p>
                        </div>
                        
                        <div class="flex justify-between items-center pt-3 border-t border-gray-100">
                            <div class="flex items-center space-x-3">
                                ${homework.fileUrl ? `
                                    <a href="${homework.fileUrl}" target="_blank" class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm">
                                        <span class="mr-1">📎</span> Download Attachment
                                    </a>
                                ` : ''}
                                
                                ${homework.submissionUrl ? `
                                    <a href="${homework.submissionUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 font-medium flex items-center text-sm">
                                        <span class="mr-1">📤</span> View Submission
                                    </a>
                                ` : ''}
                            </div>
                            
                            ${homework.grade ? `
                                <div class="text-sm">
                                    <span class="font-medium text-gray-700">Grade:</span>
                                    <span class="ml-1 font-bold ${homework.grade >= 70 ? 'text-green-600' : homework.grade >= 50 ? 'text-yellow-600' : 'text-red-600'}">
                                        ${homework.grade}%
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            
            homeworkHtml += `
                    </div>
                </div>
            `;
        });
        
        content.innerHTML = homeworkHtml;
    }

    /**
     * Toggle academics accordion
     */
    toggleAcademicsAccordion(sectionId) {
        const content = document.getElementById(`${sectionId}-content`);
        const arrow = document.getElementById(`${sectionId}-arrow`);
        
        if (!content || !arrow) return;
        
        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            arrow.textContent = '▲';
        } else {
            content.classList.add('hidden');
            arrow.textContent = '▼';
        }
    }

    /**
     * Handle student selection
     */
    onStudentSelected(studentName) {
        // Scroll to the selected student's section
        const sectionId = `academics-student-${studentName}`;
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Cleanup
     */
    cleanup() {
        if (this.authListener && typeof this.authListener === 'function') {
            this.authListener();
            this.authListener = null;
        }
        this.isInitialized = false;
    }

    // ============================================================================
    // YEARLY ARCHIVES REPORT VIEW (Preserved from original)
    // ============================================================================
    
    createYearlyArchiveReportView(reportsByStudent) {
        let html = '';
        let studentIndex = 0;
        
        // Sort students alphabetically
        const sortedStudents = Array.from(reportsByStudent.entries())
            .sort((a, b) => a[0].localeCompare(b[0]));
        
        for (const [studentName, reports] of sortedStudents) {
            const fullName = capitalize(studentName);
            const studentData = reports.studentData;
            
            // Count reports
            const assessmentCount = Array.from(reports.assessments.values()).flat().length;
            const monthlyCount = Array.from(reports.monthly.values()).flat().length;
            const totalCount = assessmentCount + monthlyCount;
            
            html += `
                <div class="accordion-item mb-6 fade-in">
                    <button onclick="window.authManager.toggleAccordion('student-${studentIndex}')" 
                            class="accordion-header w-full flex justify-between items-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1">
                        <div class="flex items-center">
                            <div class="mr-4 p-3 bg-green-100 rounded-full">
                                <span class="text-2xl text-green-600">👤</span>
                            </div>
                            <div class="text-left">
                                <h3 class="font-bold text-green-900 text-xl">${fullName}</h3>
                                <div class="flex items-center mt-1">
                                    <span class="text-green-600 text-sm">
                                        ${assessmentCount} Assessment(s) • ${monthlyCount} Monthly Report(s)
                                    </span>
                                    ${studentData?.isPending ? 
                                        '<span class="ml-3 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Pending Registration</span>' : 
                                        '<span class="ml-3 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Active</span>'}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4">
                            <span class="text-green-700 font-semibold">Total: ${totalCount}</span>
                            <span id="student-${studentIndex}-arrow" class="accordion-arrow text-green-600 text-2xl transform transition-transform duration-300">▼</span>
                        </div>
                    </button>
                    <div id="student-${studentIndex}-content" class="accordion-content hidden mt-4">
            `;
            
            if (totalCount === 0) {
                html += this.createEmptyReportsState();
            } else {
                // Group by year (preserved logic)
                const reportsByYear = new Map();
                
                // Process assessments
                for (const [sessionKey, sessionReports] of reports.assessments) {
                    sessionReports.forEach(report => {
                        const year = new Date(report.timestamp * 1000).getFullYear();
                        if (!reportsByYear.has(year)) {
                            reportsByYear.set(year, { assessments: [], monthly: [] });
                        }
                        reportsByYear.get(year).assessments.push({ 
                            sessionKey, 
                            reports: sessionReports,
                            date: new Date(report.timestamp * 1000)
                        });
                    });
                }
                
                // Process monthly
                for (const [sessionKey, sessionReports] of reports.monthly) {
                    sessionReports.forEach(report => {
                        const year = new Date(report.timestamp * 1000).getFullYear();
                        if (!reportsByYear.has(year)) {
                            reportsByYear.set(year, { assessments: [], monthly: [] });
                        }
                        reportsByYear.get(year).monthly.push({ 
                            sessionKey, 
                            reports: sessionReports,
                            date: new Date(report.timestamp * 1000)
                        });
                    });
                }
                
                // Sort years
                const sortedYears = Array.from(reportsByYear.keys()).sort((a, b) => b - a);
                
                // Create year accordions
                let yearIndex = 0;
                for (const year of sortedYears) {
                    const yearData = reportsByYear.get(year);
                    const yearAssessmentCount = yearData.assessments.length;
                    const yearMonthlyCount = yearData.monthly.length;
                    const yearTotal = yearAssessmentCount + yearMonthlyCount;
                    
                    html += `
                        <div class="mb-4 ml-2">
                            <button onclick="window.authManager.toggleAccordion('year-${studentIndex}-${yearIndex}')" 
                                    class="accordion-header w-full flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-300">
                                <div class="flex items-center">
                                    <div class="mr-3 p-2 bg-blue-100 rounded-lg">
                                        <span class="text-xl text-blue-600">📅</span>
                                    </div>
                                    <div class="text-left">
                                        <h4 class="font-bold text-blue-900">${year}</h4>
                                        <p class="text-blue-600 text-sm">
                                            ${yearAssessmentCount} Assessment(s) • ${yearMonthlyCount} Monthly Report(s)
                                        </p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-3">
                                    <span class="text-blue-700 font-medium">${yearTotal} total</span>
                                    <span id="year-${studentIndex}-${yearIndex}-arrow" class="accordion-arrow text-blue-600 transform transition-transform duration-300">▼</span>
                                </div>
                            </button>
                            <div id="year-${studentIndex}-${yearIndex}-content" class="progress-accordion-content hidden ml-6 mt-3">
                    `;
                    
                    // Assessment reports
                    if (yearAssessmentCount > 0) {
                        html += this.createAssessmentReportsSection(yearData.assessments, studentIndex, year, fullName);
                    }
                    
                    // Monthly reports
                    if (yearMonthlyCount > 0) {
                        html += this.createMonthlyReportsSection(yearData.monthly, studentIndex, year, fullName);
                    }
                    
                    html += `
                            </div>
                        </div>
                    `;
                    
                    yearIndex++;
                }
            }
            
            html += `
                    </div>
                </div>
            `;
            
            studentIndex++;
        }
        
        return html;
    }

    /**
     * Create assessment reports section
     */
    createAssessmentReportsSection(assessments, studentIndex, year, fullName) {
        // Group by month
        const assessmentsByMonth = new Map();
        assessments.forEach(({ sessionKey, reports: sessionReports, date }) => {
            const month = date.getMonth();
            if (!assessmentsByMonth.has(month)) {
                assessmentsByMonth.set(month, []);
            }
            assessmentsByMonth.get(month).push({ sessionKey, reports: sessionReports, date });
        });
        
        // Sort months
        const sortedMonths = Array.from(assessmentsByMonth.keys()).sort((a, b) => b - a);
        
        let html = `
            <div class="mb-6">
                <div class="flex items-center mb-4 p-3 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-100 rounded-lg">
                    <div class="mr-3 p-2 bg-purple-100 rounded-lg">
                        <span class="text-xl text-purple-600">📊</span>
                    </div>
                    <div>
                        <h5 class="font-bold text-purple-800">Assessment Reports</h5>
                        <p class="text-purple-600 text-sm">Test scores and performance metrics</p>
                    </div>
                    <span class="ml-auto bg-purple-100 text-purple-800 text-xs font-medium px-3 py-1 rounded-full">
                        ${assessments.length} reports
                    </span>
                </div>
        `;
        
        sortedMonths.forEach(month => {
            const monthName = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ][month];
            const monthAssessments = assessmentsByMonth.get(month);
            
            html += `
                <div class="mb-4 ml-2">
                    <h6 class="font-semibold text-gray-700 mb-3 flex items-center">
                        <span class="mr-2 text-gray-500">📌</span>
                        ${monthName}
                        <span class="ml-2 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
                            ${monthAssessments.length} assessments
                        </span>
                    </h6>
                    <div class="space-y-4">
            `;
            
            monthAssessments.forEach(({ sessionKey, reports: sessionReports, date }, sessionIndex) => {
                html += this.createAssessmentReportHTML(sessionReports, studentIndex, `${year}-${month}-${sessionIndex}`, fullName, date);
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        return html;
    }

    /**
     * Create monthly reports section
     */
    createMonthlyReportsSection(monthly, studentIndex, year, fullName) {
        // Group by month
        const monthlyByMonth = new Map();
        monthly.forEach(({ sessionKey, reports: sessionReports, date }) => {
            const month = date.getMonth();
            if (!monthlyByMonth.has(month)) {
                monthlyByMonth.set(month, []);
            }
            monthlyByMonth.get(month).push({ sessionKey, reports: sessionReports, date });
        });
        
        // Sort months
        const sortedMonths = Array.from(monthlyByMonth.keys()).sort((a, b) => b - a);
        
        let html = `
            <div class="mb-6">
                <div class="flex items-center mb-4 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100 rounded-lg">
                    <div class="mr-3 p-2 bg-teal-100 rounded-lg">
                        <span class="text-xl text-teal-600">📈</span>
                    </div>
                    <div>
                        <h5 class="font-bold text-teal-800">Monthly Reports</h5>
                        <p class="text-teal-600 text-sm">Progress updates and session summaries</p>
                    </div>
                    <span class="ml-auto bg-teal-100 text-teal-800 text-xs font-medium px-3 py-1 rounded-full">
                        ${monthly.length} reports
                    </span>
                </div>
        `;
        
        sortedMonths.forEach(month => {
            const monthName = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ][month];
            const monthReports = monthlyByMonth.get(month);
            
            html += `
                <div class="mb-4 ml-2">
                    <h6 class="font-semibold text-gray-700 mb-3 flex items-center">
                        <span class="mr-2 text-gray-500">📌</span>
                        ${monthName}
                        <span class="ml-2 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">
                            ${monthReports.length} reports
                        </span>
                    </h6>
                    <div class="space-y-4">
            `;
            
            monthReports.forEach(({ sessionKey, reports: sessionReports, date }, sessionIndex) => {
                html += this.createMonthlyReportHTML(sessionReports, studentIndex, `${year}-${month}-${sessionIndex}`, fullName, date);
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        return html;
    }

    /**
     * Create assessment report HTML (preserved from original)
     */
    createAssessmentReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
        const firstReport = sessionReports[0];
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Generate results
        const results = sessionReports.map(testResult => {
            const topics = [...new Set(
                (testResult.answers || [])
                    .map(a => safeText(a.topic))
                    .filter(t => t)
            )] || [];
            
            return {
                subject: safeText(testResult.subject || testResult.testSubject || 'General'),
                correct: testResult.score !== undefined ? testResult.score : 0,
                total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0,
                topics: topics,
            };
        });
        
        // Generate recommendation
        const recommendation = this.generateTemplatedRecommendation(
            fullName, 
            firstReport.tutorName || 'Tutor', 
            results
        );
        
        // Create tables
        const tableRows = results.map(res => `
            <tr>
                <td class="border px-2 py-1">${res.subject.toUpperCase()}</td>
                <td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td>
            </tr>
        `).join("");
        
        const topicsTableRows = results.map(res => `
            <tr>
                <td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td>
                <td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td>
            </tr>
        `).join("");
        
        // Check for creative writing
        const creativeWritingAnswer = firstReport.answers?.find(a => a.type === 'creative-writing');
        const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.';
        
        // Chart ID
        const chartId = `chart-${studentIndex}-${sessionId}`;
        
        return `
            <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${sessionId}">
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
                        <p><strong>Parent's Phone:</strong> ${firstReport.parentPhone || 'N/A'}</p>
                        <p><strong>Grade:</strong> ${firstReport.grade || 'N/A'}</p>
                    </div>
                    <div>
                        <p><strong>Tutor:</strong> ${firstReport.tutorName || 'N/A'}</p>
                        <p><strong>Location:</strong> ${firstReport.studentCountry || 'N/A'}</p>
                    </div>
                </div>
                
                <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Performance Summary</h3>
                <table class="w-full text-sm mb-4 border border-collapse">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border px-2 py-1 text-left">Subject</th>
                            <th class="border px-2 py-1 text-center">Score</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
                
                <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Knowledge & Skill Analysis</h3>
                <table class="w-full text-sm mb-4 border border-collapse">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border px-2 py-1 text-left">Subject</th>
                            <th class="border px-2 py-1 text-left">Topics Covered</th>
                        </tr>
                    </thead>
                    <tbody>${topicsTableRows}</tbody>
                </table>
                
                <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Tutor's Recommendation</h3>
                <p class="mb-2 text-gray-700 leading-relaxed">${recommendation}</p>
                
                ${creativeWritingAnswer ? `
                <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3>
                <p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${tutorReport}</p>
                ` : ''}
                
                ${results.length > 0 ? `
                <canvas id="${chartId}" class="w-full h-48 mb-4"></canvas>
                <script>
                    setTimeout(() => {
                        const ctx = document.getElementById('${chartId}');
                        if (ctx) {
                            new Chart(ctx, {
                                type: 'bar',
                                data: {
                                    labels: ${JSON.stringify(results.map(r => r.subject.toUpperCase()))},
                                    datasets: [
                                        { 
                                            label: 'Correct Answers', 
                                            data: ${JSON.stringify(results.map(s => s.correct))}, 
                                            backgroundColor: '#4CAF50' 
                                        }, 
                                        { 
                                            label: 'Incorrect/Unanswered', 
                                            data: ${JSON.stringify(results.map(s => s.total - s.correct))}, 
                                            backgroundColor: '#FFCD56' 
                                        }
                                    ]
                                },
                                options: {
                                    responsive: true,
                                    scales: { 
                                        x: { stacked: true }, 
                                        y: { stacked: true, beginAtZero: true } 
                                    },
                                    plugins: { 
                                        title: { 
                                            display: true, 
                                            text: 'Score Distribution by Subject' 
                                        } 
                                    }
                                }
                            });
                        }
                    }, 100);
                </script>
                ` : ''}
                
                <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                    <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                    <p class="italic text-sm text-gray-700">
                        At Blooming Kids House, we are committed to helping every child succeed. 
                        We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. 
                        Keep up the great work!<br/>
                        – Mrs. Yinka Isikalu, Director
                    </p>
                </div>
                
                <div class="mt-6 text-center">
                    <button onclick="window.authManager.downloadReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}', 'assessment')" 
                            class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                        Download Assessment PDF
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Create monthly report HTML (preserved from original)
     */
    createMonthlyReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
        const firstReport = sessionReports[0];
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${studentIndex}-${sessionId}">
                <div class="text-center mb-6 border-b pb-4">
                    <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                         alt="Blooming Kids House Logo" 
                         class="h-16 w-auto mx-auto mb-3">
                    <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                    <p class="text-gray-600">Date: ${formattedDate}</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                    <div>
                        <p><strong>Student's Name:</strong> ${firstReport.studentName || 'N/A'}</p>
                        <p><strong>Parent's Name:</strong> ${firstReport.parentName || 'N/A'}</p>
                        <p><strong>Parent's Phone:</strong> ${firstReport.parentPhone || 'N/A'}</p>
                    </div>
                    <div>
                        <p><strong>Grade:</strong> ${firstReport.grade || 'N/A'}</p>
                        <p><strong>Tutor's Name:</strong> ${firstReport.tutorName || 'N/A'}</p>
                    </div>
                </div>
                
                ${firstReport.introduction ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">INTRODUCTION</h3>
                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.introduction)}</p>
                </div>
                ` : ''}
                
                ${firstReport.topics ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3>
                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.topics)}</p>
                </div>
                ` : ''}
                
                ${firstReport.progress ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3>
                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.progress)}</p>
                </div>
                ` : ''}
                
                ${firstReport.strengthsWeaknesses ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3>
                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.strengthsWeaknesses)}</p>
                </div>
                ` : ''}
                
                ${firstReport.recommendations ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3>
                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.recommendations)}</p>
                </div>
                ` : ''}
                
                ${firstReport.generalComments ? `
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3>
                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.generalComments)}</p>
                </div>
                ` : ''}
                
                <div class="text-right mt-8 pt-4 border-t">
                    <p class="text-gray-600">Best regards,</p>
                    <p class="font-semibold text-green-800">${firstReport.tutorName || 'N/A'}</p>
                </div>
                
                <div class="mt-6 text-center">
                    <button onclick="window.authManager.downloadReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}', 'monthly')" 
                            class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                        Download Monthly Report PDF
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Generate templated recommendation (preserved from original)
     */
    generateTemplatedRecommendation(studentName, tutorName, results) {
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
     * Toggle accordion
     */
    toggleAccordion(elementId) {
        const content = document.getElementById(`${elementId}-content`);
        const arrow = document.getElementById(`${elementId}-arrow`);
        
        if (!content || !arrow) return;
        
        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            arrow.textContent = '▲';
        } else {
            content.classList.add('hidden');
            arrow.textContent = '▼';
        }
    }

    /**
     * Download report
     */
    downloadReport(studentIndex, sessionId, studentName, type) {
        const element = document.getElementById(`${type}-block-${studentIndex}-${sessionId}`);
        if (!element) {
            this.showMessage('Report element not found for download', 'error');
            return;
        }
        
        const safeStudentName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
        const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}_${Date.now()}.pdf`;
        
        this.showMessage('Generating PDF download...', 'success');
        
        // Using html2pdf (make sure it's loaded)
        if (typeof html2pdf !== 'undefined') {
            html2pdf().from(element).set({
                margin: 0.5,
                filename: fileName,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true,
                    backgroundColor: '#ffffff'
                },
                jsPDF: { 
                    unit: 'in', 
                    format: 'letter', 
                    orientation: 'portrait' 
                }
            }).save();
        } else {
            this.showMessage('PDF generator not available. Please try again.', 'error');
        }
    }
}

// ============================================================================
// SECTION 5: SETTINGS MANAGER (Preserved with Universal Suffix Matching)
// ============================================================================

class SettingsManager {
    constructor() {
        this.isActive = false;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.injectSettingsUI());
        } else {
            this.injectSettingsUI();
        }
    }

    injectSettingsUI() {
        // Add settings button to dashboard
        const buttonContainer = document.querySelector('.bg-green-50 .flex.gap-2');
        if (buttonContainer && !document.getElementById('settingsBtn')) {
            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'settingsBtn';
            settingsBtn.onclick = () => this.openSettingsTab();
            settingsBtn.className = 'bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200 btn-glow flex items-center justify-center';
            settingsBtn.innerHTML = '<span class="mr-2">⚙️</span> Settings';
            
            const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
            if (logoutBtn) {
                buttonContainer.insertBefore(settingsBtn, logoutBtn);
            } else {
                buttonContainer.appendChild(settingsBtn);
            }
        }

        // Add settings content area
        const mainContainer = document.getElementById('reportArea');
        if (mainContainer && !document.getElementById('settingsContentArea')) {
            const settingsDiv = document.createElement('div');
            settingsDiv.id = 'settingsContentArea';
            settingsDiv.className = 'hidden max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in';
            settingsDiv.innerHTML = `
                <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div class="bg-gray-800 px-6 py-4 flex justify-between items-center">
                        <h2 class="text-xl font-bold text-white flex items-center">
                            <span class="mr-2">⚙️</span> Family Profile & Settings
                        </h2>
                        <button onclick="window.authManager.switchMainTab('reports')" 
                                class="text-gray-300 hover:text-white text-sm">
                            ← Back to Dashboard
                        </button>
                    </div>
                    <div id="settingsDynamicContent" class="p-6">
                        <div class="loading-spinner mx-auto"></div>
                    </div>
                </div>
            `;
            mainContainer.appendChild(settingsDiv);
        }
    }

    async openSettingsTab() {
        // Hide other tabs
        ['reportContentArea', 'academicsContentArea', 'rewardsContentArea'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        // Deactivate tabs
        ['reportTab', 'academicsTab', 'rewardsTab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('tab-active-main');
                el.classList.add('tab-inactive-main');
            }
        });

        // Show settings
        const settingsArea = document.getElementById('settingsContentArea');
        if (settingsArea) {
            settingsArea.classList.remove('hidden');
            await this.loadSettingsData();
        }
    }

    async loadSettingsData() {
        const content = document.getElementById('settingsDynamicContent');
        const user = auth.currentUser;
        if (!user) return;

        try {
            // Get user data
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            const userData = userDoc.data();
            
            // Find children with universal suffix matching
            const normalizedPhone = normalizePhoneNumberGlobal(userData.phone || '');
            const childrenResult = await window.authManager.parallelLoader.findChildrenParallel(
                normalizedPhone.normalized
            );
            
            this.renderSettingsForm(userData, childrenResult.allStudentData);

        } catch (error) {
            console.error("Settings load error:", error);
            content.innerHTML = `<p class="text-red-500">Error loading settings: ${error.message}</p>`;
        }
    }

    renderSettingsForm(userData, students) {
        const content = document.getElementById('settingsDynamicContent');
        
        let html = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1 space-y-6">
                    <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Parent Profile</h3>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                        <input type="text" id="settingParentName" value="${safeText(userData.parentName || 'Parent')}" 
                            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Primary Phone (Login)</label>
                        <input type="text" value="${safeText(userData.phone)}" disabled 
                            class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed">
                        <p class="text-xs text-gray-500 mt-1">To change login phone, please contact support.</p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input type="email" id="settingParentEmail" value="${safeText(userData.email || '')}" 
                            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <button onclick="window.settingsManager.saveParentProfile()" 
                        class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Update My Profile
                    </button>
                </div>

                <div class="md:col-span-2 space-y-6">
                    <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Children & Linked Contacts</h3>
                    
                    ${students.length === 0 ? '<p class="text-gray-500 italic">No students linked yet.</p>' : ''}
                    
                    <div class="space-y-6">
        `;

        students.forEach((student, index) => {
            const data = student.data;
            const gender = data.gender || '';
            const motherPhone = data.motherPhone || '';
            const fatherPhone = data.fatherPhone || '';
            const guardianEmail = data.guardianEmail || '';

            html += `
                <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Student Name</label>
                            <input type="text" id="studentName_${student.id}" value="${safeText(student.name)}" 
                                class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 font-semibold text-gray-800">
                        </div>

                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                            <select id="studentGender_${student.id}" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 bg-white">
                                <option value="" ${gender === '' ? 'selected' : ''}>Select Gender...</option>
                                <option value="Male" ${gender === 'Male' ? 'selected' : ''}>Male</option>
                                <option value="Female" ${gender === 'Female' ? 'selected' : ''}>Female</option>
                            </select>
                        </div>

                        <div class="col-span-2 border-t border-gray-200 pt-3 mt-1">
                            <p class="text-sm font-semibold text-blue-800 mb-2">📞 Additional Contacts (For Access)</p>
                            <p class="text-xs text-gray-500 mb-3">Add Father/Mother numbers here. Anyone with these numbers can log in or view reports.</p>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs text-gray-500">Mother's Phone</label>
                                    <input type="tel" id="motherPhone_${student.id}" value="${safeText(motherPhone)}" placeholder="+1..."
                                        class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500">Father's Phone</label>
                                    <input type="tel" id="fatherPhone_${student.id}" value="${safeText(fatherPhone)}" placeholder="+1..."
                                        class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-xs text-gray-500">Secondary Email (CC for Reports)</label>
                                    <input type="email" id="guardianEmail_${student.id}" value="${safeText(guardianEmail)}" 
                                        class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                            </div>
                        </div>

                        <div class="col-span-2 mt-2 flex justify-end">
                            <button onclick="window.settingsManager.updateStudent('${student.id}', '${student.collection}')" 
                                class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center">
                                <span>💾 Save ${safeText(student.name)}'s Details</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        content.innerHTML = html;
    }

    async saveParentProfile() {
        const user = auth.currentUser;
        if (!user) return;

        const name = document.getElementById('settingParentName')?.value.trim();
        const email = document.getElementById('settingParentEmail')?.value.trim();

        if (!name) {
            window.authManager.showMessage('Name is required', 'error');
            return;
        }

        try {
            const btn = document.querySelector('button[onclick="window.settingsManager.saveParentProfile()"]');
            const originalText = btn?.innerHTML || 'Update My Profile';
            
            if (btn) {
                btn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Saving...';
                btn.disabled = true;
            }

            await db.collection('parent_users').doc(user.uid).update({
                parentName: name,
                email: email
            });

            // Update welcome message
            const welcomeMsg = document.getElementById('welcomeMessage');
            if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${name}!`;

            window.authManager.showMessage('Profile updated successfully!', 'success');
            
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error("Profile update error:", error);
            window.authManager.showMessage('Failed to update profile.', 'error');
        }
    }

    async updateStudent(studentId, collectionName) {
        try {
            const nameInput = document.getElementById(`studentName_${studentId}`);
            const genderInput = document.getElementById(`studentGender_${studentId}`);
            const motherInput = document.getElementById(`motherPhone_${studentId}`);
            const fatherInput = document.getElementById(`fatherPhone_${studentId}`);
            const emailInput = document.getElementById(`guardianEmail_${studentId}`);

            const newName = nameInput?.value.trim();
            const gender = genderInput?.value;
            const motherPhone = motherInput?.value.trim();
            const fatherPhone = fatherInput?.value.trim();
            const email = emailInput?.value.trim();

            if (!newName) {
                window.authManager.showMessage('Student name cannot be empty', 'error');
                return;
            }

            // Show loading
            const btn = document.querySelector(`button[onclick="window.settingsManager.updateStudent('${studentId}', '${collectionName}')"]`);
            const originalText = btn?.innerHTML || 'Save Details';
            
            if (btn) {
                btn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Updating Everywhere...';
                btn.disabled = true;
            }

            // Update student profile
            const updateData = {
                studentName: newName,
                name: newName,
                gender: gender,
                motherPhone: motherPhone,
                fatherPhone: fatherPhone,
                guardianEmail: email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection(collectionName).doc(studentId).update(updateData);

            // Propagate name change to other collections
            await this.propagateStudentNameChange(studentId, newName);

            window.authManager.showMessage(`${newName}'s details updated successfully!`, 'success');
            
            // Restore button
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }

            // Refresh dashboard
            setTimeout(() => {
                if (window.authManager) window.authManager.refreshDashboard();
            }, 1000);

        } catch (error) {
            console.error("Update error:", error);
            window.authManager.showMessage('Error updating student details.', 'error');
        }
    }

    async propagateStudentNameChange(studentId, newName) {
        console.log(`🔄 Propagating name change for ${studentId} to: ${newName}`);
        
        const collections = ['tutor_submissions', 'student_results'];
        
        for (const col of collections) {
            try {
                const snapshot = await db.collection(col)
                    .where('studentId', '==', studentId)
                    .limit(50)
                    .get();

                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        const ref = db.collection(col).doc(doc.id);
                        batch.update(ref, { 
                            studentName: newName,
                            student: newName 
                        });
                    });
                    await batch.commit();
                    console.log(`✅ Updated ${snapshot.size} documents in ${col}`);
                }
            } catch (err) {
                console.warn(`Background update for ${col} failed:`, err);
            }
        }
    }
}

// ============================================================================
// SECTION 6: INITIALIZATION & GLOBAL SETUP
// ============================================================================

function initializeWorldClassPortal() {
    console.log("🚀 Initializing World-Class Parent Portal");
    
    // 1. Inject CSS
    injectWorldClassCSS();
    
    // 2. Create country code dropdown
    createCountryCodeDropdown();
    
    // 3. Setup event listeners
    setupEventListeners();
    
    // 4. Initialize auth manager
    window.authManager = new WorldClassAuthManager();
    window.authManager.initialize();
    
    // 5. Initialize settings manager
    window.settingsManager = new SettingsManager();
    
    // 6. Setup cleanup
    window.addEventListener('beforeunload', () => {
        if (window.authManager) window.authManager.cleanup();
        
        if (window.realTimeListeners) {
            window.realTimeListeners.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') unsubscribe();
            });
        }
    });
    
    console.log("✅ World-Class Portal initialized");
}

// ============================================================================
// SECTION 7: AUTHENTICATION FUNCTIONS (Preserved)
// ============================================================================

// Country code dropdown
function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone')?.parentNode;
    if (!phoneInputContainer) return;
    
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
        { code: '+52', name: 'Mexico (+52)' },
        { code: '+63', name: 'Philippines (+63)' },
        { code: '+65', name: 'Singapore (+65)' },
        { code: '+64', name: 'New Zealand (+64)' },
        { code: '+7', name: 'Russia/Kazakhstan (+7)' },
        { code: '+380', name: 'Ukraine (+380)' },
        { code: '+30', name: 'Greece (+30)' },
        { code: '+43', name: 'Austria (+43)' },
        { code: '+420', name: 'Czech Republic (+420)' },
        { code: '+36', name: 'Hungary (+36)' },
        { code: '+40', name: 'Romania (+40)' }
    ];
    
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = safeText(country.name);
        countryCodeSelect.appendChild(option);
    });
    
    countryCodeSelect.value = '+1';
    
    const phoneInput = document.getElementById('signupPhone');
    if (phoneInput) {
        phoneInput.placeholder = 'Enter phone number without country code';
        phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
        
        container.appendChild(countryCodeSelect);
        container.appendChild(phoneInput);
        phoneInputContainer.appendChild(container);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Sign in
    const signInBtn = document.getElementById('signInBtn');
    if (signInBtn) {
        signInBtn.addEventListener('click', handleSignIn);
    }
    
    // Sign up
    const signUpBtn = document.getElementById('signUpBtn');
    if (signUpBtn) {
        signUpBtn.addEventListener('click', handleSignUp);
    }
    
    // Password reset
    const sendResetBtn = document.getElementById('sendResetBtn');
    if (sendResetBtn) {
        sendResetBtn.addEventListener('click', handlePasswordReset);
    }
    
    // Tab switching
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const cancelResetBtn = document.getElementById('cancelResetBtn');
    
    if (signInTab) signInTab.addEventListener('click', () => switchTab('signin'));
    if (signUpTab) signUpTab.addEventListener('click', () => switchTab('signup'));
    if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', showPasswordResetModal);
    if (cancelResetBtn) cancelResetBtn.addEventListener('click', hidePasswordResetModal);
    
    // Remember me
    const rememberMeCheckbox = document.getElementById('rememberMe');
    if (rememberMeCheckbox) {
        rememberMeCheckbox.addEventListener('change', handleRememberMe);
    }
    
    // Enter key support
    const loginPassword = document.getElementById('loginPassword');
    const signupConfirmPassword = document.getElementById('signupConfirmPassword');
    const resetEmail = document.getElementById('resetEmail');
    
    if (loginPassword) loginPassword.addEventListener('keypress', handleLoginEnter);
    if (signupConfirmPassword) signupConfirmPassword.addEventListener('keypress', handleSignupEnter);
    if (resetEmail) resetEmail.addEventListener('keypress', handleResetEnter);
}

// Authentication functions
async function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    
    if (!identifier || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    const signInBtn = document.getElementById('signInBtn');
    const authLoader = document.getElementById('authLoader');
    
    signInBtn.disabled = true;
    const signInText = document.getElementById('signInText');
    const signInSpinner = document.getElementById('signInSpinner');
    
    if (signInText) signInText.textContent = 'Signing In...';
    if (signInSpinner) signInSpinner.classList.remove('hidden');
    if (authLoader) authLoader.classList.remove('hidden');
    
    try {
        await auth.signInWithEmailAndPassword(identifier, password);
        // Auth state change will be handled by auth manager
    } catch (error) {
        console.error("Sign in error:", error);
        
        let errorMessage = "Failed to sign in. Please check your credentials.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect password.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Invalid email address format.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = "Too many failed attempts. Please try again later.";
        }
        
        showMessage(errorMessage, 'error');
        
        // Reset UI
        signInBtn.disabled = false;
        if (signInText) signInText.textContent = 'Sign In';
        if (signInSpinner) signInSpinner.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    }
}

async function handleSignUp() {
    const countryCode = document.getElementById('countryCode')?.value;
    const localPhone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
    
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
    
    const signUpBtn = document.getElementById('signUpBtn');
    const authLoader = document.getElementById('authLoader');
    
    signUpBtn.disabled = true;
    const signUpText = document.getElementById('signUpText');
    const signUpSpinner = document.getElementById('signUpSpinner');
    
    if (signUpText) signUpText.textContent = 'Creating Account...';
    if (signUpSpinner) signUpSpinner.classList.remove('hidden');
    if (authLoader) authLoader.classList.remove('hidden');
    
    try {
        // Normalize phone with universal suffix
        const fullPhone = countryCode + localPhone;
        const normalizedResult = normalizePhoneNumberGlobal(fullPhone);
        
        if (!normalizedResult.valid) {
            throw new Error(`Invalid phone number: ${normalizedResult.error}`);
        }
        
        // Create user
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Generate referral code
        const referralCode = await generateReferralCode();
        
        // Save to Firestore
        await db.collection('parent_users').doc(user.uid).set({
            email: email,
            phone: normalizedResult.normalized,
            normalizedPhone: normalizedResult.normalized,
            phoneSuffix: normalizedResult.suffix,
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
            uid: user.uid
        });
        
        showMessage('Account created successfully!', 'success');
        
    } catch (error) {
        console.error("Sign up error:", error);
        
        let errorMessage = "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email is already registered. Please sign in instead.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Password should be at least 6 characters.";
        }
        
        showMessage(errorMessage, 'error');
        
        // Reset UI
        signUpBtn.disabled = false;
        if (signUpText) signUpText.textContent = 'Create Account';
        if (signUpSpinner) signUpSpinner.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    }
}

async function handlePasswordReset() {
    const email = document.getElementById('resetEmail')?.value.trim();
    
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }
    
    const sendResetBtn = document.getElementById('sendResetBtn');
    const resetLoader = document.getElementById('resetLoader');
    
    sendResetBtn.disabled = true;
    if (resetLoader) resetLoader.classList.remove('hidden');
    
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email!', 'success');
        hidePasswordResetModal();
    } catch (error) {
        console.error("Reset error:", error);
        let errorMessage = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email address.";
        }
        showMessage(errorMessage, 'error');
    } finally {
        sendResetBtn.disabled = false;
        if (resetLoader) resetLoader.classList.add('hidden');
    }
}

// Generate referral code
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
    return safeText(code);
}

// Helper functions
function switchTab(tab) {
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

function showPasswordResetModal() {
    const modal = document.getElementById("passwordResetModal");
    if (modal) modal.classList.remove("hidden");
}

function hidePasswordResetModal() {
    const modal = document.getElementById("passwordResetModal");
    if (modal) modal.classList.add("hidden");
}

function handleRememberMe() {
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const identifier = document.getElementById('loginIdentifier');
    
    if (!rememberMeCheckbox || !identifier) return;
    
    const rememberMe = rememberMeCheckbox.checked;
    const email = identifier.value.trim();
    
    if (rememberMe && email) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', safeText(email));
    } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
    }
}

function handleLoginEnter(e) {
    if (e.key === 'Enter') handleSignIn();
}

function handleSignupEnter(e) {
    if (e.key === 'Enter') handleSignUp();
}

function handleResetEnter(e) {
    if (e.key === 'Enter') handlePasswordReset();
}

// Logout function
function logout() {
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('isAuthenticated');
    
    auth.signOut().then(() => {
        window.location.reload();
    });
}

// Global message function
function showMessage(message, type) {
    if (window.authManager) {
        window.authManager.showMessage(message, type);
    } else {
        // Fallback if auth manager not initialized
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
            type === 'error' ? 'bg-red-500 text-white' : 
            type === 'success' ? 'bg-green-500 text-white' : 
            'bg-blue-500 text-white'
        }`;
        messageDiv.textContent = `BKH says: ${safeText(message)}`;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) messageDiv.remove();
        }, 5000);
    }
}

// ============================================================================
// INITIALIZE ON DOM LOAD
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM Content Loaded - Starting World-Class Portal");
    
    // Initialize the portal
    initializeWorldClassPortal();
    
    // Load Cloudinary for Google Classroom
    if (!document.getElementById('cloudinary-script')) {
        const script = document.createElement('script');
        script.id = 'cloudinary-script';
        script.src = 'https://upload-widget.cloudinary.com/global/all.js';
        document.head.appendChild(script);
    }
    
    console.log("🎉 World-Class Parent Portal initialized");
});
