// REVISED FUNCTION: Replace your existing renderStudentDatabase with this one.
async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    // --- State for multi-student report drafts ---
    let savedReports = {};

    // Fetch the students assigned to this tutor
    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const studentsSnapshot = await getDocs(studentQuery);
    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const studentsCount = students.length;

    // --- Main UI Rendering Logic ---
    function renderUI() {
        let studentsHTML = `<h2 class="text-2xl font-bold text-green-700 mb-4">My Students (${studentsCount})</h2>`;

        // Display the "Add Student" form if enabled by admin
        if (isTutorAddEnabled) {
            studentsHTML += `
                <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
                    <h3 class="font-bold text-lg mb-2">Add a New Student</h3>
                    <input type="text" id="new-student-name" class="w-full mt-1 p-2 border rounded" placeholder="Student Name">
                    <select id="new-student-grade" class="w-full mt-1 p-2 border rounded">
                        <option value="">Select Grade</option>
                        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                    </select>
                    <input type="text" id="new-student-subject" class="w-full mt-1 p-2 border rounded" placeholder="Subject(s) (e.g., Math, English)">
                    <select id="new-student-days" class="w-full mt-1 p-2 border rounded">
                        <option value="">Select Days</option>
                        ${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                    </select>
                    <input type="number" id="new-student-fee" class="w-full mt-1 p-2 border rounded" placeholder="Student Fee">
                    <button id="add-student-btn" class="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700">Add Student</button>
                </div>`;
        }
        
        // Display submission status
        studentsHTML += `<p class="text-sm text-gray-600 mb-4">Report submission is currently <strong class="${isSubmissionEnabled ? 'text-green-600' : 'text-red-500'}">${isSubmissionEnabled ? 'Enabled' : 'Disabled'}</strong> by the admin.</p>`;

        if (studentsCount === 0) {
            studentsHTML += `<p class="text-gray-500">You are not assigned to any students yet.</p>`;
        } else {
            studentsHTML += `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">`;

            students.forEach(student => {
                const isStudentOnBreak = student.summerBreak;
                const isReportSaved = savedReports[student.id];

                studentsHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">${student.studentName} (Grade ${student.grade})</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="status-indicator ${isReportSaved ? 'text-green-600 font-semibold' : 'text-gray-500'}">
                                ${isReportSaved ? 'Report Saved' : 'Pending Report'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap space-x-2">`;

                if (isSummerBreakEnabled && !isStudentOnBreak) {
                    studentsHTML += `<button class="summer-break-btn bg-yellow-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">Summer Break</button>`;
                } else if (isStudentOnBreak) {
                    studentsHTML += `<span class="text-gray-400">On Break</span>`;
                }

                if (isSubmissionEnabled && !isStudentOnBreak) {
                    // This is the core logic change
                    if (studentsCount === 1) {
                        studentsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">Submit Report</button>`;
                    } else {
                         studentsHTML += `<button class="enter-report-btn bg-blue-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                    }
                } else if (!isStudentOnBreak) {
                    studentsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                }
                
                studentsHTML += `</td></tr>`;
            });

            studentsHTML += `</tbody></table></div>`;

            // Add the main "Submit All" button ONLY for multiple students
            if (studentsCount > 1 && isSubmissionEnabled) {
                const allReportsSaved = Object.keys(savedReports).length === students.filter(s => !s.summerBreak).length;
                studentsHTML += `
                    <div class="mt-6 text-right">
                        <button id="submit-all-reports-btn" class="bg-green-700 text-white px-6 py-3 rounded-lg font-bold ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-800'}" ${!allReportsSaved ? 'disabled' : ''}>
                            Submit All ${studentsCount} Reports
                        </button>
                    </div>`;
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;
        attachEventListeners();
    }

    // --- Modal Logic ---
    function showReportModal(student) {
        // Use existing saved data if available, otherwise empty strings
        const existingReport = savedReports[student.id] || {};
        const reportFormHTML = `
            <h3 class="text-xl font-bold mb-4">Monthly Report for ${student.studentName}</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-gray-700 font-semibold">Introduction</label>
                    <textarea id="report-intro" class="w-full mt-1 p-2 border rounded" rows="2" placeholder="e.g., This is a comprehensive report on...">${existingReport.introduction || ''}</textarea>
                </div>
                <div>
                    <label class="block text-gray-700 font-semibold">Topics & Remarks</label>
                    <textarea id="report-topics" class="w-full mt-1 p-2 border rounded" rows="3" placeholder="e.g., Math: Multiplication, Remark: Excellent progress...">${existingReport.topics || ''}</textarea>
                </div>
                <div>
                    <label class="block text-gray-700 font-semibold">Progress & Achievements</label>
                    <textarea id="report-progress" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.progress || ''}</textarea>
                </div>
                <div>
                    <label class="block text-gray-700 font-semibold">Strengths & Weaknesses</label>
                    <textarea id="report-sw" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.strengthsWeaknesses || ''}</textarea>
                </div>
                <div>
                    <label class="block text-gray-700 font-semibold">Recommendations</label>
                    <textarea id="report-recs" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.recommendations || ''}</textarea>
                </div>
                <div>
                    <label class="block text-gray-700 font-semibold">General Comments</label>
                    <textarea id="report-general" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.generalComments || ''}</textarea>
                </div>
                <div class="flex justify-end space-x-2">
                    <button id="cancel-report-btn" class="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button id="modal-action-btn" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                        ${studentsCount === 1 ? 'Submit Report' : 'Save Report'}
                    </button>
                </div>
            </div>`;

        const reportModal = document.createElement('div');
        reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        reportModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto">${reportFormHTML}</div>`;
        document.body.appendChild(reportModal);

        document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());
        
        document.getElementById('modal-action-btn').addEventListener('click', async () => {
            const reportData = {
                studentId: student.id,
                studentName: student.studentName,
                grade: student.grade,
                introduction: document.getElementById('report-intro').value,
                topics: document.getElementById('report-topics').value,
                progress: document.getElementById('report-progress').value,
                strengthsWeaknesses: document.getElementById('report-sw').value,
                recommendations: document.getElementById('report-recs').value,
                generalComments: document.getElementById('report-general').value
            };

            // If only one student, submit directly. Otherwise, just save to local state.
            if (studentsCount === 1) {
                await submitAllReports([reportData]);
            } else {
                savedReports[student.id] = reportData;
                alert(`${student.studentName}'s report has been saved. Please continue with other students.`);
                renderUI(); // Re-render the main UI to update status
            }
            reportModal.remove();
        });
    }

    // --- Data Submission Logic ---
    async function submitAllReports(reportsArray) {
        if (reportsArray.length === 0) {
            alert("No reports to submit.");
            return;
        }

        const date = new Date();
        const monthId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const docId = `${tutor.email}_${monthId}`;
        const reportDocRef = doc(db, "monthly_tutor_reports", docId);
        
        try {
            // Using setDoc with a custom ID prevents duplicate reports for the same month
            await setDoc(reportDocRef, {
                tutorEmail: tutor.email,
                tutorName: tutor.name,
                submissionMonth: monthId,
                submittedAt: new Date(),
                studentReports: reportsArray,
                status: "submitted" // You can use this for admin tracking
            });

            alert("Successfully submitted all reports for the month!");
            savedReports = {}; // Clear the saved reports
            renderUI(); // Re-render to show completion
        } catch (error) {
            console.error("Error submitting monthly report:", error);
            alert(`Error: ${error.message}`);
        }
    }

    // --- Event Listeners ---
    function attachEventListeners() {
        // Listener for adding a new student
        if (isTutorAddEnabled) {
            document.getElementById('add-student-btn')?.addEventListener('click', async () => {
                // ... (your existing add student logic is fine, just ensure it re-renders)
                // ... for brevity, this part is omitted but your original code is correct.
                // After adding, call renderStudentDatabase again.
                renderStudentDatabase(container, tutor);
            });
        }
        
        // Listener for single student submission button
        document.querySelector('.submit-single-report-btn')?.addEventListener('click', (e) => {
            const studentId = e.target.getAttribute('data-student-id');
            const student = students.find(s => s.id === studentId);
            showReportModal(student);
        });

        // Listener for multi-student "Enter Report" buttons
        document.querySelectorAll('.enter-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const studentId = e.target.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                showReportModal(student);
            });
        });

        // Listener for the final "Submit All Reports" button
        document.getElementById('submit-all-reports-btn')?.addEventListener('click', async () => {
            if (confirm("Are you sure you want to submit all reports for the month? This action cannot be undone.")) {
                const reportsArray = Object.values(savedReports);
                await submitAllReports(reportsArray);
            }
        });
        
        // Listeners for summer break buttons (your existing logic is fine)
         document.querySelectorAll('.summer-break-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.getAttribute('data-student-id');
                if (confirm("Are you sure you want to mark this student as on summer break?")) {
                    await updateDoc(doc(db, "students", studentId), { summerBreak: true });
                    renderStudentDatabase(container, tutor); // Re-render after update
                }
            });
        });
    }

    // --- Initial Render ---
    renderUI();
}
