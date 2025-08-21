import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

function renderTutorPanel(tutor) {
    const tutorContent = document.getElementById('tutorContent');
    tutorContent.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Welcome, ${tutor.name}</h2>
            <div class="mb-4">
                <input type="email" id="searchEmail" class="w-full mt-1 p-2 border rounded" placeholder="Search by parent email...">
                <button id="searchBtn" class="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700">Search</button>
            </div>
        </div>

        <div id="pendingReportsContainer" class="space-y-4">
            <p class="text-gray-500">Loading pending submissions...</p>
        </div>
        <div id="gradedReportsContainer" class="space-y-4 hidden">
            <p class="text-gray-500">Loading graded submissions...</p>
        </div>
    `;

    document.getElementById('searchBtn').addEventListener('click', async () => {
        const email = document.getElementById('searchEmail').value.trim();
        await loadTutorReports(tutor.email, email || null);
    });

    loadTutorReports(tutor.email);
}

async function loadTutorReports(tutorEmail, parentEmail = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');
    
    pendingReportsContainer.innerHTML = `<p class="text-gray-500">Loading pending submissions...</p>`;
    if(gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-gray-500">Loading graded submissions...</p>`;

    // FIX: Changed the collection to "tutor_submissions"
    let submissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutorEmail));
    
    // Check if a parent email search is being used and filter the query
    if (parentEmail) {
        submissionsQuery = query(submissionsQuery, where("parentEmail", "==", parentEmail));
    }

    try {
        const querySnapshot = await getDocs(submissionsQuery);
        let pendingHTML = '';
        let gradedHTML = '';

        querySnapshot.forEach(doc => {
            const creativeWritingAnswer = doc.data();
            
            const reportCardHTML = `
                <div class="border rounded-lg p-4 shadow-sm bg-white mb-4">
                    <p><strong>Student:</strong> ${creativeWritingAnswer.studentName}</p>
                    <p><strong>Parent Email:</strong> ${creativeWritingAnswer.parentEmail}</p>
                    <p><strong>Grade:</strong> ${creativeWritingAnswer.grade}</p>
                    <p><strong>Tutor Email:</strong> ${creativeWritingAnswer.tutorEmail}</p>
                    <p><strong>Submitted At:</strong> ${new Date(creativeWritingAnswer.submittedAt.seconds * 1000).toLocaleString()}</p>
                    <div class="mt-4 border-t pt-4">
                        <h4 class="font-semibold">Creative Writing Submission:</h4>
                        ${creativeWritingAnswer.fileUrl ? 
                            creativeWritingAnswer.fileUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? 
                                `<img src="${creativeWritingAnswer.fileUrl}" class="w-full h-auto object-cover mt-2 rounded" alt="Student Submission" />` :
                                `<a href="${creativeWritingAnswer.fileUrl}" target="_blank" class="text-blue-500 hover:underline">Download File</a>`
                            : creativeWritingAnswer.textAnswer ? `<p class="italic">${creativeWritingAnswer.textAnswer}</p>` : "No response"}
                        <p class="mt-2"><strong>Status:</strong> ${creativeWritingAnswer.status || 'Pending'}</p>
                        ${creativeWritingAnswer.status === 'pending_review' ? `
                            <textarea class="tutor-report w-full mt-2 p-2 border rounded" rows="3" placeholder="Write your report here..."></textarea>
                            <button class="submit-report-btn bg-green-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit Report</button>
                        ` : `
                            <p class="mt-2"><strong>Tutor's Report:</strong> ${creativeWritingAnswer.tutorReport || 'N/A'}</p>
                        `}
                    </div>
                </div>
            `;
            if (creativeWritingAnswer.status === 'pending_review') {
                pendingHTML += reportCardHTML;
            } else {
                gradedHTML += reportCardHTML;
            }
        });

        pendingReportsContainer.innerHTML = pendingHTML || `<p class="text-gray-500">No pending submissions found.</p>`;
        if(gradedReportsContainer) gradedReportsContainer.innerHTML = gradedHTML || `<p class="text-gray-500">No graded submissions found.</p>`;

        document.querySelectorAll('.submit-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-doc-id');
                const reportTextarea = e.target.closest('.border').querySelector('.tutor-report');
                const tutorReport = reportTextarea.value.trim();

                if (tutorReport) {
                    const docRef = doc(db, "tutor_submissions", docId);
                    await updateDoc(docRef, { tutorReport: tutorReport, status: 'Graded' });
                    loadTutorReports(tutorEmail, parentEmail); // Refresh the list
                }
            });
        });

    } catch (error) {
        console.error("Error loading tutor reports:", error);
        pendingReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
        if(gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
    }
}

onAuthStateChanged(auth, async (user) => {
    const tutorContent = document.getElementById('tutorContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        const tutorRef = doc(db, "tutors", user.email);
        const tutorSnap = await getDoc(tutorRef);

        if (tutorSnap.exists()) {
            renderTutorPanel(tutorSnap.data());
            logoutBtn.addEventListener('click', async () => {
                await signOut(auth);
                window.location.href = "tutor-auth.html";
            });
        } else {
            tutorContent.innerHTML = `<p class="text-center mt-12 text-red-600">Your account is not registered as a tutor.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        window.location.href = "tutor-auth.html";
    }
});
