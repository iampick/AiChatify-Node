const axios = require('axios');

// Define the getImageBinary function
async function getImageBinary(messageId, LINE_HEADER) {
  try {
    const originalImage = await axios({
      method: 'get',
      headers: LINE_HEADER,
      url: `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      responseType: 'arraybuffer',
    });
    return originalImage.data;
  } catch (error) {
    console.error('Error fetching image binary:', error);
    throw error;
  }
}

// Export the getImageBinary function
module.exports = getImageBinary;
