/**
 * =================================================================
 * Firebase Cloud Function for Tutor Report Submission
 * =================================================================
 *
 * This file contains the backend logic for processing student reports
 * submitted by tutors. It is specifically configured to handle CORS
 * requests from your Netlify-hosted frontend.
 *
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true }); // Enables CORS

// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

exports.processTutorSubmission = functions.https.onRequest((req, res) => {
    // 1. Wrap the function in the 'cors' middleware.
    // This automatically handles the browser's preflight request.
    cors(req, res, async () => {

        // 2. Ensure the request is a POST request.
        if (req.method !== 'POST') {
            return res.status(405).json({
                data: { message: "Method Not Allowed. Please use POST." }
            });
        }

        try {
            // 3. Extract the data payload from the request body.
            const { studentId, reportData, submissionId } = req.body.data;

            if (!studentId || !reportData || !submissionId) {
                console.error("Validation failed: Missing data.", req.body.data);
                return res.status(400).json({
                    data: { message: "Bad Request: Missing required fields." }
                });
            }

            // 4. Fetch the student's document from Firestore.
            const studentRef = db.collection("students").doc(studentId);
            const studentSnap = await studentRef.get();

            if (!studentSnap.exists) {
                console.error(`Student with ID [${studentId}] not found.`);
                return res.status(404).json({
                    data: { message: `Student not found.` }
                });
            }
            const studentData = studentSnap.data();

            // 5. Create the new submission document in Firestore.
            const submissionRef = db.collection("tutor_submissions").doc(submissionId);
            await submissionRef.set({
                studentId: studentId,
                studentName: studentData.studentName,
                parentEmail: studentData.parentEmail || '',
                grade: studentData.grade,
                tutorEmail: studentData.tutorEmail,
                tutorReport: reportData,
                status: 'Graded',
                submittedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 6. Send a successful response.
            console.log(`Successfully created report [${submissionId}] for student [${studentId}].`);
            res.status(200).json({
                data: { message: "Report has been submitted successfully!" }
            });

        } catch (error) {
            // 7. Catch any unexpected errors.
            console.error("CRITICAL ERROR in processTutorSubmission:", error);
            res.status(500).json({
                data: { message: "An internal server error occurred." }
            });
        }
    });
});

