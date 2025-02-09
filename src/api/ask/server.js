const express = require("express");

// const cors = require("cors");
const OpenAI = require("openai");
// const rateLimitMiddleware = require("../../rateLimiter.js"); // Import the rate limiter
const config = require("./config.js"); // Import the config file

const dotenv = require('dotenv');
dotenv.config();

const router = express.Router();
const { searchQnA } = require('./qnaFunctions.js');
const { systemPrompt, model } = config;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// const response = await openai.listEngines();


// const app = express();
// app.use(rateLimitMiddleware); // Apply the rate limiter to all routes
// const port = 3001;

// app.use(bodyParser.json());
// app.use(cors());


router.post("/", async (req, res) => {
  try {
    const chatMessages = req.body;

    // console.log(req.body);
    
    // Search for the most similar QnA pair
    const searchResult = await searchQnA(chatMessages[chatMessages.length - 1].message);
    const contextPrompt = JSON.stringify(searchResult) + "\n\n"; // "You can use the following context to answer the question:\n\n"

    const systemMessage = { //  Explain things like you're talking to a software professional with 5 years of experience.
      "role": "system", "content": systemPrompt +  `${contextPrompt}`
    }


    // Transform chat messages into OpenAI format
    const apiMessages = chatMessages.map((messageObject) => {
      const role = messageObject.sender === "GPT" ? "assistant" : "user";
      return { role: role, content: messageObject.message };
    });

    // Create OpenAI request body
    const myApiRequestBody = {
      model: model,
      messages: [
        systemMessage,
        ...apiMessages
      ],
    };

    console.log("Request body:");
    console.log(myApiRequestBody);

    // Call OpenAI API
    const openaiResponse = await openai.chat.completions.create(myApiRequestBody);

    // Send back OpenAI response
    console.log("Open AI response:");
    console.log(openaiResponse.choices[0].message);
    res.json({ openaiResponse: openaiResponse.choices[0].message }); // Assuming you want to send the first choice text back

    } catch (error) {
    console.log(req.body)
    console.log("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
    }
    });

module.exports = router;
// const httpsServer = https.createServer(credentials, app);

// httpsServer.listen(port, () => {
//   console.log(`HTTPS Server running on port ${port}`);
// });
