// ============================================================
// panels/masterPortal.js
// Master portal — tutor scoring and grading
// ============================================================

import { db } from '../core/firebase.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy,
         Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc,
         limit, startAfter, onSnapshot } from '../core/firebase.js';
import { escapeHtml, capitalize, formatNaira, buildGradeOptions, buildTimeOptions,
         formatTimeTo12h, sanitizeInput, rateLimitCheck,
         safeToString, safeSearch, formatBadgeDate, calculateYearsOfService,
         calculateTransitioningStatus, searchStudentFromFirebase,
         createSearchableSelect, initializeSearchableSelect, createDatePicker,
         logStudentEvent, getLagosDatetime, formatLagosDatetime,
         getCurrentMonthKeyLagos, getCurrentMonthLabelLagos,
         getScoreColor, getScoreBg, getScoreBar,
         getStudentTypeLabel, formatStudentSchedule } from '../core/utils.js';
import { sessionCache, saveToLocalStorage, invalidateCache, switchToTabCached } from '../core/cache.js';
import { logManagementActivity } from '../notifications/activityLog.js';

// SECTION 8.5: MASTER PORTAL — MANAGEMENT CONTROL CENTRE
// ======================================================
// Firestore collections used:
//   tutors              → tutor profiles
//   students            → student records (schedule, type flags)
//   tutor_grades        → { tutorId, tutorEmail, month, qa:{score,notes,gradedBy,gradedByName,gradedAt}, qc:{...}, totalScore }
//   gamification/current_cycle → { winnerId, winnerEmail, winnerName, month, year, totalScore }
// ======================================================

// --- Lagos Time Helper ---

// --- Score Color Helper ---

// --- Student Type Label ---

// --- Schedule Display ---

