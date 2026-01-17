// ===================================================================
// SECTION 1: APP CONFIGURATION & STYLES
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

// Inject Custom CSS for Sleek Transitions
const style = document.createElement('style');
style.textContent = `
    .fade-in { animation: fadeIn 0.4s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    
    .accordion-content { transition: max-height 0.3s ease-out, opacity 0.3s ease-out; max-height: 0; opacity: 0; overflow: hidden; }
    .accordion-content.open { max-height: 2000px; opacity: 1; }
    
    .tab-transition { transition: all 0.3s ease; }
    .rotate-icon { transition: transform 0.3s ease; }
    .rotate-icon.open { transform: rotate(180deg); }
    
    .loading-spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(style);

// Load phone library if missing
if (!document.querySelector('script[src*="libphonenumber"]')) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/libphonenumber-js@1.10.14/bundle/libphonenumber-js.min.js';
    document.head.appendChild(s);
}

// ===================================================================
// SECTION 2: UTILITY FUNCTIONS
// ===================================================================

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return { normalized: null, valid: false, error: 'Invalid input' };
    try {
        let cleaned = phone.replace(/[^\d+]/g, '').replace(/^0+/, '');
        if (!cleaned.startsWith('+')) cleaned = '+1' + cleaned;
        return { normalized: cleaned, valid: true, error: null };
    } catch (e) { return { normalized: null, valid: false, error: e.message }; }
}

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

function showMessage(message, type) {
    const existing = document.querySelector('.message-toast');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in ${type === 'error' ? 'bg-red-500 text-white' : type === 'success' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`;
    div.textContent = `BKH says: ${message}`;
    document.body.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.remove(); }, 5000);
}

function createCountryCodeDropdown() {
    if(document.getElementById('countryCode')) return;
    const parent = document.getElementById('signupPhone').parentNode;
    const container = document.createElement('div');
    container.className = 'flex gap-2';
    
    const select = document.createElement('select');
    select.id = 'countryCode';
    select.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl focus:outline-none transition-all duration-200';
    
    const countries = [
        { code: '+1', name: 'USA/Canada (+1)' }, { code: '+234', name: 'Nigeria (+234)' },
        { code: '+44', name: 'UK (+44)' }, { code: '+91', name: 'India (+91)' }, { code: '+971', name: 'UAE (+971)' }
    ];
    countries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.code; opt.textContent = c.name;
        select.appendChild(opt);
    });
    select.value = '+1';
    
    const input = document.getElementById('signupPhone');
    input.placeholder = 'Phone (No Country Code)';
    
    container.appendChild(select);
    container.appendChild(input);
    parent.appendChild(container);
}

