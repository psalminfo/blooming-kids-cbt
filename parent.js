// Firebase config for the 'bloomingkidsassessment' project
firebase.initializeApp({
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
});

const db = firebase.firestore();

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Generates a unique, personalized recommendation using a smart template.
 * It summarizes performance instead of just listing topics.
 * @param {string} studentName The name of the student.
 * @param {string} tutorName The name of the tutor.
 * @param {Array} results The student's test results.
 * @returns {string} A personalized recommendation string.
 */
function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [];
    const weaknesses = [];
    results.forEach(res => {
        const percentage = res.total > 0 ? (res.correct / res.total) * 100 : 0;
        const topicList = res.topics.length > 0 ? res.topics : [res.subject];
        if (percentage >= 75) {
            strengths.push(...topicList);
        } else if (percentage < 50) {
            weaknesses.push(...topicList);
        }
    });

    const uniqueStrengths = [...new Set(strengths)];
    const uniqueWeaknesses = [...new Set(weaknesses)];

    let praiseClause = "";
    if (uniqueStrengths.length > 2) {
        praiseClause = `It was great to see ${studentName} demonstrate a solid understanding of several key concepts, particularly in areas like ${uniqueStrengths[0]} and ${uniqueStrengths[1]}. `;
    } else if (uniqueStrengths.length > 0) {
        praiseClause = `${studentName} showed strong potential, especially in the topic of ${uniqueStrengths.join(', ')}. `;
    } else {
        praiseClause = `${studentName} has put in a commendable effort on this initial assessment. `;
    }

    let improvementClause = "";
    if (uniqueWeaknesses.length > 2) {
        improvementClause = `Our next step will be to focus on building more confidence in a few areas, such as ${uniqueWeaknesses[0]} and ${uniqueWeaknesses[1]}. `;
    } else if (uniqueWeaknesses.length > 0) {
        improvementClause = `To continue this positive progress, our focus will be on the topic of ${uniqueWeaknesses.join(', ')}. `;
    } else {
        improvementClause = "We will continue to build on these fantastic results and explore more advanced topics. ";
    }

    const closingStatement = `With personalized support from their tutor, ${tutorName}, at Blooming Kids House, we are very confident that ${studentName} will master these skills and unlock their full potential.`;

    return praiseClause + improvementClause + closingStatement;
}


