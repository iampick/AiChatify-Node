// Example using Express.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());
const router = express.Router();
// Example defining a route in Express

app.get('/', (req, res) => {
  res.send('<h1>Hello, Express.js Server! +++</h1>');
});

// View Engine Setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Route for Privacy Policy
app.get('/privacy', (req, res) => {
  res.render('privacy', {
    title: 'Privacy Policy',
  });
});
app.get('/business-profile', (req, res) => {
  res.render('business-profile', {
    title: 'Business Profile - Narinthorn Inthararin',
  });
});

// Include route files
const lineDifyAgent = require('./routes/api/line-dify-agent');
const lineOpenAiAgent = require('./routes/api/line-openai-agent');
const FbDifyAgent = require('./routes/api/facebook-dify');
const lineEx10DifyAgent = require('./routes/api/line-ex10-dify-agent');
const deleteChat = require('./routes/api/deleteHistory');
const LineGruopDifyAgent = require('./routes/api/line-dify-agent-group');
// Use routes
app.use('/line-dify-agent', lineDifyAgent);
app.use('/line-group-dify-agent', LineGruopDifyAgent);
app.use('/line-ex10-dify-agent', lineEx10DifyAgent);
app.use('/line-openai-agent', lineOpenAiAgent);
app.use('/facebook-dify-agent', FbDifyAgent);
app.use('/deletechat', deleteChat);

// Example specifying the port and starting the server
const port = process.env.PORT || 3000; // You can use environment variables for port configuration
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
