const express = require('express');
const { getFullContent } = require('./scraping');
const getModelResponse = require('./ragModel');
const { processResponse } = require('./nlp');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(express.json());

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Function to check if query is medical-related
async function isMedicalQuery(query) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Determine if the following query is medical-related. Respond with 'yes' or 'no':\n\nQuery: ${query}\n\nIs this medical-related?`;
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }]
    });
    const response = await result.response;
    const text = response.text();
    return text.trim().toLowerCase() === 'yes';
  } catch (error) {
    console.error('Error checking if query is medical:', error);
    return false;
  }
}

app.post('/chat', async (req, res) => {
  const { query, location } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    console.log(`\n[SERVER] Received query="${query}" location="${location}"`);

    // Check if the query is medical-related
    const isMedical = await isMedicalQuery(query);
    if (!isMedical) {
      return res.json({ 
        answer: "I'm sorry, but I'm a medical assistant designed to answer health-related questions. Your query doesn't appear to be medical in nature. Please ask a health-related question.",
        confidence: 1,
        sources: []
      });
    }

    // Fetch articles dynamically
    const fullContent = await getFullContent(query, location);
    if (fullContent.length === 0) {
      console.log('[SERVER] No relevant articles found.');
      return res.status(404).json({ error: 'No relevant articles found.' });
    }

    // Combine content into a single context
    const combinedContext = fullContent.map(article => article.content).join(' ');
    console.log(`[SERVER] Combined context length: ${combinedContext.length}`);

    // Query QA model
    const modelResponse = await getModelResponse(query, combinedContext);

    // Process and format response
    const formattedResponse = processResponse(modelResponse, fullContent, query);

    console.log('[SERVER] Final response:', JSON.stringify(formattedResponse, null, 2));
    return res.json(formattedResponse);
  } catch (error) {
    console.error('[SERVER] Error processing query:', error.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
