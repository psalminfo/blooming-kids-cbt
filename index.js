// At the top of your functions/index.js file
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true }); // Initialize cors

admin.initializeApp();
const db = admin.firestore();

// Your updated function
exports.processTutorSubmission = functions.https.onRequest((req, res) => {
    // Wrap your function logic in the cors middleware
    cors(req, res, async () => {
        // Check for POST request. The preflight is an OPTIONS request.
        if (req.method !== 'POST') {
            return res.status(405).send('Method Not Allowed');
        }

        try {
            const { studentId, reportData, submissionId } = req.body.data;

            // --- Your existing logic here ---
            // Example: Get student data
            const studentRef = db.collection("students").doc(studentId);
            const studentSnap = await studentRef.get();
            if (!studentSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Student not found.');
            }
            const studentData = studentSnap.data();

            // Create the submission document
            const submissionRef = db.collection("tutor_submissions").doc(submissionId);
            await submissionRef.set({
                studentId: studentId,
                studentName: studentData.studentName,
                parentEmail: studentData.parentEmail || '', // Make sure student has parentEmail
                grade: studentData.grade,
                tutorEmail: studentData.tutorEmail,
                tutorReport: reportData, // The structured report object
                status: 'Graded', // Or whatever status you prefer
                submittedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // --- End of your logic ---

            // Send a success response
            res.status(200).send({ data: { message: "Report submitted successfully!" } });

        } catch (error) {
            console.error("Error processing submission:", error);
            // Send an error response
            res.status(500).send({ data: { message: `Error submitting report: ${error.message}` } });
        }
    });
});
