const express = require("express");
const Groq = require("groq-sdk");
const config = require("./config.js");
const dotenv = require('dotenv');
dotenv.config();

const router = express.Router();
const { searchQnA } = require('./qnaFunctions.js');
const { systemPrompt, model, temperature, max_tokens } = config;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

router.post("/", async (req, res) => {
  try {
    const chatMessages = req.body;
    
    // Search for the most similar QnA pair
    const contextPrompt = await searchQnA(chatMessages[chatMessages.length - 1].message);
    
    const systemMessage = {
      "role": "system",
      "content": systemPrompt + "\n\n" + contextPrompt
    }

    // Transform chat messages into Groq format
    const apiMessages = chatMessages.map((messageObject) => {
      const role = messageObject.sender === "GPT" ? "assistant" : "user";
      return { role: role, content: messageObject.message };
    });

    // Create Groq request body
    const myApiRequestBody = {
      model: model,
      messages: [
        systemMessage,
        ...apiMessages
      ],
      temperature: temperature,
      max_tokens: max_tokens,
    };

    console.log("Request body:");
    console.log(myApiRequestBody);

    // Call Groq API
    const groqResponse = await groq.chat.completions.create(myApiRequestBody);

    // Send back Groq response
    console.log("Groq response:");
    console.log(groqResponse.choices[0].message);
    res.json({ openaiResponse: groqResponse.choices[0].message });

  } catch (error) {
    console.log(req.body)
    console.log("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
