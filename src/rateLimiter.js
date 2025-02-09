const setRateLimit = require("express-rate-limit");

// Rate limit middleware for daily limits
const rateLimitMiddleware = setRateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  max: 100, // limit each IP to 100 requests per windowMs
  message: "API request limit reached. There may be an error, or your usage pattern suggests potential abuse. Retry in 24 hours.",
  headers: true,
});

module.exports = rateLimitMiddleware;