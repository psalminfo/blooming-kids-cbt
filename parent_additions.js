/**
 * parent_additions.js — BKH Parent Portal Additions
 * ─────────────────────────────────────────────────
 * Adds to the existing parent.js (Firebase v8 compat):
 *  1. Messaging System  (parent ↔ tutor / management / child)
 *  2. Assessment Report Fixes (tutor comments + proper charts)
 *  3. Simplified Academics Tab (notifications only)
 *  4. Add New Student Enrollment Form
 *  5. Updated switchMainTab() with new tabs
 *  6. Read optimisations (suffix cache, batched listeners)
 *
 * Conv-ID scheme: [senderUID, recipientUID].sort().join('_')
 * — identical to tutor.js so messages flow between both portals.
 */

"use strict";

// ============================================================================
// §0 · SAFETY GUARD — wait for Firebase to be ready
// ============================================================================
function whenReady(fn, tries = 0) {
    if (typeof db !== 'undefined' && typeof auth !== 'undefined') {
        fn();
    } else if (tries < 30) {
        setTimeout(() => whenReady(fn, tries + 1), 300);
    } else {
        console.warn('[parent_additions] Firebase not ready after 9 s — aborting');
    }
}

whenReady(function () {
    // ── patch switchMainTab FIRST so new tabs work immediately
    patchSwitchMainTab();

    // ── fix the assessment report renderer
    patchAssessmentReportHTML();

    // ── patch academics to simplify (notifications + topics only)
    patchLoadAcademicsData();

    // ── boot messaging once user is known
    auth.onAuthStateChanged(user => {
        if (user) {
            initParentMessaging(user.uid);
            initEnrollmentTab();
        } else {
            teardownParentMessaging();
        }
    });

    console.log('✅ [parent_additions] loaded');
});

// ============================================================================
// §1 · SWITCH MAIN TAB — extended to support new tabs
// ============================================================================
function patchSwitchMainTab() {
    window.switchMainTab = function (tab) {
        const allAreas = [
            'reportContentArea',
            'academicsContentArea',
            'rewardsContentArea',
            'messagesContentArea',
            'enrollContentArea',
            'settingsContentArea'
        ];
        const allTabs = [
            'reportTab',
            'academicsTab',
            'rewardsTab',
            'messagesTab',
            'enrollTab'
        ];

        allAreas.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        allTabs.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('tab-active-main');
            el.classList.add('tab-inactive-main');
        });

        const map = {
            reports:   { area: 'reportContentArea',   tab: 'reportTab'   },
            academics: { area: 'academicsContentArea', tab: 'academicsTab' },
            rewards:   { area: 'rewardsContentArea',   tab: 'rewardsTab'  },
            messages:  { area: 'messagesContentArea',  tab: 'messagesTab' },
            enroll:    { area: 'enrollContentArea',    tab: 'enrollTab'   }
        };

        const target = map[tab];
        if (target) {
            const area = document.getElementById(target.area);
            const btn  = document.getElementById(target.tab);
            if (area) area.classList.remove('hidden');
            if (btn)  { btn.classList.remove('tab-inactive-main'); btn.classList.add('tab-active-main'); }
        }

        // Load messages on first visit
        if (tab === 'messages') parentLoadConversations();
        // Load enrollment form on first visit
        if (tab === 'enroll')   renderEnrollmentForm();
    };

    // Wire up any existing tab onclick attributes that may conflict
    ['reportTab','academicsTab','rewardsTab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const tabKey = id.replace('Tab','');
            el.onclick = () => window.switchMainTab(tabKey === 'report' ? 'reports' : tabKey === 'academics' ? 'academics' : 'rewards');
        }
    });
}

