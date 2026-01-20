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

// XSS Protection - Escape HTML to prevent injection attacks
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
    return text.replace(/[&<>"'`/=]/g, function(m) { return map[m]; });
}

// Sanitize user input for safe rendering
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return escapeHtml(input.trim());
    }
    return input;
}

// Safe text content helper (doesn't escape HTML for rendering)
function safeText(text) {
    if (text === undefined || text === null) return "";
    if (typeof text !== 'string') return String(text);
    return text.trim();
}

// Capitalize names safely
function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    const cleaned = safeText(str);
    return cleaned.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generates a unique, personalized recommendation using a smart template.
 * (Restored from Old System)
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

// ============================================================================
// SECTION 2: APP CONFIGURATION & INITIALIZATION
// ============================================================================

// Inject custom CSS for smooth animations and transitions
function injectCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Smooth transitions */
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
            max-height: 10000px;
            opacity: 1;
        }
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        .slide-down { animation: slideDown 0.3s ease-out; }
        .preserve-whitespace { white-space: pre-wrap; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        /* Loading animations */
        .loading-spinner {
            border: 3px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 3px solid #10B981;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }
        .loading-spinner-small {
            border: 2px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 2px solid #10B981;
            width: 16px;
            height: 16px;
            animation: spin 1s linear infinite;
            display: inline-block;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .btn-glow:hover { box-shadow: 0 0 15px rgba(16, 185, 129, 0.5); }
    `;
    document.head.appendChild(style);
}

// Create country code dropdown
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
        { code: '+91', name: 'India (+91)' }, { code: '+971', name: 'UAE (+971)' }
        // Add other countries as needed
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

// Normalize Phone Number
function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return { normalized: null, valid: false, error: 'Invalid input' };
    try {
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (!cleaned) return { normalized: null, valid: false, error: 'Empty phone number' };
        if (cleaned.startsWith('+')) {
            cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
            return { normalized: cleaned, valid: true, error: null };
        } else {
            cleaned = cleaned.replace(/^0+/, '');
            if (cleaned.length <= 10) cleaned = '+1' + cleaned;
            else cleaned = '+1' + cleaned; // Default fallback
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
let allStudentData = [];
let unreadMessagesCount = 0;
let realTimeListeners = [];
let pendingChartConfigs = []; // Stores chart configs to render after HTML injection

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
// SECTION 5: REFERRAL SYSTEM FUNCTIONS
// ============================================================================

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
    return safeText(code);
}

async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    if (!rewardsContent) return;
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';

    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) return;
        const userData = userDoc.data();
        const referralCode = safeText(userData.referralCode || 'N/A');
        const totalEarnings = userData.referralEarnings || 0;
        
        const transactionsSnapshot = await db.collection('referral_transactions').where('ownerUid', '==', parentUid).get();
        let referralsHtml = '';
        let paidCount = 0;
        let approvedCount = 0;

        if (transactionsSnapshot.empty) {
            referralsHtml = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>`;
        } else {
            const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            transactions.sort((a, b) => (b.timestamp?.toDate?.() || new Date(0)) - (a.timestamp?.toDate?.() || new Date(0)));
            
            transactions.forEach(data => {
                const status = safeText(data.status || 'pending');
                if (status === 'paid') paidCount++;
                if (status === 'approved') approvedCount++;
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
                
                referralsHtml += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${capitalize(data.referredStudentName || data.referredStudentPhone)}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${data.timestamp?.toDate?.().toLocaleDateString() || 'N/A'}</td>
                        <td class="px-4 py-3 text-sm"><span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">${capitalize(status)}</span></td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${data.rewardAmount ? '₦'+data.rewardAmount : '₦5,000'}</td>
                    </tr>`;
            });
        }
        
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md slide-down">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2">Share this code with other parents. They use it when registering their child, and you earn **₦5,000** once their child completes their first month!</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600 fade-in">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600 fade-in">
                    <p class="text-sm font-medium text-yellow-700">Approved Rewards</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600 fade-in">
                    <p class="text-sm font-medium text-gray-700">Paid Referrals</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referred Parent/Student</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Used</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th></tr></thead><tbody class="divide-y divide-gray-200">${referralsHtml}</tbody></table></div>
        `;
    } catch (error) {
        console.error('Error loading referral rewards:', error);
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">Error loading rewards.</p>';
    }
}

// ============================================================================
// SECTION 6: AUTHENTICATION
// ============================================================================

async function handleSignInFull(identifier, password, signInBtn, authLoader) {
    try {
        await auth.signInWithEmailAndPassword(identifier, password);
        // Success handled by UnifiedAuthManager
    } catch (error) {
        let errorMessage = "Failed to sign in.";
        if (error.code === 'auth/user-not-found') errorMessage = "No account found.";
        else if (error.code === 'auth/wrong-password') errorMessage = "Incorrect password.";
        showMessage(errorMessage, 'error');
        if (signInBtn) signInBtn.disabled = false;
        if (authLoader) authLoader.classList.add('hidden');
    }
}

async function handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader) {
    try {
        let fullPhoneInput = localPhone;
        if (!localPhone.startsWith('+')) fullPhoneInput = countryCode + localPhone;
        const normalizedResult = normalizePhoneNumber(fullPhoneInput);
        if (!normalizedResult.valid) throw new Error(`Invalid phone number: ${normalizedResult.error}`);
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        const referralCode = await generateReferralCode();

        await db.collection('parent_users').doc(user.uid).set({
            email: email,
            phone: normalizedResult.normalized,
            normalizedPhone: normalizedResult.normalized,
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
            uid: user.uid
        });
        showMessage('Account created successfully!', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
        if (signUpBtn) signUpBtn.disabled = false;
        if (authLoader) authLoader.classList.add('hidden');
    }
}

async function handlePasswordResetFull(email, sendResetBtn, resetLoader) {
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent!', 'success');
        document.getElementById("passwordResetModal").classList.add("hidden");
    } catch (error) {
        showMessage(error.message, 'error');
    } finally {
        if (sendResetBtn) sendResetBtn.disabled = false;
        if (resetLoader) resetLoader.classList.add('hidden');
    }
}

// ============================================================================
// SECTION 8: PROACTIVE ACADEMICS
// ============================================================================

async function loadAcademicsData(selectedStudent = null) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;
    academicsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto"></div><p class="text-green-600 mt-4">Loading academic data...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in');
        
        // Use global children data
        if (userChildren.length === 0) {
            academicsContent.innerHTML = `<div class="text-center py-12"><div class="text-6xl mb-4">📚</div><h3 class="text-xl font-bold text-gray-700">No Students Found</h3></div>`;
            return;
        }

        let studentsToShow = (selectedStudent && studentIdMap.has(selectedStudent)) ? [selectedStudent] : userChildren;
        let academicsHtml = '';

        if (studentIdMap.size > 1) {
            academicsHtml += `<div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm"><label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label><select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg" onchange="loadAcademicsData(this.value)"><option value="">All Students</option>`;
            userChildren.forEach(name => {
                academicsHtml += `<option value="${safeText(name)}" ${selectedStudent === name ? 'selected' : ''}>${capitalize(name)}</option>`;
            });
            academicsHtml += `</select></div>`;
        }

        for (const studentName of studentsToShow) {
            const studentId = studentIdMap.get(studentName);
            academicsHtml += `<div class="bg-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6"><h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}</h2></div>`;
            
            // Fetch Session Topics
            academicsHtml += `<div class="mb-8"><h3 class="font-bold text-blue-800 text-lg mb-4">Session Topics</h3>`;
            if (studentId) {
                const topicsSnapshot = await db.collection('daily_topics').where('studentId', '==', studentId).limit(5).get();
                if (topicsSnapshot.empty) {
                    academicsHtml += `<p class="text-gray-500 bg-gray-50 p-4 rounded">No recent topics.</p>`;
                } else {
                    topicsSnapshot.forEach(doc => {
                        const data = doc.data();
                        academicsHtml += `<div class="bg-white border border-gray-200 rounded-lg p-4 mb-2 shadow-sm"><p class="font-medium">${data.date?.toDate?.().toLocaleDateString()}</p><p class="text-gray-700">${safeText(data.topics)}</p></div>`;
                    });
                }
            }
            academicsHtml += `</div>`;

            // Fetch Homework
            academicsHtml += `<div class="mb-8"><h3 class="font-bold text-purple-800 text-lg mb-4">Homework</h3>`;
            if (studentId) {
                const hwSnapshot = await db.collection('homework_assignments').where('studentId', '==', studentId).limit(5).get();
                if (hwSnapshot.empty) {
                    academicsHtml += `<p class="text-gray-500 bg-gray-50 p-4 rounded">No active homework.</p>`;
                } else {
                    hwSnapshot.forEach(doc => {
                        const data = doc.data();
                        academicsHtml += `<div class="bg-white border border-gray-200 rounded-lg p-4 mb-2 shadow-sm"><p class="font-bold">${safeText(data.title)}</p><p class="text-sm text-gray-600">Due: ${data.dueDate?.toDate?.().toLocaleDateString()}</p></div>`;
                    });
                }
            }
            academicsHtml += `</div>`;
        }
        academicsContent.innerHTML = academicsHtml;

    } catch (error) {
        academicsContent.innerHTML = `<div class="text-center py-8 text-red-600">Error loading data.</div>`;
    }
}

