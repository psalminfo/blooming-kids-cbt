import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js'; 

export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorEmail, studentCountry) {
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    let creativeWritingContent = null;
    let creativeWritingFileUrl = null;
    let totalScoreableQuestions = 0;

    const creativeWritingQuestion = loadedQuestions.find(q => q.type === 'creative-writing');
    const creativeWritingBlock = creativeWritingQuestion ? document.querySelector(`.question-block[data-question-id="${creativeWritingQuestion.id}"]`) : null;
    
    if (creativeWritingBlock) {
        creativeWritingContent = creativeWritingBlock.querySelector('textarea').value.trim();
        const creativeWritingFile = creativeWritingBlock.querySelector('input[type="file"]').files[0];
        
        if (!creativeWritingContent && !creativeWritingFile) {
            alert("Please provide a response or upload a file for the creative writing question.");
            throw new Error("Creative writing submission required.");
        }
        if (creativeWritingFile) {
            // Placeholder for Cloudinary upload logic for creative writing files
            // You must implement this with your Cloudinary credentials
            // creativeWritingFileUrl = await uploadCreativeWritingFile(creativeWritingFile);
        }
    }

    const questionBlocks = document.querySelectorAll(".question-block");
    for (const block of questionBlocks) {
        const questionId = block.getAttribute('data-question-id');
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));

        if (originalQuestion.type === 'creative-writing') {
            answers.push({
                questionText: originalQuestion.question,
                type: 'creative-writing',
                studentResponse: creativeWritingContent,
                fileUrl: creativeWritingFileUrl,
                tutorGrade: 'Pending'
            });
            continue;
        }

        totalScoreableQuestions++;
        const selectedOption = block.querySelector("input[type='radio']:checked");
        if (!selectedOption) {
            alert("Please answer all multiple-choice questions before submitting.");
            throw new Error("All multiple-choice questions must be answered.");
        }
        
        const studentAnswer = selectedOption.value;
        const correctAnswer = originalQuestion.correct_answer;
        const topic = originalQuestion.topic;
        const imageUrl = originalQuestion.image_url;
        const imagePosition = originalQuestion.image_position;
        
        answers.push({
            questionText: originalQuestion.question,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: topic,
            imageUrl: imageUrl,
            imagePosition: imagePosition
        });
    }

    const resultData = {
        subject,
        grade,
        studentName,
        parentEmail,
        tutorEmail,
        studentCountry,
        answers,
        totalScoreableQuestions,
        submittedAt: Timestamp.now()
    };

    try {
        await addDoc(collection(db, "student_results"), resultData);
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        throw new Error("Failed to submit test results.");
    }
}