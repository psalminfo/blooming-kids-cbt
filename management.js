import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Utility function to capitalize strings
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ### UPDATED FUNCTION ###
// Utility function to convert data to CSV, now includes bank details and gifts
function convertPayAdviceToCSV(data) {
    const header = [
        'Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Gifts (₦)', 'Total Pay (₦)',
        'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary Name'
    ];
    const rows = data.map(item => [
        `"${item.tutorName}"`,
        item.studentCount,
        item.totalStudentFees,
        item.managementFee,
        item.gifts || 0,
        item.totalPay,
        `"${item.beneficiaryBank || 'N/A'}"`,
        `"${item.beneficiaryAccount || 'N/A'}"`,
        `"${item.beneficiaryName || 'N/A'}"`
    ]);
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// ##################################
// # NEW: GIFT MANAGEMENT FUNCTIONS
// ##################################

// Function to show the add gift modal
function showAddGiftModal(tutors) {
    const tutorOptions = tutors.map(tutor => 
        `<option value="${tutor.email}">${tutor.name} (${tutor.email})</option>`
    ).join('');
    
    const modalHtml = `
        <div id="gift-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('gift-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Add Gift to Tutor</h3>
                <form id="add-gift-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Select Tutor</label>
                        <select id="gift-tutor-email" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="">Select a tutor</option>
                            ${tutorOptions}
                        </select>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Gift Amount (₦)</label>
                        <input type="number" id="gift-amount" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" placeholder="Enter amount">
                    </div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('gift-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Add Gift</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('add-gift-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const tutorEmail = document.getElementById('gift-tutor-email').value;
        const amount = parseFloat(document.getElementById('gift-amount').value);

        if (!tutorEmail || isNaN(amount) || amount <= 0) {
            alert("Please select a tutor and enter a valid gift amount.");
            return;
        }

        try {
            // Get current gifts or initialize if not exists
            const giftRef = doc(db, "gifts", tutorEmail);
            const giftDoc = await getDoc(giftRef);
            
            let currentAmount = 0;
            if (giftDoc.exists()) {
                currentAmount = giftDoc.data().amount || 0;
            }
            
            // Update the gift amount
            await setDoc(giftRef, { 
                amount: currentAmount + amount,
                tutorEmail: tutorEmail,
                tutorName: tutors.find(t => t.email === tutorEmail)?.name || "Unknown",
                lastUpdated: Timestamp.now()
            }, { merge: true });

            alert(`Gift of ₦${amount.toLocaleString()} added successfully!`);
            document.getElementById('gift-modal').remove();
            
            // Refresh the pay advice data
            const startDateInput = document.getElementById('start-date');
            const endDateInput = document.getElementById('end-date');
            if (startDateInput && startDateInput.value && endDateInput && endDateInput.value) {
                const startDate = new Date(startDateInput.value);
                const endDate = new Date(endDateInput.value);
                endDate.setHours(23, 59, 59, 999);
                loadPayAdviceData(startDate, endDate);
            }
        } catch (error) {
            console.error("Error adding gift:", error);
            alert("Failed to add gift. Check the console for details.");
        }
    });
}

// Function to load gifts for tutors
async function loadGiftsForTutors(tutorEmails) {
    try {
        const giftsQuery = query(collection(db, "gifts"), where("tutorEmail", "in", tutorEmails));
        const giftsSnapshot = await getDocs(giftsQuery);
        const gifts = {};
        giftsSnapshot.forEach(doc => {
            gifts[doc.data().tutorEmail] = doc.data().amount || 0;
        });
        return gifts;
    } catch (error) {
        console.error("Error loading gifts:", error);
        return {};
    }
}

// ##################################
// # NEW: STUDENT ASSIGNMENT FUNCTIONS
// ##################################

// Function to show the assign student modal
function showAssignStudentModal(student = null) {
    // If student is provided, we're reassigning, otherwise we're adding a new student
    const isReassign = student !== null;
    
    const modalHtml = `
        <div id="assign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('assign-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">${isReassign ? 'Reassign' : 'Assign'} Student</h3>
                
                <div class="mb-4">
                    <input type="text" id="search-tutor-input" class="w-full p-2 border rounded" placeholder="Search tutor by name or email...">
                    <div id="tutor-search-results" class="mt-2 border rounded max-h-40 overflow-y-auto hidden"></div>
                </div>
                
                <form id="assign-student-form">
                    ${isReassign ? `<input type="hidden" id="assign-student-id" value="${student.id}">` : ''}
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Selected Tutor</label>
                        <div id="selected-tutor-info" class="p-2 bg-gray-100 rounded hidden"></div>
                        <input type="hidden" id="assign-tutor-email" value="">
                    </div>
                    
                    ${!isReassign ? `
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Student Name</label>
                        <input type="text" id="assign-student-name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Grade</label>
                        <input type="text" id="assign-grade" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Days/Week</label>
                        <input type="number" id="assign-days" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" min="1" max="7" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Subjects (comma-separated)</label>
                        <input type="text" id="assign-subjects" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Parent Name</label>
                        <input type="text" id="assign-parent-name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Parent Phone</label>
                        <input type="text" id="assign-parent-phone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Student Fee (₦)</label>
                        <input type="number" id="assign-student-fee" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    ` : ''}
                    
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('assign-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">${isReassign ? 'Reassign' : 'Assign'} Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Tutor search functionality
    const searchInput = document.getElementById('search-tutor-input');
    const searchResults = document.getElementById('tutor-search-results');
    const selectedTutorInfo = document.getElementById('selected-tutor-info');
    const tutorEmailInput = document.getElementById('assign-tutor-email');

    let allTutors = [];

    // Load all tutors for search
    async function loadAllTutors() {
        try {
            const tutorsSnapshot = await getDocs(collection(db, "tutors"));
            allTutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error loading tutors:", error);
        }
    }

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        if (searchTerm.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        const filteredTutors = allTutors.filter(tutor => 
            tutor.name.toLowerCase().includes(searchTerm) || 
            tutor.email.toLowerCase().includes(searchTerm)
        );

        if (filteredTutors.length > 0) {
            searchResults.innerHTML = filteredTutors.map(tutor => 
                `<div class="p-2 hover:bg-gray-100 cursor-pointer" data-email="${tutor.email}" data-name="${tutor.name}">
                    ${tutor.name} (${tutor.email})
                </div>`
            ).join('');
            searchResults.classList.remove('hidden');
        } else {
            searchResults.innerHTML = '<div class="p-2 text-gray-500">No tutors found</div>';
            searchResults.classList.remove('hidden');
        }
    });

    // Handle tutor selection
    searchResults.addEventListener('click', function(e) {
        const target = e.target.closest('[data-email]');
        if (target) {
            const tutorEmail = target.getAttribute('data-email');
            const tutorName = target.getAttribute('data-name');
            
            tutorEmailInput.value = tutorEmail;
            selectedTutorInfo.innerHTML = `<strong>${tutorName}</strong> (${tutorEmail})`;
            selectedTutorInfo.classList.remove('hidden');
            searchResults.classList.add('hidden');
            searchInput.value = '';
        }
    });

    // Handle form submission
    document.getElementById('assign-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tutorEmail = tutorEmailInput.value;
        if (!tutorEmail) {
            alert("Please select a tutor first.");
            return;
        }

        try {
            if (isReassign) {
                // Reassign existing student
                const studentId = document.getElementById('assign-student-id').value;
                await updateDoc(doc(db, "students", studentId), {
                    tutorEmail: tutorEmail,
                    tutorName: allTutors.find(t => t.email === tutorEmail)?.name || "Unknown"
                });
                alert("Student reassigned successfully!");
            } else {
                // Add new student
                const studentData = {
                    studentName: document.getElementById('assign-student-name').value,
                    grade: document.getElementById('assign-grade').value,
                    days: document.getElementById('assign-days').value,
                    subjects: document.getElementById('assign-subjects').value.split(',').map(s => s.trim()),
                    parentName: document.getElementById('assign-parent-name').value,
                    parentPhone: document.getElementById('assign-parent-phone').value,
                    studentFee: Number(document.getElementById('assign-student-fee').value),
                    tutorEmail: tutorEmail,
                    tutorName: allTutors.find(t => t.email === tutorEmail)?.name || "Unknown",
                    status: 'approved',
                    createdAt: Timestamp.now()
                };

                await addDoc(collection(db, "students"), studentData);
                alert("Student assigned successfully!");
            }
            
            document.getElementById('assign-modal').remove();
            // Refresh the view
            renderManagementTutorView(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error assigning student:", error);
            alert("Failed to assign student. Check the console for details.");
        }
    });

    // Load tutors when modal opens
    loadAllTutors();
}

// ##################################
// # NEW: SEARCH FUNCTIONALITY
// ##################################

function addSearchToTutorView() {
    const directoryList = document.getElementById('directory-list');
    if (!directoryList) return;
    
    // Check if search already exists
    if (document.getElementById('tutor-search-container')) return;
    
    const searchHtml = `
        <div id="tutor-search-container" class="mb-4">
            <input type="text" id="tutor-search-input" class="w-full p-2 border rounded" placeholder="Search by tutor, student, or parent name...">
        </div>
    `;
    
    directoryList.insertAdjacentHTML('beforebegin', searchHtml);
    
    const searchInput = document.getElementById('tutor-search-input');
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const tutorSections = document.querySelectorAll('details');
        
        tutorSections.forEach(section => {
            const tutorName = section.querySelector('summary').textContent.toLowerCase();
            const studentsTable = section.querySelector('tbody');
            let hasVisibleStudents = false;
            
            if (studentsTable) {
                const studentRows = studentsTable.querySelectorAll('tr');
                
                studentRows.forEach(row => {
                    const rowText = row.textContent.toLowerCase();
                    const isVisible = rowText.includes(searchTerm) || tutorName.includes(searchTerm);
                    row.style.display = isVisible ? '' : 'none';
                    if (isVisible) hasVisibleStudents = true;
                });
            }
            
            // Show/hide the entire tutor section based on whether it has visible students
            // or if the tutor name matches the search
            section.style.display = (hasVisibleStudents || tutorName.includes(searchTerm)) ? '' : 'none';
        });
    });
}

