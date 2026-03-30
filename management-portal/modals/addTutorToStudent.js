// ============================================================
// modals/addTutorToStudent.js
// Add a new tutor (and subject) to an existing student.
// Follows the same permission pattern as showAssignStudentModal.
// ============================================================

import { db } from '../core/firebase.js';
import { collection, doc, getDoc, updateDoc, addDoc, Timestamp } from '../core/firebase.js';
import { escapeHtml, buildTimeOptions, formatTimeTo12h, logStudentEvent } from '../core/utils.js';
import { sessionCache, invalidateCache } from '../core/cache.js';

// ── Permission guard — identical to Assign Student ──────────────────────────
// No tab/action-level gate: any management user who can see the directory
// can use this modal, matching the behaviour of "Assign New Student".
// If you later add a canAssignStudents permission flag, check it here:
//   if (!window.userData?.permissions?.actions?.canAssignStudents) { alert('No permission'); return; }

// ── Category options ─────────────────────────────────────────────────────────
const CATEGORIES = ['Academic', 'Extra-Curricular', 'Test Prep', 'Other'];

// ── Build a searchable tutor dropdown (mirrors assignStudent.js pattern) ─────
function buildTutorDropdown(activeTutors) {
    const opts = activeTutors.map(t =>
        `<div class="ats-tutor-opt px-3 py-2 hover:bg-teal-50 cursor-pointer text-sm border-b last:border-0"
             data-email="${escapeHtml(t.email)}"
             data-name="${escapeHtml(t.name || t.email)}"
             data-label="${escapeHtml((t.name || t.email).toLowerCase())} ${escapeHtml(t.email.toLowerCase())}">
            <span class="font-medium text-gray-800">${escapeHtml(t.name || t.email)}</span>
            <span class="text-gray-400 text-xs ml-2">${escapeHtml(t.email)}</span>
         </div>`
    ).join('');
    return `
    <div class="relative">
        <input type="text" id="ats-tutor-search" autocomplete="off"
               placeholder="Type tutor name or email…"
               class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm
                      focus:ring-2 focus:ring-teal-400 focus:border-teal-400">
        <input type="hidden" id="ats-tutor-email" value="">
        <input type="hidden" id="ats-tutor-name"  value="">
        <div id="ats-tutor-dropdown"
             class="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg
                    max-h-48 overflow-y-auto hidden top-full left-0 mt-0.5">
            ${opts}
        </div>
    </div>
    <p id="ats-tutor-label" class="text-xs text-teal-700 mt-1 hidden"></p>`;
}

// ── Wire up the tutor search dropdown ────────────────────────────────────────
function initTutorDropdown() {
    const searchEl    = document.getElementById('ats-tutor-search');
    const emailEl     = document.getElementById('ats-tutor-email');
    const nameEl      = document.getElementById('ats-tutor-name');
    const dropdownEl  = document.getElementById('ats-tutor-dropdown');
    const labelEl     = document.getElementById('ats-tutor-label');
    const allOpts     = Array.from(dropdownEl.querySelectorAll('.ats-tutor-opt'));

    searchEl.addEventListener('input', () => {
        const term = searchEl.value.toLowerCase().trim();
        let visible = 0;
        allOpts.forEach(opt => {
            const match = !term || opt.dataset.label.includes(term);
            opt.classList.toggle('hidden', !match);
            if (match) visible++;
        });
        dropdownEl.classList.toggle('hidden', visible === 0);
    });

    searchEl.addEventListener('focus', () => {
        allOpts.forEach(opt => opt.classList.remove('hidden'));
        dropdownEl.classList.remove('hidden');
    });

    allOpts.forEach(opt => {
        opt.addEventListener('mousedown', (e) => {
            e.preventDefault();
            emailEl.value  = opt.dataset.email;
            nameEl.value   = opt.dataset.name;
            searchEl.value = opt.dataset.name;
            labelEl.textContent = `✓ ${opt.dataset.name} (${opt.dataset.email})`;
            labelEl.classList.remove('hidden');
            dropdownEl.classList.add('hidden');
        });
    });

    document.addEventListener('click', (e) => {
        if (!dropdownEl.contains(e.target) && e.target !== searchEl) {
            dropdownEl.classList.add('hidden');
        }
    }, { once: false });
}

