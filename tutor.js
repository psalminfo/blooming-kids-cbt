// Paste this entire block into your admin.js file, replacing the existing
// SECTION 3 and its related functions.

// ##################################################################
// # SECTION 3: TUTOR MANAGEMENT (Upgraded with Fixes and New Form)
// ##################################################################

// --- Global state for settings ---
let globalSettings = {
    showEditDeleteButtons: false
};
let activeTutorId = null; // Keep track of the currently viewed tutor

// Helper function to generate the new student form fields for the admin panel
function getAdminStudentFormFields() {
    // Generate Grade Options
    const gradeOptions = `
        <option value="">Select Grade</option>
        <option value="Preschool">Preschool</option>
        <option value="Kindergarten">Kindergarten</option>
        ${Array.from({ length: 12 }, (_, i) => `<option value="Grade ${i + 1}">Grade ${i + 1}</option>`).join('')}
        <option value="Pre-College">Pre-College</option>
        <option value="College">College</option>
        <option value="Adults">Adults</option>
    `;

    // Generate Fee Options
    let feeOptions = '<option value="">Select Fee (₦)</option>';
    for (let fee = 20000; fee <= 200000; fee += 5000) {
        feeOptions += `<option value="${fee}">${fee.toLocaleString()}</option>`;
    }
    
    // Define Subjects
    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa"],
        "Tech Courses": ["Coding", "Stop motion animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Child counseling programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills"]
    };

    let subjectsHTML = `<h5 class="font-semibold text-gray-700">Subjects</h5><div id="new-student-subjects-container" class="space-y-2 border p-3 rounded bg-white max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${category}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => `<div><label class="text-sm font-normal"><input type="checkbox" name="subjects" value="${subject}"> ${subject}</label></div>`).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `
        <div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="subjects" value="Music"> Music</label></div>
    </div>`;

    return { gradeOptions, feeOptions, subjectsHTML };
}


async function renderTutorManagementPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Global Settings</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Report Submission:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="report-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="report-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Tutors Can Add Students:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="tutor-add-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="tutor-add-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Enable Summer Break:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="summer-break-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="summer-break-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Show Student Fees:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="show-fees-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="show-fees-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Student Edit/Delete:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="edit-delete-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="edit-delete-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Direct Student Add:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="bypass-approval-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after-w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="bypass-approval-status-label" class="ml-3 text-sm font-medium"></span></label></label>
            </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Grades & Subjects Management</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">Manage Grades</h3>
                    <div class="flex mb-4">
                        <input type="text" id="new-grade-input" class="w-full p-2 border rounded-l" placeholder="e.g., Grade 1, JSS 2">
                        <button id="add-grade-btn" class="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700">Add Grade</button>
                    </div>
                    <ul id="grades-list" class="space-y-2"></ul>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">Manage Subjects</h3>
                    <div class="flex mb-4">
                        <input type="text" id="new-subject-input" class="w-full p-2 border rounded-l" placeholder="e.g., Mathematics, Geography">
                        <button id="add-subject-btn" class="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700">Add Subject</button>
                    </div>
                    <ul id="subjects-list" class="space-y-2"></ul>
                </div>
            </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-2xl font-bold text-green-700">Manage Tutors</h3>
                <div class="flex space-x-4">
                    <div class="bg-blue-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-blue-800 text-sm">Total Tutors</h4><p id="tutor-count-badge" class="text-2xl text-blue-600 font-extrabold">0</p></div>
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Students</h4><p id="student-count-badge" class="text-2xl text-green-600 font-extrabold">0</p></div>
                </div>
            </div>

            <div class="mb-4">
                <label for="global-search-bar" class="block font-semibold">Search Student, Parent, or Tutor:</label>
                <input type="search" id="global-search-bar" class="w-full p-2 border rounded mt-1" placeholder="Start typing a name...">
            </div>
            <div id="global-search-results" class="mb-4"></div>

            <div id="tutor-management-area">
                <div class="mb-4">
                    <label for="tutor-select" class="block font-semibold">Select Tutor Manually:</label>
                    <select id="tutor-select" class="w-full p-2 border rounded mt-1"></select>
                </div>
                <div id="selected-tutor-details" class="mt-4"><p class="text-gray-500">Please select a tutor to view details.</p></div>
            </div>
        </div>
    `;
    setupTutorManagementListeners();
}