// ============================================================================
// SECTION 11: NAVIGATION
// ============================================================================

async function manualRefreshReportsV2() {
    const refreshBtn = document.getElementById('manualRefreshBtn');
    if (!refreshBtn) return;
    refreshBtn.innerHTML = 'Checking...';
    refreshBtn.disabled = true;
    try {
        await authManager.reloadDashboard();
        showMessage('Refreshed!', 'success');
    } catch(e) { showMessage('Failed.', 'error'); }
    finally { refreshBtn.innerHTML = '🔄 Check for New Reports'; refreshBtn.disabled = false; }
}

function addManualRefreshButton() {
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container || document.getElementById('manualRefreshBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'manualRefreshBtn';
    btn.onclick = manualRefreshReportsV2;
    btn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 btn-glow';
    btn.innerHTML = '🔄 Check for New Reports';
    container.appendChild(btn);
}

function addLogoutButton() {
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container || document.querySelector('button[onclick="logout()"]')) return;
    const btn = document.createElement('button');
    btn.onclick = logout;
    btn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 btn-glow';
    btn.innerHTML = '🚪 Logout';
    container.appendChild(btn);
}

// ============================================================================
// SECTION 12: SEARCH LOGIC
// ============================================================================

function generateAllPhoneVariations(phone) {
    if (!phone) return [];
    const clean = phone.replace(/[^\d+]/g, '');
    const vars = new Set([phone, clean]);
    if (clean.startsWith('+')) vars.add(clean.substring(1));
    return Array.from(vars);
}

