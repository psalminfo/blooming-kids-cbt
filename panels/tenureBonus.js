// ============================================================
// panels/tenureBonus.js
// Tenure bonus tracking
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

// SUBSECTION 4.1B: Tenure Bonus Panel (MANUAL ONLY)
// ======================================================

// Tenure Bonus constants
const TENURE_BONUS_AMOUNT = 10000; // ₦10,000 per student
const TENURE_BONUS_EFFECTIVE_DATE = new Date('2026-03-01'); // March 1, 2026

let tenureBonusTutors = [];
let tenureBonusLogs = [];
let tenureBonusActiveSubTab = 'all'; // 'all', 'eligible', 'notEligible'

export function calculateTenureDetails(employmentDate) {
    if (!employmentDate) return { years: 0, months: 0, totalMonths: 0, label: 'N/A', isOverOneYear: false, oneYearAnniversary: null, qualifiesForBonus: false };
    try {
        const start = new Date(employmentDate);
        if (isNaN(start.getTime())) return { years: 0, months: 0, totalMonths: 0, label: 'N/A', isOverOneYear: false, oneYearAnniversary: null, qualifiesForBonus: false };
        const now = new Date();
        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        if (now.getDate() < start.getDate()) months--;
        if (months < 0) { years--; months += 12; }
        const totalMonths = years * 12 + months;
        const isOverOneYear = totalMonths >= 12;

        // Calculate the exact 1-year anniversary date
        const oneYearAnniversary = new Date(start);
        oneYearAnniversary.setFullYear(oneYearAnniversary.getFullYear() + 1);

        // Tutor qualifies for bonus ONLY if their 1-year anniversary is ON or AFTER March 1, 2026
        const qualifiesForBonus = oneYearAnniversary >= TENURE_BONUS_EFFECTIVE_DATE;

        let label = '';
        if (years > 0) label += `${years} year${years > 1 ? 's' : ''}`;
        if (months > 0) label += `${years > 0 ? ', ' : ''}${months} month${months > 1 ? 's' : ''}`;
        if (!label) label = 'Less than 1 month';
        return { years, months, totalMonths, label, isOverOneYear, oneYearAnniversary, qualifiesForBonus };
    } catch (e) {
        return { years: 0, months: 0, totalMonths: 0, label: 'N/A', isOverOneYear: false, oneYearAnniversary: null, qualifiesForBonus: false };
    }
}