// ── Build "current assignments" summary HTML ─────────────────────────────────
function buildCurrentAssignmentsSummary(student) {
    const slots = student.subjectAssignments || [];

    if (slots.length === 0) {
        // Legacy student — only primary tutor on root doc
        if (student.tutorEmail) {
            return `<div class="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-sm">
                <span class="font-medium text-gray-700">${escapeHtml(student.tutorName || student.tutorEmail)}</span>
                <span class="text-xs text-gray-400">Primary Tutor (legacy)</span>
                <span class="px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Active</span>
            </div>`;
        }
        return `<p class="text-xs text-gray-400 italic">No assignments recorded yet.</p>`;
    }

    return slots.map(sa => {
        const isBreak   = sa.onBreak || sa.status === 'break';
        const isInactive = sa.status === 'inactive';
        const statusBadge = isBreak
            ? `<span class="px-1.5 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">On Break</span>`
            : isInactive
            ? `<span class="px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Inactive</span>`
            : `<span class="px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Active</span>`;

        const catColor = {
            Academic: 'green', 'Extra-Curricular': 'blue', 'Test Prep': 'purple', Other: 'gray'
        }[sa.category] || 'gray';

        return `
        <div class="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded text-sm gap-2">
            <div class="min-w-0">
                <span class="font-medium text-gray-700">${escapeHtml(sa.tutorName || sa.tutorEmail)}</span>
                <span class="text-xs text-gray-400 ml-1">· ${escapeHtml(sa.subject || sa.category)}</span>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
                <span class="px-1.5 py-0.5 rounded-full text-xs bg-${catColor}-100 text-${catColor}-700">${escapeHtml(sa.category)}</span>
                ${statusBadge}
            </div>
        </div>`;
    }).join('');
}

