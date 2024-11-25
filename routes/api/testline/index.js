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

    console.log(`dataToAi`);
    console.log(dataToAi);
    console.log(`replyToken`);
    console.log(replyToken);

    waitSeconds(2);

    const data = {
      replyToken,
      messages: [
        {
          type: 'text',
          text: 'ok line received',
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
  },
);

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

function waitSeconds(seconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

module.exports = router;
