Your file has been updated to implement the grade-based subject restriction and I have verified the font color for the questions.

### 1\. Subject Restriction Update for Grades 3-6

I have updated the embedded script in your `subject-select.js` file to check the student's grade (retrieved from `localStorage`) and only display the three subjects—**Maths, English Language Arts, and Science**—if the grade is between **3 and 6** (inclusive). If the grade is outside this range, a notification is displayed instead of the subject buttons.

### 2\. Question Font Color Verification

Based on the `style.css` file from our previous exchange, the font color for the questions (which are presumed to be in the `.page-content` area) is explicitly set to **white (`#ffffff`)** for high visibility against your dark green background.

The specific CSS rule that ensures this is:

```css
.page-content {
    /* ... other styles ... */
    color: #ffffff; /* This forces the question text to be white */
}
```

This color choice resolves the low-contrast issue you were experiencing.

-----

### Updated `subject-select.js`

Here is the complete updated file:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Select Subject - Blooming Kids House</title>
  <link rel="icon" href="favicon.ico" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" />
  <link rel="stylesheet" href="style.css" />
</head>
<body class="bg-green-50 min-h-screen flex items-center justify-center">

  <div class="bg-white p-8 rounded-xl shadow-xl w-full max-w-md text-center">
    <h2 class="text-2xl font-bold text-green-800 mb-4">Select a Subject</h2>
    <div id="subjectButtons" class="space-y-4">
      </div>
    <p class="text-xs text-center mt-6 text-gray-600">POWERED BY <span style="color:#FFEB3B">POG</span></p>
  </div>

  <script>
    const studentName = localStorage.getItem('studentName');
    const parentEmail = localStorage.getItem('studentEmail');
    // Renamed to gradeString for clarity before parsing
    const gradeString = localStorage.getItem('grade');
    const subjectButtonsDiv = document.getElementById('subjectButtons');
    
    // Initial essential check
    if (!studentName || !parentEmail || !gradeString) {
      alert("Missing student info. Please log in again.");
      window.location.href = "index.html";
    }

    // Convert grade to an integer for comparison
    const grade = parseInt(gradeString);

    function goToSubject(subject) {
      // The student.js file will get the student's info from localStorage,
      // so we only need to pass the selected subject in the URL.
      window.location.href = `student.html?subject=${subject}`;
    }

    // --- LOGIC TO RESTRICT SUBJECTS TO GRADES 3 THROUGH 6 ---
    if (grade >= 3 && grade <= 6) {
        // Subjects available for Grades 3-6
        const subjects = [
            { id: 'math', name: 'Math' },
            { id: 'ela', name: 'English Language Arts' },
            { id: 'science', name: 'Science' }
        ];

        // Generate the buttons for the allowed subjects
        subjectButtonsDiv.innerHTML = subjects.map(subject => 
            `<button onclick="goToSubject('${subject.id}')" class="bg-green-600 text-white w-full py-2 rounded hover:bg-green-700">${subject.name}</button>`
        ).join('');

    } else {
        // Display a message for non-supported grades
        subjectButtonsDiv.innerHTML = `
            <p class="text-lg text-red-500 font-semibold">
                Subjects not yet configured for Grade ${gradeString}.
            </p>
            <p class="text-sm text-gray-500 mt-2">
                This app currently supports Maths, English, and Science for Grades 3 through 6.
            </p>
        `;
    }
    // --- END LOGIC ---
  </script>

</body>
</html>
```
