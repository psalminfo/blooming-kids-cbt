import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Form submission
document.getElementById("parentLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  const statusMessage = document.getElementById("statusMessage");
  statusMessage.textContent = "Searching for report...";

  try {
    const reportsRef = collection(db, "studentResults");
    const q = query(reportsRef, where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      statusMessage.textContent = "No report found. Please check the name and email.";
      return;
    }

    let found = false;
    snapshot.forEach(async (doc) => {
      const data = doc.data();
      const reportPath = data.reportPath;

      if (reportPath) {
        const url = await getDownloadURL(ref(storage, reportPath));
        window.open(url, "_blank");
        statusMessage.textContent = "Report opened in a new tab.";
        found = true;
      }
    });

    if (!found) {
      statusMessage.textContent = "Report exists but cannot be accessed.";
    }
  } catch (error) {
    console.error("Error fetching report:", error);
    statusMessage.textContent = "An error occurred. Please try again later.";
  }
});
