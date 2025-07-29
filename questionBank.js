async function fetchQuestions({ subject, grade, curriculum = "UK" }) {
  const allQuestions = [];

  // 1. 🔹 Try manual uploads from Firestore (admin-uploaded)
  const manualSnapshot = await firebase.firestore()
    .collection("manualQuestions")
    .where("subject", "==", subject)
    .where("grade", "==", grade)
    .get();

  manualSnapshot.forEach(doc => allQuestions.push(...doc.data().questions));

  // 2. 🔹 Try GitHub curriculum JSON
  try {
    const githubUrl = `https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/YOUR_REPO/main/curriculum/${curriculum.toLowerCase()}.json`;
    const res = await fetch(githubUrl);
    if (res.ok) {
      const githubData = await res.json();
      const questions = githubData[grade]?.[subject];
      if (questions && questions.length) {
        allQuestions.push(...questions);
      }
    }
  } catch (err) {
    console.warn("GitHub questions fetch failed:", err);
  }

  // 3. 🔹 Try auto-generated fallback (stored in Firestore)
  const autoSnapshot = await firebase.firestore()
    .collection("autoQuestions")
    .where("subject", "==", subject)
    .where("grade", "==", grade)
    .get();

  autoSnapshot.forEach(doc => allQuestions.push(...doc.data().questions));

  // Final shuffle & trim to 30
  return limitQuestions(allQuestions, 30);
}