export async function renderTenureBonusPanel(container) {
    const canApplyBonus = window.userData?.permissions?.actions?.canApplyTenureBonus === true;
    
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <div>
                    <h2 class="text-2xl font-bold text-green-700 flex items-center gap-2">
                        <i class="fas fa-award text-yellow-500"></i> Tenure Bonus
                    </h2>
                    <p class="text-sm text-gray-500 mt-1">
                        Tutors who complete 1 full year receive a one-time ₦10,000 increase per regular student fee (effective from March 1, 2026). Transitioning students are excluded.
                    </p>
                </div>
                <div class="mt-3 md:mt-0">
                    <button id="tb-refresh-btn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium">
                        <i class="fas fa-sync-alt mr-1"></i> Refresh
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <p class="text-xs font-bold text-blue-700 uppercase">Total Tutors</p>
                    <p id="tb-total-count" class="text-2xl font-extrabold text-blue-800">0</p>
                </div>
                <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p class="text-xs font-bold text-green-700 uppercase">Bonus Eligible</p>
                    <p id="tb-eligible-count" class="text-2xl font-extrabold text-green-800">0</p>
                </div>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <p class="text-xs font-bold text-yellow-700 uppercase">Under 1 Year</p>
                    <p id="tb-not-eligible-count" class="text-2xl font-extrabold text-yellow-800">0</p>
                </div>
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                    <p class="text-xs font-bold text-purple-700 uppercase">Already Upgraded</p>
                    <p id="tb-upgraded-count" class="text-2xl font-extrabold text-purple-800">0</p>
                </div>
            </div>

            <!-- Search -->
            <div class="mb-4">
                <input type="text" id="tb-search-input" placeholder="Search by tutor name..." class="w-full md:w-80 p-2 border rounded-lg text-sm">
            </div>

            <!-- Sub-tabs -->
            <div class="flex flex-wrap gap-2 mb-4 border-b pb-3">
                <button data-tb-tab="all" class="tb-sub-tab px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white">
                    All Tutors
                </button>
                <button data-tb-tab="eligible" class="tb-sub-tab px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                    Over 1 Year
                </button>
                <button data-tb-tab="notEligible" class="tb-sub-tab px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                    Under 1 Year
                </button>
                <button data-tb-tab="updates" class="tb-sub-tab px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                    <i class="fas fa-history mr-1"></i> Upgrade Log
                </button>
            </div>

            <!-- Tutor Table -->
            <div id="tb-table-section">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Tutor Name</th>
                                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Email</th>
                                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Employment Date</th>
                                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Tenure</th>
                                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Regular Students</th>
                                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Status</th>
                                <th class="px-4 py-3 text-left text-xs font-medium uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="tb-table-body" class="divide-y">
                            <tr><td colspan="7" class="text-center py-8 text-gray-400">Loading tutors...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Upgrade Log Section (hidden by default) -->
            <div id="tb-log-section" class="hidden">
                <div class="bg-gray-50 rounded-lg p-4 border">
                    <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-history text-blue-500"></i> Upgrade Log</h3>
                    <div id="tb-log-list" class="space-y-2 max-h-96 overflow-y-auto">
                        <p class="text-gray-400 text-sm text-center py-4">Loading upgrade history...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Wire sub-tab clicks
    document.querySelectorAll('.tb-sub-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tbTab;
            tenureBonusActiveSubTab = tab;
            document.querySelectorAll('.tb-sub-tab').forEach(b => {
                b.classList.remove('bg-green-600', 'text-white');
                b.classList.add('bg-gray-200', 'text-gray-700');
            });
            btn.classList.remove('bg-gray-200', 'text-gray-700');
            btn.classList.add('bg-green-600', 'text-white');

            if (tab === 'updates') {
                document.getElementById('tb-table-section').classList.add('hidden');
                document.getElementById('tb-log-section').classList.remove('hidden');
                renderTenureBonusLog();
            } else {
                document.getElementById('tb-table-section').classList.remove('hidden');
                document.getElementById('tb-log-section').classList.add('hidden');
                renderTenureBonusTable();
            }
        });
    });

    // Wire search
    document.getElementById('tb-search-input').addEventListener('input', () => {
        renderTenureBonusTable();
    });

    // Wire refresh
    document.getElementById('tb-refresh-btn').addEventListener('click', () => {
        loadTenureBonusData();
    });

    // Load data
    await loadTenureBonusData();
}

