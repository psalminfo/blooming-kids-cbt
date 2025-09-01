/**
 * =================================================================
 * Firebase Cloud Function for Tutor Report Submission
 * =================================================================
 *
 * This file contains the backend logic for processing student reports
 * submitted by tutors.
 *
 * Key Features:
 * - Handles Cross-Origin Resource Sharing (CORS) to allow requests
 * from your Netlify frontend.
 * - Validates incoming requests to ensure they are secure.
 * - Fetches student data from Firestore.
 * - Saves the complete, structured report to the 'tutor_submissions'
 * collection.
 * - Provides clear success or error feedback to the frontend.
 *
 */

// Import required Firebase and Node.js modules.
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true }); // This is the crucial part for CORS.

// Initialize the Firebase Admin SDK to interact with Firebase services.
admin.initializeApp();
const db = admin.firestore();

/**
 * @name processTutorSubmission
 * @description An HTTP-triggered Cloud Function that receives report data,
 * validates it, and saves it to Firestore.
 * @triggers HTTP Request
 */
exports.processTutorSubmission = functions.https.onRequest((req, res) => {
    // 1. Wrap the entire function in the 'cors' middleware.
    // This automatically handles the browser's preflight (OPTIONS) request
    // and adds the required 'Access-Control-Allow-Origin' header to the response.
    cors(req, res, async () => {

        // 2. Security Check: Ensure the request is a POST request.
        // We only want to allow data to be sent to this function, not retrieved.
        if (req.method !== 'POST') {
            return res.status(405).json({
                data: { message: "Method Not Allowed. Please use POST." }
            });
        }

        try {
            // 3. Extract the data payload from the request body.
            // The Firebase client SDK automatically wraps it in a 'data' object.
            const { studentId, reportData, submissionId } = req.body.data;

            // 4. Input Validation: Check if all required data is present.
            if (!studentId || !reportData || !submissionId) {
                console.error("Validation failed: Missing data in payload.", req.body.data);
                return res.status(400).json({
                    data: { message: "Bad Request: Missing required fields (studentId, reportData, or submissionId)." }
                });
            }

            // 5. Fetch the corresponding student document from Firestore.
            const studentRef = db.collection("students").doc(studentId);
            const studentSnap = await studentRef.get();

            if (!studentSnap.exists) {
                console.error(`Student with ID [${studentId}] not found.`);
                return res.status(404).json({
                    data: { message: `Student with ID [${studentId}] was not found.` }
                });
            }
            const studentData = studentSnap.data();

            // 6. Create the new submission document in the 'tutor_submissions' collection.
            const submissionRef = db.collection("tutor_submissions").doc(submissionId);
            await submissionRef.set({
                studentId: studentId,
                studentName: studentData.studentName,
                parentEmail: studentData.parentEmail || '', // Fallback to empty string if missing
                grade: studentData.grade,
                tutorEmail: studentData.tutorEmail,
                tutorReport: reportData, // Embed the entire structured report object
                status: 'Graded',
                submittedAt: admin.firestore.FieldValue.serverTimestamp() // Use the server's time
            });

            // 7. Send a successful response back to the client.
            console.log(`Successfully created report [${submissionId}] for student [${studentId}].`);
            res.status(200).json({
                data: { message: "Report has been submitted successfully!" }
            });

        } catch (error) {
            // 8. Catch any unexpected errors, log them for debugging, and send a generic error message.
            console.error("CRITICAL ERROR in processTutorSubmission:", error);
            res.status(500).json({
                data: { message: "An internal server error occurred. Please try again later." }
            });
        }
    });
});

