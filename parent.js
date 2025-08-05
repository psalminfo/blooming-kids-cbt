// parent.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

window.loadReport = async function () {
  const studentName = document.getElementById("studentName").value;
  const parentEmail = document.getElementById("parentEmail").value;

  if (!studentName || !parentEmail) {
    alert("Please enter student name and your email.");
    return;
  }

  const resultsRef = collection(db, "results");
  const q = query(resultsRef, where("studentName", "==", studentName));
  const querySnapshot = await getDocs(q);

  const reportArea = document.getElementById("reportArea");
  const reportList = document.getElementById("reportList");
  reportList.innerHTML = "";

  if (querySnapshot.empty) {
    reportList.innerHTML = `<p class="text-red-600">No reports found for ${studentName}.</p>`;
  } else {
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const reportFile = `${data.studentName}-${data.subject}.pdf`.replace(/\s+/g, "_");
      const fileRef = ref(storage, `reports/${reportFile}`);
      try {
        const url = await getDownloadURL(fileRef);
        const li = document.createElement("li");
        li.innerHTML = `<a href="${url}" download class="text-blue-500 underline">${data.subject} Report</a>`;
        reportList.appendChild(li);
      } catch (error) {
        const li = document.createElement("li");
        li.innerHTML = `<span class="text-red-500">Could not load report for ${data.subject}</span>`;
        reportList.appendChild(li);
      }
    }
  }

  reportArea.classList.remove("hidden");
  document.getElementById("logoutArea").style.display = "flex"; // ✅ Show logout
};

window.logout = function () {
  signOut(auth)
    .then(() => {
      window.location.href = "parent.html";
    })
    .catch((error) => {
      console.error("Logout error:", error);
    });
};