// ============================================================================
// §2 · ASSESSMENT REPORT FIXES
// ============================================================================
function patchAssessmentReportHTML() {
    // Override the global function defined in parent.js
    window.createAssessmentReportHTML = function (sessionReports, studentIndex, sessionId, fullName, date) {
        const firstReport = sessionReports[0];
        const formattedDate = typeof formatDetailedDate === 'function'
            ? formatDetailedDate(date || new Date(firstReport.timestamp * 1000), true)
            : (date || new Date(firstReport.timestamp * 1000)).toLocaleString();

        // ── Extract tutor name from data
        const tutorName = safeText(
            firstReport.tutorName ||
            firstReport.assessorName ||
            firstReport.tutor ||
            'N/A'
        );

        // ── Extract tutor comments from data (multiple possible field names)
        const tutorComment = safeText(
            firstReport.tutorComment ||
            firstReport.comment ||
            firstReport.tutorRemarks ||
            firstReport.recommendation ||
            firstReport.generalComments ||
            firstReport.tutorFeedback ||
            ''
        );

        // ── Map results; handle both old and new score schemas
        const results = sessionReports.map(testResult => {
            // topics
            const topics = [...new Set(
                (testResult.answers || []).map(a => safeText(a.topic || a.subject || '')).filter(Boolean)
            )];
            // scores: prefer explicit fields then compute from answers
            let correct = testResult.score !== undefined ? Number(testResult.score) : 0;
            let total   = testResult.totalScoreableQuestions !== undefined
                ? Number(testResult.totalScoreableQuestions)
                : testResult.totalQuestions !== undefined
                    ? Number(testResult.totalQuestions)
                    : 0;

            // Fallback: compute from answers array
            if (total === 0 && testResult.answers && testResult.answers.length > 0) {
                const scoreable = testResult.answers.filter(a => a.type !== 'creative-writing');
                total   = scoreable.length;
                correct = scoreable.filter(a => a.isCorrect === true || a.correct === true).length;
            }

            const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

            return {
                subject: safeText(testResult.subject || testResult.testSubject || 'General'),
                correct,
                total,
                pct,
                topics
            };
        });

        // ── Generate recommendation using existing function or inline
        const recommendation = typeof generateTemplatedRecommendation === 'function'
            ? generateTemplatedRecommendation(fullName, tutorName, results)
            : `At Blooming Kids House, we are committed to helping ${fullName} succeed. ` +
              `With personalised guidance from ${tutorName}, we are confident they will excel.`;

        const tableRows = results.map(res => {
            const pct = res.total > 0 ? Math.round((res.correct / res.total) * 100) : 0;
            const barColor = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
            return `
            <tr>
                <td class="border px-3 py-2 font-medium">${res.subject.toUpperCase()}</td>
                <td class="border px-3 py-2 text-center">${res.correct} / ${res.total}</td>
                <td class="border px-3 py-2 text-center font-bold" style="color:${barColor}">${pct}%</td>
            </tr>`;
        }).join('');

        const topicsTableRows = results.map(res => `
            <tr>
                <td class="border px-3 py-2 font-semibold">${res.subject.toUpperCase()}</td>
                <td class="border px-3 py-2">${res.topics.join(', ') || 'N/A'}</td>
            </tr>`).join('');

        const creativeWritingAnswer = firstReport.answers?.find(a => a.type === 'creative-writing');
        const tutorReport = safeText(
            creativeWritingAnswer?.tutorReport ||
            creativeWritingAnswer?.feedback ||
            'Pending review.'
        );

        const chartId = `chart-${studentIndex}-${sessionId}`;

        // Build chart config with percentage scores for readability
        const chartConfig = {
            type: 'bar',
            data: {
                labels: results.map(r => r.subject.toUpperCase()),
                datasets: [
                    {
                        label: 'Correct',
                        data: results.map(r => r.correct),
                        backgroundColor: '#10b981',
                        borderRadius: 4
                    },
                    {
                        label: 'Missed',
                        data: results.map(r => Math.max(0, r.total - r.correct)),
                        backgroundColor: '#fca5a5',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Score Distribution by Subject',
                        font: { size: 14, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function (ctx) {
                                const r = results[ctx.dataIndex];
                                const pct = r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0;
                                return `Score: ${pct}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        };

        return `
        <div class="border rounded-xl shadow-md mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${sessionId}">
            <div class="text-center mb-6 border-b pb-4">
                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg"
                     alt="Blooming Kids House Logo" class="h-16 w-auto mx-auto mb-3">
                <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                <p class="text-gray-600 text-sm">Date: ${formattedDate}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-xl">
                <div class="space-y-1">
                    <p><strong>Student:</strong> ${fullName}</p>
                    <p><strong>Parent Phone:</strong> ${safeText(firstReport.parentPhone || 'N/A')}</p>
                    <p><strong>Grade:</strong> ${safeText(firstReport.grade || 'N/A')}</p>
                </div>
                <div class="space-y-1">
                    <p><strong>Tutor:</strong> ${tutorName}</p>
                    <p><strong>Location:</strong> ${safeText(firstReport.studentCountry || firstReport.location || 'N/A')}</p>
                </div>
            </div>

            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">📊 Performance Summary</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm mb-4 border border-collapse rounded-lg overflow-hidden">
                    <thead class="bg-green-100">
                        <tr>
                            <th class="border px-3 py-2 text-left">Subject</th>
                            <th class="border px-3 py-2 text-center">Score</th>
                            <th class="border px-3 py-2 text-center">Percentage</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>

            ${results.length > 0 && results.some(r => r.total > 0) ? `
            <div class="my-6" style="max-height:280px;">
                <canvas id="${chartId}"></canvas>
            </div>` : ''}

            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">📚 Knowledge & Topics Covered</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-sm mb-4 border border-collapse">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="border px-3 py-2 text-left">Subject</th>
                            <th class="border px-3 py-2 text-left">Topics Covered</th>
                        </tr>
                    </thead>
                    <tbody>${topicsTableRows}</tbody>
                </table>
            </div>

            ${tutorComment ? `
            <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-xl mt-4 mb-4">
                <h3 class="text-base font-bold text-blue-800 mb-1">💬 Tutor's Comment</h3>
                <p class="text-blue-700 leading-relaxed">${tutorComment}</p>
            </div>` : ''}

            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">🌟 Tutor's Recommendation</h3>
            <p class="text-gray-700 leading-relaxed mb-4">${recommendation}</p>

            ${creativeWritingAnswer ? `
            <div class="bg-purple-50 border border-purple-200 p-4 rounded-xl mt-4">
                <h3 class="text-base font-semibold text-purple-800 mb-1">✍️ Creative Writing Feedback</h3>
                <p class="text-gray-700">${tutorReport}</p>
            </div>` : ''}

            <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mt-6">
                <h3 class="text-base font-semibold mb-1 text-green-700">📝 Director's Message</h3>
                <p class="italic text-sm text-gray-700">
                    At Blooming Kids House, we are committed to helping every child succeed.
                    With the dedicated personalised support from our tutors, <strong>${fullName}</strong> will
                    unlock their full potential. Keep up the great work!<br>
                    <strong>— Mrs. Yinka Isikalu, Director</strong>
                </p>
            </div>

            <div class="mt-6 text-center">
                <button onclick="downloadSessionReport(${studentIndex}, '${sessionId}', '${fullName.replace(/'/g,"\\'")
}', 'assessment')"
                        class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    ⬇️ Download Assessment PDF
                </button>
            </div>
        </div>
        <script>
            (function(){
                const _chartId = '${chartId}';
                const _cfg = ${JSON.stringify(chartConfig)};
                function _tryChart(n) {
                    const ctx = document.getElementById(_chartId);
                    if (!ctx) { if(n<8) setTimeout(()=>_tryChart(n+1), 300); return; }
                    if (!window.Chart) { if(n<8) setTimeout(()=>_tryChart(n+1), 400); return; }
                    if (window.charts && window.charts.get(_chartId)) return;
                    const c = new Chart(ctx, _cfg);
                    if (window.charts) window.charts.set(_chartId, c);
                }
                _tryChart(0);
            })();
        <\/script>`;
    };
}

// ============================================================================
// §3 · ACADEMICS TAB — simplified (notifications + homework info only)
// ============================================================================
function patchLoadAcademicsData() {
    window.loadAcademicsData = async function () {
        const container = document.getElementById('academicsContent');
        const dropdown  = document.getElementById('academicsStudentDropdown');
        if (!container) return;

        try {
            const user = auth.currentUser;
            if (!user) return;

            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            if (!userDoc.exists) return;
            const userData   = userDoc.data();
            const parentPhone = userData.normalizedPhone || userData.phone;

            const childrenResult = await comprehensiveFindChildren(parentPhone);
            const { studentNameIdMap, allStudentData } = childrenResult;

            if (!studentNameIdMap || studentNameIdMap.size === 0) {
                container.innerHTML = `
                    <div class="text-center py-12">
                        <div class="text-4xl mb-3">📚</div>
                        <h3 class="text-lg font-bold text-gray-700">No Students Found</h3>
                        <p class="text-gray-500">Academic data will appear once students are registered.</p>
                    </div>`;
                return;
            }

            // Build dropdown
            const studentNames = Array.from(studentNameIdMap.keys());
            if (dropdown) {
                dropdown.innerHTML = `
                    <div class="flex items-center gap-3 mb-4">
                        <label class="font-semibold text-gray-700 text-sm">Viewing for:</label>
                        <select id="academicsStudentSelect" onchange="loadStudentAcademics(this.value)"
                                class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 outline-none">
                            ${studentNames.map(n => `<option value="${n}">${n}</option>`).join('')}
                        </select>
                    </div>`;
            }

            // Load first student
            const firstStudent = studentNames[0];
            const firstId      = studentNameIdMap.get(firstStudent);
            window._parentStudentNameIdMap = studentNameIdMap;
            await window.loadStudentAcademics(firstStudent);

        } catch (err) {
            console.error('[academics] error:', err);
            if (container) container.innerHTML = `<p class="text-red-500 p-4">Error loading academics: ${err.message}</p>`;
        }
    };

    // Per-student loader
    window.loadStudentAcademics = async function (studentName) {
        const container = document.getElementById('academicsContent');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-8">
                <div class="loading-spinner mx-auto" style="width:36px;height:36px;"></div>
                <p class="text-green-600 mt-3 text-sm">Loading for ${studentName}…</p>
            </div>`;

        const nameIdMap = window._parentStudentNameIdMap;
        if (!nameIdMap) return;
        const studentId = nameIdMap.get(studentName);
        if (!studentId) { container.innerHTML = '<p class="text-red-500 p-4">Student not found.</p>'; return; }

        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 14);

            const [topicsSnap, hwSnap] = await Promise.all([
                db.collection('daily_topics').where('studentId', '==', studentId).orderBy('createdAt', 'desc').limit(30).get().catch(() => ({ docs: [] })),
                db.collection('homework_assignments').where('studentId', '==', studentId).orderBy('createdAt', 'desc').limit(20).get().catch(() => ({ docs: [] }))
            ]);

            let topicsHTML = '';
            if (topicsSnap.docs.length > 0) {
                topicsHTML = `
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                        <span>📖</span> Recent Session Topics
                    </h3>
                    <div class="space-y-2">
                        ${topicsSnap.docs.map(d => {
                            const t = d.data();
                            const dateStr = t.createdAt?.toDate?.()?.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric'}) || 'Recent';
                            const subj  = safeText(t.subject || 'General');
                            const topic = safeText(t.topic || t.title || t.description || 'Session completed');
                            const tutor = safeText(t.tutorName || '');
                            return `
                            <div class="flex items-start gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                                <div class="text-green-600 mt-0.5">📌</div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="font-semibold text-green-800 text-sm">${subj}</span>
                                        <span class="text-gray-400 text-xs">•</span>
                                        <span class="text-xs text-gray-500">${dateStr}</span>
                                        ${tutor ? `<span class="text-xs text-gray-400">by ${tutor}</span>` : ''}
                                    </div>
                                    <p class="text-gray-700 text-sm mt-0.5">${topic}</p>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }

            let hwHTML = '';
            if (hwSnap.docs.length > 0) {
                const now = Date.now();
                hwHTML = `
                <div class="mb-6">
                    <h3 class="text-lg font-bold text-green-800 mb-3 flex items-center gap-2">
                        <span>📝</span> Homework Assignments
                    </h3>
                    <div class="space-y-2">
                        ${hwSnap.docs.map(d => {
                            const hw = d.data();
                            const isSubmitted = ['submitted','completed','graded'].includes(hw.status);
                            const isGraded    = hw.status === 'graded';
                            const dueMs = hw.dueTimestamp || (hw.dueDate ? new Date(hw.dueDate).getTime() : null);
                            const isOverdue = !isSubmitted && dueMs && dueMs < now;
                            const dueStr = dueMs ? new Date(dueMs).toLocaleDateString('en-US', { month:'short', day:'numeric'}) : 'No due date';

                            let statusBadge, statusColor;
                            if (isGraded)    { statusBadge = 'Graded ✅';   statusColor = 'bg-green-100 text-green-800'; }
                            else if (isSubmitted) { statusBadge = 'Submitted'; statusColor = 'bg-blue-100 text-blue-800'; }
                            else if (isOverdue)   { statusBadge = 'Overdue ⚠️'; statusColor = 'bg-red-100 text-red-800'; }
                            else                  { statusBadge = 'Pending';   statusColor = 'bg-yellow-100 text-yellow-800'; }

                            const grade = isGraded && hw.grade ? `<span class="font-bold text-green-700"> · Grade: ${hw.grade}%</span>` : '';

                            return `
                            <div class="flex items-start gap-3 p-3 border rounded-lg ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}">
                                <div class="text-lg mt-0.5">📋</div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="font-semibold text-gray-800 text-sm">${safeText(hw.title || hw.subject || 'Assignment')}</span>
                                        <span class="text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}">${statusBadge}</span>
                                        ${grade}
                                    </div>
                                    <div class="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                        <span>📅 Due: ${dueStr}</span>
                                        ${hw.tutorName ? `<span>👤 ${safeText(hw.tutorName)}</span>` : ''}
                                        ${hw.subject ? `<span>📘 ${safeText(hw.subject)}</span>` : ''}
                                    </div>
                                    ${hw.description ? `<p class="text-xs text-gray-600 mt-1 line-clamp-2">${safeText(hw.description)}</p>` : ''}
                                    ${hw.feedback && isGraded ? `
                                        <div class="mt-2 bg-green-50 border border-green-200 rounded p-2">
                                            <p class="text-xs font-semibold text-green-700">Tutor Feedback:</p>
                                            <p class="text-xs text-green-600 mt-0.5">${safeText(hw.feedback)}</p>
                                        </div>` : ''}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }

            const empty = !topicsHTML && !hwHTML;

            container.innerHTML = empty
                ? `<div class="text-center py-12">
                        <div class="text-4xl mb-3">📚</div>
                        <h3 class="text-lg font-bold text-gray-700">${studentName}</h3>
                        <p class="text-gray-500 mt-2">No academic activity found yet. Check back after sessions begin.</p>
                   </div>`
                : `<div class="space-y-2">
                        <div class="flex items-center gap-2 mb-4">
                            <div class="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700">${studentName.charAt(0)}</div>
                            <h3 class="font-bold text-gray-800">${studentName}'s Academic Activity</h3>
                        </div>
                        ${topicsHTML}${hwHTML}
                   </div>`;

        } catch (err) {
            console.error('[academics student] error:', err);
            container.innerHTML = `<p class="text-red-500 p-4">Could not load data: ${err.message}</p>`;
        }
    };
}

// ============================================================================
// §4 · MESSAGING SYSTEM — Parent Portal (Firebase v8 compat)
// ============================================================================

let _msgParentUID          = null;
let _msgParentName         = 'Parent';
let _msgActiveConvId       = null;
let _msgConvListener       = null;  // unsubscribe for conversation list
let _msgChatListener       = null;  // unsubscribe for chat messages
let _msgUnreadListener     = null;  // unsubscribe for unread count

// ── 4.1  Init
function initParentMessaging(uid) {
    _msgParentUID = uid;

    // Fetch parent name for messages
    db.collection('parent_users').doc(uid).get().then(doc => {
        if (doc.exists) _msgParentName = doc.data().parentName || 'Parent';
    }).catch(() => {});

    // Start unread badge listener
    startMsgUnreadListener(uid);
}

function teardownParentMessaging() {
    if (_msgConvListener) { _msgConvListener(); _msgConvListener = null; }
    if (_msgChatListener) { _msgChatListener(); _msgChatListener = null; }
    if (_msgUnreadListener) { _msgUnreadListener(); _msgUnreadListener = null; }
    _msgParentUID    = null;
    _msgActiveConvId = null;
}

// ── 4.2  Unread badge
function startMsgUnreadListener(uid) {
    if (_msgUnreadListener) _msgUnreadListener();

    _msgUnreadListener = db.collection('conversations')
        .where('participants', 'array-contains', uid)
        .onSnapshot(snap => {
            let count = 0;
            snap.forEach(d => {
                const data = d.data();
                if (data.unreadCount > 0 && data.lastSenderId !== uid) count += data.unreadCount;
            });
            const badge = document.getElementById('msgUnreadBadge');
            if (badge) {
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.classList.remove('hidden');
                    badge.style.display = 'flex';
                } else {
                    badge.classList.add('hidden');
                }
            }
        }, () => {});
}

// ── 4.3  Load conversation list
function parentLoadConversations() {
    if (!_msgParentUID) return;
    const listEl = document.getElementById('msgConvListInner');
    if (!listEl) return;

    listEl.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Loading…</div>';

    if (_msgConvListener) _msgConvListener();

    _msgConvListener = db.collection('conversations')
        .where('participants', 'array-contains', _msgParentUID)
        .onSnapshot(snap => {
            const convs = [];
            snap.forEach(d => convs.push({ id: d.id, ...d.data() }));
            convs.sort((a, b) => {
                const tA = a.lastMessageTimestamp?.toDate?.() || new Date(a.lastMessageTimestamp || 0);
                const tB = b.lastMessageTimestamp?.toDate?.() || new Date(b.lastMessageTimestamp || 0);
                return tB - tA;
            });
            renderConvList(convs, listEl);
        }, err => {
            listEl.innerHTML = `<div class="p-3 text-red-500 text-sm">Error: ${err.message}</div>`;
        });
}

function renderConvList(convs, listEl) {
    listEl.innerHTML = '';
    if (!convs.length) {
        listEl.innerHTML = '<div class="p-5 text-center text-gray-400 text-sm">No conversations yet.<br>Tap "New Message" to start.</div>';
        return;
    }

    convs.forEach(conv => {
        const otherId   = (conv.participants || []).find(p => p !== _msgParentUID) || '';
        const otherName = getConvOtherName(conv, otherId);
        const isUnread  = conv.unreadCount > 0 && conv.lastSenderId !== _msgParentUID;
        const lastMsg   = conv.lastMessage || '';
        const lastTime  = msgParentFormatTime(conv.lastMessageTimestamp);
        const isActive  = conv.id === _msgActiveConvId;

        const el = document.createElement('div');
        el.style.cssText = `padding:12px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;display:flex;align-items:center;gap:10px;background:${isActive ? '#ecfdf5' : isUnread ? '#eff6ff' : '#fff'};`;
        el.innerHTML = `
            <div style="width:38px;height:38px;border-radius:50%;background:${isUnread ? '#059669' : '#d1fae5'};color:${isUnread ? '#fff' : '#065f46'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">
                ${msgParentEsc(otherName.charAt(0).toUpperCase())}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:${isUnread ? '700' : '600'};font-size:0.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${msgParentEsc(otherName)}</div>
                <div style="font-size:0.72rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${conv.lastSenderId === _msgParentUID ? 'You: ' : ''}${msgParentEsc(lastMsg.substring(0, 45))}${lastMsg.length > 45 ? '…' : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:0.65rem;color:#9ca3af;">${msgParentEsc(lastTime)}</div>
                ${isUnread ? `<div style="background:#059669;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:0.62rem;font-weight:700;margin-left:auto;margin-top:2px;">${conv.unreadCount > 9 ? '9+' : conv.unreadCount}</div>` : ''}
            </div>`;

        el.onmouseover = () => { if (!isActive) el.style.background = '#f0fdf4'; };
        el.onmouseout  = () => { if (!isActive) el.style.background = isUnread ? '#eff6ff' : '#fff'; };
        el.onclick     = () => parentOpenChat(conv.id, otherName);
        listEl.appendChild(el);
    });
}

function getConvOtherName(conv, otherId) {
    // Try participantDetails first
    const details = conv.participantDetails || {};
    if (details[otherId]?.name) return details[otherId].name;
    // Fallback: if management conv
    if (otherId === 'management' || otherId === 'admin') return '🏢 Management';
    // Fallback: tutorName or studentName
    if (conv.tutorId === otherId && conv.tutorName) return `🧑‍🏫 ${conv.tutorName}`;
    if (conv.studentId === otherId && conv.studentName) return `👦 ${conv.studentName}`;
    return conv.studentName || conv.tutorName || 'Contact';
}

// ── 4.4  Open a chat
function parentOpenChat(convId, name) {
    _msgActiveConvId = convId;

    // Mark as read
    db.collection('conversations').doc(convId).update({ unreadCount: 0 }).catch(() => {});

    const titleEl = document.getElementById('msgChatTitle');
    if (titleEl) titleEl.textContent = name;

    const inputArea = document.getElementById('msgChatInputArea');
    if (inputArea) inputArea.style.display = 'flex';

    const msgArea = document.getElementById('msgChatMessages');
    if (msgArea) msgArea.innerHTML = '<div class="text-center py-4"><div class="loading-spinner mx-auto" style="width:24px;height:24px;"></div></div>';

    if (_msgChatListener) _msgChatListener();

    _msgChatListener = db.collection('conversations').doc(convId).collection('messages')
        .orderBy('createdAt', 'asc')
        .onSnapshot(snap => {
            if (!msgArea) return;
            msgArea.innerHTML = '';
            snap.forEach(d => {
                const msg   = d.data();
                const isMe  = msg.senderId === _msgParentUID;
                const bubble = document.createElement('div');
                bubble.style.cssText = `display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};`;

                const inner = document.createElement('div');
                inner.style.cssText = `max-width:72%;background:${isMe ? '#10b981' : '#fff'};color:${isMe ? '#fff' : '#1f2937'};border:1px solid ${isMe ? 'transparent' : '#e5e7eb'};border-radius:${isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};padding:9px 13px;font-size:0.875rem;word-wrap:break-word;`;

                let html = '';
                if (msg.subject) html += `<div style="font-weight:700;font-size:0.75rem;margin-bottom:4px;opacity:0.85;">${msgParentEsc(msg.subject)}</div>`;
                if (msg.content) html += `<div style="white-space:pre-wrap;">${msgParentEsc(msg.content)}</div>`;
                if (msg.imageUrl) html += `<img src="${msgParentEsc(msg.imageUrl)}" style="max-width:200px;border-radius:8px;margin-top:6px;cursor:pointer;" onclick="window.open('${msgParentEsc(msg.imageUrl)}','_blank')">`;
                html += `<div style="font-size:0.62rem;opacity:0.65;margin-top:4px;text-align:right;">${msgParentEsc(msgParentFormatTime(msg.createdAt))}${msg.isUrgent ? ' 🔴' : ''}</div>`;

                inner.innerHTML = html;
                bubble.appendChild(inner);
                msgArea.appendChild(bubble);
            });
            msgArea.scrollTop = msgArea.scrollHeight;
        }, () => {});

    // Wire send button (replace to avoid duplicate listeners)
    const sendBtn = document.getElementById('msgChatSendBtn');
    if (sendBtn) {
        const newBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newBtn, sendBtn);
        newBtn.onclick = parentSendChatMessage;
    }

    // Enter key
    const input = document.getElementById('msgChatInput');
    if (input) {
        input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); parentSendChatMessage(); } };
    }
}

