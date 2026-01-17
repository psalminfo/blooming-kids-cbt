// ===================================================================
// SECTION 1: APP CONFIGURATION & DEPENDENCIES
// ===================================================================

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

const libphonenumberScript = document.createElement('script');
libphonenumberScript.src = 'https://cdn.jsdelivr.net/npm/libphonenumber-js@1.10.14/bundle/libphonenumber-js.min.js';
document.head.appendChild(libphonenumberScript);

// ===================================================================
// SECTION 2: UTILITY FUNCTIONS (SECURITY, PHONE & UI)
// ===================================================================

/**
 * 🔒 SECURITY CRITICAL: Prevents Cross-Site Scripting (XSS)
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return { normalized: null, valid: false, error: 'Invalid input' };
    try {
        let cleaned = phone.replace(/[^\d+]/g, '').replace(/^0+/, '');
        if (!cleaned.startsWith('+')) cleaned = '+1' + cleaned;
        return { normalized: cleaned, valid: true, error: null };
    } catch (error) {
        return { normalized: null, valid: false, error: error.message };
    }
}

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

function showMessage(message, type) {
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) existingMessage.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    messageDiv.textContent = `BKH says: ${message}`;
    document.body.appendChild(messageDiv);
    setTimeout(() => { if (messageDiv.parentNode) messageDiv.remove(); }, 5000);
}

function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone').parentNode;
    if(document.getElementById('countryCode')) return;

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
        { code: '+91', name: 'India (+91)' },
        { code: '+971', name: 'UAE (+971)' }
    ];
    
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countryCodeSelect.appendChild(option);
    });
    countryCodeSelect.value = '+1';
    
    const phoneInput = document.getElementById('signupPhone');
    phoneInput.placeholder = 'Phone (No Country Code)';
    phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    
    container.appendChild(countryCodeSelect);
    container.appendChild(phoneInput);
    phoneInputContainer.appendChild(container);
}

// ===================================================================
// SECTION 3: STATE MANAGEMENT & REFERRAL SYSTEM
// ===================================================================

let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let unreadMessagesCount = 0;
let realTimeListeners = [];

async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    let code;
    let isUnique = false;

    while (!isUnique) {
        let suffix = '';
        for (let i = 0; i < 6; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        code = prefix + suffix;
        const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snapshot.empty) isUnique = true;
    }
    return code;
}

async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';

    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) return;
        
        const userData = userDoc.data();
        const referralCode = userData.referralCode || 'N/A';
        const totalEarnings = userData.referralEarnings || 0;
        
        const transactionsSnapshot = await db.collection('referral_transactions').where('ownerUid', '==', parentUid).get();
        
        let pendingCount = 0, approvedCount = 0, paidCount = 0;
        let referralsHtml = '';

        if (transactionsSnapshot.empty) {
            referralsHtml = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>`;
        } else {
            const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            transactions.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
            
            transactions.forEach(data => {
                const status = data.status || 'pending';
                if (status === 'pending') pendingCount++;
                if (status === 'approved') approvedCount++;
                if (status === 'paid') paidCount++;
                
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';
                const safeStudentName = escapeHtml(capitalize(data.referredStudentName || 'Unknown'));
                
                referralsHtml += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${safeStudentName}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${data.timestamp?.toDate?.().toLocaleDateString() || 'N/A'}</td>
                        <td class="px-4 py-3 text-sm"><span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">${capitalize(status)}</span></td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">₦${(data.rewardAmount || 5000).toLocaleString()}</td>
                    </tr>`;
            });
        }
        
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${escapeHtml(referralCode)}</p>
                <p class="text-blue-700 mt-2">Share this code! Earn ₦5,000 per student.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600"><p class="text-sm font-medium text-green-700">Total Earnings</p><p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p></div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600"><p class="text-sm font-medium text-yellow-700">Pending/Approved</p><p class="text-3xl font-extrabold text-yellow-900 mt-1">${pendingCount + approvedCount}</p></div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600"><p class="text-sm font-medium text-gray-700">Paid Out</p><p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p></div>
            </div>
            <div class="overflow-x-auto bg-white rounded-lg shadow"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th></tr></thead><tbody class="divide-y divide-gray-200">${referralsHtml}</tbody></table></div>
        `;
    } catch (error) {
        console.error('Error loading referral rewards:', error);
    }
}

// ===================================================================
// SECTION 4: BUSINESS LOGIC & USER IDENTIFICATION HELPERS
// ===================================================================

async function findParentNameFromStudents(parentPhone) {
    try {
        const normalizedPhone = normalizePhoneNumber(parentPhone);
        if (!normalizedPhone.valid) return null;

        const studentsSnapshot = await db.collection("students").where("parentPhone", "==", normalizedPhone.normalized).limit(1).get();
        if (!studentsSnapshot.empty) return studentsSnapshot.docs[0].data().parentName;

        const pendingSnapshot = await db.collection("pending_students").where("parentPhone", "==", normalizedPhone.normalized).limit(1).get();
        if (!pendingSnapshot.empty) return pendingSnapshot.docs[0].data().parentName;

        return null;
    } catch (error) {
        return null;
    }
}

async function findStudentIdsForParent(parentPhone) {
    try {
        const normalizedPhone = normalizePhoneNumber(parentPhone);
        if (!normalizedPhone.valid) return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };

        let studentIds = [];
        let studentNameIdMap = new Map();
        let allStudentData = [];
        
        const processDocs = (snapshot, isPending) => {
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.studentName) {
                    if (!studentIds.includes(doc.id)) studentIds.push(doc.id);
                    studentNameIdMap.set(data.studentName, doc.id);
                    allStudentData.push({ id: doc.id, name: data.studentName, data: data, isPending });
                }
            });
        };

        const studentsSnapshot = await db.collection("students").where("parentPhone", "==", normalizedPhone.normalized).get();
        processDocs(studentsSnapshot, false);

        const pendingSnapshot = await db.collection("pending_students").where("parentPhone", "==", normalizedPhone.normalized).get();
        processDocs(pendingSnapshot, true);

        studentIdMap = studentNameIdMap;
        return { studentIds, studentNameIdMap, allStudentData };
    } catch (error) {
        return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
    }
}

// ===================================================================
// SECTION 5: AUTHENTICATION HANDLERS
// ===================================================================

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

async function handleSignUp() {
    const countryCode = document.getElementById('countryCode').value;
    const localPhone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!countryCode || !localPhone || !email || !password) return showMessage('Please fill in all fields', 'error');
    if (password !== confirmPassword) return showMessage('Passwords do not match', 'error');

    const fullPhoneNumber = countryCode + localPhone.replace(/\D/g, '');
    const normalized = normalizePhoneNumber(fullPhoneNumber);
    if (!normalized.valid) return showMessage('Invalid phone number format', 'error');

    document.getElementById('signUpBtn').disabled = true;
    document.getElementById('authLoader').classList.remove('hidden');

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const parentName = await findParentNameFromStudents(normalized.normalized);
        const referralCode = await generateReferralCode();

        await db.collection('parent_users').doc(user.uid).set({
            phone: fullPhoneNumber,
            normalizedPhone: normalized.normalized,
            email: email,
            parentName: parentName || 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0
        });

        showMessage('Account created successfully!', 'success');
        await loadAllReportsForParent(normalized.normalized, user.uid);
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        document.getElementById('signUpBtn').disabled = false;
        document.getElementById('authLoader').classList.add('hidden');
    }
}

async function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!identifier || !password) return showMessage('Please fill in all fields', 'error');

    document.getElementById('signInBtn').disabled = true;
    document.getElementById('authLoader').classList.remove('hidden');

    try {
        let normalizedPhone;
        let userId;

        if (identifier.includes('@')) {
            const uc = await auth.signInWithEmailAndPassword(identifier, password);
            userId = uc.user.uid;
            const doc = await db.collection('parent_users').doc(userId).get();
            if (doc.exists) normalizedPhone = doc.data().normalizedPhone;
        } else {
            throw new Error("Please login with Email.");
        }

        handleRememberMe();

        if (normalizedPhone) {
            await loadAllReportsForParent(normalizedPhone, userId);
        } else {
             window.location.reload();
        }

    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        document.getElementById('signInBtn').disabled = false;
        document.getElementById('authLoader').classList.add('hidden');
    }
}

async function handlePasswordReset() {
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) return showMessage('Please enter your email address', 'error');

    const sendResetBtn = document.getElementById('sendResetBtn');
    const resetLoader = document.getElementById('resetLoader');
    sendResetBtn.disabled = true;
    resetLoader.classList.remove('hidden');

    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email.', 'success');
        document.getElementById('passwordResetModal').classList.add('hidden');
    } catch (error) {
        showMessage(error.message || 'Failed to send reset email.', 'error');
    } finally {
        sendResetBtn.disabled = false;
        resetLoader.classList.add('hidden');
    }
}

// ===================================================================
// SECTION 6: ENHANCED COMMUNICATION SYSTEM
// ===================================================================

function showComposeMessageModal() {
    populateStudentDropdownForMessages();
    document.getElementById('composeMessageModal').classList.remove('hidden');
}

function hideComposeMessageModal() {
    document.getElementById('composeMessageModal').classList.add('hidden');
    document.getElementById('messageSubject').value = '';
    document.getElementById('messageContent').value = '';
}

function populateStudentDropdownForMessages() {
    const dropdown = document.getElementById('messageStudent');
    dropdown.innerHTML = '<option value="">Select student (optional)</option>';
    userChildren.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = capitalize(name);
        dropdown.appendChild(opt);
    });
}

async function submitMessage() {
    const recipient = document.getElementById('messageRecipient').value;
    const subject = document.getElementById('messageSubject').value.trim();
    const student = document.getElementById('messageStudent').value;
    const content = document.getElementById('messageContent').value.trim();
    const isUrgent = document.getElementById('messageUrgent').checked;

    if (!subject || !content) return showMessage('Please fill in subject and content', 'error');

    const btn = document.getElementById('submitMessageBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        const user = auth.currentUser;
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        let recipientsList = recipient === 'tutor' ? ['tutors'] : recipient === 'management' ? ['management'] : ['tutors', 'management'];

        await db.collection('tutor_messages').add({
            parentName: userData.parentName || 'Parent',
            parentPhone: userData.phone,
            parentEmail: userData.email,
            parentUid: user.uid,
            studentName: student || 'General',
            recipients: recipientsList,
            subject: subject,
            content: content,
            isUrgent: isUrgent,
            status: 'sent',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'parent_to_staff',
            readBy: []
        });

        showMessage('Message sent successfully!', 'success');
        hideComposeMessageModal();
    } catch (error) {
        console.error(error);
        showMessage('Failed to send message', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Message';
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
    const container = document.getElementById('messagesContent');
    container.innerHTML = '<div class="text-center py-8"><div class="loading-spinner"></div></div>';

    try {
        const user = auth.currentUser;
        if (!user) return;

        const msgsSnapshot = await db.collection('tutor_messages').where('parentUid', '==', user.uid).get();
        const feedbackSnapshot = await db.collection('parent_feedback').where('parentUid', '==', user.uid).get();

        let allItems = [];

        msgsSnapshot.forEach(doc => {
            const data = doc.data();
            allItems.push({
                id: doc.id,
                isMessage: true,
                sender: data.type === 'parent_to_staff' ? 'You' : (data.senderName || 'Staff'),
                subject: data.subject,
                content: data.content,
                timestamp: data.timestamp,
                isUrgent: data.isUrgent,
                isOutgoing: data.type === 'parent_to_staff'
            });
        });

        feedbackSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.responses && data.responses.length > 0) {
                data.responses.forEach(resp => {
                    allItems.push({
                        id: doc.id,
                        isMessage: false,
                        sender: resp.responderName || 'Admin',
                        subject: `Re: ${data.category}`,
                        content: resp.responseText,
                        timestamp: resp.responseDate,
                        originalMsg: data.message,
                        isOutgoing: false
                    });
                });
            }
        });

        allItems.sort((a, b) => {
            const tA = a.timestamp?.toDate?.() || new Date(0);
            const tB = b.timestamp?.toDate?.() || new Date(0);
            return tB - tA;
        });

        if (allItems.length === 0) {
            container.innerHTML = `<div class="text-center py-8 text-gray-500">No messages found.</div>`;
            return;
        }

        container.innerHTML = allItems.map(msg => `
            <div class="bg-white border ${msg.isUrgent ? 'border-red-300' : 'border-gray-200'} rounded-xl p-6 mb-4 shadow-sm">
                <div class="flex justify-between mb-2">
                    <h4 class="font-bold text-gray-800">${escapeHtml(msg.subject)} ${msg.isOutgoing ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">OUTGOING</span>' : ''}</h4>
                    <span class="text-xs text-gray-500">${msg.timestamp?.toDate?.().toLocaleDateString()}</span>
                </div>
                <p class="text-sm text-gray-600 mb-2">From: ${escapeHtml(msg.sender)}</p>
                ${msg.originalMsg ? `<div class="text-xs bg-gray-50 p-2 mb-2 italic">You said: ${escapeHtml(msg.originalMsg)}</div>` : ''}
                <div class="bg-green-50 p-3 rounded text-gray-800">${escapeHtml(msg.content)}</div>
            </div>
        `).join('');

    } catch (error) {
        container.innerHTML = '<p class="text-red-500 text-center">Error loading messages.</p>';
    }
}

async function checkForNewMessages() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const msgs = await db.collection('tutor_messages').where('parentUid', '==', user.uid).get();
        const count = msgs.size; 
        if (count > unreadMessagesCount) {
             const badge = document.getElementById('messagesNotificationBadge');
             if(badge) { badge.textContent = 'New'; badge.classList.remove('hidden'); }
        }
        unreadMessagesCount = count;
    } catch (e) { console.log("Bg check failed"); }
}

function resetNotificationCount() {
    const badge = document.getElementById('messagesNotificationBadge');
    if(badge) badge.classList.add('hidden');
}

// ===================================================================
// SECTION 7: ACADEMICS & HOMEWORK SYSTEM (RESTORED DAILY TOPICS)
// ===================================================================

async function loadAcademicsData(selectedStudent = null) {
    const container = document.getElementById('academicsContent');
    container.innerHTML = '<div class="text-center py-8"><div class="loading-spinner"></div></div>';

    try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const parentPhone = userDoc.data().normalizedPhone;
        const { studentNameIdMap, allStudentData } = await findStudentIdsForParent(parentPhone);

        if (studentNameIdMap.size === 0) {
            container.innerHTML = '<div class="text-center py-8">No students found.</div>';
            return;
        }

        let html = '';
        if (studentNameIdMap.size > 1) {
            html += `<div class="mb-6"><select id="studentSelector" class="w-full p-3 border rounded-lg" onchange="loadAcademicsData(this.value)"><option value="">All Students</option>`;
            allStudentData.forEach(s => {
                html += `<option value="${s.name}" ${selectedStudent === s.name ? 'selected' : ''}>${capitalize(s.name)}</option>`;
            });
            html += `</select></div>`;
        }

        const studentsToShow = selectedStudent ? [selectedStudent] : Array.from(studentNameIdMap.keys());

        for (const name of studentsToShow) {
            const id = studentNameIdMap.get(name);
            html += `<div class="bg-green-50 p-4 rounded-lg mb-4"><h3 class="font-bold text-lg text-green-800">${escapeHtml(capitalize(name))}</h3></div>`;

            // 1. Daily Topics (Restored)
            html += `<h4 class="font-bold text-gray-700 mb-2 flex items-center">📅 Daily Topics</h4>`;
            const topicsSnapshot = await db.collection('daily_topics').where('studentId', '==', id).get();
            
            if (topicsSnapshot.empty) {
                html += `<div class="bg-gray-50 p-4 rounded mb-6 text-gray-500">No daily topics recorded yet.</div>`;
            } else {
                let topics = topicsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort client-side
                topics.sort((a, b) => {
                    const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                    const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                    return dateB - dateA;
                });
                
                html += `<div class="space-y-4 mb-8">`;
                topics.slice(0, 5).forEach(topic => {
                    const dateObj = topic.date?.toDate ? topic.date.toDate() : new Date(topic.date);
                    const dateStr = dateObj.toLocaleDateString();
                    html += `
                        <div class="bg-white border p-4 rounded shadow-sm">
                            <div class="flex justify-between items-start mb-2">
                                <span class="font-medium text-gray-800">${dateStr}</span>
                                <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Session</span>
                            </div>
                            <p class="text-gray-700 whitespace-pre-wrap">${escapeHtml(topic.topics)}</p>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            // 2. Homework Assignments
            html += `<h4 class="font-bold text-gray-700 mb-2 flex items-center">📝 Homework</h4>`;
            const hwSnapshot = await db.collection('homework_assignments').where('studentId', '==', id).get();
            if (hwSnapshot.empty) {
                html += `<p class="text-gray-500 mb-8 bg-gray-50 p-4 rounded">No homework assigned.</p>`;
            } else {
                let hwList = hwSnapshot.docs.map(d => d.data());
                hwList.sort((a,b) => (a.dueDate?.toDate?.() || 0) - (b.dueDate?.toDate?.() || 0));
                
                html += `<div class="space-y-4 mb-8">`;
                hwList.forEach(hw => {
                    const due = hw.dueDate?.toDate?.().toLocaleDateString();
                    const isOverdue = (hw.dueDate?.toDate?.() || new Date()) < new Date();
                    html += `
                        <div class="bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} p-4 rounded shadow-sm">
                            <div class="flex justify-between font-bold">
                                <span>${escapeHtml(hw.title)}</span>
                                <span class="text-sm ${isOverdue ? 'text-red-600' : 'text-blue-600'}">Due: ${due}</span>
                            </div>
                            <p class="text-gray-600 mt-2">${escapeHtml(hw.description)}</p>
                            ${hw.fileUrl ? `<a href="${hw.fileUrl}" target="_blank" class="text-blue-600 text-sm mt-2 inline-block">📎 Download Attachment</a>` : ''}
                        </div>`;
                });
                html += `</div>`;
            }
        }
        container.innerHTML = html;

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p class="text-red-500">Error loading data.</p>';
    }
}

// ===================================================================
// SECTION 8: REPORT SEARCH & REAL-TIME MONITORING
// ===================================================================

async function searchReportsByParentPhone(parentPhone) {
    let assessmentResults = [];
    let monthlyResults = [];
    const normalized = normalizePhoneNumber(parentPhone);
    if (!normalized.valid) return { assessmentResults, monthlyResults };

    const assSnapshot = await db.collection("student_results").where("parentPhone", "==", normalized.normalized).get();
    assSnapshot.forEach(doc => assessmentResults.push({ id: doc.id, ...doc.data(), type: 'assessment' }));

    const monSnapshot = await db.collection("tutor_submissions").where("parentPhone", "==", normalized.normalized).get();
    monSnapshot.forEach(doc => monthlyResults.push({ id: doc.id, ...doc.data(), type: 'monthly' }));

    return { assessmentResults, monthlyResults };
}

function setupRealTimeMonitoring(parentPhone, userId) {
    if (realTimeListeners.length > 0) realTimeListeners.forEach(u => u());
    realTimeListeners = [];

    const norm = normalizePhoneNumber(parentPhone).normalized;
    
    realTimeListeners.push(db.collection("student_results").where("parentPhone", "==", norm).onSnapshot(s => {
        if(s.docChanges().some(c => c.type === 'added')) showMessage('New Assessment Report!', 'success');
    }));

    realTimeListeners.push(db.collection("tutor_messages").where("parentUid", "==", userId).onSnapshot(s => {
         if(s.docChanges().some(c => c.type === 'added')) checkForNewMessages();
    }));
}

async function manualRefreshReports() {
    const user = auth.currentUser;
    if (!user) return;
    
    const refreshBtn = document.getElementById('manualRefreshBtn');
    if (!refreshBtn) return;
    
    const originalText = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Checking...';
    refreshBtn.disabled = true;
    
    try {
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            await loadAllReportsForParent(userData.normalizedPhone, user.uid);
            showMessage('Reports refreshed successfully!', 'success');
        }
    } catch (error) {
        console.error('Manual refresh error:', error);
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// ===================================================================
// SECTION 9: CORE REPORT RENDERING (ACCORDION SYSTEM)
// ===================================================================

function downloadSessionReport(studentIndex, sessionIndex, studentName, type) {
    const element = document.getElementById(`${type === 'assessment' ? 'ass' : 'mon'}-block-${studentIndex}-${sessionIndex}`);
    if (!element) return showMessage('Report element not found', 'error');
    
    const safeName = studentName.replace(/ /g, '_');
    const opt = { margin: 0.5, filename: `${type}_Report_${safeName}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter' } };
    
    if (window.html2pdf) {
        html2pdf().from(element).set(opt).save();
    } else {
        showMessage('PDF Library not loaded. Contact support.', 'error');
    }
}

function createAccordionReportView(reportsByStudent) {
    let html = '';
    let idx = 0;
    
    for (const [studentName, reports] of reportsByStudent) {
        const hasReports = reports.assessments.length > 0 || reports.monthly.length > 0;
        
        html += `
            <div class="accordion-item mb-4 border rounded-lg overflow-hidden">
                <button onclick="toggleAccordion('stu-${idx}')" class="w-full flex justify-between p-4 bg-green-100 hover:bg-green-200 transition">
                    <span class="font-bold text-green-900 text-lg">${escapeHtml(capitalize(studentName))}</span>
                    <span class="text-sm text-green-700">${reports.assessments.length} Assessments, ${reports.monthly.length} Monthly</span>
                </button>
                <div id="stu-${idx}" class="hidden bg-white p-4">
        `;

        if (!hasReports) {
            html += `<p class="text-gray-500 text-center py-4">No reports found.</p>`;
        } else {
            // Render Assessments
            if(reports.assessments.length > 0) {
                html += `<h4 class="font-bold text-gray-700 mb-2 border-b pb-1">Assessment Reports</h4>`;
                let aIdx = 0;
                reports.assessments.sort((a,b) => b.timestamp - a.timestamp).forEach(rep => {
                    const date = new Date(rep.timestamp * 1000).toLocaleDateString();
                    html += `
                        <div class="mb-4 border p-3 rounded bg-gray-50" id="ass-block-${idx}-${aIdx}">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-semibold">${date} - ${escapeHtml(rep.subject || 'General')}</span>
                                <div class="flex gap-2 items-center">
                                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Score: ${rep.score}/${rep.totalScoreableQuestions}</span>
                                    <button onclick="downloadSessionReport(${idx}, ${aIdx}, '${escapeHtml(studentName)}', 'assessment')" class="text-green-600 text-xs font-bold">⬇ PDF</button>
                                </div>
                            </div>
                        </div>`;
                    aIdx++;
                });
            }
            
            // Render Monthly
            if(reports.monthly.length > 0) {
                html += `<h4 class="font-bold text-gray-700 mt-4 mb-2 border-b pb-1">Monthly Reports</h4>`;
                let mIdx = 0;
                reports.monthly.sort((a,b) => b.timestamp - a.timestamp).forEach(rep => {
                    const date = new Date(rep.timestamp * 1000).toLocaleDateString();
                    html += `
                        <div class="mb-4 border p-3 rounded bg-gray-50" id="mon-block-${idx}-${mIdx}">
                            <div class="flex justify-between items-center">
                                <span class="font-semibold">${date}</span>
                                <button onclick="downloadSessionReport(${idx}, ${mIdx}, '${escapeHtml(studentName)}', 'monthly')" class="text-green-600 text-xs font-bold">⬇ PDF</button>
                            </div>
                            <p class="text-sm text-gray-600 mt-1">Tutor: ${escapeHtml(rep.tutorName || 'N/A')}</p>
                            <p class="text-sm text-gray-700 mt-2">${escapeHtml(rep.topics?.substring(0,100))}...</p>
                        </div>`;
                    mIdx++;
                });
            }
        }
        
        html += `</div></div>`;
        idx++;
    }
    return html;
}

function toggleAccordion(id) {
    const el = document.getElementById(id);
    el.classList.toggle('hidden');
}

async function loadAllReportsForParent(parentPhone, userId) {
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const reportArea = document.getElementById("reportArea");
    
    authArea.classList.add("hidden");
    reportArea.classList.remove("hidden");
    localStorage.setItem('isAuthenticated', 'true');

    const { assessmentResults, monthlyResults } = await searchReportsByParentPhone(parentPhone);
    const { studentNameIdMap } = await findStudentIdsForParent(parentPhone);
    
    userChildren = Array.from(studentNameIdMap.keys());
    currentUserData = { parentPhone, userId };

    const reportsByStudent = new Map();
    userChildren.forEach(name => reportsByStudent.set(name, { assessments: [], monthly: [] }));
    
    assessmentResults.forEach(r => { if(reportsByStudent.has(r.studentName)) reportsByStudent.get(r.studentName).assessments.push(r); });
    monthlyResults.forEach(r => { if(reportsByStudent.has(r.studentName)) reportsByStudent.get(r.studentName).monthly.push(r); });

    reportContent.innerHTML = createAccordionReportView(reportsByStudent);

    loadReferralRewards(userId);
    loadAcademicsData();
    setupRealTimeMonitoring(parentPhone, userId);
    addMessagesButton();
    addManualRefreshButton();
}

// ===================================================================
// SECTION 10: NAVIGATION & INITIALIZATION
// ===================================================================

function addMessagesButton() {
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container || document.getElementById('viewMessagesBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'viewMessagesBtn';
    btn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 relative';
    btn.innerHTML = '📨 Messages <span id="messagesNotificationBadge" class="hidden absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-6 h-6 flex items-center justify-center animate-pulse">!</span>';
    btn.onclick = showMessagesModal;
    
    const composeBtn = document.createElement('button');
    composeBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700';
    composeBtn.innerHTML = '✏️ Compose';
    composeBtn.onclick = showComposeMessageModal;

    container.insertBefore(composeBtn, container.lastElementChild);
    container.insertBefore(btn, container.lastElementChild);
    
    checkForNewMessages();
}

function addManualRefreshButton() {
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container || document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = manualRefreshReports;
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200';
    refreshBtn.innerHTML = '🔄 Refresh';
    
    container.insertBefore(refreshBtn, container.lastElementChild);
}

function logout() {
    localStorage.clear();
    auth.signOut().then(() => window.location.reload());
}

function switchTab(tab) {
    if (tab === 'signin') {
        document.getElementById('signInForm').classList.remove('hidden');
        document.getElementById('signUpForm').classList.add('hidden');
        document.getElementById('signInTab').classList.add('tab-active');
        document.getElementById('signUpTab').classList.remove('tab-active');
    } else {
        document.getElementById('signInForm').classList.add('hidden');
        document.getElementById('signUpForm').classList.remove('hidden');
        document.getElementById('signUpTab').classList.add('tab-active');
        document.getElementById('signInTab').classList.remove('tab-active');
    }
}

function switchMainTab(tab) {
    ['report', 'academics', 'rewards'].forEach(t => {
        document.getElementById(`${t}ContentArea`).classList.add('hidden');
        document.getElementById(`${t}Tab`).classList.remove('bg-green-600', 'text-white');
    });
    
    document.getElementById(`${tab}ContentArea`).classList.remove('hidden');
    document.getElementById(`${tab}Tab`).classList.add('bg-green-600', 'text-white');
}

document.addEventListener('DOMContentLoaded', () => {
    setupRememberMe();
    createCountryCodeDropdown();
    
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('parent_users').doc(user.uid).get().then(doc => {
                if(doc.exists) loadAllReportsForParent(doc.data().normalizedPhone, user.uid);
            });
        }
    });

    document.getElementById('signInBtn')?.addEventListener('click', handleSignIn);
    document.getElementById('signUpBtn')?.addEventListener('click', handleSignUp);
    document.getElementById('sendResetBtn')?.addEventListener('click', handlePasswordReset);
    document.getElementById('submitMessageBtn')?.addEventListener('click', submitMessage);
    document.getElementById('reportTab')?.addEventListener('click', () => switchMainTab('report'));
    document.getElementById('academicsTab')?.addEventListener('click', () => switchMainTab('academics'));
    document.getElementById('rewardsTab')?.addEventListener('click', () => switchMainTab('rewards'));
    document.getElementById('signInTab')?.addEventListener('click', () => switchTab('signin'));
    document.getElementById('signUpTab')?.addEventListener('click', () => switchTab('signup'));
    
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    if(forgotBtn) forgotBtn.addEventListener('click', () => document.getElementById("passwordResetModal").classList.remove("hidden"));
    
    const cancelResetBtn = document.getElementById('cancelResetBtn');
    if(cancelResetBtn) cancelResetBtn.addEventListener('click', () => document.getElementById("passwordResetModal").classList.add("hidden"));

    document.getElementById('rememberMe')?.addEventListener('change', handleRememberMe);
    
    window.onclick = (e) => {
        if (e.target.classList.contains('fixed')) { 
            e.target.classList.add('hidden');
        }
    };
});
