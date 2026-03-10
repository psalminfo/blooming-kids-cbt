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


// ============================================================
// QC ROTATION SYSTEM — helpers
// ============================================================

/** Emails excluded from receiving an assigned QC list.
 *  They still have QC permission and can grade freely. */
const QC_ROTATION_EXCLUDED = ['ade@gmail.com'];

/** Fisher-Yates shuffle — returns a NEW shuffled array. */
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Returns every Monday–Sunday week that overlaps the given
 * year/month (0-based), as an array of:
 *   { weekNum (1-indexed), monday, sunday, weekKey }
 * Always in Lagos local calendar.
 */
function getWeeksInMonth(year, month) {
    const firstDay   = new Date(year, month, 1);
    const dow        = firstDay.getDay(); // 0=Sun
    const sinceMonday = dow === 0 ? 6 : dow - 1;
    let monday = new Date(year, month, 1 - sinceMonday);

    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const weeks = [];
    let weekNum = 0;
    while (monday <= monthEnd) {
        const sunday = new Date(monday.getFullYear(), monday.getMonth(),
                                monday.getDate() + 6, 23, 59, 59, 999);
        weekNum++;
        weeks.push({
            weekNum,
            monday: new Date(monday),
            sunday: new Date(sunday),
            weekKey: `${year}-${String(month + 1).padStart(2,'0')}-W${weekNum}`
        });
        monday = new Date(monday.getFullYear(), monday.getMonth(),
                          monday.getDate() + 7);
    }
    return weeks;
}

/** Split array into numChunks roughly-equal slices (front-heavy). */
function splitIntoChunks(arr, numChunks) {
    if (numChunks <= 0) return [];
    const chunks = [];
    const base  = Math.floor(arr.length / numChunks);
    const extra = arr.length % numChunks;
    let idx = 0;
    for (let i = 0; i < numChunks; i++) {
        const size = base + (i < extra ? 1 : 0);
        chunks.push(arr.slice(idx, idx + size));
        idx += size;
    }
    return chunks;
}

/**
 * Average QC score from a qc_grades array.
 * Returns null when the array is empty / has no numeric scores.
 */
function calcAvgQcScore(qcGrades) {
    if (!qcGrades || qcGrades.length === 0) return null;
    const valid = qcGrades.filter(e => typeof e.score === 'number');
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((s, e) => s + e.score, 0) / valid.length);
}

/**
 * Concatenate all QC notes (one per grader) into a single string.
 * Each entry is prefixed with the grader's name in brackets.
 */
function concatQcNotes(qcGrades) {
    if (!qcGrades || qcGrades.length === 0) return '';
    return qcGrades
        .filter(e => e.notes && e.notes.trim())
        .map(e => `[${e.gradedByName || e.gradedBy}]: ${e.notes.trim()}`)
        .join('\n');
}

/**
 * Get or create the monthly QC assignment plan.
 *
 * Firestore doc: qc_assignments/{monthKey}
 * {
 *   month, generatedAt, lastUpdated,
 *   weeks: [
 *     { weekNum, weekKey, mondayISO, sundayISO,
 *       assignments: { staffEmail: [tutorId, …] } }
 *   ]
 * }
 *
 * Algorithm
 * ---------
 * 1. Each QC staff member (excluding QC_ROTATION_EXCLUDED) gets a
 *    DIFFERENT randomised slice of tutors each week.
 * 2. The slices rotate so that by end of month every staff member
 *    has graded every tutor exactly once.
 * 3. Mid-month activation: tutors already graded by a staff member
 *    are excluded from that staff member's remaining pool — their
 *    grades stay untouched.
 * 4. New tutors added after the plan was first created are
 *    automatically inserted into the remaining weeks.
 *
 * @param {string}   monthKey               e.g. "2026-03"
 * @param {string[]} allTutorIds            all active tutor doc IDs
 * @param {string[]} qcStaffEmails          staff with canQC, excl. EXCLUDED
 * @param {Object}   existingQcGradesByTutor { tutorId: [{gradedBy}] }
 */
