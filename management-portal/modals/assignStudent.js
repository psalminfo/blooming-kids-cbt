// ============================================================
// modals/assignStudent.js
// Assign new student — single and group class
// Matches tutorDirectory.js showAssignStudentModal logic
// ============================================================

import { db } from '../core/firebase.js';
import { collection, doc, Timestamp, updateDoc, setDoc, addDoc } from '../core/firebase.js';
import { escapeHtml, buildGradeOptions, buildTimeOptions, formatTimeTo12h } from '../core/utils.js';
import { sessionCache, invalidateCache } from '../core/cache.js';

window.showAssignStudentModal = async function() {
    try {
        // Load tutors if not cached
        if (!sessionCache.tutors) {
            const { getDocs, query, orderBy } = await import('../core/firebase.js');
            const snap = await getDocs(query(collection(db, 'tutors'), orderBy('name')));
            sessionCache.tutors = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        const tutors = sessionCache.tutors || [];
        const activeTutors = tutors
            .filter(t => !t.status || t.status === 'active')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (activeTutors.length === 0) {
            alert('No active tutors available. Please refresh and try again.');
            return;
        }

        // ── Helper: build a searchable tutor-row HTML block ───────────────────
        function buildTutorRowHTML(rowId, labelText, colorClass, badgeText) {
            const opts = activeTutors.map(t =>
                `<div class="am-tutor-opt px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0"
                     data-email="${escapeHtml(t.email)}" data-name="${escapeHtml(t.name || t.email)}"
                     data-label="${escapeHtml((t.name || t.email || "").toLowerCase())} ${escapeHtml((t.email || '').toLowerCase())}">
                    <span class="font-medium text-gray-800">${escapeHtml(t.name || t.email)}</span>
                    <span class="text-gray-400 text-xs ml-2">${escapeHtml(t.email || '')}</span>
                 </div>`
            ).join('');
            return `
            <div class="am-tutor-row p-3 bg-${colorClass}-50 border border-${colorClass}-200 rounded-lg">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-semibold text-${colorClass}-700">${labelText}</span>
                    <span class="text-xs bg-${colorClass}-100 text-${colorClass}-700 px-2 py-0.5 rounded">${badgeText}</span>
                </div>
                <div class="relative">
                    <input type="text" id="${rowId}-search" autocomplete="off"
                           placeholder="Type tutor name or email..."
                           class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400">
                    <input type="hidden" id="${rowId}-email" value="">
                    <input type="hidden" id="${rowId}-name"  value="">
                    <div id="${rowId}-dropdown"
                         class="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto hidden top-full left-0">
                        ${opts}
                    </div>
                </div>
                <p id="${rowId}-label" class="text-xs text-green-700 mt-1 hidden"></p>
                <div class="mt-2">
                    <label class="block text-xs font-medium text-gray-600 mb-1">Subject / Activity *</label>
                    <input type="text" id="${rowId}-subject" placeholder="e.g. Mathematics / Piano / SAT"
                           class="w-full rounded-md border border-gray-300 shadow-sm p-1.5 text-sm">
                </div>
                <div class="mt-2">
                    <label class="block text-xs font-medium text-gray-600 mb-1">Tutor Fee (₦) *</label>
                    <input type="number" id="${rowId}-fee" placeholder="e.g. 50000" min="0" value="0"
                           class="w-full rounded-md border border-gray-300 shadow-sm p-1.5 text-sm">
                </div>
            </div>`;
        }

        // ── Remove existing modal if any ──────────────────────────────────────
        const existing = document.getElementById('assign-modal');
        if (existing) existing.remove();

        // ── Modal HTML ────────────────────────────────────────────────────────
        const modalHtml = `
            <div id="assign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-[9999] p-4">
                <div class="relative bg-white w-full max-w-xl rounded-lg shadow-xl" style="max-height:92vh;overflow-y:auto;">
                    <div class="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
                        <h3 class="text-xl font-bold text-gray-800">Assign New Student</h3>
                        <button class="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none"
                            onclick="document.getElementById('assign-modal').remove()">&times;</button>
                    </div>

                    <!-- Class Type Toggle -->
                    <div class="px-5 pt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Class Type <span class="text-red-500">*</span></label>
                        <div class="flex gap-2">
                            <button type="button" id="am-type-single"
                                class="flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-green-600 text-white border-green-600 transition-colors">
                                <i class="fas fa-user mr-1"></i> Single Student
                            </button>
                            <button type="button" id="am-type-group"
                                class="flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-gray-100 text-gray-700 border-gray-300 transition-colors">
                                <i class="fas fa-users mr-1"></i> Group Class
                            </button>
                        </div>
                    </div>

                    <form id="assign-student-form" class="p-5 space-y-3">

                        <!-- SINGLE STUDENT FIELDS -->
                        <div id="am-single-fields">
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Student Name <span class="text-red-500">*</span></label>
                                <input type="text" id="assign-studentName" placeholder="Full name"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Student Grade <span class="text-red-500">*</span></label>
                                <select id="assign-grade" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                    ${buildGradeOptions()}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Days/Week <span class="text-red-500">*</span></label>
                                <input type="text" id="assign-days" placeholder="e.g. Monday, Wednesday, Friday"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Start Time <span class="text-red-500">*</span></label>
                                    <select id="assign-start-time" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                        ${buildTimeOptions()}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">End Time <span class="text-red-500">*</span></label>
                                    <select id="assign-end-time" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                        ${buildTimeOptions()}
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Academic Subjects <span class="text-red-500">*</span></label>
                                <input type="text" id="assign-subjects" placeholder="e.g. Math, English, Science"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Parent Name <span class="text-red-500">*</span></label>
                                <input type="text" id="assign-parentName"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Parent Phone <span class="text-red-500">*</span></label>
                                <input type="text" id="assign-parentPhone"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Parent Email <span class="text-red-500">*</span></label>
                                <input type="email" id="assign-parentEmail" placeholder="parent@example.com"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Tutor Fee (₦) <span class="text-red-500">*</span></label>
                                <input type="number" id="assign-studentFee" value="0" min="0"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>

                            <!-- Tutor Assignments -->
                            <div class="mb-2">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Tutor Assignments <span class="text-red-500">*</span></label>
                                <div id="am-academic-section">
                                    ${buildTutorRowHTML('am-tutor-academic', 'Academic Tutor', 'green', 'Required')}
                                </div>
                                <div id="am-ec-section" class="mt-2 hidden">
                                    <div class="flex justify-between items-center mb-1">
                                        <span class="text-xs font-semibold text-blue-700">Extra-Curricular Tutor</span>
                                        <button type="button" id="am-remove-ec" class="text-xs text-red-500 hover:text-red-700">Remove</button>
                                    </div>
                                    ${buildTutorRowHTML('am-tutor-ec', 'Extra-Curricular Tutor', 'blue', 'Optional')}
                                </div>
                                <div id="am-tp-section" class="mt-2 hidden">
                                    <div class="flex justify-between items-center mb-1">
                                        <span class="text-xs font-semibold text-purple-700">Test Prep Tutor</span>
                                        <button type="button" id="am-remove-tp" class="text-xs text-red-500 hover:text-red-700">Remove</button>
                                    </div>
                                    ${buildTutorRowHTML('am-tutor-tp', 'Test Prep Tutor', 'purple', 'Optional')}
                                </div>
                                <div id="am-add-more-btns" class="mt-3 flex gap-2 hidden">
                                    <button type="button" id="am-add-ec-btn"
                                        class="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100">
                                        <i class="fas fa-plus mr-1"></i>Add Extra-Curricular Tutor
                                    </button>
                                    <button type="button" id="am-add-tp-btn"
                                        class="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-md hover:bg-purple-100">
                                        <i class="fas fa-plus mr-1"></i>Add Test Prep Tutor
                                    </button>
                                </div>
                            </div>
                        </div><!-- /am-single-fields -->

                        <!-- GROUP CLASS FIELDS -->
                        <div id="am-group-fields" class="hidden">
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">How many students? <span class="text-red-500">*</span></label>
                                <div class="flex gap-2">
                                    <input type="number" id="am-group-count" min="2" max="30" value="2"
                                        class="w-24 rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                    <button type="button" id="am-group-generate-btn"
                                        class="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700">
                                        Generate Fields
                                    </button>
                                </div>
                            </div>
                            <div id="am-group-student-rows" class="space-y-3"></div>
                            <div class="mb-3 mt-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Grade (shared) <span class="text-red-500">*</span></label>
                                <select id="assign-grade-group" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                    ${buildGradeOptions()}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Days/Week <span class="text-red-500">*</span></label>
                                <input type="text" id="assign-days-group" placeholder="e.g. Monday, Wednesday"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>
                            <div class="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Start Time <span class="text-red-500">*</span></label>
                                    <select id="assign-start-time-group" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                        ${buildTimeOptions()}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">End Time <span class="text-red-500">*</span></label>
                                    <select id="assign-end-time-group" class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                                        ${buildTimeOptions()}
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Academic Subjects <span class="text-red-500">*</span></label>
                                <input type="text" id="assign-subjects-group" placeholder="e.g. Math, English"
                                    class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            </div>
                            <div class="mb-3">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Group Academic Tutor <span class="text-red-500">*</span></label>
                                ${buildTutorRowHTML('am-tutor-group-academic', 'Academic Tutor', 'green', 'Required')}
                            </div>
                            <div id="am-group-ec-section" class="mb-2 hidden">
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-xs font-semibold text-blue-700">Extra-Curricular Tutor</span>
                                    <button type="button" id="am-group-remove-ec" class="text-xs text-red-500 hover:text-red-700">Remove</button>
                                </div>
                                ${buildTutorRowHTML('am-tutor-group-ec', 'Extra-Curricular Tutor', 'blue', 'Optional')}
                            </div>
                            <div id="am-group-tp-section" class="mb-2 hidden">
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-xs font-semibold text-purple-700">Test Prep Tutor</span>
                                    <button type="button" id="am-group-remove-tp" class="text-xs text-red-500 hover:text-red-700">Remove</button>
                                </div>
                                ${buildTutorRowHTML('am-tutor-group-tp', 'Test Prep Tutor', 'purple', 'Optional')}
                            </div>
                            <div id="am-group-add-more-btns" class="mt-2 flex gap-2">
                                <button type="button" id="am-group-add-ec-btn"
                                    class="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-100">
                                    <i class="fas fa-plus mr-1"></i>Add Extra-Curricular Tutor
                                </button>
                                <button type="button" id="am-group-add-tp-btn"
                                    class="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-md hover:bg-purple-100">
                                    <i class="fas fa-plus mr-1"></i>Add Test Prep Tutor
                                </button>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">Each student will receive a unique ID. Fees are set per student below.</p>
                        </div><!-- /am-group-fields -->

                        <div class="flex justify-end gap-2 pt-2 border-t">
                            <button type="button" onclick="document.getElementById('assign-modal').remove()"
                                class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">Cancel</button>
                            <button type="submit"
                                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                                Assign Student
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // ── Wire tutor dropdowns ──────────────────────────────────────────────
        function wireDropdown(rowId) {
            const searchEl = document.getElementById(`${rowId}-search`);
            const emailEl  = document.getElementById(`${rowId}-email`);
            const nameEl   = document.getElementById(`${rowId}-name`);
            const dropdown = document.getElementById(`${rowId}-dropdown`);
            const labelEl  = document.getElementById(`${rowId}-label`);
            if (!searchEl || !dropdown) return;

            searchEl.addEventListener('focus', () => dropdown.classList.remove('hidden'));
            searchEl.addEventListener('input', () => {
                const term = searchEl.value.toLowerCase();
                dropdown.querySelectorAll('.am-tutor-opt').forEach(opt => {
                    opt.style.display = (opt.dataset.label || '').includes(term) ? '' : 'none';
                });
                dropdown.classList.remove('hidden');
                if (emailEl) emailEl.value = '';
                if (nameEl)  nameEl.value  = '';
                if (labelEl) labelEl.classList.add('hidden');
                if (rowId === 'am-tutor-academic') {
                    document.getElementById('am-add-more-btns')?.classList.add('hidden');
                }
            });
            dropdown.querySelectorAll('.am-tutor-opt').forEach(opt => {
                opt.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    searchEl.value = opt.dataset.name;
                    if (emailEl) emailEl.value = opt.dataset.email;
                    if (nameEl)  nameEl.value  = opt.dataset.name;
                    if (labelEl) {
                        labelEl.textContent = `✓ ${opt.dataset.name} (${opt.dataset.email})`;
                        labelEl.classList.remove('hidden');
                    }
                    dropdown.classList.add('hidden');
                    if (rowId === 'am-tutor-academic' && opt.dataset.email) {
                        document.getElementById('am-add-more-btns')?.classList.remove('hidden');
                    }
                });
            });
            document.addEventListener('click', (e) => {
                if (searchEl && !searchEl.contains(e.target) && dropdown && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }

        ['am-tutor-academic','am-tutor-ec','am-tutor-tp',
         'am-tutor-group-academic','am-tutor-group-ec','am-tutor-group-tp'].forEach(wireDropdown);

        // ── Class Type Toggle ─────────────────────────────────────────────────
        const singleBtn    = document.getElementById('am-type-single');
        const groupBtn     = document.getElementById('am-type-group');
        const singleFields = document.getElementById('am-single-fields');
        const groupFields  = document.getElementById('am-group-fields');
        const submitBtn    = document.querySelector('#assign-student-form button[type="submit"]');
        let isGroup = false;

        function setClassType(grp) {
            isGroup = grp;
            if (grp) {
                groupBtn.className  = 'flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-indigo-600 text-white border-indigo-600 transition-colors';
                singleBtn.className = 'flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-gray-100 text-gray-700 border-gray-300 transition-colors';
                singleFields.classList.add('hidden');
                groupFields.classList.remove('hidden');
                submitBtn.textContent = 'Create Group & Assign';
            } else {
                singleBtn.className = 'flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-green-600 text-white border-green-600 transition-colors';
                groupBtn.className  = 'flex-1 py-2 px-3 rounded-md border font-medium text-sm bg-gray-100 text-gray-700 border-gray-300 transition-colors';
                groupFields.classList.add('hidden');
                singleFields.classList.remove('hidden');
                submitBtn.textContent = 'Assign Student';
            }
        }
        singleBtn.addEventListener('click', () => setClassType(false));
        groupBtn.addEventListener('click',  () => setClassType(true));

        // ── Add/Remove EC & TP (single) ───────────────────────────────────────
        document.getElementById('am-add-ec-btn')?.addEventListener('click', () => {
            document.getElementById('am-ec-section').classList.remove('hidden');
            document.getElementById('am-add-ec-btn').classList.add('hidden');
        });
        document.getElementById('am-add-tp-btn')?.addEventListener('click', () => {
            document.getElementById('am-tp-section').classList.remove('hidden');
            document.getElementById('am-add-tp-btn').classList.add('hidden');
        });
        document.getElementById('am-remove-ec')?.addEventListener('click', () => {
            document.getElementById('am-ec-section').classList.add('hidden');
            document.getElementById('am-add-ec-btn').classList.remove('hidden');
            ['am-tutor-ec-email','am-tutor-ec-name','am-tutor-ec-search','am-tutor-ec-subject'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
        });
        document.getElementById('am-remove-tp')?.addEventListener('click', () => {
            document.getElementById('am-tp-section').classList.add('hidden');
            document.getElementById('am-add-tp-btn').classList.remove('hidden');
            ['am-tutor-tp-email','am-tutor-tp-name','am-tutor-tp-search','am-tutor-tp-subject'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
        });

        // ── Add/Remove EC & TP (group) ────────────────────────────────────────
        document.getElementById('am-group-add-ec-btn')?.addEventListener('click', () => {
            document.getElementById('am-group-ec-section').classList.remove('hidden');
            document.getElementById('am-group-add-ec-btn').classList.add('hidden');
        });
        document.getElementById('am-group-add-tp-btn')?.addEventListener('click', () => {
            document.getElementById('am-group-tp-section').classList.remove('hidden');
            document.getElementById('am-group-add-tp-btn').classList.add('hidden');
        });
        document.getElementById('am-group-remove-ec')?.addEventListener('click', () => {
            document.getElementById('am-group-ec-section').classList.add('hidden');
            document.getElementById('am-group-add-ec-btn').classList.remove('hidden');
            ['am-tutor-group-ec-email','am-tutor-group-ec-name','am-tutor-group-ec-search','am-tutor-group-ec-subject'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
        });
        document.getElementById('am-group-remove-tp')?.addEventListener('click', () => {
            document.getElementById('am-group-tp-section').classList.add('hidden');
            document.getElementById('am-group-add-tp-btn').classList.remove('hidden');
            ['am-tutor-group-tp-email','am-tutor-group-tp-name','am-tutor-group-tp-search','am-tutor-group-tp-subject'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
        });

        // ── Generate group student rows ───────────────────────────────────────
        document.getElementById('am-group-generate-btn')?.addEventListener('click', () => {
            const count = parseInt(document.getElementById('am-group-count').value, 10) || 2;
            const container = document.getElementById('am-group-student-rows');
            container.innerHTML = '';
            for (let i = 0; i < count; i++) {
                container.insertAdjacentHTML('beforeend', `
                    <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p class="text-xs font-semibold text-gray-600 mb-2">Student ${i + 1}</p>
                        <div class="grid grid-cols-1 gap-2">
                            <input type="text" id="am-group-name-${i}" placeholder="Full name *"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm am-group-name">
                            <input type="text" id="am-group-parent-name-${i}" placeholder="Parent name *"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            <input type="text" id="am-group-parent-phone-${i}" placeholder="Parent phone *"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            <input type="email" id="am-group-parent-email-${i}" placeholder="Parent email *"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                            <input type="number" id="am-group-fee-${i}" placeholder="Tutor Fee (₦) *" min="0" value="0"
                                class="w-full rounded-md border border-gray-300 shadow-sm p-2 text-sm">
                        </div>
                    </div>
                `);
            }
        });
        document.getElementById('am-group-generate-btn').click();

        // ── Form Submit ───────────────────────────────────────────────────────
        document.getElementById('assign-student-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Saving...';
            try {
                if (isGroup) {
                    await submitGroupAssignment();
                } else {
                    await submitSingleAssignment();
                }
            } catch (err) {
                console.error('Assign submit error:', err);
                alert('Failed to save. Please try again.\n' + err.message);
                btn.disabled = false;
                btn.textContent = isGroup ? 'Create Group & Assign' : 'Assign Student';
            }
        });

        // ── SINGLE submission ─────────────────────────────────────────────────
        async function submitSingleAssignment() {
            const studentName = document.getElementById('assign-studentName').value.trim();
            const grade       = document.getElementById('assign-grade').value;
            const days        = document.getElementById('assign-days').value.trim();
            const startTime   = document.getElementById('assign-start-time').value;
            const endTime     = document.getElementById('assign-end-time').value;
            const subjectsRaw = document.getElementById('assign-subjects').value.trim();
            const parentName  = document.getElementById('assign-parentName').value.trim();
            const parentPhone = document.getElementById('assign-parentPhone').value.trim();
            const parentEmail = document.getElementById('assign-parentEmail').value.trim();
            const studentFee  = Number(document.getElementById('assign-studentFee').value) || 0;

            const academicEmail = document.getElementById('am-tutor-academic-email').value;
            const academicName  = document.getElementById('am-tutor-academic-name').value;
            const academicSubj  = document.getElementById('am-tutor-academic-subject').value.trim();
            const academicFee   = Number(document.getElementById('am-tutor-academic-fee')?.value) || 0;

            if (!studentName || !grade || !days || !startTime || !endTime || !subjectsRaw) {
                alert('Please fill in all required student fields.'); return;
            }
            if (!parentName || !parentPhone || !parentEmail) {
                alert('Please fill in all parent fields.'); return;
            }
            if (!academicEmail) {
                alert('Please select an Academic Tutor.'); return;
            }

            const academicTime = `${formatTimeTo12h(startTime)} - ${formatTimeTo12h(endTime)}`;
            const subjects = subjectsRaw.split(',').map(s => s.trim()).filter(Boolean);

            const subjectAssignments = [{
                category: 'Academic',
                tutorEmail: academicEmail,
                tutorName: academicName,
                subject: academicSubj || subjects.join(', '),
                tutorFee: academicFee,
                assignedDate: new Date().toISOString()
            }];

            const ecEmail   = document.getElementById('am-tutor-ec-email')?.value;
            const ecName    = document.getElementById('am-tutor-ec-name')?.value;
            const ecSubject = document.getElementById('am-tutor-ec-subject')?.value.trim();
            const ecFee     = Number(document.getElementById('am-tutor-ec-fee')?.value) || 0;
            const ecVisible = !document.getElementById('am-ec-section')?.classList.contains('hidden');
            if (ecVisible && ecEmail) {
                subjectAssignments.push({ category: 'Extra-Curricular', tutorEmail: ecEmail, tutorName: ecName, subject: ecSubject || 'Extra-Curricular', tutorFee: ecFee, assignedDate: new Date().toISOString() });
            }

            const tpEmail   = document.getElementById('am-tutor-tp-email')?.value;
            const tpName    = document.getElementById('am-tutor-tp-name')?.value;
            const tpSubject = document.getElementById('am-tutor-tp-subject')?.value.trim();
            const tpFee     = Number(document.getElementById('am-tutor-tp-fee')?.value) || 0;
            const tpVisible = !document.getElementById('am-tp-section')?.classList.contains('hidden');
            if (tpVisible && tpEmail) {
                subjectAssignments.push({ category: 'Test Prep', tutorEmail: tpEmail, tutorName: tpName, subject: tpSubject || 'Test Prep', tutorFee: tpFee, assignedDate: new Date().toISOString() });
            }

            const newStudentData = {
                studentName, grade, days, academicDays: days, academicTime, subjects,
                parentName, parentPhone, parentEmail, studentFee, tutorFee: academicFee,
                tutorEmail: academicEmail, tutorName: academicName,
                subjectAssignments, status: 'approved', summerBreak: false,
                createdAt: Timestamp.now(),
                createdBy: window.userData?.name || window.userData?.email || 'management',
                tutorHistory: [{ tutorEmail: academicEmail, tutorName: academicName, assignedDate: Timestamp.now(), assignedBy: window.userData?.email || 'management', isCurrent: true }],
                gradeHistory: [{ grade, changedDate: Timestamp.now(), changedBy: window.userData?.email || 'management' }]
            };

            const studentRef = await addDoc(collection(db, 'students'), newStudentData);

            // Schedule
            const DAYS_LIST = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
            const daysList = days.split(/,|\band\b/i).map(d => d.trim()).filter(d => DAYS_LIST.includes(d));
            const scheduleEntries = daysList.length > 0
                ? daysList.map(day => ({ day, start: startTime, end: endTime }))
                : [{ day: days, start: startTime, end: endTime }];

            await setDoc(doc(db, 'schedules', `sched_${studentRef.id}`), {
                studentId: studentRef.id, studentName, tutorEmail: academicEmail,
                schedule: scheduleEntries, academicDays: days, academicTime,
                source: 'management_assign', createdAt: Timestamp.now(), updatedAt: Timestamp.now()
            }, { merge: true });
            await updateDoc(studentRef, { schedule: scheduleEntries });

            // Notifications
            for (const sa of subjectAssignments) {
                await addDoc(collection(db, 'tutor_notifications'), {
                    tutorEmail: sa.tutorEmail, type: 'new_student',
                    title: `New Student Assigned — ${sa.category}`,
                    message: `${studentName} (${grade}) assigned to you for ${sa.subject}. Schedule: ${days} at ${academicTime}.`,
                    studentName, grade, subjects, category: sa.category, subject: sa.subject,
                    parentName, parentPhone, parentEmail, studentFee, academicDays: days, academicTime,
                    senderDisplay: 'Management', read: false, createdAt: Timestamp.now()
                });
            }

            alert(`Student "${studentName}" assigned successfully!`);
            document.getElementById('assign-modal').remove();
            invalidateCache('students');
            invalidateCache('tutorAssignments');
            if (window.fetchAndRenderDirectory) window.fetchAndRenderDirectory(true);
            else if (window.renderManagementTutorView) window.renderManagementTutorView(document.getElementById('main-content'));
        }

        // ── GROUP submission ──────────────────────────────────────────────────
        async function submitGroupAssignment() {
            const count         = document.querySelectorAll('.am-group-name').length;
            const grade         = document.getElementById('assign-grade-group').value;
            const days          = document.getElementById('assign-days-group').value.trim();
            const startTime     = document.getElementById('assign-start-time-group').value;
            const endTime       = document.getElementById('assign-end-time-group').value;
            const subjectsRaw   = document.getElementById('assign-subjects-group').value.trim();
            const academicEmail = document.getElementById('am-tutor-group-academic-email').value;
            const academicName  = document.getElementById('am-tutor-group-academic-name').value;
            const academicSubj  = document.getElementById('am-tutor-group-academic-subject').value.trim();

            if (!grade || !days || !startTime || !endTime || !subjectsRaw) {
                alert('Please fill in all shared schedule fields.'); return;
            }
            if (!academicEmail) { alert('Please select a Group Academic Tutor.'); return; }
            if (count < 2) { alert('Please generate student fields first.'); return; }

            const students = [];
            for (let i = 0; i < count; i++) {
                const name        = document.getElementById(`am-group-name-${i}`)?.value.trim();
                const parentName  = document.getElementById(`am-group-parent-name-${i}`)?.value.trim();
                const parentPhone = document.getElementById(`am-group-parent-phone-${i}`)?.value.trim();
                const parentEmail = document.getElementById(`am-group-parent-email-${i}`)?.value.trim();
                const fee         = Number(document.getElementById(`am-group-fee-${i}`)?.value) || 0;
                if (!name || !parentName || !parentPhone || !parentEmail) {
                    alert(`Please fill in all fields for Student ${i + 1}.`); return;
                }
                students.push({ name, parentName, parentPhone, parentEmail, fee });
            }

            const academicTime = `${formatTimeTo12h(startTime)} - ${formatTimeTo12h(endTime)}`;
            const subjects = subjectsRaw.split(',').map(s => s.trim()).filter(Boolean);

            const sharedAssignments = [{ category: 'Academic', tutorEmail: academicEmail, tutorName: academicName, subject: academicSubj || subjects.join(', '), assignedDate: new Date().toISOString() }];
            const ecEmail   = document.getElementById('am-tutor-group-ec-email')?.value;
            const ecName    = document.getElementById('am-tutor-group-ec-name')?.value;
            const ecSubject = document.getElementById('am-tutor-group-ec-subject')?.value.trim();
            const ecVisible = !document.getElementById('am-group-ec-section')?.classList.contains('hidden');
            if (ecVisible && ecEmail) sharedAssignments.push({ category: 'Extra-Curricular', tutorEmail: ecEmail, tutorName: ecName, subject: ecSubject || 'Extra-Curricular', assignedDate: new Date().toISOString() });
            const tpEmail   = document.getElementById('am-tutor-group-tp-email')?.value;
            const tpName    = document.getElementById('am-tutor-group-tp-name')?.value;
            const tpSubject = document.getElementById('am-tutor-group-tp-subject')?.value.trim();
            const tpVisible = !document.getElementById('am-group-tp-section')?.classList.contains('hidden');
            if (tpVisible && tpEmail) sharedAssignments.push({ category: 'Test Prep', tutorEmail: tpEmail, tutorName: tpName, subject: tpSubject || 'Test Prep', assignedDate: new Date().toISOString() });

            const groupId   = `grp_${Date.now()}`;
            const groupName = `Group Class – ${academicName} (${new Date().toLocaleDateString('en-GB')})`;
            const createdBy = window.userData?.name || window.userData?.email || 'management';

            const DAYS_LIST = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
            const daysList  = days.split(/,|\band\b/i).map(d => d.trim()).filter(d => DAYS_LIST.includes(d));
            const scheduleEntries = daysList.length > 0
                ? daysList.map(day => ({ day, start: startTime, end: endTime }))
                : [{ day: days, start: startTime, end: endTime }];

            const createdIds = [];
            for (const st of students) {
                const studentData = {
                    studentName: st.name, grade, days, academicDays: days, academicTime, subjects,
                    parentName: st.parentName, parentPhone: st.parentPhone, parentEmail: st.parentEmail,
                    studentFee: st.fee, tutorEmail: academicEmail, tutorName: academicName,
                    subjectAssignments: sharedAssignments, groupId, groupName,
                    status: 'approved', summerBreak: false, schedule: scheduleEntries,
                    createdAt: Timestamp.now(), createdBy,
                    tutorHistory: [{ tutorEmail: academicEmail, tutorName: academicName, assignedDate: Timestamp.now(), assignedBy: window.userData?.email || 'management', isCurrent: true }],
                    gradeHistory: [{ grade, changedDate: Timestamp.now(), changedBy: window.userData?.email || 'management' }]
                };
                const ref = await addDoc(collection(db, 'students'), studentData);
                createdIds.push({ id: ref.id, name: st.name });

                await setDoc(doc(db, 'schedules', `sched_${ref.id}`), {
                    studentId: ref.id, studentName: st.name, tutorEmail: academicEmail,
                    schedule: scheduleEntries, academicDays: days, academicTime,
                    source: 'management_assign_group', createdAt: Timestamp.now(), updatedAt: Timestamp.now()
                }, { merge: true });

                for (const sa of sharedAssignments) {
                    await addDoc(collection(db, 'tutor_notifications'), {
                        tutorEmail: sa.tutorEmail, type: 'new_student',
                        title: `New Group Student — ${sa.category}`,
                        message: `${st.name} (${grade}) added to group class for ${sa.subject}. Schedule: ${days} at ${academicTime}.`,
                        studentName: st.name, grade, subjects, category: sa.category,
                        groupId, groupName, parentName: st.parentName, parentPhone: st.parentPhone,
                        parentEmail: st.parentEmail, studentFee: st.fee,
                        senderDisplay: 'Management', read: false, createdAt: Timestamp.now()
                    });
                }
            }

            await addDoc(collection(db, 'groupClasses'), {
                groupId, groupName, tutorEmail: academicEmail, tutorName: academicName,
                subject: subjects.join(', '), schedule: scheduleEntries, academicDays: days, academicTime,
                studentIds: createdIds.map(s => s.id), studentNames: createdIds.map(s => s.name),
                studentCount: createdIds.length, subjectAssignments: sharedAssignments,
                status: 'active', createdAt: Timestamp.now(), createdBy
            });

            alert(`Group class created with ${students.length} students!`);
            document.getElementById('assign-modal').remove();
            invalidateCache('students');
            invalidateCache('tutorAssignments');
            if (window.fetchAndRenderDirectory) window.fetchAndRenderDirectory(true);
            else if (window.renderManagementTutorView) window.renderManagementTutorView(document.getElementById('main-content'));
        }

    } catch (error) {
        console.error('Error showing assign student modal:', error);
        alert('Failed to load assignment data. Please try again.');
    }
};
