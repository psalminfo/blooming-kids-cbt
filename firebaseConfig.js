import { getDocs, collection, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebaseConfig.js";

async function bulkDeleteReports() {
  const snapshot = await getDocs(collection(db, 'reports'));
  const promises = [];

  snapshot.forEach(report => {
    promises.push(deleteDoc(doc(db, 'reports', report.id)));
  });

  await Promise.all(promises);
  alert("All reports deleted successfully.");
}

bulkDeleteReports();
