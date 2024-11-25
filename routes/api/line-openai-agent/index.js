const axios = require('axios');
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const openai = new OpenAI();
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
  res.status(200).json({ message: 'Hello API from GET' });
});

router.post(
  '/',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    console.log(req.body);

    logRecursive(req.body);

    if (process.env.LINE_BOT !== 'on') {
      res.status(200).json({ message: 'Hello API' });
      return true;
    }

    const data_raw = req.body;
    let retrieveMsg = '';
    let imageParts = '';
    let files = [];
    let retrieveImage = '';
    let userId = '';

    const lineType = data_raw.events[0].type;
    if (lineType !== 'message') {
      return true;
    }

    const messageType = data_raw.events[0].message.type;

    if (messageType !== 'text') {
      return true;
    }
    const replyToken = data_raw.events[0].replyToken;
    const sourceType = data_raw.events[0].source.type;
    userId = data_raw.events[0].source.userId;
    const messageId = data_raw.events[0].message.id;

    if (sourceType === 'group') {
      userId = data_raw.events[0].source.groupId;
      lineEndpoint = 'https://api.line.me/v2/bot/message/reply';
    } else if (sourceType == 'user') {
      userId = data_raw.events[0].source.userId;
      lineEndpoint = 'https://api.line.me/v2/bot/message/reply';
    }

    let conversionId = '';
    // console.log(messageType);
    if (messageType === 'text') {
      // console.log(messageType);
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
    }

    if (messageType === 'image') {
      // console.log(data_raw.events[0].message);
      // console.log(files);
      return true;
    }

    // console.log(data_raw.events[0].message);
    // console.log(files);

    const last10Chars = process.env.OPENAI_ASSISTANT_ID.slice(-10);

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

    // console.log(userId);
    // console.log(last10Chars);
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
    // connectOpenAi(dataToAi).then(async (response) => {
    //   console.log(response);
    // });
    connectOpenAi(dataToAi, conversionId)
      .then(async (response) => {
        // Assuming `response.data` is a stringified JSON that looks like the given output.

        const rawData = response.message.replace(/\*/g, '');
        const responseConverId = response.converId;

        const checkUserExist = await prisma.userConv.count({
          where: {
            userId: userId,
            apiId: last10Chars,
          },
        });

        if (checkUserExist === 0) {
          const result = await prisma.userConv.create({
            data: {
              userId: userId,
              conversionId: responseConverId,
              apiId: last10Chars,
              status: 'sending',
            },
          });
        }

        const cleanAnswer = rawData.replace(/Final Answer: /g, '');
        console.log('replyToken');
        console.log(replyToken);
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
      })
      .catch((error) => {
        console.log(error);
      });

    // console.log(JSON.stringify(response.data, null, 4));
    res.status(200).json({ message: 'Hello API from POST' });
    // return NextResponse.json({ message: 'Hello API from POST' }, { status: 200 });
  },
);

async function connectOpenAi(dataAI, thread_id_source) {
  const api_key = process.env.DIFY_API_KEY; // Ensure you have your API key stored in .env.local
  const assistant_id = process.env.OPENAI_ASSISTANT_ID; // Ensure you have your API key stored in .env.local
  const data_raw = JSON.parse(dataAI);
  let thread_id = thread_id_source;
  let compleatAnswer = '';
  console.log('thread_id');
  console.log(thread_id);

  if (thread_id === '') {
    const thread = await openai.beta.threads.create();
    thread_id = thread.id;
  }
  const message = await openai.beta.threads.messages.create(thread_id, {
    role: 'user',
    content: data_raw.message.trim(),
  });
  console.log('message');
  console.log(message);

  let run = await openai.beta.threads.runs.createAndPoll(thread_id, {
    assistant_id: assistant_id,
    instructions: data_raw.message.trim(),
  });

  if (run.status === 'completed') {
    const messages = await openai.beta.threads.messages.list(run.thread_id);
    for (const message of messages.data.reverse()) {
      if (message.role === 'assistant' && message.content[0].text.value) {
        console.log('adding assistan response.......');
        compleatAnswer = message.content[0].text.value;
      }
      // console.log(`${message.role} > ${message.content[0].text.value}`);
    }
  } else {
    console.log(run.status);
  }
  // console.log(compleatAnswer);

  return { message: compleatAnswer, converId: thread_id };
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