async function searchAllReportsForParent(parentPhone, parentEmail, parentUid) {
    const variations = generateAllPhoneVariations(parentPhone);
    const results = { assessmentResults: [], monthlyResults: [] };
    
    // Helper to search a collection
    const searchCol = async (col, type) => {
        for (const ph of variations) {
            try {
                const snap = await db.collection(col).where('normalizedParentPhone', '==', ph).get();
                snap.forEach(doc => {
                    if (!results[type].some(r => r.id === doc.id)) {
                        results[type].push({ id: doc.id, ...doc.data(), type: type === 'assessmentResults' ? 'assessment' : 'monthly', timestamp: doc.data().submittedAt?.seconds || Date.now()/1000 });
                    }
                });
            } catch(e) {}
        }
    };
    
    await Promise.all([
        searchCol('student_results', 'assessmentResults'),
        searchCol('tutor_submissions', 'monthlyResults')
    ]);

    // Distribute to students
    const assign = (list) => {
        list.forEach(item => {
            // Simple match logic
            const match = userChildren.find(child => 
                (item.studentName && item.studentName.toLowerCase().includes(child.toLowerCase())) ||
                (item.student && item.student.toLowerCase().includes(child.toLowerCase()))
            );
            if (match) item.assignedStudentName = match;
            else if (userChildren.length === 1) item.assignedStudentName = userChildren[0];
        });
    };
    
    assign(results.assessmentResults);
    assign(results.monthlyResults);
    
    return results;
}

