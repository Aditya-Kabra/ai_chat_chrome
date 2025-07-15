console.log('Content script loaded');

let selectedText = '';
let chatOverlay = null;
let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };

// Default overlay settings
const DEFAULT_OVERLAY = {
  width: 350,
  height: 400,
  top: 50,
  left: window.innerWidth - 370 // 20px from right edge
};

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

// Save overlay settings to localStorage
function saveOverlaySettings() {
  if (!chatOverlay) return;
  
  const settings = {
    width: chatOverlay.offsetWidth,
    height: chatOverlay.offsetHeight,
    top: parseInt(chatOverlay.style.top) || 50,
    left: parseInt(chatOverlay.style.left) || (window.innerWidth - 370)
  };
  
  localStorage.setItem('qaAssistantOverlay', JSON.stringify(settings));
  console.log('Overlay settings saved:', settings);
}

// Load overlay settings from localStorage
function loadOverlaySettings() {
  try {
    const saved = localStorage.getItem('qaAssistantOverlay');
    if (saved) {
      const settings = JSON.parse(saved);
      console.log('Overlay settings loaded:', settings);
      
      // Validate settings are within current viewport
      const maxX = window.innerWidth - 300; // minimum 300px width
      const maxY = window.innerHeight - 250; // minimum 250px height
      
      return {
        width: Math.max(300, Math.min(settings.width, window.innerWidth - 50)),
        height: Math.max(250, Math.min(settings.height, window.innerHeight - 50)),
        top: Math.max(0, Math.min(settings.top, maxY)),
        left: Math.max(0, Math.min(settings.left, maxX))
      };
    }
  } catch (error) {
    console.log('Error loading overlay settings:', error);
  }
  
  return DEFAULT_OVERLAY;
}

// Listen for text selection
document.addEventListener('mouseup', () => {
  const selection = window.getSelection().toString().trim();
  console.log('Text selected:', selection);
  if (selection.length > 0) {
    selectedText = selection;
    console.log('Stored selected text:', selection);
  }
});

// Handle messages from background and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    sendResponse(getPageContent());
  } else if (request.action === 'shortcutPressed') {
    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
      selectedText = selection;
      createChatOverlay();
    } else {
      showNotification('Select some text first, then press the shortcut!');
    }
  }
});

// Create floating chat overlay with saved position/size
function createChatOverlay() {
  // Remove existing overlay if present
  if (chatOverlay) {
    saveOverlaySettings(); // Save current settings before removing
    chatOverlay.remove();
  }

  // Load saved settings
  const settings = loadOverlaySettings();

  chatOverlay = document.createElement('div');
  chatOverlay.style.cssText = `
    position: fixed;
    top: ${settings.top}px;
    left: ${settings.left}px;
    width: ${settings.width}px;
    height: ${settings.height}px;
    background: white;
    border: 2px solid #4285f4;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 10000;
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: column;
    min-width: 300px;
    min-height: 250px;
    overflow: hidden;
  `;

  chatOverlay.innerHTML = `
    <div id="overlay-header" style="background: #4285f4; color: white; padding: 12px; border-radius: 10px 10px 0 0; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none;">
      <span>📝 Q&A Assistant</span>
      <button id="close-overlay" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 4px;">×</button>
    </div>
    <div style="padding: 12px; background: #f5f5f5; font-size: 12px; border-bottom: 1px solid #ddd;">
      🎯 Selected: "${selectedText.substring(0, 60)}${selectedText.length > 60 ? '...' : ''}"
    </div>
    <div id="overlay-messages" style="flex: 1; padding: 12px; overflow-y: auto; background: white;"></div>
    <div style="padding: 12px; border-top: 1px solid #ddd; display: flex; gap: 8px;">
      <input id="overlay-input" type="text" placeholder="Ask about the selected text..." style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
      <button id="overlay-send" style="padding: 8px 16px; background: #4285f4; color: white; border: none; border-radius: 4px; cursor: pointer;">Send</button>
    </div>
    <div id="resize-handle" style="position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nw-resize; background: linear-gradient(-45deg, transparent 0%, transparent 40%, #ccc 40%, #ccc 60%, transparent 60%); background-size: 6px 6px;"></div>
  `;

  document.body.appendChild(chatOverlay);

  // Add drag functionality
  const header = document.getElementById('overlay-header');
  header.addEventListener('mousedown', startDrag);

  // Add resize functionality
  const resizeHandle = document.getElementById('resize-handle');
  resizeHandle.addEventListener('mousedown', startResize);

  // Add event listeners
  document.getElementById('close-overlay').addEventListener('click', () => {
    saveOverlaySettings(); // Save before closing
    chatOverlay.remove();
    chatOverlay = null;
  });

  document.getElementById('overlay-send').addEventListener('click', sendOverlayMessage);
  document.getElementById('overlay-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendOverlayMessage();
    }
  });

  // Focus on input
  document.getElementById('overlay-input').focus();
}

