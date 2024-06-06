const CryptoJS = require('crypto-js');

// Helper function to pad a string to a specified length
function padToLength(str, length) {
  if (str.length >= length) {
    return str.substring(0, length);
  }
  const padding = '0'.repeat(length - str.length);
  return str + padding;
}

// Encryption function
function encrypt(text, key, outputLength) {
  if (outputLength < 8 || outputLength > 24) {
    throw new Error('Output length must be between 8 and 24');
  }

  const keyUtf8 = CryptoJS.enc.Hex.parse(key);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(text, keyUtf8, { iv: iv });
  const encryptedData = iv
    .concat(encrypted.ciphertext)
    .toString(CryptoJS.enc.Hex);

  const maxLength = outputLength * 2; // each character in hex represents 4 bits, so 2 hex characters per byte
  return padToLength(encryptedData, maxLength);
}

// Decryption function
function decrypt(encryptedData, key) {
  if (encryptedData.length < 32) {
    throw new Error('Invalid encrypted data length');
  }

  const iv = CryptoJS.enc.Hex.parse(encryptedData.substring(0, 32));
  const encryptedText = CryptoJS.enc.Hex.parse(encryptedData.substring(32));

  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: encryptedText },
    CryptoJS.enc.Hex.parse(key),
    { iv: iv },
  );

  return decrypted.toString(CryptoJS.enc.Utf8);
}

// Example usage
const key = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 256-bit key defined by you
const text = '99999999';
const outputLength = 8; // Specify the output length between 8 and 24

try {
  const encrypted = encrypt(text, key, outputLength);
  console.log('Encrypted:', encrypted);

  // To simulate decryption, remove any padding added during encryption
  const decrypted = decrypt(encrypted, key);
  console.log('Decrypted:', decrypted);
} catch (error) {
  console.error('Error:', error.message);
}
