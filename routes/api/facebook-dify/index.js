const axios = require('axios');
const express = require('express');
const router = express.Router();

const getImageBinary = require('../../../utils/getImageBinary');
const { uploadFile } = require('../../../utils/cloudinary');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMessage, setTypingOff, setTypingOn } = require('./messengerApi');

const config = {
  accessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET_TOKEN,
};

const LineHeader = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${config.accessToken}`,
};

// console.log(client);
router.get('/', (req, res) => {
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOEKN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

router.post('/', async (req, res) => {
  if (process.env.FACEBOOK_BOT !== 'on') {
    res.status(200).json({ message: 'Hello API' });
    return true;
  }

  const data_raw = req.body;
  let retrieveMsg = '';
  let imageParts = '';
  let files = [];
  let retrieveImage = '';
  let userId = '';
  let senderId = '';

  // console.log(data_raw);
  // return res.status(200).json({ message: 'Hello API from GET' });

  try {
    let body = req.body;
    senderId = body.entry[0].messaging[0].sender.id;
    userId = senderId;

    // retrieveMsg = body.entry[0].messaging[0].message.text;
    retrieveMsg = await findTextAndUrl(body).text;
    imageParts = await findTextAndUrl(body).url;

    if (imageParts !== '') {
      files = [
        {
          type: 'image',
          transfer_method: 'remote_url',
          url: imageParts,
          upload_file_id: '',
        },
      ];
    }
    // const host = req.hostname;
    // let requestUrl = `https://${host}/sendMessage`;
    // callSendMessage(requestUrl, senderId, query);
    // console.log(senderId, query);
    // console.log(body.entry[0].messaging[0]);

    // // logTextAndUrl(body);
    // console.log(findTextAndUrl(body).url);
    // console.log(findTextAndUrl(body).text);
  } catch (error) {
    console.log(error);
  }
  // res.status(200).json({ message: 'Hello API' });

  // return true;
  let conversionId = '';

  const last8Chars = process.env.DIFY_API_KEY.slice(-8);

  // Query to get all todos from the "todo" table
  const userInDb = await prisma.UserConv.findFirst({
    where: {
      userId: userId,
      apiId: last8Chars,
    },
    orderBy: {
      id: 'desc',
    },
    take: 1,
  });

  // console.log(userId);
  // console.log(last8Chars);
  // console.log(userInDb);
  if (userInDb) {
    conversionId = userInDb.conversionId;
  }

  let dataToAi = JSON.stringify({
    message: retrieveMsg,
    userId: userId,
    conversionId: conversionId,
    files: files,
  });

  // console.log(dataToAi);

  // res.status(200).json({ message: 'Hello API' });

  // return true;

  await setTypingOn(senderId);
  connectDify(dataToAi)
    .then(async (response) => {
      // Assuming `response.data` is a stringified JSON that looks like the given output.

      const rawData = response.replace(/\*/g, '');
      const dataParts = rawData
        .split('\n')
        .filter((part) => part.startsWith('data:'));

      // Define an object to hold the extracted information.
      let extractedData = {
        conversation_ids: new Set(), // Use a Set to avoid duplicate IDs
        answers: [],
      };

      // console.log(dataParts.answer);
      dataParts.forEach((part) => {
        const jsonPart = part.substring(6); // Remove 'data: ' prefix

        try {
          const parsedObj = JSON.parse(jsonPart);

          // Add the conversation_id to the Set (duplicates will be ignored)
          extractedData.conversation_ids.add(parsedObj.conversation_id);

          extractedData.answers.push(parsedObj.answer || ''); // Use empty string if undefined
        } catch (error) {
          console.error('Failed to parse JSON:', jsonPart, 'Error:', error);
          // Handle parse error or continue (e.g., log the error and continue)
        }
      });

      // Convert the Set of conversation IDs to an array for easier usage.
      extractedData.conversation_ids = [...extractedData.conversation_ids];
      const converId = extractedData.conversation_ids;
      const converIdString = converId.join(); // This will use comma as the default separator

      // Combine unique answers into a single string
      const combinedAnswer = extractedData.answers.join(''); // Join with spaces

      if (conversionId === '') {
        const result = await prisma.userConv.create({
          data: {
            userId: userId,
            conversionId: converIdString,
            apiId: last8Chars,
          },
        });
      }

      // console.log(combinedAnswer);
      await sendMessage(senderId, combinedAnswer);
      await setTypingOff(senderId);
    })
    .catch((error) => {
      console.log(error);
    });

  // console.log(JSON.stringify(response.data, null, 4));
  res.status(200).json({ message: 'Hello API from POST' });
  // return NextResponse.json({ message: 'Hello API from POST' }, { status: 200 });
});

