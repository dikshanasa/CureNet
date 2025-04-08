// backend/utils/config.js
require('dotenv').config();

module.exports = {
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
    GOOGLE_CUSTOM_SEARCH_API_KEY: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
    GOOGLE_CUSTOM_SEARCH_ENGINE_ID: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY
};