// ── 4.5  Send a message in active chat
window.parentSendChatMessage = async function () {
    if (!_msgParentUID || !_msgActiveConvId) return;

    const input     = document.getElementById('msgChatInput');
    const imgInput  = document.getElementById('msgChatImageFile');
    const sendBtn   = document.getElementById('msgChatSendBtn');

    const txt      = (input?.value || '').trim();
    const imgFile  = imgInput?.files?.[0] || null;

    if (!txt && !imgFile) return;

    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

    try {
        let imageUrl = null;
        if (imgFile) {
            const fd = new FormData();
            fd.append('file', imgFile);
            fd.append('upload_preset', 'tutor_homework');
            fd.append('cloud_name', 'dwjq7j5zp');
            const res  = await fetch('https://api.cloudinary.com/v1_1/dwjq7j5zp/image/upload', { method:'POST', body: fd });
            const data = await res.json();
            imageUrl   = data.secure_url || null;
            if (imgInput) imgInput.value = '';
        }

        const now     = new Date();
        const lastMsg = imageUrl ? (txt || '📷 Image') : txt;

        await db.collection('conversations').doc(_msgActiveConvId).collection('messages').add({
            content:    txt,
            imageUrl:   imageUrl,
            senderId:   _msgParentUID,
            senderName: _msgParentName,
            senderRole: 'parent',
            createdAt:  now,
            read:       false
        });

        const convRef  = db.collection('conversations').doc(_msgActiveConvId);
        const convSnap = await convRef.get();
        const cur      = convSnap.exists ? (convSnap.data().unreadCount || 0) : 0;

        await convRef.update({
            lastMessage:          lastMsg,
            lastMessageTimestamp: now,
            lastSenderId:         _msgParentUID,
            unreadCount:          cur + 1
        });

        if (input) input.value = '';
    } catch (err) {
        console.error('[msg send]', err);
        if (typeof showMessage === 'function') showMessage('Failed to send message.', 'error');
    } finally {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '➤'; }
    }
};

