const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

/**
 * Integrates the QA model's best answer with fallback extraction
 * and returns a structured JSON. 
 * Added logging to see relevant fallback info and final output.
 */
const processResponse = (modelResponse, articles, query) => {
  try {
    console.log('\n[nlp.js] Processing final response...');
    console.log(`[nlp.js] Model answer: "${modelResponse.answer}", score: ${modelResponse.score}`);
    console.log(`[nlp.js] Number of articles fetched: ${articles.length}`);

    let finalAnswer = (modelResponse.answer || '').trim();
    let confidence = modelResponse.score || 0;

    // 1. If the model's answer is empty, fallback to relevant text extraction
    if (!finalAnswer || finalAnswer.toLowerCase().includes('no answer')) {
      console.log('[nlp.js] Model did not provide a sufficient answer; falling back to relevant sentence extraction.');
      const fallbackText = extractRelevantInfo(articles, query);
      if (fallbackText.length > 0) {
        finalAnswer = fallbackText.join(' ');
      }
    }

    // 2. If we still don't have a meaningful answer, show a default message
    if (!finalAnswer || finalAnswer.length < 5) {
      finalAnswer = 'No specific answer found in the articles. Please try rephrasing your question.';
    }

    // 3. Return a final JSON with question, answer, confidence, and sources
    const formatted = formatResponse(query, finalAnswer, confidence, articles);

    console.log(`[nlp.js] Final Answer: "${formatted.answer}"`);
    console.log('[nlp.js] Final Confidence:', formatted.confidence);
    console.log('[nlp.js] Sources:', formatted.sources.map(s => s.link));
    return formatted;
  } catch (error) {
    console.error('[nlp.js] Error processing response:', error);
    return { error: 'Error processing the response. Please try again later.' };
  }
};

/**
 * Extract up to 5 relevant sentences that contain words from the query.
 */
const extractRelevantInfo = (articles, query) => {
  console.log('[nlp.js] Starting fallback extraction...');
  const queryTokens = tokenizer.tokenize(query.toLowerCase());
  const matchedSentences = [];

  for (const article of articles) {
    const sentences = article.content.split(/[.!?]+/);
    for (const sentence of sentences) {
      const sentenceTokens = tokenizer.tokenize(sentence.toLowerCase());
      // If any token in query is included in this sentence
      if (queryTokens.some((token) => sentenceTokens.includes(token))) {
        matchedSentences.push(sentence.trim());
        if (matchedSentences.length >= 5) {
          break; 
        }
      }
    }
    if (matchedSentences.length >= 5) break;
  }

  console.log('[nlp.js] Fallback extraction found sentences:', matchedSentences);
  return matchedSentences;
};

/**
 * Prepares clean JSON. Provides up to 3 sources for the user.
 */
const formatResponse = (query, answer, confidence, articles) => {
  const sources = articles.slice(0, 3).map((article) => ({
    title: article.title,
    link: article.link,
  }));

  return {
    question: query,
    answer: answer.trim(),
    confidence: confidence,
    sources: sources,
  };
};

module.exports = { processResponse };