function downloadReportPDF(elementId, studentName, type) {
    const element = document.getElementById(elementId);
    if (!element) return showMessage('Report content not found', 'error');
    
    // Check for html2pdf
    if (typeof html2pdf === 'undefined') {
        return showMessage('PDF library loading... please try again in 5 seconds', 'error');
    }

    const opt = {
        margin: 0.5,
        filename: `${type}_Report_${studentName}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save();
}

// ===================================================================
// SECTION 3: STATE & REFERRALS
// ===================================================================

let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let unreadMessagesCount = 0;
let realTimeListeners = [];

async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    let code; let isUnique = false;
    while (!isUnique) {
        let suffix = ''; for (let i = 0; i < 6; i++) suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        code = prefix + suffix;
        const snap = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snap.empty) isUnique = true;
    }
    return code;
}

async function loadReferralRewards(parentUid) {
    const container = document.getElementById('rewardsContent');
    container.innerHTML = '<div class="text-center py-8"><div class="loading-spinner"></div><p class="mt-2 text-green-600">Loading rewards...</p></div>';

    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) return;
        const data = userDoc.data();
        
        const snap = await db.collection('referral_transactions').where('ownerUid', '==', parentUid).get();
        const txs = snap.docs.map(d => d.data()).sort((a,b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
        
        let rows = '';
        let stats = { pending: 0, paid: 0 };
        
        txs.forEach(t => {
            const status = t.status || 'pending';
            if(status === 'paid') stats.paid++; else stats.pending++;
            const color = status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            rows += `<tr class="hover:bg-gray-50"><td class="px-4 py-3">${escapeHtml(t.referredStudentName)}</td><td class="px-4 py-3">${formatDateTime(t.timestamp)}</td><td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs ${color}">${status}</span></td><td class="px-4 py-3 font-bold">₦${(t.rewardAmount||5000).toLocaleString()}</td></tr>`;
        });

        if(!rows) rows = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No referrals yet.</td></tr>';

        container.innerHTML = `
            <div class="fade-in">
                <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-sm">
                    <h2 class="text-xl font-bold text-blue-800">Your Code</h2>
                    <p class="text-2xl font-mono text-blue-600 p-2 bg-white inline-block rounded border border-blue-200 mt-2 select-all">${data.referralCode || 'Generating...'}</p>
                    <p class="text-sm text-blue-700 mt-2">Earn ₦5,000 per student referred!</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div class="bg-green-100 p-4 rounded-lg border-b-4 border-green-500"><p class="text-sm text-green-700">Total Earnings</p><p class="text-2xl font-bold text-green-900">₦${(data.referralEarnings||0).toLocaleString()}</p></div>
                    <div class="bg-yellow-100 p-4 rounded-lg border-b-4 border-yellow-500"><p class="text-sm text-yellow-700">Pending</p><p class="text-2xl font-bold text-yellow-900">${stats.pending}</p></div>
                    <div class="bg-gray-100 p-4 rounded-lg border-b-4 border-gray-500"><p class="text-sm text-gray-700">Paid Out</p><p class="text-2xl font-bold text-gray-900">${stats.paid}</p></div>
                </div>
                <div class="bg-white rounded-lg shadow overflow-hidden"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th></tr></thead><tbody class="divide-y divide-gray-200">${rows}</tbody></table></div>
            </div>`;
    } catch (e) { console.error(e); }
}

// ===================================================================
// SECTION 4: DATA FETCHERS & HELPERS
// ===================================================================

async function findParentNameAndStudents(parentPhone) {
    const normalized = normalizePhoneNumber(parentPhone);
    if (!normalized.valid) return { name: null, children: [], map: new Map() };
    
    let name = null;
    let children = [];
    let map = new Map();

    const process = (snap) => {
        snap.forEach(doc => {
            const d = doc.data();
            if (d.parentName) name = d.parentName;
            if (d.studentName) {
                map.set(d.studentName, doc.id);
                children.push({ id: doc.id, name: d.studentName });
            }
        });
    };

    const s1 = await db.collection("students").where("parentPhone", "==", normalized.normalized).get();
    process(s1);
    const s2 = await db.collection("pending_students").where("parentPhone", "==", normalized.normalized).get();
    process(s2);

    userChildren = children.map(c => c.name); // Global update
    return { name, children, map };
}

// ===================================================================
// SECTION 5: AUTHENTICATION
// ===================================================================

async function handleAuth(type) {
    const loader = document.getElementById('authLoader');
    const btn = document.getElementById(type === 'signin' ? 'signInBtn' : 'signUpBtn');
    btn.disabled = true;
    loader.classList.remove('hidden');

    try {
        const email = document.getElementById(type === 'signin' ? 'loginIdentifier' : 'signupEmail').value.trim();
        const pass = document.getElementById(type === 'signin' ? 'loginPassword' : 'signupPassword').value;
        
        if (type === 'signup') {
            const confirm = document.getElementById('signupConfirmPassword').value;
            const phone = document.getElementById('signupPhone').value;
            const code = document.getElementById('countryCode').value;
            if (pass !== confirm) throw new Error("Passwords don't match");
            
            const fullPhone = normalizePhoneNumber(code + phone);
            if (!fullPhone.valid) throw new Error("Invalid phone");

            const cred = await auth.createUserWithEmailAndPassword(email, pass);
            const { name } = await findParentNameAndStudents(fullPhone.normalized);
            await db.collection('parent_users').doc(cred.user.uid).set({
                phone: code + phone, normalizedPhone: fullPhone.normalized, email,
                parentName: name || 'Parent', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                referralCode: await generateReferralCode(), referralEarnings: 0
            });
            showMessage("Account created!", "success");
            await loadDashboard(fullPhone.normalized, cred.user.uid);
        } else {
            // SignIn
            if (document.getElementById('rememberMe').checked) {
                localStorage.setItem('savedEmail', email); localStorage.setItem('rememberMe', 'true');
            } else {
                localStorage.removeItem('savedEmail'); localStorage.removeItem('rememberMe');
            }
            
            const cred = await auth.signInWithEmailAndPassword(email, pass);
            const doc = await db.collection('parent_users').doc(cred.user.uid).get();
            if(doc.exists) await loadDashboard(doc.data().normalizedPhone, cred.user.uid);
            else location.reload();
        }
    } catch (e) {
        showMessage(e.message, 'error');
    } finally {
        btn.disabled = false;
        loader.classList.add('hidden');
    }
}

