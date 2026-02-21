// student-portal.js
// Full student dashboard loaded at BKHstudentlogin.html
// Reads from: students, homework_assignments, daily_topics, courses, conversations, schedules, student_results, game_leaderboard

import { auth, db } from './firebaseConfig-studentsignupmodular.js';
import {
    collection, query, where, getDocs, doc, getDoc, addDoc,
    updateDoc, setDoc, onSnapshot, orderBy, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

/*──────────────────────────────────────────────────────────
  GLOBAL STATE
──────────────────────────────────────────────────────────*/
let studentData = null;
let currentTab = 'dashboard';
let unsubMessages = null;
let unsubNotifs = null;
let unreadCount = 0;
let notifList = [];
let localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
let localCity = '';

/*──────────────────────────────────────────────────────────
  HELPERS
──────────────────────────────────────────────────────────*/
const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const $ = (id) => document.getElementById(id);
const fmtDate = (ts) => {
    if (!ts) return '';
    const d = ts?.seconds ? new Date(ts.seconds*1000) : new Date(ts);
    return d.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});
};
const fmtTime = (ts) => {
    if (!ts) return '';
    const d = ts?.seconds ? new Date(ts.seconds*1000) : new Date(ts);
    return d.toLocaleTimeString('en-NG',{hour:'2-digit',minute:'2-digit',hour12:true});
};
const fmtDateTime = (ts) => {
    if (!ts) return '';
    const d = ts?.seconds ? new Date(ts.seconds*1000) : new Date(ts);
    return d.toLocaleString('en-NG',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
};

// Convert a Lagos time string (e.g. "09:00") for a given day to student local time
function convertLagosToLocal(day, timeStr) {
    if (!timeStr) return '';
    try {
        const [h, m] = timeStr.split(':').map(Number);
        const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const today = new Date();
        const lagosOffset = +1; // UTC+1
        const targetDayNum = DAYS.indexOf(day);
        if (targetDayNum < 0) return timeStr;
        // Find next occurrence of day in Lagos TZ
        const lagosNow = new Date(today.toLocaleString('en-US',{timeZone:'Africa/Lagos'}));
        const diff = (targetDayNum - lagosNow.getDay() + 7) % 7;
        const lagosDT = new Date(lagosNow);
        lagosDT.setDate(lagosNow.getDate() + diff);
        lagosDT.setHours(h, m, 0, 0);
        // Build UTC from Lagos
        const utcMs = lagosDT.getTime() - (lagosOffset * 3600000);
        const localDT = new Date(utcMs);
        return localDT.toLocaleTimeString(undefined, {hour:'2-digit',minute:'2-digit',hour12:true,timeZone: localTZ});
    } catch(e) { return timeStr; }
}

function getWeekRange(weekOffset = 0) {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
    mon.setHours(0,0,0,0);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23,59,59,999);
    return { mon, sun };
}

function getISOWeekKey(date) {
    const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
    const weekStart = new Date(date); weekStart.setDate(date.getDate() - (date.getDay()||7)+1);
    return `${weekStart.getFullYear()}-W${String(Math.ceil(((weekStart - new Date(weekStart.getFullYear(),0,1))/86400000+1)/7)).padStart(2,'0')}`;
}

/*──────────────────────────────────────────────────────────
  CLOCK & LOCATION
──────────────────────────────────────────────────────────*/
function startStudentClock() {
    const tickEl = () => {
        const el = $('student-clock-time');
        if (!el) return;
        el.textContent = new Intl.DateTimeFormat(undefined, {
            hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true,timeZone: localTZ
        }).format(new Date());
    };
    tickEl();
    if (window._studentClockInterval) clearInterval(window._studentClockInterval);
    window._studentClockInterval = setInterval(tickEl, 1000);
}

async function detectLocation() {
    try {
        // Use IP-based geolocation (no permission required, low-cost)
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        localCity = data.city || data.country_name || '';
        localTZ = data.timezone || localTZ;
        const locEl = $('student-location-display');
        if (locEl && localCity) locEl.textContent = `📍 ${localCity}`;
    } catch(e) {
        const locEl = $('student-location-display');
        if (locEl) locEl.textContent = `📍 ${localTZ}`;
    }
}

/*──────────────────────────────────────────────────────────
  NOTIFICATION SYSTEM
──────────────────────────────────────────────────────────*/
function buildAutoNotifications(student) {
    const notifs = [];
    const tutorName = student.tutorName || 'your tutor';
    const now = new Date();
    const dayOfMonth = now.getDate();
    const weekOfMonth = Math.ceil(dayOfMonth / 7);

    // Welcome notification (always present)
    notifs.push({
        id: 'welcome',
        icon: '👋',
        title: `Welcome back, ${student.studentName || 'there'}!`,
        body: `Hi ${student.studentName?.split(' ')[0] || 'there'}! ${tutorName} is glad to have you here. Keep up the great work and stay focused on your learning journey. You've got this! 💪`,
        time: 'From your tutor',
        read: false,
        type: 'welcome'
    });

    // Beginning-of-month reminder
    if (dayOfMonth <= 7) {
        notifs.push({
            id: `month-start-${now.getFullYear()}-${now.getMonth()}`,
            icon: '📅',
            title: 'New Month — Fresh Start!',
            body: `Hello ${student.studentName?.split(' ')[0] || 'there'}! A new month means new opportunities. Review last month's topics, check your pending assignments, and set your learning goals. Your tutor is cheering you on!`,
            time: 'Monthly Reminder',
            read: sessionStorage.getItem(`notif_read_month_start`) === 'true',
            type: 'monthly'
        });
    }

    // 2nd week reminder
    if (weekOfMonth === 2) {
        notifs.push({
            id: `week2-${now.getFullYear()}-${now.getMonth()}`,
            icon: '📚',
            title: "Mid-Month Check-In",
            body: `Hi ${student.studentName?.split(' ')[0] || 'there'}! You're halfway through the month. Have you reviewed your topics and completed your homework? Don't forget to check your assignments tab!`,
            time: 'Weekly Reminder',
            read: sessionStorage.getItem('notif_read_week2') === 'true',
            type: 'weekly'
        });
    }

    return notifs;
}

async function loadNotifications(student) {
    notifList = buildAutoNotifications(student);

    // Load real notifications from Firestore
    try {
        const snap = await getDocs(query(
            collection(db, 'notifications'),
            where('studentId', '==', student.id)
        ));
        snap.forEach(d => {
            const n = d.data();
            notifList.push({
                id: d.id,
                icon: n.icon || '🔔',
                title: n.title || 'Notification',
                body: n.body || n.message || '',
                time: fmtDateTime(n.createdAt),
                read: n.read || false,
                type: n.type || 'general'
            });
        });
    } catch(e) { /* notifications collection may not exist */ }

    // Check for unread homework (from DB)
    try {
        const hwSnap = await getDocs(query(
            collection(db, 'homework_assignments'),
            where('studentId', '==', student.id)
        ));
        const pending = hwSnap.docs.filter(d => {
            const s = d.data().status;
            return s === 'assigned' || s === 'sent';
        });
        if (pending.length > 0) {
            notifList.unshift({
                id: 'hw-pending',
                icon: '📝',
                title: `You have ${pending.length} assignment${pending.length > 1 ? 's' : ''} pending`,
                body: 'Check your Assignments tab to view and submit your homework.',
                time: 'Recent',
                read: false,
                type: 'homework'
            });
        }
    } catch(e) {}

    unreadCount = notifList.filter(n => !n.read).length;
    updateBellBadge();
}

function updateBellBadge() {
    const badge = $('bell-badge');
    if (badge) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
}

function showNotificationPanel() {
    document.querySelectorAll('.notif-panel').forEach(e => e.remove());

    const panel = document.createElement('div');
    panel.className = 'notif-panel';
    panel.style.cssText = `
        position:fixed;top:60px;right:16px;width:340px;max-width:calc(100vw-32px);
        background:#fff;border-radius:1rem;box-shadow:0 8px 40px rgba(0,0,0,.18);
        border:1px solid #e5e7eb;z-index:9999;overflow:hidden;
        max-height:80vh;overflow-y:auto;`;

    panel.innerHTML = `
        <div style="padding:1rem;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between;">
            <h3 style="font-weight:700;font-size:1rem;margin:0;">🔔 Notifications</h3>
            <button id="close-notif" style="border:none;background:none;font-size:1.2rem;cursor:pointer;color:#9ca3af;">&times;</button>
        </div>
        <div id="notif-list-inner">
            ${notifList.length === 0
                ? `<div style="padding:2rem;text-align:center;color:#9ca3af;">No notifications yet</div>`
                : notifList.map((n,i) => `
                    <div style="display:flex;gap:.75rem;padding:.9rem 1rem;border-bottom:1px solid #f9fafb;background:${n.read?'#fff':'#f0f9ff'};cursor:pointer;" onclick="markNotifRead(${i})">
                        <div style="font-size:1.4rem;flex-shrink:0">${n.icon}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:${n.read?'500':'700'};font-size:.875rem;color:#1f2937;">${esc(n.title)}</div>
                            <div style="font-size:.78rem;color:#6b7280;margin-top:.2rem;line-height:1.4;">${esc(n.body)}</div>
                            <div style="font-size:.7rem;color:#9ca3af;margin-top:.3rem;">${esc(n.time)}</div>
                        </div>
                        ${!n.read ? '<div style="width:.5rem;height:.5rem;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:.35rem;"></div>' : ''}
                    </div>`).join('')}
        </div>
        ${unreadCount > 0 ? `
        <div style="padding:.75rem;border-top:1px solid #f3f4f6;text-align:center;">
            <button onclick="markAllNotifsRead()" style="font-size:.8rem;color:#3b82f6;border:none;background:none;cursor:pointer;font-weight:600;">Mark all as read</button>
        </div>` : ''}
    `;

    document.body.appendChild(panel);
    $('close-notif')?.addEventListener('click', () => panel.remove());
    setTimeout(() => document.addEventListener('click', function closePanel(e) {
        if (!panel.contains(e.target) && e.target.id !== 'bell-btn') {
            panel.remove(); document.removeEventListener('click', closePanel);
        }
    }), 100);
}