async function setupRealTimeMonitoring(parentPhone, userId) {
    // Basic implementation
    const variations = generateAllPhoneVariations(parentPhone);
    variations.forEach(ph => {
        db.collection('tutor_submissions').where('normalizedParentPhone', '==', ph).onSnapshot(snap => {
            snap.docChanges().forEach(change => { if(change.type==='added') showMessage('New Monthly Report!', 'success'); });
        });
    });
}

// ============================================================================
// SECTION 14: HYBRID REPORT VIEW (YEARLY ACCORDION + OLD UI BLOCKS)
// ============================================================================

/**
 * Creates a hierarchical accordion view (Student > Year)
 * But renders the EXACT HTML blocks from the old file inside.
 */
function createYearlyArchiveReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    
    // Reset chart configs
    pendingChartConfigs = [];
    
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
        
        // 1. NEW STYLE: Student Accordion Header
        html += `
            <div class="accordion-item mb-6 fade-in">
                <button onclick="toggleAccordion('student-${studentIndex}')" 
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
            html += `
                <div class="p-8 bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-xl text-center shadow-sm">
                    <div class="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4"><span class="text-3xl text-blue-600">📄</span></div>
                    <h4 class="text-lg font-semibold text-gray-800 mb-2">No Reports Yet</h4>
                    <p class="text-gray-600 max-w-md mx-auto mb-4">No reports have been generated for ${fullName} yet.</p>
                </div>`;
        } else {
            // Group reports by year
            const reportsByYear = new Map();
            const addToYear = (map, report, type) => {
                const date = new Date(report.timestamp * 1000);
                const year = date.getFullYear();
                if (!map.has(year)) map.set(year, { assessments: [], monthly: [] });
                if (type === 'assessment') map.get(year).assessments.push(report);
                else map.get(year).monthly.push(report);
            };

            Array.from(reports.assessments.values()).flat().forEach(r => addToYear(reportsByYear, r, 'assessment'));
            Array.from(reports.monthly.values()).flat().forEach(r => addToYear(reportsByYear, r, 'monthly'));
            
            const sortedYears = Array.from(reportsByYear.keys()).sort((a, b) => b - a);
            
            let yearIndex = 0;
            for (const year of sortedYears) {
                const yearData = reportsByYear.get(year);
                
                // 2. NEW STYLE: Year Accordion
                html += `
                    <div class="mb-4 ml-2">
                        <button onclick="toggleAccordion('year-${studentIndex}-${yearIndex}')" 
                                class="accordion-header w-full flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-300">
                            <div class="flex items-center"><span class="text-xl text-blue-600 mr-3">📅</span><h4 class="font-bold text-blue-900">${year}</h4></div>
                            <span id="year-${studentIndex}-${yearIndex}-arrow" class="accordion-arrow text-blue-600 transform transition-transform duration-300">▼</span>
                        </button>
                        <div id="year-${studentIndex}-${yearIndex}-content" class="accordion-content hidden ml-4 mt-3">
                `;

                // --- OLD STYLE: ASSESSMENT REPORTS ---
                if (yearData.assessments.length > 0) {
                    const uniqueSessions = new Map();
                    yearData.assessments.forEach((result) => {
                        const sessionKey = Math.floor(result.timestamp / 86400); 
                        if (!uniqueSessions.has(sessionKey)) uniqueSessions.set(sessionKey, []);
                        uniqueSessions.get(sessionKey).push(result);
                    });

                    const sortedSessions = Array.from(uniqueSessions.entries()).sort((a, b) => b[0] - a[0]);

                    sortedSessions.forEach(([key, session], assessmentIndex) => {
                        const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
                        const tutorName = safeText(session[0].tutorName || session[0].tutor || 'N/A');
                        const studentCountry = safeText(session[0].studentCountry || session[0].location || 'N/A');
                        
                        const results = session.map(testResult => {
                            const topics = [...new Set(testResult.answers?.map(a => safeText(a.topic)).filter(t => t))] || [];
                            return {
                                subject: safeText(testResult.subject || testResult.testSubject || 'General'),
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
                        
                        const uniqueId = `assessment-block-${studentIndex}-${yearIndex}-${assessmentIndex}`;
                        const canvasId = `chart-${studentIndex}-${yearIndex}-${assessmentIndex}`;

                        // OLD STYLE HTML BLOCK
                        html += `
                        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="${uniqueId}">
                            <div class="text-center mb-6 border-b pb-4">
                                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" alt="Blooming Kids House Logo" class="h-16 w-auto mx-auto mb-3">
                                <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                                <p class="text-gray-600">Date: ${formattedDate}</p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                                <div>
                                    <p><strong>Student's Name:</strong> ${fullName}</p>
                                    <p><strong>Parent's Phone:</strong> ${safeText(session[0].parentPhone || session[0].normalizedParentPhone || 'N/A')}</p>
                                    <p><strong>Grade:</strong> ${safeText(session[0].grade || 'N/A')}</p>
                                </div>
                                <div>
                                    <p><strong>Tutor:</strong> ${tutorName}</p>
                                    <p><strong>Location:</strong> ${studentCountry}</p>
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

                            ${creativeWritingAnswer ? `<h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3><p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${safeText(tutorReport)}</p>` : ''}

                            ${results.length > 0 ? `<canvas id="${canvasId}" class="w-full h-48 mb-4"></canvas>` : ''}
                            
                            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                                <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                            </div>
                            
                            <div class="mt-6 text-center">
                                <button onclick="downloadReport('${uniqueId}', 'Assessment_Report_${safeText(fullName)}')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                    Download Assessment PDF
                                </button>
                            </div>
                        </div>
                        `;

                        // Queue Chart Config
                        if (results.length > 0) {
                            pendingChartConfigs.push({
                                canvasId: canvasId,
                                config: {
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
                                }
                            });
                        }
                    });
                }

                // --- OLD STYLE: MONTHLY REPORTS ---
                if (yearData.monthly.length > 0) {
                     const groupedMonthly = new Map();
                     yearData.monthly.forEach((result) => {
                         const sessionKey = Math.floor(result.timestamp / 86400); 
                         if (!groupedMonthly.has(sessionKey)) groupedMonthly.set(sessionKey, []);
                         groupedMonthly.get(sessionKey).push(result);
                     });

                     const sortedMonthly = Array.from(groupedMonthly.entries()).sort((a, b) => b[0] - a[0]);

                     sortedMonthly.forEach(([key, session], monthlyIndex) => {
                        const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
                        
                        session.forEach((monthlyReport, rIndex) => {
                            const uniqueId = `monthly-block-${studentIndex}-${yearIndex}-${monthlyIndex}-${rIndex}`;
                            
                            // OLD STYLE HTML BLOCK
                            html += `
                            <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="${uniqueId}">
                                <div class="text-center mb-6 border-b pb-4">
                                    <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" alt="Blooming Kids House Logo" class="h-16 w-auto mx-auto mb-3">
                                    <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                                    <p class="text-gray-600">Date: ${formattedDate}</p>
                                </div>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                                    <div>
                                        <p><strong>Student's Name:</strong> ${safeText(monthlyReport.studentName || fullName)}</p>
                                        <p><strong>Parent's Name:</strong> ${safeText(monthlyReport.parentName || currentUserData.parentName || 'N/A')}</p>
                                        <p><strong>Parent's Phone:</strong> ${safeText(monthlyReport.parentPhone || 'N/A')}</p>
                                    </div>
                                    <div>
                                        <p><strong>Grade:</strong> ${safeText(monthlyReport.grade || 'N/A')}</p>
                                        <p><strong>Tutor's Name:</strong> ${safeText(monthlyReport.tutorName || 'N/A')}</p>
                                    </div>
                                </div>

                                ${monthlyReport.introduction ? `<div class="mb-6"><h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">INTRODUCTION</h3><p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(monthlyReport.introduction)}</p></div>` : ''}
                                ${monthlyReport.topics ? `<div class="mb-6"><h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3><p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(monthlyReport.topics)}</p></div>` : ''}
                                ${monthlyReport.progress ? `<div class="mb-6"><h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3><p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(monthlyReport.progress)}</p></div>` : ''}
                                ${monthlyReport.strengthsWeaknesses ? `<div class="mb-6"><h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3><p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(monthlyReport.strengthsWeaknesses)}</p></div>` : ''}
                                ${monthlyReport.recommendations ? `<div class="mb-6"><h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3><p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(monthlyReport.recommendations)}</p></div>` : ''}
                                ${monthlyReport.generalComments ? `<div class="mb-6"><h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3><p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(monthlyReport.generalComments)}</p></div>` : ''}

                                <div class="text-right mt-8 pt-4 border-t">
                                    <p class="text-gray-600">Best regards,</p>
                                    <p class="font-semibold text-green-800">${safeText(monthlyReport.tutorName || 'Blooming Kids House')}</p>
                                </div>

                                <div class="mt-6 text-center">
                                    <button onclick="downloadReport('${uniqueId}', 'Monthly_Report_${safeText(fullName)}')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                        Download Monthly Report PDF
                                    </button>
                                </div>
                            </div>
                            `;
                        });
                     });
                }
                html += `</div></div>`; // Close year accordion
                yearIndex++;
            }
        }
        html += `</div></div>`; // Close student accordion
        studentIndex++;
    }
    return html;
}

function renderPendingCharts() {
    if (pendingChartConfigs.length > 0 && typeof Chart !== 'undefined') {
        setTimeout(() => {
            pendingChartConfigs.forEach(chartData => {
                const ctx = document.getElementById(chartData.canvasId);
                if (ctx) new Chart(ctx, chartData.config);
            });
            pendingChartConfigs = [];
        }, 100);
    }
}

function downloadReport(elementId, fileName) {
    const element = document.getElementById(elementId);
    if (!element) return;
    const opt = { 
        margin: 0.5, 
        filename: `${fileName}_${Date.now()}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, 
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } 
    };
    html2pdf().from(element).set(opt).save();
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
// SECTION 15: MAIN REPORT LOADING FUNCTION
// ============================================================================

