const axios = require('axios');
const readline = require('readline');

// Set up readline interface to take user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Load API key from environment variable
const apiKey = process.env.HUGGINGFACE_API_KEY;

if (!apiKey) {
  console.log("API Key not found!");
  process.exit(1);
}

console.log("API Key Loaded Successfully");

// Function to make a request to Hugging Face API
async function callHuggingFaceAPI(question, context) {
  const url = 'https://api-inference.huggingface.co/models/facebook/rag-token-nq';

  const data = {
    inputs: {
      question: question,
      context: context
    }
  };

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log("Calling the model with question and context...");
    console.log("Sending data to Hugging Face API:", data);
    
    const response = await axios.post(url, data, { headers });

    console.log("API Response received:", response.data);

    if (response.data.answer) {
      return {
        answer: response.data.answer,
        score: response.data.score
      };
    } else {
      console.log("No answer found.");
      return { answer: "Sorry, I couldn't find an answer.", score: null };
    }
  } catch (error) {
    console.error("Error in API request:", error);
    return { answer: "There was an error processing your request.", score: null };
  }
}

// Prompt the user for a question
rl.question("Please ask a question about a rare disease: ", async (question) => {
  const context = "Parkinson's disease symptoms include tremors, stiffness, and difficulty moving. Parkinson's disease is a neurodegenerative disorder that affects movement."; // Example static context

  console.log(`Question asked: ${question}`);
  console.log(`Context provided: ${context}`);

  // Call the API and get the response
  const result = await callHuggingFaceAPI(question, context);
  
  console.log("Answer from model:", result.answer);
  console.log("Confidence score:", result.score);

  rl.close();
});