export async function loadTenureBonusData() {
    const tableBody = document.getElementById('tb-table-body');
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading tutors...</td></tr>`;

    try {
        // Fetch all active tutors
        const tutorsSnapshot = await getDocs(query(collection(db, "tutors")));
        const allTutors = tutorsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(t => !t.status || t.status === 'active');

        // Fetch all active students (exclude transitioning, archived, graduated, transferred, summer break)
        const studentsSnapshot = await getDocs(query(collection(db, "students")));
        const allStudents = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(s => (!s.status || s.status === 'active' || s.status === 'approved') && !s.summerBreak && !s.isTransitioning && s.status !== 'archived' && s.status !== 'graduated' && s.status !== 'transferred');

        // Fetch tenure bonus records
        const bonusSnapshot = await getDocs(query(collection(db, "tenure_bonuses")));
        const bonusRecords = {};
        bonusSnapshot.docs.forEach(d => {
            const data = d.data();
            bonusRecords[data.tutorEmail] = { id: d.id, ...data };
        });

        // Fetch upgrade logs
        const logsSnapshot = await getDocs(query(collection(db, "tenure_bonus_logs"), orderBy("timestamp", "desc")));
        tenureBonusLogs = logsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Build tutor data with tenure info
        tenureBonusTutors = allTutors.map(tutor => {
            const tenure = calculateTenureDetails(tutor.employmentDate);
            const tutorStudents = allStudents.filter(s => s.tutorEmail === tutor.email);
            const bonusRecord = bonusRecords[tutor.email];
            return {
                ...tutor,
                tenure,
                students: tutorStudents,
                studentCount: tutorStudents.length,
                bonusApplied: !!bonusRecord,
                bonusRecord: bonusRecord || null,
                bonusDate: bonusRecord ? bonusRecord.appliedAt : null
            };
        });

        // Sort: bonus-eligible first, then over 1 year, then by tenure descending
        tenureBonusTutors.sort((a, b) => {
            const aReady = a.tenure.isOverOneYear && a.tenure.qualifiesForBonus && !a.bonusApplied;
            const bReady = b.tenure.isOverOneYear && b.tenure.qualifiesForBonus && !b.bonusApplied;
            if (aReady && !bReady) return -1;
            if (!aReady && bReady) return 1;
            return b.tenure.totalMonths - a.tenure.totalMonths;
        });

        // Update counters
        const overOneYear = tenureBonusTutors.filter(t => t.tenure.isOverOneYear);
        const underOneYear = tenureBonusTutors.filter(t => !t.tenure.isOverOneYear);
        const upgraded = tenureBonusTutors.filter(t => t.bonusApplied);
        const bonusEligible = tenureBonusTutors.filter(t => t.tenure.isOverOneYear && t.tenure.qualifiesForBonus && !t.bonusApplied);

        const totalEl = document.getElementById('tb-total-count');
        const eligibleEl = document.getElementById('tb-eligible-count');
        const notEligibleEl = document.getElementById('tb-not-eligible-count');
        const upgradedEl = document.getElementById('tb-upgraded-count');

        if (totalEl) totalEl.textContent = tenureBonusTutors.length;
        if (eligibleEl) eligibleEl.textContent = bonusEligible.length;
        if (notEligibleEl) notEligibleEl.textContent = underOneYear.length;
        if (upgradedEl) upgradedEl.textContent = upgraded.length;

        renderTenureBonusTable();

    } catch (err) {
        console.error('Error loading tenure bonus data:', err);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-red-500">Failed to load data: ${escapeHtml(err.message)}</td></tr>`;
    }
}

