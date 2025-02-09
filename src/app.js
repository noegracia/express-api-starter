const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require("body-parser");
const rateLimitMiddleware = require("./rateLimiter"); // Import the rate limiter

require('dotenv').config();

const middlewares = require('./middlewares');
const api = require('./api');

const app = express();
app.use(rateLimitMiddleware); // Apply the rate limiter to all routes

app.use(morgan('dev'));
app.use(helmet());

app.use(cors({
  origin: '*',
}));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: '🦄🌈✨👋🌎🌍🌏✨🌈🦄',
  });
});

app.use('/api/v1', api);

app.use(bodyParser.json());
app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
