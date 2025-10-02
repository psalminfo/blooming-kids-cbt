[cite_start]// Firebase config for the 'bloomingkidsassessment' project [cite: 1]
firebase.initializeApp({
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
});
const db = firebase.firestore(); [cite_start]// [cite: 2]

[cite_start]function capitalize(str) { // [cite: 2]
    if (!str) return ""; [cite_start]// [cite: 2]
    return str.replace(/\b\w/g, l => l.toUpperCase()); [cite_start]// [cite: 2]
[cite_start]} // [cite: 3]

/**
 * [cite_start]Generates a unique, personalized recommendation using a smart template. [cite: 3]
 * [cite_start]It summarizes performance instead of just listing topics. [cite: 3]
 * [cite_start]@param {string} studentName The name of the student. [cite: 4]
 * [cite_start]@param {string} tutorName The name of the tutor. [cite: 4]
 * [cite_start]@param {Array} results The student's test results. [cite: 5]
 * [cite_start]@returns {string} A personalized recommendation string. [cite: 6]
 */
[cite_start]function generateTemplatedRecommendation(studentName, tutorName, results) { // [cite: 6]
    const strengths = []; [cite_start]// [cite: 6]
    const weaknesses = []; [cite_start]// [cite: 6]
    [cite_start]results.forEach(res => { // [cite: 7]
        const percentage = res.total > 0 ? (res.correct / res.total) * 100 : 0; [cite_start]// [cite: 7]
        const topicList = res.topics.length > 0 ? res.topics : [res.subject]; [cite_start]// [cite: 7]
        [cite_start]if (percentage >= 75) { // [cite: 7]
            strengths.push(...topicList); [cite_start]// [cite: 7]
        [cite_start]} else if (percentage < 50) { // [cite: 7]
            weaknesses.push(...topicList); [cite_start]// [cite: 7]
        }
    }); [cite_start]// [cite: 8]

    const uniqueStrengths = [...new Set(strengths)]; [cite_start]// [cite: 8]
    const uniqueWeaknesses = [...new Set(weaknesses)]; [cite_start]// [cite: 8]

    let praiseClause = ""; [cite_start]// [cite: 8]
    [cite_start]if (uniqueStrengths.length > 2) { // [cite: 9]
        praiseClause = `It was great to see ${studentName} demonstrate a solid understanding of several key concepts, particularly in areas like ${uniqueStrengths[0]} and ${uniqueStrengths[1]}.`; [cite_start]// [cite: 9, 10]
    [cite_start]} else if (uniqueStrengths.length > 0) { // [cite: 10]
        praiseClause = `${studentName} showed strong potential, especially in the topic of ${uniqueStrengths.join(', ')}.`; [cite_start]// [cite: 10, 11]
    [cite_start]} else { // [cite: 11]
        praiseClause = `${studentName} has put in a commendable effort on this initial assessment.`; [cite_start]// [cite: 11, 12]
    [cite_start]} // [cite: 12]

    let improvementClause = ""; [cite_start]// [cite: 12]
    [cite_start]if (uniqueWeaknesses.length > 2) { // [cite: 12]
        improvementClause = `Our next step will be to focus on building more confidence in a few areas, such as ${uniqueWeaknesses[0]} and ${uniqueWeaknesses[1]}.`; [cite_start]// [cite: 12, 13]
    [cite_start]} else if (uniqueWeaknesses.length > 0) { // [cite: 13]
        improvementClause = `To continue this positive progress, our focus will be on the topic of ${uniqueWeaknesses.join(', ')}.`; [cite_start]// [cite: 13, 14]
    [cite_start]} else { // [cite: 14]
        improvementClause = "We will continue to build on these fantastic results and explore more advanced topics. "; [cite_start]// [cite: 14, 15]
    [cite_start]} // [cite: 15]

    const closingStatement = `With personalized support from their tutor, ${tutorName}, at Blooming Kids House, we are very confident that ${studentName} will master these skills and unlock their full potential.`; [cite_start]// [cite: 15]
    return praiseClause + improvementClause + closingStatement; [cite_start]// [cite: 16]
[cite_start]} // [cite: 16]