async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    if (authLoader) authLoader.classList.remove("hidden");

    try {
        const childrenResult = await comprehensiveFindChildren(parentPhone);
        userChildren = childrenResult.studentNames;
        studentIdMap = childrenResult.studentNameIdMap;
        allStudentData = childrenResult.allStudentData;

        const userDocRef = db.collection('parent_users').doc(userId);
        let userDoc = await userDocRef.get();
        let userData = userDoc.data();
        let parentName = userData?.parentName || 'Parent';
        
        currentUserData = { parentName: safeText(parentName), parentPhone: parentPhone, email: userData?.email || '' };
        if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;

        const { assessmentResults, monthlyResults } = await searchAllReportsForParent(parentPhone, currentUserData.email, userId);
        const reportsByStudent = new Map();

        userChildren.forEach(studentName => {
            const studentInfo = allStudentData.find(s => s.name === studentName);
            reportsByStudent.set(studentName, { assessments: new Map(), monthly: new Map(), studentData: studentInfo || { name: studentName, isPending: false } });
        });

        const distribute = (list, type) => {
            list.forEach(report => {
                const studentName = report.assignedStudentName;
                if (studentName && reportsByStudent.has(studentName)) {
                    const sessionKey = Math.floor(report.timestamp / 86400);
                    const record = reportsByStudent.get(studentName);
                    if (!record[type].has(sessionKey)) record[type].set(sessionKey, []);
                    record[type].get(sessionKey).push(report);
                }
            });
        };

        distribute(assessmentResults, 'assessments');
        distribute(monthlyResults, 'monthly');

        if (reportContent) {
            const reportsHtml = createYearlyArchiveReportView(reportsByStudent);
            reportContent.innerHTML = reportsHtml;
            renderPendingCharts();
        }

        if (authArea && reportArea) {
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
        }
        addManualRefreshButton();
        addLogoutButton();

    } catch (error) {
        console.error("Error loading reports:", error);
        if (reportContent) reportContent.innerHTML = `<div class="p-6 text-red-600 bg-red-50 rounded">Error loading reports: ${safeText(error.message)}</div>`;
    } finally {
        if (authLoader) authLoader.classList.add("hidden");
    }
}