async function handlePasswordReset() {
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) return showMessage('Enter email', 'error');
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Reset link sent!', 'success');
        document.getElementById('passwordResetModal').classList.add('hidden');
    } catch(e) { showMessage(e.message, 'error'); }
}

function logout() {
    localStorage.clear();
    auth.signOut().then(() => window.location.reload());
}

// ===================================================================
// SECTION 6: UNIFIED MESSAGING SYSTEM
// ===================================================================

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if(show) { el.classList.remove('hidden'); el.classList.add('fade-in'); }
    else el.classList.add('hidden');
    
    // Auto-populate student dropdown if composing
    if(show && id === 'composeMessageModal') {
        const sel = document.getElementById('messageStudent');
        sel.innerHTML = '<option value="">General / All</option>';
        userChildren.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = capitalize(c);
            sel.appendChild(opt);
        });
    }
}

async function submitMessage() {
    const subject = document.getElementById('messageSubject').value.trim();
    const content = document.getElementById('messageContent').value.trim();
    const student = document.getElementById('messageStudent').value;
    
    if (!subject || !content) return showMessage("Subject and content required", "error");

    const btn = document.getElementById('submitMessageBtn');
    btn.disabled = true; btn.textContent = "Sending...";

    try {
        const user = auth.currentUser;
        const doc = await db.collection('parent_users').doc(user.uid).get();
        await db.collection('tutor_messages').add({
            parentUid: user.uid, parentName: doc.data().parentName, 
            studentName: student || 'General',
            subject, content, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            type: 'parent_to_staff', recipients: ['tutors', 'management'], isUrgent: document.getElementById('messageUrgent').checked
        });
        showMessage("Sent!", "success");
        toggleModal('composeMessageModal', false);
    } catch(e) { showMessage("Error sending", "error"); }
    finally { btn.disabled = false; btn.textContent = "Send Message"; }
}

async function loadMessages() {
    const container = document.getElementById('messagesContent');
    container.innerHTML = '<div class="text-center"><div class="loading-spinner"></div></div>';
    
    try {
        const user = auth.currentUser;
        // Fetch BOTH new messages and old feedback
        const [msgsSnap, fbSnap] = await Promise.all([
            db.collection('tutor_messages').where('parentUid', '==', user.uid).get(),
            db.collection('parent_feedback').where('parentUid', '==', user.uid).get()
        ]);
        
        let all = [];
        
        // Process New System
        msgsSnap.forEach(d => {
            const m = d.data();
            all.push({
                id: d.id, sortTime: m.timestamp?.toDate ? m.timestamp.toDate() : new Date(),
                subject: m.subject, content: m.content,
                header: m.type === 'parent_to_staff' ? 'Outgoing' : 'Incoming',
                color: m.type === 'parent_to_staff' ? 'text-blue-600' : 'text-green-600'
            });
        });

        // Process Old Feedback (Legacy Support)
        fbSnap.forEach(d => {
            const f = d.data();
            if(f.responses && f.responses.length > 0) {
                f.responses.forEach(r => {
                    all.push({
                        id: d.id + 'r', sortTime: r.responseDate?.toDate ? r.responseDate.toDate() : new Date(),
                        subject: `Re: ${f.category}`, content: `Response: ${r.responseText}\n(Original: ${f.message})`,
                        header: 'Admin Response', color: 'text-purple-600'
                    });
                });
            }
        });

        all.sort((a,b) => b.sortTime - a.sortTime);
        
        container.innerHTML = all.length ? all.map(m => `
            <div class="bg-white border rounded-xl p-4 mb-4 shadow-sm fade-in">
                <div class="flex justify-between mb-1">
                    <span class="font-bold text-gray-800">${escapeHtml(m.subject)}</span>
                    <span class="text-xs text-gray-500">${m.sortTime.toLocaleDateString()}</span>
                </div>
                <div class="text-xs mb-2 font-bold ${m.color}">${m.header}</div>
                <div class="bg-gray-50 p-3 rounded text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(m.content)}</div>
            </div>`).join('') : '<p class="text-center text-gray-500">No messages.</p>';
    } catch(e) { container.innerHTML = '<p class="text-red-500">Error loading.</p>'; }
}

