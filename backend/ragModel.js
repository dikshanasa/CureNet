const natural = require('natural');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const tf = require('@tensorflow/tfjs');
const use = require('@tensorflow-models/universal-sentence-encoder');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Safety settings for medical content
const SAFETY_SETTINGS = [
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_NONE"
  }
];


// Generation config for consistent outputs
const GENERATION_CONFIG = {
  temperature: 0.3,
  topK: 1,
  topP: 1,
  maxOutputTokens: 2048,
};

let model;
async function loadModel() {
  try {
    model = await use.load();
    console.log('[RAGMODEL] Universal Sentence Encoder model loaded successfully');
  } catch (error) {
    console.error('[RAGMODEL] Error loading Universal Sentence Encoder:', error);
    throw new Error('Failed to load Universal Sentence Encoder model');
  }
}
loadModel();

function preprocessText(text) {
  if (!text || typeof text !== 'string') {
    console.warn('[RAGMODEL] Invalid text input for preprocessing');
    return '';
  }

  console.log('[RAGMODEL] Preprocessing text...');
  const cleanedText = text
    .replace(/Navigation[\s\S]*?(Menu|Search)/gi, '')
    .replace(/\b(Privacy Policy|Terms & Conditions|Legal|Contact Us|About Us|Advertisements)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
    .trim();

  console.log(`[RAGMODEL] Preprocessed text length: ${cleanedText.length}`);
  if (cleanedText.length > 200) {
    console.log(`[RAGMODEL] First 200 characters: ${cleanedText.substring(0, 200)}...`);
  }
  
  return cleanedText;
}

function chunkText(text, maxLength = 1000) {
  if (!text) return [];
  
  console.log('[RAGMODEL] Chunking content...');
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk.length + sentence.length) <= maxLength) {
      currentChunk += sentence + ' ';
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence + ' ';
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  console.log(`[RAGMODEL] Created ${chunks.length} chunks`);
  chunks.forEach((chunk, index) => {
    console.log(`[RAGMODEL] Chunk ${index + 1} length: ${chunk.length} chars`);
  });

  return chunks;
}

async function scoreChunksByQuery(chunks, query) {
  if (!chunks.length || !query) {
    console.warn('[RAGMODEL] Invalid input for chunk scoring');
    return [];
  }

  console.log('[RAGMODEL] Scoring chunks by query...');
  
  try {
    // Get embeddings for query and chunks using Universal Sentence Encoder
    const textsToEmbed = [query, ...chunks];
    const embeddings = await model.embed(textsToEmbed);
    
    // Extract query embedding and chunk embeddings
    const queryEmbedding = embeddings.slice([0, 0], [1, -1]);
    const chunkEmbeddings = embeddings.slice([1, 0], [chunks.length, -1]);
    
    // Calculate semantic similarity scores
    const scores = chunks.map((chunk, index) => {
      // Semantic similarity using cosine similarity
      const chunkEmbedding = chunkEmbeddings.slice([index, 0], [1, -1]);
      const semanticScore = 1 - tf.losses.cosineDistance(queryEmbedding, chunkEmbedding).arraySync();
      
      // Keyword matching score
      const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
      const chunkWords = new Set(chunk.toLowerCase().split(/\W+/).filter(Boolean));
      const matchingWords = [...queryWords].filter(word => chunkWords.has(word));
      const keywordScore = matchingWords.length / queryWords.size;
      
      // Combined score
      const combinedScore = (semanticScore + keywordScore) / 2;
      
      return {
        chunk,
        score: combinedScore,
        semanticScore,
        keywordScore
      };
    });

    // Sort by combined score
    const sortedScores = scores.sort((a, b) => b.score - a.score);
    
    console.log('[RAGMODEL] Top 3 chunk scores:');
    sortedScores.slice(0, 3).forEach((item, index) => {
      console.log(`[RAGMODEL] Chunk ${index + 1} - Combined Score: ${item.score.toFixed(3)} (Semantic: ${item.semanticScore.toFixed(3)}, Keyword: ${item.keywordScore.toFixed(3)})`);
    });

    return sortedScores;
  } catch (error) {
    console.error('[RAGMODEL] Error in chunk scoring:', error);
    // Fallback to basic keyword matching if embedding fails
    return fallbackScoring(chunks, query);
  }
}

