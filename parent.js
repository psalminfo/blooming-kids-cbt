document.addEventListener("DOMContentLoaded", () => {
  const db = firebase.firestore();

  const childNameInput = document.getElementById("childName");
  const parentEmailInput = document.getElementById("parentEmail");
  const searchBtn = document.getElementById("searchBtn");
  const resultContainer = document.getElementById("resultContainer");

  const logoutBtn = document.getElementById("logoutBtn");

  logoutBtn.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "login-parent.html";
  });

  searchBtn.addEventListener("click", () => {
    const child = childNameInput.value.trim();
    const email = parentEmailInput.value.trim();

    if (!child || !email) return alert("Please fill both fields.");

    resultContainer.innerHTML = "Loading...";

    db.collection("testResults")
      .where("student", "==", child)
      .where("parent", "==", email)
      .get()
      .then((snapshot) => {
        if (snapshot.empty) {
          resultContainer.innerHTML = "<p>No reports found.</p>";
        } else {
          resultContainer.innerHTML = "";
          snapshot.forEach((doc) => {
            const data = doc.data();
            const div = document.createElement("div");
            div.className = "bg-white shadow rounded p-3 mb-3";
            div.innerHTML = `
              <h3>${data.subject}</h3>
              <p>Score: ${data.correct}/${data.total}</p>
              <p>Percentage: ${data.percentage}%</p>
              <p>Date: ${new Date(data.timestamp).toLocaleString()}</p>
            `;
            resultContainer.appendChild(div);
          });
        }
      })
      .catch((err) => {
        console.error(err);
        resultContainer.innerHTML = "<p>Error loading reports.</p>";
      });
  });
});
