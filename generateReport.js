import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js'; 

const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


async function uploadCreativeWritingFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const res = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) throw new Error("File upload failed");

    const data = await res.json();
    return data.secure_url;
}


export async function submitCreativeWritingToFirebase(studentName, parentEmail, tutorEmail) {
    const loadedQuestions = getLoadedQuestions();
    const creativeWritingQuestion = loadedQuestions.find(q => q.type === 'creative-writing');
    const creativeWritingBlock = creativeWritingQuestion ? document.querySelector(`.question-block[data-question-id="${creativeWritingQuestion.id}"]`) : null;

    if (!creativeWritingBlock) {
        throw new Error("No creative writing question found.");
    }

    const creativeWritingContent = creativeWritingBlock.querySelector('textarea').value.trim();
    const creativeWritingFile = creativeWritingBlock.querySelector('input[type="file"]').files[0];
    
    if (!creativeWritingContent && !creativeWritingFile) {
        throw new Error("Please provide a response or upload a file for the creative writing question.");
    }

    let creativeWritingFileUrl = null;
    if (creativeWritingFile) {
        creativeWritingFileUrl = await uploadCreativeWritingFile(creativeWritingFile);
    }

    const creativeWritingAnswer = {
        questionText: creativeWritingQuestion.question,
        type: 'creative-writing',
        studentResponse: creativeWritingContent || null,
        fileUrl: creativeWritingFileUrl || null,
        tutorGrade: 'Pending'
    };

    // Find the student's in-progress test document
    const resultsRef = collection(db, "student_results");
    const q = query(resultsRef, where("studentName", "==", studentName), where("parentEmail", "==", parentEmail), where("tutorEmail", "==", tutorEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        // Create a new document with just the creative writing for now
        await addDoc(resultsRef, {
            studentName,
            parentEmail,
            tutorEmail,
            answers: [creativeWritingAnswer],
            submittedAt: Timestamp.now()
        });
    } else {
        // Update the existing document
        const docRef = doc(db, "student_results", querySnapshot.docs[0].id);
        const existingAnswers = querySnapshot.docs[0].data().answers;
        const combinedAnswers = creativeWritingAnswer ? [creativeWritingAnswer, ...existingAnswers.filter(a => a.type !== 'creative-writing')] : existingAnswers;
        await updateDoc(docRef, { answers: combinedAnswers });
    }
}


export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry, creativeWritingSubmitted) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let totalScoreableQuestions = 0;

    const questionBlocks = document.querySelectorAll(".question-block");
    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));

        if (originalQuestion.type === 'creative-writing') {
            if (!creativeWritingSubmitted) {
                throw new Error("Please submit the creative writing portion first.");
            }
            continue;
        }

        totalScoreableQuestions++;
        const selectedOption = block.querySelector("input[type='radio']:checked");
        if (!selectedOption) {
            alert("Please answer all multiple-choice questions before submitting.");
            throw new Error("All multiple-choice questions must be answered.");
        }
        
        const studentAnswer = selectedOption.value;
        const correctAnswer = originalQuestion.correct_answer || null;
        const topic = originalQuestion.topic || null;
        const imageUrl = originalQuestion.image_url || null;
        const imagePosition = originalQuestion.image_position || null;
        
        answers.push({
            questionText: originalQuestion.question || null,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: topic,
            imageUrl: imageUrl,
            imagePosition: imagePosition
        });
    }

    const resultsRef = collection(db, "student_results");
    const q = query(resultsRef, where("studentName", "==", studentName), where("parentEmail", "==", parentEmail), where("tutorEmail", "==", tutorEmail));
    const querySnapshot = await getDocs(q);

    const docId = querySnapshot.empty ? null : querySnapshot.docs[0].id;
    const existingAnswers = querySnapshot.empty ? [] : querySnapshot.docs[0].data().answers;
    const creativeWritingAnswer = existingAnswers.find(a => a.type === 'creative-writing');
    const combinedAnswers = creativeWritingAnswer ? [creativeWritingAnswer, ...answers] : answers;
    
    if (docId) {
        const docRef = doc(db, "student_results", docId);
        await updateDoc(docRef, {
            subject,
            grade,
            studentName,
            parentEmail,
            tutorEmail,
            studentCountry,
            answers: combinedAnswers,
            totalScoreableQuestions,
            submittedAt: Timestamp.now()
        });
    } else {
        await addDoc(resultsRef, {
            subject,
            grade,
            studentName,
            parentEmail,
            tutorEmail,
            studentCountry,
            answers: combinedAnswers,
            totalScoreableQuestions,
            submittedAt: Timestamp.now()
        });
    }
}
