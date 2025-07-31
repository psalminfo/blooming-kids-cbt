export async function uploadPDFtoCloudinary(fileBlob) {
  const formData = new FormData();
  formData.append("file", fileBlob);
  formData.append("upload_preset", "unsigned_reports");

  const response = await fetch("https://api.cloudinary.com/v1_1/dcxnd7vnb/raw/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Upload failed to Cloudinary");
  }

  const data = await response.json();
  return data.secure_url;
}