async function loadReport() {
    const studentName = document.getElementById("studentName").value.trim().toLowerCase();
    const parentEmail = document.getElementById("parentEmail").value.trim();

    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const loader = document.getElementById("loader");
    const generateBtn = document.getElementById("generateBtn");

    if (!studentName || !parentEmail) {
        alert("Please enter both the student's full name and the parent's email.");
        return;
    }

    loader.classList.remove("hidden");
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";

    try {
        const querySnapshot = await db.collection("student_results").where("parentEmail", "==", parentEmail).get();

        const studentResults = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.studentName && data.studentName.toLowerCase() === studentName) {
                studentResults.push({ ...data,
                    timestamp: data.submittedAt?.seconds || Date.now() / 1000
                });
            }
        });

        if (studentResults.length === 0) {
            alert("No records found. Please check the name and email.");
            loader.classList.add("hidden");
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate Report";
            return;
        }

        const grouped = {};
        studentResults.forEach((result) => {
            // FIX: Group by date instead of by hour (86400 seconds in a day)
            const sessionKey = Math.floor(result.timestamp / 86400); 
            if (!grouped[sessionKey]) grouped[sessionKey] = [];
            grouped[sessionKey].push(result);
        });

        reportContent.innerHTML = "";
        let blockIndex = 0;

        for (const key in grouped) {
            const session = grouped[key];
            const tutorEmail = session[0].tutorEmail || 'N/A';
            const studentCountry = session[0].studentCountry || 'N/A';
            const fullName = capitalize(session[0].studentName);
            const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
                dateStyle: 'long',
                timeStyle: 'short'
            });

            let tutorName = 'N/A';
            if (tutorEmail && tutorEmail !== 'N/A') {
                const tutorDoc = await db.collection("tutors").doc(tutorEmail).get();
                if (tutorDoc.exists) {
                    tutorName = tutorDoc.data().name;
                }
            }

            const results = session.map(testResult => {
                const topics = [...new Set(testResult.answers?.map(a => a.topic).filter(t => t))] || [];
                return {
                    subject: testResult.subject,
                    correct: testResult.score !== undefined ? testResult.score : 0,
                    total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0,
                    topics: topics,
                };
            });

            const tableRows = results.map(res => `<tr><td class="border px-2 py-1">${res.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td></tr>`).join("");
            const topicsTableRows = results.map(res => `<tr><td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td><td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td></tr>`).join("");

            const recommendation = generateTemplatedRecommendation(fullName, tutorName, results);
            const creativeWritingAnswer = session[0].answers.find(a => a.type === 'creative-writing');
            const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.';

            const fullBlock = `
                <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
                    <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
                    <p><strong>Parent Email:</strong> ${parentEmail}</p>
                    <p><strong>Grade:</strong> ${session[0].grade}</p>
                    <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
                    <p><strong>Location:</strong> ${studentCountry || 'N/A'}</p>
                    <p><strong>Session Date:</strong> ${formattedDate}</p>
                    <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
                    <table class="w-full text-sm mb-4 border border-collapse">
                        <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <h3 class="text-lg font-semibold mt-4 mb-2">Knowledge & Skill Analysis</h3>
                    <table class="w-full text-sm mb-4 border border-collapse">
                        <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr></thead>
                        <tbody>${topicsTableRows}</tbody>
                    </table>
                    
                    <h3 class="text-lg font-semibold mt-4 mb-2">Tutor’s Recommendation</h3>
                    <p class="mb-2">${recommendation}</p>

                    <h3 class="text-lg font-semibold mt-4 mb-2">Creative Writing Feedback</h3>
                    <p class="mb-2"><strong>Tutor's Report:</strong> ${tutorReport}</p>

                    <canvas id="chart-${blockIndex}" class="w-full h-48 mb-4"></canvas>
                    <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
                    <p class="italic text-sm">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                    <div class="mt-4"><button onclick="downloadSessionReport(${blockIndex}, '${fullName}')" class="btn-yellow px-4 py-2 rounded">Download Session PDF</button></div>
                </div>
            `;

            reportContent.innerHTML += fullBlock;

            const ctx = document.getElementById(`chart-${blockIndex}`).getContext('2d');
            const subjectLabels = results.map(r => r.subject.toUpperCase());
            const correctScores = results.map(s => s.correct);
            const incorrectScores = results.map(s => s.total - s.correct);

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: subjectLabels,
                    datasets: [{ label: 'Correct Answers', data: correctScores, backgroundColor: '#4CAF50' }, { label: 'Incorrect/Unanswered', data: incorrectScores, backgroundColor: '#FFCD56' }]
                },
                options: {
                    responsive: true,
                    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                    plugins: { title: { display: true, text: 'Score Distribution by Subject' } }
                }
            });

            blockIndex++;
        }

        document.getElementById("inputArea").classList.add("hidden");
        reportArea.classList.remove("hidden");
        document.getElementById("logoutArea").style.display = "flex";

    } catch (error) {
        console.error("Error generating report: ", error);
        alert("A critical error occurred while generating the report.");
    } finally {
        loader.classList.add("hidden");
        generateBtn.disabled = false;
        generateBtn.textContent = "Generate Report";
    }
}

function downloadSessionReport(index, studentName) {
    const element = document.getElementById(`report-block-${index}`);
    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `Assessment_Report_${safeStudentName}_Session_${index + 1}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().from(element).set(opt).save();
}

function logout() {
    window.location.href = "parent.html";
}

document.getElementById("generateBtn").addEventListener("click", loadReport);
