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

// ============================================================================
// SECTION 1: CYBER SECURITY & UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#039;', '`': '&#x60;', '/': '&#x2F;', '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`/=]/g, m => map[m]);
}

function sanitizeInput(input) {
    return typeof input === 'string' ? escapeHtml(input.trim()) : input;
}

function safeText(text) {
    return typeof text === 'string' ? text.trim() : text;
}

function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    return safeText(str).replace(/\b\w/g, l => l.toUpperCase());
}

// ============================================================================
// SECTION 2: APP CONFIGURATION & INITIALIZATION
// ============================================================================

function injectCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .accordion-content { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
        .accordion-content.hidden { max-height: 0 !important; opacity: 0; padding: 0 !important; margin: 0 !important; display: none !important; }
        .accordion-content:not(.hidden) { max-height: 5000px; opacity: 1; }
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        .slide-down { animation: slideDown 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .loading-spinner { border: 3px solid rgba(0, 0, 0, 0.1); border-radius: 50%; border-top: 3px solid #10B981; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        .loading-spinner-small { border: 2px solid rgba(0, 0, 0, 0.1); border-radius: 50%; border-top: 2px solid #10B981; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .btn-glow:hover { box-shadow: 0 0 15px rgba(16, 185, 129, 0.5); }
        .notification-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
        .accordion-header { transition: all 0.2s ease; }
        .accordion-header:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        .tab-transition { transition: all 0.3s ease; }
    `;
    document.head.appendChild(style);
}

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
        { code: '+1', name: 'USA/Canada (+1)' }, { code: '+234', name: 'Nigeria (+234)' },
        { code: '+44', name: 'UK (+44)' }, { code: '+233', name: 'Ghana (+233)' },
        { code: '+254', name: 'Kenya (+254)' }, { code: '+27', name: 'South Africa (+27)' },
        { code: '+91', name: 'India (+91)' }, { code: '+971', name: 'UAE (+971)' },
        { code: '+966', name: 'Saudi Arabia (+966)' }, { code: '+20', name: 'Egypt (+20)' }
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

function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, valid: false, error: 'Invalid input' };
    }

    try {
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (!cleaned) return { normalized: null, valid: false, error: 'Empty phone number' };
        
        if (cleaned.startsWith('+')) {
            cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
            return { normalized: cleaned, valid: true, error: null };
        } else {
            cleaned = cleaned.replace(/^0+/, '');
            if (cleaned.length <= 10) {
                cleaned = '+1' + cleaned;
            } else {
                const knownCodes = ['234', '44', '91', '86', '33', '49', '81', '61', '55', '7'];
                const possibleCode = cleaned.substring(0, 3);
                if (knownCodes.includes(possibleCode)) {
                    cleaned = '+' + cleaned;
                } else {
                    cleaned = '+1' + cleaned;
                }
            }
            return { normalized: cleaned, valid: true, error: null };
        }
    } catch (error) {
        return { normalized: null, valid: false, error: safeText(error.message) };
    }
}

// ============================================================================
// SECTION 3: GLOBAL VARIABLES & STATE MANAGEMENT
// ============================================================================

let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let unreadMessagesCount = 0;
let unreadAcademicsCount = 0;
let realTimeListeners = [];
let academicsNotifications = new Map();

// CRITICAL: Auth state tracking to prevent loops
let isAuthProcessing = false;
let lastAuthTime = 0;
const AUTH_DEBOUNCE = 3000; // 3 seconds minimum between auth processing

// ============================================================================
// SECTION 4: UI MESSAGE SYSTEM
// ============================================================================

function showMessage(message, type) {
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) existingMessage.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
    }`;
    messageDiv.textContent = `BKH says: ${safeText(message)}`;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => { if (messageDiv.parentNode) messageDiv.remove(); }, 5000);
}

// ============================================================================
// SECTION 5: PHONE VARIATION GENERATOR (CRITICAL FOR FINDING ALL CHILDREN)
// ============================================================================

function generateAllPhoneVariations(phone) {
    const variations = new Set();
    if (!phone || typeof phone !== 'string') return [];
    
    variations.add(phone.trim());
    const basicCleaned = phone.replace(/[^\d+]/g, '');
    variations.add(basicCleaned);
    
    if (basicCleaned.startsWith('+')) {
        variations.add(basicCleaned.substring(1));
    }
    
    const countryCodePatterns = [
        { code: '+1', length: 11 }, { code: '+234', length: 14 }, { code: '+44', length: 13 },
        { code: '+91', length: 13 }, { code: '+86', length: 14 }, { code: '+233', length: 13 },
        { code: '+254', length: 13 }, { code: '+27', length: 12 }, { code: '+971', length: 13 }
    ];
    
    for (const pattern of countryCodePatterns) {
        if (basicCleaned.startsWith(pattern.code)) {
            const withoutCode = basicCleaned.substring(pattern.code.length);
            variations.add(withoutCode);
            variations.add('0' + withoutCode);
            variations.add(pattern.code.substring(1) + withoutCode);
        }
    }
    
    if (basicCleaned.startsWith('0') && basicCleaned.length > 1) {
        const localNumber = basicCleaned.substring(1);
        for (const pattern of countryCodePatterns) {
            variations.add(pattern.code + localNumber);
            variations.add(pattern.code.substring(1) + localNumber);
        }
        variations.add(localNumber);
    }
    
    if (/^\d+$/.test(basicCleaned)) {
        variations.add('+' + basicCleaned);
        if (basicCleaned.length === 10) {
            variations.add('+1' + basicCleaned);
        } else if (basicCleaned.length === 11 && basicCleaned.startsWith('1')) {
            variations.add('+' + basicCleaned);
            variations.add('+1' + basicCleaned.substring(1));
        }
    }
    
    return Array.from(variations)
        .filter(v => v && v.length >= 7 && v.length <= 20)
        .filter((v, i, arr) => arr.indexOf(v) === i);
}

// ============================================================================
// SECTION 6: COMPREHENSIVE CHILD FINDER (FIXES MISSING CHILDREN)
// ============================================================================

async function comprehensiveFindChildren(parentPhone) {
    console.log("🔍 COMPREHENSIVE SEARCH for children with phone:", parentPhone);

    const allChildren = new Map();
    const studentNameIdMap = new Map();

    try {
        const phoneVariations = generateAllPhoneVariations(parentPhone);
        console.log(`📱 Generated ${phoneVariations.length} phone variations`);

        // Search students collection
        for (const phoneVar of phoneVariations) {
            try {
                const snapshot = await db.collection('students')
                    .where('parentPhone', '==', phoneVar)
                    .get();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const studentId = doc.id;
                    const studentName = safeText(data.studentName || data.name || 'Unknown');

                    if (studentName !== 'Unknown' && !allChildren.has(studentId)) {
                        allChildren.set(studentId, {
                            id: studentId, name: studentName, data: data,
                            isPending: false, collection: 'students'
                        });
                        
                        if (studentNameIdMap.has(studentName)) {
                            const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
                            studentNameIdMap.set(uniqueName, studentId);
                        } else {
                            studentNameIdMap.set(studentName, studentId);
                        }
                        console.log(`✅ Found student: ${studentName}`);
                    }
                });
            } catch (error) {
                console.warn(`⚠️ Error searching students with ${phoneVar}:`, error.message);
            }
        }

        // Search pending_students collection
        for (const phoneVar of phoneVariations) {
            try {
                const snapshot = await db.collection('pending_students')
                    .where('parentPhone', '==', phoneVar)
                    .get();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const studentId = doc.id;
                    const studentName = safeText(data.studentName || data.name || 'Unknown');

                    if (studentName !== 'Unknown' && !allChildren.has(studentId)) {
                        allChildren.set(studentId, {
                            id: studentId, name: studentName, data: data,
                            isPending: true, collection: 'pending_students'
                        });
                        
                        if (!studentNameIdMap.has(studentName)) {
                            studentNameIdMap.set(studentName, studentId);
                        }
                        console.log(`✅ Found pending student: ${studentName}`);
                    }
                });
            } catch (error) {
                console.warn(`⚠️ Error searching pending_students:`, error.message);
            }
        }

        const studentNames = Array.from(studentNameIdMap.keys());
        const studentIds = Array.from(allChildren.keys());
        const allStudentData = Array.from(allChildren.values());

        console.log(`📊 FINAL RESULTS: Found ${studentNames.length} children total`);
        console.log("👥 Children:", studentNames);

        return { studentIds, studentNameIdMap, allStudentData, studentNames };

    } catch (error) {
        console.error("❌ Comprehensive search error:", error);
        return {
            studentIds: [], studentNameIdMap: new Map(),
            allStudentData: [], studentNames: []
        };
    }
}

