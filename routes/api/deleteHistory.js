const axios = require('axios');
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const { password } = req.query;

  if (!password) {
    return res
      .status(400)
      .json({ message: 'Bad Request: Password parameter is required' });
  }

  if (password !== process.env.MASTER_PASSWORD) {
    return res.status(403).json({
      message: `Forbidden: Incorrect password`,
    });
  }

  try {
    // Using raw SQL truncate for better performance
    await prisma.$executeRaw`TRUNCATE TABLE "UserConv" RESTART IDENTITY CASCADE`;
    return res
      .status(200)
      .json({ message: 'All chat histories have been permanently cleared' });
  } catch (error) {
    console.error('Error truncating UserConv table:', error);
    return res.status(500).json({ 
      message: 'Failed to clear histories',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

router.post('/', (req, res) => {
  res.status(200).json({ message: 'Hello API from POST' });
});

module.exports = router;