// ============================================================================
// SECTION 16: AUTH & DATA MANAGER
// ============================================================================

class UnifiedAuthManager {
    constructor() {
        this.currentUser = null;
        this.authListener = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.lastProcessTime = 0;
        this.DEBOUNCE_MS = 2000;
    }

    initialize() {
        if (this.isInitialized) return;
        this.cleanup();
        this.authListener = auth.onAuthStateChanged(
            (user) => this.handleAuthChange(user),
            (error) => console.error("Auth error:", error)
        );
        this.isInitialized = true;
    }

    async handleAuthChange(user) {
        const now = Date.now();
        if (this.isProcessing || (now - this.lastProcessTime < this.DEBOUNCE_MS)) return;
        this.isProcessing = true;
        this.lastProcessTime = now;

        try {
            if (user && user.uid) await this.loadUserDashboard(user);
            else this.showAuthScreen();
        } catch (error) {
            console.error("Auth change error:", error);
            showMessage("Authentication error. Please refresh.", "error");
        } finally {
            setTimeout(() => { this.isProcessing = false; }, 1000);
        }
    }

    async loadUserDashboard(user) {
        const authLoader = document.getElementById("authLoader");
        if (authLoader) authLoader.classList.remove("hidden");
        try {
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            if (!userDoc.exists) throw new Error("User profile not found");
            const userData = userDoc.data();
            this.currentUser = { uid: user.uid, email: userData.email, phone: userData.phone, normalizedPhone: userData.normalizedPhone || userData.phone, parentName: userData.parentName || 'Parent' };

            this.showDashboardUI();
            await Promise.all([
                this.loadAllChildrenAndReports(),
                loadReferralRewards(user.uid),
                loadAcademicsData(),
                setupRealTimeMonitoring(this.currentUser.normalizedPhone, user.uid)
            ]);
        } catch (error) {
            console.error(error);
            this.showAuthScreen();
        } finally {
            if (authLoader) authLoader.classList.add("hidden");
        }
    }