// Drag functionality (updated to save position)
function startDrag(e) {
  isDragging = true;
  const rect = chatOverlay.getBoundingClientRect();
  dragOffset.x = e.clientX - rect.left;
  dragOffset.y = e.clientY - rect.top;
  
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
}

function drag(e) {
  if (!isDragging) return;
  
  const x = e.clientX - dragOffset.x;
  const y = e.clientY - dragOffset.y;
  
  // Keep overlay within viewport
  const maxX = window.innerWidth - chatOverlay.offsetWidth;
  const maxY = window.innerHeight - chatOverlay.offsetHeight;
  
  const newX = Math.max(0, Math.min(x, maxX));
  const newY = Math.max(0, Math.min(y, maxY));
  
  chatOverlay.style.left = newX + 'px';
  chatOverlay.style.top = newY + 'px';
}

function stopDrag() {
  isDragging = false;
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  
  // Save position after dragging
  saveOverlaySettings();
}

// Resize functionality (updated to save size)
function startResize(e) {
  isResizing = true;
  const startX = e.clientX;
  const startY = e.clientY;
  const startWidth = chatOverlay.offsetWidth;
  const startHeight = chatOverlay.offsetHeight;
  
  function resize(e) {
    if (!isResizing) return;
    
    const width = Math.max(300, startWidth + (e.clientX - startX));
    const height = Math.max(250, startHeight + (e.clientY - startY));
    
    chatOverlay.style.width = width + 'px';
    chatOverlay.style.height = height + 'px';
  }
  
  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResize);
    
    // Save size after resizing
    saveOverlaySettings();
  }
  
  document.addEventListener('mousemove', resize);
  document.addEventListener('mouseup', stopResize);
  e.preventDefault();
}

// Send message from overlay
function sendOverlayMessage() {
  const input = document.getElementById('overlay-input');
  const messages = document.getElementById('overlay-messages');
  const question = input.value.trim();

  if (!question) return;

  // Add user message
  const userMsg = document.createElement('div');
  userMsg.innerHTML = `<strong>You:</strong> ${question}`;
  userMsg.style.cssText = 'margin-bottom: 8px; padding: 8px; background: #e3f2fd; border-radius: 4px;';
  messages.appendChild(userMsg);

  // Add loading message
  const loadingMsg = document.createElement('div');
  loadingMsg.innerHTML = '<strong>AI:</strong> 🤔 Thinking...';
  loadingMsg.style.cssText = 'margin-bottom: 8px; padding: 8px; background: #f3e5f5; border-radius: 4px;';
  messages.appendChild(loadingMsg);

  input.value = '';
  messages.scrollTop = messages.scrollHeight;

  // Send to background for API call
  const pageContent = getPageContent();
  chrome.runtime.sendMessage({
    action: 'askQuestion',
    question: question,
    pageContent: pageContent
  }, (response) => {
    loadingMsg.remove();
    const aiMsg = document.createElement('div');
    aiMsg.innerHTML = `<strong>AI:</strong> ${response && response.answer ? response.answer : 'Sorry, I encountered an error.'}`;
    aiMsg.style.cssText = 'margin-bottom: 8px; padding: 8px; background: #f3e5f5; border-radius: 4px;';
    messages.appendChild(aiMsg);
    messages.scrollTop = messages.scrollHeight;
  });
}

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
