const axios = require('axios');
const xior = require('xior');

const express = require('express');
const router = express.Router();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Let's initialize it as null initially, and we will assign the actual database instance later.
let db = null;
const config = {
  accessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET_TOKEN,
};

// console.log(client);
router.get('/', (req, res) => {
  res.status(200).json({ message: 'Hello API from GET' });
});

router.post('/', async (req, res) => {
  const data_raw = req.body;

  console.log(data_raw);
  // return res.status(200).json({ message: 'Hello API from GET' });

  const replyToken = data_raw.events[0].replyToken;
  const retrieveMsg = data_raw.events[0].message.text;
  const userId = data_raw.events[0].source.userId;
  const messageType = data_raw.events[0].message.type;
  let conversionId = '';
  console.log(data_raw.events[0].message);
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

  console.log(userId);
  console.log(last8Chars);
  console.log(userInDb);
  if (userInDb) {
    conversionId = userInDb.conversionId;
  }

  let dataToAi = JSON.stringify({
    message: retrieveMsg,
    userId: userId,
    conversionId: conversionId,
  });

  let configAi = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${process.env.API_ENPOINT}/api/dify`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: dataToAi,
  };

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

      console.log(combinedAnswer);

      const data = {
        replyToken,
        messages: [
          {
            type: 'text',
            text: combinedAnswer,
          },
        ],
      };
      const Lineresponse = await axios.post(
        'https://api.line.me/v2/bot/message/reply',
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.accessToken}`,
          },
        },
      );
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
  // Hard-coded data
  const data = {
    inputs: {},
    query: data_raw.message,
    response_mode: 'streaming',
    conversation_id: converId,
    user: data_raw.userId,
  };

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

// export the router module so that server.js file can use it
module.exports = router;