function fallbackScoring(chunks, query) {
  console.log('[RAGMODEL] Using fallback scoring method...');
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);
  
  return chunks.map(chunk => {
    const chunkWords = chunk.toLowerCase().split(/\W+/).filter(Boolean);
    const matchingWords = queryWords.filter(word => chunkWords.includes(word));
    const score = matchingWords.length / queryWords.length;
    return { chunk, score };
  }).sort((a, b) => b.score - a.score);
}

async function summarizeTopChunks(scoredChunks, topN = 10) {
  if (!scoredChunks.length) {
    console.warn('[RAGMODEL] No chunks to summarize');
    return [];
  }

  console.log(`[RAGMODEL] Summarizing top ${topN} chunks...`);
  const topChunks = scoredChunks.slice(0, topN);
  const summaries = [];

  for (const { chunk } of topChunks) {
    try {
      const summary = await generateSummary(chunk);
      if (summary) summaries.push(summary);
    } catch (error) {
      console.error('[RAGMODEL] Error summarizing chunk:', error);
      // Add original chunk as fallback
      summaries.push(chunk);
    }
  }

  return summaries;
}

async function generateSummary(chunk) {
  if (!chunk) return null;
  
  console.log('[RAGMODEL] Generating summary for chunk...');
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Summarize this medical information concisely and accurately:

${chunk}

Provide a clear, factual summary focusing on key medical information.`;

  try {
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }]}],
      generationConfig: GENERATION_CONFIG,
      safetySettings: SAFETY_SETTINGS
    });    

    const response = await result.response;
    const summary = response.text();
    
    if (summary) {
      console.log(`[RAGMODEL] Generated summary length: ${summary.length} chars`);
      return summary;
    }
    return chunk;
  } catch (error) {
    console.error('[RAGMODEL] Error in summary generation:', error);
    return chunk;
  }
}

async function createMegaChunk(summaries, maxLength = 3000) {
  if (!Array.isArray(summaries) || !summaries.length) {
    console.warn('[RAGMODEL] Invalid summaries input for megachunk creation');
    return '';
  }

  console.log('[RAGMODEL] Creating mega chunk...');
  let megaChunk = '';
  let usedSummaries = 0;

  for (const summary of summaries) {
    if (megaChunk.length + summary.length <= maxLength) {
      megaChunk += summary + ' ';
      usedSummaries++;
    } else {
      break;
    }
  }

  megaChunk = megaChunk.trim();
  console.log(`[RAGMODEL] Mega chunk created:
    Length: ${megaChunk.length} characters
    Summaries used: ${usedSummaries}/${summaries.length}`);

  return megaChunk;
}

async function checkRelevance(query, megaChunk) {
  if (!query || !megaChunk) {
    console.warn('[RAGMODEL] Invalid input for relevance check');
    return false;
  }

  console.log('[RAGMODEL] Checking megachunk relevance...');
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Analyze if this medical context contains relevant information to answer the query.
Consider both direct and indirect relevant information.
Reply with ONLY 'YES' or 'NO'.

Context: ${megaChunk}

Query: ${query}

Contains relevant information (YES/NO):`;

  try {
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }]}],
      generationConfig: {
        ...GENERATION_CONFIG,
        temperature: 0.1,
        maxOutputTokens: 1,
      },
      safetySettings: SAFETY_SETTINGS
    });

    const response = await result.response;
    const answer = response.text().trim().toUpperCase();
    console.log(`[RAGMODEL] Relevance check result: ${answer}`);
    return answer === 'YES';
  } catch (error) {
    console.error('[RAGMODEL] Error checking relevance:', error);
    return false;
  }
}

