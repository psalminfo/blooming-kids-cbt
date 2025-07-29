export function calculateLetterGrade(percent) {
  const score = parseFloat(percent);
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function formatDate(timestamp) {
  const date = timestamp.toDate();
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
