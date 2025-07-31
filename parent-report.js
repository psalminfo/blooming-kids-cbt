// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Parse query string
const params = new URLSearchParams(window.location.search);
const studentName = params.get("studentName");
const parentEmail = params.get("email");
const reportDiv = document.getElementById("reportContent");

if (!studentName || !parentEmail) {
  reportDiv.innerHTML = `<p class="text-red-500">Missing student name or email.</p>`;
} else {
  // Fetch report
  db.collection("reports")
    .where("studentName", "==", studentName)
    .where("parentEmail", "==", parentEmail)
    .limit(1)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        reportDiv.innerHTML = `<p class="text-red-500">No report found for this student and email.</p>`;
        return;
      }

      const data = snapshot.docs[0].data();

      // Show summary report text (can be replaced with button to download PDF if needed)
      reportDiv.innerHTML = `
        <p><strong>Name:</strong> ${data.studentName}</p>
        <p><strong>Grade:</strong> ${data.grade}</p>
        <p><strong>Location:</strong> ${data.location}</p>
        <p><strong>Subjects Taken:</strong> ${data.subjects.join(", ")}</p>
        <p><strong>Date:</strong> ${new Date(data.timestamp).toLocaleString()}</p>
        <a href="${data.reportUrl}" target="_blank" class="text-blue-600 underline block mt-4">📄 View/Download PDF Report</a>
      `;
    })
    .catch(error => {
      console.error("Error fetching report:", error);
      reportDiv.innerHTML = `<p class="text-red-500">An error occurred while fetching the report.</p>`;
    });
}