async function calculateConfidence(query, megaChunk, answer) {
  if (!query || !megaChunk || !answer) {
    console.warn('[RAGMODEL] Invalid input for confidence calculation');
    return 0;
  }

  console.log('[RAGMODEL] Calculating confidence score...');
  try {
    // Token-based similarity
    const queryTokens = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
    const megaChunkTokens = new Set(megaChunk.toLowerCase().split(/\W+/).filter(Boolean));
    const answerTokens = new Set(answer.toLowerCase().split(/\W+/).filter(Boolean));

    const queryMegaOverlap = new Set([...queryTokens].filter(x => megaChunkTokens.has(x))).size / queryTokens.size;
    const answerMegaOverlap = new Set([...answerTokens].filter(x => megaChunkTokens.has(x))).size / answerTokens.size;

    // Semantic similarity using Universal Sentence Encoder
    const embeddings = await model.embed([query, answer, megaChunk]);
    const queryVec = embeddings.slice([0, 0], [1, -1]);
    const answerVec = embeddings.slice([1, 0], [1, -1]);
    const megaChunkVec = embeddings.slice([2, 0], [1, -1]);

    const semanticSimilarity = 1 - tf.losses.cosineDistance(queryVec, answerVec).arraySync();
    
    // Calculate final confidence score
    const weights = {
      queryOverlap: 0.3,
      answerOverlap: 0.3,
      semantic: 0.4
    };

    const confidence = (
      queryMegaOverlap * weights.queryOverlap +
      answerMegaOverlap * weights.answerOverlap +
      semanticSimilarity * weights.semantic
    );

    console.log(`[RAGMODEL] Confidence components:
      Query-Mega overlap: ${queryMegaOverlap.toFixed(3)}
      Answer-Mega overlap: ${answerMegaOverlap.toFixed(3)}
      Semantic similarity: ${semanticSimilarity.toFixed(3)}
      Final confidence: ${confidence.toFixed(3)}`);

    return Math.round(confidence * 100) / 100;
  } catch (error) {
    console.error('[RAGMODEL] Error calculating confidence:', error);
    return 0;
  }
}

async function generateAnswer(query, context, isFullContext = false) {
  if (!query || !context) {
    console.error('[RAGMODEL] Missing query or context for answer generation');
    throw new Error('Invalid input for answer generation');
  }

  console.log(`[RAGMODEL] Generating AI answer using ${isFullContext ? 'full context' : 'megachunk'}`);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `As a medical information assistant, provide a comprehensive and accurate answer to the query based on the following context. 
Focus on medical facts and include any relevant details about symptoms, causes, diagnosis, or treatment if available.

Context: ${context}

Query: ${query}

Provide a clear, structured answer that directly addresses the query. Include only information that can be supported by the given context.

Answer:`;

  try {
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }]}],
      generationConfig: {
        ...GENERATION_CONFIG,
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
      safetySettings: SAFETY_SETTINGS
    });

    const response = await result.response;
    const answer = response.text();
    console.log(`[RAGMODEL] Generated answer length: ${answer.length} characters`);
    return answer;
  } catch (error) {
    console.error('[RAGMODEL] Error generating answer:', error);
    throw new Error('Failed to generate answer');
  }
}

const getModelResponse = async (question, fullContext) => {
  try {
    console.log('\n[RAGMODEL] Starting new query processing...');
    console.log(`[RAGMODEL] Question: ${question}`);
    console.log(`[RAGMODEL] Context length: ${fullContext.length} characters`);

    // Input validation
    if (!question || !fullContext) {
      throw new Error('Invalid input: Question and context are required');
    }

    // Process and chunk the context
    const cleanedContext = preprocessText(fullContext);
    const chunks = chunkText(cleanedContext);
    
    // Score and rank chunks
    const scoredChunks = await scoreChunksByQuery(chunks, question);
    
    // Generate summaries and create megachunk
    const summaries = await summarizeTopChunks(scoredChunks);
    const megaChunk = await createMegaChunk(summaries);
    
    // Check relevance and generate answer
    const isRelevant = await checkRelevance(question, megaChunk);
    const contextToUse = isRelevant ? megaChunk : fullContext;
    
    console.log(`[RAGMODEL] Using ${isRelevant ? 'megachunk' : 'full context'} for answer generation`);
    
    const answer = await generateAnswer(question, contextToUse, !isRelevant);
    const confidence = await calculateConfidence(question, megaChunk, answer);

    // Prepare response metadata
    const metadata = {
      processingTime: new Date().getTime(),
      usedFullContext: !isRelevant,
      contextLength: contextToUse.length,
      confidenceScore: confidence,
      relevanceCheck: isRelevant,
    };

    console.log('[RAGMODEL] Response generated successfully');
    console.log('[RAGMODEL] Metadata:', metadata);

    return {
      question,
      answer,
      confidence,
      metadata,
      usedFullContext: !isRelevant
    };

  } catch (error) {
    console.error('[RAGMODEL] Error in pipeline:', error);
    throw new Error(`Failed to process query: ${error.message}`);
  }
};

// Export the main function and utility functions for testing
module.exports = getModelResponse;