// ── 4.6  New Message Modal — start a conversation
window.openNewMessageModal = function () {
    document.querySelectorAll('#parentNewMsgModal').forEach(e => e.remove());

    const modal = document.createElement('div');
    modal.id    = 'parentNewMsgModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;width:100%;max-width:520px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#065f46,#10b981);padding:20px 24px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
            <div>
                <p style="color:#fff;font-weight:800;font-size:1.05rem;">✉️ New Message</p>
                <p style="color:rgba(255,255,255,.6);font-size:.75rem;margin-top:2px;">Choose who to contact</p>
            </div>
            <button onclick="document.getElementById('parentNewMsgModal').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:1rem;cursor:pointer;">✕</button>
        </div>
        <!-- Body -->
        <div style="flex:1;overflow-y:auto;padding:20px 22px;display:flex;flex-direction:column;gap:14px;">
            <div>
                <p style="font-size:.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Send To</p>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;" id="nmTypeGrid">
                    ${[
                        { type:'tutor',      icon:'🧑‍🏫', label:'My Child\'s Tutor' },
                        { type:'management', icon:'🏢',   label:'Management' },
                        { type:'child',      icon:'👦',   label:'My Child'  }
                    ].map(t => `
                    <button class="nm-type-btn" data-type="${t.type}" onclick="parentNmSelectType('${t.type}',this)"
                        style="padding:10px 6px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:all .15s;font-size:.78rem;font-weight:600;color:#374151;">
                        <span style="font-size:1.3rem;">${t.icon}</span>
                        <span>${t.label}</span>
                    </button>`).join('')}
                </div>
            </div>
            <div id="nmRecipientArea"></div>
            <div>
                <p style="font-size:.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Subject (optional)</p>
                <input id="nmSubject" type="text" placeholder="e.g. Question about homework" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.875rem;outline:none;box-sizing:border-box;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e2e8f0'">
            </div>
            <div>
                <p style="font-size:.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Message</p>
                <textarea id="nmContent" rows="4" placeholder="Type your message here…" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.875rem;outline:none;resize:vertical;box-sizing:border-box;font-family:inherit;" onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#e2e8f0'"></textarea>
            </div>
            <div id="nmStatus" style="display:none;font-size:.82rem;padding:8px 12px;border-radius:8px;"></div>
        </div>
        <!-- Footer -->
        <div style="padding:14px 22px;border-top:1px solid #f3f4f6;display:flex;gap:10px;">
            <button onclick="document.getElementById('parentNewMsgModal').remove()" style="flex:1;padding:11px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;font-weight:600;cursor:pointer;font-size:.875rem;">Cancel</button>
            <button id="nmSendBtn" onclick="parentNmSend()" style="flex:2;padding:11px;background:linear-gradient(135deg,#065f46,#10b981);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:.9rem;">✈️ Send Message</button>
        </div>
    </div>`;

    document.body.appendChild(modal);
    // Auto-select tutor
    const btn = modal.querySelector('.nm-type-btn[data-type="tutor"]');
    if (btn) parentNmSelectType('tutor', btn);
};

window.parentNmSelectType = async function (type, clickedBtn) {
    document.querySelectorAll('.nm-type-btn').forEach(b => {
        b.style.borderColor = '#e2e8f0';
        b.style.background  = '#fff';
        b.style.color       = '#374151';
    });
    if (clickedBtn) {
        clickedBtn.style.borderColor = '#10b981';
        clickedBtn.style.background  = '#ecfdf5';
        clickedBtn.style.color       = '#065f46';
    }

    const area = document.getElementById('nmRecipientArea');
    if (!area) return;
    area.innerHTML = '<div style="color:#9ca3af;font-size:.82rem;padding:4px 0;">Loading…</div>';

    if (type === 'management') {
        area.innerHTML = `<div style="padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:.85rem;color:#065f46;">
            🏢 Your message will be sent directly to Blooming Kids House management.
        </div>`;
        area.dataset.recipientId   = 'management';
        area.dataset.recipientName = 'Management';
        return;
    }

    if (type === 'child') {
        // Load children's portal accounts
        try {
            if (!_msgParentUID) throw new Error('Not logged in');
            const userDoc = await db.collection('parent_users').doc(_msgParentUID).get();
            const userData = userDoc.data();
            const parentPhone = userData?.normalizedPhone || userData?.phone;
            const childResult = await comprehensiveFindChildren(parentPhone);
            const names = Array.from(childResult.studentNameIdMap.keys());

            if (!names.length) {
                area.innerHTML = '<div style="color:#ef4444;font-size:.82rem;">No children found in your account.</div>';
                return;
            }

            // Try to find student portal UIDs (stored in students collection as studentUid or uid)
            const idMap = childResult.studentNameIdMap;
            area.innerHTML = `
                <div>
                    <p style="font-size:.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Select Child</p>
                    <select id="nmChildSelect" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.875rem;outline:none;box-sizing:border-box;">
                        <option value="">Choose a child…</option>
                        ${names.map(n => `<option value="${msgParentEsc(idMap.get(n))}" data-name="${msgParentEsc(n)}">${msgParentEsc(n)}</option>`).join('')}
                    </select>
                    <p style="font-size:.72rem;color:#9ca3af;margin-top:4px;">Child must have an active student portal account to receive messages.</p>
                </div>`;

            document.getElementById('nmChildSelect').onchange = function () {
                const opt = this.options[this.selectedIndex];
                area.dataset.recipientId   = this.value;  // This is the Firestore doc ID, not portal UID
                area.dataset.recipientName = opt.dataset.name;
            };
        } catch (err) {
            area.innerHTML = `<div style="color:#ef4444;font-size:.82rem;">Error: ${err.message}</div>`;
        }
        return;
    }

    if (type === 'tutor') {
        // Find tutors from student records
        try {
            if (!_msgParentUID) throw new Error('Not logged in');
            const userDoc = await db.collection('parent_users').doc(_msgParentUID).get();
            const userData = userDoc.data();
            const parentPhone = userData?.normalizedPhone || userData?.phone;
            const childResult = await comprehensiveFindChildren(parentPhone);
            const students = childResult.allStudentData;

            const tutorEmailSet = new Set();
            const tutorList = [];

            for (const s of students) {
                const d = s.data;
                const email = d.tutorEmail || d.assignedTutorEmail;
                if (email && !tutorEmailSet.has(email)) {
                    tutorEmailSet.add(email);

                    // Look up tutor doc by email to get their messagingId
                    const tutorSnap = await db.collection('tutors').where('email', '==', email).limit(1).get().catch(() => ({ empty: true }));
                    if (!tutorSnap.empty) {
                        const td = tutorSnap.docs[0];
                        const tData = td.data();
                        const tId = tData.tutorUid || tData.uid || td.id;
                        tutorList.push({
                            id:   tId,
                            name: tData.name || email,
                            email
                        });
                    } else {
                        // Use email hash as fallback ID if no tutor doc
                        tutorList.push({ id: email, name: d.tutorName || email, email });
                    }
                }
            }

            if (!tutorList.length) {
                area.innerHTML = '<div style="color:#f59e0b;font-size:.82rem;padding:8px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;">No assigned tutors found. Please contact management directly.</div>';
                return;
            }

            area.innerHTML = `
                <div>
                    <p style="font-size:.72rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Select Tutor</p>
                    <select id="nmTutorSelect" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.875rem;outline:none;box-sizing:border-box;">
                        <option value="">Choose tutor…</option>
                        ${tutorList.map(t => `<option value="${msgParentEsc(t.id)}" data-name="${msgParentEsc(t.name)}">${msgParentEsc(t.name)}</option>`).join('')}
                    </select>
                </div>`;

            document.getElementById('nmTutorSelect').onchange = function () {
                const opt = this.options[this.selectedIndex];
                area.dataset.recipientId   = this.value;
                area.dataset.recipientName = opt.dataset.name;
            };

            if (tutorList.length === 1) {
                setTimeout(() => {
                    const sel = document.getElementById('nmTutorSelect');
                    if (sel) { sel.selectedIndex = 1; sel.dispatchEvent(new Event('change')); }
                }, 100);
            }
        } catch (err) {
            area.innerHTML = `<div style="color:#ef4444;font-size:.82rem;">Error: ${err.message}</div>`;
        }
    }
};

window.parentNmSend = async function () {
    const area       = document.getElementById('nmRecipientArea');
    const content    = (document.getElementById('nmContent')?.value || '').trim();
    const subject    = (document.getElementById('nmSubject')?.value || '').trim();
    const sendBtn    = document.getElementById('nmSendBtn');
    const statusEl   = document.getElementById('nmStatus');
    const recipId    = area?.dataset?.recipientId;
    const recipName  = area?.dataset?.recipientName || 'Contact';

    if (!content) {
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.background = '#fef2f2';
            statusEl.style.color = '#dc2626';
            statusEl.textContent = '⚠️ Please type a message first.';
        }
        return;
    }
    if (!recipId) {
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.style.background = '#fef2f2';
            statusEl.style.color = '#dc2626';
            statusEl.textContent = '⚠️ Please select a recipient.';
        }
        return;
    }

    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }

    try {
        const now     = new Date();
        const convId  = [_msgParentUID, recipId].sort().join('_');
        const convRef = db.collection('conversations').doc(convId);

        await convRef.set({
            participants: [_msgParentUID, recipId],
            participantDetails: {
                [_msgParentUID]: { name: _msgParentName, role: 'parent' },
                [recipId]:       { name: recipName, role: recipId === 'management' ? 'management' : 'other' }
            },
            lastMessage:          content,
            lastMessageTimestamp: now,
            lastSenderId:         _msgParentUID,
            unreadCount:          1,
            studentName:          recipName
        }, { merge: true });

        await convRef.collection('messages').add({
            content,
            subject: subject || null,
            imageUrl:   null,
            senderId:   _msgParentUID,
            senderName: _msgParentName,
            senderRole: 'parent',
            createdAt:  now,
            read:       false
        });

        document.getElementById('parentNewMsgModal')?.remove();

        // Auto-open the conversation
        if (typeof switchMainTab === 'function') switchMainTab('messages');
        setTimeout(() => parentOpenChat(convId, recipName), 800);

        if (typeof showMessage === 'function') showMessage('Message sent!', 'success');

    } catch (err) {
        console.error('[nm send]', err);
        if (statusEl) {
            statusEl.style.display  = 'block';
            statusEl.style.background = '#fef2f2';
            statusEl.style.color    = '#dc2626';
            statusEl.textContent    = '❌ Failed: ' + err.message;
        }
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '✈️ Send Message'; }
    }
};

// ── Helpers
function msgParentEsc(text) {
    if (!text) return '';
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function msgParentFormatTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now  = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday:'short' });
    return d.toLocaleDateString([], { month:'short', day:'numeric' });
}

// ============================================================================
// §5 · ADD STUDENT (ENROLLMENT) TAB
// ============================================================================

const ENROLL_CONFIG = {
    ACADEMIC_FEES: {
        'preschool':  { twice: 80000, three: 95000, five: 150000 },
        'grade2-4':   { twice: 95000, three: 110000, five: 170000 },
        'grade5-8':   { twice: 105000, three: 120000, five: 180000 },
        'grade9-12':  { twice: 110000, three: 135000, five: 200000 }
    },
    ACADEMIC_SUBJECTS: ['Math','Language Arts','Geography','Science','Biology','Physics','Chemistry','Microbiology'],
    EXTRACURRICULAR: [
        { id:'music',      name:'Kids Music Lesson',       fee:45000 },
        { id:'coding',     name:'Coding Classes for Kids', fee:45000 },
        { id:'chess',      name:'Chess Class',             fee:40000 },
        { id:'foreign',    name:'Foreign Language',        fee:55000 },
        { id:'speaking',   name:'Public Speaking',         fee:35000 },
        { id:'ai',         name:'Generative AI',           fee:40000 },
        { id:'graphics',   name:'Graphics Designing',      fee:35000 },
        { id:'animation',  name:'Stop Motion Animation',   fee:35000 },
        { id:'native',     name:'Native Language',         fee:30000 },
        { id:'youtube',    name:'YouTube for Kids',        fee:40000 },
        { id:'bible',      name:'Bible Study',             fee:35000 }
    ],
    DAYS: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    GRADES: [
        { value:'preschool',  label:'Preschool to Grade 1' },
        { value:'grade2-4',   label:'Grade 2 to 4' },
        { value:'grade5-8',   label:'Grade 5 to 8' },
        { value:'grade9-12',  label:'Grade 9 to 12' }
    ],
    ACTUAL_GRADES: ['Preschool','Kindergarten','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12']
};

let _enrollState = {
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    formRendered: false
};

function initEnrollmentTab() {
    // Pre-load parent data for the form
    if (!auth.currentUser) return;
    db.collection('parent_users').doc(auth.currentUser.uid).get().then(doc => {
        if (doc.exists) {
            const d = doc.data();
            _enrollState.parentName  = d.parentName || '';
            _enrollState.parentEmail = d.email || '';
            _enrollState.parentPhone = d.normalizedPhone || d.phone || '';
        }
    }).catch(() => {});
}

function renderEnrollmentForm() {
    const container = document.getElementById('enrollFormContent');
    if (!container || _enrollState.formRendered) return;
    _enrollState.formRendered = true;

    // Inject form CSS
    if (!document.getElementById('enrollFormCSS')) {
        const style = document.createElement('style');
        style.id = 'enrollFormCSS';
        style.textContent = `
            .enroll-section { margin-bottom: 28px; }
            .enroll-section h4 { font-size:1rem;font-weight:700;color:#065f46;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #d1fae5;display:flex;align-items:center;gap:8px; }
            .enroll-input { width:100%;padding:10px 14px;border:1.5px solid #d1d5db;border-radius:10px;font-size:.9rem;outline:none;box-sizing:border-box;transition:border-color .15s; }
            .enroll-input:focus { border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.1); }
            .enroll-select { background:white;cursor:pointer; }
            .enroll-label { display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:5px; }
            .enroll-required { color:#ef4444; }
            .session-opt { padding:10px 18px;border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;font-weight:600;font-size:.85rem;transition:all .15s;background:#fff;color:#374151; }
            .session-opt.selected { border-color:#10b981;background:#ecfdf5;color:#065f46; }
            .subject-chip { padding:7px 14px;border:1.5px solid #e5e7eb;border-radius:99px;cursor:pointer;font-size:.8rem;font-weight:500;transition:all .15s;background:#fff;color:#374151; }
            .subject-chip.selected { border-color:#10b981;background:#ecfdf5;color:#065f46; }
            .day-btn { padding:7px 14px;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:.78rem;font-weight:600;transition:all .15s;background:#fff;color:#374151; }
            .day-btn.selected { border-color:#10b981;background:#ecfdf5;color:#065f46; }
            .tutor-pref { padding:12px 18px;border:1.5px solid #e5e7eb;border-radius:12px;cursor:pointer;text-align:center;font-size:.85rem;font-weight:600;transition:all .15s;background:#fff;color:#374151; }
            .tutor-pref.selected { border-color:#10b981;background:#ecfdf5;color:#065f46; }
            .extra-card { border:1.5px solid #e5e7eb;border-radius:12px;padding:12px;cursor:pointer;transition:all .15s;background:#fff; }
            .extra-card.selected { border-color:#10b981;background:#ecfdf5; }
            .fee-display { background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-top:16px; }
        `;
        document.head.appendChild(style);
    }

    const today = new Date().toISOString().split('T')[0];
    const grades = ENROLL_CONFIG.GRADES.map(g => `<option value="${g.value}">${g.label}</option>`).join('');
    const actualGrades = ENROLL_CONFIG.ACTUAL_GRADES.map(g => `<option value="${g}">${g}</option>`).join('');
    const subjects = ENROLL_CONFIG.ACADEMIC_SUBJECTS.map(s =>
        `<button type="button" class="subject-chip" data-subject="${s}" onclick="enrollToggleSubject(this)">${s}</button>`
    ).join(' ');
    const days = ENROLL_CONFIG.DAYS.map(d =>
        `<button type="button" class="day-btn" data-day="${d}" onclick="enrollToggleDay(this)">${d.substring(0,3)}</button>`
    ).join(' ');
    const extras = ENROLL_CONFIG.EXTRACURRICULAR.map(e =>
        `<div class="extra-card" data-id="${e.id}" onclick="enrollToggleExtra(this)">
            <div style="font-weight:600;font-size:.85rem;color:#374151;">${e.name}</div>
            <div style="font-size:.75rem;color:#10b981;margin-top:2px;">₦${e.fee.toLocaleString()}/mo</div>
        </div>`
    ).join('');

    container.innerHTML = `
    <div style="max-width:680px;margin:0 auto;">
        <!-- Info Banner -->
        <div class="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span class="text-2xl">ℹ️</span>
            <div>
                <p class="font-semibold text-green-800 text-sm">Your information is pre-filled</p>
                <p class="text-green-700 text-xs mt-1">Submit below and our team will review your request within 24–48 hours. You'll receive a confirmation by email.</p>
            </div>
        </div>

        <!-- Parent Info (pre-filled, read-only) -->
        <div class="enroll-section">
            <h4><span>👤</span> Parent / Guardian Information</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="enroll-label">Parent Name</label>
                    <input id="enrollParentName" class="enroll-input bg-gray-50" value="${escHtml(_enrollState.parentName)}" placeholder="Your full name">
                </div>
                <div>
                    <label class="enroll-label">Email</label>
                    <input id="enrollParentEmail" class="enroll-input bg-gray-50" value="${escHtml(_enrollState.parentEmail)}" placeholder="your@email.com">
                </div>
                <div>
                    <label class="enroll-label">Phone Number</label>
                    <input id="enrollParentPhone" class="enroll-input bg-gray-50" value="${escHtml(_enrollState.parentPhone)}" placeholder="+234...">
                </div>
                <div>
                    <label class="enroll-label">Referral Code (optional)</label>
                    <input id="enrollReferralCode" class="enroll-input" placeholder="e.g. BKHABC123">
                </div>
            </div>
        </div>

        <!-- Student Info -->
        <div class="enroll-section">
            <h4><span>👦</span> Student Information <span class="enroll-required">*</span></h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="enroll-label">Student Full Name <span class="enroll-required">*</span></label>
                    <input id="enrollStudentName" class="enroll-input" placeholder="Student's full name" required>
                </div>
                <div>
                    <label class="enroll-label">Gender <span class="enroll-required">*</span></label>
                    <select id="enrollGender" class="enroll-input enroll-select" required>
                        <option value="">Select gender…</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label class="enroll-label">Date of Birth <span class="enroll-required">*</span></label>
                    <input id="enrollDob" type="date" class="enroll-input" required>
                </div>
                <div>
                    <label class="enroll-label">School Grade Category <span class="enroll-required">*</span></label>
                    <select id="enrollGrade" class="enroll-input enroll-select" required onchange="enrollUpdateFee()">
                        <option value="">Select grade range…</option>
                        ${grades}
                    </select>
                </div>
                <div>
                    <label class="enroll-label">Current Actual Grade <span class="enroll-required">*</span></label>
                    <select id="enrollActualGrade" class="enroll-input enroll-select" required>
                        <option value="">Select grade…</option>
                        ${actualGrades}
                    </select>
                </div>
                <div>
                    <label class="enroll-label">Preferred Start Date <span class="enroll-required">*</span></label>
                    <input id="enrollStartDate" type="date" class="enroll-input" min="${today}" required>
                </div>
            </div>
        </div>

        <!-- Tutor Preference -->
        <div class="enroll-section">
            <h4><span>🧑‍🏫</span> Preferred Tutor</h4>
            <div class="grid grid-cols-3 gap-3">
                <div class="tutor-pref" data-pref="male"          onclick="enrollSelectTutor(this)">👨 Male</div>
                <div class="tutor-pref" data-pref="female"        onclick="enrollSelectTutor(this)">👩 Female</div>
                <div class="tutor-pref selected" data-pref="no-preference" onclick="enrollSelectTutor(this)">🤝 No Preference</div>
            </div>
        </div>

        <!-- Academic Course Selection -->
        <div class="enroll-section">
            <h4><span>📚</span> Academic Subjects</h4>
            <p class="text-xs text-gray-500 mb-3">Select up to 5 subjects (first 2 included in base fee)</p>
            <!-- Sessions per week -->
            <p class="text-sm font-semibold text-gray-700 mb-2">Sessions per week <span class="enroll-required">*</span></p>
            <div class="flex gap-3 mb-4 flex-wrap" id="enrollSessionBtns">
                <button type="button" class="session-opt" data-sessions="twice" onclick="enrollSelectSession(this,'twice')">Twice<br><span class="text-xs font-normal text-gray-500">2×/week</span></button>
                <button type="button" class="session-opt" data-sessions="three" onclick="enrollSelectSession(this,'three')">Three<br><span class="text-xs font-normal text-gray-500">3×/week</span></button>
                <button type="button" class="session-opt" data-sessions="five"  onclick="enrollSelectSession(this,'five')">Daily<br><span class="text-xs font-normal text-gray-500">5×/week</span></button>
            </div>
            <!-- Subjects -->
            <p class="text-sm font-semibold text-gray-700 mb-2">Subjects</p>
            <div class="flex flex-wrap gap-2 mb-4" id="enrollSubjectsArea">${subjects}</div>
            <!-- Days -->
            <p class="text-sm font-semibold text-gray-700 mb-2">Preferred Days</p>
            <div class="flex flex-wrap gap-2 mb-3" id="enrollDaysArea">${days}</div>
            <!-- Time -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="enroll-label">Start Time</label>
                    <select id="enrollStartTime" class="enroll-input enroll-select">
                        <option value="">Select start time…</option>
                        ${Array.from({length:24},(_,h)=>`<option value="${h}:00">${h===0?'12 AM (Midnight)':h<12?h+' AM':h===12?'12 PM (Noon)':(h-12)+' PM'}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="enroll-label">End Time</label>
                    <select id="enrollEndTime" class="enroll-input enroll-select">
                        <option value="">Select end time…</option>
                        ${Array.from({length:24},(_,h)=>`<option value="${h}:00">${h===0?'12 AM':h<12?h+' AM':h===12?'12 PM':(h-12)+' PM'}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>

        <!-- Extracurricular -->
        <div class="enroll-section">
            <h4><span>🎨</span> Extracurricular Activities (optional)</h4>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">${extras}</div>
        </div>

        <!-- Additional Notes -->
        <div class="enroll-section">
            <h4><span>📝</span> Additional Notes</h4>
            <textarea id="enrollNotes" class="enroll-input" rows="3" placeholder="Any special instructions, learning needs, or questions…" style="resize:vertical;"></textarea>
        </div>

        <!-- Fee Estimate -->
        <div class="fee-display" id="enrollFeeDisplay" style="display:none;">
            <div class="flex justify-between items-center">
                <span class="font-semibold text-green-800">Estimated Monthly Fee</span>
                <span id="enrollFeeAmount" class="text-2xl font-bold text-green-700">₦0</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">Exact fee will be confirmed after review. Proration may apply.</p>
        </div>

        <!-- Error Message -->
        <div id="enrollErrorMsg" style="display:none;background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;border-radius:10px;padding:10px 14px;margin-top:12px;font-size:.875rem;"></div>

        <!-- Submit -->
        <div class="flex justify-end mt-6 gap-4">
            <button type="button" onclick="switchMainTab('reports')" class="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all duration-200">
                Cancel
            </button>
            <button type="button" onclick="submitNewStudentEnrollment()" id="enrollSubmitBtn"
                class="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition-all duration-200 flex items-center gap-2">
                <span>🚀</span> Submit Enrollment
            </button>
        </div>
    </div>`;
}

window.enrollToggleSubject = function (btn) {
    btn.classList.toggle('selected');
    enrollUpdateFee();
};
window.enrollToggleDay = function (btn) {
    btn.classList.toggle('selected');
};
window.enrollToggleExtra = function (card) {
    card.classList.toggle('selected');
    enrollUpdateFee();
};
window.enrollSelectSession = function (btn, val) {
    document.querySelectorAll('.session-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    enrollUpdateFee();
};
window.enrollSelectTutor = function (el) {
    document.querySelectorAll('.tutor-pref').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
};
window.enrollUpdateFee = function () {
    const grade   = document.getElementById('enrollGrade')?.value;
    const session = document.querySelector('.session-opt.selected')?.dataset?.sessions;

    let total = 0;
    if (grade && session && ENROLL_CONFIG.ACADEMIC_FEES[grade]) {
        total += ENROLL_CONFIG.ACADEMIC_FEES[grade][session] || 0;

        // Additional subjects (beyond 2)
        const extraSubjects = Math.max(0, document.querySelectorAll('.subject-chip.selected').length - 2);
        total += extraSubjects * 40000;
    }

    // Extracurriculars
    document.querySelectorAll('.extra-card.selected').forEach(c => {
        const id = c.dataset.id;
        const found = ENROLL_CONFIG.EXTRACURRICULAR.find(e => e.id === id);
        if (found) total += found.fee;
    });

    const feeDisplay = document.getElementById('enrollFeeDisplay');
    const feeAmount  = document.getElementById('enrollFeeAmount');
    if (feeDisplay && feeAmount) {
        if (total > 0) {
            feeDisplay.style.display = 'block';
            feeAmount.textContent = '₦' + total.toLocaleString();
        } else {
            feeDisplay.style.display = 'none';
        }
    }
};

window.submitNewStudentEnrollment = async function () {
    const errEl  = document.getElementById('enrollErrorMsg');
    const subBtn = document.getElementById('enrollSubmitBtn');

    // Validation
    const studentName  = document.getElementById('enrollStudentName')?.value.trim();
    const gender       = document.getElementById('enrollGender')?.value;
    const dob          = document.getElementById('enrollDob')?.value;
    const grade        = document.getElementById('enrollGrade')?.value;
    const actualGrade  = document.getElementById('enrollActualGrade')?.value;
    const startDate    = document.getElementById('enrollStartDate')?.value;
    const parentName   = document.getElementById('enrollParentName')?.value.trim();
    const parentEmail  = document.getElementById('enrollParentEmail')?.value.trim();
    const parentPhone  = document.getElementById('enrollParentPhone')?.value.trim();

    const errors = [];
    if (!studentName) errors.push('Student name is required');
    if (!gender)      errors.push('Gender is required');
    if (!dob)         errors.push('Date of birth is required');
    if (!grade)       errors.push('Grade category is required');
    if (!actualGrade) errors.push('Actual grade is required');
    if (!startDate)   errors.push('Preferred start date is required');
    if (!parentName)  errors.push('Parent name is required');

    if (errors.length > 0) {
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = '⚠️ ' + errors.join(' · '); }
        return;
    }
    if (errEl) errEl.style.display = 'none';

    if (subBtn) { subBtn.disabled = true; subBtn.innerHTML = '<div class="loading-spinner-small" style="display:inline-block;margin-right:8px;"></div> Submitting…'; }

    try {
        const session     = document.querySelector('.session-opt.selected')?.dataset?.sessions || '';
        const tutorPref   = document.querySelector('.tutor-pref.selected')?.dataset?.pref || 'no-preference';
        const selectedSubjects = Array.from(document.querySelectorAll('.subject-chip.selected')).map(e => e.dataset.subject);
        const academicDays     = Array.from(document.querySelectorAll('.day-btn.selected')).map(e => e.dataset.day);
        const startTime        = document.getElementById('enrollStartTime')?.value || '';
        const endTime          = document.getElementById('enrollEndTime')?.value || '';
        const extracurriculars = Array.from(document.querySelectorAll('.extra-card.selected')).map(c => {
            const found = ENROLL_CONFIG.EXTRACURRICULAR.find(e => e.id === c.dataset.id);
            return found ? { id: found.id, name: found.name, fee: found.fee } : null;
        }).filter(Boolean);
        const notes            = document.getElementById('enrollNotes')?.value.trim() || '';
        const referralCode     = document.getElementById('enrollReferralCode')?.value.trim() || '';

        const appId = 'BKH-PARENT-' + Date.now() + '-' + Math.random().toString(36).substr(2,5).toUpperCase();

        const enrollmentData = {
            id:                  appId,
            source:              'parent_portal',
            submittedByUid:      auth.currentUser?.uid || '',
            status:              'pending',
            createdAt:           firebase.firestore.FieldValue.serverTimestamp(),
            lastSaved:           new Date().toISOString(),
            parent: {
                name:    parentName,
                email:   parentEmail,
                phone:   parentPhone,
                uid:     auth.currentUser?.uid || ''
            },
            referral: { code: referralCode },
            students: [{
                id:                1,
                name:              studentName,
                gender:            gender,
                dob:               dob,
                grade:             grade,
                actualGrade:       actualGrade,
                startDate:         startDate,
                preferredTutor:    tutorPref,
                academicSessions:  session,
                selectedSubjects:  selectedSubjects,
                academicDays:      academicDays,
                academicTime:      startTime && endTime ? `${startTime}-${endTime}` : '',
                academicSchedule:  academicDays.length > 0 ? `${academicDays.join(', ')} from ${startTime} to ${endTime}` : '',
                extracurriculars:  extracurriculars,
                testPrep:          [],
                notes:             notes
            }],
            summary: {
                totalFee:    0,
                academicFee: ENROLL_CONFIG.ACADEMIC_FEES[grade]?.[session] || 0,
                extracurricularFee: extracurriculars.reduce((sum, e) => sum + e.fee, 0)
            },
            timestamp: new Date().toISOString()
        };

        // Save to Firebase (same collection as enrollment portal)
        await db.collection('enrollments').doc(appId).set(enrollmentData);

        // Also send email notification via Apps Script
        fetch('https://script.google.com/macros/s/AKfycbxKPivWuCyEywMCxgleEoP7MBNxT6ZEvd5WWomDNGYADZmDcBcsO4Eif-JyHSJ5mpXBaw/exec', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'send_enrollment_notification',
                applicationId: appId,
                parent: { name: parentName, email: parentEmail, phone: parentPhone },
                managementEmail: 'psalm4all@gmail.com',
                students: 1,
                totalFee: enrollmentData.summary.academicFee + enrollmentData.summary.extracurricularFee,
                status: 'pending'
            })
        }).catch(() => {});

        // Show success
        const formContent = document.getElementById('enrollFormContent');
        const successScreen = document.getElementById('enrollSuccessScreen');
        const appIdEl = document.getElementById('enrollAppId');

        if (formContent) formContent.classList.add('hidden');
        if (successScreen) successScreen.classList.remove('hidden');
        if (appIdEl) appIdEl.textContent = appId;

    } catch (err) {
        console.error('[enroll submit]', err);
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = '❌ Submission failed: ' + err.message; }
        if (subBtn) { subBtn.disabled = false; subBtn.innerHTML = '<span>🚀</span> Submit Enrollment'; }
    }
};

window.resetEnrollForm = function () {
    const formContent   = document.getElementById('enrollFormContent');
    const successScreen = document.getElementById('enrollSuccessScreen');
    if (formContent)   formContent.classList.remove('hidden');
    if (successScreen) successScreen.classList.add('hidden');
    // Re-render form
    _enrollState.formRendered = false;
    renderEnrollmentForm();
};

// Simple HTML escaper (alias for enrollment form)
function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================================
// §6 · ENSURE switchMainTab WORKS FOR SETTINGS TOO (called from settingsManager)
// ============================================================================
(function () {
    // Wait for settingsManager to exist then patch its openSettingsTab
    const patchSettings = () => {
        if (window.settingsManager) {
            const orig = window.settingsManager.openSettingsTab.bind(window.settingsManager);
            window.settingsManager.openSettingsTab = function () {
                // Use our updated switchMainTab first to de-activate all tabs
                ['reportContentArea','academicsContentArea','rewardsContentArea','messagesContentArea','enrollContentArea'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.classList.add('hidden');
                });
                ['reportTab','academicsTab','rewardsTab','messagesTab','enrollTab'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.classList.remove('tab-active-main'); el.classList.add('tab-inactive-main'); }
                });
                orig();
            };
        } else {
            setTimeout(patchSettings, 500);
        }
    };
    patchSettings();
})();

console.log('📦 [parent_additions] all modules registered');