async function setupTutorManagementListeners() {
    // --- GLOBAL SETTINGS LISTENERS ---
    const settingsDocRef = doc(db, "settings", "global_settings");
    const curriculumDocRef = doc(db, "settings", "curriculum");

    onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            globalSettings = data; // Store all settings globally
            
            ['report', 'tutor-add', 'summer-break'].forEach(type => {
                const key = `is${capitalize(type.split('-')[0])}${capitalize(type.split('-')[1] || '')}Enabled`;
                const toggle = document.getElementById(`${type}-toggle`);
                const label = document.getElementById(`${type}-status-label`);
                if (toggle && label) {
                    toggle.checked = data[key];
                    label.textContent = data[key] ? 'Enabled' : 'Disabled';
                }
            });

            const showFeesToggle = document.getElementById('show-fees-toggle');
            const showFeesLabel = document.getElementById('show-fees-status-label');
            if (showFeesToggle && showFeesLabel) {
                const initialShowFees = localStorage.getItem('showStudentFees') === 'true';
                showFeesToggle.checked = initialShowFees;
                showFeesLabel.textContent = initialShowFees ? 'Visible' : 'Hidden';
            }

            const editDeleteToggle = document.getElementById('edit-delete-toggle');
            const editDeleteLabel = document.getElementById('edit-delete-status-label');
            if (editDeleteToggle && editDeleteLabel) {
                editDeleteToggle.checked = !!data.showEditDeleteButtons;
                editDeleteLabel.textContent = data.showEditDeleteButtons ? 'Enabled' : 'Disabled';
            }

            const bypassApprovalToggle = document.getElementById('bypass-approval-toggle');
            const bypassApprovalLabel = document.getElementById('bypass-approval-status-label');
            if (bypassApprovalToggle && bypassApprovalLabel) {
                bypassApprovalToggle.checked = !!data.bypassPendingApproval;
                bypassApprovalLabel.textContent = data.bypassPendingApproval ? 'Enabled' : 'Disabled';
            }
        }
    });

    onSnapshot(curriculumDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const gradesList = document.getElementById('grades-list');
            const subjectsList = document.getElementById('subjects-list');

            gradesList.innerHTML = (data.grades || []).map(grade => `<li class="flex justify-between items-center bg-gray-100 p-2 rounded-md">${grade} <button class="delete-grade-btn text-red-500" data-grade="${grade}">✖</button></li>`).join('');
            subjectsList.innerHTML = (data.subjects || []).map(subject => `<li class="flex justify-between items-center bg-gray-100 p-2 rounded-md">${subject} <button class="delete-subject-btn text-red-500" data-subject="${subject}">✖</button></li>`).join('');
            
            // Add listeners to new delete buttons
            document.querySelectorAll('.delete-grade-btn').forEach(btn => btn.addEventListener('click', async e => {
                 await updateDoc(curriculumDocRef, { grades: arrayRemove(e.target.dataset.grade) });
            }));
             document.querySelectorAll('.delete-subject-btn').forEach(btn => btn.addEventListener('click', async e => {
                 await updateDoc(curriculumDocRef, { subjects: arrayRemove(e.target.dataset.subject) });
            }));
        }
    });

    // Toggle listeners
    document.getElementById('report-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isReportEnabled: e.target.checked }));
    document.getElementById('tutor-add-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isTutorAddEnabled: e.target.checked }));
    document.getElementById('summer-break-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isSummerBreakEnabled: e.target.checked }));
    document.getElementById('edit-delete-toggle')?.addEventListener('change', async (e) => updateDoc(settingsDocRef, { showEditDeleteButtons: e.target.checked }));
    document.getElementById('bypass-approval-toggle')?.addEventListener('change', async (e) => updateDoc(settingsDocRef, { bypassPendingApproval: e.target.checked }));

    // FIXED: Show Student Fees toggle now re-renders the details view
    document.getElementById('show-fees-toggle')?.addEventListener('change', (e) => {
        const isVisible = e.target.checked;
        localStorage.setItem('showStudentFees', isVisible);
        document.getElementById('show-fees-status-label').textContent = isVisible ? 'Visible' : 'Hidden';
        if (activeTutorId) {
            renderSelectedTutorDetails(activeTutorId);
        }
    });
    
    // Grades and Subjects listeners
    document.getElementById('add-grade-btn').addEventListener('click', async () => {
        const input = document.getElementById('new-grade-input');
        const newGrade = input.value.trim();
        if (newGrade) {
            await updateDoc(curriculumDocRef, { grades: arrayUnion(newGrade) }, { merge: true });
            input.value = '';
        }
    });

    document.getElementById('add-subject-btn').addEventListener('click', async () => {
        const input = document.getElementById('new-subject-input');
        const newSubject = input.value.trim();
        if (newSubject) {
            await updateDoc(curriculumDocRef, { subjects: arrayUnion(newSubject) }, { merge: true });
            input.value = '';
        }
    });

    // Data fetching for search & management
    const tutorSelect = document.getElementById('tutor-select');
    onSnapshot(collection(db, "tutors"), (snapshot) => {
        const tutorsData = {};
        const tutorsByEmail = {};
        tutorSelect.innerHTML = `<option value="">-- Select a Tutor --</option>`;
        snapshot.forEach(doc => {
            const tutor = { id: doc.id, ...doc.data() };
            tutorsData[doc.id] = tutor;
            tutorsByEmail[tutor.email] = tutor;
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${tutor.name} (${tutor.email})`;
            tutorSelect.appendChild(option);
        });
        window.allTutorsData = tutorsData;
        window.tutorsByEmail = tutorsByEmail;
        document.getElementById('tutor-count-badge').textContent = snapshot.size;
        if (activeTutorId && tutorsData[activeTutorId]) {
            tutorSelect.value = activeTutorId;
        }
    });
    onSnapshot(collection(db, "students"), (snapshot) => {
        window.allStudentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('student-count-badge').textContent = snapshot.size;
    });

    // UI Interaction listeners
    tutorSelect.addEventListener('change', e => {
        activeTutorId = e.target.value;
        renderSelectedTutorDetails(activeTutorId);
    });

    const searchBar = document.getElementById('global-search-bar');
    const searchResultsContainer = document.getElementById('global-search-results');
    const tutorManagementArea = document.getElementById('tutor-management-area');

    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            searchResultsContainer.innerHTML = '';
            tutorManagementArea.style.display = 'block';
            return;
        }
        
        tutorManagementArea.style.display = 'none';
        const { allStudentsData = [], tutorsByEmail = {} } = window;
        const results = allStudentsData.filter(student => {
            const tutor = tutorsByEmail[student.tutorEmail] || { name: 'N/A' };
            return (
                student.studentName?.toLowerCase().includes(searchTerm) ||
                student.parentName?.toLowerCase().includes(searchTerm) ||
                tutor.name?.toLowerCase().includes(searchTerm)
            );
        });
        
        if (results.length > 0) {
            searchResultsContainer.innerHTML = `
                <h4 class="font-bold mb-2">${results.length} matching student(s) found:</h4>
                <ul class="space-y-2 border rounded-lg p-2">${results.map(student => {
                    const tutor = Object.values(window.allTutorsData).find(t => t.email === student.tutorEmail) || { id: '', name: 'Unassigned' };
                    return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md">
                                <div>
                                    <p class="font-semibold">${student.studentName} (Parent: ${student.parentName || 'N/A'})</p>
                                    <p class="text-sm text-gray-600">Assigned to: ${tutor.name}</p>
                                </div>
                                <button class="manage-tutor-from-search-btn bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600" data-tutor-id="${tutor.id}">Manage Tutor</button>
                            </li>`
                }).join('')}</ul>`;
        } else {
            searchResultsContainer.innerHTML = `<p class="text-gray-500">No matches found.</p>`;
        }
        
        searchResultsContainer.querySelectorAll('.manage-tutor-from-search-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tutorId = e.currentTarget.dataset.tutorId;
                if(tutorId) {
                    tutorSelect.value = tutorId;
                    tutorSelect.dispatchEvent(new Event('change'));
                    searchBar.value = '';
                    searchResultsContainer.innerHTML = '';
                    tutorManagementArea.style.display = 'block';
                }
            });
        });
    });
}

function resetStudentForm() {
    const form = document.querySelector('.add-student-form');
    if (!form) return;
    form.querySelector('#new-parent-name').value = '';
    form.querySelector('#new-parent-phone').value = '';
    form.querySelector('#new-student-name').value = '';
    form.querySelector('#new-student-grade').value = '';
    form.querySelectorAll('input[name="subjects"]').forEach(cb => cb.checked = false);
    form.querySelector('#new-student-days').value = '';
    form.querySelector('#new-student-fee').value = '';

    const actionButton = form.querySelector('#add-student-btn');
    if (actionButton) {
        actionButton.textContent = 'Add Student';
        delete actionButton.dataset.editingId;
    }
    document.getElementById('cancel-edit-btn')?.remove();
}

async function renderSelectedTutorDetails(tutorId) {
    const container = document.getElementById('selected-tutor-details');
    if (!tutorId || !window.allTutorsData) {
        container.innerHTML = `<p class="text-gray-500">Please select a tutor to view details.</p>`;
        return;
    }
    const tutor = window.allTutorsData[tutorId];
    const showFees = localStorage.getItem('showStudentFees') === 'true';

    onSnapshot(query(collection(db, "students"), where("tutorEmail", "==", tutor.email)), (studentsSnapshot) => {
        const studentsListHTML = studentsSnapshot.docs.map(doc => {
            const student = doc.data();
            const studentId = doc.id;
            const feeDisplay = showFees ? ` - Fee: ₦${(student.studentFee || 0).toLocaleString()}` : '';
            
            // FIXED: Only show edit/delete buttons if the setting is enabled
            const editDeleteButtonsHTML = globalSettings.showEditDeleteButtons ? `
                <button class="edit-student-btn text-blue-500 hover:text-blue-700 font-semibold" 
                    data-student-id="${studentId}" data-parent-name="${student.parentName || ''}" data-parent-phone="${student.parentPhone || ''}" data-student-name="${student.studentName}"
                    data-grade="${student.grade}" data-subjects="${(student.subjects || []).join(',')}"
                    data-days="${student.days || ''}" data-fee="${student.studentFee || ''}">Edit</button>
                <button class="delete-student-btn text-red-500 hover:text-red-700 font-semibold" data-student-id="${studentId}">Delete</button>
            ` : '';

            return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md" data-student-name="${student.studentName.toLowerCase()}">
                        <span>${student.studentName} (Grade ${student.grade})${feeDisplay}</span>
                        <div class="flex items-center space-x-2">${editDeleteButtonsHTML}</div>
                    </li>`;
        }).join('');

        const { gradeOptions, feeOptions, subjectsHTML } = getAdminStudentFormFields();

        container.innerHTML = `
            <div class="p-4 border rounded-lg shadow-sm bg-blue-50">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="font-bold text-xl">${tutor.name} (${studentsSnapshot.size} students)</h4>
                    <label class="flex items-center space-x-2"><span class="font-semibold">Management Staff:</span><input type="checkbox" id="management-staff-toggle" class="h-5 w-5" ${tutor.isManagementStaff ? 'checked' : ''}></label>
                </div>
                <div class="mb-4">
                    <p><strong>Students Assigned to ${tutor.name}:</strong></p>
                    <input type="search" id="student-filter-bar" placeholder="Filter this list..." class="w-full p-2 border rounded mt-2 mb-2">
                    <ul id="students-list-ul" class="space-y-2 mt-2">${studentsListHTML || '<p class="text-gray-500">No students assigned.</p>'}</ul>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                    <div class="add-student-form space-y-2 bg-gray-100 p-4 rounded-lg">
                        <h5 class="font-semibold text-gray-700">Add/Edit Student Details:</h5>
                        <input type="text" id="new-parent-name" class="w-full p-2 border rounded" placeholder="Parent Name">
                        <input type="tel" id="new-parent-phone" class="w-full p-2 border rounded" placeholder="Parent Phone Number">
                        <input type="text" id="new-student-name" class="w-full p-2 border rounded" placeholder="Student Name">
                        <select id="new-student-grade" class="w-full p-2 border rounded">${gradeOptions}</select>
                        ${subjectsHTML}
                        <select id="new-student-days" class="w-full p-2 border rounded"><option value="">Select Days per Week</option>${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select>
                        <select id="new-student-fee" class="w-full p-2 border rounded">${feeOptions}</select>
                        <button id="add-student-btn" class="bg-green-600 text-white w-full px-4 py-2 rounded hover:bg-green-700 mt-2">Add Student</button>
                    </div>
                    <div class="import-students-form">
                        <h5 class="font-semibold text-gray-700">Import Students for ${tutor.name}:</h5>
                        <p class="text-xs text-gray-500 mb-2">Upload a .csv or .xlsx file with columns: <strong>Parent Name, Student Name, Grade, Subjects, Days, Fee</strong></p>
                        <input type="file" id="student-import-file" class="w-full text-sm border rounded p-1" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel">
                        <button id="import-students-btn" class="bg-blue-600 text-white w-full px-4 py-2 rounded mt-2 hover:bg-blue-700">Import Students</button>
                        <p id="import-status" class="text-sm mt-2"></p>
                    </div>
                </div>
            </div>`;

        // Attach event listeners for the newly rendered content
        document.getElementById('management-staff-toggle').addEventListener('change', (e) => updateDoc(doc(db, "tutors", tutorId), { isManagementStaff: e.target.checked }));
        
        document.getElementById('student-filter-bar').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('#students-list-ul li').forEach(li => {
                li.style.display = (li.dataset.studentName || '').includes(searchTerm) ? 'flex' : 'none';
            });
        });

        document.getElementById('add-student-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const editingId = btn.dataset.editingId;
            
            const selectedSubjects = [];
            document.querySelectorAll('#new-student-subjects-container input[name="subjects"]:checked').forEach(checkbox => {
                selectedSubjects.push(checkbox.value);
            });

            const studentData = {
                parentName: document.getElementById('new-parent-name').value,
                parentPhone: document.getElementById('new-parent-phone').value,
                studentName: document.getElementById('new-student-name').value,
                grade: document.getElementById('new-student-grade').value,
                subjects: selectedSubjects,
                days: document.getElementById('new-student-days').value,
                studentFee: parseFloat(document.getElementById('new-student-fee').value),
                tutorEmail: tutor.email,
            };

            if (studentData.studentName && studentData.grade && !isNaN(studentData.studentFee) && selectedSubjects.length > 0) {
                if (editingId) {
                    await updateDoc(doc(db, "students", editingId), studentData);
                } else {
                    studentData.summerBreak = false;
                    await addDoc(collection(db, "students"), studentData);
                }
                resetStudentForm();
            } else {
                alert('Please fill in all details correctly, including at least one subject.');
            }
        });

        document.getElementById('import-students-btn').addEventListener('click', handleStudentImport);
        
        container.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const data = e.currentTarget.dataset;
                document.getElementById('new-parent-name').value = data.parentName;
                document.getElementById('new-parent-phone').value = data.parentPhone;
                document.getElementById('new-student-name').value = data.studentName;
                document.getElementById('new-student-grade').value = data.grade;
                document.getElementById('new-student-days').value = data.days;
                document.getElementById('new-student-fee').value = data.fee;

                // Populate subjects checkboxes
                const studentSubjects = data.subjects.split(',');
                document.querySelectorAll('#new-student-subjects-container input[name="subjects"]').forEach(checkbox => {
                    checkbox.checked = studentSubjects.includes(checkbox.value);
                });

                const actionButton = document.getElementById('add-student-btn');
                actionButton.textContent = 'Update Student';
                actionButton.dataset.editingId = data.studentId;
                
                if (!document.getElementById('cancel-edit-btn')) {
                    const cancelButton = document.createElement('button');
                    cancelButton.id = 'cancel-edit-btn';
                    cancelButton.textContent = 'Cancel Edit';
                    cancelButton.className = 'bg-gray-500 text-white w-full px-4 py-2 rounded hover:bg-gray-600 mt-2';
                    actionButton.insertAdjacentElement('afterend', cancelButton);
                    cancelButton.addEventListener('click', resetStudentForm);
                }
            });
        });

        container.querySelectorAll('.delete-student-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            if (confirm('Are you sure you want to delete this student?')) {
                await deleteDoc(doc(db, "students", e.target.dataset.studentId));
            }
        }));
    });
}


async function handleStudentImport() {
    const fileInput = document.getElementById('student-import-file');
    const statusEl = document.getElementById('import-status');
    const tutor = window.allTutorsData[activeTutorId];
    if (!fileInput.files[0]) return statusEl.textContent = "Please select a file first.";
    if (!tutor) return statusEl.textContent = "Error: No tutor selected.";
    statusEl.textContent = "Reading file...";
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            if (json.length === 0) throw new Error("Sheet is empty or format is incorrect.");
            statusEl.textContent = `Importing ${json.length} students...`;
            
            const batch = writeBatch(db);
            json.forEach(row => {
                const studentDocRef = doc(collection(db, "students"));
                const studentData = {
                    parentName: row['Parent Name'] || '',
                    studentName: row['Student Name'],
                    grade: row['Grade'],
                    subjects: (row['Subjects'] || '').toString().split(',').map(s => s.trim()),
                    days: row['Days'],
                    studentFee: parseFloat(row['Fee']),
                    tutorEmail: tutor.email,
                    summerBreak: false
                };
                if (!studentData.studentName || isNaN(studentData.studentFee)) return; // Skip invalid rows
                batch.set(studentDocRef, studentData);
            });
            await batch.commit();
            statusEl.textContent = `✅ Successfully imported ${json.length} students for ${tutor.name}.`;
            fileInput.value = '';
        } catch (error) {
            statusEl.textContent = `❌ Error: ${error.message}`;
            console.error(error);
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