export function renderTenureBonusTable() {
    const tableBody = document.getElementById('tb-table-body');
    if (!tableBody) return;

    const searchTerm = (document.getElementById('tb-search-input')?.value || '').trim().toLowerCase();

    let data = [...tenureBonusTutors];

    // Filter by sub-tab
    if (tenureBonusActiveSubTab === 'eligible') {
        data = data.filter(t => t.tenure.isOverOneYear);
    } else if (tenureBonusActiveSubTab === 'notEligible') {
        data = data.filter(t => !t.tenure.isOverOneYear);
    }

    // Filter by search
    if (searchTerm) {
        data = data.filter(t => (t.name || '').toLowerCase().includes(searchTerm));
    }

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-400">No tutors found.</td></tr>`;
        return;
    }

    const canApplyBonus = window.userData?.permissions?.actions?.canApplyTenureBonus === true;
    const canManualAdjust = window.userData?.permissions?.actions?.canManualAdjustFee === true;

    tableBody.innerHTML = data.map(t => {
        const empDate = t.employmentDate ? new Date(t.employmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
        const empYear = t.employmentDate ? new Date(t.employmentDate).getFullYear() : '—';
        const anniversaryStr = t.tenure.oneYearAnniversary ? t.tenure.oneYearAnniversary.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

        // Determine status
        let statusBadge = '';
        let rowClass = '';
        let showApplyBtn = false;
        let showManualBtn = false;
        let showViewBtn = false;

        if (t.bonusApplied) {
            const appliedDate = t.bonusRecord?.appliedAt?.toDate ? t.bonusRecord.appliedAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
            statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800"><i class="fas fa-check-circle"></i> Upgraded (${escapeHtml(appliedDate)})</span>`;
            rowClass = 'bg-green-50';
            showViewBtn = true;
        } else if (t.tenure.isOverOneYear && t.tenure.qualifiesForBonus) {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800"><i class="fas fa-clock"></i> Ready for Bonus</span>`;
            rowClass = 'bg-orange-50';
            showApplyBtn = canApplyBonus;
            showManualBtn = canManualAdjust;
        } else if (t.tenure.isOverOneYear && !t.tenure.qualifiesForBonus) {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500"><i class="fas fa-ban"></i> Pre-Policy</span>
                           <span class="block text-xs text-gray-400 mt-1">1yr anniversary: ${escapeHtml(anniversaryStr)} (before Mar 2026)</span>`;
            rowClass = '';
        } else if (!t.tenure.isOverOneYear && t.tenure.qualifiesForBonus) {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800"><i class="fas fa-hourglass-half"></i> Upcoming</span>
                           <span class="block text-xs text-blue-400 mt-1">Qualifies on: ${escapeHtml(anniversaryStr)}</span>`;
            rowClass = '';
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600"><i class="fas fa-hourglass-half"></i> Not Yet Eligible</span>`;
            rowClass = '';
        }

        const tenureColor = t.tenure.isOverOneYear ? 'text-green-700 font-bold' : 'text-gray-600';

        return `
            <tr class="${rowClass}">
                <td class="px-4 py-3 font-medium">${escapeHtml(t.name || 'N/A')}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${escapeHtml(t.email || 'N/A')}</td>
                <td class="px-4 py-3 text-sm">
                    <div>${escapeHtml(empDate)}</div>
                    <div class="text-xs text-gray-400">${escapeHtml(String(empYear))}</div>
                </td>
                <td class="px-4 py-3 text-sm ${tenureColor}">${escapeHtml(t.tenure.label)}</td>
                <td class="px-4 py-3 text-sm text-center">${t.studentCount}</td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                        ${showApplyBtn ? `
                            <button class="tb-apply-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-medium" data-email="${escapeHtml(t.email)}">
                                <i class="fas fa-check mr-1"></i>Apply Bonus
                            </button>
                        ` : ''}
                        ${showManualBtn ? `
                            <button class="tb-manual-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium" data-email="${escapeHtml(t.email)}" data-name="${escapeHtml(t.name)}">
                                <i class="fas fa-edit mr-1"></i>Manual Adjust
                            </button>
                        ` : ''}
                        ${showViewBtn ? `
                            <button class="tb-view-btn bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium" data-email="${escapeHtml(t.email)}">
                                <i class="fas fa-eye mr-1"></i>View
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Wire apply bonus buttons
    document.querySelectorAll('.tb-apply-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const email = e.currentTarget.dataset.email;
            await applyTenureBonus(email);
        });
    });

    // Wire manual adjust buttons
    document.querySelectorAll('.tb-manual-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const email = e.currentTarget.dataset.email;
            const name = e.currentTarget.dataset.name;
            showManualFeeAdjustModal(email, name);
        });
    });

    // Wire view buttons
    document.querySelectorAll('.tb-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const email = e.currentTarget.dataset.email;
            showTenureBonusDetails(email);
        });
    });
}

