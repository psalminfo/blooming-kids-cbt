// Process all questions (both MC and text)
const questionBlocks = document.querySelectorAll(".question-block");
for (const block of questionBlocks) {
    const questionId = block.getAttribute('data-question-id');
    const originalQuestion = loadedQuestions.find(q => q.id === parseInt(questionId));

    if (!originalQuestion) {
        continue;
    }

    const selectedOption = block.querySelector("input[type='radio']:checked");
    const textResponse = block.querySelector("textarea, input[type='text']");
    
    let studentAnswer = '';
    let answerType = 'unanswered';
    
    // Get answer from either MC option OR text response
    if (selectedOption) {
        studentAnswer = selectedOption.value;
        answerType = 'multiple_choice';
        totalScoreableQuestions++; // Only score MC questions
        
        const correctAnswer = originalQuestion.correctAnswer || originalQuestion.correct_answer || null;
        if (studentAnswer === correctAnswer) {
            score++;
        }
    } else if (textResponse && textResponse.value.trim() !== '') {
        studentAnswer = textResponse.value.trim();
        answerType = 'text_response';
        // Text responses are not auto-scored
    }

    answers.push({
        questionText: originalQuestion.question || null,
        studentAnswer: studentAnswer,
        correctAnswer: originalQuestion.correctAnswer || originalQuestion.correct_answer || null,
        answerType: answerType,
        topic: originalQuestion.topic || null,
        imageUrl: originalQuestion.imageUrl || null,
        imagePosition: originalQuestion.imagePosition || null
    });
}
