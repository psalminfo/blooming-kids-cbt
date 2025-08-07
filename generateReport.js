import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getLoadedQuestions } from './autoQuestionGen.js';

export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorName, location) {
    // 1. Get the questions that were loaded and displayed on the page.
    const loadedQuestions = getLoadedQuestions();
    const answers = [];
    const questionBlocks = document.querySelectorAll(".question-block");

    // 2. Loop through each question block to get the student's answer and the correct answer.
    for (let i = 0; i < questionBlocks.length; i++) {
        const block = questionBlocks[i];
        const questionText = block.querySelector(".question-text").innerText.trim();
        const selectedOption = block.querySelector("input[type='radio']:checked");
        
        // Use the unique ID from the HTML to find the correct question.
        const questionId = block.getAttribute('data-question-id');

        const studentAnswer = selectedOption ? selectedOption.value : "No answer";

        // 3. Find the original question object using the ID. This is the key step.
        const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));
        
        // 4. Extract the correct answer and topic from the found question object.
        const correctAnswer = originalQuestion ? originalQuestion.correct_answer : 'N/A';
        const topic = originalQuestion ? originalQuestion.topic : 'N/A';

        // 5. Create a detailed object for this answer and add it to the array.
        answers.push({
            questionText: questionText,
            studentAnswer: studentAnswer,
            correctAnswer: correctAnswer,
            topic: topic
        });
    }

    const resultData = {
        subject,
        grade,
        studentName,
        parentEmail,
        tutorName,
        location,
        answers,
        submittedAt: Timestamp.now()
    };

    try {
        await addDoc(collection(db, "student_results"), resultData);
    } catch (err) {
        console.error("Error submitting test results to Firebase:", err);
        throw new Error("Failed to submit test results.");
    }
}
