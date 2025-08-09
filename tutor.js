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
            <div id="studentCount" class="text-center font-bold text-lg"></div>
        </div>

        <div id="reportsContainer" class="space-y-4">
            <p class="text-gray-500">Loading reports...</p>
        </div>
    `;

    document.getElementById('searchBtn').addEventListener('click', async () => {
        const email = document.getElementById('searchEmail').value.trim();
        await loadTutorReports(tutor.email, email || null);
    });

    loadTutorReports(tutor.email);
    loadStudentCount(tutor.email);
}

async function loadStudentCount(tutorEmail) {
    const studentCount = document.getElementById('studentCount');
    const querySnapshot = await getDocs(query(collection(db, "student_results"), where("tutorEmail", "==", tutorEmail)));
    studentCount.textContent = `Total Student Reports: ${querySnapshot.docs.length}`;
}

async function loadTutorReports(tutorEmail, parentEmail = null) {
    const reportsContainer = document.getElementById('reportsContainer');
    reportsContainer.innerHTML = `<p class="text-gray-500">Loading reports...</p>`;
    
    let resultsQuery = query(collection(db, "student_results"), where("tutorEmail", "==", tutorEmail));
    if (parentEmail) {
        resultsQuery = query(resultsQuery, where("parentEmail", "==", parentEmail));
    }
    
    try {
        const querySnapshot = await getDocs(resultsQuery);
        let reportHTML = '';

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const creativeWritingAnswer = data.answers.find(a => a.type === 'creative-writing');
            
            let correctCount = 0;
            data.answers.forEach(answerObject => {
                if (answerObject.type !== 'creative-writing' && String(answerObject.studentAnswer).toLowerCase() === String(answerObject.correctAnswer).toLowerCase()) {
                    correctCount++;
                }
            });
            const totalScoreable = data.totalScoreableQuestions;
            const topics = [...new Set(data.answers.map(a => a.topic).filter(t => t))];

            reportHTML += `
                <div class="border rounded-lg p-4 shadow-sm bg-white mb-6">
                    <h4 class="text-xl font-semibold">Student: ${data.studentName} (${data.subject.toUpperCase()})</h4>
                    <p><strong>Grade:</strong> ${data.grade}</p>
                    <p><strong>Submitted At:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                    <h5 class="font-semibold mt-4">Performance: <span class="text-green-600">${correctCount} / ${totalScoreable}</span></h5>
                    
                    <h5 class="font-semibold mt-4">Topics:</h5>
                    <p>${topics.join(', ') || 'N/A'}</p>

                    ${creativeWritingAnswer ? `
                        <div class="mt-4 border-t pt-4">
                            <h4 class="font-semibold">Creative Writing Submission:</h4>
                            <p class="italic">${creativeWritingAnswer.studentResponse || "No response"}</p>
                            ${creativeWritingAnswer.fileUrl ? `<a href="${creativeWritingAnswer.fileUrl}" target="_blank" class="text-blue-500 hover:underline">Download File</a>` : ''}
                            <p class="mt-2"><strong>Status:</strong> ${creativeWritingAnswer.tutorGrade || 'Pending'}</p>
                            ${creativeWritingAnswer.tutorGrade === 'Pending' ? `
                                <textarea class="creative-writing-report w-full mt-2 p-2 border rounded" rows="3" placeholder="Write your report here..."></textarea>
                                <button class="submit-creative-writing-report-btn bg-green-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit Creative Writing Report</button>
                            ` : `
                                <p class="mt-2"><strong>Tutor's Report:</strong> ${creativeWritingAnswer.tutorReport || 'N/A'}</p>
                            `}
                        </div>
                    ` : ''}
                    
                    <div class="mt-4 border-t pt-4">
                        <h4 class="font-semibold">General Tutor Comment</h4>
                        <textarea class="general-tutor-comment w-full mt-2 p-2 border rounded" rows="3" placeholder="Leave a general comment here...">${data.generalTutorComment || ''}</textarea>
                        <button class="submit-general-comment-btn bg-blue-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit General Comment</button>
                    </div>
                </div>
            `;
        });

        reportsContainer.innerHTML = reportHTML || `<p class="text-gray-500">No reports found.</p>`;

        document.querySelectorAll('.submit-creative-writing-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-doc-id');
                const reportTextarea = e.target.closest('.border').querySelector('.creative-writing-report');
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

        document.querySelectorAll('.submit-general-comment-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-doc-id');
                const commentTextarea = e.target.closest('.border').querySelector('.general-tutor-comment');
                const generalComment = commentTextarea.value.trim();

                const docRef = doc(db, "student_results", docId);
                await updateDoc(docRef, { generalTutorComment: generalComment });
                alert("General comment saved!");
            });
        });

    } catch (error) {
        console.error("Error loading tutor reports:", error);
        reportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
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
