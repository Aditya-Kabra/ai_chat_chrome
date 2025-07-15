console.log('Background script loaded');

const GEMINI_API_KEY = 'YOUR_API_KEY_HERE'; // Your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Handle keyboard shortcuts - this should create overlay, not open popup
chrome.commands.onCommand.addListener((command) => {
  console.log('Shortcut pressed:', command);
  
  if (command === 'open-with-selection') {
    // Send message to content script to show overlay
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        console.log('Sending message to content script for overlay');
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'shortcutPressed',
          command: command
        });
      }
    });
  }
});

// Handle popup messages (for the taskbar popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'askQuestion') {
    console.log('Received question:', request.question);
    handleGeminiRequest(request, sendResponse);
    return true;
  }
});

// ... rest of your handleGeminiRequest function stays the same
async function handleGeminiRequest(request, sendResponse) {
  try {
    console.log('Making API call to Gemini...');
    
    const { question, pageContent } = request;
    
    if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
      console.error('API key not set!');
      sendResponse({
        answer: 'Error: Please set your Gemini API key in background.js'
      });
      return;
    }
    
    let prompt = `You are a helpful assistant answering questions about a webpage.
    
Page Title: ${pageContent.title}

Full Page Content: ${pageContent.fullText}

Current Viewport Content: ${pageContent.viewportText}`;

    if (pageContent.selectedText) {
      prompt += `\n\nSelected Text (FOCUS ON THIS): ${pageContent.selectedText}`;
    }

    prompt += `\n\nUser Question: ${question}

Please answer the question based on the page content. If there's selected text, focus on that while using the full page context for better understanding.`;

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    console.log('API response status:', response.status);
    
    const data = await response.json();
    console.log('API response data:', data);
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      sendResponse({
        answer: data.candidates[0].content.parts[0].text
      });
    } else {
      console.error('Unexpected API response format:', data);
      sendResponse({
        answer: 'Sorry, I could not generate a response. Please try again.'
      });
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    sendResponse({
      answer: `Error: ${error.message}`
    });
  }
}
