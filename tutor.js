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

    let resultsQuery = query(collection(db, "student_results"), where("tutorEmail", "==", tutorEmail));
    if (parentEmail) {
        resultsQuery = query(resultsQuery, where("parentEmail", "==", parentEmail));
    }
    
    try {
        const querySnapshot = await getDocs(resultsQuery);
        let pendingHTML = '';
        let gradedHTML = '';

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const creativeWritingAnswer = data.answers.find(a => a.type === 'creative-writing');
            if (creativeWritingAnswer) {
                const reportCardHTML = `
                    <div class="border rounded-lg p-4 shadow-sm bg-white mb-4">
                        <p><strong>Student:</strong> ${data.studentName}</p>
                        <p><strong>Email:</strong> ${data.parentEmail}</p>
                        <p><strong>Subject:</strong> ${data.subject}</p>
                        <p><strong>Submitted At:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                        <div class="mt-4 border-t pt-4">
                            <h4 class="font-semibold">Creative Writing Submission:</h4>
                            ${creativeWritingAnswer.fileUrl ? 
                                creativeWritingAnswer.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? 
                                    `<img src="${creativeWritingAnswer.fileUrl}" class="w-full h-auto object-cover mt-2 rounded" alt="Student Submission" />` :
                                    `<a href="${creativeWritingAnswer.fileUrl}" target="_blank" class="text-blue-500 hover:underline">Download File</a>`
                                : creativeWritingAnswer.studentResponse ? `<p class="italic">${creativeWritingAnswer.studentResponse}</p>` : "No response"}
                            <p class="mt-2"><strong>Status:</strong> ${creativeWritingAnswer.tutorGrade || 'Pending'}</p>
                            ${creativeWritingAnswer.tutorGrade === 'Pending' ? `
                                <textarea class="tutor-report w-full mt-2 p-2 border rounded" rows="3" placeholder="Write your report here..."></textarea>
                                <button class="submit-report-btn bg-green-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit Report</button>
                            ` : `
                                <p class="mt-2"><strong>Tutor's Report:</strong> ${creativeWritingAnswer.tutorReport || 'N/A'}</p>
                            `}
                        </div>
                    </div>
                `;
                if (creativeWritingAnswer.tutorGrade === 'Pending') {
                    pendingHTML += reportCardHTML;
                } else {
                    gradedHTML += reportCardHTML;
                }
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
                    const docRef = doc(db, "student_results", docId);
                    const docSnap = await getDoc(docRef);
                    const docData = docSnap.data();

                    const updatedAnswers = docData.answers.map(a => 
                        a.type === 'creative-writing' ? { ...a, tutorReport: tutorReport, tutorGrade: 'Graded' } : a
                    );

                    await updateDoc(docRef, { answers: updatedAnswers });
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
