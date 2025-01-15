const express = require('express');
const { getFullContent } = require('./scraping');
const getModelResponse = require('./ragModel');
const { processResponse } = require('./nlp');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(express.json());

app.post('/chat', async (req, res) => {
  const { query, location } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    console.log(`\n[SERVER] Received query="${query}" location="${location}"`);

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