// ##################################
// # ACTION HANDLER FUNCTIONS
// ##################################

// UPDATED: This function now fetches student data and opens a modal for editing
async function handleEditStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) {
            alert("Student not found!");
            return;
        }

        const studentData = studentDoc.data();
        showEditStudentModal(studentId, studentData, "students");

    } catch (error) {
        console.error("Error fetching student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

// NEW FUNCTION: Handle editing a pending student
async function handleEditPendingStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "pending_students", studentId));
        if (!studentDoc.exists()) {
            alert("Pending student not found!");
            return;
        }

        const studentData = studentDoc.data();
        showEditStudentModal(studentId, studentData, "pending_students");

    } catch (error) {
        console.error("Error fetching pending student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

// UPDATED: Centralized function to show the edit modal
function showEditStudentModal(studentId, studentData, collectionName) {
    const modalHtml = `
        <div id="edit-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('edit-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Edit Student Details</h3>
                <form id="edit-student-form">
                    <input type="hidden" id="edit-student-id" value="${studentId}">
                    <input type="hidden" id="edit-collection-name" value="${collectionName}">

                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="edit-studentName" value="${studentData.studentName}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Grade</label><input type="text" id="edit-grade" value="${studentData.grade}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Days/Week</label><input type="text" id="edit-days" value="${studentData.days}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Subjects (comma-separated)</label><input type="text" id="edit-subjects" value="${studentData.subjects ? studentData.subjects.join(', ') : ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="edit-parentName" value="${studentData.parentName || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="edit-parentPhone" value="${studentData.parentPhone || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="edit-studentFee" value="${studentData.studentFee || 0}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>

                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('edit-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const editedId = form.elements['edit-student-id'].value;
        const targetCollection = form.elements['edit-collection-name'].value;

        const updatedData = {
            studentName: form.elements['edit-studentName'].value,
            grade: form.elements['edit-grade'].value,
            days: form.elements['edit-days'].value,
            subjects: form.elements['edit-subjects'].value.split(',').map(s => s.trim()).filter(s => s),
            parentName: form.elements['edit-parentName'].value,
            parentPhone: form.elements['edit-parentPhone'].value,
            studentFee: Number(form.elements['edit-studentFee'].value) || 0,
        };
        
        try {
            await updateDoc(doc(db, targetCollection, editedId), updatedData);
            alert("Student details updated successfully!");
            document.getElementById('edit-modal').remove();
            // The onSnapshot listener will automatically re-render the view
        } catch (error) {
            console.error("Error updating document: ", error);
            alert("Failed to save changes. Check the console for details.");
        }
    });
}

// Placeholder function to handle student deletion
async function handleDeleteStudent(studentId) {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "students", studentId));
            console.log("Student successfully deleted!");
            alert("Student deleted successfully!");
            // Rerender the view to update the list.
            renderManagementTutorView(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error removing student: ", error);
            alert("Error deleting student. Check the console for details.");
        }
    }
}

// NEW function to handle accepting a student
async function handleApproveStudent(studentId) {
    if (confirm("Are you sure you want to approve this student?")) {
        try {
            const studentRef = doc(db, "pending_students", studentId);
            const studentDoc = await getDoc(studentRef);
            if (!studentDoc.exists()) {
                alert("Student not found.");
                return;
            }
            const studentData = studentDoc.data();
            
            // Create a write batch
            const batch = writeBatch(db);
            
            // Set the student data in the main 'students' collection
            const newStudentRef = doc(db, "students", studentId);
            batch.set(newStudentRef, { ...studentData, status: 'approved' });
            
            // Delete the student from the 'pending_students' collection
            batch.delete(studentRef);
            
            // Commit the batch
            await batch.commit();

            alert("Student approved successfully!");
            // The onSnapshot listener will automatically re-render the view
        } catch (error) {
            console.error("Error approving student: ", error);
            alert("Error approving student. Check the console for details.");
        }
    }
}

// NEW function to handle rejecting (deleting) a student
async function handleRejectStudent(studentId) {
    if (confirm("Are you sure you want to reject this student? This will delete their entry.")) {
        try {
            await deleteDoc(doc(db, "pending_students", studentId));
            alert("Student rejected successfully!");
            // The onSnapshot listener will automatically re-render the view
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}

// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex space-x-4">
                    <button id="assign-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Assign New Student</button>
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow">
                        <h4 class="font-bold text-green-800 text-sm">Total Tutors</h4>
                        <p id="tutor-count-badge" class="text-2xl font-extrabold">0</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow">
                        <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                        <p id="student-count-badge" class="text-2xl font-extrabold">0</p>
                    </div>
                </div>
            </div>
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;

    // Add event listener for the assign student button
    document.getElementById('assign-student-btn').addEventListener('click', () => {
        showAssignStudentModal();
    });

    try {
        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(query(collection(db, "tutors"), orderBy("name"))),
            getDocs(collection(db, "students")) // This correctly only fetches approved students
        ]);

        document.getElementById('tutor-count-badge').textContent = tutorsSnapshot.size;
        document.getElementById('student-count-badge').textContent = studentsSnapshot.size;

        const studentsByTutor = {};
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            if (!studentsByTutor[student.tutorEmail]) {
                studentsByTutor[student.tutorEmail] = [];
            }
            studentsByTutor[student.tutorEmail].push(student);
        });

        const directoryList = document.getElementById('directory-list');
        if (!directoryList) return;

        const canEditStudents = window.userData.permissions?.actions?.canEditStudents === true;
        const canDeleteStudents = window.userData.permissions?.actions?.canDeleteStudents === true;
        const canReassignStudents = window.userData.permissions?.actions?.canReassignStudents === true;
        const showActionsColumn = canEditStudents || canDeleteStudents || canReassignStudents;

        directoryList.innerHTML = tutorsSnapshot.docs.map(tutorDoc => {
            const tutor = tutorDoc.data();
            const assignedStudents = studentsByTutor[tutor.email] || [];
            
            const studentsTableRows = assignedStudents
                .sort((a, b) => a.studentName.localeCompare(b.studentName))
                .map(student => {
                    const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
                    const actionButtons = `
                        ${canEditStudents ? `<button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Edit</button>` : ''}
                        ${canReassignStudents ? `<button class="reassign-student-btn bg-purple-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Reassign</button>` : ''}
                        ${canDeleteStudents ? `<button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Delete</button>` : ''}
                    `;
                    return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-2 font-medium">${student.studentName}</td>
                            <td class="px-4 py-2">₦${(student.studentFee || 0).toFixed(2)}</td>
                            <td class="px-4 py-2">${student.grade}</td>
                            <td class="px-4 py-2">${student.days}</td>
                            <td class="px-4 py-2">${subjects}</td>
                            <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                            <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                            ${showActionsColumn ? `<td class="px-4 py-2 space-x-1">${actionButtons}</td>` : ''}
                        </tr>
                    `;
                }).join('');

            return `
                <div class="border rounded-lg shadow-sm">
                    <details>
                        <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg">
                            ${tutor.name}
                            <span class="ml-2 text-sm font-normal text-gray-500">(${assignedStudents.length} students)</span>
                        </summary>
                        <div class="border-t p-2">
                            <table class="min-w-full text-sm">
                                <thead class="bg-gray-50 text-left"><tr>
                                    <th class="px-4 py-2 font-medium">Student Name</th>
                                    <th class="px-4 py-2 font-medium">Fee</th>
                                    <th class="px-4 py-2 font-medium">Grade</th>
                                    <th class="px-4 py-2 font-medium">Days/Week</th>
                                    <th class="px-4 py-2 font-medium">Subject</th>
                                    <th class="px-4 py-2 font-medium">Parent's Name</th>
                                    <th class="px-4 py-2 font-medium">Parent's Phone</th>
                                    ${showActionsColumn ? `<th class="px-4 py-2 font-medium">Actions</th>` : ''}
                                </tr></thead>
                                <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
                            </table>
                        </div>
                    </details>
                </div>
            `;
        }).join('');

        if (canEditStudents) {
            document.querySelectorAll('.edit-student-btn').forEach(button => {
                button.addEventListener('click', () => handleEditStudent(button.dataset.studentId));
            });
        }
        
        if (canReassignStudents) {
            document.querySelectorAll('.reassign-student-btn').forEach(button => {
                button.addEventListener('click', async () => {
                    const studentId = button.dataset.studentId;
                    try {
                        const studentDoc = await getDoc(doc(db, "students", studentId));
                        if (studentDoc.exists()) {
                            showAssignStudentModal({ id: studentId, ...studentDoc.data() });
                        }
                    } catch (error) {
                        console.error("Error fetching student for reassignment:", error);
                        alert("Error fetching student data. Check the console for details.");
                    }
                });
            });
        }
        
        if (canDeleteStudents) {
            document.querySelectorAll('.delete-student-btn').forEach(button => {
                button.addEventListener('click', () => handleDeleteStudent(button.dataset.studentId));
            });
        }

        // Add search functionality
        addSearchToTutorView();

    } catch(error) {
        console.error("Error in renderManagementTutorView:", error);
        document.getElementById('directory-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

// ### UPDATED FUNCTION ###
async function renderPayAdvicePanel(container) {
    const canExport = window.userData.permissions?.actions?.canExportPayAdvice === true;
    const canAddGifts = window.userData.permissions?.actions?.canAddGifts === true;
    
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Pay Advice</h2>
            <div class="bg-green-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="start-date" class="block text-sm font-medium">Start Date</label>
                    <input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="end-date" class="block text-sm font-medium">End Date</label>
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-4 col-span-2">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                        <h4 class="font-bold text-green-800 text-sm">Active Tutors</h4>
                        <p id="pay-tutor-count" class="text-2xl font-extrabold">0</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                        <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                        <p id="pay-student-count" class="text-2xl font-extrabold">0</p>
                    </div>
                    ${canAddGifts ? `<button id="add-gift-btn" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 h-full">Add Gift</button>` : ''}
                    ${canExport ? `<button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Export CSV</button>` : ''}
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Gifts</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Bank Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Account No.</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Account Name</th>
                        </tr>
                    </thead>
                    <tbody id="pay-advice-body" class="bg-white divide-y divide-gray-200">
                        <tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">Select a date range to view pay advice</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Set default date values (current month)
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('start-date').valueAsDate = firstDayOfMonth;
    document.getElementById('end-date').valueAsDate = lastDayOfMonth;

    // Add event listeners
    document.getElementById('start-date').addEventListener('change', handleDateChange);
    document.getElementById('end-date').addEventListener('change', handleDateChange);
    
    if (canExport) {
        document.getElementById('export-pay-csv-btn').addEventListener('click', handleExportPayAdvice);
    }
    
    if (canAddGifts) {
        document.getElementById('add-gift-btn').addEventListener('click', handleAddGift);
    }

    // Load initial data
    handleDateChange();
}

// NEW: Handle adding a gift
async function handleAddGift() {
    try {
        const tutorsSnapshot = await getDocs(collection(db, "tutors"));
        const tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        showAddGiftModal(tutors);
    } catch (error) {
        console.error("Error loading tutors for gift:", error);
        alert("Failed to load tutors. Check the console for details.");
    }
}

// NEW: Handle date change for pay advice
async function handleDateChange() {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    if (!startDateInput.value || !endDateInput.value) return;
    
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    endDate.setHours(23, 59, 59, 999);
    
    await loadPayAdviceData(startDate, endDate);
}

// UPDATED: Load pay advice data with gift support
async function loadPayAdviceData(startDate, endDate) {
    try {
        // Get all tutors
        const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), orderBy("name")));
        const tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Get all students
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Get all gifts
        const tutorEmails = tutors.map(t => t.email);
        const gifts = await loadGiftsForTutors(tutorEmails);
        
        // Filter students by date range
        const filteredStudents = students.filter(student => {
            const studentDate = student.createdAt ? student.createdAt.toDate() : new Date();
            return studentDate >= startDate && studentDate <= endDate;
        });
        
        // Update counts
        document.getElementById('pay-tutor-count').textContent = tutors.length;
        document.getElementById('pay-student-count').textContent = filteredStudents.length;
        
        // Group students by tutor
        const studentsByTutor = {};
        filteredStudents.forEach(student => {
            if (!studentsByTutor[student.tutorEmail]) {
                studentsByTutor[student.tutorEmail] = [];
            }
            studentsByTutor[student.tutorEmail].push(student);
        });
        
        // Calculate pay for each tutor
        const payData = tutors.map(tutor => {
            const tutorStudents = studentsByTutor[tutor.email] || [];
            const totalStudentFees = tutorStudents.reduce((sum, student) => sum + (student.studentFee || 0), 0);
            const managementFee = totalStudentFees * 0.1; // 10% management fee
            const giftAmount = gifts[tutor.email] || 0;
            const totalPay = totalStudentFees - managementFee + giftAmount;
            
            return {
                tutorName: tutor.name,
                studentCount: tutorStudents.length,
                totalStudentFees,
                managementFee,
                gifts: giftAmount,
                totalPay,
                beneficiaryBank: tutor.beneficiaryBank,
                beneficiaryAccount: tutor.beneficiaryAccount,
                beneficiaryName: tutor.beneficiaryName
            };
        });
        
        // Render the pay advice table
        const payAdviceBody = document.getElementById('pay-advice-body');
        payAdviceBody.innerHTML = payData.map(item => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">${item.tutorName}</td>
                <td class="px-6 py-4 whitespace-nowrap">${item.studentCount}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.totalStudentFees.toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.managementFee.toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.gifts.toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap font-bold">₦${item.totalPay.toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap">${item.beneficiaryBank || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">${item.beneficiaryAccount || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">${item.beneficiaryName || 'N/A'}</td>
            </tr>
        `).join('');
        
        // Store the current pay data for export
        window.currentPayData = payData;
        
    } catch (error) {
        console.error("Error loading pay advice data:", error);
        document.getElementById('pay-advice-body').innerHTML = `
            <tr><td colspan="9" class="px-6 py-4 text-center text-red-500">Failed to load pay advice data</td></tr>
        `;
    }
}

// NEW: Handle export pay advice
function handleExportPayAdvice() {
    if (!window.currentPayData || window.currentPayData.length === 0) {
        alert("No data to export. Please select a date range first.");
        return;
    }
    
    const csvData = convertPayAdviceToCSV(window.currentPayData);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pay-advice-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

document.addEventListener('DOMContentLoaded', function() {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (!mainContent) {
        console.error("Main content element not found");
        return;
    }
    
    // Show loading message
    mainContent.innerHTML = `<p class="text-center text-gray-500 py-10">Checking user permissions...</p>`;
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Check if user is a staff member
                const staffDocRef = doc(db, "staff", user.email);
                const staffDoc = await getDoc(staffDocRef);
                
                if (staffDoc.exists()) {
                    const staffData = staffDoc.data();
                    window.userData = staffData;
                    
                    // Update UI with user info
                    const welcomeMessage = document.getElementById('welcome-message');
                    const userRole = document.getElementById('user-role');
                    
                    if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${staffData.name}`;
                    if (userRole) userRole.textContent = `Role: ${capitalize(staffData.role)}`;
                    
                    // Render the management panel based on permissions
                    renderManagementPanel(mainContent, staffData);
                } else {
                    mainContent.innerHTML = `<p class="text-center text-red-500 py-10">Access denied. You are not registered as staff.</p>`;
                }
            } catch (error) {
                console.error("Error checking user permissions:", error);
                mainContent.innerHTML = `<p class="text-center text-red-500 py-10">Error checking permissions. Please try again.</p>`;
            }
        } else {
            // User is not signed in, redirect to login
            window.location.href = "management-auth.html";
        }
    });
    
    // Logout button handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = "management-auth.html";
            }).catch((error) => {
                console.error("Error signing out:", error);
            });
        });
    }
});