async function getOrCreateQcAssignmentPlan(
    monthKey, allTutorIds, qcStaffEmails, existingQcGradesByTutor
) {
    const planRef = doc(db, 'qc_assignments', monthKey);

    // Which week-index are we in right now? (0-based)
    const [yrS, moS] = monthKey.split('-');
    const year  = parseInt(yrS, 10);
    const month = parseInt(moS, 10) - 1; // 0-based
    const weeks = getWeeksInMonth(year, month);
    const numWeeks = weeks.length;

    const lagosNow = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' })
    );
    let curWeekIdx = weeks.findIndex(
        w => lagosNow >= w.monday && lagosNow <= w.sunday
    );
    if (curWeekIdx === -1) curWeekIdx = numWeeks - 1;

    // ── Load existing plan ──────────────────────────────────────────
    let planSnap;
    try { planSnap = await getDoc(planRef); }
    catch(e) { planSnap = { exists: () => false }; }

    if (planSnap.exists && planSnap.exists()) {
        const existingPlan = planSnap.data();

        // Find tutors not yet in the plan (new mid-month tutors)
        const plannedIds = new Set();
        (existingPlan.weeks || []).forEach(w =>
            Object.values(w.assignments || {}).forEach(ids =>
                ids.forEach(id => plannedIds.add(id))
            )
        );
        const newTutors = allTutorIds.filter(id => !plannedIds.has(id));

        if (newTutors.length > 0) {
            // Distribute new tutors across remaining weeks, per staff
            const remaining = weeks.slice(curWeekIdx);
            const numRemaining = remaining.length;
            const updatedWeeks = (existingPlan.weeks || []).map((w, wi) => {
                if (wi < curWeekIdx) return w;
                const slotIdx  = wi - curWeekIdx;
                const newAssig = { ...w.assignments };
                qcStaffEmails.forEach((email, si) => {
                    // Each staff gets a different rotated slice of new tutors
                    const shuffledNew = shuffleArray(newTutors);
                    const chunks      = splitIntoChunks(shuffledNew, numRemaining);
                    const myChunk     = chunks[(slotIdx + si) % numRemaining] || [];
                    newAssig[email] = [...(newAssig[email] || []), ...myChunk];
                });
                return { ...w, assignments: newAssig };
            });
            try {
                await updateDoc(planRef, {
                    weeks: updatedWeeks,
                    lastUpdated: new Date()
                });
            } catch(e) { /* non-critical */ }
            return { ...existingPlan, weeks: updatedWeeks };
        }

        return existingPlan;
    }

    // ── Generate fresh plan ────────────────────────────────────────
    // Build "already graded" sets per staff for mid-month activation
    const alreadyByStaff = {};
    qcStaffEmails.forEach(e => { alreadyByStaff[e] = new Set(); });
    Object.entries(existingQcGradesByTutor).forEach(([tid, entries]) => {
        entries.forEach(entry => {
            if (alreadyByStaff[entry.gradedBy]) {
                alreadyByStaff[entry.gradedBy].add(tid);
            }
        });
    });

    // Remaining tutors per staff = all tutors minus already graded
    const remainingByStaff = {};
    qcStaffEmails.forEach(email => {
        remainingByStaff[email] = allTutorIds.filter(
            id => !alreadyByStaff[email].has(id)
        );
    });

    // Build week documents
    const weekDocs = weeks.map(w => ({
        weekNum:   w.weekNum,
        weekKey:   w.weekKey,
        mondayISO: w.monday.toISOString().slice(0, 10),
        sundayISO: w.sunday.toISOString().slice(0, 10),
        assignments: {}
    }));

    // Remaining weeks (current onward)
    const remIdxs = weeks.map((_, i) => i).filter(i => i >= curWeekIdx);
    const numRem  = remIdxs.length;

    // Each staff gets a shuffled-then-split list across remaining weeks,
    // rotated so they never share the same tutors in the same week.
    qcStaffEmails.forEach((email, si) => {
        const shuffled = shuffleArray(remainingByStaff[email]);
        const chunks   = splitIntoChunks(shuffled, numRem);
        remIdxs.forEach((wIdx, chunkPos) => {
            // staff si gets chunk at position (chunkPos + si) % numRem
            // so no two staff share the same chunk in the same week
            const myChunk = chunks[(chunkPos + si) % numRem] || [];
            weekDocs[wIdx].assignments[email] = myChunk;
        });
    });

    const plan = {
        month: monthKey,
        generatedAt: new Date(),
        lastUpdated: new Date(),
        weeks: weekDocs
    };

    try { await setDoc(planRef, plan); }
    catch(e) { console.error('Failed to save QC plan:', e); }
    return plan;
}

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

        // Rank all tutors who have at least one score
        const rankedTutors = tutors
            .map(t => {
                const g = grades[t.id] || grades[t.email] || {};
                const qa = g.qa?.score ?? null;
                // QC score = average of all qc_grades entries; fallback to legacy single qc
                const qc = calcAvgQcScore(g.qc_grades) ?? (g.qc?.score ?? null);
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
            // QC score: average of all qc_grades; fall back to legacy g.qc?.score
            const qcScore = calcAvgQcScore(g.qc_grades) ?? (g.qc?.score ?? null);
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
            // alreadyQC: check qc_grades array (multi-grader); fall back to legacy single qc field
            const alreadyQC = (g.qc_grades || []).some(e => e.gradedBy === currentStaff?.email)
                           || (!g.qc_grades?.length && g.qc?.gradedBy === currentStaff?.email);

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

                    <!-- QC Score (multi-grader averaged) -->
                    <div class="bg-white rounded-xl border border-amber-100 p-3">
                        <div class="flex justify-between items-start mb-1">
                            <div class="text-xs font-bold text-amber-600 uppercase tracking-wide">QC – Lesson Plan</div>
                            ${(g.qc_grades||[]).length > 0
                                ? `<span class="text-xs text-gray-400">${(g.qc_grades||[]).length} grader${(g.qc_grades||[]).length>1?'s':''}</span>`
                                : (g.qc?.gradedByName ? `<span class="text-xs text-gray-400">by ${escapeHtml(g.qc.gradedByName)}</span>` : '')}
                        </div>
                        ${qcScore !== null ? `
                            <div class="text-3xl font-black ${getScoreColor(qcScore)}">${qcScore}<span class="text-sm font-normal text-gray-400 ml-1">% avg</span></div>
                            <div class="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                <div class="${getScoreBar(qcScore)} h-1.5 rounded-full" style="width:${qcScore}%"></div>
                            </div>
                            ${ (g.qc_grades||[]).length > 0 ? (g.qc_grades||[]).map(e =>
                                `<div class="mt-1.5 flex justify-between text-xs text-gray-500 bg-amber-50 rounded px-2 py-1">
                                    <span>${escapeHtml(e.gradedByName||e.gradedBy)}</span>
                                    <span class="font-bold ${getScoreColor(e.score)}">${e.score}%</span>
                                </div>`).join('') : '' }
                            ${concatQcNotes(g.qc_grades||[]) ? `<div class="mt-2 text-xs text-gray-600 bg-amber-50 rounded p-1.5 italic">"${escapeHtml(concatQcNotes(g.qc_grades||[]))}"</div>` : (g.qc?.notes ? `<div class="mt-2 text-xs text-gray-600 bg-amber-50 rounded p-1.5 italic">"${escapeHtml(g.qc.notes)}"</div>` : '')}
                        ` : `<div class="text-gray-400 text-sm mt-1">Not graded yet</div>`}
                        ${canQC && !alreadyQC ? `
                            <button class="open-qc-btn mt-2 w-full bg-amber-600 text-white text-xs rounded-lg py-1.5 hover:bg-amber-700" data-tutor-id="${tutor.id}" data-tutor-name="${escapeHtml(tutor.name)}" data-tutor-email="${escapeHtml(tutor.email)}" data-grade-id="${g.id || ''}">
                                ${qcScore !== null ? '✏️ Add My QC Grade' : '📋 Grade QC'}
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

        <!-- Sub-tab bar -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-1 flex gap-1">
            <button id="ga-tab-activity"
                class="flex-1 py-2 px-3 rounded-xl text-sm font-semibold bg-blue-600 text-white transition-colors">
                📋 This Week's Grading
            </button>
            <button id="ga-tab-ungraded"
                class="flex-1 py-2 px-3 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
                ⚠️ Ungraded
            </button>
        </div>

        <!-- Sub-tab panels -->
        <div id="ga-panel-activity">
            <div class="text-center py-12">
                <div class="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="text-gray-500">Fetching grades…</p>
            </div>
        </div>
        <div id="ga-panel-ungraded" class="hidden">
            <div class="text-center py-12">
                <div class="inline-block w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p class="text-gray-500">Loading assignments…</p>
            </div>
        </div>
    </div>`;

    const activityPanel = container.querySelector('#ga-panel-activity');
    const ungradedPanel = container.querySelector('#ga-panel-ungraded');
    const tabActivity   = container.querySelector('#ga-tab-activity');
    const tabUngraded   = container.querySelector('#ga-tab-ungraded');

    function activateGaTab(tab) {
        const isActivity = tab === 'activity';
        activityPanel.classList.toggle('hidden', !isActivity);
        ungradedPanel.classList.toggle('hidden', isActivity);
        tabActivity.classList.toggle('bg-blue-600', isActivity);
        tabActivity.classList.toggle('text-white',  isActivity);
        tabActivity.classList.toggle('text-gray-600', !isActivity);
        tabUngraded.classList.toggle('bg-blue-600', !isActivity);
        tabUngraded.classList.toggle('text-white',  !isActivity);
        tabUngraded.classList.toggle('text-gray-600', isActivity);
    }
    tabActivity.addEventListener('click', () => activateGaTab('activity'));
    tabUngraded.addEventListener('click', () => activateGaTab('ungraded'));

    try {
        // ── Fetch all data in parallel ─────────────────────────────
        const [gradesSnap, tutorsSnap, staffSnap] = await Promise.all([
            getDocs(query(collection(db, 'tutor_grades'), where('month', '==', monthKey))),
            getDocs(query(collection(db, 'tutors'), orderBy('name'))),
            getDocs(collection(db, 'tutors'))   // staff list (reuse tutors collection gate)
        ]);

        // We need QC staff list — staff are in a separate collection or use window.userData context.
        // Use the staffList already available via Firestore (query staff with canQC permission).
        // Since staff accounts aren't in "tutors", fetch from users/staff collection if available,
        // or read canQC from any available staff source. Here we derive from grades already recorded.
        // For plan generation we need real staff emails — fetch from 'staff' or 'management' collection.
        let allQcStaff = [];
        try {
            const staffDocs = await getDocs(collection(db, 'staff'));
            staffDocs.docs.forEach(d => {
                const data = d.data();
                if (data?.permissions?.tabs?.canQC && !QC_ROTATION_EXCLUDED.includes(data.email)) {
                    allQcStaff.push({ id: d.id, email: data.email, name: data.name || data.email });
                }
            });
        } catch(e) { /* staff collection may be named differently — handled below */ }

        // Fallback: derive QC staff from existing grades if staff collection unavailable
        if (allQcStaff.length === 0) {
            const seenGraders = new Set();
            gradesSnap.docs.forEach(d => {
                const g = d.data();
                (g.qc_grades || []).forEach(e => {
                    if (!QC_ROTATION_EXCLUDED.includes(e.gradedBy) && !seenGraders.has(e.gradedBy)) {
                        seenGraders.add(e.gradedBy);
                        allQcStaff.push({ email: e.gradedBy, name: e.gradedByName || e.gradedBy });
                    }
                });
                if (g.qc?.gradedBy && !QC_ROTATION_EXCLUDED.includes(g.qc.gradedBy)
                    && !seenGraders.has(g.qc.gradedBy)) {
                    seenGraders.add(g.qc.gradedBy);
                    allQcStaff.push({ email: g.qc.gradedBy, name: g.qc.gradedByName || g.qc.gradedBy });
                }
            });
        }

        // Build tutorId → name map
        const tutorNameById  = {};
        const allTutorIds    = [];
        tutorsSnap.docs.forEach(d => {
            tutorNameById[d.id] = d.data().name || d.data().email || d.id;
            allTutorIds.push(d.id);
        });

        // Build existing QC grades by tutor (for plan generation)
        const existingQcGradesByTutor = {};
        gradesSnap.docs.forEach(d => {
            const g = d.data();
            const tid = g.tutorId || d.id;
            const entries = [];
            (g.qc_grades || []).forEach(e => entries.push({ gradedBy: e.gradedBy }));
            if (entries.length === 0 && g.qc?.gradedBy) {
                entries.push({ gradedBy: g.qc.gradedBy });
            }
            if (entries.length > 0) existingQcGradesByTutor[tid] = entries;
        });

        // Get or create the monthly QC plan
        const qcStaffEmails = allQcStaff.map(s => s.email);
        let plan = null;
        if (qcStaffEmails.length > 0) {
            plan = await getOrCreateQcAssignmentPlan(
                monthKey, allTutorIds, qcStaffEmails, existingQcGradesByTutor
            );
        }

        // ── THIS WEEK'S GRADING (accordion cards) ─────────────────

        // Group QA and QC graded entries by grader for this week
        const qaByGrader = {};
        const qcByGrader = {};

        gradesSnap.docs.forEach(d => {
            const g = d.data();
            const tutorName = tutorNameById[g.tutorId] || g.tutorEmail || g.tutorId || '—';

            // QA
            if (g.qa && g.qa.gradedBy) {
                const gradedAt = toDate(g.qa.gradedAt);
                if (gradedAt && gradedAt >= weekStart && gradedAt <= weekEnd) {
                    const grader = g.qa.gradedByName || g.qa.gradedBy;
                    if (!qaByGrader[grader]) qaByGrader[grader] = [];
                    qaByGrader[grader].push({
                        tutorName, tutorEmail: g.tutorEmail || '',
                        score: g.qa.score ?? '—', notes: g.qa.notes || '', gradedAt
                    });
                }
            }

            // QC — from qc_grades array (multi-grader)
            const qcEntries = g.qc_grades && g.qc_grades.length > 0
                ? g.qc_grades
                : (g.qc?.gradedBy ? [g.qc] : []);

            qcEntries.forEach(entry => {
                if (!entry.gradedBy) return;
                const gradedAt = toDate(entry.gradedAt);
                if (gradedAt && gradedAt >= weekStart && gradedAt <= weekEnd) {
                    const grader = entry.gradedByName || entry.gradedBy;
                    if (!qcByGrader[grader]) qcByGrader[grader] = [];
                    qcByGrader[grader].push({
                        tutorName, tutorEmail: g.tutorEmail || '',
                        score: entry.score ?? '—', notes: entry.notes || '', gradedAt
                    });
                }
            });
        });

        const hasQA = Object.keys(qaByGrader).length > 0;
        const hasQC = Object.keys(qcByGrader).length > 0;

        // Build section divider
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
            const sorted   = [...entries].sort((a, b) => b.gradedAt - a.gradedAt);
            const scores   = sorted.map(e => e.score).filter(s => typeof s === 'number');
            const avgScore = scores.length > 0
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : null;
            const avgColor = avgScore !== null ? getScoreColor(avgScore) : 'text-gray-400';

            const rows = sorted.map(e => {
                const scoreNum   = typeof e.score === 'number' ? e.score : null;
                const scoreColor = scoreNum !== null ? getScoreColor(scoreNum) : 'text-gray-400';
                const dateStr    = e.gradedAt
                    ? e.gradedAt.toLocaleDateString('en-GB', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos'
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

            const card = document.createElement('div');
            card.className = `bg-white rounded-2xl border border-${typeColor}-100 shadow-sm overflow-hidden`;
            card.innerHTML = `
            <button class="ga-accordion-btn w-full text-left p-4 flex items-center gap-4 hover:bg-${typeColor}-50 transition-colors">
                <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-${typeColor}-100 flex items-center justify-center text-lg">
                    ${typeBadge}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-gray-800">${escapeHtml(graderName)}</div>
                    <div class="text-xs text-${typeColor}-500 font-semibold mt-0.5">
                        ${typeLabel} · ${entries.length} tutor${entries.length !== 1 ? 's' : ''} graded this week
                    </div>
                </div>
                ${avgScore !== null ? `
                <div class="flex-shrink-0 text-center px-3 py-1.5 rounded-xl bg-${typeColor}-50 border border-${typeColor}-100">
                    <div class="text-lg font-black ${avgColor}">${avgScore}%</div>
                    <div class="text-xs text-gray-400">avg</div>
                </div>` : ''}
                <i class="ga-chevron fas fa-chevron-down text-gray-400 transition-transform flex-shrink-0"></i>
            </button>
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

            card.querySelector('.ga-accordion-btn').addEventListener('click', () => {
                const body    = card.querySelector('.ga-accordion-body');
                const chevron = card.querySelector('.ga-chevron');
                const isOpen  = !body.classList.contains('hidden');
                body.classList.toggle('hidden', isOpen);
                chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
            parent.appendChild(card);
        }

        // Render activity panel
        if (!hasQA && !hasQC) {
            activityPanel.innerHTML = `
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
                <div class="text-4xl mb-3">📭</div>
                <p class="text-gray-500 font-semibold">No grades recorded this week yet.</p>
                <p class="text-xs text-gray-400 mt-1">Grades will appear here as staff grade tutors.</p>
            </div>`;
        } else {
            const wrapper = document.createElement('div');
            wrapper.className = 'space-y-4';
            if (hasQA) {
                appendDivider(wrapper, 'QA — Session Observation', 'purple');
                Object.entries(qaByGrader).sort(([a],[b]) => a.localeCompare(b))
                    .forEach(([g, e]) => appendGraderCard(wrapper, g, e, 'purple', 'QA', '📋'));
            }
            if (hasQC) {
                appendDivider(wrapper, 'QC — Lesson Plan', 'amber');
                Object.entries(qcByGrader).sort(([a],[b]) => a.localeCompare(b))
                    .forEach(([g, e]) => appendGraderCard(wrapper, g, e, 'amber', 'QC', '📐'));
            }
            activityPanel.innerHTML = '';
            activityPanel.appendChild(wrapper);
        }

        // ── UNGRADED TAB ───────────────────────────────────────────
        renderUngradedPanel(
            ungradedPanel, plan, tutorNameById, gradesSnap, weekStart, weekEnd, allQcStaff
        );

    } catch (err) {
        console.error('Grading Activity tab error:', err);
        activityPanel.innerHTML = `
        <div class="bg-white rounded-2xl border border-red-200 shadow-sm p-6 text-center">
            <p class="text-red-500 font-semibold">❌ Failed to load: ${escapeHtml(err.message)}</p>
        </div>`;
    }
}

/**
 * Render the Ungraded panel.
 * For the current week's QC plan, show each staff member and which
 * of their assigned tutors have NOT yet been graded this week
 * (including any carryover from previous weeks still ungraded).
 */
function renderUngradedPanel(panel, plan, tutorNameById, gradesSnap, weekStart, weekEnd, allQcStaff) {
    if (!plan || !plan.weeks || allQcStaff.length === 0) {
        panel.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div class="text-3xl mb-2">📋</div>
            <p class="text-gray-500 font-semibold">No QC assignment plan yet for this month.</p>
            <p class="text-xs text-gray-400 mt-1">The plan generates automatically. Check back shortly.</p>
        </div>`;
        return;
    }

    // Which week is current?
    const lagosNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
    let curWeekIdx = plan.weeks.findIndex(w => {
        const mon = new Date(w.mondayISO + 'T00:00:00');
        const sun = new Date(w.sundayISO + 'T23:59:59');
        return lagosNow >= mon && lagosNow <= sun;
    });
    if (curWeekIdx === -1) curWeekIdx = plan.weeks.length - 1;

    // Build set of (staffEmail, tutorId) pairs that have been QC graded this month
    const gradedPairs = new Set();
    gradesSnap.docs.forEach(d => {
        const g   = d.data();
        const tid = g.tutorId || d.id;
        const qcEntries = g.qc_grades && g.qc_grades.length > 0
            ? g.qc_grades
            : (g.qc?.gradedBy ? [g.qc] : []);
        qcEntries.forEach(e => {
            if (e.gradedBy) gradedPairs.add(`${e.gradedBy}::${tid}`);
        });
    });

    // For each QC staff, collect ALL tutors assigned up to and
    // including this week that have NOT been graded yet (the deficit).
    const staffByEmail = {};
    allQcStaff.forEach(s => { staffByEmail[s.email] = s; });

    const staffDeficits = allQcStaff.map(staff => {
        // Gather every tutor assigned to this staff member in weeks 0..curWeekIdx
        const assignedSoFar = new Set();
        for (let wi = 0; wi <= curWeekIdx; wi++) {
            const week = plan.weeks[wi];
            if (!week) continue;
            const ids = (week.assignments || {})[staff.email] || [];
            ids.forEach(id => assignedSoFar.add(id));
        }
        // Subtract already graded
        const ungraded = [...assignedSoFar].filter(
            tid => !gradedPairs.has(`${staff.email}::${tid}`)
        );
        return { staff, ungraded };
    }).filter(x => x.ungraded.length > 0);

    if (staffDeficits.length === 0) {
        panel.innerHTML = `
        <div class="bg-white rounded-2xl border border-green-100 shadow-sm p-10 text-center">
            <div class="text-4xl mb-3">✅</div>
            <p class="text-green-600 font-bold">All QC grades are up to date!</p>
            <p class="text-xs text-gray-400 mt-1">Every staff member has completed their assigned list so far.</p>
        </div>`;
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-4';

    // Header note
    const note = document.createElement('div');
    note.className = 'bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800';
    note.innerHTML = `<strong>⚠️ Deficit:</strong> These tutors are on a QC staff member's assigned list but have not been graded yet (including carryover from previous weeks this month).`;
    wrapper.appendChild(note);

    staffDeficits.forEach(({ staff, ungraded }) => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden';

        const rows = ungraded.map(tid => {
            const name = tutorNameById[tid] || tid;
            return `<tr class="border-b border-gray-50 hover:bg-amber-50 transition-colors">
                <td class="py-3 px-4 font-semibold text-gray-800 text-sm">${escapeHtml(name)}</td>
                <td class="py-3 px-4 text-xs text-amber-600 font-semibold">Ungraded</td>
            </tr>`;
        }).join('');

        card.innerHTML = `
        <button class="ug-accordion-btn w-full text-left p-4 flex items-center gap-4 hover:bg-amber-50 transition-colors">
            <div class="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-lg">👤</div>
            <div class="flex-1 min-w-0">
                <div class="font-bold text-gray-800">${escapeHtml(staff.name || staff.email)}</div>
                <div class="text-xs text-amber-600 font-semibold mt-0.5">
                    ${ungraded.length} tutor${ungraded.length !== 1 ? 's' : ''} not yet graded
                </div>
            </div>
            <span class="flex-shrink-0 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-bold">
                ${ungraded.length} pending
            </span>
            <i class="ug-chevron fas fa-chevron-down text-gray-400 transition-transform flex-shrink-0"></i>
        </button>
        <div class="ug-accordion-body hidden border-t border-amber-100">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                            <th class="text-left py-2.5 px-4 font-semibold">Tutor</th>
                            <th class="text-left py-2.5 px-4 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;

        card.querySelector('.ug-accordion-btn').addEventListener('click', () => {
            const body    = card.querySelector('.ug-accordion-body');
            const chevron = card.querySelector('.ug-chevron');
            const isOpen  = !body.classList.contains('hidden');
            body.classList.toggle('hidden', isOpen);
            chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
        });

        wrapper.appendChild(card);
    });

    panel.innerHTML = '';
    panel.appendChild(wrapper);
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
    // For QC: show THIS staff member's own entry from qc_grades (or legacy qc field)
    const existingSection = type === 'qc'
        ? ((existingGrade.qc_grades || []).find(e => e.gradedBy === staff?.email)
           || existingGrade.qc || {})
        : (existingGrade[type] || {});

    const isQA = type === 'qa';
    const themeColor = isQA ? 'purple' : 'amber';
    const title = isQA ? '📋 QA — Session Observation Rating' : '📐 QC — Lesson Plan Quality Control';

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
                btn.textContent = 'Saving…'; btn.disabled = true;

                // ── QA path (unchanged) ──────────────────────────────────
                if (type === 'qa') {
                    if (gradeId) {
                        await updateDoc(doc(db, 'tutor_grades', gradeId), { qa: sectionData });
                    } else {
                        await addDoc(collection(db, 'tutor_grades'), {
                            tutorId, tutorEmail, month: monthKey, qa: sectionData
                        });
                    }

                    // Re-fetch to get current qc score for combined calculation
                    let freshGrade = {};
                    if (gradeId) {
                        const s = await getDoc(doc(db, 'tutor_grades', gradeId));
                        if (s.exists()) freshGrade = s.data();
                    } else {
                        const q1 = await getDocs(query(collection(db, 'tutor_grades'),
                            where('tutorId', '==', tutorId), where('month', '==', monthKey)));
                        if (!q1.empty) freshGrade = q1.docs[0].data();
                        else {
                            const q2 = await getDocs(query(collection(db, 'tutor_grades'),
                                where('tutorEmail', '==', tutorEmail), where('month', '==', monthKey)));
                            if (!q2.empty) freshGrade = q2.docs[0].data();
                        }
                    }
                    const qaScore  = sectionData.score;
                    // QC score for combined = average of qc_grades (or legacy qc.score)
                    const qcScore  = calcAvgQcScore(freshGrade.qc_grades) ?? (freshGrade.qc?.score ?? null);
                    const combined = qcScore !== null
                        ? Math.round((qaScore + qcScore) / 2)
                        : qaScore;
                    await updateDoc(doc(db, 'tutors', tutorId), {
                        performanceScore:  combined,
                        qaScore:           qaScore,
                        qcScore:           qcScore,
                        performanceMonth:  monthKey,
                        qaAdvice:          notes,
                        qaGradedByName:    sectionData.gradedByName
                    });

                // ── QC path (multi-grader) ───────────────────────────────
                } else {
                    // Step 1: load current qc_grades array from Firestore
                    let currentDoc = {};
                    let resolvedGradeId = gradeId;
                    if (gradeId) {
                        const s = await getDoc(doc(db, 'tutor_grades', gradeId));
                        if (s.exists()) currentDoc = s.data();
                    } else {
                        const q1 = await getDocs(query(collection(db, 'tutor_grades'),
                            where('tutorId', '==', tutorId), where('month', '==', monthKey)));
                        if (!q1.empty) {
                            currentDoc        = q1.docs[0].data();
                            resolvedGradeId   = q1.docs[0].id;
                        } else {
                            const q2 = await getDocs(query(collection(db, 'tutor_grades'),
                                where('tutorEmail', '==', tutorEmail), where('month', '==', monthKey)));
                            if (!q2.empty) {
                                currentDoc      = q2.docs[0].data();
                                resolvedGradeId = q2.docs[0].id;
                            }
                        }
                    }

                    // Step 2: replace or append this grader's entry
                    const qcGrades = [...(currentDoc.qc_grades || [])];
                    const myIdx    = qcGrades.findIndex(e => e.gradedBy === staff.email);
                    if (myIdx >= 0) {
                        qcGrades[myIdx] = sectionData;   // update existing
                    } else {
                        qcGrades.push(sectionData);      // first time grading
                    }

                    // Step 3: calculate new averaged QC score + concatenated notes
                    const avgQcScore  = calcAvgQcScore(qcGrades);  // always a number here
                    const allQcNotes  = concatQcNotes(qcGrades);
                    // Keep qc field updated so existing display code still works
                    const qcSummary   = {
                        score:         avgQcScore,
                        notes:         allQcNotes,
                        gradedBy:      sectionData.gradedBy,
                        gradedByName:  sectionData.gradedByName,
                        gradedAt:      sectionData.gradedAt
                    };

                    // Step 4: write to Firestore
                    if (resolvedGradeId) {
                        await updateDoc(doc(db, 'tutor_grades', resolvedGradeId), {
                            qc_grades: qcGrades,
                            qc:        qcSummary
                        });
                    } else {
                        await addDoc(collection(db, 'tutor_grades'), {
                            tutorId, tutorEmail, month: monthKey,
                            qc_grades: qcGrades,
                            qc:        qcSummary
                        });
                    }

                    // Step 5: update tutor document with new averaged QC + combined score
                    const freshQaSnap = await getDocs(query(collection(db, 'tutor_grades'),
                        where('tutorId', '==', tutorId), where('month', '==', monthKey)));
                    const freshQaDoc  = !freshQaSnap.empty ? freshQaSnap.docs[0].data() : currentDoc;
                    const qaScore     = freshQaDoc.qa?.score ?? null;
                    const qcScore     = avgQcScore;    // we just calculated this
                    const combined    = qaScore !== null
                        ? Math.round((qaScore + qcScore) / 2)
                        : qcScore;
                    await updateDoc(doc(db, 'tutors', tutorId), {
                        performanceScore:  combined,
                        qaScore:           qaScore,
                        qcScore:           qcScore,
                        performanceMonth:  monthKey,
                        qcAdvice:          allQcNotes,
                        qcGradedByName:    sectionData.gradedByName
                    });
                }

                modal.remove();
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