export async function applyTenureBonus(tutorEmail) {
    const tutor = tenureBonusTutors.find(t => t.email === tutorEmail);
    if (!tutor) return alert('Tutor not found.');
    if (tutor.bonusApplied) return alert('Bonus already applied for this tutor.');

    const now = new Date();
    if (now < TENURE_BONUS_EFFECTIVE_DATE) {
        return alert(`Tenure bonus is only effective from March 1, 2026. Current date is before the effective date.`);
    }

    if (!tutor.tenure.isOverOneYear) {
        return alert('This tutor has not yet completed 1 full year of employment.');
    }

    if (!tutor.tenure.qualifiesForBonus) {
        return alert('This tutor does not qualify. Their 1-year anniversary was before March 1, 2026 (the policy effective date).');
    }

    if (tutor.studentCount === 0) {
        return alert('This tutor currently has no active students. Bonus cannot be applied.');
    }

    const totalBonus = TENURE_BONUS_AMOUNT * tutor.studentCount;
    const confirmed = confirm(
        `Apply Tenure Bonus for ${tutor.name}?\n\n` +
        `• Tenure: ${tutor.tenure.label}\n` +
        `• Regular students (excl. transitioning): ${tutor.studentCount}\n` +
        `• Bonus per student: ₦${TENURE_BONUS_AMOUNT.toLocaleString()}\n` +
        `• Total fee increase: ₦${totalBonus.toLocaleString()}\n\n` +
        `This will add ₦${TENURE_BONUS_AMOUNT.toLocaleString()} to each regular student's fee. Continue?`
    );

    if (!confirmed) return;

    try {
        const batch = writeBatch(db);
        const updatedStudents = [];

        // Update each student's fee
        for (const student of tutor.students) {
            const oldFee = student.studentFee || 0;
            const newFee = oldFee + TENURE_BONUS_AMOUNT;
            const studentRef = doc(db, "students", student.id);
            batch.update(studentRef, { studentFee: newFee });
            updatedStudents.push({
                studentId: student.id,
                studentName: student.studentName || student.name || 'Unknown',
                oldFee: oldFee,
                newFee: newFee
            });
        }

        // Create tenure bonus record
        const bonusRef = doc(collection(db, "tenure_bonuses"));
        batch.set(bonusRef, {
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            employmentDate: tutor.employmentDate || '',
            tenureMonths: tutor.tenure.totalMonths,
            studentCount: tutor.studentCount,
            bonusPerStudent: TENURE_BONUS_AMOUNT,
            totalBonus: totalBonus,
            updatedStudents: updatedStudents,
            appliedAt: Timestamp.now(),
            appliedBy: window.userData?.email || 'Unknown',
            type: 'manual'
        });

        // Create log entry
        const logRef = doc(collection(db, "tenure_bonus_logs"));
        batch.set(logRef, {
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            action: 'bonus_applied',
            details: `₦${TENURE_BONUS_AMOUNT.toLocaleString()} added to ${tutor.studentCount} student(s). Total: ₦${totalBonus.toLocaleString()}`,
            studentDetails: updatedStudents,
            appliedBy: window.userData?.email || 'Unknown',
            appliedByName: window.userData?.name || 'Unknown',
            timestamp: Timestamp.now()
        });

        await batch.commit();

        await logManagementActivity('Tenure Bonus Applied', `Applied ₦${totalBonus.toLocaleString()} tenure bonus for ${tutor.name} (${tutor.studentCount} students)`);

        alert(`✅ Tenure bonus applied successfully for ${tutor.name}!\n\n₦${TENURE_BONUS_AMOUNT.toLocaleString()} added to each of ${tutor.studentCount} regular student fee(s). Transitioning students excluded.`);

        // Invalidate students cache since fees changed
        invalidateCache('students');

        // Reload data
        await loadTenureBonusData();

    } catch (err) {
        console.error('Error applying tenure bonus:', err);
        alert(`Failed to apply tenure bonus: ${err.message}`);
    }
}