// ===================================================================
// SECTION 7: ACADEMICS (AUTO-CLEAR + NESTED ACCORDIONS)
// ===================================================================

async function loadAcademicsData() {
    const container = document.getElementById('academicsContent');
    container.innerHTML = '<div class="text-center py-8"><div class="loading-spinner"></div></div>';

    try {
        const user = auth.currentUser;
        if (!user) return;
        const uDoc = await db.collection('parent_users').doc(user.uid).get();
        const { map } = await findParentNameAndStudents(uDoc.data().normalizedPhone);
        
        if (map.size === 0) { container.innerHTML = '<p class="text-center">No students found.</p>'; return; }

        // --- AUTO CLEAR LOGIC (2nd Day Rule) ---
        const now = new Date();
        // If today is 1st or 2nd, show prev month too. If 3rd+, show only current month.
        const cutoffDate = new Date(now.getFullYear(), now.getMonth() - (now.getDate() > 2 ? 0 : 1), 1);

        let html = '<div class="space-y-4 fade-in">';
        let idx = 0;
        let totalNew = 0;

        for (const [name, id] of map) {
            const [tSnap, hSnap] = await Promise.all([
                db.collection('daily_topics').where('studentId', '==', id).get(),
                db.collection('homework_assignments').where('studentId', '==', id).get()
            ]);

            const topics = tSnap.docs.map(d => d.data()).filter(t => {
                const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                return d >= cutoffDate;
            }).sort((a,b) => (b.date?.toDate?.() || 0) - (a.date?.toDate?.() || 0));

            const homework = hSnap.docs.map(d => d.data()).filter(h => {
                const d = h.dueDate?.toDate ? h.dueDate.toDate() : new Date(h.dueDate);
                return d >= cutoffDate;
            }).sort((a,b) => (a.dueDate?.toDate?.() || 0) - (b.dueDate?.toDate?.() || 0));

            const newCount = topics.length + homework.length;
            totalNew += newCount;

            html += `
            <div class="border rounded-xl bg-white shadow-sm overflow-hidden">
                <button onclick="toggleAccordion('stu-acad-${idx}', this)" class="w-full flex justify-between items-center p-4 bg-green-50 hover:bg-green-100 transition">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-green-900 text-lg">${escapeHtml(capitalize(name))}</span>
                        ${newCount > 0 ? `<span class="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">${newCount} Active Items</span>` : ''}
                    </div>
                    <span class="rotate-icon text-green-600">▼</span>
                </button>
                <div id="stu-acad-${idx}" class="accordion-content bg-white">
                    <div class="p-4 space-y-4">
                        
                        <div class="border rounded-lg">
                            <button onclick="toggleAccordion('topic-${idx}', this)" class="w-full flex justify-between p-3 bg-gray-50 hover:bg-gray-100 font-semibold text-gray-700 text-sm">
                                <span>📅 Daily Topics (${topics.length})</span>
                                <span class="rotate-icon">▼</span>
                            </button>
                            <div id="topic-${idx}" class="accordion-content">
                                <div class="p-3 space-y-2">
                                    ${topics.length ? topics.map(t => `
                                        <div class="p-3 border rounded bg-yellow-50">
                                            <div class="text-xs font-bold text-gray-500 mb-1">${formatDateTime(t.date)}</div>
                                            <div class="text-sm text-gray-800 whitespace-pre-wrap">${escapeHtml(t.topics)}</div>
                                        </div>`).join('') : '<p class="text-xs text-gray-400 p-2">No recent topics.</p>'}
                                </div>
                            </div>
                        </div>

                        <div class="border rounded-lg">
                            <button onclick="toggleAccordion('hw-${idx}', this)" class="w-full flex justify-between p-3 bg-gray-50 hover:bg-gray-100 font-semibold text-gray-700 text-sm">
                                <span>📝 Homework (${homework.length})</span>
                                <span class="rotate-icon">▼</span>
                            </button>
                            <div id="hw-${idx}" class="accordion-content">
                                <div class="p-3 space-y-2">
                                    ${homework.length ? homework.map(h => {
                                        const due = h.dueDate?.toDate?.() || new Date();
                                        const overdue = due < new Date();
                                        return `
                                        <div class="p-3 border rounded ${overdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}">
                                            <div class="flex justify-between font-bold text-sm mb-1">
                                                <span>${escapeHtml(h.title)}</span>
                                                <span class="${overdue?'text-red-600':'text-blue-600'}">Due: ${due.toLocaleDateString()}</span>
                                            </div>
                                            <p class="text-xs text-gray-600">${escapeHtml(h.description)}</p>
                                            ${h.fileUrl ? `<a href="${h.fileUrl}" target="_blank" class="text-blue-600 text-xs underline block mt-2">Download File</a>` : ''}
                                        </div>`;
                                    }).join('') : '<p class="text-xs text-gray-400 p-2">No active homework.</p>'}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>`;
            idx++;
        }
        html += '</div>';
        container.innerHTML = html;
        
        const badge = document.getElementById('academicsNotificationBadge');
        if(badge) {
            if(totalNew > 0) { badge.textContent = totalNew; badge.classList.remove('hidden'); }
            else badge.classList.add('hidden');
        }

    } catch (e) { console.error(e); container.innerHTML = '<p class="text-red-500">Error loading academics.</p>'; }
}