[cite_start]async function loadReport() { // [cite: 16]
    [cite_start]// Add CSS for preserving whitespace dynamically [cite: 16]
    [cite_start]if (!document.querySelector('#whitespace-style')) { // [cite: 16]
        const style = document.createElement('style'); [cite_start]// [cite: 16]
        style.id = 'whitespace-style'; [cite_start]// [cite: 17]
        style.textContent = `
            .preserve-whitespace {
                white-space: pre-line !important;
                line-height: 1.6 !important;
            }
        `; [cite_start]// [cite: 17, 18]
        document.head.appendChild(style); [cite_start]// [cite: 19]
    [cite_start]} // [cite: 19]

    const studentName = document.getElementById("studentName").value.trim(); [cite_start]// [cite: 19]
    const parentPhone = document.getElementById("parentPhone").value.trim(); [cite_start]// [cite: 19]

    const reportArea = document.getElementById("reportArea"); [cite_start]// [cite: 19]
    const reportContent = document.getElementById("reportContent"); [cite_start]// [cite: 19]
    const loader = document.getElementById("loader"); [cite_start]// [cite: 20]
    const generateBtn = document.getElementById("generateBtn"); [cite_start]// [cite: 20]

    [cite_start]if (!studentName || !parentPhone) { // [cite: 20]
        alert("Please enter both the student's full name and the parent's phone number."); [cite_start]// [cite: 20]
        return; [cite_start]// [cite: 21]
    [cite_start]} // [cite: 21]

    loader.classList.remove("hidden"); [cite_start]// [cite: 21]
    generateBtn.disabled = true; [cite_start]// [cite: 21]
    generateBtn.textContent = "Generating..."; [cite_start]// [cite: 21]
    [cite_start]try { // [cite: 22]
        [cite_start]// STRICT MATCHING: NAME IS PRIMARY, THEN STRICT PHONE VERIFICATION [cite: 22]
        const normalizedSearchPhone = parentPhone.replace(/\D/g, ''); [cite_start]// [cite: 22]
        [cite_start]// Get ALL students and filter by NAME FIRST (your original system) [cite: 23]
        const allStudentsSnapshot = await db.collection("students").get(); [cite_start]// [cite: 23]
        const matchingStudents = []; [cite_start]// [cite: 24]
        
        [cite_start]allStudentsSnapshot.forEach(doc => { // [cite: 24]
            const studentData = doc.data(); [cite_start]// [cite: 24]
            
            [cite_start]// NAME MATCHING (primary criteria - your original system) [cite: 24]
            const nameMatches = studentData.studentName && 
                studentData.studentName.toLowerCase() === studentName.toLowerCase(); [cite_start]// [cite: 24, 25]
            
            [cite_start]if (nameMatches) { // [cite: 25]
                [cite_start]// STRICT PHONE VERIFICATION (security filter) [cite: 25]
                const studentPhoneDigits = studentData.parentPhone ? studentData.parentPhone.replace(/\D/g, '') : ''; [cite_start]// [cite: 25]
                
                [cite_start]// MODIFIED: Enforce strict equality for phone numbers to prevent partial/incorrect matches. [cite: 26]
                const phoneMatches = studentPhoneDigits && normalizedSearchPhone && 
                                     (studentPhoneDigits === normalizedSearchPhone); [cite_start]// [cite: 26]
            
                [cite_start]if (phoneMatches) { // [cite: 27]
                    [cite_start]matchingStudents.push({ // [cite: 27]
                        [cite_start]id: doc.id, // [cite: 27]
                        [cite_start]...studentData, // [cite: 27]
                        [cite_start]collection: "students" // [cite: 28]
                    }); [cite_start]// [cite: 28]
                [cite_start]} // [cite: 29]
            [cite_start]} // [cite: 29]
        }); [cite_start]// [cite: 29]
        [cite_start]if (matchingStudents.length === 0) { // [cite: 30]
            [cite_start]// Check if name exists but phone doesn't match [cite: 30]
            const studentsWithSameName = []; [cite_start]// [cite: 30]
            [cite_start]allStudentsSnapshot.forEach(doc => { // [cite: 31]
                const studentData = doc.data(); [cite_start]// [cite: 31]
                [cite_start]if (studentData.studentName && studentData.studentName.toLowerCase() === studentName.toLowerCase()) { // [cite: 31]
                    studentsWithSameName.push(studentData.parentPhone || 'No phone registered'); [cite_start]// [cite: 31]
                [cite_start]} // [cite: 31]
            }); [cite_start]// [cite: 31]
            let errorMessage = `No student found with name: ${studentName} and phone number: ${parentPhone}`; [cite_start]// [cite: 32]
            [cite_start]if (studentsWithSameName.length > 0) { // [cite: 33]
                errorMessage += `\n\nFound student(s) with this name but a different phone number was provided.\n`; [cite_start]// [cite: 33]
                errorMessage += `\nPlease check your phone number entry and ensure it matches the one used during registration.`; [cite_start]// [cite: 34, 35]
            [cite_start]} else { // [cite: 35]
                errorMessage += `\n\nPlease check:\n• Spelling of the name\n• Phone number\n• Make sure both match exactly how they were registered`; [cite_start]// [cite: 35, 36]
            [cite_start]} // [cite: 36]

            alert(errorMessage); [cite_start]// [cite: 36]
            loader.classList.add("hidden"); [cite_start]// [cite: 36]
            generateBtn.disabled = false; [cite_start]// [cite: 36]
            generateBtn.textContent = "Generate Report"; [cite_start]// [cite: 37]
            return; [cite_start]// [cite: 37]
        [cite_start]} // [cite: 37]

        [cite_start]// Get reports for the matching students [cite: 37]
        const studentResults = []; [cite_start]// [cite: 37]
        const monthlyReports = []; [cite_start]// [cite: 38]

        [cite_start]// Get assessment reports [cite: 38]
        const assessmentQuery = await db.collection("student_results").get(); [cite_start]// [cite: 38]
        [cite_start]assessmentQuery.forEach(doc => { // [cite: 39]
            const data = doc.data(); [cite_start]// [cite: 39]
            const matchingStudent = matchingStudents.find(s => 
                [cite_start]s.studentName.toLowerCase() === data.studentName?.toLowerCase() // [cite: 39]
            ); [cite_start]// [cite: 39]
            [cite_start]if (matchingStudent) { // [cite: 39]
                [cite_start]studentResults.push({ // [cite: 39]
                    [cite_start]id: doc.id, // [cite: 40]
                    [cite_start]...data, // [cite: 40]
                    timestamp: data.submittedAt?.seconds || [cite_start]Date.now() / 1000, // [cite: 40]
                    [cite_start]type: 'assessment' // [cite: 40]
                }); [cite_start]// [cite: 40]
            [cite_start]} // [cite: 41]
        }); [cite_start]// [cite: 41]
        [cite_start]// Get monthly reports [cite: 42]
        const monthlyQuery = await db.collection("tutor_submissions").get(); [cite_start]// [cite: 42]
        [cite_start]monthlyQuery.forEach(doc => { // [cite: 43]
            const data = doc.data(); [cite_start]// [cite: 43]
            const matchingStudent = matchingStudents.find(s => 
                [cite_start]s.studentName.toLowerCase() === data.studentName?.toLowerCase() // [cite: 43]
            ); [cite_start]// [cite: 43]
            [cite_start]if (matchingStudent) { // [cite: 43]
                [cite_start]monthlyReports.push({ // [cite: 43]
                    [cite_start]id: doc.id, // [cite: 44]
                    [cite_start]...data, // [cite: 44]
                    timestamp: data.submittedAt?.seconds || [cite_start]Date.now() / 1000, // [cite: 44]
                    [cite_start]type: 'monthly' // [cite: 44]
                }); [cite_start]// [cite: 44]
            [cite_start]} // [cite: 45]
        }); [cite_start]// [cite: 45]
        [cite_start]if (studentResults.length === 0 && monthlyReports.length === 0) { // [cite: 46]
            alert(`No reports found for student: ${studentName}\n\nReports may not have been submitted yet.`); [cite_start]// [cite: 46]
            loader.classList.add("hidden"); [cite_start]// [cite: 47]
            generateBtn.disabled = false; [cite_start]// [cite: 47]
            generateBtn.textContent = "Generate Report"; [cite_start]// [cite: 47]
            return; [cite_start]// [cite: 47]
        [cite_start]} // [cite: 47]

        reportContent.innerHTML = ""; [cite_start]// [cite: 47]
        [cite_start]// Display Assessment Reports [cite: 48]
        [cite_start]if (studentResults.length > 0) { // [cite: 48]
            const groupedAssessments = {}; [cite_start]// [cite: 48]
            [cite_start]studentResults.forEach((result) => { // [cite: 49]
                const sessionKey = Math.floor(result.timestamp / 86400); [cite_start]// [cite: 49]
                if (!groupedAssessments[sessionKey]) groupedAssessments[sessionKey] = []; [cite_start]// [cite: 49]
                groupedAssessments[sessionKey].push(result); [cite_start]// [cite: 49]
            }); [cite_start]// [cite: 49]
            let assessmentIndex = 0; [cite_start]// [cite: 50]
            [cite_start]for (const key in groupedAssessments) { // [cite: 50]
                const session = groupedAssessments[key]; [cite_start]// [cite: 50]
                const tutorEmail = session[0].tutorEmail || 'N/A'; [cite_start]// [cite: 51]
                const studentCountry = session[0].studentCountry || 'N/A'; [cite_start]// [cite: 51]
                const fullName = capitalize(session[0].studentName); [cite_start]// [cite: 51]
                [cite_start]const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', { // [cite: 52]
                    [cite_start]dateStyle: 'long', // [cite: 52]
                    [cite_start]timeStyle: 'short' // [cite: 52]
                }); [cite_start]// [cite: 52]
                let tutorName = 'N/A'; [cite_start]// [cite: 53]
                [cite_start]if (tutorEmail && tutorEmail !== 'N/A') { // [cite: 53]
                    [cite_start]try { // [cite: 53]
                        const tutorDoc = await db.collection("tutors").doc(tutorEmail).get(); [cite_start]// [cite: 53]
                        [cite_start]if (tutorDoc.exists) { // [cite: 54]
                            tutorName = tutorDoc.data().name; [cite_start]// [cite: 54]
                        [cite_start]} // [cite: 55]
                    [cite_start]} catch (error) { // [cite: 55]
                        [cite_start]// Silent fail - tutor name will remain 'N/A' [cite: 55]
                    [cite_start]} // [cite: 55]
                [cite_start]} // [cite: 55]

                [cite_start]const results = session.map(testResult => { // [cite: 56]
                    const topics = [...new Set(testResult.answers?.map(a => a.topic).filter(t => t))] || []; [cite_start]// [cite: 56]
                    [cite_start]return { // [cite: 56]
                        [cite_start]subject: testResult.subject, // [cite: 56]
                        [cite_start]correct: testResult.score !== undefined ? testResult.score : 0, // [cite: 57]
                        [cite_start]total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0, // [cite: 57]
                        [cite_start]topics: topics, // [cite: 57]
                    }; [cite_start]// [cite: 57]
                }); [cite_start]// [cite: 58]
                const tableRows = results.map(res => `<tr><td class="border px-2 py-1">${res.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td></tr>`).join(""); [cite_start]// [cite: 59]
                const topicsTableRows = results.map(res => `<tr><td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td><td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td></tr>`).join(""); [cite_start]// [cite: 60]
                const recommendation = generateTemplatedRecommendation(fullName, tutorName, results); [cite_start]// [cite: 61]
                const creativeWritingAnswer = session[0].answers?.find(a => a.type === 'creative-writing'); [cite_start]// [cite: 61]
                const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.'; [cite_start]// [cite: 61, 62]

                const assessmentBlock = `
                    <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${assessmentIndex}">
                        <div class="text-center mb-6 border-b pb-4">
                            <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                                 alt="Blooming Kids House Logo" 
                                 class="h-16 w-auto mx-auto mb-3">
                            <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                            <p class="text-gray-600">Date: ${formattedDate}</p>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                            <div>
                                <p><strong>Student's Name:</strong> ${fullName}</p>
                                <p><strong>Parent's Phone:</strong> ${session[0].parentPhone || 'N/A'}</p>
                                <p><strong>Grade:</strong> ${session[0].grade}</p>
                            </div>
                            <div>
                                <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
                                <p><strong>Location:</strong> ${studentCountry || 'N/A'}</p>
                            </div>
                        </div>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Performance Summary</h3>
                        <table class="w-full text-sm mb-4 border border-collapse">
                            <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Knowledge & Skill Analysis</h3>
                        <table class="w-full text-sm mb-4 border border-collapse">
                            <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr></thead>
                            <tbody>${topicsTableRows}</tbody>
                        </table>
                        
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Tutor's Recommendation</h3>
                        <p class="mb-2 text-gray-700 leading-relaxed">${recommendation}</p>

                        ${creativeWritingAnswer ? `
                        <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3>
                        <p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${tutorReport}</p>
                        ` : ''}

                        ${results.length > 0 ?
                        `
                        <canvas id="chart-${assessmentIndex}" class="w-full h-48 mb-4"></canvas>
                        ` : ''}
                        
                        <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                            <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                            <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed.
                            We believe that with personalized support from our tutors, ${fullName} will unlock their full potential.
                            Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                        </div>
                        
                        <div class="mt-6 text-center">
                            <button onclick="downloadSessionReport(${assessmentIndex}, '${fullName}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                Download Assessment PDF
                            </button>
                        </div>
                    </div>
                `; [cite_start]// [cite: 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81]
                reportContent.innerHTML += assessmentBlock; [cite_start]// [cite: 82]

                [cite_start]// Create chart for assessment results only if there are results [cite: 82]
                [cite_start]if (results.length > 0) { // [cite: 82]
                    const ctx = document.getElementById(`chart-${assessmentIndex}`); [cite_start]// [cite: 82]
                    [cite_start]if (ctx) { // [cite: 83]
                        const subjectLabels = results.map(r => r.subject.toUpperCase()); [cite_start]// [cite: 83]
                        const correctScores = results.map(s => s.correct); [cite_start]// [cite: 84]
                        const incorrectScores = results.map(s => s.total - s.correct); [cite_start]// [cite: 84]
                        [cite_start]new Chart(ctx, { // [cite: 85]
                            [cite_start]type: 'bar', // [cite: 85]
                            [cite_start]data: { // [cite: 85]
                                [cite_start]labels: subjectLabels, // [cite: 85]
                                [cite_start]datasets: [{ label: 'Correct Answers', data: correctScores, backgroundColor: '#4CAF50' }, { label: 'Incorrect/Unanswered', data: incorrectScores, backgroundColor: '#FFCD56' }] // [cite: 86]
                            [cite_start]}, // [cite: 86]
                            [cite_start]options: { // [cite: 86]
                                [cite_start]responsive: true, // [cite: 87]
                                [cite_start]scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }, // [cite: 87]
                                [cite_start]plugins: { title: { display: true, text: 'Score Distribution by Subject' } } // [cite: 88]
                            [cite_start]} // [cite: 88]
                        }); [cite_start]// [cite: 88]
                    [cite_start]} // [cite: 89]
                [cite_start]} // [cite: 89]

                assessmentIndex++; [cite_start]// [cite: 89]
            [cite_start]} // [cite: 90]
        [cite_start]} // [cite: 90]

        [cite_start]// Display Monthly Reports [cite: 90]
        [cite_start]if (monthlyReports.length > 0) { // [cite: 90]
            const groupedMonthly = {}; [cite_start]// [cite: 90]
            [cite_start]monthlyReports.forEach((result) => { // [cite: 91]
                const sessionKey = Math.floor(result.timestamp / 86400); [cite_start]// [cite: 91]
                if (!groupedMonthly[sessionKey]) groupedMonthly[sessionKey] = []; [cite_start]// [cite: 91]
                groupedMonthly[sessionKey].push(result); [cite_start]// [cite: 91]
            }); [cite_start]// [cite: 91]
            let monthlyIndex = 0; [cite_start]// [cite: 92]
            [cite_start]for (const key in groupedMonthly) { // [cite: 92]
                const session = groupedMonthly[key]; [cite_start]// [cite: 92]
                const fullName = capitalize(session[0].studentName); [cite_start]// [cite: 93]
                [cite_start]const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', { // [cite: 93]
                    [cite_start]dateStyle: 'long', // [cite: 93]
                    [cite_start]timeStyle: 'short' // [cite: 93]
                }); [cite_start]// [cite: 93]
                [cite_start]session.forEach((monthlyReport, reportIndex) => { // [cite: 94]
                    const monthlyBlock = `
                        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${monthlyIndex}">
                            <div class="text-center mb-6 border-b pb-4">
                                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                                     alt="Blooming Kids House Logo" 
                                     class="h-16 w-auto mx-auto mb-3">
                                <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                                <p class="text-gray-600">Date: ${formattedDate}</p>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                                <div>
                                    <p><strong>Student's Name:</strong> ${monthlyReport.studentName || 'N/A'}</p>
                                    <p><strong>Parent's Name:</strong> ${monthlyReport.parentName || 'N/A'}</p>
                                    <p><strong>Parent's Phone:</strong> ${monthlyReport.parentPhone || 'N/A'}</p>
                                </div>
                                <div>
                                    <p><strong>Grade:</strong> ${monthlyReport.grade || 'N/A'}</p>
                                    <p><strong>Tutor's Name:</strong> ${monthlyReport.tutorName || 'N/A'}</p>
                                </div>
                            </div>

                            ${monthlyReport.introduction ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">INTRODUCTION</h3>
                                <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.introduction}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.topics ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3>
                                <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.topics}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.progress ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3>
                                <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.progress}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.strengthsWeaknesses ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3>
                                <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.strengthsWeaknesses}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.recommendations ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3>
                                <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.recommendations}</p>
                            </div>
                            ` : ''}

                            ${monthlyReport.generalComments ? `
                            <div class="mb-6">
                                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3>
                                <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.generalComments}</p>
                            </div>
                            ` : ''}

                            <div class="text-right mt-8 pt-4 border-t">
                                <p class="text-gray-600">Best regards,</p>
                                <p class="font-semibold text-green-800">${monthlyReport.tutorName || 'N/A'}</p>
                            </div>

                            <div class="mt-6 text-center">
                                <button onclick="downloadMonthlyReport(${monthlyIndex}, '${fullName}')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                    Download Monthly Report PDF
                                </button>
                            </div>
                        </div>
                    `; [cite_start]// [cite: 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119]
                    reportContent.innerHTML += monthlyBlock; [cite_start]// [cite: 120]
                    monthlyIndex++; [cite_start]// [cite: 120]
                }); [cite_start]// [cite: 120]
            [cite_start]} // [cite: 120]
        [cite_start]} // [cite: 120]

        document.getElementById("inputArea").classList.add("hidden"); [cite_start]// [cite: 120]
        reportArea.classList.remove("hidden"); [cite_start]// [cite: 121]
        document.getElementById("logoutArea").style.display = "flex"; [cite_start]// [cite: 121]

    [cite_start]} catch (error) { // [cite: 121]
        alert("Sorry, there was an error generating the report. Please try again."); [cite_start]// [cite: 121]
    [cite_start]} finally { // [cite: 122]
        loader.classList.add("hidden"); [cite_start]// [cite: 122]
        generateBtn.disabled = false; [cite_start]// [cite: 122]
        generateBtn.textContent = "Generate Report"; [cite_start]// [cite: 122]
    [cite_start]} // [cite: 123]
[cite_start]} // [cite: 123]

[cite_start]function downloadSessionReport(index, studentName, type) { // [cite: 123]
    const element = document.getElementById(`${type}-block-${index}`); [cite_start]// [cite: 123]
    const safeStudentName = studentName.replace(/ /g, '_'); [cite_start]// [cite: 123]
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}.pdf`; [cite_start]// [cite: 124]
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }; [cite_start]// [cite: 125]
    html2pdf().from(element).set(opt).save(); [cite_start]// [cite: 126]
