const axios = require('axios');
const puppeteer = require('puppeteer');

const getSearchResults = async (query, location) => {
  try {
    const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

    console.log(`[SCRAPING] Searching Google for query="${query}" location="${location}"`);

    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: cx,
        q: query,
        gl: location,
        num: 5,
      },
    });

    const items = response.data.items || [];
    console.log(`[SCRAPING] Found ${items.length} search results.`);
    return items;
  } catch (error) {
    console.error('[SCRAPING] Error fetching search results:', error.message);
    throw error;
  }
};

const getArticleContent = async (url) => {
  let browser;
  try {
    console.log(`[SCRAPING] Fetching content from URL: ${url}`);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-extensions',
        '--disable-software-rasterizer',
        '--disable-features=site-per-process',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    const content = await page.evaluate(() => {
      // Remove script and style elements
      const elements = document.querySelectorAll('script, style, nav, header, footer, iframe');
      elements.forEach(el => el.remove());
      
      // Get the main content
      const mainContent = document.querySelector('main, article, .content, #content') || document.body;
      return mainContent.innerText || '';
    });

    console.log(`[SCRAPING] Extracted content length for ${url}: ${content.length}`);

    return content.substring(0, 10000); // Limit to first 10,000 characters
  } catch (error) {
    console.error(`[SCRAPING] Error fetching content from ${url}:`, error.message);
    return '';
  } finally {
    if (browser) await browser.close();
  }
};

const getFullContent = async (query, location) => {
  const searchResults = await getSearchResults(query, location);

  const articles = await Promise.all(
    searchResults.map(async result => ({
      title: result.title,
      link: result.link,
      content: await getArticleContent(result.link),
    }))
  );

  return articles.filter(article => article.content && article.content.trim().length > 0);
};

module.exports = { getFullContent };