// ============================================================================
// SECTION 7: REFERRAL SYSTEM
// ============================================================================

async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    let code, isUnique = false;

    while (!isUnique) {
        let suffix = '';
        for (let i = 0; i < 6; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        code = prefix + suffix;
        const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snapshot.empty) isUnique = true;
    }
    return safeText(code);
}

async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    if (!rewardsContent) return;
    
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';

    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) {
            rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found.</p>';
            return;
        }
        
        const userData = userDoc.data();
        const referralCode = safeText(userData.referralCode || 'N/A');
        const totalEarnings = userData.referralEarnings || 0;
        
        const transactionsSnapshot = await db.collection('referral_transactions')
            .where('ownerUid', '==', parentUid)
            .get();

        let referralsHtml = '';
        let pendingCount = 0, approvedCount = 0, paidCount = 0;

        if (transactionsSnapshot.empty) {
            referralsHtml = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No referrals yet.</td></tr>';
        } else {
            const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            transactions.sort((a, b) => {
                const aTime = a.timestamp?.toDate?.() || new Date(0);
                const bTime = b.timestamp?.toDate?.() || new Date(0);
                return bTime - aTime;
            });
            
            transactions.forEach(data => {
                const status = safeText(data.status || 'pending');
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
        
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md slide-down">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2">Share this code with other parents. You earn ₦5,000 when their child completes the first month!</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600">
                    <p class="text-sm font-medium text-yellow-700">Approved (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600">
                    <p class="text-sm font-medium text-gray-700">Successful Referrals (Paid)</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>

            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referred</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">${referralsHtml}</tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading referral rewards:', error);
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">Error loading rewards. Please try again.</p>';
    }
}

// ============================================================================
// SECTION 8: MESSAGING SYSTEM
// ============================================================================

function showComposeMessageModal() {
    populateStudentDropdownForMessages();
    document.getElementById('composeMessageModal').classList.remove('hidden');
}

function hideComposeMessageModal() {
    document.getElementById('composeMessageModal').classList.add('hidden');
    document.getElementById('messageRecipient').value = 'tutor';
    document.getElementById('messageSubject').value = '';
    document.getElementById('messageStudent').value = '';
    document.getElementById('messageContent').value = '';
    document.getElementById('messageUrgent').checked = false;
}

function populateStudentDropdownForMessages() {
    const studentDropdown = document.getElementById('messageStudent');
    if (!studentDropdown) return;
    
    studentDropdown.innerHTML = '<option value="">Select student (optional)</option>';
    
    if (userChildren.length === 0) {
        studentDropdown.innerHTML += '<option value="" disabled>No students found</option>';
        return;
    }

    userChildren.forEach(studentName => {
        const option = document.createElement('option');
        option.value = safeText(studentName);
        option.textContent = capitalize(studentName);
        studentDropdown.appendChild(option);
    });
}

async function submitMessage() {
    const recipient = document.getElementById('messageRecipient')?.value;
    const subject = document.getElementById('messageSubject')?.value.trim();
    const student = document.getElementById('messageStudent')?.value;
    const content = document.getElementById('messageContent')?.value.trim();
    const isUrgent = document.getElementById('messageUrgent')?.checked;

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
        if (!user) throw new Error('Please sign in to send messages');

        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        let recipients = [];
        if (recipient === 'tutor') recipients = ['tutors'];
        else if (recipient === 'management') recipients = ['management'];
        else if (recipient === 'both') recipients = ['tutors', 'management'];

        const messageData = {
            parentName: currentUserData?.parentName || safeText(userData.parentName) || 'Unknown Parent',
            parentPhone: userData.phone,
            parentEmail: userData.email,
            parentUid: user.uid,
            studentName: student ? safeText(student) : 'General',
            recipients: recipients,
            subject: safeText(subject),
            content: safeText(content),
            isUrgent: isUrgent,
            status: 'sent',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'parent_to_staff',
            readBy: []
        };

        await db.collection('tutor_messages').add(messageData);
        showMessage('Message sent successfully!', 'success');
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

function showMessagesModal() {
    document.getElementById('messagesModal').classList.remove('hidden');
    loadUnifiedMessages();
    resetNotificationCount();
}

function hideMessagesModal() {
    document.getElementById('messagesModal').classList.add('hidden');
}

async function loadUnifiedMessages() {
    const messagesContent = document.getElementById('messagesContent');
    if (!messagesContent) return;
    
    messagesContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto"></div><p class="text-green-600 font-semibold mt-4">Loading messages...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in to view messages');

        const tutorMessagesSnapshot = await db.collection('tutor_messages')
            .where('parentUid', '==', user.uid)
            .get();

        const feedbackSnapshot = await db.collection('parent_feedback')
            .where('parentUid', '==', user.uid)
            .get();

        const allMessages = [];

        tutorMessagesSnapshot.forEach(doc => {
            const message = doc.data();
            allMessages.push({
                id: doc.id, type: 'tutor_message',
                sender: safeText(message.parentName || 'Tutor/Admin'),
                senderRole: message.type === 'parent_to_staff' ? 'You' : 'Staff',
                subject: safeText(message.subject),
                content: message.type === 'parent_to_staff' ? `You wrote: ${safeText(message.content)}` : safeText(message.content),
                studentName: safeText(message.studentName),
                isUrgent: message.isUrgent || false,
                timestamp: message.timestamp,
                status: message.status || 'sent',
                isOutgoing: message.type === 'parent_to_staff'
            });
        });

        feedbackSnapshot.forEach(doc => {
            const feedback = doc.data();
            if (feedback.responses && Array.isArray(feedback.responses)) {
                feedback.responses.forEach((response, index) => {
                    allMessages.push({
                        id: `${doc.id}_response_${index}`,
                        type: 'feedback_response',
                        sender: safeText(response.responderName || 'Admin'),
                        senderRole: 'Admin',
                        subject: `Re: ${safeText(feedback.category)} - ${safeText(feedback.studentName)}`,
                        content: safeText(response.responseText),
                        studentName: safeText(feedback.studentName),
                        isUrgent: feedback.priority === 'Urgent' || feedback.priority === 'High',
                        timestamp: response.responseDate || feedback.timestamp,
                        originalMessage: safeText(feedback.message)
                    });
                });
            }
        });

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
                    <p class="text-gray-500 max-w-md mx-auto">Send a message using the "Compose" button!</p>
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
                year: 'numeric', month: 'long', day:
                    // CONTINUATION OF PARENT PORTAL - PART 2

// ============================================================================
// CRITICAL: UNIFIED AUTH MANAGER (PREVENTS INFINITE RELOAD)
// ============================================================================

class UnifiedAuthManager {
    constructor() {
        this.currentUser = null;
        this.authListener = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.lastProcessTime = 0;
        this.DEBOUNCE_MS = 3000; // 3 seconds
    }

    initialize() {
        if (this.isInitialized) {
            console.warn("⚠️ Auth manager already initialized, skipping");
            return;
        }

        console.log("🔐 Initializing Unified Auth Manager");
        this.cleanup();

        this.authListener = auth.onAuthStateChanged(
            (user) => this.handleAuthChange(user),
            (error) => this.handleAuthError(error)
        );

        this.isInitialized = true;
        console.log("✅ Auth manager initialized");
    }

    async handleAuthChange(user) {
        const now = Date.now();
        const timeSinceLastProcess = now - this.lastProcessTime;

        // CRITICAL: Prevent rapid successive auth calls
        if (this.isProcessing) {
            console.log("⏸️ Auth change already processing, ignoring");
            return;
        }

        if (timeSinceLastProcess < this.DEBOUNCE_MS) {
            console.log(`⏸️ Debouncing auth (${timeSinceLastProcess}ms < ${this.DEBOUNCE_MS}ms)`);
            return;
        }

        this.isProcessing = true;
        this.lastProcessTime = now;

        try {
            if (user && user.uid) {
                console.log(`👤 User authenticated: ${user.uid.substring(0, 8)}...`);
                await this.loadUserDashboard(user);
            } else {
                console.log("🚪 User signed out");
                this.showAuthScreen();
            }
        } catch (error) {
            console.error("❌ Auth change error:", error);
            showMessage("Authentication error. Please refresh.", "error");
        } finally {
            setTimeout(() => { this.isProcessing = false; }, 1000);
        }
    }

    handleAuthError(error) {
        console.error("❌ Auth listener error:", error);
        showMessage("Authentication error occurred", "error");
    }

    async loadUserDashboard(user) {
        console.log("📊 Loading dashboard");

        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        const authLoader = document.getElementById("authLoader");

        if (authLoader) authLoader.classList.remove("hidden");

        try {
            // 1. Get user data
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                throw new Error("User profile not found");
            }

            const userData = userDoc.data();
            
            // Ensure referral code exists
            if (!userData.referralCode) {
                const newCode = await generateReferralCode();
                await db.collection('parent_users').doc(user.uid).update({ 
                    referralCode: newCode 
                });
                userData.referralCode = newCode;
            }

            this.currentUser = {
                uid: user.uid,
                email: userData.email,
                phone: userData.phone,
                normalizedPhone: userData.normalizedPhone || userData.phone,
                parentName: userData.parentName || 'Parent',
                referralCode: userData.referralCode
            };

            // Store globally
            currentUserData = this.currentUser;

            console.log("👤 User data loaded:", this.currentUser.parentName);

            // 2. Update UI immediately
            this.showDashboardUI();

            // 3. Load all data in parallel (CRITICAL: prevents sequential reloads)
            await Promise.all([
                this.loadAllChildrenAndReports(),
                this.loadReferralsData(),
                this.loadAcademicsData(),
                this.setupRealtimeMonitoring()
            ]);

            // 4. Setup UI components
            this.setupUIComponents();

            console.log("✅ Dashboard fully loaded");

        } catch (error) {
            console.error("❌ Dashboard load error:", error);
            showMessage(error.message || "Failed to load dashboard", "error");
            this.showAuthScreen();
        } finally {
            if (authLoader) authLoader.classList.add("hidden");
        }
    }

    showDashboardUI() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        const welcomeMessage = document.getElementById("welcomeMessage");

        if (authArea) authArea.classList.add("hidden");
        if (reportArea) reportArea.classList.remove("hidden");
        
        if (welcomeMessage && this.currentUser) {
            welcomeMessage.textContent = `Welcome, ${this.currentUser.parentName}!`;
        }

        localStorage.setItem('isAuthenticated', 'true');
    }

    showAuthScreen() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");

        if (authArea) authArea.classList.remove("hidden");
        if (reportArea) reportArea.classList.add("hidden");

        localStorage.removeItem('isAuthenticated');
        cleanupRealTimeListeners();
    }

    async loadAllChildrenAndReports() {
        console.log("🔍 Loading children and reports");

        try {
            // CRITICAL: Use comprehensive search to find ALL children
            const childrenData = await comprehensiveFindChildren(this.currentUser.normalizedPhone);
            
            userChildren = childrenData.studentNames;
            studentIdMap = childrenData.studentNameIdMap;

            console.log(`✅ Found ${userChildren.length} children:`, userChildren);

            // Load reports
            await this.loadReports();

        } catch (error) {
            console.error("❌ Error loading children/reports:", error);
            throw error;
        }
    }

    async loadReports() {
        const reportContent = document.getElementById('reportContent');
        if (!reportContent) return;

        reportContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto"></div><p class="text-green-600 font-semibold mt-4">Loading reports...</p></div>';

        try {
            // Search for all reports
            const { assessmentResults, monthlyResults } = await searchAllReportsForParent(
                this.currentUser.normalizedPhone,
                this.currentUser.email,
                this.currentUser.uid
            );

            // Organize by student
            const reportsByStudent = new Map();

            // Initialize for ALL known students
            userChildren.forEach(studentName => {
                reportsByStudent.set(studentName, {
                    assessments: new Map(),
                    monthly: new Map(),
                    studentData: { name: studentName, isPending: false }
                });
            });

            // Populate assessments
            assessmentResults.forEach(result => {
                const studentName = safeText(result.studentName || result.student);
                if (!studentName) return;

                if (!reportsByStudent.has(studentName)) {
                    reportsByStudent.set(studentName, {
                        assessments: new Map(),
                        monthly: new Map(),
                        studentData: { name: studentName, isPending: false }
                    });
                    userChildren.push(studentName);
                }

                const sessionKey = Math.floor(result.timestamp / 86400);
                const studentRecord = reportsByStudent.get(studentName);
                
                if (!studentRecord.assessments.has(sessionKey)) {
                    studentRecord.assessments.set(sessionKey, []);
                }
                studentRecord.assessments.get(sessionKey).push(result);
            });

            // Populate monthly reports
            monthlyResults.forEach(result => {
                const studentName = safeText(result.studentName || result.student);
                if (!studentName) return;

                if (!reportsByStudent.has(studentName)) {
                    reportsByStudent.set(studentName, {
                        assessments: new Map(),
                        monthly: new Map(),
                        studentData: { name: studentName, isPending: false }
                    });
                    userChildren.push(studentName);
                }

                const sessionKey = Math.floor(result.timestamp / 86400);
                const studentRecord = reportsByStudent.get(studentName);
                
                if (!studentRecord.monthly.has(sessionKey)) {
                    studentRecord.monthly.set(sessionKey, []);
                }
                studentRecord.monthly.get(sessionKey).push(result);
            });

            // Render
            if (reportsByStudent.size === 0) {
                reportContent.innerHTML = `
                    <div class="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                        <div class="text-6xl mb-4">👋</div>
                        <h3 class="text-xl font-bold text-gray-700 mb-2">Welcome to BKH!</h3>
                        <p class="text-gray-500 max-w-md mx-auto mb-6">No students linked to your account yet.</p>
                        <p class="text-sm text-gray-400">Contact support if you've registered.</p>
                    </div>
                `;
            } else {
                const reportsHtml = createYearlyArchiveReportView(reportsByStudent);
                reportContent.innerHTML = reportsHtml;
            }

        } catch (error) {
            console.error("❌ Error loading reports:", error);
            reportContent.innerHTML = `
                <div class="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-md">
                    <h3 class="text-lg font-medium text-red-800">System Error</h3>
                    <p class="text-sm text-red-700 mt-1">Error: ${safeText(error.message)}</p>
                    <button onclick="window.location.reload()" class="mt-3 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200">
                        Reload Page
                    </button>
                </div>
            `;
        }
    }

    async loadReferralsData() {
        try {
            await loadReferralRewards(this.currentUser.uid);
        } catch (error) {
            console.error("⚠️ Error loading referrals:", error);
        }
    }

    async loadAcademicsData() {
        try {
            await loadAcademicsData();
        } catch (error) {
            console.error("⚠️ Error loading academics:", error);
        }
    }

    async setupRealtimeMonitoring() {
        try {
            setupRealTimeMonitoring(this.currentUser.normalizedPhone, this.currentUser.uid);
        } catch (error) {
            console.error("⚠️ Error setting up monitoring:", error);
        }
    }

    setupUIComponents() {
        addMessagesButton();
        addManualRefreshButton();
        addLogoutButton();
    }

    cleanup() {
        if (this.authListener && typeof this.authListener === 'function') {
            console.log("🧹 Cleaning up auth listener");
            this.authListener();
            this.authListener = null;
        }
        this.isInitialized = false;
    }

    async reloadDashboard() {
        if (!this.currentUser) return;
        console.log("🔄 Force reloading dashboard");
        await this.loadAllChildrenAndReports();
    }
}

// Create singleton
const authManager = new UnifiedAuthManager();

// ============================================================================
// REPORT SEARCH FUNCTIONS
// ============================================================================

async function searchAllReportsForParent(parentPhone, parentEmail, parentUid) {
    console.log("🔍 Searching for reports");
    
    let allResults = [];

    try {
        const phoneVariations = generateAllPhoneVariations(parentPhone);
        const collectionsToSearch = ['tutor_submissions', 'student_results'];
        
        const searchPromises = [];
        
        for (const collection of collectionsToSearch) {
            for (const phoneVar of phoneVariations) {
                searchPromises.push(
                    db.collection(collection)
                        .where('parentPhone', '==', phoneVar)
                        .get()
                        .then(snapshot => {
                            const results = [];
                            snapshot.forEach(doc => {
                                const data = doc.data();
                                results.push({
                                    id: doc.id,
                                    collection: collection,
                                    ...data,
                                    timestamp: getTimestampFromData(data),
                                    type: collection.includes('student_results') ? 'assessment' : 'monthly'
                                });
                            });
                            return results;
                        })
                        .catch(() => [])
                );
            }
        }
        
        const allResultsArrays = await Promise.all(searchPromises);
        allResults = allResultsArrays.flat();

        // Remove duplicates
        const uniqueResults = [];
        const seenIds = new Set();
        
        allResults.forEach(result => {
            const uniqueKey = `${result.collection}_${result.id}`;
            if (!seenIds.has(uniqueKey)) {
                seenIds.add(uniqueKey);
                uniqueResults.push(result);
            }
        });

        const assessmentResults = uniqueResults.filter(r => r.type === 'assessment');
        const monthlyResults = uniqueResults.filter(r => r.type === 'monthly');

        assessmentResults.sort((a, b) => b.timestamp - a.timestamp);
        monthlyResults.sort((a, b) => b.timestamp - a.timestamp);

        return { assessmentResults, monthlyResults };

    } catch (error) {
        console.error("❌ Search error:", error);
        return { assessmentResults: [], monthlyResults: [] };
    }
}

function getTimestampFromData(data) {
    const fields = ['timestamp', 'createdAt', 'submittedAt', 'date'];
    
    for (const field of fields) {
        if (data[field]) {
            const ts = data[field]?.toDate?.() || new Date(data[field]);
            if (ts && !isNaN(ts.getTime())) {
                return Math.floor(ts.getTime() / 1000);
            }
        }
    }
    
    return Math.floor(Date.now() / 1000);
}

// ============================================================================
// REPORT VIEW GENERATOR
// ============================================================================

function createYearlyArchiveReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    
    for (const [studentName, reports] of reportsByStudent) {
        const fullName = capitalize(studentName);
        const assessmentCount = Array.from(reports.assessments.values()).flat().length;
        const monthlyCount = Array.from(reports.monthly.values()).flat().length;
        const totalCount = assessmentCount + monthlyCount;
        
        html += `
            <div class="accordion-item mb-4 fade-in">
                <button onclick="toggleAccordion('student-${studentIndex}')" 
                        class="accordion-header w-full flex justify-between items-center p-4 bg-gradient-to-r from-green-100 to-green-50 border border-green-300 rounded-lg hover:bg-green-200">
                    <div class="flex items-center">
                        <span class="text-2xl mr-3">👤</span>
                        <div class="text-left">
                            <h3 class="font-bold text-green-800 text-lg">${fullName}</h3>
                            <p class="text-green-600 text-sm">${assessmentCount} Assessment(s), ${monthlyCount} Monthly Report(s)</p>
                        </div>
                    </div>
                    <span id="student-${studentIndex}-arrow" class="text-green-600 text-xl">▼</span>
                </button>
                <div id="student-${studentIndex}-content" class="accordion-content hidden">
        `;
        
        if (totalCount === 0) {
            html += `
                <div class="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <div class="text-4xl mb-3">📄</div>
                    <h4 class="text-lg font-semibold text-gray-700 mb-2">No Reports Yet</h4>
                    <p class="text-gray-500">Reports will appear here once submitted.</p>
                </div>
            `;
        } else {
            // Group by year
            const reportsByYear = new Map();
            
            for (const [sessionKey, session] of reports.assessments) {
                session.forEach(report => {
                    const year = new Date(report.timestamp * 1000).getFullYear();
                    if (!reportsByYear.has(year)) {
                        reportsByYear.set(year, { assessments: [], monthly: [] });
                    }
                    reportsByYear.get(year).assessments.push({ sessionKey, session });
                });
            }
            
            for (const [sessionKey, session] of reports.monthly) {
                session.forEach(report => {
                    const year = new Date(report.timestamp * 1000).getFullYear();
                    if (!reportsByYear.has(year)) {
                        reportsByYear.set(year, { assessments: [], monthly: [] });
                    }
                    reportsByYear.get(year).monthly.push({ sessionKey, session });
                });
            }
            
            const sortedYears = Array.from(reportsByYear.keys()).sort((a, b) => b - a);
            
            let yearIndex = 0;
            for (const year of sortedYears) {
                const yearData = reportsByYear.get(year);
                
                html += `
                    <div class="mb-4 ml-4">
                        <button onclick="toggleAccordion('year-${studentIndex}-${yearIndex}')" 
                                class="accordion-header w-full flex justify-between items-center p-3 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200">
                            <div class="flex items-center">
                                <span class="text-xl mr-3">📅</span>
                                <h4 class="font-bold text-blue-800">${year}</h4>
                            </div>
                            <span id="year-${studentIndex}-${yearIndex}-arrow" class="text-blue-600">▼</span>
                        </button>
                        <div id="year-${studentIndex}-${yearIndex}-content" class="accordion-content hidden ml-4 mt-2">
                            <div class="space-y-4">
                                ${yearData.assessments.map((item, idx) => createAssessmentReportHTML(item.session, studentIndex, `${year}-a-${idx}`, fullName)).join('')}
                                ${yearData.monthly.map((item, idx) => createMonthlyReportHTML(item.session, studentIndex, `${year}-m-${idx}`, fullName)).join('')}
                            </div>
                        </div>
                    </div>
                `;
                
                yearIndex++;
            }
        }
        
        html += `</div></div>`;
        studentIndex++;
    }
    
    return html;
}