export function showManualFeeAdjustModal(tutorEmail, tutorName) {
    const tutor = tenureBonusTutors.find(t => t.email === tutorEmail);
    if (!tutor) return;

    const studentRows = tutor.students.map(s => `
        <tr>
            <td class="px-3 py-2 text-sm">${escapeHtml(s.studentName || s.name || 'Unknown')}</td>
            <td class="px-3 py-2 text-sm">₦${(s.studentFee || 0).toLocaleString()}</td>
            <td class="px-3 py-2">
                <input type="number" class="manual-fee-input w-24 p-1 border rounded text-sm text-right" data-student-id="${s.id}" value="${s.studentFee || 0}" min="0">
            </td>
        </tr>
    `).join('');

    const modalHtml = `
        <div id="tb-manual-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-xl shadow-2xl max-w-lg w-11/12 mx-auto my-8 overflow-hidden">
                <div class="bg-blue-600 text-white p-4">
                    <h3 class="text-lg font-bold"><i class="fas fa-edit mr-2"></i>Manual Fee Adjustment</h3>
                    <p class="text-sm opacity-90">${escapeHtml(tutorName)}</p>
                </div>
                <div class="p-5">
                    ${tutor.students.length === 0 ? `
                        <p class="text-gray-500 text-center py-4">This tutor has no active students.</p>
                    ` : `
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-xs font-medium uppercase">Student</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium uppercase">Current Fee</th>
                                        <th class="px-3 py-2 text-left text-xs font-medium uppercase">New Fee</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y">${studentRows}</tbody>
                            </table>
                        </div>
                        <div class="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                            <i class="fas fa-info-circle mr-1"></i> Edit the "New Fee" column for each student. Only changed fees will be saved.
                        </div>
                    `}
                </div>
                <div class="flex justify-end gap-2 p-4 bg-gray-50 border-t">
                    <button id="tb-manual-cancel" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Cancel</button>
                    ${tutor.students.length > 0 ? `<button id="tb-manual-save" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">Save Changes</button>` : ''}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('tb-manual-cancel').addEventListener('click', () => {
        document.getElementById('tb-manual-modal')?.remove();
    });

    document.getElementById('tb-manual-save')?.addEventListener('click', async () => {
        const inputs = document.querySelectorAll('.manual-fee-input');
        const updates = [];
        inputs.forEach(input => {
            const studentId = input.dataset.studentId;
            const newFee = parseFloat(input.value) || 0;
            const student = tutor.students.find(s => s.id === studentId);
            if (student && newFee !== (student.studentFee || 0)) {
                updates.push({ studentId, studentName: student.studentName || student.name || 'Unknown', oldFee: student.studentFee || 0, newFee });
            }
        });

        if (updates.length === 0) {
            alert('No fee changes detected.');
            return;
        }

        const confirmed = confirm(`Save fee changes for ${updates.length} student(s)?\n\n${updates.map(u => `${u.studentName}: ₦${u.oldFee.toLocaleString()} → ₦${u.newFee.toLocaleString()}`).join('\n')}`);
        if (!confirmed) return;

        try {
            const batch = writeBatch(db);
            updates.forEach(u => {
                batch.update(doc(db, "students", u.studentId), { studentFee: u.newFee });
            });

            const logRef = doc(collection(db, "tenure_bonus_logs"));
            batch.set(logRef, {
                tutorEmail: tutorEmail,
                tutorName: tutorName,
                action: 'manual_adjust',
                details: `Manual fee adjustment for ${updates.length} student(s)`,
                studentDetails: updates,
                appliedBy: window.userData?.email || 'Unknown',
                appliedByName: window.userData?.name || 'Unknown',
                timestamp: Timestamp.now()
            });

            await batch.commit();

            await logManagementActivity('Manual Fee Adjustment', `Adjusted fees for ${updates.length} students under ${tutorName}`);

            invalidateCache('students');

            alert(`✅ Fee changes saved for ${updates.length} student(s).`);
            document.getElementById('tb-manual-modal')?.remove();
            await loadTenureBonusData();
        } catch (err) {
            console.error('Error saving manual fee adjustment:', err);
            alert(`Failed to save: ${err.message}`);
        }
    });
}

