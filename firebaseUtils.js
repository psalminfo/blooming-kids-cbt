export const getSmartData = async (collectionName, lastDoc = null) => {
  const ref = collection(db, collectionName);
  let q;
  
  if (lastDoc) {
    // If we already have a page, start after it
    q = query(ref, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(20));
  } else {
    // First time loading the page
    q = query(ref, orderBy("createdAt", "desc"), limit(20));
  }
  
  return await getDocs(q);
};
