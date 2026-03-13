// ============================================================
// panels/academicFollowUp.js
// Academic follow-up tally system
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

// SECTION 8.6: ACADEMIC FOLLOW-UP — TALLY SYSTEM
// ======================================================
// Reads:  daily_topics  →  { studentId, tutorEmail, topics, createdAt }
//         homework_assignments → { tutorEmail, studentName, title, assignedAt / createdAt }
// ======================================================

export async function renderAcademicFollowUpPanel(container) {
    container.innerHTML = `
    <div class="space-y-4">
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between flex-wrap gap-3">
            <div>
                <h2 class="text-xl font-bold text-gray-800">📊 Academic Follow-Up</h2>
                <p class="text-sm text-gray-500">Topic entries & homework per tutor, month by month</p>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
                <div class="relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input type="text" id="afu-search" placeholder="Search tutor name..." 
                           class="pl-9 pr-4 py-2 border-2 border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-sm w-56">
                </div>
                <button id="afu-refresh-btn" class="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1 text-sm font-medium">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
                <div id="afu-clock" class="text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    ${formatLagosDatetime()}
                </div>
            </div>
        </div>

        <div id="afu-loading" class="text-center py-12">
            <div class="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p class="text-gray-500">Loading academic data…</p>
        </div>
        <div id="afu-list" class="space-y-4 hidden"></div>
    </div>`;

    // Tick clock
    setInterval(() => { const el = document.getElementById('afu-clock'); if (el) el.textContent = formatLagosDatetime(); }, 1000);

    try {
        const [tutorsSnap, topicsSnap, hwSnap] = await Promise.all([
            getDocs(query(collection(db, 'tutors'), orderBy('name'))),
            getDocs(collection(db, 'daily_topics')),
            getDocs(collection(db, 'homework_assignments'))
        ]);

        const tutors = tutorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Build per-tutor topic data keyed by month
        const topicsByTutor = {}; // tutorEmail → { 'YYYY-MM' → [{ date, topics, studentId }] }
        topicsSnap.docs.forEach(d => {
            const data = d.data();
            const email = data.tutorEmail || '';
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || '');
            if (isNaN(date.getTime())) return;
            const mk = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            if (!topicsByTutor[email]) topicsByTutor[email] = {};
            if (!topicsByTutor[email][mk]) topicsByTutor[email][mk] = [];
            topicsByTutor[email][mk].push({ date, topics: data.topics || '', studentId: data.studentId || '' });
        });

        // Build per-tutor homework data keyed by month
        const hwByTutor = {}; // tutorEmail → { 'YYYY-MM' → [{ date, title, studentName }] }
        hwSnap.docs.forEach(d => {
            const data = d.data();
            const email = data.tutorEmail || '';
            const raw = data.assignedAt || data.createdAt || data.uploadedAt;
            const date = raw?.toDate ? raw.toDate() : new Date(raw || '');
            if (isNaN(date.getTime())) return;
            const mk = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            if (!hwByTutor[email]) hwByTutor[email] = {};
            if (!hwByTutor[email][mk]) hwByTutor[email][mk] = [];
            hwByTutor[email][mk].push({ date, title: data.title || 'Homework', studentName: data.studentName || '' });
        });

        const listEl = document.getElementById('afu-list');

        tutors.forEach((tutor, idx) => {
            const tutorTopics = topicsByTutor[tutor.email] || {};
            const tutorHw = hwByTutor[tutor.email] || {};

            // Collect all months
            const allMonths = new Set([...Object.keys(tutorTopics), ...Object.keys(tutorHw)]);
            const sortedMonths = Array.from(allMonths).sort((a, b) => b.localeCompare(a)); // newest first

            const card = document.createElement('div');
            card.className = 'bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden';

            const totalTopics = Object.values(tutorTopics).reduce((s, arr) => s + arr.length, 0);
            const totalHw = Object.values(tutorHw).reduce((s, arr) => s + arr.length, 0);

            card.innerHTML = `
            <!-- Tutor header accordion -->
            <button class="w-full text-left p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors afu-header" data-idx="${idx}">
                <div class="flex-1">
                    <div class="font-bold text-gray-800">${escapeHtml(tutor.name)}</div>
                    <div class="text-xs text-gray-400">${escapeHtml(tutor.email || '')}</div>
                </div>
                <div class="flex gap-4 text-center flex-shrink-0">
                    <div class="bg-blue-50 rounded-xl px-3 py-1.5">
                        <div class="text-xl font-black text-blue-600">${totalTopics}</div>
                        <div class="text-xs text-blue-500">Topics</div>
                    </div>
                    <div class="bg-green-50 rounded-xl px-3 py-1.5">
                        <div class="text-xl font-black text-green-600">${totalHw}</div>
                        <div class="text-xs text-green-500">H/W</div>
                    </div>
                </div>
                <i class="fas fa-chevron-down text-gray-400 transition-transform flex-shrink-0 afu-arrow"></i>
            </button>

            <!-- Months accordion body -->
            <div class="afu-body hidden border-t border-gray-100">
                ${sortedMonths.length === 0 ? `
                    <div class="p-6 text-center text-gray-400 text-sm">No academic activity recorded yet.</div>
                ` : sortedMonths.map(mk => {
                    const topics = tutorTopics[mk] || [];
                    const hw = tutorHw[mk] || [];
                    const [y, m] = mk.split('-');
                    const label = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleString('en-NG', { month:'long', year:'numeric' });

                    // Build tally groups by day
                    const dayMap = {}; // dateString → { topics:[], hw:[] }
                    topics.forEach(t => {
                        const ds = t.date.toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
                        if (!dayMap[ds]) dayMap[ds] = { topics:[], hw:[], rawDate: t.date };
                        dayMap[ds].topics.push(t.topics);
                    });
                    hw.forEach(h => {
                        const ds = h.date.toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' });
                        if (!dayMap[ds]) dayMap[ds] = { topics:[], hw:[], rawDate: h.date };
                        dayMap[ds].hw.push(h.title + (h.studentName ? ` (${h.studentName})` : ''));
                    });

                    const sortedDays = Object.entries(dayMap).sort((a, b) => b[1].rawDate - a[1].rawDate);

                    // Abacus/tally representation
                    function tallyDots(count, color) {
                        const full = Math.floor(count / 5);
                        const remainder = count % 5;
                        let html = '';
                        for (let i = 0; i < full; i++) html += `<span class="inline-flex gap-0.5">${'<span class="w-2 h-2 rounded-full inline-block ' + color + '"></span>'.repeat(4)}<span class="w-0.5 h-3 rounded inline-block ${color} opacity-60 mx-0.5" style="vertical-align:middle"></span></span>`;
                        for (let i = 0; i < remainder; i++) html += `<span class="w-2 h-2 rounded-full inline-block ${color}"></span>`;
                        return html || '<span class="text-gray-300">—</span>';
                    }

                    return `
                    <details class="border-b border-gray-100 last:border-0">
                        <summary class="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 list-none">
                            <div class="flex-1">
                                <span class="font-semibold text-sm text-gray-700">${label}</span>
                            </div>
                            <!-- Tally visual for the month -->
                            <div class="flex items-center gap-4 flex-shrink-0">
                                <div class="flex items-center gap-1.5">
                                    <span class="text-xs text-blue-500 font-bold">${topics.length} T</span>
                                    <div class="flex flex-wrap gap-0.5 max-w-32">${tallyDots(topics.length, 'bg-blue-400')}</div>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <span class="text-xs text-green-500 font-bold">${hw.length} H</span>
                                    <div class="flex flex-wrap gap-0.5 max-w-32">${tallyDots(hw.length, 'bg-green-400')}</div>
                                </div>
                            </div>
                            <i class="fas fa-chevron-right text-gray-400 text-xs"></i>
                        </summary>
                        <!-- Daily breakdown -->
                        <div class="px-4 pb-3 space-y-2">
                            ${sortedDays.map(([ds, day]) => `
                            <div class="bg-gray-50 rounded-xl p-3">
                                <div class="text-xs font-bold text-gray-500 mb-1">${ds}</div>
                                <div class="flex flex-wrap gap-2">
                                    ${day.topics.map(t => `<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">📝 ${escapeHtml(t.substring(0,40))}</span>`).join('')}
                                    ${day.hw.map(h => `<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">📚 ${escapeHtml(h.substring(0,40))}</span>`).join('')}
                                </div>
                            </div>
                            `).join('')}
                        </div>
                    </details>
                    `;
                }).join('')}
            </div>
            `;

            listEl.appendChild(card);
        });

        // Accordion toggle
        listEl.querySelectorAll('.afu-header').forEach(btn => {
            btn.addEventListener('click', () => {
                const body = btn.nextElementSibling;
                const arrow = btn.querySelector('.afu-arrow');
                const isOpen = !body.classList.contains('hidden');
                body.classList.toggle('hidden', isOpen);
                arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
        });

        // Name search filter
        const afuSearchInput = document.getElementById('afu-search');
        if (afuSearchInput) {
            afuSearchInput.addEventListener('input', () => {
                const term = afuSearchInput.value.toLowerCase().trim();
                listEl.querySelectorAll('.afu-header').forEach(btn => {
                    const card = btn.closest('.bg-white.rounded-2xl');
                    if (!card) return;
                    const name = btn.querySelector('.font-bold.text-gray-800')?.textContent?.toLowerCase() || '';
                    const email = btn.querySelector('.text-xs.text-gray-400')?.textContent?.toLowerCase() || '';
                    card.style.display = (!term || name.includes(term) || email.includes(term)) ? '' : 'none';
                });
            });
        }

        // Refresh button
        const afuRefreshBtn = document.getElementById('afu-refresh-btn');
        if (afuRefreshBtn) {
            afuRefreshBtn.addEventListener('click', () => {
                invalidateTabCache('navAcademicFollowUp');
                renderAcademicFollowUpPanel(container);
            });
        }

        document.getElementById('afu-loading').classList.add('hidden');
        listEl.classList.remove('hidden');

    } catch (err) {
        console.error('Academic Follow-Up error:', err);
        document.getElementById('afu-loading').innerHTML = `<p class="text-red-500">❌ Error: ${err.message}</p>`;
    }
}

// Shared HTML escape helper (management scope)

// ======================================================
