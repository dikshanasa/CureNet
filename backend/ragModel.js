const natural = require('natural');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const tf = require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

let model;
async function loadModel() {
  model = await use.load();
  console.log('[RAGMODEL] Universal Sentence Encoder model loaded');
}
loadModel();

function preprocessText(text) {
  console.log('[RAGMODEL] Preprocessing text...');
  const cleanedText = text
    .replace(/Navigation[\s\S]*?(Menu|Search)/gi, '')
    .replace(/\b(Privacy Policy|Terms & Conditions|Legal|Contact Us|About Us | Advertisements)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  console.log(`[RAGMODEL] Preprocessed text length: ${cleanedText.length}`);
  console.log(`[RAGMODEL] First 200 characters of preprocessed text: ${cleanedText.substring(0, 200)}...`);
  return cleanedText;
}

function chunkText(text, maxLength = 1000) {
  console.log('[RAGMODEL] Chunking content...');
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxLength) {
      currentChunk += sentence + ' ';
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = sentence + ' ';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  console.log(`[RAGMODEL] Created ${chunks.length} chunks.`);
  chunks.forEach((chunk, index) => {
    console.log(`[RAGMODEL] Chunk ${index + 1} (${chunk.length} chars): ${chunk.substring(0, 100)}...`);
  });
  return chunks;
}

function scoreChunksByQuery(chunks, query) {
  console.log('[RAGMODEL] Scoring chunks by query...');
  const queryWords = query.toLowerCase().split(' ');
  const scores = chunks.map((chunk, index) => {
    const chunkWords = chunk.toLowerCase().split(' ');
    const matchingWords = chunkWords.filter(word => queryWords.includes(word));
    const score = matchingWords.length + matchingWords.reduce((sum, word) => sum + chunkWords.filter(w => w === word).length, 0);
    console.log(`[RAGMODEL] Chunk ${index + 1} score: ${score}`);
    return { chunk, score };
  });
  const sortedScores = scores.sort((a, b) => b.score - a.score);
  console.log('[RAGMODEL] Top 3 chunk scores:');
  sortedScores.slice(0, 3).forEach((item, index) => {
    console.log(`[RAGMODEL] Chunk ${index + 1} score: ${item.score}`);
  });
  return sortedScores;
}

async function summarizeTopChunks(scoredChunks, topN = 10) {
  console.log(`[RAGMODEL] Summarizing top ${topN} chunks...`);
  const topChunks = scoredChunks.slice(0, topN);
  const summaries = [];

  for (const { chunk } of topChunks) {
    const summary = await generateSummary(chunk);
    summaries.push(summary);
  }

  return summaries;
}

async function generateSummary(chunk) {
  console.log('[RAGMODEL] Generating summary for chunk...');
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `Summarize the following text concisely:

${chunk}

Summary:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    console.log(`[RAGMODEL] Generated summary (first 100 chars): ${summary.substring(0, 100)}...`);
    return summary;
  } catch (error) {
    console.error('[RAGMODEL] Error generating summary:', error);
    return chunk; // Fallback to original chunk if summarization fails
  }
}

function createMegaChunk(summaries, maxLength = 3000) {
  console.log('[RAGMODEL] Creating mega chunk...');
  let megaChunk = '';
  for (const summary of summaries) {
    if (megaChunk.length + summary.length <= maxLength) {
      megaChunk += summary + ' ';
    } else {
      break;
    }
  }
  megaChunk = megaChunk.trim();
  console.log(`[RAGMODEL] Mega chunk created. Length: ${megaChunk.length}`);
  console.log(`[RAGMODEL] Mega chunk content: ${megaChunk}`);
  return megaChunk;
}

function fallbackMechanism(megaChunk, fullContext, query) {
  console.log('[RAGMODEL] Checking if fallback is needed...');
  if (!megaChunk.toLowerCase().includes(query.toLowerCase())) {
    console.log("[FALLBACK] Mega chunk does not contain relevant information. Searching full context...");
    return fullContext;
  } else {
    console.log("[FALLBACK] Mega chunk contains relevant information.");
    return megaChunk;
  }
}

async function generateAnswer(query, context) {
  console.log('[RAGMODEL] Generating AI answer...');
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `Based on the following context, provide a comprehensive answer to the query. If the exact answer is not found, synthesize the most relevant information to address the query.

Context: ${context}

Query: ${query}

Answer:`;

  console.log(`[RAGMODEL] Prompt for AI (first 200 chars): ${prompt.substring(0, 200)}...`);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();
    console.log(`[RAGMODEL] AI-generated answer (first 200 chars): ${answer.substring(0, 200)}...`);
    return answer;
  } catch (error) {
    console.error('[RAGMODEL] Error generating AI answer:', error);
    throw error;
  }
}

const getModelResponse = async (question, fullContext) => {
  try {
    console.log('[RAGMODEL] Received question:', question);
    console.log('[RAGMODEL] Length of combined context:', fullContext.length);

    const cleanedContext = preprocessText(fullContext);
    const chunks = chunkText(cleanedContext);
    const scoredChunks = scoreChunksByQuery(chunks, question);
    const summaries = await summarizeTopChunks(scoredChunks);
    let megaChunk = createMegaChunk(summaries);
    
    const finalContext = fallbackMechanism(megaChunk, fullContext, question);
    const answer = await generateAnswer(question, finalContext);

    console.log(`[RAGMODEL] Final answer generated.`);

    return {
      question,
      answer,
      confidence: 0.8,
    };
  } catch (error) {
    console.error('[RAGMODEL] Error in pipeline:', error);
    throw error;
  }
};

module.exports = getModelResponse;