export function showTenureBonusDetails(tutorEmail) {
    const tutor = tenureBonusTutors.find(t => t.email === tutorEmail);
    if (!tutor || !tutor.bonusRecord) return;

    const record = tutor.bonusRecord;
    const appliedDate = record.appliedAt?.toDate ? record.appliedAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';

    const studentDetailsHtml = (record.updatedStudents || []).map(s => `
        <tr>
            <td class="px-3 py-2 text-sm">${escapeHtml(s.studentName)}</td>
            <td class="px-3 py-2 text-sm">₦${(s.oldFee || 0).toLocaleString()}</td>
            <td class="px-3 py-2 text-sm font-bold text-green-700">₦${(s.newFee || 0).toLocaleString()}</td>
            <td class="px-3 py-2 text-sm text-green-600">+₦${TENURE_BONUS_AMOUNT.toLocaleString()}</td>
        </tr>
    `).join('');

    const detailHtml = `
        <div id="tb-detail-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div class="bg-white rounded-xl shadow-2xl max-w-lg w-11/12 mx-auto my-8 overflow-hidden">
                <div class="bg-green-600 text-white p-4">
                    <h3 class="text-lg font-bold"><i class="fas fa-award mr-2"></i>Tenure Bonus Details</h3>
                    <p class="text-sm opacity-90">${escapeHtml(tutor.name)}</p>
                </div>
                <div class="p-5 space-y-3">
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div class="bg-gray-50 p-3 rounded-lg"><span class="font-bold block text-gray-500 text-xs uppercase">Tenure</span>${escapeHtml(tutor.tenure.label)}</div>
                        <div class="bg-gray-50 p-3 rounded-lg"><span class="font-bold block text-gray-500 text-xs uppercase">Applied On</span>${escapeHtml(appliedDate)}</div>
                        <div class="bg-gray-50 p-3 rounded-lg"><span class="font-bold block text-gray-500 text-xs uppercase">Students</span>${record.studentCount || 0}</div>
                        <div class="bg-gray-50 p-3 rounded-lg"><span class="font-bold block text-gray-500 text-xs uppercase">Total Bonus</span>₦${(record.totalBonus || 0).toLocaleString()}</div>
                        <div class="bg-gray-50 p-3 rounded-lg col-span-2"><span class="font-bold block text-gray-500 text-xs uppercase">Applied By</span>${escapeHtml(record.appliedBy || 'Unknown')}</div>
                    </div>
                    ${studentDetailsHtml ? `
                        <h4 class="font-bold text-gray-700 mt-4 mb-2">Student Fee Changes</h4>
                        <div class="overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-200 text-sm">
                                <thead class="bg-gray-50"><tr>
                                    <th class="px-3 py-2 text-left text-xs font-medium uppercase">Student</th>
                                    <th class="px-3 py-2 text-left text-xs font-medium uppercase">Old Fee</th>
                                    <th class="px-3 py-2 text-left text-xs font-medium uppercase">New Fee</th>
                                    <th class="px-3 py-2 text-left text-xs font-medium uppercase">Increase</th>
                                </tr></thead>
                                <tbody class="divide-y">${studentDetailsHtml}</tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>
                <div class="flex justify-end p-4 bg-gray-50 border-t">
                    <button id="tb-detail-close" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', detailHtml);
    document.getElementById('tb-detail-close').addEventListener('click', () => {
        document.getElementById('tb-detail-modal')?.remove();
    });
}

export function renderTenureBonusLog() {
    const logList = document.getElementById('tb-log-list');
    if (!logList) return;

    if (tenureBonusLogs.length === 0) {
        logList.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No upgrade history yet.</p>';
        return;
    }

    logList.innerHTML = tenureBonusLogs.map(log => {
        const timestamp = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

        let iconClass = 'fas fa-check-circle text-green-500';
        let bgClass = 'bg-green-50 border-green-200';
        if (log.action === 'manual_adjust') {
            iconClass = 'fas fa-edit text-blue-500';
            bgClass = 'bg-blue-50 border-blue-200';
        } else if (log.action === 'bonus_applied') {
            iconClass = 'fas fa-award text-green-500';
            bgClass = 'bg-green-50 border-green-200';
        }

        const studentSummary = (log.studentDetails || []).map(s =>
            `<span class="inline-block bg-white border rounded px-2 py-0.5 text-xs mr-1 mb-1">${escapeHtml(s.studentName)}: ₦${(s.oldFee || 0).toLocaleString()} → ₦${(s.newFee || 0).toLocaleString()}</span>`
        ).join('');

        return `
            <div class="${bgClass} border rounded-lg p-3">
                <div class="flex items-start gap-3">
                    <i class="${iconClass} text-lg mt-0.5"></i>
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-2 mb-1">
                            <span class="font-bold text-sm">${escapeHtml(log.tutorName || 'Unknown')}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full bg-white border font-medium">${escapeHtml(log.action === 'manual_adjust' ? 'Manual Adjust' : 'Bonus Applied')}</span>
                        </div>
                        <p class="text-sm text-gray-700">${escapeHtml(log.details || '')}</p>
                        ${studentSummary ? `<div class="mt-2 flex flex-wrap">${studentSummary}</div>` : ''}
                        <div class="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                            <span><i class="fas fa-clock mr-1"></i>${escapeHtml(timestamp)}</span>
                            <span><i class="fas fa-user mr-1"></i>${escapeHtml(log.appliedByName || log.appliedBy || 'Unknown')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ======================================================
