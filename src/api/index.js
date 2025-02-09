const express = require('express');

const emojis = require('./emojis');
const ask = require('./ask/server');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: 'API - 👋🌎🌍🌏',
  });
});

router.use('/emojis', emojis);
router.use('/ask', ask);


module.exports = router;
