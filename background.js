console.log('Background script loaded');

// Import conversation manager
importScripts('conversation-manager.js');

const GEMINI_API_KEY = ''; // Your actual API key
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Initialize conversation manager
const conversationManager = new ConversationManager();

// Helper function to safely send messages to content scripts
function safelySendMessage(tabId, message, callback = null) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) {
      console.log('Content script not ready or available:', chrome.runtime.lastError.message);
      if (callback) {
        callback({ error: chrome.runtime.lastError.message });
      }
      return;
    }
    if (callback) {
      callback(response);
    }
  });
}

// Helper function to check if content script is ready
async function ensureContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Content script not ready, attempting to inject...');
        // Try to inject the content script
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['conversation-manager.js', 'overlay.js', 'content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to inject content script:', chrome.runtime.lastError);
            resolve(false);
          } else {
            console.log('Content script injected successfully');
            resolve(true);
          }
        });
      } else {
        resolve(true);
      }
    });
  });
}

// Handle extension icon click - show floating overlay
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked');
  
  // Ensure content script is ready
  const ready = await ensureContentScript(tab.id);
  if (!ready) {
    console.error('Unable to prepare content script');
    return;
  }
  
  safelySendMessage(tab.id, {
    action: 'showOverlay',
    source: 'icon'
  });
});

// Handle keyboard shortcuts - show floating overlay
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Shortcut pressed:', command);
  
  if (command === 'open-with-selection') {
    // Send message to content script to show overlay
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs[0]) {
        console.log('Sending message to content script for overlay');
        
        // Ensure content script is ready
        const ready = await ensureContentScript(tabs[0].id);
        if (!ready) {
          console.error('Unable to prepare content script');
          return;
        }
        
        safelySendMessage(tabs[0].id, {
          action: 'showOverlay',
          source: 'shortcut',
          command: command
        });
      }
    });
  }
});

// Handle popup messages (for the taskbar popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    // Respond to ping to confirm background script is alive
    sendResponse({ status: 'alive' });
    return;
  } else if (request.action === 'askQuestion') {
    console.log('Received question:', request.question);
    handleGeminiRequest(request, sendResponse);
    return true;
  } else if (request.action === 'getConversations') {
    conversationManager.getAllConversations().then(conversations => {
      sendResponse({ conversations });
    }).catch(error => {
      console.error('Error getting conversations:', error);
      sendResponse({ conversations: [] });
    });
    return true;
  } else if (request.action === 'loadConversation') {
    conversationManager.loadConversation(request.conversationId).then(conversation => {
      sendResponse({ conversation });
    }).catch(error => {
      console.error('Error loading conversation:', error);
      sendResponse({ conversation: null });
    });
    return true;
  } else if (request.action === 'newConversation') {
    conversationManager.currentConversationId = null;
    sendResponse({ success: true });
    return true;
  } else if (request.action === 'getCurrentConversation') {
    conversationManager.getCurrentConversation().then(conversation => {
      sendResponse({ conversation });
    }).catch(error => {
      console.error('Error getting current conversation:', error);
      sendResponse({ conversation: null });
    });
    return true;
  }
});

// Handle Gemini API requests with conversation context
async function handleGeminiRequest(request, sendResponse) {
  try {
    console.log('Making API call to Gemini...');
    
    const { question, pageContent, conversationId } = request;
    
    if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
      console.error('API key not set!');
      sendResponse({
        answer: 'Error: Please set your Gemini API key in background.js'
      });
      return;
    }
    
    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await conversationManager.loadConversation(conversationId);
    } else {
      conversation = await conversationManager.getCurrentConversation();
    }
    
    if (!conversation) {
      conversation = await conversationManager.createConversation(pageContent, question);
    }
    
    // Add user message to conversation
    await conversationManager.addMessage('user', question);
    
    let prompt = `You are a helpful assistant answering questions about a webpage.
    
Page Title: ${pageContent.title}

Full Page Content: ${pageContent.fullText}

Current Viewport Content: ${pageContent.viewportText}`;

    if (pageContent.selectedText) {
      prompt += `\n\nSelected Text (FOCUS ON THIS): ${pageContent.selectedText}`;
    }

    // Add conversation history for context
    const conversationContext = conversationManager.getConversationContext(conversation);
    if (conversationContext) {
      prompt += `\n\nConversation History:\n${conversationContext}`;
    }

    prompt += `\n\nUser Question: ${question}

Please answer the question based on the page content and conversation history. If there's selected text, focus on that while using the full page context for better understanding.`;

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
      const answer = data.candidates[0].content.parts[0].text;
      
      // Add assistant response to conversation
      await conversationManager.addMessage('assistant', answer);
      
      sendResponse({
        answer: answer,
        conversationId: conversation.id
      });
    } else {
      console.error('Unexpected API response format:', JSON.stringify(data, null, 2));
      sendResponse({
        answer: 'Sorry, I could not generate a response. Please try again.',
        conversationId: conversation.id
      });
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    sendResponse({
      answer: `Error: ${error.message}`,
      conversationId: conversationManager.currentConversationId
    });
  }
}
