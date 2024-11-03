const axios = require('axios');
const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const getImageBinary = require('../../../utils/getImageBinary');
const { uploadFile } = require('../../../utils/cloudinary');
const waitForStandby = require('./waitForStandby');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
  console.log(process.env.DIFY_API_KEY);
  res.status(200).json({ message: 'Hello API from GET' });
});

router.post(
  '/',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    console.log(req.body);
    //
    // if (req.body && req.body.destination) {
    //   res.status(200).json({ message: 'Hello API' });
    //   return true;
    // }
    if (process.env.LINE_BOT !== 'on') {
      res.status(200).json({ message: 'Hello API' });
      return true;
    }

    const data_raw = req.body;
    let retrieveMsg = '';
    let imageParts = '';
    let files = [];
    let retrieveImage = '';
    let eventType = '';
    logRecursive(data_raw);
    return true;
    // return res.status(200).json({ message: 'Hello API from GET' });

    const replyToken = data_raw.events[0].replyToken;
    const userId = data_raw.events[0].source.userId;
    const messageType = data_raw.events[0].message.type;
    const messageId = data_raw.events[0].message.id;
    eventType = data_raw.events[0].type;
    let conversionId = '';
    // console.log(messageType);
    if (eventType === 'leave') {
      return true;
    }

    if (messageType === 'text') {
      retrieveMsg = data_raw.events[0].message.text;
    } else if (messageType === 'image') {
      return true;
      retrieveImage = await getImageBinary(messageId, LineHeader);
      // const mimeType = 'image/png';
      const ImgBuff = Buffer.from(retrieveImage).toString('base64');
      imageParts = await uploadFile(`data:image/png;base64,${ImgBuff}`, userId);
      retrieveMsg = 'Please wait for question';
      console.log(imageParts.url);
      imageParts = imageParts.url;
      files = [
        {
          type: 'image',
          transfer_method: 'remote_url',
          url: imageParts,
          upload_file_id: '',
        },
      ];
    } else {
      return true;
    }

    // console.log(data_raw.events[0].message);
    // console.log(files);
    if (messageType === 'image') {
      return true;
    }
    const last10Chars = process.env.DIFY_API_KEY.slice(-10);
    // const last10Chars = 'app-1k7DZ3qK1PnfmrWfzgIsvVfM'.slice(-10);

    // Query to get all todos from the "todo" table
    const userInDb = await prisma.UserConv.findFirst({
      where: {
        userId: userId,
        apiId: last10Chars,
      },
      orderBy: {
        id: 'desc',
      },
      take: 1,
    });

    // console.log('++++++++++++++++++++');
    // console.log(process.env.DIFY_API_KEY);
    // console.log(userInDb);
    if (userInDb) {
      await waitForStandby(userId, last10Chars);

      conversionId = userInDb.conversionId;
      const updatedRecord = await prisma.userConv.updateMany({
        where: {
          userId: userId,
          apiId: last10Chars,
        },
        data: {
          status: 'sending',
        },
      });
    }

    let dataToAi = JSON.stringify({
      message: retrieveMsg,
      userId: userId,
      conversionId: conversionId,
      files: files,
    });

    // console.log(dataToAi);

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
        console.log('-------');
        console.log(extractedData.answers.length);
        let no = 0;
        let answerLenght = false;
        extractedData.answers.map((txt) => {
          answerLenght = false;
          no++;
          if (txt.length > 50) {
            answerLenght = true;
            console.log('answerLenght true -------');
          }
          return console.log(`${no} => ${txt}`);
        });
        console.log('-------');

        console.log(extractedData.answers[extractedData.answers.length - 2]);
        let combinedAnswer = '';
        if (answerLenght) {
          combinedAnswer = extractedData.answers[
            extractedData.answers.length - 2
          ].replace('Final Answer:', '');
        } else {
          combinedAnswer = extractedData.answers
            .join('')
            .replace('Final Answer:', ''); // Join with spaces
        }

        if (conversionId === '') {
          const result = await prisma.userConv.create({
            data: {
              userId: userId,
              conversionId: converIdString,
              apiId: last10Chars,
              status: 'sending',
            },
          });
        }
        const cleanAnswer = combinedAnswer.replace(/Final Answer: /g, '');
        console.log('cleanAnswer');
        console.log(cleanAnswer);

        const data = {
          replyToken,
          messages: [
            {
              type: 'text',
              text: cleanAnswer,
            },
          ],
        };
        console.log('data');
        console.log(data);

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
        const updatedRecord = await prisma.userConv.updateMany({
          where: {
            userId: userId,
            apiId: last10Chars,
          },
          data: {
            status: 'standby',
          },
        });

        console.log(updatedRecord);
      })
      .catch((error) => {
        console.log(error);
      });

    // console.log(JSON.stringify(response.data, null, 4));
    res.status(200).json({ message: 'Hello API from POST' });
    // return NextResponse.json({ message: 'Hello API from POST' }, { status: 200 });
  },
);

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
  let data = '';
  if (data_raw.files != '') {
    data = {
      inputs: {},
      query: data_raw.message.trim(),
      response_mode: 'streaming',
      conversation_id: converId,
      user: data_raw.userId,
      files: data_raw.files,
    };
  } else {
    data = {
      inputs: {},
      query: data_raw.message.trim(),
      response_mode: 'streaming',
      conversation_id: converId,
      user: data_raw.userId,
    };
  }
  console.log(data);

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