// Render the management panel with navigation
function renderManagementPanel(container, staffData) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h1 class="text-3xl font-bold text-green-700 mb-6">Management Dashboard</h1>
            
            <div class="flex flex-wrap gap-4 mb-6">
                <button id="nav-tutor-view" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Tutor & Student List</button>
                <button id="nav-pay-advice" class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Pay Advice</button>
                <button id="nav-pending-students" class="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium">Pending Students</button>
            </div>
            
            <div id="management-content">
                <p class="text-center text-gray-500 py-10">Select a view from the navigation above.</p>
            </div>
        </div>
    `;

    // Add event listeners for navigation
    document.getElementById('nav-tutor-view').addEventListener('click', () => {
        renderManagementTutorView(document.getElementById('management-content'));
    });
    
    document.getElementById('nav-pay-advice').addEventListener('click', () => {
        renderPayAdvicePanel(document.getElementById('management-content'));
    });
    
    document.getElementById('nav-pending-students').addEventListener('click', () => {
        renderPendingApprovalsPanel(document.getElementById('management-content'));
    });
}

// Render pending approvals panel
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Approvals</h2>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;
    loadPendingApprovals();
}

// Load pending approvals
async function loadPendingApprovals() {
    const listContainer = document.getElementById('pending-approvals-list');
    
    try {
        const pendingStudentsSnapshot = await getDocs(collection(db, "pending_students"));
        
        if (pendingStudentsSnapshot.empty) {
            listContainer.innerHTML = `<p class="text-center text-gray-500">No students are awaiting approval.</p>`;
            return;
        }

        listContainer.innerHTML = pendingStudentsSnapshot.docs.map(doc => {
            const student = { id: doc.id, ...doc.data() };
            const actionButtons = `
                <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Edit</button>
                <button class="approve-btn bg-green-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Approve</button>
                <button class="reject-btn bg-red-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Reject</button>
            `;
            return `
                <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                    <div>
                        <p><strong>Student:</strong> ${student.studentName}</p>
                        <p><strong>Fee:</strong> ₦${(student.studentFee || 0).toFixed(2)}</p>
                        <p><strong>Submitted by Tutor:</strong> ${student.tutorEmail || 'N/A'}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${actionButtons}
                    </div>
                </div>
            `;
        }).join('');

        // Event listeners
        document.querySelectorAll('.edit-pending-btn').forEach(button => {
            button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId));
        });
        document.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId));
        });
        document.querySelectorAll('.reject-btn').forEach(button => {
            button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId));
        });
    } catch (error) {
        console.error("Error loading pending approvals:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500">Failed to load pending approvals.</p>`;
    }
}
