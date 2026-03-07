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
    </div>
    `;

    // Start Lagos clock
    const clockEl = document.getElementById('lagos-clock');
    function tickClock() { if (clockEl) clockEl.textContent = formatLagosDatetime(); }
    tickClock();
    const clockInterval = setInterval(tickClock, 1000);
    // Cleanup on tab change
    window._masterPortalClockInterval = clockInterval;

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

                if (gradeId) {
                    await updateDoc(doc(db, 'tutor_grades', gradeId), { [type]: sectionData });
                } else {
                    const newDoc = {
                        tutorId,
                        tutorEmail,
                        month: monthKey,
                        [type]: sectionData
                    };
                    await addDoc(collection(db, 'tutor_grades'), newDoc);
                }

                // Re-fetch the grade doc to get latest qa+qc data
                let freshGrade = {};
                if (gradeId) {
                    const freshSnap = await getDoc(doc(db, 'tutor_grades', gradeId));
                    if (freshSnap.exists()) freshGrade = freshSnap.data();
                } else {
                    const freshQuery = await getDocs(
                        query(collection(db, 'tutor_grades'),
                              where('tutorId', '==', tutorId),
                              where('month', '==', monthKey))
                    );
                    if (!freshQuery.empty) freshGrade = freshQuery.docs[0].data();
                    else {
                        const freshQuery2 = await getDocs(
                            query(collection(db, 'tutor_grades'),
                                  where('tutorEmail', '==', tutorEmail),
                                  where('month', '==', monthKey))
                        );
                        if (!freshQuery2.empty) freshGrade = freshQuery2.docs[0].data();
                    }
                }

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
                        qaAdvice: type === 'qa' ? notes : (freshGrade.qa?.notes || ''),
                        qcAdvice: type === 'qc' ? notes : (freshGrade.qc?.notes || ''),
                        qaGradedByName: type === 'qa' ? sectionData.gradedByName : (freshGrade.qa?.gradedByName || ''),
                        qcGradedByName: type === 'qc' ? sectionData.gradedByName : (freshGrade.qc?.gradedByName || '')
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