// ── Main export ───────────────────────────────────────────────────────────────
window.showAddTutorToStudentModal = async function () {
    // Load tutors from cache or Firestore
    if (!sessionCache.tutors || sessionCache.tutors.length === 0) {
        try {
            const { getDocs, query, orderBy } = await import('../core/firebase.js');
            const snap = await getDocs(query(collection(db, 'tutors'), orderBy('name')));
            sessionCache.tutors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            alert('Could not load tutors. Please refresh and try again.');
            return;
        }
    }

    const students = (sessionCache.students || [])
        .filter(s => {
            const st = (s.status || '').toLowerCase();
            return !st.includes('archived') && !st.includes('deleted');
        })
        .sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));

    const activeTutors = (sessionCache.tutors || [])
        .filter(t => !t.status || t.status === 'active')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (students.length === 0) {
        alert('No students found. Please refresh the directory and try again.');
        return;
    }
    if (activeTutors.length === 0) {
        alert('No active tutors found. Please refresh and try again.');
        return;
    }

    // Remove any existing instance
    document.getElementById('ats-modal')?.remove();

    // ── Student options for the select ──────────────────────────────────────
    const studentOpts = students.map(s =>
        `<option value="${s.id}">${escapeHtml(s.studentName)}${s.grade ? ` (${escapeHtml(s.grade)})` : ''}</option>`
    ).join('');

    // ── Category options ─────────────────────────────────────────────────────
    const categoryOpts = CATEGORIES.map(c =>
        `<option value="${c}">${c}</option>`
    ).join('');

    // ── Modal HTML ────────────────────────────────────────────────────────────
    const modalHtml = `
    <div id="ats-modal"
         class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[9999] p-4">
        <div class="relative bg-white w-full max-w-xl rounded-lg shadow-xl"
             style="max-height:92vh; overflow-y:auto;">

            <!-- Header -->
            <div class="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
                <div>
                    <h3 class="text-xl font-bold text-gray-800">Add Tutor to Student</h3>
                    <p class="text-xs text-gray-500 mt-0.5">Assign a new tutor and subject to an existing student</p>
                </div>
                <button id="ats-close"
                        class="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none">&times;</button>
            </div>

            <form id="ats-form" class="p-5 space-y-4">

                <!-- ── Step 1: Select Student ── -->
                <div class="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <h4 class="text-sm font-semibold text-teal-700 mb-3">Step 1 — Select Student</h4>

                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Student <span class="text-red-500">*</span>
                        </label>
                        <select id="ats-student-select"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm
                                       focus:ring-2 focus:ring-teal-400 focus:border-teal-400">
                            <option value="">— Select a student —</option>
                            ${studentOpts}
                        </select>
                    </div>

                    <!-- Current assignments summary — shown after selecting student -->
                    <div id="ats-student-info" class="hidden">
                        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Current Tutor Assignments
                        </p>
                        <div id="ats-current-assignments" class="space-y-1.5 text-sm"></div>
                    </div>
                </div>

                <!-- ── Step 2: New Tutor Assignment ── -->
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 class="text-sm font-semibold text-gray-700 mb-3">Step 2 — New Tutor Assignment</h4>

                    <!-- Category -->
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Category <span class="text-red-500">*</span>
                        </label>
                        <select id="ats-category"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm
                                       focus:ring-2 focus:ring-teal-400 focus:border-teal-400">
                            ${categoryOpts}
                        </select>
                    </div>

                    <!-- Tutor -->
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Tutor <span class="text-red-500">*</span>
                        </label>
                        ${buildTutorDropdown(activeTutors)}
                    </div>

                    <!-- Subject -->
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Subject / Activity <span class="text-red-500">*</span>
                        </label>
                        <input type="text" id="ats-subject"
                               placeholder="e.g. Mathematics, Piano, SAT Verbal"
                               class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm
                                      focus:ring-2 focus:ring-teal-400 focus:border-teal-400">
                    </div>

                    <!-- Tutor Fee -->
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Tutor Fee (₦) <span class="text-red-500">*</span>
                        </label>
                        <input type="number" id="ats-fee" min="0" value="0"
                               placeholder="e.g. 50000"
                               class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm
                                      focus:ring-2 focus:ring-teal-400 focus:border-teal-400">
                    </div>

                    <!-- Days -->
                    <div class="mb-3">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                            Days / Week <span class="text-red-500">*</span>
                        </label>
                        <input type="text" id="ats-days"
                               placeholder="e.g. Monday, Wednesday, Friday"
                               class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm
                                      focus:ring-2 focus:ring-teal-400 focus:border-teal-400">
                    </div>

                    <!-- Start & End Time -->
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                Start Time <span class="text-red-500">*</span>
                            </label>
                            <select id="ats-start-time"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm
                                           focus:ring-2 focus:ring-teal-400 focus:border-teal-400">
                                ${buildTimeOptions()}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                End Time <span class="text-red-500">*</span>
                            </label>
                            <select id="ats-end-time"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm
                                           focus:ring-2 focus:ring-teal-400 focus:border-teal-400">
                                ${buildTimeOptions()}
                            </select>
                        </div>
                    </div>

                    <!-- Duplicate-assignment warning (hidden by default) -->
                    <div id="ats-duplicate-warning"
                         class="hidden bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
                        ⚠️ This tutor is already assigned to this student for the selected category.
                        Please choose a different tutor or category.
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex justify-end gap-3 pt-2 border-t">
                    <button type="button" id="ats-cancel"
                            class="px-5 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm">
                        Cancel
                    </button>
                    <button type="submit" id="ats-submit"
                            class="px-5 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 text-sm font-medium">
                        Add Tutor
                    </button>
                </div>

            </form>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // ── Wire up close buttons ─────────────────────────────────────────────────
    const closeModal = () => document.getElementById('ats-modal')?.remove();
    document.getElementById('ats-close').addEventListener('click', closeModal);
    document.getElementById('ats-cancel').addEventListener('click', closeModal);

    // ── Wire up tutor search dropdown ─────────────────────────────────────────
    initTutorDropdown();

    // ── Student select → show current assignments ─────────────────────────────
    const studentSelect   = document.getElementById('ats-student-select');
    const studentInfoDiv  = document.getElementById('ats-student-info');
    const assignmentsList = document.getElementById('ats-current-assignments');

    studentSelect.addEventListener('change', () => {
        const sid = studentSelect.value;
        if (!sid) {
            studentInfoDiv.classList.add('hidden');
            return;
        }
        const student = students.find(s => s.id === sid);
        if (!student) { studentInfoDiv.classList.add('hidden'); return; }

        assignmentsList.innerHTML = buildCurrentAssignmentsSummary(student);
        studentInfoDiv.classList.remove('hidden');
    });

    // ── Duplicate check on tutor/category change ──────────────────────────────
    function checkDuplicate() {
        const sid       = studentSelect.value;
        const tutorEmail = document.getElementById('ats-tutor-email').value;
        const category  = document.getElementById('ats-category').value;
        const warning   = document.getElementById('ats-duplicate-warning');
        const submitBtn = document.getElementById('ats-submit');

        if (!sid || !tutorEmail) { warning.classList.add('hidden'); submitBtn.disabled = false; return; }

        const student = students.find(s => s.id === sid);
        const slots   = student?.subjectAssignments || [];
        const isDup   = slots.some(sa =>
            sa.tutorEmail === tutorEmail && sa.category === category
        );

        warning.classList.toggle('hidden', !isDup);
        submitBtn.disabled = isDup;
    }

    document.getElementById('ats-category').addEventListener('change', checkDuplicate);
    // Tutor dropdown fires a custom change after selection — re-check after a tick
    document.getElementById('ats-tutor-search').addEventListener('input', () => setTimeout(checkDuplicate, 50));

    // ── Form submit ───────────────────────────────────────────────────────────
    document.getElementById('ats-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('ats-submit');
        const studentId  = studentSelect.value;
        const tutorEmail = document.getElementById('ats-tutor-email').value;
        const tutorName  = document.getElementById('ats-tutor-name').value;
        const category   = document.getElementById('ats-category').value;
        const subject    = document.getElementById('ats-subject').value.trim();
        const fee        = Number(document.getElementById('ats-fee').value) || 0;
        const days       = document.getElementById('ats-days').value.trim();
        const startTime  = document.getElementById('ats-start-time').value;
        const endTime    = document.getElementById('ats-end-time').value;

        // ── Validation ───────────────────────────────────────────────────────
        if (!studentId) {
            alert('Please select a student.'); return;
        }
        if (!tutorEmail) {
            alert('Please select a tutor.'); return;
        }
        if (!subject) {
            alert('Please enter a subject or activity.'); return;
        }
        if (!days) {
            alert('Please enter the days for this tutor.'); return;
        }
        if (!startTime || !endTime) {
            alert('Please select start and end times.'); return;
        }
        if (startTime >= endTime) {
            alert('End time must be after start time.'); return;
        }

        submitBtn.disabled  = true;
        submitBtn.textContent = 'Saving…';

        try {
            // ── Fetch latest student doc from Firestore ───────────────────────
            const studentSnap = await getDoc(doc(db, 'students', studentId));
            if (!studentSnap.exists()) {
                alert('Student not found. Please refresh and try again.');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Tutor';
                return;
            }
            const studentData = studentSnap.data();

            // ── Final duplicate check against live Firestore data ─────────────
            const currentSlots = studentData.subjectAssignments || [];
            const isDuplicate  = currentSlots.some(sa =>
                sa.tutorEmail === tutorEmail && sa.category === category
            );
            if (isDuplicate) {
                alert(`This tutor is already assigned to ${studentData.studentName} for "${category}". Please choose a different tutor or category.`);
                submitBtn.disabled  = false;
                submitBtn.textContent = 'Add Tutor';
                return;
            }

            // ── Migrate legacy slots: add status fields if missing ────────────
            const migratedSlots = currentSlots.map(sa => ({
                ...sa,
                status:         sa.status         ?? 'active',
                onBreak:        sa.onBreak         ?? false,
                breakReason:    sa.breakReason     ?? '',
                breakStartDate: sa.breakStartDate  ?? null,
                breakEndDate:   sa.breakEndDate    ?? null,
            }));

            // ── Build schedule entries ────────────────────────────────────────
            const DAYS_LIST = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
            const daysList  = days
                .split(/,|\band\b/i)
                .map(d => d.trim())
                .filter(d => DAYS_LIST.includes(d));
            const scheduleEntries = daysList.length > 0
                ? daysList.map(day => ({ day, start: startTime, end: endTime }))
                : [{ day: days, start: startTime, end: endTime }];

            const academicTime = `${formatTimeTo12h(startTime)} - ${formatTimeTo12h(endTime)}`;

            // ── New slot ──────────────────────────────────────────────────────
            const newSlot = {
                category,
                tutorEmail,
                tutorName,
                subject,
                tutorFee:       fee,
                days,
                academicTime,
                schedule:       scheduleEntries,
                assignedDate:   new Date().toISOString(),
                assignedBy:     window.userData?.email || 'management',
                status:         'active',
                onBreak:        false,
                breakReason:    '',
                breakStartDate: null,
                breakEndDate:   null,
            };

            const updatedSlots = [...migratedSlots, newSlot];

            // ── Write to Firestore (only subjectAssignments — root doc untouched) ──
            await updateDoc(doc(db, 'students', studentId), {
                subjectAssignments: updatedSlots,
                updatedAt: new Date().toISOString(),
                updatedBy: window.userData?.name || window.userData?.email || 'management'
            });

            // ── Notify new tutor ──────────────────────────────────────────────
            await addDoc(collection(db, 'tutor_notifications'), {
                tutorEmail,
                type:           'new_student',
                title:          `New Student Assigned — ${category}`,
                message:        `${studentData.studentName}${studentData.grade ? ` (${studentData.grade})` : ''} has been assigned to you for ${subject}. Schedule: ${days} at ${academicTime}.`,
                studentName:    studentData.studentName,
                studentId,
                grade:          studentData.grade     || '',
                category,
                subject,
                days,
                academicTime,
                parentName:     studentData.parentName  || '',
                parentPhone:    studentData.parentPhone || '',
                parentEmail:    studentData.parentEmail || '',
                tutorFee:       fee,
                senderDisplay:  'Management',
                read:           false,
                createdAt:      Timestamp.now()
            });

            // ── Log student event ─────────────────────────────────────────────
            await logStudentEvent(
                studentId,
                'TUTOR_ADDED',
                {
                    newTutorEmail: tutorEmail,
                    newTutorName:  tutorName,
                    category,
                    subject,
                    days,
                    academicTime,
                    fee
                },
                `New tutor added: ${tutorName} for ${category} — ${subject} (${days} at ${academicTime})`,
                { addedBy: window.userData?.name || window.userData?.email || 'management' }
            );

            alert(`✅ ${tutorName} has been added as ${category} tutor for ${studentData.studentName} (${subject}).`);

            document.getElementById('ats-modal')?.remove();

            // Refresh directory
            invalidateCache('students');
            invalidateCache('tutorAssignments');
            if (window.fetchAndRenderDirectory)       window.fetchAndRenderDirectory(true);
            else if (window.renderManagementTutorView) window.renderManagementTutorView(document.getElementById('main-content'));

        } catch (err) {
            console.error('Add tutor to student error:', err);
            alert('Failed to save. Please try again.\n' + err.message);
            submitBtn.disabled  = false;
            submitBtn.textContent = 'Add Tutor';
        }
    });
};
