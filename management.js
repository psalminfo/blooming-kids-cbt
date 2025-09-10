async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex space-x-4">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Tutors</h4><p id="tutor-count-badge" class="text-2xl font-extrabold">0</p></div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-yellow-800 text-sm">Total Students</h4><p id="student-count-badge" class="text-2xl font-extrabold">0</p></div>
                </div>
            </div>
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;

    try {
        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(query(collection(db, "tutors"), orderBy("name"))),
            getDocs(collection(db, "students"))
        ]);

        document.getElementById('tutor-count-badge').textContent = tutorsSnapshot.size;
        document.getElementById('student-count-badge').textContent = studentsSnapshot.size;

        const studentsByTutor = {};
        studentsSnapshot.forEach(doc => {
            const student = doc.data();
            if (!studentsByTutor[student.tutorEmail]) {
                studentsByTutor[student.tutorEmail] = [];
            }
            studentsByTutor[student.tutorEmail].push(student);
        });

        const directoryList = document.getElementById('directory-list');
        if (!directoryList) return;

        // Use a DocumentFragment for better performance with multiple appends
        const fragment = document.createDocumentFragment();

        tutorsSnapshot.docs.forEach(tutorDoc => {
            const tutor = tutorDoc.data();
            const assignedStudents = studentsByTutor[tutor.email] || [];
            
            // Create the main container div
            const tutorDiv = document.createElement('div');
            tutorDiv.className = "border rounded-lg shadow-sm";
            
            // Create the details element
            const detailsElement = document.createElement('details');
            
            // Create the summary element
            const summaryElement = document.createElement('summary');
            summaryElement.className = "p-4 cursor-pointer flex justify-between items-center font-semibold text-lg";
            summaryElement.innerHTML = `
                ${tutor.name}
                <span class="ml-2 text-sm font-normal text-gray-500">(${assignedStudents.length} students)</span>
            `;
            
            // Create the inner div
            const innerDiv = document.createElement('div');
            innerDiv.className = "border-t p-2";
            
            // Create the table
            const tableElement = document.createElement('table');
            tableElement.className = "min-w-full text-sm";
            tableElement.innerHTML = `
                <thead class="bg-gray-50 text-left">
                    <tr>
                        <th class="px-4 py-2 font-medium">Student's Name</th>
                        <th class="px-4 py-2 font-medium">Parent's Name</th>
                        <th class="px-4 py-2 font-medium">Parent's Phone No.</th>
                    </tr>
                </thead>
            `;

            const tableBody = document.createElement('tbody');
            tableBody.className = "bg-white divide-y divide-gray-200";

            assignedStudents
                .sort((a, b) => a.studentName.localeCompare(b.studentName))
                .forEach(student => {
                    const row = document.createElement('tr');
                    row.className = "hover:bg-gray-50";

                    const studentNameCell = document.createElement('td');
                    studentNameCell.className = "px-4 py-2 font-medium";
                    studentNameCell.textContent = student.studentName || 'N/A';
                    
                    const parentNameCell = document.createElement('td');
                    parentNameCell.className = "px-4 py-2";
                    parentNameCell.textContent = student.parentName || 'N/A';
                    
                    const parentPhoneCell = document.createElement('td');
                    parentPhoneCell.className = "px-4 py-2";
                    parentPhoneCell.textContent = student.parentPhone || 'N/A';
                    
                    row.appendChild(studentNameCell);
                    row.appendChild(parentNameCell);
                    row.appendChild(parentPhoneCell);
                    tableBody.appendChild(row);
                });

            tableElement.appendChild(tableBody);
            innerDiv.appendChild(tableElement);
            detailsElement.appendChild(summaryElement);
            detailsElement.appendChild(innerDiv);
            tutorDiv.appendChild(detailsElement);
            fragment.appendChild(tutorDiv);
        });

        directoryList.innerHTML = ''; // Clear the "Loading..." message
        directoryList.appendChild(fragment);

    } catch(error) {
        console.error("Error in renderManagementTutorView:", error);
        document.getElementById('directory-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

