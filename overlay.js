console.log('Overlay manager loaded');

// Overlay management variables
let chatOverlay = null;
let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };
let overlayCurrentConversationId = null;

// Default overlay settings
const DEFAULT_OVERLAY = {
  width: 350,
  height: 400,
  top: 50,
  left: window.innerWidth - 370 // 20px from right edge
};

// Copy to clipboard function
function copyToClipboard(button) {
  console.log('Copy button clicked'); // Debug log
  
  // Find the message content div
  const messageContainer = button.parentElement;
  const textDiv = messageContainer.querySelector('.message-content');
  
  if (!textDiv) {
    console.error('Could not find text content div');
    return;
  }
  
  // Get clean text content from stored property first, fallback to innerText
  let textContent = textDiv._rawText;
  
  if (!textContent) {
    console.log('No stored raw text, extracting from DOM');
    // Fallback: extract text and clean it
    textContent = textDiv.innerText || textDiv.textContent || '';
    // Clean up any remaining HTML entities
    textContent = textContent.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
  
  if (!textContent || !textContent.trim()) {
    console.error('No text content to copy. Text content:', textContent);
    return;
  }
  
  console.log('Copying text:', textContent); // Debug log
  
  // Try to copy to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textContent).then(() => {
      console.log('Copy successful via clipboard API!'); // Debug log
      showCopySuccess(button);
    }).catch(err => {
      console.error('Clipboard API failed:', err);
      fallbackCopy(textContent, button);
    });
  } else {
    console.log('Using fallback copy method');
    // Fallback for older browsers
    fallbackCopy(textContent, button);
  }
}

// Fallback copy method for older browsers
function fallbackCopy(text, button) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    showCopySuccess(button);
  } catch (err) {
    console.error('Fallback copy failed:', err);
  }
  
  document.body.removeChild(textArea);
}

// Show copy success feedback
function showCopySuccess(button) {
  const originalText = button.textContent;
  button.textContent = '✓';
  button.style.background = 'rgba(34, 197, 94, 0.1)';
  button.style.borderColor = 'rgba(34, 197, 94, 0.3)';
  button.style.color = '#22c55e';
  
  setTimeout(() => {
    button.textContent = originalText;
    button.style.background = 'rgba(102, 126, 234, 0.1)';
    button.style.borderColor = 'rgba(102, 126, 234, 0.3)';
    button.style.color = '#667eea';
  }, 1000);
}

// Simple markdown processor for AI responses
function processMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **bold** -> <strong>bold</strong>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')              // *italic* -> <em>italic</em>
    .replace(/`(.*?)`/g, '<code>$1</code>')            // `code` -> <code>code</code>
    .replace(/\n/g, '<br>')                            // newlines -> <br>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>'); // [text](url) -> links
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

// Overlay conversation management functions
function loadOverlayConversations() {
  chrome.runtime.sendMessage({action: 'getConversations'}, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error loading conversations:', chrome.runtime.lastError);
      return;
    }
    
    if (!response) {
      console.error('No response received for getConversations');
      return;
    }
    
    const conversations = response?.conversations || [];
    const dropdown = document.getElementById('overlay-conversation-dropdown');
    
    if (dropdown) {
      dropdown.innerHTML = '<option value="">✨ New Conversation</option>';
      
      // Show only the 5 most recent conversations to keep dropdown compact
      const recentConversations = conversations.slice(0, 5);
      
      recentConversations.forEach(conv => {
        const option = document.createElement('option');
        option.value = conv.id;
        option.textContent = conv.title;
        dropdown.appendChild(option);
      });
      
      // Add "View More" option if there are more conversations
      if (conversations.length > 5) {
        const moreOption = document.createElement('option');
        moreOption.value = 'view-more';
        moreOption.textContent = `📋 View All (${conversations.length} total)`;
        moreOption.style.color = '#667eea';
        moreOption.style.fontWeight = '500';
        dropdown.appendChild(moreOption);
      }
    }
  });
}