// ===================================================================
// SECTION 8: REPORTS (YEARLY ACCORDION + PDF)
// ===================================================================

async function loadDashboard(phone, uid) {
    document.getElementById('authArea').classList.add('hidden');
    document.getElementById('reportArea').classList.remove('hidden');
    localStorage.setItem('isAuthenticated', 'true');
    currentUserData = { phone, uid };

    loadReferralRewards(uid);
    loadAcademicsData();
    addManualRefreshButton();
    addMessagesButton();

    const [assSnap, monSnap] = await Promise.all([
        db.collection("student_results").where("parentPhone", "==", phone).get(),
        db.collection("tutor_submissions").where("parentPhone", "==", phone).get()
    ]);

    const grouped = {};
    const process = (doc, type) => {
        const d = doc.data();
        const date = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(d.timestamp * 1000);
        const year = date.getFullYear();
        const name = d.studentName || 'Unknown';
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][name]) grouped[year][name] = { assessment: [], monthly: [] };
        grouped[year][name][type].push({ id: doc.id, ...d });
    };

    assSnap.forEach(d => process(d, 'assessment'));
    monSnap.forEach(d => process(d, 'monthly'));

    const container = document.getElementById('reportContent');
    let html = '<div class="space-y-4 fade-in">';
    const years = Object.keys(grouped).sort((a,b) => b - a);

    if (years.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-500">No reports available yet.</div>';
        return;
    }

    years.forEach((year, yIdx) => {
        html += `
        <div class="border rounded-xl bg-white shadow-sm overflow-hidden">
            <button onclick="toggleAccordion('year-${yIdx}', this)" class="w-full flex justify-between p-4 bg-indigo-50 hover:bg-indigo-100 font-bold text-indigo-900 text-lg transition">
                <span>📂 ${year} Records</span>
                <span class="rotate-icon">▼</span>
            </button>
            <div id="year-${yIdx}" class="accordion-content">
                <div class="p-4 space-y-3">
        `;
        
        Object.keys(grouped[year]).forEach((student, sIdx) => {
            const data = grouped[year][student];
            html += `
            <div class="border rounded-lg">
                <button onclick="toggleAccordion('rep-stu-${yIdx}-${sIdx}', this)" class="w-full flex justify-between p-3 bg-white hover:bg-gray-50 font-semibold text-gray-800 border-b">
                    <span>👤 ${escapeHtml(capitalize(student))}</span>
                    <span class="text-xs text-gray-500">${data.assessment.length} Assmts, ${data.monthly.length} Monthly</span>
                </button>
                <div id="rep-stu-${yIdx}-${sIdx}" class="accordion-content">
                    <div class="p-3 grid gap-4">
                        ${data.assessment.length ? `
                            <div>
                                <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">Assessments</h5>
                                ${data.assessment.map((r, i) => `
                                    <div id="pdf-ass-${yIdx}-${sIdx}-${i}" class="flex justify-between items-center p-3 bg-blue-50 rounded mb-2 text-sm border border-blue-100">
                                        <div>
                                            <div class="font-bold text-gray-800">${formatDateTime(r.timestamp)}</div>
                                            <div class="text-xs text-gray-600">${r.subject}</div>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-blue-700 bg-white px-2 py-1 rounded shadow-sm">${r.score}/${r.totalScoreableQuestions}</span>
                                            <button onclick="downloadReportPDF('pdf-ass-${yIdx}-${sIdx}-${i}', '${escapeHtml(student)}', 'Assessment')" class="text-blue-600 hover:text-blue-800">⬇ PDF</button>
                                        </div>
                                    </div>`).join('')}
                            </div>` : ''}
                        
                        ${data.monthly.length ? `
                            <div>
                                <h5 class="text-xs font-bold text-gray-500 uppercase mb-2">Monthly Reports</h5>
                                ${data.monthly.map((r, i) => `
                                    <div id="pdf-mon-${yIdx}-${sIdx}-${i}" class="p-3 bg-green-50 rounded mb-2 text-sm border border-green-100 relative">
                                        <button onclick="downloadReportPDF('pdf-mon-${yIdx}-${sIdx}-${i}', '${escapeHtml(student)}', 'Monthly')" class="absolute top-2 right-2 text-green-700 hover:text-green-900 text-xs font-bold">⬇ PDF</button>
                                        <div class="font-bold text-green-800 mb-1">${formatDateTime(r.timestamp)}</div>
                                        <div class="text-xs text-gray-600 whitespace-pre-wrap">${escapeHtml(r.topics)}</div>
                                        <div class="text-xs text-gray-500 mt-1 italic">Tutor: ${escapeHtml(r.tutorName)}</div>
                                    </div>`).join('')}
                            </div>` : ''}
                    </div>
                </div>
            </div>`;
        });

        html += `</div></div></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ===================================================================
// SECTION 9: NAVIGATION & UI
// ===================================================================

function toggleAccordion(id, btn) {
    const content = document.getElementById(id);
    const icon = btn.querySelector('.rotate-icon');
    if (content.classList.contains('open')) {
        content.classList.remove('open');
        if(icon) icon.classList.remove('open');
    } else {
        content.classList.add('open');
        if(icon) icon.classList.add('open');
    }
}

function switchMainTab(tabId) {
    const tabs = ['report', 'academics', 'rewards'];
    const active = tabs.find(t => !document.getElementById(`${t}ContentArea`).classList.contains('hidden'));
    if(active) document.getElementById(`${active}ContentArea`).classList.add('opacity-0', 'transition-opacity', 'duration-300');

    setTimeout(() => {
        tabs.forEach(t => {
            const el = document.getElementById(`${t}ContentArea`);
            const btn = document.getElementById(`${t}Tab`);
            el.classList.add('hidden', 'opacity-0'); 
            el.classList.remove('opacity-100');
            btn.className = "flex-1 py-4 text-center text-gray-500 hover:text-green-600 font-medium transition-colors duration-300 relative";
        });

        const newEl = document.getElementById(`${tabId}ContentArea`);
        newEl.classList.remove('hidden');
        void newEl.offsetWidth; 
        newEl.classList.remove('opacity-0');
        newEl.classList.add('opacity-100');

        const newBtn = document.getElementById(`${tabId}Tab`);
        newBtn.className = "flex-1 py-4 text-center text-green-600 font-bold border-b-4 border-green-600 transition-colors duration-300 relative";
        
        if(tabId === 'academics') {
            const b = document.getElementById('academicsNotificationBadge');
            if(b) b.classList.add('hidden');
        }
    }, 300);
}

function addManualRefreshButton() {
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container || document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = () => loadDashboard(currentUserData.phone, currentUserData.uid);
    refreshBtn.className = 'bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition shadow-sm flex items-center gap-2';
    refreshBtn.innerHTML = '🔄 Refresh';
    container.appendChild(refreshBtn);
    
    // Add Logout Button too if missing
    if(!document.getElementById('logoutBtn')) {
        const logBtn = document.createElement('button');
        logBtn.id = 'logoutBtn';
        logBtn.onclick = logout;
        logBtn.className = 'bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition shadow-sm';
        logBtn.innerHTML = '🚪 Logout';
        container.appendChild(logBtn);
    }
}

function addMessagesButton() {
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container || document.getElementById('viewMessagesBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'viewMessagesBtn';
    btn.className = 'bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 relative shadow-sm';
    btn.innerHTML = '📨 Messages';
    btn.onclick = () => { toggleModal('messagesModal', true); loadMessages(); };
    container.insertBefore(btn, container.firstChild);
}

// ===================================================================
// SECTION 10: INITIALIZATION
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('savedEmail')) {
        document.getElementById('loginIdentifier').value = localStorage.getItem('savedEmail');
        document.getElementById('rememberMe').checked = true;
    }
    createCountryCodeDropdown();

    // Academics Badge
    const acTab = document.getElementById('academicsTab');
    if (acTab && !document.getElementById('academicsNotificationBadge')) {
        const b = document.createElement('span');
        b.id = 'academicsNotificationBadge';
        b.className = 'hidden absolute top-2 right-4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse';
        acTab.appendChild(b);
    }

    auth.onAuthStateChanged(u => {
        if(u) db.collection('parent_users').doc(u.uid).get().then(d => { if(d.exists) loadDashboard(d.data().normalizedPhone, u.uid); });
        else document.getElementById('authArea').classList.remove('hidden');
    });

    const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.addEventListener('click', fn); };
    bind('signInBtn', () => handleAuth('signin'));
    bind('signUpBtn', () => handleAuth('signup'));
    bind('submitMessageBtn', submitMessage);
    bind('reportTab', () => switchMainTab('report'));
    bind('academicsTab', () => switchMainTab('academics'));
    bind('rewardsTab', () => switchMainTab('rewards'));
    bind('sendResetBtn', handlePasswordReset);
    bind('composeMessageBtn', () => toggleModal('composeMessageModal', true));
    
    // Auth Switch Logic
    const switchAuth = (t) => {
        const signin = document.getElementById('signInForm');
        const signup = document.getElementById('signUpForm');
        const inTab = document.getElementById('signInTab');
        const upTab = document.getElementById('signUpTab');
        
        if(t === 'in') { 
            signin.classList.remove('hidden'); signup.classList.add('hidden'); 
            inTab.classList.add('text-green-600', 'border-b-2', 'border-green-600');
            upTab.classList.remove('text-green-600', 'border-b-2', 'border-green-600');
        } else {
            signin.classList.add('hidden'); signup.classList.remove('hidden');
            upTab.classList.add('text-green-600', 'border-b-2', 'border-green-600');
            inTab.classList.remove('text-green-600', 'border-b-2', 'border-green-600');
        }
    };
    bind('signInTab', () => switchAuth('in'));
    bind('signUpTab', () => switchAuth('up'));
    
    // Forgot Password Modal Triggers
    bind('forgotPasswordBtn', () => toggleModal('passwordResetModal', true));
    bind('cancelResetBtn', () => toggleModal('passwordResetModal', false));

    window.onclick = (e) => { if(e.target.classList.contains('fixed')) e.target.classList.add('hidden'); };
});
