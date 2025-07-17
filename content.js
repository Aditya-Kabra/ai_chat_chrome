console.log('Content script loaded');

let selectedText = '';

// Function to get elements in viewport
function getViewportContent() {
  const viewportHeight = window.innerHeight;
  const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div, span');
  let visibleText = '';
  
  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    if (rect.top >= 0 && rect.top <= viewportHeight && element.innerText.trim()) {
      visibleText += element.innerText.trim() + ' ';
    }
  });
  
  return visibleText.trim().substring(0, 3000);
}

function getPageContent() {
  const mainContent = document.querySelector('main, article, .content') || document.body;
  
  return {
    title: document.title,
    url: window.location.href,
    fullText: mainContent.innerText.trim().substring(0, 5000),
    viewportText: getViewportContent(),
    selectedText: selectedText,
    scrollPosition: window.scrollY
  };
}

// Make globally accessible
window.getPageContent = getPageContent;

// Listen for text selection
document.addEventListener('mouseup', () => {
  const selection = window.getSelection().toString().trim();
  console.log('Text selected:', selection);
  if (selection.length > 0) {
    selectedText = selection;
    console.log('Stored selected text:', selection);
  }
});

// Handle messages from background with proper error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'ping') {
      // Respond to ping to confirm content script is ready
      sendResponse({ status: 'ready' });
      return;
    } else if (request.action === 'getPageContent') {
      sendResponse(getPageContent());
      return;
    } else if (request.action === 'showOverlay') {
      // Handle both icon click and Alt+Q
      const selection = window.getSelection().toString().trim();
      
      // Set selected text (empty string if none)
      selectedText = selection;
      
      // Check if createChatOverlay function is available
      if (typeof window.createChatOverlay === 'function') {
        createChatOverlay(selectedText);
        sendResponse({ success: true });
      } else {
        console.error('createChatOverlay function not available');
        sendResponse({ error: 'Overlay function not available' });
      }
      return;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
});

// Show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4285f4;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Confirm content script is ready
console.log('Content script fully loaded and ready');