async function connectDify(dataAI) {
  const api_key = process.env.DIFY_API_KEY; // Ensure you have your API key stored in .env.local
  const data_raw = JSON.parse(dataAI);

  // Set up the headers
  const headers = {
    Authorization: `Bearer ${api_key}`,
    'Content-Type': 'application/json',
  };

  let converId = data_raw.conversionId !== '' ? data_raw.conversionId : '';

  const query =
    data_raw.message !== '' ? data_raw.message : 'Please wait for question';
  // Hard-coded data
  let data = '';
  if (data_raw.files != '') {
    data = {
      inputs: {},
      query: query.trim(),
      response_mode: 'streaming',
      conversation_id: converId,
      user: data_raw.userId,
      files: data_raw.files,
    };
  } else {
    data = {
      inputs: {},
      query: query.trim(),
      response_mode: 'streaming',
      conversation_id: converId,
      user: data_raw.userId,
    };
  }
  // console.log(data);
  try {
    const response = await axios.post(
      'https://api.dify.ai/v1/chat-messages',
      data,
      { headers },
    );

    return response.data;
  } catch (error) {
    console.error(error);
    let status = 500;
    let message = 'An error occurred while processing your request.';

    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      status = error.response.status;
      message = error.message;
    } else if (error.request) {
      // The request was made but no response was received
      message = 'No response was received from the API.';
    }

    return message;
  }
}

function logRecursive(obj, depth = 0) {
  const indent = ' '.repeat(depth * 2); // Indentation for better readability

  if (Array.isArray(obj)) {
    console.log(indent + '[');
    obj.forEach((item, index) => {
      console.log(indent + '  ' + index + ':');
      logRecursive(item, depth + 1);
    });
    console.log(indent + ']');
  } else if (obj !== null && typeof obj === 'object') {
    console.log(indent + '{');
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        console.log(indent + '  ' + key + ':');
        logRecursive(obj[key], depth + 1);
      }
    }
    console.log(indent + '}');
  } else {
    console.log(indent + obj);
  }
}
// export the router module so that server.js file can use it
module.exports = router;

function logTextAndUrl(obj) {
  if (Array.isArray(obj)) {
    obj.forEach((item) => logTextAndUrl(item));
  } else if (obj !== null && typeof obj === 'object') {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (key === 'text') {
          console.log('text:', obj[key]);
        } else if (key === 'url') {
          console.log('url:', obj[key]);
        } else {
          logTextAndUrl(obj[key]);
        }
      }
    }
  }
}

function findTextAndUrl(obj) {
  let result = { text: '', url: '' };

  function recursiveSearch(obj) {
    if (Array.isArray(obj)) {
      obj.forEach((item) => recursiveSearch(item));
    } else if (obj !== null && typeof obj === 'object') {
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === 'url' && !result.url) {
            result.url = obj[key];
          } else if (key === 'text' && !result.text) {
            result.text = obj[key];
          } else {
            recursiveSearch(obj[key]);
          }
        }
      }
    }
  }

  recursiveSearch(obj);
  return result;
}