    showDashboardUI() {
        document.getElementById("authArea").classList.add("hidden");
        document.getElementById("reportArea").classList.remove("hidden");
    }

    showAuthScreen() {
        document.getElementById("authArea").classList.remove("hidden");
        document.getElementById("reportArea").classList.add("hidden");
    }

    async loadAllChildrenAndReports() {
        const childrenData = await comprehensiveFindChildren(this.currentUser.normalizedPhone);
        userChildren = childrenData.studentNames;
        studentIdMap = childrenData.studentNameIdMap;
        allStudentData = childrenData.allStudentData;
        await loadAllReportsForParent(this.currentUser.normalizedPhone, this.currentUser.uid, false);
    }

    cleanup() {
        if (this.authListener) this.authListener();
        this.isInitialized = false;
    }
    
    async reloadDashboard() { await this.loadAllChildrenAndReports(); }
}

const authManager = new UnifiedAuthManager();

async function comprehensiveFindChildren(parentPhone) {
    const allChildren = new Map();
    const studentNameIdMap = new Map();
    const variations = generateAllPhoneVariations(parentPhone);

    const search = async (col, isPending) => {
        for (const ph of variations) {
            const snap = await db.collection(col).where('parentPhone', '==', ph).get();
            snap.forEach(doc => {
                const name = safeText(doc.data().studentName || doc.data().name || 'Unknown');
                if (name !== 'Unknown' && !allChildren.has(doc.id)) {
                    allChildren.set(doc.id, { id: doc.id, name: name, data: doc.data(), isPending: isPending });
                    studentNameIdMap.set(name, doc.id);
                }
            });
        }
    };
    
    await Promise.all([search('students', false), search('pending_students', true)]);
    return { studentIds: Array.from(allChildren.keys()), studentNameIdMap, allStudentData: Array.from(allChildren.values()), studentNames: Array.from(studentNameIdMap.keys()) };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeParentPortalV2() {
    injectCustomCSS();
    createCountryCodeDropdown();
    setupEventListeners();
    authManager.initialize();
}

function handleSignIn() {
    const i = document.getElementById('loginIdentifier')?.value.trim();
    const p = document.getElementById('loginPassword')?.value;
    if(!i || !p) return showMessage('Fill fields', 'error');
    handleSignInFull(i, p, document.getElementById('signInBtn'), document.getElementById('authLoader'));
}

function handleSignUp() {
    // Basic validation then call full
    const c = document.getElementById('countryCode')?.value;
    const l = document.getElementById('signupPhone')?.value.trim();
    const e = document.getElementById('signupEmail')?.value.trim();
    const p = document.getElementById('signupPassword')?.value;
    const cp = document.getElementById('signupConfirmPassword')?.value;
    if(!c || !l || !e || !p || !cp) return showMessage('Fill fields', 'error');
    if(p !== cp) return showMessage('Passwords mismatch', 'error');
    handleSignUpFull(c, l, e, p, cp, document.getElementById('signUpBtn'), document.getElementById('authLoader'));
}

function setupEventListeners() {
    document.getElementById("signInBtn")?.addEventListener("click", handleSignIn);
    document.getElementById("signUpBtn")?.addEventListener("click", handleSignUp);
    document.getElementById("sendResetBtn")?.addEventListener("click", () => handlePasswordResetFull(document.getElementById('resetEmail').value.trim(), document.getElementById("sendResetBtn"), document.getElementById("resetLoader")));
    
    // Tab Switching
    document.getElementById("signInTab")?.addEventListener("click", () => {
        document.getElementById("signInForm").classList.remove("hidden");
        document.getElementById("signUpForm").classList.add("hidden");
        document.getElementById("signInTab").classList.add("tab-active");
        document.getElementById("signUpTab").classList.remove("tab-active");
    });
    
    document.getElementById("signUpTab")?.addEventListener("click", () => {
        document.getElementById("signUpForm").classList.remove("hidden");
        document.getElementById("signInForm").classList.add("hidden");
        document.getElementById("signUpTab").classList.add("tab-active");
        document.getElementById("signInTab").classList.remove("tab-active");
    });
    
    // Main Tabs
    const switchMain = (tab) => {
        ['reports', 'academics', 'rewards'].forEach(t => {
            const el = document.getElementById(`${t}Tab`);
            const area = document.getElementById(`${t}ContentArea`);
            if(t === tab) { el?.classList.add('tab-active-main'); area?.classList.remove('hidden'); }
            else { el?.classList.remove('tab-active-main'); area?.classList.add('hidden'); }
        });
        if(tab === 'academics') loadAcademicsData();
        if(tab === 'rewards') loadReferralRewards(auth.currentUser?.uid);
    };
    
    document.getElementById("reportTab")?.addEventListener("click", () => switchMain('reports'));
    document.getElementById("academicsTab")?.addEventListener("click", () => switchMain('academics'));
    document.getElementById("rewardsTab")?.addEventListener("click", () => switchMain('rewards'));
    
    // Forgot Password
    document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => document.getElementById("passwordResetModal").classList.remove("hidden"));
    document.getElementById("cancelResetBtn")?.addEventListener("click", () => document.getElementById("passwordResetModal").classList.add("hidden"));
}

document.addEventListener('DOMContentLoaded', initializeParentPortalV2);