// --- Main Render Function ---
export async function renderMasterPortalPanel(container) {
    const monthKey = getCurrentMonthKeyLagos();
    const monthLabel = getCurrentMonthLabelLagos();

    container.innerHTML = `
    <div class="space-y-4">
        <!-- Header bar with Lagos clock -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
                <h2 class="text-xl font-bold text-gray-800">🗂 Management Portal</h2>
                <p class="text-sm text-gray-500">Master View — ${monthLabel}</p>
            </div>
            <div class="text-right">
                <div id="lagos-clock" class="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                    Loading time…
                </div>
                <div class="text-xs text-gray-400 mt-0.5">📍 Lagos, Nigeria</div>
            </div>
        </div>

        <!-- Tutor of the Month Banner -->
        <div id="totm-banner" class="hidden bg-gradient-to-r from-yellow-400 to-amber-500 rounded-2xl p-4 text-white shadow flex items-center gap-4">
            <div class="text-4xl">🏆</div>
            <div>
                <div class="font-black text-lg" id="totm-name">Tutor of the Month</div>
                <div class="text-sm opacity-90" id="totm-score"></div>
            </div>
            <div class="ml-auto text-right">
                <div class="text-xs opacity-80">${monthLabel}</div>
        <!-- ── Tab Navigation ───────────────────────────────────── -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-1 flex gap-1">
            <button id="mp-tab-btn-tutors"
                class="flex-1 py-2 px-4 rounded-xl text-sm font-semibold bg-blue-600 text-white transition-colors">
                👥 Tutors
            </button>
            <button id="mp-tab-btn-grading"
                class="flex-1 py-2 px-4 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
                📊 Grading Activity
            </button>
        </div>

        <!-- ── Tutors Panel (existing content) ──────────────────── -->
        <div id="mp-panel-tutors" class="space-y-4">

        <!-- Top 3 Leaderboard -->
        <div id="totm-banner" class="hidden bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="bg-gradient-to-r from-yellow-400 to-amber-500 px-5 py-3 flex items-center justify-between">
                <span class="font-black text-white text-sm tracking-wide uppercase">🏆 Leaderboard — ${monthLabel}</span>
            </div>
            <div class="grid grid-cols-3 divide-x divide-gray-100 p-2 gap-1">
                <!-- 1st place -->
                <div id="rank-1" class="flex flex-col items-center p-3 bg-yellow-50 rounded-xl">
                    <div class="text-2xl mb-1">🥇</div>
                    <div id="rank-1-name" class="font-black text-gray-800 text-sm text-center leading-tight"></div>
                    <div id="rank-1-score" class="text-2xl font-black text-yellow-600 mt-1"></div>
                    <div class="text-xs text-gray-400">1st place</div>
                </div>
                <!-- 2nd place -->
                <div id="rank-2" class="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
                    <div class="text-2xl mb-1">🥈</div>
                    <div id="rank-2-name" class="font-black text-gray-800 text-sm text-center leading-tight"></div>
                    <div id="rank-2-score" class="text-2xl font-black text-gray-500 mt-1"></div>
                    <div class="text-xs text-gray-400">2nd place</div>
                </div>
                <!-- 3rd place -->
                <div id="rank-3" class="flex flex-col items-center p-3 bg-orange-50 rounded-xl">
                    <div class="text-2xl mb-1">🥉</div>
                    <div id="rank-3-name" class="font-black text-gray-800 text-sm text-center leading-tight"></div>
                    <div id="rank-3-score" class="text-2xl font-black text-orange-500 mt-1"></div>
                    <div class="text-xs text-gray-400">3rd place</div>
                </div>
            </div>
        </div>

        <!-- Bottom 5 Card (collapsible) -->
        <div id="bottom5-banner" class="hidden bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <button id="bottom5-toggle" class="w-full flex items-center justify-between px-5 py-3 bg-red-50 hover:bg-red-100 transition-colors">
                <span class="font-bold text-red-700 text-sm tracking-wide uppercase">⚠️ Needs Improvement — Bottom 5</span>
                <i id="bottom5-arrow" class="fas fa-chevron-down text-red-400 transition-transform"></i>
            </button>
            <div id="bottom5-body" class="hidden">
                <div id="bottom5-list" class="divide-y divide-red-50"></div>
            </div>
        </div>

        <!-- Tutor Search Bar -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="fas fa-search text-gray-400"></i>
                </div>
                <input type="text" id="master-portal-tutor-search" 
                    placeholder="Search tutors by name..." 
                    class="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    autocomplete="off">
                <button id="master-portal-search-clear" class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 hidden">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="master-portal-search-count" class="text-xs text-gray-400 mt-1.5 hidden"></div>
        </div>

        <!-- Loading indicator -->
        <div id="master-portal-loading" class="text-center py-12">
            <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-gray-500">Loading tutor data…</p>
        </div>

        <!-- Tutors accordion list -->
        <div id="master-portal-list" class="space-y-3 hidden"></div>

        </div><!-- /mp-panel-tutors -->

        <!-- ── Grading Activity Panel (new) ─────────────────────── -->
        <div id="mp-panel-grading" class="hidden space-y-4">
            <div class="text-center py-12">
                <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="text-gray-500">Loading grading activity…</p>
            </div>
        </div>

    </div>
    `;

    // Start Lagos clock
    const clockEl = document.getElementById('lagos-clock');
    function tickClock() { if (clockEl) clockEl.textContent = formatLagosDatetime(); }
    tickClock();
    const clockInterval = setInterval(tickClock, 1000);
    // Cleanup on tab change
    window._masterPortalClockInterval = clockInterval;

    // ── Tab switching logic ─────────────────────────────────────────
    const _mpPanelTutors  = document.getElementById('mp-panel-tutors');
    const _mpPanelGrading = document.getElementById('mp-panel-grading');
    const _mpBtnTutors    = document.getElementById('mp-tab-btn-tutors');
    const _mpBtnGrading   = document.getElementById('mp-tab-btn-grading');
    let   _gradingTabLoaded = false;

    function _mpActivateTab(tab) {
        const isTutors = tab === 'tutors';
        _mpPanelTutors.classList.toggle('hidden', !isTutors);
        _mpPanelGrading.classList.toggle('hidden', isTutors);
        _mpBtnTutors.classList.toggle('bg-blue-600',  isTutors);
        _mpBtnTutors.classList.toggle('text-white',   isTutors);
        _mpBtnTutors.classList.toggle('text-gray-600',!isTutors);
        _mpBtnGrading.classList.toggle('bg-blue-600',  !isTutors);
        _mpBtnGrading.classList.toggle('text-white',   !isTutors);
        _mpBtnGrading.classList.toggle('text-gray-600', isTutors);
        if (!isTutors && !_gradingTabLoaded) {
            _gradingTabLoaded = true;
            renderGradingActivityTab(_mpPanelGrading);
        }
    }
    _mpBtnTutors.addEventListener('click',  () => _mpActivateTab('tutors'));
    _mpBtnGrading.addEventListener('click', () => _mpActivateTab('grading'));

    try {
        // Load all data in parallel
        const [tutorsSnap, studentsSnap, gradesSnap, cycleSnap] = await Promise.all([
            getDocs(query(collection(db, 'tutors'), orderBy('name'))),
            getDocs(collection(db, 'students')),
            getDocs(query(collection(db, 'tutor_grades'), where('month', '==', monthKey))),
            getDoc(doc(db, 'gamification', 'current_cycle'))
        ]);

        const tutors = tutorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const grades = {};
        gradesSnap.docs.forEach(d => { grades[d.data().tutorId || d.data().tutorEmail] = { id: d.id, ...d.data() }; });

        // Build student map by tutor email
        const studentsByTutor = {};
        students.forEach(s => {
            const key = s.tutorEmail || '';
            if (!studentsByTutor[key]) studentsByTutor[key] = [];
            studentsByTutor[key].push(s);
        });

        // Determine leading tutor
        let leadingTutor = null, leadingScore = -1;
        tutors.forEach(t => {
            const g = grades[t.id] || grades[t.email] || {};
            const qaScore = g.qa?.score ?? 0;
            const qcScore = g.qc?.score ?? 0;
            const total = Math.round((qaScore + qcScore) / 2);
            if (total > leadingScore) { leadingScore = total; leadingTutor = { ...t, total }; }
        });

        // Handle tutor of month banner
        const totmBanner = document.getElementById('totm-banner');
        if (leadingTutor && leadingScore > 0) {
            document.getElementById('totm-name').textContent = `👑 ${leadingTutor.name}`;
            document.getElementById('totm-score').textContent = `Leading score: ${leadingScore}% this month`;
            totmBanner.classList.remove('hidden');
        }

        // Rank all tutors who have at least one score
        const rankedTutors = tutors
            .map(t => {
                const g = grades[t.id] || grades[t.email] || {};
                const qa = g.qa?.score ?? null;
                const qc = g.qc?.score ?? null;
                const total = (qa !== null && qc !== null)
                    ? Math.round((qa + qc) / 2)
                    : (qa !== null ? qa : (qc !== null ? qc : null));
                return { ...t, total };
            })
            .filter(t => t.total !== null)
            .sort((a, b) => b.total - a.total);

        const leadingTutor = rankedTutors[0] || null;
        const leadingScore = leadingTutor?.total ?? -1;
        const top3 = rankedTutors.slice(0, 3);
        const bottom5 = rankedTutors.length > 3 ? rankedTutors.slice(-5).reverse() : [];

        // Populate Top 3 podium
        const totmBanner = document.getElementById('totm-banner');
        if (top3.length > 0) {
            const medals = ['rank-1', 'rank-2', 'rank-3'];
            top3.forEach((t, i) => {
                const nameEl = document.getElementById(`${medals[i]}-name`);
                const scoreEl = document.getElementById(`${medals[i]}-score`);
                if (nameEl) nameEl.textContent = t.name;
                if (scoreEl) scoreEl.textContent = `${t.total}%`;
                // Hide unused slots
                const slotEl = document.getElementById(medals[i]);
                if (slotEl) slotEl.classList.remove('hidden');
            });
            // Hide slots with no data
            for (let i = top3.length; i < 3; i++) {
                const slotEl = document.getElementById(medals[i]);
                if (slotEl) slotEl.classList.add('hidden');
            }
            totmBanner.classList.remove('hidden');
        }

        // Populate Bottom 5
        const bottom5Banner = document.getElementById('bottom5-banner');
        const bottom5List = document.getElementById('bottom5-list');
        if (bottom5.length > 0 && bottom5List) {
            bottom5List.innerHTML = bottom5.map((t, i) => `
                <div class="flex items-center justify-between px-5 py-2.5 hover:bg-red-50 transition-colors">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold text-red-300 w-4">${rankedTutors.length - i}</span>
                        <span class="text-sm font-semibold text-gray-700">${escapeHtml(t.name)}</span>
                    </div>
                    <span class="text-sm font-black text-red-500">${t.total}%</span>
                </div>
            `).join('');
            bottom5Banner.classList.remove('hidden');

            // Toggle collapse
            document.getElementById('bottom5-toggle').addEventListener('click', () => {
                const body = document.getElementById('bottom5-body');
                const arrow = document.getElementById('bottom5-arrow');
                const isOpen = !body.classList.contains('hidden');
                body.classList.toggle('hidden', isOpen);
                arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
        }

        // Render accordion list
        const listEl = document.getElementById('master-portal-list');
        const currentStaff = window.userData;

        tutors.forEach((tutor, idx) => {
            const tutorStudents = studentsByTutor[tutor.email] || [];
            const activeStudents = tutorStudents.filter(s => !s.summerBreak && !['archived','graduated','transferred'].includes(s.status));
            const g = grades[tutor.id] || grades[tutor.email] || {};
            const qaScore = g.qa?.score ?? null;
            const qcScore = g.qc?.score ?? null;
            const totalScore = (qaScore !== null && qcScore !== null)
                ? Math.round((qaScore + qcScore) / 2)
                : (qaScore !== null ? qaScore : (qcScore !== null ? qcScore : null));
            const scoreDisplay = totalScore !== null ? totalScore : '—';
            const colorClass = totalScore !== null ? getScoreColor(totalScore) : 'text-gray-400';
            const bgClass = totalScore !== null ? getScoreBg(totalScore) : 'bg-gray-50 border-gray-200';

            // Check if current user already graded this tutor
            const canQA = currentStaff?.permissions?.tabs?.canQA;
            const canQC = currentStaff?.permissions?.tabs?.canQC;
            const alreadyQA = g.qa?.gradedBy === currentStaff?.email;
            const alreadyQC = g.qc?.gradedBy === currentStaff?.email;

            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden';
            card.innerHTML = `
            <!-- Accordion Header -->
            <button class="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors accordion-header" data-idx="${idx}">
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-gray-800">${escapeHtml(tutor.name)}</span>
                        ${leadingTutor && tutor.id === leadingTutor.id ? '<span class="text-yellow-500">👑</span>' : ''}
                        <span class="text-xs text-gray-400">${activeStudents.length} active student${activeStudents.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="text-xs text-gray-400 truncate">${escapeHtml(tutor.email || '')}</div>
                </div>
                <!-- Combined score pill -->
                <div class="flex-shrink-0 text-center px-3 py-2 rounded-xl border ${bgClass}">
                    <div class="text-2xl font-black ${colorClass}">${scoreDisplay}${totalScore !== null ? '<span class="text-sm">%</span>' : ''}</div>
                    <div class="text-xs text-gray-500">Combined</div>
                </div>
                <i class="fas fa-chevron-down text-gray-400 transition-transform flex-shrink-0 accordion-arrow"></i>
            </button>

            <!-- Accordion Body -->
            <div class="accordion-body hidden border-t border-gray-100">
                <!-- Mini score breakdown -->
                <div class="p-4 grid grid-cols-2 gap-3 bg-gray-50">
                    <!-- QA Score -->
                    <div class="bg-white rounded-xl border border-purple-100 p-3">
                        <div class="flex justify-between items-start mb-1">
                            <div class="text-xs font-bold text-purple-600 uppercase tracking-wide">QA – Session Obs.</div>
                            ${g.qa?.gradedByName ? `<span class="text-xs text-gray-400">by ${escapeHtml(g.qa.gradedByName)}</span>` : ''}
                        </div>
                        ${qaScore !== null ? `
                            <div class="text-3xl font-black ${getScoreColor(qaScore)}">${qaScore}<span class="text-sm">%</span></div>
                            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                <div class="${getScoreBar(qaScore)} h-1.5 rounded-full" style="width:${qaScore}%"></div>
                            </div>
                            ${g.qa?.notes ? `<div class="mt-2 text-xs text-gray-600 bg-purple-50 rounded p-1.5 italic">"${escapeHtml(g.qa.notes)}"</div>` : ''}
                        ` : `<div class="text-gray-400 text-sm mt-1">Not graded</div>`}
                        ${canQA && !alreadyQA ? `
                            <button class="open-qa-btn mt-2 w-full bg-purple-600 text-white text-xs rounded-lg py-1.5 hover:bg-purple-700" data-tutor-id="${tutor.id}" data-tutor-name="${escapeHtml(tutor.name)}" data-tutor-email="${escapeHtml(tutor.email)}" data-grade-id="${g.id || ''}">
                                ${qaScore !== null ? '✏️ View QA' : '📋 Grade QA'}
                            </button>
                        ` : canQA && alreadyQA ? `
                            <div class="mt-2 text-xs text-green-600 font-semibold text-center">✅ You graded QA this month</div>
                            <button class="open-qa-btn mt-1 w-full bg-purple-100 text-purple-700 text-xs rounded-lg py-1.5 hover:bg-purple-200" data-tutor-id="${tutor.id}" data-tutor-name="${escapeHtml(tutor.name)}" data-tutor-email="${escapeHtml(tutor.email)}" data-grade-id="${g.id || ''}" data-readonly="true">
                                👁 View My QA Grade
                            </button>
                        ` : ''}
                    </div>

                    <!-- QC Score -->
                    <div class="bg-white rounded-xl border border-amber-100 p-3">
                        <div class="flex justify-between items-start mb-1">
                            <div class="text-xs font-bold text-amber-600 uppercase tracking-wide">QC – Lesson Plan</div>
                            ${g.qc?.gradedByName ? `<span class="text-xs text-gray-400">by ${escapeHtml(g.qc.gradedByName)}</span>` : ''}
                        </div>
                        ${qcScore !== null ? `
                            <div class="text-3xl font-black ${getScoreColor(qcScore)}">${qcScore}<span class="text-sm">%</span></div>
                            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                <div class="${getScoreBar(qcScore)} h-1.5 rounded-full" style="width:${qcScore}%"></div>
                            </div>
                            ${g.qc?.notes ? `<div class="mt-2 text-xs text-gray-600 bg-amber-50 rounded p-1.5 italic">"${escapeHtml(g.qc.notes)}"</div>` : ''}
                        ` : `<div class="text-gray-400 text-sm mt-1">Not graded</div>`}
                        ${canQC && !alreadyQC ? `
                            <button class="open-qc-btn mt-2 w-full bg-amber-600 text-white text-xs rounded-lg py-1.5 hover:bg-amber-700" data-tutor-id="${tutor.id}" data-tutor-name="${escapeHtml(tutor.name)}" data-tutor-email="${escapeHtml(tutor.email)}" data-grade-id="${g.id || ''}">
                                ${qcScore !== null ? '✏️ View QC' : '📋 Grade QC'}
                            </button>
                        ` : canQC && alreadyQC ? `
                            <div class="mt-2 text-xs text-green-600 font-semibold text-center">✅ You graded QC this month</div>
                            <button class="open-qc-btn mt-1 w-full bg-amber-100 text-amber-700 text-xs rounded-lg py-1.5 hover:bg-amber-200" data-tutor-id="${tutor.id}" data-tutor-name="${escapeHtml(tutor.name)}" data-tutor-email="${escapeHtml(tutor.email)}" data-grade-id="${g.id || ''}" data-readonly="true">
                                👁 View My QC Grade
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Students table -->
                ${activeStudents.length > 0 ? `
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                                <th class="text-left py-2 px-4">Student</th>
                                <th class="text-left py-2 px-4">Grade</th>
                                <th class="text-left py-2 px-4">Type</th>
                                <th class="text-left py-2 px-4">Schedule</th>
                                <th class="text-left py-2 px-4">Subjects</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeStudents.map(s => `
                            <tr class="border-b border-gray-50 hover:bg-gray-50">
                                <td class="py-2 px-4 font-medium text-gray-800">${escapeHtml(s.studentName || '')}<div class="text-xs text-gray-400">${escapeHtml(s.parentName || '')}</div></td>
                                <td class="py-2 px-4 text-gray-600">${escapeHtml(s.grade || '—')}</td>
                                <td class="py-2 px-4">${getStudentTypeLabel(s)}</td>
                                <td class="py-2 px-4">${formatStudentSchedule(s)}</td>
                                <td class="py-2 px-4 text-xs text-gray-500">${escapeHtml((s.subjects || []).join(', ') || '—')}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : `<div class="p-4 text-center text-gray-400 text-sm">No active students this month.</div>`}
            </div>
            `;

            listEl.appendChild(card);
        });

        // Accordion toggle behaviour
        listEl.querySelectorAll('.accordion-header').forEach(btn => {
            btn.addEventListener('click', () => {
                const body = btn.nextElementSibling;
                const arrow = btn.querySelector('.accordion-arrow');
                const isOpen = !body.classList.contains('hidden');
                body.classList.toggle('hidden', isOpen);
                arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
        });

        // QA grade buttons
        listEl.querySelectorAll('.open-qa-btn').forEach(btn => {
            btn.addEventListener('click', () => openGradeModal('qa', btn.dataset, grades, monthKey));
        });

        // QC grade buttons
        listEl.querySelectorAll('.open-qc-btn').forEach(btn => {
            btn.addEventListener('click', () => openGradeModal('qc', btn.dataset, grades, monthKey));
        });

        document.getElementById('master-portal-loading').classList.add('hidden');
        listEl.classList.remove('hidden');

        // --- Tutor Search Functionality ---
        const searchInput = document.getElementById('master-portal-tutor-search');
        const searchClear = document.getElementById('master-portal-search-clear');
        const searchCount = document.getElementById('master-portal-search-count');
        const tutorCards = listEl.querySelectorAll(':scope > div');
        const totalTutors = tutorCards.length;

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const term = searchInput.value.toLowerCase().trim();
                if (searchClear) searchClear.classList.toggle('hidden', !term);
                let visibleCount = 0;
                tutorCards.forEach(card => {
                    const header = card.querySelector('.accordion-header');
                    const nameEl = header ? header.querySelector('.font-bold.text-gray-800') : null;
                    const tutorName = nameEl ? nameEl.textContent.toLowerCase() : '';
                    if (!term || tutorName.includes(term)) { card.style.display = ''; visibleCount++; }
                    else { card.style.display = 'none'; }
                });
                if (searchCount) {
                    if (term) { searchCount.textContent = `Showing ${visibleCount} of ${totalTutors} tutors`; searchCount.classList.remove('hidden'); }
                    else { searchCount.classList.add('hidden'); }
                }
            });
            if (searchClear) {
                searchClear.addEventListener('click', () => { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); searchInput.focus(); });
            }
        }

        // After render, update gamification winner in Firestore if needed
        if (leadingTutor && leadingScore > 0) {
            updateTutorOfMonthIfNeeded(leadingTutor, leadingScore, monthKey, getCurrentMonthLabelLagos());
        }

    } catch (err) {
        console.error('Master Portal error:', err);
        document.getElementById('master-portal-loading').innerHTML =
            `<p class="text-red-500">❌ Failed to load: ${err.message}</p>`;
    }
}


// ============================================================
// GRADING ACTIVITY TAB
// Shows this week's QA and QC grading, one table per grader.
// "This week" = Monday–Sunday in Lagos time.
// If Monday falls in a previous month, the window starts on the
// 1st of the current month instead (monthly reset).
// ============================================================

/**
 * Returns { weekStart, weekEnd, label } for the current Lagos week,
 * capped to the start of the current month.
 */
function getLagosWeekRange() {
    // Current date/time in Lagos
    const lagosNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));

    const year  = lagosNow.getFullYear();
    const month = lagosNow.getMonth();      // 0-based
    const day   = lagosNow.getDate();
    const dow   = lagosNow.getDay();        // 0=Sun … 6=Sat

    // Days since Monday (Mon=0)
    const sinceMonday = dow === 0 ? 6 : dow - 1;

    // Monday 00:00 Lagos
    const monday = new Date(year, month, day - sinceMonday, 0, 0, 0, 0);
    // Sunday 23:59:59 Lagos
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
    // First day of current month 00:00 Lagos
    const monthStart = new Date(year, month, 1, 0, 0, 0, 0);

    // Cap week start to month start so we never show last month's grades
    const weekStart = monday < monthStart ? monthStart : monday;

    // Build a readable label e.g. "Mon 2 Jun – Sun 8 Jun 2025"
    const fmt = (d) => d.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        timeZone: 'Africa/Lagos'
    });
    const yearLabel = sunday.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'Africa/Lagos' });
    const label = `${fmt(weekStart)} – ${fmt(sunday)} ${yearLabel}`;

    return { weekStart, weekEnd: sunday, label, isCappedToMonth: monday < monthStart };
}

/**
 * Converts a Firestore Timestamp or JS Date to a plain JS Date.
 */
function toDate(val) {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'string' || typeof val === 'number') return new Date(val);
    return null;
}

/**
 * Render the Grading Activity tab into the given container element.
 * Fetches all tutor_grades for the current month, filters to this week,
 * groups by grader, and renders one table per grader for QA and QC.
 */
export async function renderGradingActivityTab(container) {
    const monthKey   = getCurrentMonthKeyLagos();
    const monthLabel = getCurrentMonthLabelLagos();
    const { weekStart, weekEnd, label: weekLabel, isCappedToMonth } = getLagosWeekRange();

    container.innerHTML = `
    <div class="space-y-4">
        <!-- Week header -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h3 class="text-base font-bold text-gray-800">📊 Grading Activity</h3>
                    <p class="text-sm text-gray-500 mt-0.5">
                        <span class="font-semibold text-blue-700">${weekLabel}</span>
                        ${isCappedToMonth
                            ? '<span class="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">New month — week reset</span>'
                            : ''}
                    </p>
                </div>
                <div class="text-xs text-gray-400 text-right">
                    Month: <span class="font-semibold text-gray-600">${monthLabel}</span><br>
                    Resets each new month
                </div>
            </div>
        </div>

        <!-- Content -->
        <div id="grading-activity-content">
            <div class="text-center py-12">
                <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="text-gray-500">Fetching grades…</p>
            </div>
        </div>
    </div>`;

    const contentEl = container.querySelector('#grading-activity-content');

    try {
        // Fetch all grades for this month + tutor names
        const [gradesSnap, tutorsSnap] = await Promise.all([
            getDocs(query(collection(db, 'tutor_grades'), where('month', '==', monthKey))),
            getDocs(query(collection(db, 'tutors'), orderBy('name')))
        ]);

        // Build tutorId → name map for display
        const tutorNameById = {};
        tutorsSnap.docs.forEach(d => { tutorNameById[d.id] = d.data().name || d.data().email || d.id; });

        // Group entries by grader for QA and QC separately
        const qaByGrader = {};
        const qcByGrader = {};

        gradesSnap.docs.forEach(d => {
            const g = d.data();
            const tutorName = tutorNameById[g.tutorId] || g.tutorEmail || g.tutorId || '—';

            // ── QA ──
            if (g.qa && g.qa.gradedBy) {
                const gradedAt = toDate(g.qa.gradedAt);
                if (gradedAt && gradedAt >= weekStart && gradedAt <= weekEnd) {
                    const grader = g.qa.gradedByName || g.qa.gradedBy;
                    if (!qaByGrader[grader]) qaByGrader[grader] = [];
                    qaByGrader[grader].push({
                        tutorName,
                        tutorEmail: g.tutorEmail || '',
                        score:    g.qa.score ?? '—',
                        notes:    g.qa.notes || '',
                        gradedAt
                    });
                }
            }

            // ── QC ──
            if (g.qc && g.qc.gradedBy) {
                const gradedAt = toDate(g.qc.gradedAt);
                if (gradedAt && gradedAt >= weekStart && gradedAt <= weekEnd) {
                    const grader = g.qc.gradedByName || g.qc.gradedBy;
                    if (!qcByGrader[grader]) qcByGrader[grader] = [];
                    qcByGrader[grader].push({
                        tutorName,
                        tutorEmail: g.tutorEmail || '',
                        score:    g.qc.score ?? '—',
                        notes:    g.qc.notes || '',
                        gradedAt
                    });
                }
            }
        });

        const hasQA = Object.keys(qaByGrader).length > 0;
        const hasQC = Object.keys(qcByGrader).length > 0;

        if (!hasQA && !hasQC) {
            contentEl.innerHTML = `
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
                <div class="text-4xl mb-3">📭</div>
                <p class="text-gray-500 font-semibold">No grades recorded this week yet.</p>
                <p class="text-xs text-gray-400 mt-1">Grades will appear here as staff grade tutors.</p>
            </div>`;
            return;
        }

        // ── Build the accordion cards ────────────────────────────────
        // One card per grader per type. Clicking the header expands the table inline.

        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-4';

        // Section divider helper
        function appendDivider(parent, label, color) {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-3';
            div.innerHTML = `
                <div class="h-px flex-1 bg-${color}-100"></div>
                <span class="text-xs font-bold text-${color}-500 uppercase tracking-widest px-2">${label}</span>
                <div class="h-px flex-1 bg-${color}-100"></div>`;
            parent.appendChild(div);
        }

        // Build one accordion card per grader
        function appendGraderCard(parent, graderName, entries, typeColor, typeLabel, typeBadge) {
            const sorted = [...entries].sort((a, b) => b.gradedAt - a.gradedAt);

            // Average score for the header summary
            const scores = sorted.map(e => e.score).filter(s => typeof s === 'number');
            const avgScore = scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : null;
            const avgColor = avgScore !== null ? getScoreColor(avgScore) : 'text-gray-400';

            // Rows for the expanded table
            const rows = sorted.map(e => {
                const scoreNum = typeof e.score === 'number' ? e.score : null;
                const scoreColor = scoreNum !== null ? getScoreColor(scoreNum) : 'text-gray-400';
                const dateStr = e.gradedAt
                    ? e.gradedAt.toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                        timeZone: 'Africa/Lagos'
                      })
                    : '—';
                return `
                <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td class="py-3 px-4">
                        <div class="font-semibold text-gray-800 text-sm">${escapeHtml(e.tutorName)}</div>
                        <div class="text-xs text-gray-400">${escapeHtml(e.tutorEmail)}</div>
                    </td>
                    <td class="py-3 px-4 text-center">
                        <span class="text-xl font-black ${scoreColor}">${scoreNum !== null ? scoreNum + '%' : '—'}</span>
                    </td>
                    <td class="py-3 px-4 text-xs text-gray-600 max-w-xs">
                        ${e.notes
                            ? `<span class="italic text-gray-500">"${escapeHtml(e.notes)}"</span>`
                            : '<span class="text-gray-300">—</span>'}
                    </td>
                    <td class="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">${escapeHtml(dateStr)}</td>
                </tr>`;
            }).join('');

            // Card element
            const card = document.createElement('div');
            card.className = `bg-white rounded-2xl border border-${typeColor}-100 shadow-sm overflow-hidden`;

            card.innerHTML = `
            <!-- Accordion header — clickable -->
            <button class="ga-accordion-btn w-full text-left p-4 flex items-center gap-4 hover:bg-${typeColor}-50 transition-colors">
                <!-- Type badge -->
                <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-${typeColor}-100 flex items-center justify-center text-lg">
                    ${typeBadge}
                </div>
                <!-- Name + count -->
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-gray-800">${escapeHtml(graderName)}</div>
                    <div class="text-xs text-${typeColor}-500 font-semibold mt-0.5">
                        ${typeLabel} · ${entries.length} tutor${entries.length !== 1 ? 's' : ''} graded this week
                    </div>
                </div>
                <!-- Avg score pill -->
                ${avgScore !== null ? `
                <div class="flex-shrink-0 text-center px-3 py-1.5 rounded-xl bg-${typeColor}-50 border border-${typeColor}-100">
                    <div class="text-lg font-black ${avgColor}">${avgScore}%</div>
                    <div class="text-xs text-gray-400">avg</div>
                </div>` : ''}
                <!-- Chevron -->
                <i class="ga-chevron fas fa-chevron-down text-gray-400 transition-transform flex-shrink-0"></i>
            </button>

            <!-- Accordion body — hidden by default -->
            <div class="ga-accordion-body hidden border-t border-${typeColor}-100">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                                <th class="text-left py-2.5 px-4 font-semibold">Tutor</th>
                                <th class="text-center py-2.5 px-4 font-semibold">Score</th>
                                <th class="text-left py-2.5 px-4 font-semibold">Notes</th>
                                <th class="text-left py-2.5 px-4 font-semibold">Graded At (Lagos)</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;

            // Wire up the accordion toggle
            card.querySelector('.ga-accordion-btn').addEventListener('click', () => {
                const body    = card.querySelector('.ga-accordion-body');
                const chevron = card.querySelector('.ga-chevron');
                const isOpen  = !body.classList.contains('hidden');
                body.classList.toggle('hidden', isOpen);
                chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
            });

            parent.appendChild(card);
        }

        // ── QA cards ────────────────────────────────────────────────
        if (hasQA) {
            appendDivider(wrapper, 'QA — Session Observation', 'purple');
            Object.entries(qaByGrader)
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([grader, entries]) => {
                    appendGraderCard(wrapper, grader, entries, 'purple', 'QA', '📋');
                });
        }

        // ── QC cards ────────────────────────────────────────────────
        if (hasQC) {
            appendDivider(wrapper, 'QC — Lesson Plan', 'amber');
            Object.entries(qcByGrader)
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([grader, entries]) => {
                    appendGraderCard(wrapper, grader, entries, 'amber', 'QC', '📐');
                });
        }

        contentEl.innerHTML = '';
        contentEl.appendChild(wrapper);

    } catch (err) {
        console.error('Grading Activity tab error:', err);
        contentEl.innerHTML = `
        <div class="bg-white rounded-2xl border border-red-200 shadow-sm p-6 text-center">
            <p class="text-red-500 font-semibold">❌ Failed to load: ${escapeHtml(err.message)}</p>
        </div>`;
    }
}

// --- QA/QC Grade Modal ---
export function openGradeModal(type, dataset, grades, monthKey) {
    const tutorId = dataset.tutorId;
    const tutorName = dataset.tutorName;
    const tutorEmail = dataset.tutorEmail;
    const gradeId = dataset.gradeId;
    const isReadOnly = dataset.readonly === 'true';
    const staff = window.userData;
    const existingGrade = gradeId ? (Object.values(grades).find(g => g.id === gradeId) || {}) : {};
    const existingSection = existingGrade[type] || {};

    const isQA = type === 'qa';
    const themeColor = isQA ? 'purple' : 'amber';
    const title = isQA ? '📋 QA — Session Observation Rating' : '📐 QC — Lesson Plan Quality Control';

    // QA has 7 areas, QC has 10 areas
    const areas = isQA ? [
        { id: 'preparation',    label: 'Lesson Preparation & Resources', max: 15 },
        { id: 'delivery',       label: 'Teaching Delivery & Clarity',    max: 15 },
        { id: 'engagement',     label: 'Student Engagement',             max: 15 },
        { id: 'differentiation',label: 'Differentiation & Adaptation',   max: 15 },
        { id: 'assessment',     label: 'In-class Assessment',            max: 10 },
        { id: 'classroom',      label: 'Classroom Management',           max: 15 },
        { id: 'professionalism',label: 'Professionalism & Attitude',     max: 15 },
    ] : [
        { id: 'objectives',     label: 'Clear Learning Objectives',      max: 10 },
        { id: 'structure',      label: 'Lesson Structure & Flow',        max: 10 },
        { id: 'differentiation',label: 'Differentiation Strategies',     max: 10 },
        { id: 'resources',      label: 'Resource Quality',               max: 10 },
        { id: 'assessment',     label: 'Assessment Plan',                max: 10 },
        { id: 'timing',         label: 'Timing & Pacing',                max: 10 },
        { id: 'curriculum',     label: 'Curriculum Alignment',           max: 10 },
        { id: 'innovation',     label: 'Innovation & Creativity',        max: 10 },
        { id: 'feedback',       label: 'Feedback Mechanism',             max: 10 },
        { id: 'documentation',  label: 'Documentation & Completeness',   max: 10 },
    ];

    const breakdown = existingSection.breakdown || {};
    const existingNotes = existingSection.notes || '';

    const areasHTML = areas.map(a => `
        <div class="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
            <span class="flex-1 text-sm text-gray-700">${a.label}</span>
            <div class="flex items-center gap-2 flex-shrink-0">
                <input type="number" id="area-${a.id}" class="w-16 text-center border rounded-lg py-1 text-sm font-bold ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''}"
                    min="0" max="${a.max}" value="${breakdown[a.id] ?? ''}" ${isReadOnly ? 'readonly' : ''}
                    placeholder="0">
                <span class="text-xs text-gray-400 w-10">/ ${a.max}</span>
            </div>
        </div>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'grade-modal-overlay';
    modal.className = 'fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto my-4">
        <div class="p-5 border-b border-gray-100 flex items-center justify-between bg-${themeColor}-50 rounded-t-2xl">
            <div>
                <h3 class="font-bold text-lg text-${themeColor}-800">${title}</h3>
                <p class="text-sm text-${themeColor}-600">${escapeHtml(tutorName)} · ${monthKey}</p>
            </div>
            <button id="close-grade-modal" class="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
        </div>
        <div class="p-5 max-h-[60vh] overflow-y-auto">
            <div class="space-y-1">
                ${areasHTML}
            </div>
            <div class="mt-4">
                <label class="block text-sm font-semibold text-gray-700 mb-1">Notes & Advice for Tutor</label>
                <textarea id="grade-notes" class="w-full border rounded-xl p-3 text-sm resize-none ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''}"
                    rows="3" placeholder="Add advice, commendations, or improvement areas…" ${isReadOnly ? 'readonly' : ''}>${escapeHtml(existingNotes)}</textarea>
            </div>
            <!-- Live total -->
            <div class="mt-3 bg-${themeColor}-50 rounded-xl p-3 flex items-center justify-between">
                <span class="text-sm font-semibold text-${themeColor}-700">Score</span>
                <span id="live-total" class="text-2xl font-black text-${themeColor}-700">—</span>
            </div>
            ${existingSection.gradedByName ? `<div class="mt-2 text-xs text-gray-400 text-center">Graded by <strong>${escapeHtml(existingSection.gradedByName)}</strong></div>` : ''}
        </div>
        <div class="p-4 border-t border-gray-100 flex gap-3 justify-end">
            <button id="cancel-grade-modal" class="px-4 py-2 bg-gray-100 rounded-xl text-sm hover:bg-gray-200">Cancel</button>
            ${!isReadOnly ? `<button id="save-grade-modal" class="px-6 py-2 bg-${themeColor}-600 text-white rounded-xl text-sm font-bold hover:bg-${themeColor}-700">Save Grade</button>` : ''}
        </div>
    </div>`;

    document.body.appendChild(modal);

    // Live total calculation
    function recalcTotal() {
        let sum = 0, maxSum = 0;
        areas.forEach(a => {
            const val = parseInt(document.getElementById(`area-${a.id}`)?.value || 0) || 0;
            sum += Math.min(val, a.max);
            maxSum += a.max;
        });
        const pct = maxSum > 0 ? Math.round((sum / maxSum) * 100) : 0;
        const el = document.getElementById('live-total');
        if (el) el.textContent = `${pct}%`;
        return pct;
    }
    modal.querySelectorAll('input[type=number]').forEach(inp => inp.addEventListener('input', recalcTotal));
    recalcTotal();

    // Close
    modal.querySelector('#close-grade-modal').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancel-grade-modal').addEventListener('click', () => modal.remove());

    // Save
    if (!isReadOnly) {
        modal.querySelector('#save-grade-modal').addEventListener('click', async () => {
        // FIX 1: btn declared here — outside try/catch — so catch block can reference it
        const btn = modal.querySelector('#save-grade-modal');

        btn.addEventListener('click', async () => {
            const breakdownData = {};
            areas.forEach(a => {
                const val = parseInt(document.getElementById(`area-${a.id}`)?.value || 0) || 0;
                breakdownData[a.id] = Math.min(val, a.max);
            });
            const totalPct = recalcTotal();
            const notes = document.getElementById('grade-notes').value.trim();

            const sectionData = {
                score: totalPct,
                notes,
                breakdown: breakdownData,
                gradedBy: staff.email || '',
                gradedByName: staff.name || 'Management',
                gradedAt: new Date()
            };

            try {
                const btn = modal.querySelector('#save-grade-modal');
                btn.textContent = 'Saving…'; btn.disabled = true;

                if (gradeId) {
                    await updateDoc(doc(db, 'tutor_grades', gradeId), { [type]: sectionData });
                } else {
                    // Create new doc
                    const newDoc = {
                        tutorId,
                        tutorEmail,
                        month: monthKey,
                        [type]: sectionData
                    };
                    await addDoc(collection(db, 'tutor_grades'), newDoc);
                }

                // Update performanceScore on tutor doc for tutor.js to read
                // ── Re-fetch the grade doc from Firestore to get the LATEST qa+qc data ──
                // Re-fetch the grade doc to get latest qa+qc data
                let freshGrade = {};
                if (gradeId) {
                    const freshSnap = await getDoc(doc(db, 'tutor_grades', gradeId));
                    if (freshSnap.exists()) freshGrade = freshSnap.data();
                } else {
                    // Newly created — find it by tutorId + month
                    const freshQuery = await getDocs(
                        query(collection(db, 'tutor_grades'),
                              where('tutorId', '==', tutorId),
                              where('month', '==', monthKey))
                    );
                    if (!freshQuery.empty) freshGrade = freshQuery.docs[0].data();
                    else {
                        // fallback: by email
                        const freshQuery2 = await getDocs(
                            query(collection(db, 'tutor_grades'),
                                  where('tutorEmail', '==', tutorEmail),
                                  where('month', '==', monthKey))
                        );
                        if (!freshQuery2.empty) freshGrade = freshQuery2.docs[0].data();
                    }
                }

                // The just-saved section is already in sectionData; merge with freshGrade
                // Merge just-saved section with freshGrade for combined score
                const freshQA = type === 'qa' ? sectionData : (freshGrade.qa || null);
                const freshQC = type === 'qc' ? sectionData : (freshGrade.qc || null);
                const qaScore = freshQA?.score ?? null;
                const qcScore = freshQC?.score ?? null;
                const combined = (qaScore !== null && qcScore !== null)
                    ? Math.round((qaScore + qcScore) / 2)
                    : (qaScore !== null ? qaScore : qcScore);

                if (combined !== null) {
                    const tutorDocRef = doc(db, 'tutors', tutorId);

                    await updateDoc(tutorDocRef, {
                        performanceScore: combined,
                        qaScore: qaScore,
                        qcScore: qcScore,
                        performanceMonth: monthKey,
                        qaAdvice: type === 'qa' ? notes : (existingGradeForTutor.qa?.notes || ''),
                        qcAdvice: type === 'qc' ? notes : (existingGradeForTutor.qc?.notes || ''),
                        qaGradedByName: type === 'qa' ? sectionData.gradedByName : (existingGradeForTutor.qa?.gradedByName || ''),
                        qcGradedByName: type === 'qc' ? sectionData.gradedByName : (existingGradeForTutor.qc?.gradedByName || '')
                        qaAdvice: type === 'qa' ? notes : (freshGrade.qa?.notes || ''),
                        qcAdvice: type === 'qc' ? notes : (freshGrade.qc?.notes || ''),
                        qaGradedByName: type === 'qa' ? sectionData.gradedByName : (freshGrade.qa?.gradedByName || ''),
                        qcGradedByName: type === 'qc' ? sectionData.gradedByName : (freshGrade.qc?.gradedByName || '')
                    });
                }

                modal.remove();
                // Refresh portal
                renderMasterPortalPanel(document.getElementById('main-content'));
            } catch (e) {
                console.error('Grade save error:', e);
                btn.textContent = 'Save Grade'; btn.disabled = false;
                alert('❌ Error saving grade: ' + e.message);
            }
        });
    }
}

// --- Update tutor of month document ---
export async function updateTutorOfMonthIfNeeded(tutor, score, monthKey, monthLabel) {
    try {
        const cycleRef = doc(db, 'gamification', 'current_cycle');
        const cycleSnap = await getDoc(cycleRef);
        const existing = cycleSnap.exists() ? cycleSnap.data() : {};
        if (existing.month !== monthKey || existing.winnerId !== tutor.id) {
            await setDoc(cycleRef, {
                winnerId: tutor.id,
                winnerEmail: tutor.email,
                winnerName: tutor.name,
                month: monthKey,
                monthLabel,
                totalScore: score
            }, { merge: true });
        }
    } catch (e) { /* silent */ }
}

// ======================================================