[cite_start]} // [cite: 126]

[cite_start]function downloadMonthlyReport(index, studentName) { // [cite: 126]
    downloadSessionReport(index, studentName, 'monthly'); [cite_start]// [cite: 126]
[cite_start]} // [cite: 126]

[cite_start]function logout() { // [cite: 126]
    window.location.href = "parent.html"; [cite_start]// [cite: 126]
[cite_start]} // [cite: 127]

[cite_start]// Initialize the page [cite: 127]
[cite_start]document.addEventListener('DOMContentLoaded', function() { // [cite: 127]
    [cite_start]// Check if we have URL parameters (coming from login) [cite: 127]
    const urlParams = new URLSearchParams(window.location.search); [cite_start]// [cite: 127]
    const studentFromUrl = urlParams.get('student'); [cite_start]// [cite: 127]
    const phoneFromUrl = url.params.get('phone'); [cite_start]// [cite: 127]
    
    [cite_start]if (studentFromUrl && phoneFromUrl) { // [cite: 127]
        document.getElementById('studentName').value = studentFromUrl; [cite_start]// [cite: 127]
        document.getElementById('parentPhone').value = phoneFromUrl; [cite_start]// [cite: 127]
    [cite_start]} // [cite: 127]
    
    document.getElementById("generateBtn").addEventListener("click", loadReport); [cite_start]// [cite: 127]
});