function handleOverlayConversationChange(e) {
  const conversationId = e.target.value;
  const messages = document.getElementById('overlay-messages');
  
  if (conversationId === 'view-more') {
    // Show all conversations when "View More" is selected
    loadAllConversations();
    // Reset to current conversation or new
    e.target.value = overlayCurrentConversationId || '';
    return;
  }
  
  if (conversationId === 'show-recent') {
    // Go back to showing only recent conversations
    loadOverlayConversations();
    // Reset to current conversation or new
    e.target.value = overlayCurrentConversationId || '';
    return;
  }
  
  if (!conversationId) {
    // New conversation
    overlayCurrentConversationId = null;
    chrome.runtime.sendMessage({action: 'newConversation'});
    if (messages) messages.innerHTML = '';
  } else {
    // Load existing conversation
    chrome.runtime.sendMessage({action: 'loadConversation', conversationId}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error loading conversation:', chrome.runtime.lastError);
        return;
      }
      
      if (response?.conversation) {
        overlayCurrentConversationId = conversationId;
        loadOverlayConversationMessages(response.conversation);
      }
    });
  }
}

function loadAllConversations() {
  chrome.runtime.sendMessage({action: 'getConversations'}, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error loading conversations:', chrome.runtime.lastError);
      return;
    }
    
    if (!response) {
      console.error('No response received for getConversations');
      return;
    }
    
    const conversations = response?.conversations || [];
    const dropdown = document.getElementById('overlay-conversation-dropdown');
    
    if (dropdown) {
      dropdown.innerHTML = '<option value="">✨ New Conversation</option>';
      
      // Show all conversations
      conversations.forEach(conv => {
        const option = document.createElement('option');
        option.value = conv.id;
        option.textContent = conv.title;
        dropdown.appendChild(option);
      });
      
      // Add "Show Recent" option to go back to compact view
      if (conversations.length > 5) {
        const lessOption = document.createElement('option');
        lessOption.value = 'show-recent';
        lessOption.textContent = '📌 Show Recent Only';
        lessOption.style.color = '#667eea';
        lessOption.style.fontWeight = '500';
        dropdown.appendChild(lessOption);
      }
    }
  });
}

function loadOverlayConversationMessages(conversation) {
  const messages = document.getElementById('overlay-messages');
  if (!messages) return;
  
  messages.innerHTML = '';
  
  if (conversation && conversation.messages) {
    conversation.messages.forEach(msg => {
      const content = msg.role === 'assistant' ? processMarkdown(msg.content) : msg.content;
      addOverlayMessage(msg.role, content);
    });
  }
}

function addOverlayMessage(sender, text) {
  const messages = document.getElementById('overlay-messages');
  if (!messages) return;
  
  const messageDiv = document.createElement('div');
  const isUser = sender === 'user';
  const isAssistant = sender === 'assistant';
  
  // Create the message container
  const messageContainer = document.createElement('div');
  messageContainer.style.cssText = 'display: flex; align-items: flex-start; gap: 8px;';
  
  // Create text content
  const textDiv = document.createElement('div');
  textDiv.className = 'message-content';
  textDiv.style.cssText = 'flex: 1; line-height: 1.5;';
  textDiv.innerHTML = text;
  
  // Store raw text directly on the element for easy access
  if (isAssistant) {
    const rawText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    textDiv._rawText = rawText; // Store as property instead of data attribute
  }
  
  // Assemble the message
  messageContainer.appendChild(textDiv);
  
  // Add copy button for assistant messages
  if (isAssistant) {
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.title = 'Copy response';
    copyButton.textContent = '📋';
    copyButton.style.cssText = `
      opacity: 0;
      transition: opacity 0.2s;
      background: rgba(102, 126, 234, 0.1);
      border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 6px;
      padding: 4px 6px;
      cursor: pointer;
      font-size: 12px;
      color: #667eea;
      margin-left: 8px;
      flex-shrink: 0;
    `;
    
    copyButton.onclick = function() {
      copyToClipboard(this);
    };
    
    messageContainer.appendChild(copyButton);
  }
  
  messageDiv.appendChild(messageContainer);
  
  messageDiv.style.cssText = `
    margin-bottom: 12px; 
    padding: 12px 16px; 
    border-radius: 12px; 
    color: #333;
    max-width: 85%;
    ${isUser ? 'margin-left: auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;' : 'background: #f6f8fa; border: 1px solid #e1e5e9;'}
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    animation: slideIn 0.3s ease-out;
  `;
  
  // Add hover effect to show copy button for assistant messages
  if (isAssistant) {
    messageDiv.addEventListener('mouseenter', () => {
      const copyBtn = messageDiv.querySelector('.copy-button');
      if (copyBtn) copyBtn.style.opacity = '1';
    });
    
    messageDiv.addEventListener('mouseleave', () => {
      const copyBtn = messageDiv.querySelector('.copy-button');
      if (copyBtn) copyBtn.style.opacity = '0';
    });
  }
  
  messages.appendChild(messageDiv);
  messages.scrollTop = messages.scrollHeight;
}

