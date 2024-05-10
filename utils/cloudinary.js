const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Define the uploadFile function
async function uploadFile(file, userId) {
  try {
    const path = file;
    const uniqueFilename = new Date().toISOString();
    const image = await cloudinary.uploader.upload(path, {
      public_id: `AiChatify/${uniqueFilename}/${userId}`,
      tags: `AiChatify`,
    });

    console.log('File uploaded to Cloudinary');
    return image;
  } catch (error) {
    console.error('Error uploading file to Cloudinary:', error);
    throw error;
  }
}

// Export the uploadFile function
module.exports = { uploadFile };