window.markNotifRead = function(i) {
    if (notifList[i]) notifList[i].read = true;
    unreadCount = notifList.filter(n => !n.read).length;
    updateBellBadge();
    showNotificationPanel();
};

window.markAllNotifsRead = function() {
    notifList.forEach(n => n.read = true);
    unreadCount = 0;
    updateBellBadge();
    document.querySelector('.notif-panel')?.remove();
};

/*──────────────────────────────────────────────────────────
  RENDER FUNCTIONS
──────────────────────────────────────────────────────────*/

// ── DASHBOARD ──
async function renderDashboard(student) {
    const main = $('main-content');
    if (!main) return;
    main.innerHTML = `<div class="text-center py-10"><div class="spinner mx-auto mb-3"></div><p class="text-gray-500">Loading dashboard…</p></div>`;

    // Parallel fetch for speed
    const [hwSnap, topicsSnap, schedSnap, resultsSnap, allGradesSnap] = await Promise.all([
        getDocs(query(collection(db,'homework_assignments'), where('studentId','==',student.id))).catch(()=>({docs:[]})),
        getDocs(query(collection(db,'daily_topics'), where('studentId','==',student.id))).catch(()=>({docs:[]})),
        getDocs(query(collection(db,'schedules'), where('studentId','==',student.id))).catch(()=>({docs:[]})),
        getDocs(query(collection(db,'student_results'), where('studentId','==',student.id))).catch(()=>({docs:[]})),
        getDocs(query(collection(db,'student_results'), where('grade','==',student.grade))).catch(()=>({docs:[]}))
    ]);

    // Next class calculation
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    let schedSlots = student.schedule || [];
    if (schedSnap.docs.length > 0) schedSlots = schedSnap.docs[0].data().schedule || schedSlots;

    let nextClassHTML = '<p class="text-gray-400 text-sm">No upcoming classes scheduled.</p>';
    if (schedSlots.length > 0) {
        const now = new Date();
        const lagosNow = new Date(now.toLocaleString('en-US',{timeZone:'Africa/Lagos'}));
        let best = null, bestMs = Infinity;
        schedSlots.forEach(sl => {
            if (!sl.day || !sl.start) return;
            const [h,m] = sl.start.split(':').map(Number);
            const diff = (DAYS.indexOf(sl.day) - lagosNow.getDay() + 7) % 7 || 7;
            const slDate = new Date(lagosNow); slDate.setDate(lagosNow.getDate()+diff); slDate.setHours(h,m,0,0);
            if (slDate > lagosNow && slDate - lagosNow < bestMs) { bestMs = slDate - lagosNow; best = sl; }
        });
        if (best) {
            const localTime = convertLagosToLocal(best.day, best.start);
            const hoursAway = Math.round(bestMs / 3600000);
            nextClassHTML = `
                <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.75rem;padding:1rem;color:#fff;">
                    <div style="font-size:.75rem;opacity:.8;margin-bottom:.25rem">NEXT SESSION</div>
                    <div style="font-size:1.1rem;font-weight:800;">${esc(best.day)}</div>
                    <div style="font-size:.9rem;margin-top:.2rem">⏰ ${esc(best.start)} Nigeria / ${localTime} local</div>
                    ${best.subject ? `<div style="font-size:.8rem;opacity:.8;margin-top:.2rem">📖 ${esc(best.subject)}</div>` : ''}
                    <div style="font-size:.75rem;opacity:.7;margin-top:.4rem">In about ${hoursAway} hour${hoursAway!==1?'s':''}</div>
                </div>`;
        }
    }

    // Average grade vs peers
    const myGrades = resultsSnap.docs.map(d => Number(d.data().score || d.data().percentage || 0)).filter(n => n>0);
    const myAvg = myGrades.length ? Math.round(myGrades.reduce((a,b)=>a+b,0)/myGrades.length) : null;
    const peerGrades = allGradesSnap.docs.map(d => Number(d.data().score || d.data().percentage || 0)).filter(n=>n>0);
    const peerAvg = peerGrades.length ? Math.round(peerGrades.reduce((a,b)=>a+b,0)/peerGrades.length) : null;

    // Performance chart data (last 6 results by date)
    const sorted = [...resultsSnap.docs].sort((a,b) => {
        const ta = a.data().submittedAt?.seconds || a.data().date?.seconds || 0;
        const tb = b.data().submittedAt?.seconds || b.data().date?.seconds || 0;
        return ta - tb;
    }).slice(-6);
    const chartLabels = sorted.map(d => {
        const ts = d.data().submittedAt || d.data().date;
        return ts?.seconds ? new Date(ts.seconds*1000).toLocaleDateString('en-NG',{day:'numeric',month:'short'}) : '';
    });
    const chartVals = sorted.map(d => Number(d.data().score || d.data().percentage || 0));
    const maxScore = Math.max(100, ...chartVals);
    const chartBars = chartVals.map((v,i) => {
        const pct = Math.round((v/maxScore)*100);
        const col = v >= 85 ? '#22c55e' : v >= 65 ? '#f59e0b' : '#ef4444';
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:.3rem;">
            <div style="font-size:.65rem;font-weight:700;color:#374151;">${v}%</div>
            <div style="width:100%;background:#f3f4f6;border-radius:.4rem;overflow:hidden;height:80px;display:flex;flex-direction:column;justify-content:flex-end;">
                <div style="background:${col};width:100%;height:${pct}%;transition:height .6s ease;border-radius:.4rem .4rem 0 0;"></div>
            </div>
            <div style="font-size:.6rem;color:#9ca3af;text-align:center;max-width:42px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(chartLabels[i])}</div>
        </div>`;
    }).join('');

    const pendingHw = hwSnap.docs.filter(d => ['assigned','sent'].includes(d.data().status));
    const totalTopics = topicsSnap.docs.length;

    main.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem;">
            <!-- Next class -->
            <div style="grid-column:1/-1;">${nextClassHTML}</div>

            <!-- Stats row -->
            <div class="sp-stat-card" style="background:#fef3c7;">
                <div style="font-size:2rem;font-weight:900;color:#d97706;">${pendingHw.length}</div>
                <div style="font-size:.75rem;font-weight:600;color:#92400e;">📝 Assignments Due</div>
            </div>
            <div class="sp-stat-card" style="background:#d1fae5;">
                <div style="font-size:2rem;font-weight:900;color:#065f46;">${totalTopics}</div>
                <div style="font-size:.75rem;font-weight:600;color:#065f46;">📚 Topics Covered</div>
            </div>
            <div class="sp-stat-card" style="background:#ede9fe;">
                <div style="font-size:2rem;font-weight:900;color:#5b21b6;">${myAvg !== null ? myAvg+'%' : '—'}</div>
                <div style="font-size:.75rem;font-weight:600;color:#5b21b6;">🏅 My Avg Grade</div>
            </div>
            <div class="sp-stat-card" style="background:#dbeafe;">
                <div style="font-size:2rem;font-weight:900;color:#1d4ed8;">${peerAvg !== null ? peerAvg+'%' : '—'}</div>
                <div style="font-size:.75rem;font-weight:600;color:#1d4ed8;">👥 Grade ${esc(student.grade||'')} Avg</div>
            </div>
        </div>

        <!-- Performance chart -->
        <div class="sp-card mb-4">
            <div class="sp-card-header"><h3>📈 Performance Overview</h3></div>
            <div class="sp-card-body">
                ${chartVals.length === 0
                    ? `<div class="text-center py-6 text-gray-400">No grades recorded yet. Your progress chart will appear here as results come in.</div>`
                    : `<div style="display:flex;gap:.5rem;align-items:flex-end;height:130px;padding:.5rem 0;">${chartBars}</div>`}
            </div>
        </div>

        <!-- Upcoming Schedule -->
        <div class="sp-card mb-4">
            <div class="sp-card-header"><h3>🗓️ Upcoming Schedule</h3></div>
            <div class="sp-card-body">
                ${schedSlots.length === 0
                    ? '<p class="text-gray-400 text-sm text-center py-4">No schedule set yet. Your tutor will add it soon.</p>'
                    : `<div class="space-y-2">${schedSlots.sort((a,b)=>(DAYS.indexOf(a.day)-DAYS.indexOf(b.day))).map(sl => {
                        const local = convertLagosToLocal(sl.day, sl.start);
                        const localEnd = sl.end ? convertLagosToLocal(sl.day, sl.end) : '';
                        return `<div style="display:flex;align-items:center;gap:.75rem;background:#f8fafc;border-radius:.6rem;padding:.6rem .9rem;border:1px solid #e5e7eb;">
                            <div style="font-weight:700;width:2.8rem;color:#4f46e5;font-size:.85rem;">${esc(sl.day?.slice(0,3))}</div>
                            <div style="flex:1;">
                                <span style="font-size:.85rem;font-weight:600;">${esc(sl.start)} ${sl.end?'– '+sl.end:''}</span>
                                <span style="font-size:.75rem;color:#6b7280;margin-left:.4rem;">(Nigeria)</span>
                                <div style="font-size:.75rem;color:#4f46e5;margin-top:.1rem;">🕐 ${local}${localEnd?' – '+localEnd:''} <span style="color:#9ca3af;">(Your Time)</span></div>
                            </div>
                            ${sl.subject ? `<div style="font-size:.75rem;color:#9ca3af;">${esc(sl.subject)}</div>` : ''}
                        </div>`;
                    }).join('')}</div>`}
            </div>
        </div>
    `;
}

// ── MESSAGES ──
async function renderMessages(student) {
    const main = $('main-content');
    main.innerHTML = `
        <div class="sp-card" style="height:calc(100vh - 160px);display:flex;flex-direction:column;">
            <div class="sp-card-header" style="flex-shrink:0;">
                <h3>💬 Messages with ${esc(student.tutorName||'Tutor')}</h3>
                <div style="font-size:.75rem;color:#9ca3af;">All messages are private between you and your tutor</div>
            </div>
            <div id="chat-messages-student" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem;">
                <div class="text-center py-6"><div class="spinner mx-auto mb-2"></div><p class="text-gray-500 text-sm">Loading messages…</p></div>
            </div>
            <div style="flex-shrink:0;padding:.75rem;border-top:1px solid #f3f4f6;display:flex;gap:.5rem;">
                <input type="text" id="student-msg-input" placeholder="Type a message…"
                    style="flex:1;border:1px solid #e5e7eb;border-radius:.75rem;padding:.6rem 1rem;font-size:.875rem;outline:none;">
                <button id="student-send-btn" style="background:#4f46e5;color:#fff;border:none;border-radius:.75rem;padding:.6rem 1rem;font-weight:700;cursor:pointer;">Send ➤</button>
            </div>
        </div>
    `;

    // Build conversation ID (student.id + tutor ID or email)
    const tutorEmail = student.tutorEmail || '';
    const convId = [student.id, tutorEmail].sort().join('_');
    const messagesRef = collection(db, 'conversations', convId, 'messages');

    // Ensure conversation doc exists
    try {
        await setDoc(doc(db, 'conversations', convId), {
            participants: [student.id, tutorEmail],
            participantDetails: {
                [student.id]: { name: student.studentName || 'Student', role: 'student' },
                [tutorEmail]: { name: student.tutorName || 'Tutor', role: 'tutor' }
            },
            lastMessage: '',
            lastMessageTimestamp: new Date(),
            lastSenderId: '',
            unreadCount: 0
        }, { merge: true });
    } catch(e) {}

    if (unsubMessages) unsubMessages();
    unsubMessages = onSnapshot(query(messagesRef), (snap) => {
        const msgEl = $('chat-messages-student');
        if (!msgEl) return;
        const msgs = [];
        snap.forEach(d => msgs.push({ id: d.id, ...d.data() }));
        msgs.sort((a,b) => {
            const ta = a.createdAt?.seconds || 0, tb = b.createdAt?.seconds || 0;
            return ta - tb;
        });
        if (msgs.length === 0) {
            msgEl.innerHTML = `<div class="text-center py-8 text-gray-400">
                <div style="font-size:2rem;margin-bottom:.5rem">💬</div>
                <p>No messages yet. Say hello to your tutor!</p>
            </div>`;
            return;
        }
        msgEl.innerHTML = msgs.map(msg => {
            const isMe = msg.senderId === student.id;
            const time = fmtDateTime(msg.createdAt);
            const hasImg = msg.imageUrl;
            return `<div style="display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'};">
                <div style="max-width:75%;background:${isMe?'#4f46e5':'#f3f4f6'};color:${isMe?'#fff':'#1f2937'};
                    border-radius:${isMe?'1rem 1rem 0 1rem':'1rem 1rem 1rem 0'};padding:.6rem .9rem;font-size:.875rem;">
                    ${msg.subject ? `<div style="font-weight:700;margin-bottom:.2rem;font-size:.8rem;opacity:.8;">${esc(msg.subject)}</div>` : ''}
                    <div>${esc(msg.content || msg.text || '')}</div>
                    ${hasImg ? `<img src="${esc(msg.imageUrl)}" style="max-width:100%;border-radius:.5rem;margin-top:.4rem;" />` : ''}
                </div>
                <div style="font-size:.65rem;color:#9ca3af;margin-top:.2rem;padding:0 .3rem;">${time}</div>
            </div>`;
        }).join('');
        msgEl.scrollTop = msgEl.scrollHeight;
    });

    // Image upload button
    const inputArea = $('student-msg-input')?.parentElement;
    if (inputArea) {
        const imgBtn = document.createElement('label');
        imgBtn.style.cssText = 'cursor:pointer;display:flex;align-items:center;color:#9ca3af;font-size:1.2rem;';
        imgBtn.innerHTML = `📎<input type="file" accept="image/*" id="msg-img-file" style="display:none;">`;
        inputArea.insertBefore(imgBtn, $('student-msg-input'));
    }

    const sendMessage = async () => {
        const input = $('student-msg-input');
        const txt = input?.value?.trim();
        const imgFile = $('msg-img-file')?.files?.[0];
        if (!txt && !imgFile) return;
        if (input) input.value = '';

        let imageUrl = null;
        if (imgFile) {
            // Convert to base64 dataURL (no Firebase Storage needed)
            imageUrl = await new Promise(resolve => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.readAsDataURL(imgFile);
            });
            if ($('msg-img-file')) $('msg-img-file').value = '';
        }

        const now = new Date();
        const msgData = { content: txt || '', senderId: student.id, senderName: student.studentName || 'Student', createdAt: now, read: false };
        if (imageUrl) msgData.imageUrl = imageUrl;

        await addDoc(messagesRef, msgData);
        await updateDoc(doc(db, 'conversations', convId), {
            lastMessage: txt || '📷 Image', lastMessageTimestamp: now,
            lastSenderId: student.id, unreadCount: 1
        });
    };

    $('student-send-btn')?.addEventListener('click', sendMessage);
    $('student-msg-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
}

// ── MY COURSES ──
async function renderCourses(student) {
    const main = $('main-content');
    main.innerHTML = `<div class="text-center py-10"><div class="spinner mx-auto mb-3"></div></div>`;

    try {
        const snap = await getDocs(query(
            collection(db, 'courses'),
            where('tutorEmail', '==', student.tutorEmail)
        ));

        if (snap.empty) {
            main.innerHTML = `<div class="sp-empty-state"><div style="font-size:2rem">📚</div><p>No courses shared yet. Check back soon!</p></div>`;
            return;
        }

        const courses = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(c => !c.targetStudentId || c.targetStudentId === student.id);

        main.innerHTML = `
            <h2 style="font-size:1.1rem;font-weight:800;margin-bottom:1rem;">📚 My Courses</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;">
                ${courses.map(c => {
                    const fileUrl = c.fileUrl || c.url || c.driveLink || '';
                    const preview = c.thumbnailUrl || c.previewUrl || '';
                    const isLink = fileUrl.startsWith('http');
                    return `<div class="sp-course-card" onclick="window.open('${esc(fileUrl)}','_blank')" style="cursor:${isLink?'pointer':'default'};">
                        ${preview ? `<div style="height:120px;overflow:hidden;border-radius:.6rem .6rem 0 0;background:#f3f4f6;">
                            <img src="${esc(preview)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">
                        </div>` : `<div style="height:80px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:.6rem .6rem 0 0;display:flex;align-items:center;justify-content:center;font-size:2rem;">📄</div>`}
                        <div style="padding:.75rem;">
                            <div style="font-weight:700;font-size:.9rem;margin-bottom:.25rem;">${esc(c.title||c.name||'Course Material')}</div>
                            <div style="font-size:.75rem;color:#6b7280;">${esc(c.subject||c.category||'')} ${c.uploadedAt?'· '+fmtDate(c.uploadedAt):''}</div>
                            ${c.description ? `<div style="font-size:.75rem;color:#9ca3af;margin-top:.3rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(c.description)}</div>` : ''}
                            ${isLink ? `<div style="margin-top:.6rem;font-size:.75rem;color:#4f46e5;font-weight:600;">🔗 Open in new tab ↗</div>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
    } catch(e) {
        main.innerHTML = `<div class="sp-empty-state text-red-500">Error loading courses: ${esc(e.message)}</div>`;
    }
}

// ── ASSIGNMENTS ──
async function renderAssignments(student) {
    const main = $('main-content');
    main.innerHTML = `<div class="text-center py-10"><div class="spinner mx-auto mb-3"></div></div>`;

    try {
        const snap = await getDocs(query(
            collection(db,'homework_assignments'),
            where('studentId','==',student.id)
        ));

        const hwList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Group by ISO week key
        const byWeek = {};
        hwList.forEach(hw => {
            const ts = hw.assignedAt || hw.createdAt;
            const d = ts?.seconds ? new Date(ts.seconds*1000) : new Date(ts || Date.now());
            const wk = getISOWeekKey(d);
            if (!byWeek[wk]) byWeek[wk] = { date: d, hw: [] };
            byWeek[wk].hw.push(hw);
        });

        const weeks = Object.entries(byWeek).sort((a,b) => b[0].localeCompare(a[0]));

        if (weeks.length === 0) {
            main.innerHTML = `<div class="sp-empty-state"><div style="font-size:2rem">📝</div><p>No assignments yet. Your tutor will send some soon!</p></div>`;
            return;
        }

        main.innerHTML = `
            <h2 style="font-size:1.1rem;font-weight:800;margin-bottom:1rem;">📝 Assignments</h2>
            <div style="display:flex;flex-direction:column;gap:.75rem;">
                ${weeks.map(([wk, { date, hw }]) => {
                    const { mon } = getWeekRange(0);
                    const isCurrentWeek = getISOWeekKey(new Date()) === wk;
                    const weekLabel = isCurrentWeek ? 'This Week'
                        : `Week of ${date.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}`;
                    const pending = hw.filter(h => ['assigned','sent'].includes(h.status)).length;
                    return `<details ${isCurrentWeek?'open':''} style="background:#fff;border:1px solid #e5e7eb;border-radius:1rem;overflow:hidden;">
                        <summary style="display:flex;align-items:center;gap:.75rem;padding:.9rem 1.1rem;cursor:pointer;list-style:none;user-select:none;">
                            <div style="flex:1;">
                                <span style="font-weight:700;font-size:.9rem;">${esc(weekLabel)}</span>
                                ${isCurrentWeek?`<span style="margin-left:.5rem;background:#dbeafe;color:#1d4ed8;font-size:.65rem;font-weight:700;padding:.15rem .45rem;border-radius:.3rem;">CURRENT</span>`:''}
                            </div>
                            <span style="font-size:.75rem;font-weight:600;color:${pending>0?'#d97706':'#16a34a'};">${pending} pending · ${hw.length} total</span>
                            <i class="fas fa-chevron-right" style="font-size:.7rem;color:#9ca3af;transition:.2s;"></i>
                        </summary>
                        <div style="border-top:1px solid #f3f4f6;padding:.75rem;">
                            ${hw.sort((a,b)=>(b.assignedAt?.seconds||0)-(a.assignedAt?.seconds||0)).map(h => {
                                const status = h.status || 'assigned';
                                const statusCol = status==='graded'?'#16a34a':status==='submitted'?'#d97706':'#ef4444';
                                const statusLabel = status==='graded'?`✅ Graded ${h.score?`(${h.score}/100)`:''}`
                                    :status==='submitted'?'⏳ Submitted':'📋 Pending';
                                const fileUrl = h.fileUrl || h.url || h.driveLink || '';
                                return `<div style="border:1px solid #f3f4f6;border-radius:.65rem;padding:.75rem;margin-bottom:.5rem;background:#fafafa;">
                                    <div style="display:flex;align-items:start;gap:.5rem;">
                                        <div style="flex:1;min-width:0;">
                                            <div style="font-weight:600;font-size:.875rem;">${esc(h.title||'Homework')}</div>
                                            <div style="font-size:.75rem;color:#6b7280;margin-top:.1rem;">${fmtDate(h.assignedAt)} ${h.subject?'· '+h.subject:''}</div>
                                            ${h.description?`<div style="font-size:.78rem;color:#374151;margin-top:.35rem;">${esc(h.description)}</div>`:''}
                                            ${h.feedback?`<div style="margin-top:.4rem;background:#f0fdf4;border-radius:.5rem;padding:.4rem .6rem;font-size:.75rem;color:#166534;border-left:2px solid #16a34a;">${esc(h.feedback)}</div>`:''}
                                        </div>
                                        <div style="font-size:.72rem;font-weight:700;color:${statusCol};white-space:nowrap;">${statusLabel}</div>
                                    </div>
                                    <div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap;">
                                        ${fileUrl ? `<button onclick="window.open('${esc(fileUrl)}','_blank')" style="font-size:.75rem;background:#eff6ff;color:#1d4ed8;border:none;border-radius:.5rem;padding:.3rem .7rem;cursor:pointer;font-weight:600;">📄 Open Assignment</button>` : ''}
                                        ${fileUrl && status !== 'graded' ? `<button onclick="openAnnotateModal('${esc(h.id)}','${esc(fileUrl)}')" style="font-size:.75rem;background:#fef3c7;color:#92400e;border:none;border-radius:.5rem;padding:.3rem .7rem;cursor:pointer;font-weight:600;">✏️ Annotate & Submit</button>` : ''}
                                        ${status === 'submitted' || status === 'graded' ? `<span style="font-size:.72rem;color:#9ca3af;">Submitted ${fmtDate(h.submittedAt)}</span>` : ''}
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </details>`;
                }).join('')}
            </div>`;
    } catch(e) {
        main.innerHTML = `<div class="sp-empty-state text-red-500">Error: ${esc(e.message)}</div>`;
    }
}

// ── ANNOTATE MODAL ──
window.openAnnotateModal = function(hwId, fileUrl) {
    document.querySelectorAll('.annotate-modal').forEach(e => e.remove());
    const modal = document.createElement('div');
    modal.className = 'annotate-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;flex-direction:column;';
    modal.innerHTML = `
        <div style="background:#1f2937;color:#fff;padding:.75rem 1rem;display:flex;align-items:center;gap:.75rem;flex-shrink:0;">
            <button onclick="this.closest('.annotate-modal').remove()" style="border:none;background:rgba(255,255,255,.15);color:#fff;border-radius:.4rem;padding:.3rem .7rem;cursor:pointer;">✕ Close</button>
            <span style="font-weight:700;flex:1;">✏️ Annotate & Submit Assignment</span>
            <textarea id="annotation-note" placeholder="Add your answer or comments here…" rows="2"
                style="font-size:.8rem;border:none;border-radius:.4rem;padding:.4rem .6rem;resize:none;width:220px;"></textarea>
            <button id="submit-annotated-btn" style="background:#22c55e;color:#fff;border:none;border-radius:.5rem;padding:.5rem 1rem;font-weight:700;cursor:pointer;">📤 Submit</button>
        </div>
        <iframe src="${esc(fileUrl)}" style="flex:1;width:100%;border:none;" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
    `;
    document.body.appendChild(modal);
    $('submit-annotated-btn')?.addEventListener('click', async () => {
        const note = $('annotation-note')?.value?.trim() || '';
        try {
            await updateDoc(doc(db, 'homework_assignments', hwId), {
                status: 'submitted',
                submittedAt: new Date(),
                studentNote: note,
                submittedBy: studentData?.studentName || ''
            });
            modal.remove();
            renderAssignments(studentData);
            alert('Assignment submitted!');
        } catch(e) { alert('Error: ' + e.message); }
    });
};

// ── RESULTS ──
async function renderResults(student) {
    const main = $('main-content');
    main.innerHTML = `<div class="text-center py-10"><div class="spinner mx-auto mb-3"></div></div>`;

    try {
        const snap = await getDocs(query(
            collection(db,'student_results'),
            where('studentId','==',student.id)
        ));
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a,b) => (b.submittedAt?.seconds||b.date?.seconds||0) - (a.submittedAt?.seconds||a.date?.seconds||0));

        if (results.length === 0) {
            main.innerHTML = `<div class="sp-empty-state"><div style="font-size:2rem">📊</div><p>No results yet. Your grades will appear here once homework is graded.</p></div>`;
            return;
        }

        main.innerHTML = `
            <h2 style="font-size:1.1rem;font-weight:800;margin-bottom:1rem;">📊 My Results</h2>
            <div style="display:flex;flex-direction:column;gap:.75rem;">
                ${results.map(r => {
                    const score = r.score || r.percentage || 0;
                    const col = score >= 85 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
                    const label = score >= 85 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Average' : 'Needs Work';
                    return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:.85rem;padding:1rem;display:flex;align-items:center;gap:1rem;">
                        <div style="width:3rem;height:3rem;border-radius:.75rem;background:${col}20;display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:900;color:${col};flex-shrink:0;">${score}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:700;font-size:.9rem;">${esc(r.subject||r.course||r.title||'Assignment')}</div>
                            <div style="font-size:.75rem;color:#6b7280;margin-top:.15rem;">${fmtDate(r.submittedAt||r.date)} ${r.tutorName?'· by '+r.tutorName:''}</div>
                            ${r.feedback?`<div style="font-size:.78rem;color:#374151;margin-top:.3rem;font-style:italic;">"${esc(r.feedback)}"</div>`:''}
                        </div>
                        <div style="text-align:right;flex-shrink:0;">
                            <div style="font-size:.75rem;font-weight:700;color:${col};">${label}</div>
                            <div style="font-size:.7rem;color:#9ca3af;margin-top:.2rem;">${score}%</div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;
    } catch(e) {
        main.innerHTML = `<div class="sp-empty-state text-red-500">Error: ${esc(e.message)}</div>`;
    }
}

// ── SCHEDULE ──
async function renderSchedule(student) {
    const main = $('main-content');
    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

    let slots = student.schedule || [];
    try {
        const snap = await getDocs(query(collection(db,'schedules'), where('studentId','==',student.id)));
        if (!snap.empty) slots = snap.docs[0].data().schedule || slots;
    } catch(e) {}

    if (slots.length === 0) {
        main.innerHTML = `<div class="sp-empty-state"><div style="font-size:2rem">🗓️</div><p>No schedule set yet. Your tutor will configure it shortly.</p></div>`;
        return;
    }

    const byDay = {};
    DAYS.forEach(d => { byDay[d] = []; });
    slots.forEach(sl => { if (byDay[sl.day]) byDay[sl.day].push(sl); });

    main.innerHTML = `
        <h2 style="font-size:1.1rem;font-weight:800;margin-bottom:1rem;">🗓️ My Schedule</h2>
        <div style="font-size:.8rem;color:#6b7280;margin-bottom:1rem;">Times shown in Nigeria time (WAT) and your local time (${esc(localTZ.replace('_',' '))})</div>
        <div style="display:flex;flex-direction:column;gap:1rem;">
            ${DAYS.filter(d => byDay[d].length > 0).map(d => `
                <div style="background:#fff;border:1px solid #e5e7eb;border-radius:.85rem;overflow:hidden;">
                    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;padding:.6rem 1rem;font-weight:700;font-size:.875rem;">${d}</div>
                    <div style="padding:.75rem;display:flex;flex-direction:column;gap:.5rem;">
                        ${byDay[d].map(sl => {
                            const local = convertLagosToLocal(sl.day, sl.start);
                            const localEnd = sl.end ? convertLagosToLocal(sl.day, sl.end) : '';
                            return `<div style="display:flex;align-items:center;gap:.75rem;background:#f8fafc;border-radius:.5rem;padding:.5rem .75rem;">
                                <div style="flex:1;">
                                    <div style="font-size:.85rem;font-weight:600;">⏰ ${esc(sl.start)}${sl.end?' – '+sl.end:''} <span style="color:#9ca3af;font-weight:400;font-size:.75rem;">(Nigeria)</span></div>
                                    <div style="font-size:.8rem;color:#4f46e5;margin-top:.15rem;">🕐 ${local}${localEnd?' – '+localEnd:''} <span style="color:#9ca3af;font-size:.7rem;">(Your Time)</span></div>
                                    ${sl.subject?`<div style="font-size:.75rem;color:#6b7280;margin-top:.1rem;">📖 ${esc(sl.subject)}</div>`:''}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`).join('')}
        </div>`;
}

/*──────────────────────────────────────────────────────────
  EDUCATIONAL GAMES
──────────────────────────────────────────────────────────*/

const GAME_SUBJECTS = ['maths','ela','biology','chemistry','physics','scrabble','snake'];

function getGradeLevel(grade) {
    const g = parseInt(grade) || 5;
    if (g <= 3) return 'beginner';
    if (g <= 6) return 'intermediate';
    if (g <= 9) return 'advanced';
    return 'expert';
}

const QUESTIONS = {
    maths: {
        beginner: [
            { q: 'What is 7 + 8?', opts: ['13','14','15','16'], a: '15' },
            { q: 'What is 36 ÷ 6?', opts: ['5','6','7','8'], a: '6' },
            { q: 'What is 12 × 3?', opts: ['34','36','38','40'], a: '36' },
            { q: 'What is 25 − 9?', opts: ['14','15','16','17'], a: '16' },
            { q: 'What is 100 ÷ 4?', opts: ['20','25','30','35'], a: '25' }
        ],
        intermediate: [
            { q: 'Solve: 3x = 27', opts: ['6','7','8','9'], a: '9' },
            { q: 'Area of rectangle 7×4?', opts: ['22','24','28','30'], a: '28' },
            { q: 'What is 15% of 200?', opts: ['25','30','35','40'], a: '30' },
            { q: 'What is 2³ + 4²?', opts: ['20','22','24','26'], a: '24' },
            { q: 'LCM of 4 and 6?', opts: ['10','12','14','16'], a: '12' }
        ],
        advanced: [
            { q: 'If f(x) = 2x² – 3, what is f(3)?', opts: ['15','18','21','27'], a: '15' },
            { q: 'Solve: x² − 5x + 6 = 0, larger root?', opts: ['2','3','4','5'], a: '3' },
            { q: 'What is √(144)?', opts: ['10','11','12','13'], a: '12' },
            { q: 'Gradient of line y = 3x + 5?', opts: ['3','5','8','15'], a: '3' },
            { q: 'Sum of interior angles of hexagon?', opts: ['540','600','720','900'], a: '720' }
        ],
        expert: [
            { q: 'Integral of 2x dx =?', opts: ['x + C','x² + C','2x² + C','x²/2 + C'], a: 'x² + C' },
            { q: 'sin²θ + cos²θ =?', opts: ['0','1','2', 'sin2θ'], a: '1' },
            { q: 'Derivative of x³ =?', opts: ['x²','2x²','3x²','4x²'], a: '3x²' },
            { q: 'log₁₀(1000) =?', opts: ['2','3','4','5'], a: '3' },
            { q: 'Arithmetic sequence 2,5,8,11... 10th term?', opts: ['27','28','29','30'], a: '29' }
        ]
    },
    ela: {
        beginner: [
            { q: 'Which is a noun?', opts: ['run','happy','quickly','apple'], a: 'apple' },
            { q: 'Plural of "child"?', opts: ['childs','childrens','children','childes'], a: 'children' },
            { q: 'Opposite of "hot"?', opts: ['warm','cool','cold','icy'], a: 'cold' },
            { q: '"She __ to school." (Correct verb)', opts: ['go','goes','gone','going'], a: 'goes' },
            { q: 'Which sentence is correct?', opts: ['He run fast.','He runs fast.','He running fast.','He ran fast is.'], a: 'He runs fast.' }
        ],
        intermediate: [
            { q: 'A simile compares using:', opts: ['metaphor','as or like','hyperbole','alliteration'], a: 'as or like' },
            { q: 'What is a homophone of "their"?', opts: ['there','the','them','they'], a: 'there' },
            { q: '"Enormous" means:', opts: ['tiny','medium','very large','colourful'], a: 'very large' },
            { q: 'Which is the topic sentence of a paragraph?', opts: ['A detail sentence','The closing sentence','The opening main-idea sentence','A transition word'], a: 'The opening main-idea sentence' },
            { q: '"Fortnight" means:', opts: ['4 days','7 days','14 days','30 days'], a: '14 days' }
        ],
        advanced: [
            { q: 'What literary device is "The wind whispered"?', opts: ['simile','metaphor','personification','alliteration'], a: 'personification' },
            { q: 'A persuasive essay's primary purpose is to:', opts: ['entertain','inform','convince','describe'], a: 'convince' },
            { q: 'The climax of a story is:', opts: ['the introduction','the rising action','the turning point of highest tension','the resolution'], a: 'the turning point of highest tension' },
            { q: '"Loquacious" means:', opts: ['silent','very talkative','confused','aggressive'], a: 'very talkative' },
            { q: 'Which is NOT a type of irony?', opts: ['verbal','dramatic','situational','circular'], a: 'circular' }
        ],
        expert: [
            { q: 'A Shakespearean sonnet has __ lines.', opts: ['10','12','14','16'], a: '14' },
            { q: 'Epistrophe is the repetition of words at:', opts: ['the start of clauses','the end of clauses','random intervals','the middle of clauses'], a: 'the end of clauses' },
            { q: 'Which novel features Winston Smith?', opts: ['Brave New World','Animal Farm','1984','Fahrenheit 451'], a: '1984' },
            { q: 'The "unreliable narrator" technique means:', opts: ['the narrator is omniscient','we cannot fully trust the narrator's account','the story has no narrator','first-person only'], a: 'we cannot fully trust the narrator\'s account' },
            { q: 'Iambic pentameter has __ syllables per line.', opts: ['8','10','12','14'], a: '10' }
        ]
    },
    biology: {
        beginner: [
            { q: 'What do plants use to make food?', opts: ['Moonlight','Sunlight','Rainwater only','Oxygen'], a: 'Sunlight' },
            { q: 'Humans have how many chambers in the heart?', opts: ['2','3','4','5'], a: '4' },
            { q: 'DNA is found in the cell\'s:', opts: ['membrane','cytoplasm','nucleus','wall'], a: 'nucleus' },
            { q: 'Which gas do plants absorb?', opts: ['Oxygen','Nitrogen','Carbon dioxide','Hydrogen'], a: 'Carbon dioxide' },
            { q: 'The basic unit of life is the:', opts: ['atom','organ','cell','tissue'], a: 'cell' }
        ],
        intermediate: [
            { q: 'Mitosis produces __ daughter cells.', opts: ['1','2','3','4'], a: '2' },
            { q: 'Osmosis is the movement of:', opts: ['solutes','proteins','water','ions'], a: 'water' },
            { q: 'Which blood cells carry oxygen?', opts: ['White blood cells','Platelets','Red blood cells','Plasma'], a: 'Red blood cells' },
            { q: 'The powerhouse of the cell is:', opts: ['ribosome','mitochondria','nucleus','vacuole'], a: 'mitochondria' },
            { q: 'A dominant allele is represented by:', opts: ['lowercase letter','uppercase letter','number','symbol'], a: 'uppercase letter' }
        ],
        advanced: [
            { q: 'Enzyme activity is affected by:', opts: ['colour','temperature & pH','gravity','pressure alone'], a: 'temperature & pH' },
            { q: 'During meiosis, chromosome number:', opts: ['doubles','stays same','halves','triples'], a: 'halves' },
            { q: 'The fluid-mosaic model describes:', opts: ['DNA structure','cell membrane','nuclear envelope','ribosome'], a: 'cell membrane' },
            { q: 'Biotic factors include:', opts: ['temperature','rainfall','living organisms','soil pH'], a: 'living organisms' },
            { q: 'ATP stands for:', opts: ['Adenine Tri-Phosphate','Adenosine Tri-Protein','Adenosine Triphosphate','Acid Transfer Protein'], a: 'Adenosine Triphosphate' }
        ],
        expert: [
            { q: 'The lac operon is an example of:', opts: ['eukaryotic gene expression','prokaryotic gene regulation','mRNA splicing','post-translational modification'], a: 'prokaryotic gene regulation' },
            { q: 'Hardy-Weinberg equilibrium assumes:', opts: ['natural selection','genetic drift','random mating','mutation'], a: 'random mating' },
            { q: 'Chargaff\'s rule states:', opts: ['A=G, T=C','A=T, G=C','A+T=G+C','A=C, T=G'], a: 'A=T, G=C' },
            { q: 'Sodium-potassium pump moves:', opts: ['3 Na⁺ out, 2 K⁺ in','2 Na⁺ out, 3 K⁺ in','3 K⁺ out, 2 Na⁺ in','equal exchange'], a: '3 Na⁺ out, 2 K⁺ in' },
            { q: 'Signal transduction involves:', opts: ['direct DNA exchange','receptor → second messenger → response','osmosis only','pure diffusion'], a: 'receptor → second messenger → response' }
        ]
    },
    chemistry: {
        beginner: [
            { q: 'The symbol for water is:', opts: ['H₂O₂','HO','H₂O','H₃O'], a: 'H₂O' },
            { q: 'What is the atomic number of Carbon?', opts: ['6','8','12','14'], a: '6' },
            { q: 'Acids have a pH:', opts: ['above 7','equal to 7','below 7','above 14'], a: 'below 7' },
            { q: 'Which is a noble gas?', opts: ['Nitrogen','Helium','Hydrogen','Oxygen'], a: 'Helium' },
            { q: 'NaCl is common:', opts: ['sugar','salt','soap','baking soda'], a: 'salt' }
        ],
        intermediate: [
            { q: 'Number of electrons in Na⁺:', opts: ['10','11','12','9'], a: '10' },
            { q: 'Avogadro\'s number is approximately:', opts: ['6.02×10²³','6.02×10²⁰','3.14×10²³','1×10²⁴'], a: '6.02×10²³' },
            { q: 'In endothermic reactions, energy is:', opts: ['released','absorbed','neither','produced as light'], a: 'absorbed' },
            { q: 'Valency of Oxygen:', opts: ['1','2','3','4'], a: '2' },
            { q: 'The formula for sulfuric acid:', opts: ['HCl','HNO₃','H₂SO₄','H₃PO₄'], a: 'H₂SO₄' }
        ],
        advanced: [
            { q: 'An oxidising agent is:', opts: ['gains electrons','loses electrons','gains protons','loses protons'], a: 'gains electrons' },
            { q: 'Boyle\'s Law states P and V are:', opts: ['directly proportional','inversely proportional','equal','unrelated'], a: 'inversely proportional' },
            { q: 'The rate-determining step is:', opts: ['fastest step','slowest step','first step','last step'], a: 'slowest step' },
            { q: 'Le Chatelier\'s principle is about:', opts: ['entropy','equilibrium shifts','ionisation','orbital theory'], a: 'equilibrium shifts' },
            { q: 'Electronegativity increases:', opts: ['down a group','across a period left to right','down and left','randomly'], a: 'across a period left to right' }
        ],
        expert: [
            { q: 'VSEPR predicts:', opts: ['electron mass','molecular geometry','reaction rate','bond enthalpy'], a: 'molecular geometry' },
            { q: 'The Haber process produces:', opts: ['H₂SO₄','HNO₃','NH₃','CO₂'], a: 'NH₃' },
            { q: 'Buffer solutions resist changes in:', opts: ['temperature','pressure','pH','volume'], a: 'pH' },
            { q: 'Entropy (S) measures:', opts: ['energy content','disorder/randomness','temperature','enthalpy'], a: 'disorder/randomness' },
            { q: 'Ziegler-Natta catalysts are used in:', opts: ['petroleum refining','polymerisation','alcohol production','acid-base reactions'], a: 'polymerisation' }
        ]
    },
    physics: {
        beginner: [
            { q: 'Speed = Distance ÷ ?', opts: ['Mass','Time','Force','Energy'], a: 'Time' },
            { q: 'What is the unit of force?', opts: ['Joule','Watt','Newton','Pascal'], a: 'Newton' },
            { q: 'Light travels fastest in:', opts: ['water','glass','vacuum','air'], a: 'vacuum' },
            { q: 'Which is NOT a type of energy?', opts: ['kinetic','potential','molecular','thermal'], a: 'molecular' },
            { q: 'Gravity on Earth is approx. __ m/s²:', opts: ['5.8','8.9','9.8','10.8'], a: '9.8' }
        ],
        intermediate: [
            { q: 'Ohm\'s Law: V = ?', opts: ['I/R','R/I','IR','I+R'], a: 'IR' },
            { q: 'Power = Energy ÷ ?', opts: ['Force','Distance','Time','Mass'], a: 'Time' },
            { q: 'A convex lens __ light rays.', opts: ['diverges','reflects','converges','absorbs'], a: 'converges' },
            { q: 'Frequency is measured in:', opts: ['Metres','Watts','Hertz','Joules'], a: 'Hertz' },
            { q: 'Pressure = Force ÷ ?', opts: ['Area','Volume','Mass','Time'], a: 'Area' }
        ],
        advanced: [
            { q: 'Momentum = mass × ?', opts: ['acceleration','force','velocity','energy'], a: 'velocity' },
            { q: 'E = mc² was proposed by:', opts: ['Newton','Bohr','Einstein','Faraday'], a: 'Einstein' },
            { q: 'Total internal reflection requires:', opts: ['angle < critical angle','angle = 0','angle > critical angle','any angle'], a: 'angle > critical angle' },
            { q: 'Half-life is the time for __ of atoms to decay.', opts: ['all','1/4','1/2','3/4'], a: '1/2' },
            { q: 'In SHM, acceleration is proportional to:', opts: ['velocity','displacement','time','force'], a: 'displacement' }
        ],
        expert: [
            { q: 'Heisenberg\'s Uncertainty Principle states we cannot precisely know both:', opts: ['mass & charge','position & momentum','speed & direction','energy & time'], a: 'position & momentum' },
            { q: 'A photon\'s energy E = ?', opts: ['hf','hλ','mc²','fλ'], a: 'hf' },
            { q: 'Maxwell\'s equations describe:', opts: ['quantum states','electromagnetism','thermodynamics','nuclear forces'], a: 'electromagnetism' },
            { q: 'Boltzmann constant relates temperature to:', opts: ['pressure','thermal energy','entropy only','electric field'], a: 'thermal energy' },
            { q: 'Superconductivity occurs:', opts: ['at high temperatures','at critical low temperatures','at high pressure only','always in metals'], a: 'at critical low temperatures' }
        ]
    }
};

const SCRABBLE_WORDS = {
    beginner: ['CAT','DOG','SUN','RUN','TOP','HAT','BIG','CUP','MAN','BOY','TEN','CAR','BED','EGG','HEN'],
    intermediate: ['PLANT','WATER','SHINE','BRAIN','STORM','CHAIR','SHELF','TRACK','GRAPE','BLEND'],
    advanced: ['OXYGEN','BRIDGE','FLIGHT','MASTER','SILVER','JUNGLE','FREEZE','THRONE','BOUNTY','CASTLE'],
    expert: ['QUANTUM','ECLIPSE','NUCLEUS','TRIUMPH','PHANTOM','BIZARRE','FRACTAL','JOURNEY','OLYMPIC','GLACIER']
};

async function renderGames(student) {
    const main = $('main-content');
    const level = getGradeLevel(student.grade);
    const subjects = student.subjects || ['maths','ela'];
    // Always include scrabble & snake, subject games only if student takes them
    const availableSubjects = ['maths','ela','biology','chemistry','physics'].filter(s =>
        subjects.map(sub => sub.toLowerCase()).some(sub => sub.includes(s.replace('maths','math'))) || s === 'maths' || s === 'ela'
    );
    const allGames = [...new Set([...availableSubjects, 'scrabble', 'snake'])];

    main.innerHTML = `
        <h2 style="font-size:1.1rem;font-weight:800;margin-bottom:.5rem;">🎮 Educational Games</h2>
        <p style="font-size:.8rem;color:#6b7280;margin-bottom:1rem;">Level: <strong>${level}</strong> (Grade ${esc(student.grade||'?')})</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem;">
            ${allGames.map(g => {
                const icons = {maths:'➗',ela:'📖',biology:'🧬',chemistry:'⚗️',physics:'⚡',scrabble:'🔤',snake:'🐍'};
                const colors = {maths:'#eff6ff',ela:'#fdf4ff',biology:'#f0fdf4',chemistry:'#fef3c7',physics:'#fff1f2',scrabble:'#f0f9ff',snake:'#ecfdf5'};
                const tcols = {maths:'#1d4ed8',ela:'#7c3aed',biology:'#15803d',chemistry:'#d97706',physics:'#dc2626',scrabble:'#0369a1',snake:'#065f46'};
                return `<button onclick="startGame('${g}')" style="background:${colors[g]||'#f9fafb'};border:2px solid ${tcols[g]||'#e5e7eb'};border-radius:1rem;padding:1.2rem .5rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:.4rem;transition:transform .15s;">
                    <div style="font-size:2rem;">${icons[g]||'🎯'}</div>
                    <div style="font-weight:700;font-size:.8rem;color:${tcols[g]||'#374151'};text-transform:capitalize;">${g === 'ela' ? 'ELA' : g.charAt(0).toUpperCase()+g.slice(1)}</div>
                </button>`;
            }).join('')}
        </div>
        <div id="game-area"></div>
        <div id="leaderboard-area" style="margin-top:1.5rem;"></div>
    `;

    loadLeaderboard(allGames, student);
}

window.startGame = function(subject) {
    const level = getGradeLevel(studentData?.grade);
    const area = $('game-area');
    if (!area) return;
    if (subject === 'snake') { startSnakeGame(area, level); return; }
    if (subject === 'scrabble') { startScrabbleGame(area, level); return; }
    startQuizGame(area, subject, level);
};

function startQuizGame(container, subject, level) {
    const pool = QUESTIONS[subject]?.[level] || QUESTIONS[subject]?.beginner || [];
    if (pool.length === 0) { container.innerHTML = `<div class="sp-empty-state">No questions available for this level.</div>`; return; }
    const questions = [...pool].sort(() => Math.random()-0.5);
    let idx = 0, score = 0;
    const render = () => {
        if (idx >= questions.length) {
            container.innerHTML = `
                <div class="sp-card" style="text-align:center;padding:2rem;">
                    <div style="font-size:3rem;margin-bottom:.5rem;">${score >= questions.length*0.8?'🏆':score>=questions.length*0.5?'⭐':'💪'}</div>
                    <h3 style="font-size:1.2rem;font-weight:800;">Quiz Complete!</h3>
                    <p style="font-size:1.5rem;font-weight:900;color:#4f46e5;margin:.5rem 0;">${score}/${questions.length}</p>
                    <p style="font-size:.85rem;color:#6b7280;margin-bottom:1rem;">${score >= questions.length*0.8?'Outstanding!':score>=questions.length*0.5?'Good effort!':'Keep practising!'}</p>
                    <button onclick="startQuizGame($('game-area'),'${subject}','${level}')" style="background:#4f46e5;color:#fff;border:none;border-radius:.5rem;padding:.5rem 1.2rem;font-weight:700;cursor:pointer;margin-right:.5rem;">🔄 Try Again</button>
                    <button onclick="window.startGame('${subject}')" style="background:#f3f4f6;color:#374151;border:none;border-radius:.5rem;padding:.5rem 1.2rem;font-weight:700;cursor:pointer;">✕ Quit</button>
                </div>`;
            saveScore(subject, score, questions.length);
            return;
        }
        const q = questions[idx];
        container.innerHTML = `
            <div class="sp-card" style="padding:1.5rem;">
                <div style="display:flex;justify-content:space-between;margin-bottom:1rem;">
                    <span style="font-size:.8rem;font-weight:700;color:#6b7280;">Question ${idx+1}/${questions.length}</span>
                    <span style="font-size:.8rem;font-weight:700;color:#4f46e5;">Score: ${score}</span>
                </div>
                <div style="font-size:1rem;font-weight:700;margin-bottom:1rem;color:#1f2937;">${esc(q.q)}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;">
                    ${q.opts.map((opt,i) => `<button onclick="answerQ('${esc(opt).replace(/'/g,"\\'")}')" style="background:#f3f4f6;border:2px solid #e5e7eb;border-radius:.65rem;padding:.6rem .5rem;font-size:.85rem;font-weight:600;cursor:pointer;transition:.15s;">
                        ${['A','B','C','D'][i]}) ${esc(opt)}</button>`).join('')}
                </div>
            </div>`;
        window.answerQ = (ans) => {
            const correct = ans === q.a;
            if (correct) score++;
            const btns = container.querySelectorAll('button');
            btns.forEach(btn => {
                const isCorrect = btn.textContent.includes(q.a);
                btn.style.background = isCorrect ? '#dcfce7' : (btn.textContent.includes(ans) && !correct ? '#fee2e2' : '#f3f4f6');
                btn.style.borderColor = isCorrect ? '#16a34a' : (btn.textContent.includes(ans) && !correct ? '#dc2626' : '#e5e7eb');
                btn.disabled = true;
            });
            setTimeout(() => { idx++; render(); }, 900);
        };
    };
    render();
}

function startScrabbleGame(container, level) {
    const pool = SCRABBLE_WORDS[level] || SCRABBLE_WORDS.beginner;
    const word = pool[Math.floor(Math.random()*pool.length)];
    const scrambled = word.split('').sort(() => Math.random()-.5).join('');
    container.innerHTML = `
        <div class="sp-card" style="padding:1.5rem;text-align:center;">
            <h3 style="font-weight:800;margin-bottom:.5rem;">🔤 Scrabble Challenge</h3>
            <p style="color:#6b7280;font-size:.8rem;margin-bottom:1rem;">Unscramble the letters to form a word! Level: <strong>${level}</strong></p>
            <div style="display:flex;gap:.5rem;justify-content:center;margin-bottom:1.2rem;flex-wrap:wrap;">
                ${scrambled.split('').map(l => `<div style="width:2.5rem;height:2.5rem;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border-radius:.5rem;display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:900;box-shadow:0 2px 6px rgba(0,0,0,.15);">${l}</div>`).join('')}
            </div>
            <input id="scrabble-input" maxlength="${word.length}" placeholder="Type your answer…" style="border:2px solid #e5e7eb;border-radius:.65rem;padding:.6rem 1rem;font-size:1rem;width:200px;text-align:center;text-transform:uppercase;outline:none;margin-bottom:.75rem;">
            <br>
            <button id="scrabble-check" style="background:#4f46e5;color:#fff;border:none;border-radius:.5rem;padding:.5rem 1.2rem;font-weight:700;cursor:pointer;margin-right:.5rem;">Check ✓</button>
            <button onclick="startScrabbleGame($('game-area'),'${level}')" style="background:#f3f4f6;color:#374151;border:none;border-radius:.5rem;padding:.5rem 1rem;cursor:pointer;font-weight:600;">🔄 New Word</button>
            <div id="scrabble-result" style="margin-top:.75rem;font-size:.9rem;font-weight:700;min-height:1.5rem;"></div>
        </div>`;
    $('scrabble-check')?.addEventListener('click', () => {
        const ans = ($('scrabble-input')?.value || '').trim().toUpperCase();
        const res = $('scrabble-result');
        if (ans === word) {
            if (res) res.innerHTML = '<span style="color:#16a34a;">✅ Correct! Well done!</span>';
            saveScore('scrabble', 1, 1);
        } else {
            if (res) res.innerHTML = `<span style="color:#dc2626;">❌ Not quite. Try again!</span>`;
        }
    });
    $('scrabble-input')?.addEventListener('keypress', e => { if(e.key==='Enter') $('scrabble-check')?.click(); });
}

function startSnakeGame(container, level) {
    const speed = { beginner: 200, intermediate: 150, advanced: 100, expert: 70 }[level] || 150;
    const size = 20, cols = 18, rows = 14;
    container.innerHTML = `
        <div class="sp-card" style="padding:1rem;text-align:center;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
                <h3 style="font-weight:800;margin:0;">🐍 Snake — ${level} (speed: ${1000/speed|0}x)</h3>
                <span id="snake-score" style="font-size:1rem;font-weight:700;color:#4f46e5;">Score: 0</span>
            </div>
            <canvas id="snake-canvas" width="${cols*size}" height="${rows*size}" style="border:2px solid #4f46e5;border-radius:.75rem;background:#0f172a;display:block;margin:0 auto;max-width:100%;cursor:pointer;"></canvas>
            <p style="font-size:.75rem;color:#9ca3af;margin-top:.5rem;">Use arrow keys or swipe to move. Click canvas to start/restart.</p>
        </div>`;

    const canvas = $('snake-canvas');
    const ctx = canvas.getContext('2d');
    let snake = [{x:5,y:7}], dir = {x:1,y:0}, food = null, score = 0, interval = null, running = false;

    const randomFood = () => {
        let f;
        do { f = {x:Math.floor(Math.random()*cols), y:Math.floor(Math.random()*rows)}; }
        while (snake.some(s => s.x===f.x && s.y===f.y));
        return f;
    };

    const draw = () => {
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,canvas.width,canvas.height);
        // Grid dots
        ctx.fillStyle = 'rgba(255,255,255,.04)';
        for(let x=0;x<cols;x++) for(let y=0;y<rows;y++) ctx.fillRect(x*size+size/2-1,y*size+size/2-1,2,2);
        // Food
        if(food) {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(food.x*size+size/2, food.y*size+size/2, size/2-2, 0, Math.PI*2);
            ctx.fill();
        }
        // Snake
        snake.forEach((s,i) => {
            ctx.fillStyle = i===0?'#4ade80':'#22c55e';
            ctx.beginPath();
            ctx.roundRect(s.x*size+1, s.y*size+1, size-2, size-2, 4);
            ctx.fill();
        });
    };

    const gameOver = () => {
        clearInterval(interval); running = false;
        ctx.fillStyle = 'rgba(0,0,0,.7)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#f87171'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 15);
        ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
        ctx.fillText(`Score: ${score}`, canvas.width/2, canvas.height/2+15);
        saveScore('snake', score, score);
    };

    const tick = () => {
        const head = {x:snake[0].x+dir.x, y:snake[0].y+dir.y};
        if(head.x<0||head.x>=cols||head.y<0||head.y>=rows||snake.some(s=>s.x===head.x&&s.y===head.y)){gameOver();return;}
        snake.unshift(head);
        if(food && head.x===food.x && head.y===food.y) {
            score++; $('snake-score').textContent=`Score: ${score}`; food=randomFood();
        } else { snake.pop(); }
        draw();
    };

    const start = () => {
        snake=[{x:5,y:7}]; dir={x:1,y:0}; score=0; food=randomFood(); running=true;
        if($('snake-score')) $('snake-score').textContent='Score: 0';
        clearInterval(interval); interval=setInterval(tick, speed); draw();
    };

    canvas.addEventListener('click', () => { if(!running) start(); });
    document.addEventListener('keydown', e => {
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
        if(e.key==='ArrowUp'&&dir.y!==1) dir={x:0,y:-1};
        if(e.key==='ArrowDown'&&dir.y!==-1) dir={x:0,y:1};
        if(e.key==='ArrowLeft'&&dir.x!==1) dir={x:-1,y:0};
        if(e.key==='ArrowRight'&&dir.x!==-1) dir={x:1,y:0};
    });

    // Touch/swipe
    let touchStart = null;
    canvas.addEventListener('touchstart', e => { touchStart = e.touches[0]; e.preventDefault(); }, {passive:false});
    canvas.addEventListener('touchend', e => {
        if(!touchStart) return;
        const dx = e.changedTouches[0].clientX - touchStart.clientX;
        const dy = e.changedTouches[0].clientY - touchStart.clientY;
        if(Math.abs(dx) > Math.abs(dy)) { if(dx>0&&dir.x!==-1) dir={x:1,y:0}; else if(dx<0&&dir.x!==1) dir={x:-1,y:0}; }
        else { if(dy>0&&dir.y!==-1) dir={x:0,y:1}; else if(dy<0&&dir.y!==1) dir={x:0,y:-1}; }
        touchStart = null;
    });

    draw();
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff'; ctx.font='bold 18px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Click to Start', canvas.width/2, canvas.height/2);
}

async function saveScore(game, score, total) {
    if (!studentData) return;
    try {
        const percentage = total ? Math.round((score/total)*100) : score;
        const snap = await getDocs(query(
            collection(db,'game_leaderboard'),
            where('game','==',game),
            where('studentId','==',studentData.id)
        ));
        if (!snap.empty) {
            const existing = snap.docs[0].data();
            if (percentage > (existing.score || 0)) {
                await updateDoc(doc(db,'game_leaderboard',snap.docs[0].id), {
                    score: percentage, updatedAt: new Date(), grade: studentData.grade||''
                });
            }
        } else {
            await addDoc(collection(db,'game_leaderboard'), {
                game, studentId: studentData.id,
                studentName: studentData.studentName || 'Student',
                score: percentage, grade: studentData.grade || '',
                createdAt: new Date(), updatedAt: new Date()
            });
        }
        // Refresh leaderboard
        loadLeaderboard([game], studentData);
    } catch(e) {}
}

async function loadLeaderboard(games, student) {
    const area = $('leaderboard-area');
    if (!area) return;
    try {
        const results = await Promise.all(games.map(g =>
            getDocs(query(collection(db,'game_leaderboard'), where('game','==',g))).catch(()=>({docs:[]}))
        ));
        area.innerHTML = `
            <h3 style="font-size:1rem;font-weight:800;margin-bottom:.75rem;">🏆 Leaderboards</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.75rem;">
                ${games.map((g,i) => {
                    const docs = results[i].docs || [];
                    const top3 = docs.map(d => d.data()).sort((a,b) => (b.score||0)-(a.score||0)).slice(0,3);
                    const icons = ['🥇','🥈','🥉'];
                    return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:.85rem;padding:.9rem;">
                        <div style="font-weight:700;font-size:.85rem;margin-bottom:.5rem;text-transform:capitalize;">${g === 'ela' ? 'ELA' : g.charAt(0).toUpperCase()+g.slice(1)}</div>
                        ${top3.length===0 ? '<div style="font-size:.75rem;color:#9ca3af;">No scores yet. Be first!</div>'
                            : top3.map((p,j) => `<div style="display:flex;align-items:center;gap:.4rem;padding:.25rem 0;font-size:.8rem;${p.studentId===student.id?'font-weight:700;color:#4f46e5':''}">
                                <span>${icons[j]}</span>
                                <span style="flex:1;">${esc(p.studentName)}</span>
                                <span style="font-weight:700;">${p.score}%</span>
                            </div>`).join('')}
                    </div>`;
                }).join('')}
            </div>`;
    } catch(e) {}
}

/*──────────────────────────────────────────────────────────
  LAYOUT & NAVIGATION
──────────────────────────────────────────────────────────*/
function renderShell(student) {
    document.body.innerHTML = `
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; min-height: 100vh; }
        .sp-topbar { position:fixed;top:0;left:0;right:0;z-index:1000;background:#fff;border-bottom:1px solid #e5e7eb;padding:.6rem 1rem;display:flex;align-items:center;gap:.75rem;box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .sp-nav { position:fixed;bottom:0;left:0;right:0;z-index:1000;background:#fff;border-top:1px solid #e5e7eb;display:flex;box-shadow:0 -1px 4px rgba(0,0,0,.06); }
        .sp-nav-btn { flex:1;display:flex;flex-direction:column;align-items:center;gap:.15rem;padding:.6rem .25rem;border:none;background:none;cursor:pointer;font-size:.6rem;font-weight:600;color:#9ca3af;transition:.15s; }
        .sp-nav-btn.active { color:#4f46e5; }
        .sp-nav-btn .sp-nav-icon { font-size:1.2rem; }
        .sp-main { margin-top:56px;margin-bottom:64px;padding:1rem;max-width:768px;margin-left:auto;margin-right:auto; }
        .sp-card { background:#fff;border:1px solid #e5e7eb;border-radius:1rem;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.05); }
        .sp-card-header { padding:.8rem 1rem;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between; }
        .sp-card-header h3 { font-weight:700;font-size:.95rem; }
        .sp-card-body { padding:1rem; }
        .sp-stat-card { background:#fff;border-radius:1rem;padding:1rem;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,.04); }
        .sp-empty-state { text-align:center;padding:3rem 1rem;color:#9ca3af; }
        .sp-empty-state div { margin-bottom:.5rem; }
        .sp-course-card { background:#fff;border:1px solid #e5e7eb;border-radius:.85rem;overflow:hidden;transition:box-shadow .15s;box-shadow:0 1px 3px rgba(0,0,0,.05); }
        .sp-course-card:hover { box-shadow:0 4px 12px rgba(0,0,0,.1); }
        .spinner { width:24px;height:24px;border:3px solid #e5e7eb;border-top:3px solid #4f46e5;border-radius:50%;animation:spin .7s linear infinite;display:inline-block; }
        @keyframes spin { to{transform:rotate(360deg)} }
        details[open] summary i { transform:rotate(90deg); }
        .space-y-2 > * + * { margin-top:.5rem; }
    </style>

    <!-- TOP BAR -->
    <div class="sp-topbar">
        <div style="width:2.2rem;height:2.2rem;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">
            ${esc((student.studentName||'S').charAt(0))}
        </div>
        <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(student.studentName||'Student')}</div>
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
                <span id="student-location-display" style="font-size:.65rem;color:#9ca3af;"></span>
                <span id="student-clock-time" style="font-size:.7rem;font-weight:600;color:#4f46e5;background:#eff6ff;padding:.1rem .4rem;border-radius:.3rem;font-variant-numeric:tabular-nums;"></span>
            </div>
        </div>
        <div style="position:relative;">
            <button id="bell-btn" style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:.2rem;" title="Notifications">🔔</button>
            <span id="bell-badge" style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:.6rem;font-weight:700;border-radius:50%;width:1.1rem;height:1.1rem;display:none;align-items:center;justify-content:center;"></span>
        </div>
        <button id="logout-btn" style="font-size:.75rem;color:#ef4444;border:1px solid #fee2e2;background:#fff;border-radius:.5rem;padding:.3rem .6rem;cursor:pointer;font-weight:600;">Sign Out</button>
    </div>

    <!-- MAIN CONTENT -->
    <div class="sp-main" id="main-content">
        <div class="text-center py-10"><div class="spinner mx-auto mb-3"></div></div>
    </div>

    <!-- BOTTOM NAV -->
    <nav class="sp-nav">
        <button class="sp-nav-btn active" id="nav-dashboard" onclick="switchTab('dashboard')">
            <span class="sp-nav-icon">🏠</span>Dashboard
        </button>
        <button class="sp-nav-btn" id="nav-messages" onclick="switchTab('messages')">
            <span class="sp-nav-icon">💬</span>Messages
        </button>
        <button class="sp-nav-btn" id="nav-courses" onclick="switchTab('courses')">
            <span class="sp-nav-icon">📚</span>Courses
        </button>
        <button class="sp-nav-btn" id="nav-assignments" onclick="switchTab('assignments')">
            <span class="sp-nav-icon">📝</span>Assignments
        </button>
        <button class="sp-nav-btn" id="nav-results" onclick="switchTab('results')">
            <span class="sp-nav-icon">📊</span>Results
        </button>
        <button class="sp-nav-btn" id="nav-schedule" onclick="switchTab('schedule')">
            <span class="sp-nav-icon">🗓️</span>Schedule
        </button>
        <button class="sp-nav-btn" id="nav-games" onclick="switchTab('games')">
            <span class="sp-nav-icon">🎮</span>Games
        </button>
    </nav>
    `;

    // Events
    $('bell-btn')?.addEventListener('click', showNotificationPanel);
    $('logout-btn')?.addEventListener('click', () => {
        signOut(auth).then(() => { window.location.href = 'studentsignup.html'; });
    });

    // Clock + location
    startStudentClock();
    detectLocation();

    // Notifications
    loadNotifications(student);
}

window.switchTab = function(tab) {
    currentTab = tab;
    document.querySelectorAll('.sp-nav-btn').forEach(btn => btn.classList.remove('active'));
    const navBtn = $(`nav-${tab}`);
    if (navBtn) navBtn.classList.add('active');

    // Fade
    const main = $('main-content');
    if (main) {
        main.style.opacity = '0'; main.style.transform = 'translateY(6px)';
        main.style.transition = 'opacity .2s ease, transform .2s ease';
        setTimeout(() => {
            main.style.opacity = '1'; main.style.transform = 'translateY(0)';
        }, 30);
    }

    // Unsubscribe messages listener if leaving messages tab
    if (tab !== 'messages' && unsubMessages) { unsubMessages(); unsubMessages = null; }

    switch (tab) {
        case 'dashboard':   renderDashboard(studentData); break;
        case 'messages':    renderMessages(studentData); break;
        case 'courses':     renderCourses(studentData); break;
        case 'assignments': renderAssignments(studentData); break;
        case 'results':     renderResults(studentData); break;
        case 'schedule':    renderSchedule(studentData); break;
        case 'games':       renderGames(studentData); break;
    }
};

/*──────────────────────────────────────────────────────────
  AUTH & BOOT
──────────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = 'studentsignup.html'; return; }

        try {
            // Find student by UID
            const q = query(collection(db,'students'), where('studentUid','==',user.uid));
            const snap = await getDocs(q);

            if (snap.empty) {
                document.body.innerHTML = `<div style="text-align:center;padding:3rem;font-family:sans-serif;">
                    <div style="font-size:2rem;margin-bottom:1rem;">⚠️</div>
                    <h2>Student profile not found</h2>
                    <p style="color:#6b7280;margin:1rem 0;">Please contact your tutor or school.</p>
                    <a href="studentsignup.html" style="color:#4f46e5;">← Back to login</a>
                </div>`;
                return;
            }

            const studentDoc = snap.docs[0];
            studentData = { id: studentDoc.id, ...studentDoc.data() };

            // Update last login
            updateDoc(doc(db,'students',studentDoc.id), { lastLogin: serverTimestamp() }).catch(()=>{});

            renderShell(studentData);
            renderDashboard(studentData);

        } catch(e) {
            console.error('Portal boot error:', e);
            document.body.innerHTML = `<div style="text-align:center;padding:3rem;font-family:sans-serif;">
                <div style="font-size:2rem;margin-bottom:1rem;">❌</div>
                <p>Error loading portal: ${esc(e.message)}</p>
                <a href="studentsignup.html">← Back to login</a>
            </div>`;
        }
    });
});
