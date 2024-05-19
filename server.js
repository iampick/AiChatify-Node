// Example using Express.js
const express = require('express');
const app = express();
app.use(express.json());
const router = express.Router();
// Example defining a route in Express
app.get('/', (req, res) => {
  res.send('<h1>Hello, Express.js Server!</h1>');
});

// Include route files
const lineDifyAgent = require('./routes/api/line-dify-agent');
const FbDifyAgent = require('./routes/api/facebook-dify');
// Use routes
app.use('/line-dify-agent', lineDifyAgent);
app.use('/facebook-dify-agent', FbDifyAgent);

// Example specifying the port and starting the server
const port = process.env.PORT || 3000; // You can use environment variables for port configuration
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