// Create floating chat overlay with saved position/size
function createChatOverlay(selectedText = '') {
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
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    border: 1px solid #e1e5e9;
    border-radius: 16px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    display: flex;
    flex-direction: column;
    min-width: 320px;
    min-height: 280px;
    overflow: hidden;
    backdrop-filter: blur(10px);
  `;

  chatOverlay.innerHTML = `
    <div id="overlay-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 15px 15px 0 0; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">🤖</span>
        <span style="font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;">
          PageBot${selectedText ? ` • "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"` : ''}
        </span>
      </div>
      <button id="close-overlay" style="background: rgba(255,255,255,0.2); border: none; color: white; font-size: 16px; cursor: pointer; padding: 6px 8px; border-radius: 6px; transition: all 0.2s; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">×</button>
    </div>
    <div style="padding: 12px 16px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-bottom: 1px solid #e1e5e9;">
      <div style="display: flex; gap: 8px; align-items: center;">
        <select id="overlay-conversation-dropdown" style="flex: 1; min-width: 0; max-width: 100%; padding: 6px 10px; border: 1px solid #d0d7de; border-radius: 8px; background: white; color: #333; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <option value="">✨ New Conversation</option>
        </select>
        <button id="overlay-new-conversation-btn" title="Start New Conversation" style="width: 32px; height: 32px; flex-shrink: 0; border: 1px solid #d0d7de; border-radius: 8px; background: white; color: #666; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: all 0.2s;">+</button>
      </div>
    </div>
    <div id="overlay-messages" style="flex: 1; padding: 16px; overflow-y: auto; background: white; scroll-behavior: smooth;"></div>
    <style>
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes bounce {
        0%, 80%, 100% { 
          transform: scale(0);
          opacity: 0.5;
        } 40% { 
          transform: scale(1);
          opacity: 1;
        }
      }
      
      #overlay-messages strong { font-weight: 600; color: inherit; }
      #overlay-messages em { font-style: italic; color: inherit; opacity: 0.8; }
      #overlay-messages code { 
        background: rgba(175, 184, 193, 0.2); 
        padding: 2px 6px; 
        border-radius: 6px; 
        font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; 
        font-size: 13px; 
        color: inherit;
      }
      #overlay-messages a { color: #0969da; text-decoration: none; font-weight: 500; }
      #overlay-messages a:hover { text-decoration: underline; }
      #overlay-messages { color: #333; }
      
      #overlay-input:focus {
        border-color: #667eea !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
      }
      
      #overlay-send:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4) !important;
      }
      
      #overlay-send:active {
        transform: translateY(0);
      }
      
      #close-overlay:hover {
        background: rgba(255,255,255,0.3) !important;
      }
      
      #overlay-new-conversation-btn:hover {
        background: #f6f8fa !important;
        border-color: #667eea !important;
        color: #667eea !important;
      }
      
      #overlay-conversation-dropdown:focus {
        border-color: #667eea !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        outline: none !important;
      }
      
      /* Limit dropdown to show 5 options with scrolling */
      #overlay-conversation-dropdown {
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 12px;
        padding-right: 28px;
      }
      
      /* Try to limit dropdown height when opened (browser dependent) */
      #overlay-conversation-dropdown option {
        padding: 6px 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.4;
      }
    </style>
    <div style="padding: 16px; border-top: 1px solid #e1e5e9; background: #f8f9fa; display: flex; gap: 10px;">
      <input id="overlay-input" type="text" placeholder="Ask a question about this page..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="flex: 1; padding: 12px 16px; border: 1px solid #d0d7de; border-radius: 12px; background: white; color: #333; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: all 0.2s; outline: none;">
      <button id="overlay-send" style="padding: 12px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); transition: all 0.2s; min-width: 70px;">Send</button>
    </div>
    <div id="resize-handle" style="position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nw-resize; background: linear-gradient(-45deg, transparent 0%, transparent 40%, #ccc 40%, #ccc 60%, transparent 60%); background-size: 6px 6px;"></div>
  `;

  document.body.appendChild(chatOverlay);

  // Load conversations into overlay dropdown and check for active conversation
  loadOverlayConversations();
  
  // Check if there's an active conversation
  chrome.runtime.sendMessage({action: 'getCurrentConversation'}, (convResponse) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error getting current conversation:', chrome.runtime.lastError);
      return;
    }
    
    if (convResponse?.conversation) {
      overlayCurrentConversationId = convResponse.conversation.id;
      setTimeout(() => {
        const dropdown = document.getElementById('overlay-conversation-dropdown');
        if (dropdown) {
          dropdown.value = overlayCurrentConversationId;
          loadOverlayConversationMessages(convResponse.conversation);
        }
      }, 100);
    }
  });

  // Add conversation management
  const overlayDropdown = document.getElementById('overlay-conversation-dropdown');
  const overlayNewBtn = document.getElementById('overlay-new-conversation-btn');
  
  overlayDropdown.addEventListener('change', handleOverlayConversationChange);
  overlayNewBtn.addEventListener('click', () => {
    overlayDropdown.value = '';
    overlayDropdown.dispatchEvent(new Event('change'));
  });

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
  const question = input.value.trim();

  if (!question) return;

  // Add user message
  addOverlayMessage('user', question);

  // Add loading message  
  const messages = document.getElementById('overlay-messages');
  const loadingMsg = document.createElement('div');
  loadingMsg.innerHTML = `
    <div style="display: flex; align-items: center; gap: 4px; padding: 8px;">
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #667eea; animation: bounce 1.4s ease-in-out infinite both; animation-delay: -0.32s;"></div>
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #667eea; animation: bounce 1.4s ease-in-out infinite both; animation-delay: -0.16s;"></div>
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #667eea; animation: bounce 1.4s ease-in-out infinite both;"></div>
    </div>
  `;
  loadingMsg.style.cssText = `
    margin-bottom: 12px; 
    padding: 12px 16px; 
    border-radius: 12px; 
    color: #333;
    max-width: 85%;
    background: #f6f8fa; 
    border: 1px solid #e1e5e9;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  `;
  loadingMsg.id = 'overlay-loading-' + Date.now();
  messages.appendChild(loadingMsg);

  input.value = '';
  messages.scrollTop = messages.scrollHeight;

  // Send to background for API call with conversation support
  const pageContent = window.getPageContent ? window.getPageContent() : null;
  
  if (!pageContent) {
    loadingMsg.remove();
    addOverlayMessage('assistant', 'Error: Unable to get page content. Please refresh the page and try again.');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'askQuestion',
    question: question,
    pageContent: pageContent,
    conversationId: overlayCurrentConversationId
  }, (response) => {
    loadingMsg.remove();
    
    // Check for runtime errors
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      addOverlayMessage('assistant', 'Connection error. Please refresh the page and try again.');
      return;
    }
    
    if (!response) {
      console.error('No response received from background script');
      addOverlayMessage('assistant', 'No response received. Please refresh the page and try again.');
      return;
    }
    
    if (response && response.answer) {
      addOverlayMessage('assistant', processMarkdown(response.answer));
      
      // If a new conversation was created, update dropdown and current ID
      if (response.conversationId && !overlayCurrentConversationId) {
        overlayCurrentConversationId = response.conversationId;
        loadOverlayConversations();
        setTimeout(() => {
          const dropdown = document.getElementById('overlay-conversation-dropdown');
          if (dropdown) dropdown.value = overlayCurrentConversationId;
        }, 100);
      }
    } else {
      addOverlayMessage('assistant', response?.error || 'Sorry, I encountered an error. Please try again.');
    }
  });
}

// Make functions globally available
window.createChatOverlay = createChatOverlay;
window.copyToClipboard = copyToClipboard; 