function createAssessmentReportHTML(session, studentIndex, sessionId, fullName) {
    const firstReport = session[0];
    const date = new Date(firstReport.timestamp * 1000);
    const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const results = session.map(test => ({
        subject: safeText(test.subject),
        correct: test.score || 0,
        total: test.totalScoreableQuestions || 0
    }));
    
    return `
        <div class="border rounded-lg shadow mb-4 p-4 bg-white">
            <div class="flex justify-between items-center mb-3">
                <h5 class="font-medium text-gray-800">Assessment - ${formattedDate}</h5>
            </div>
            <table class="w-full text-sm">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="border px-3 py-2 text-left">Subject</th>
                        <th class="border px-3 py-2">Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map(r => `<tr><td class="border px-3 py-2">${r.subject.toUpperCase()}</td><td class="border px-3 py-2 text-center">${r.correct}/${r.total}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function createMonthlyReportHTML(session, studentIndex, sessionId, fullName) {
    const firstReport = session[0];
    const date = new Date(firstReport.timestamp * 1000);
    const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    return `
        <div class="border rounded-lg shadow mb-4 p-4 bg-white">
            <div class="flex justify-between items-center mb-3">
                <h5 class="font-medium text-gray-800">Monthly Report - ${formattedDate}</h5>
            </div>
            <div class="text-sm text-gray-700 space-y-2">
                <p><strong>Tutor:</strong> ${safeText(firstReport.tutorName || 'N/A')}</p>
                <p><strong>Topics:</strong> ${safeText((firstReport.topics || 'N/A').substring(0, 150))}${(firstReport.topics || '').length > 150 ? '...' : ''}</p>
            </div>
        </div>
    `;
}

function toggleAccordion(elementId) {
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

// ============================================================================
// ACADEMICS SYSTEM
// ============================================================================

async function loadAcademicsData(selectedStudent = null) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;
    
    academicsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto"></div><p class="text-green-600 font-semibold mt-4">Loading academic data...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in');

        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        const parentPhone = userData.normalizedPhone || userData.phone;

        const { studentIds, studentNameIdMap } = await comprehensiveFindChildren(parentPhone);
        
        if (studentIds.length === 0) {
            academicsContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📚</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
                </div>
            `;
            return;
        }

        let html = '';
        
        for (const [studentName, studentId] of studentNameIdMap) {
            html += `
                <div class="bg-gradient-to-r from-green-100 to-green-50 p-4 rounded-lg mb-6">
                    <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}</h2>
                    <p class="text-green-600">Academic progress</p>
                </div>
            `;
            
            // Load session topics
            const topicsSnapshot = await db.collection('daily_topics')
                .where('studentId', '==', studentId)
                .limit(10)
                .get();
                
            if (!topicsSnapshot.empty) {
                html += '<div class="space-y-4 mb-6">';
                topicsSnapshot.forEach(doc => {
                    const data = doc.data();
                    const date = data.date?.toDate?.() || new Date();
                    html += `
                        <div class="bg-white border rounded-lg p-4">
                            <p class="text-sm text-gray-600">${date.toLocaleDateString()}</p>
                            <p class="text-gray-700 mt-2">${safeText(data.topics || data.sessionTopics || 'No topics')}</p>
                        </div>
                    `;
                });
                html += '</div>';
            }
        }
        
        academicsContent.innerHTML = html;

    } catch (error) {
        console.error('Error loading academics:', error);
        academicsContent.innerHTML = '<p class="text-red-500 text-center py-8">Error loading data</p>';
    }
}

// ============================================================================
// REAL-TIME MONITORING
// ============================================================================

function setupRealTimeMonitoring(parentPhone, userId) {
    cleanupRealTimeListeners();
    
    const normalizedPhone = normalizePhoneNumber(parentPhone);
    if (!normalizedPhone.valid) return;
    
    const monthlyListener = db.collection("tutor_submissions")
        .where("parentPhone", "==", normalizedPhone.normalized)
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    showMessage("New monthly report available!", "success");
                    setTimeout(() => authManager.reloadDashboard(), 2000);
                }
            });
        }, () => {});
    
    realTimeListeners.push(monthlyListener);
}

function cleanupRealTimeListeners() {
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
    });
    realTimeListeners = [];
}

// ============================================================================
// NOTIFICATION SYSTEM
// ============================================================================

async function checkForNewMessages() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        let totalUnread = 0;
        
        const snapshot = await db.collection('tutor_messages')
            .where('parentUid', '==', user.uid)
            .get();
        
        snapshot.forEach(doc => {
            const message = doc.data();
            if (message.type !== 'parent_to_staff') totalUnread++;
        });

        updateNotificationBadge(totalUnread);
        unreadMessagesCount = totalUnread;

    } catch (error) {
        console.error('Error checking messages:', error);
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

// ============================================================================
// UI COMPONENTS
// ============================================================================

function addMessagesButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer || document.getElementById('viewMessagesBtn')) return;
    
    const viewMessagesBtn = document.createElement('button');
    viewMessagesBtn.id = 'viewMessagesBtn';
    viewMessagesBtn.onclick = showMessagesModal;
    viewMessagesBtn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 btn-glow relative';
    viewMessagesBtn.innerHTML = '<span class="mr-2">📨</span> Messages';
    
    const composeBtn = document.createElement('button');
    composeBtn.id = 'composeMessageBtn';
    composeBtn.onclick = showComposeMessageModal;
    composeBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 btn-glow';
    composeBtn.innerHTML = '<span class="mr-2">✏️</span> Compose';
    
    buttonContainer.insertBefore(composeBtn, buttonContainer.firstChild);
    buttonContainer.insertBefore(viewMessagesBtn, buttonContainer.firstChild);
    
    setTimeout(() => checkForNewMessages(), 1000);
}

function addManualRefreshButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer || document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Refreshing...';
        try {
            await authManager.reloadDashboard();
            showMessage('Dashboard refreshed!', 'success');
        } catch (error) {
            showMessage('Refresh failed', 'error');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Refresh';
        }
    };
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-sem
        // CONTINUATION OF PARENT PORTAL - PART 3 (FINAL)

// Continue addManualRefreshButton
function addManualRefreshButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer || document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Refreshing...';
        try {
            await authManager.reloadDashboard();
            showMessage('Dashboard refreshed!', 'success');
        } catch (error) {
            showMessage('Refresh failed', 'error');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Refresh';
        }
    };
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 btn-glow';
    refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Refresh';
    
    const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        buttonContainer.insertBefore(refreshBtn, logoutBtn);
    } else {
        buttonContainer.appendChild(refreshBtn);
    }
}

function addLogoutButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer || buttonContainer.querySelector('button[onclick="logout()"]')) return;
    
    const logoutBtn = document.createElement('button');
    logoutBtn.onclick = logout;
    logoutBtn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 btn-glow';
    logoutBtn.innerHTML = '<span class="mr-2">🚪</span> Logout';
    
    buttonContainer.appendChild(logoutBtn);
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

function setupRememberMe() {
    const rememberMe = localStorage.getItem('rememberMe');
    const savedEmail = localStorage.getItem('savedEmail');
    
    if (rememberMe === 'true' && savedEmail) {
        const loginIdentifier = document.getElementById('loginIdentifier');
        const rememberMeCheckbox = document.getElementById('rememberMe');
        
        if (loginIdentifier) loginIdentifier.value = safeText(savedEmail);
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

function handleRememberMe() {
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const identifier = document.getElementById('loginIdentifier');
    
    if (!rememberMeCheckbox || !identifier) return;
    
    if (rememberMeCheckbox.checked && identifier.value.trim()) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', safeText(identifier.value.trim()));
    } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
    }
}

async function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!identifier || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    const signInBtn = document.getElementById('signInBtn');
    const signInText = document.getElementById('signInText');
    const signInSpinner = document.getElementById('signInSpinner');

    signInBtn.disabled = true;
    signInText.textContent = 'Signing In...';
    signInSpinner.classList.remove('hidden');

    try {
        // CRITICAL: Don't call loadUserDashboard here - let authManager handle it
        await auth.signInWithEmailAndPassword(identifier, password);
        
        // Save remember me preference
        handleRememberMe();
        
        console.log("✅ Sign in successful - authManager will handle dashboard load");

    } catch (error) {
        console.error("Sign In Error:", error);
        
        let errorMessage = "Failed to sign in. Please check your credentials.";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect password.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Invalid email address format.";
        }
        
        showMessage(errorMessage, 'error');
        
        signInBtn.disabled = false;
        signInText.textContent = 'Sign In';
        signInSpinner.classList.add('hidden');
    }
}

async function handleSignUp() {
    const countryCode = document.getElementById('countryCode')?.value;
    const localPhone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;

    if (!countryCode || !localPhone || !email || !password || !confirmPassword) {
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

    const signUpBtn = document.getElementById('signUpBtn');
    const signUpText = document.getElementById('signUpText');
    const signUpSpinner = document.getElementById('signUpSpinner');

    signUpBtn.disabled = true;
    signUpText.textContent = 'Creating Account...';
    signUpSpinner.classList.remove('hidden');

    try {
        let fullPhoneInput = localPhone.startsWith('+') ? localPhone : countryCode + localPhone;
        const normalizedResult = normalizePhoneNumber(fullPhoneInput);
        
        if (!normalizedResult.valid) {
            throw new Error(`Invalid phone number: ${normalizedResult.error}`);
        }
        
        const finalPhone = normalizedResult.normalized;

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const referralCode = await generateReferralCode();

        await db.collection('parent_users').doc(user.uid).set({
            email: email,
            phone: finalPhone,
            normalizedPhone: finalPhone,
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
            uid: user.uid
        });

        console.log("✅ Account created successfully");
        showMessage('Account created successfully!', 'success');
        
        // authManager will handle the dashboard load

    } catch (error) {
        console.error("Sign Up Error:", error);
        
        let errorMessage = "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email is already registered.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Password should be at least 6 characters.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        showMessage(errorMessage, 'error');

        signUpBtn.disabled = false;
        signUpText.textContent = 'Create Account';
        signUpSpinner.classList.add('hidden');
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
    resetLoader.classList.remove('hidden');

    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email!', 'success');
        hidePasswordResetModal();
    } catch (error) {
        console.error("Reset Error:", error);
        let errorMessage = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email.";
        }
        showMessage(errorMessage, 'error');
    } finally {
        sendResetBtn.disabled = false;
        resetLoader.classList.add('hidden');
    }
}

function logout() {
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('isAuthenticated');
    
    cleanupRealTimeListeners();
    authManager.cleanup();
    
    auth.signOut().then(() => {
        console.log("✅ User logged out");
        window.location.reload();
    });
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

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

function switchMainTab(tab) {
    const reportTab = document.getElementById('reportTab');
    const academicsTab = document.getElementById('academicsTab');
    const rewardsTab = document.getElementById('rewardsTab');
    
    const reportContentArea = document.getElementById('reportContentArea');
    const academicsContentArea = document.getElementById('academicsContentArea');
    const rewardsContentArea = document.getElementById('rewardsContentArea');
    
    reportTab?.classList.remove('tab-active-main');
    reportTab?.classList.add('tab-inactive-main');
    academicsTab?.classList.remove('tab-active-main');
    academicsTab?.classList.add('tab-inactive-main');
    rewardsTab?.classList.remove('tab-active-main');
    rewardsTab?.classList.add('tab-inactive-main');
    
    reportContentArea?.classList.add('hidden');
    academicsContentArea?.classList.add('hidden');
    rewardsContentArea?.classList.add('hidden');
    
    if (tab === 'reports') {
        reportTab?.classList.remove('tab-inactive-main');
        reportTab?.classList.add('tab-active-main');
        reportContentArea?.classList.remove('hidden');
    } else if (tab === 'academics') {
        academicsTab?.classList.remove('tab-inactive-main');
        academicsTab?.classList.add('tab-active-main');
        academics
        // CONTINUATION OF PARENT PORTAL - PART 3 (FINAL)

// Continue addManualRefreshButton
function addManualRefreshButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer || document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Refreshing...';
        try {
            await authManager.reloadDashboard();
            showMessage('Dashboard refreshed!', 'success');
        } catch (error) {
            showMessage('Refresh failed', 'error');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Refresh';
        }
    };
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 btn-glow';
    refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Refresh';
    
    const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        buttonContainer.insertBefore(refreshBtn, logoutBtn);
    } else {
        buttonContainer.appendChild(refreshBtn);
    }
}

function addLogoutButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer || buttonContainer.querySelector('button[onclick="logout()"]')) return;
    
    const logoutBtn = document.createElement('button');
    logoutBtn.onclick = logout;
    logoutBtn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 btn-glow';
    logoutBtn.innerHTML = '<span class="mr-2">🚪</span> Logout';
    
    buttonContainer.appendChild(logoutBtn);
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

function setupRememberMe() {
    const rememberMe = localStorage.getItem('rememberMe');
    const savedEmail = localStorage.getItem('savedEmail');
    
    if (rememberMe === 'true' && savedEmail) {
        const loginIdentifier = document.getElementById('loginIdentifier');
        const rememberMeCheckbox = document.getElementById('rememberMe');
        
        if (loginIdentifier) loginIdentifier.value = safeText(savedEmail);
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }
}

function handleRememberMe() {
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const identifier = document.getElementById('loginIdentifier');
    
    if (!rememberMeCheckbox || !identifier) return;
    
    if (rememberMeCheckbox.checked && identifier.value.trim()) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', safeText(identifier.value.trim()));
    } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
    }
}

async function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!identifier || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    const signInBtn = document.getElementById('signInBtn');
    const signInText = document.getElementById('signInText');
    const signInSpinner = document.getElementById('signInSpinner');

    signInBtn.disabled = true;
    signInText.textContent = 'Signing In...';
    signInSpinner.classList.remove('hidden');

    try {
        // CRITICAL: Don't call loadUserDashboard here - let authManager handle it
        await auth.signInWithEmailAndPassword(identifier, password);
        
        // Save remember me preference
        handleRememberMe();
        
        console.log("✅ Sign in successful - authManager will handle dashboard load");

    } catch (error) {
        console.error("Sign In Error:", error);
        
        let errorMessage = "Failed to sign in. Please check your credentials.";
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email.";
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect password.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Invalid email address format.";
        }
        
        showMessage(errorMessage, 'error');
        
        signInBtn.disabled = false;
        signInText.textContent = 'Sign In';
        signInSpinner.classList.add('hidden');
    }
}

async function handleSignUp() {
    const countryCode = document.getElementById('countryCode')?.value;
    const localPhone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;

    if (!countryCode || !localPhone || !email || !password || !confirmPassword) {
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

    const signUpBtn = document.getElementById('signUpBtn');
    const signUpText = document.getElementById('signUpText');
    const signUpSpinner = document.getElementById('signUpSpinner');

    signUpBtn.disabled = true;
    signUpText.textContent = 'Creating Account...';
    signUpSpinner.classList.remove('hidden');

    try {
        let fullPhoneInput = localPhone.startsWith('+') ? localPhone : countryCode + localPhone;
        const normalizedResult = normalizePhoneNumber(fullPhoneInput);
        
        if (!normalizedResult.valid) {
            throw new Error(`Invalid phone number: ${normalizedResult.error}`);
        }
        
        const finalPhone = normalizedResult.normalized;

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const referralCode = await generateReferralCode();

        await db.collection('parent_users').doc(user.uid).set({
            email: email,
            phone: finalPhone,
            normalizedPhone: finalPhone,
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
            uid: user.uid
        });

        console.log("✅ Account created successfully");
        showMessage('Account created successfully!', 'success');
        
        // authManager will handle the dashboard load

    } catch (error) {
        console.error("Sign Up Error:", error);
        
        let errorMessage = "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email is already registered.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Password should be at least 6 characters.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        showMessage(errorMessage, 'error');

        signUpBtn.disabled = false;
        signUpText.textContent = 'Create Account';
        signUpSpinner.classList.add('hidden');
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
    resetLoader.classList.remove('hidden');

    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email!', 'success');
        hidePasswordResetModal();
    } catch (error) {
        console.error("Reset Error:", error);
        let errorMessage = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') {
            errorMessage = "No account found with this email.";
        }
        showMessage(errorMessage, 'error');
    } finally {
        sendResetBtn.disabled = false;
        resetLoader.classList.add('hidden');
    }
}

function logout() {
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('isAuthenticated');
    
    cleanupRealTimeListeners();
    authManager.cleanup();
    
    auth.signOut().then(() => {
        console.log("✅ User logged out");
        window.location.reload();
    });
}

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

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

function switchMainTab(tab) {
    const reportTab = document.getElementById('reportTab');
    const academicsTab = document.getElementById('academicsTab');
    const rewardsTab = document.getElementById('rewardsTab');
    
    const reportContentArea = document.getElementById('reportContentArea');
    const academicsContentArea = document.getElementById('academicsContentArea');
    const rewardsContentArea = document.getElementById('rewardsContentArea');
    
    reportTab?.classList.remove('tab-active-main');
    reportTab?.classList.add('tab-inactive-main');
    academicsTab?.classList.remove('tab-active-main');
    academicsTab?.classList.add('tab-inactive-main');
    rewardsTab?.classList.remove('tab-active-main');
    rewardsTab?.classList.add('tab-inactive-main');
    
    reportContentArea?.classList.add('hidden');
    academicsContentArea?.classList.add('hidden');
    rewardsContentArea?.classList.add('hidden');
    
    if (tab === 'reports') {
        reportTab?.classList.remove('tab-inactive-main');
        reportTab?.classList.add('tab-active-main');
        reportContentArea?.classList.remove('hidden');
    } else if (tab === 'academics') {
        academicsTab?.classList.remove('tab-inactive-main');
        academicsTab?.classList.add('tab-active-main');
        academicsContentArea?.classList.remove('hidden');
        loadAcademicsData();
    } else if (tab === 'rewards') {
        rewardsTab?.classList.remove('tab-inactive-main');
        rewardsTab?.classList.add('tab-active-main');
        rewardsContentArea?.classList.remove('hidden');
        const user = auth.currentUser;
        if (user) loadReferralRewards(user.uid);
    }
}

// ============================================================================
// MODAL FUNCTIONS
// ============================================================================

function showPasswordResetModal() {
    document.getElementById("passwordResetModal")?.classList.remove("hidden");
}

function hidePasswordResetModal() {
    document.getElementById("passwordResetModal")?.classList.add("hidden");
    const resetEmail = document.getElementById('resetEmail');
    if (resetEmail) resetEmail.value = '';
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
    console.log("🔧 Setting up event listeners");
    
    // Auth buttons
    const signInBtn = document.getElementById("signInBtn");
    const signUpBtn = document.getElementById("signUpBtn");
    const sendResetBtn = document.getElementById("sendResetBtn");
    const submitMessageBtn = document.getElementById("submitMessageBtn");
    
    if (signInBtn) {
        signInBtn.removeEventListener("click", handleSignIn);
        signInBtn.addEventListener("click", handleSignIn);
    }
    
    if (signUpBtn) {
        signUpBtn.removeEventListener("click", handleSignUp);
        signUpBtn.addEventListener("click", handleSignUp);
    }
    
    if (sendResetBtn) {
        sendResetBtn.removeEventListener("click", handlePasswordReset);
        sendResetBtn.addEventListener("click", handlePasswordReset);
    }
    
    if (submitMessageBtn) {
        submitMessageBtn.removeEventListener("click", submitMessage);
        submitMessageBtn.addEventListener("click", submitMessage);
    }
    
    // Tab switching
    const signInTab = document.getElementById("signInTab");
    const signUpTab = document.getElementById("signUpTab");
    
    if (signInTab) {
        signInTab.removeEventListener("click", () => switchTab('signin'));
        signInTab.addEventListener("click", () => switchTab('signin'));
    }
    
    if (signUpTab) {
        signUpTab.removeEventListener("click", () => switchTab('signup'));
        signUpTab.addEventListener("click", () => switchTab('signup'));
    }
    
    // Password reset
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    const cancelResetBtn = document.getElementById("cancelResetBtn");
    
    if (forgotPasswordBtn) {
        forgotPasswordBtn.removeEventListener("click", showPasswordResetModal);
        forgotPasswordBtn.addEventListener("click", showPasswordResetModal);
    }
    
    if (cancelResetBtn) {
        cancelResetBtn.removeEventListener("click", hidePasswordResetModal);
        cancelResetBtn.addEventListener("click", hidePasswordResetModal);
    }
    
    // Remember me
    const rememberMeCheckbox = document.getElementById("rememberMe");
    if (rememberMeCheckbox) {
        rememberMeCheckbox.removeEventListener("change", handleRememberMe);
        rememberMeCheckbox.addEventListener("change", handleRememberMe);
    }
    
    // Enter key support
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
    
    // Main tabs
    const reportTab = document.getElementById("reportTab");
    const academicsTab = document.getElementById("academicsTab");
    const rewardsTab = document.getElementById("rewardsTab");
    
    if (reportTab) reportTab.addEventListener("click", () => switchMainTab('reports'));
    if (academicsTab) academicsTab.addEventListener("click", () => switchMainTab('academics'));
    if (rewardsTab) rewardsTab.addEventListener("click", () => switchMainTab('rewards'));
    
    // Dynamic event delegation
    document.addEventListener('click', function(event) {
        if (event.target.id === 'cancelMessageBtn' || event.target.closest('#cancelMessageBtn')) {
            event.preventDefault();
            hideComposeMessageModal();
        }
        
        if (event.target.id === 'cancelMessagesModalBtn' || event.target.closest('#cancelMessagesModalBtn')) {
            event.preventDefault();
            hideMessagesModal();
        }
    });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

function setupGlobalErrorHandler() {
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault();
    });
    
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        if (!e.error?.message?.includes('auth') && !e.error?.message?.includes('permission-denied')) {
            showMessage('An unexpected error occurred.', 'error');
        }
        e.preventDefault();
    });
}

// ============================================================================
// INITIALIZATION (SINGLE ENTRY POINT - PREVENTS RELOAD LOOP)
// ============================================================================

function initializeParentPortal() {
    console.log("🚀 Initializing Parent Portal V2 (No Reload Edition)");

    // 1. Setup UI first
    setupRememberMe();
    injectCustomCSS();
    createCountryCodeDropdown();
    setupEventListeners();
    setupGlobalErrorHandler();

    // 2. Initialize auth manager (CRITICAL: Single source of truth)
    authManager.initialize();

    // 3. Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        authManager.cleanup();
        cleanupRealTimeListeners();
    });

    console.log("✅ Parent Portal V2 initialized");
}

// ============================================================================
// PAGE LOAD
// ============================================================================

// CRITICAL: Only initialize ONCE when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("📄 DOM Content Loaded");
    
    // Prevent multiple initializations
    if (window.portalInitialized) {
        console.warn("⚠️ Portal already initialized, skipping");
        return;
    }
    
    window.portalInitialized = true;
    
    // Initialize portal
    initializeParentPortal();
    
    console.log("🎉 Parent Portal ready");
});

// ============================================================================
// GLOBAL EXPORTS (for debugging)
// ============================================================================

window.authManager = authManager;
window.comprehensiveFindChildren = comprehensiveFindChildren;
window.toggleAccordion = toggleAccordion;
window.switchTab = switchTab;
window.switchMainTab = switchMainTab;
window.logout = logout;
window.showComposeMessageModal = showComposeMessageModal;
window.hideComposeMessageModal = hideComposeMessageModal;
window.showMessagesModal = showMessagesModal;
window.hideMessagesModal = hideMessagesModal;

console.log("✅ Parent Portal - All sections loaded");
