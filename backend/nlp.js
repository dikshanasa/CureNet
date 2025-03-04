const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

/**
 * Processes model response and formats it for frontend display
 */
const processResponse = (modelResponse, articles, query) => {
  try {
    console.log('\n[nlp.js] Processing final response...');
    console.log(`[nlp.js] Model answer: "${modelResponse.answer}", score: ${modelResponse.confidence}`);
    console.log(`[nlp.js] Number of articles fetched: ${articles.length}`);

    let finalAnswer = (modelResponse.answer || '').trim();
    // Use the confidence score from the RAG model
    let confidence = modelResponse.confidence || 0;

    // 1. If the model's answer is empty, fallback to relevant text extraction
    if (!finalAnswer || finalAnswer.toLowerCase().includes('no answer')) {
      console.log('[nlp.js] Model did not provide a sufficient answer; falling back to relevant sentence extraction.');
      const fallbackText = extractRelevantInfo(articles, query);
      if (fallbackText.length > 0) {
        finalAnswer = fallbackText.join(' ');
        confidence = 0.5; // Set a default confidence for fallback answers
      }
    }

    // 2. If we still don't have a meaningful answer, show a default message
    if (!finalAnswer || finalAnswer.length < 5) {
      finalAnswer = 'No specific answer found in the articles. Please try rephrasing your question.';
      confidence = 0;
    }

    // 3. Format the response for display
    const formatted = formatResponse(query, finalAnswer, confidence, articles);

    console.log(`[nlp.js] Final Answer: "${formatted.answer}"`);
    console.log('[nlp.js] Final Confidence:', formatted.confidence);
    console.log('[nlp.js] Sources:', formatted.sources);
    return formatted;
  } catch (error) {
    console.error('[nlp.js] Error processing response:', error);
    return { 
      question: query,
      answer: 'Error processing the response. Please try again later.',
      confidence: 0,
      sources: []
    };
  }
};

/**
 * Extract up to 5 relevant sentences that contain words from the query
 */
const extractRelevantInfo = (articles, query) => {
  console.log('[nlp.js] Starting fallback extraction...');
  const queryTokens = tokenizer.tokenize(query.toLowerCase());
  const matchedSentences = [];

  for (const article of articles) {
    const sentences = article.content.split(/[.!?]+/);
    for (const sentence of sentences) {
      const sentenceTokens = tokenizer.tokenize(sentence.toLowerCase());
      if (queryTokens.some((token) => sentenceTokens.includes(token))) {
        matchedSentences.push(sentence.trim());
        if (matchedSentences.length >= 5) break;
      }
    }
    if (matchedSentences.length >= 5) break;
  }

  console.log('[nlp.js] Fallback extraction found sentences:', matchedSentences);
  return matchedSentences;
};

/**
 * Format the final response with markdown for frontend display
 */
const formatResponse = (query, answer, confidence, articles) => {
  const sources = articles.slice(0, 3).map((article) => ({
    title: article.title,
    link: article.link,
  }));

  // Structure the response with markdown formatting
  return {
    question: query,
    answer: `
**Question:** ${query}

**Answer:**  
${answer}

**Confidence Score:** ${Math.round(confidence * 100)}%
`.trim(),
    sources, // Send sources as an array of objects
    confidence,
  };
};

module.exports = { processResponse };
