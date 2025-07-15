document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-btn');
    const questionInput = document.getElementById('question-input');
    const messages = document.getElementById('messages');
    
    let pageContent = null;
    let selectedText = '';
    
    // Add this listener for text selection
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'textSelected') {
        selectedText = request.selectedText;
        addMessage('system', `📝 Selected text: "${selectedText.substring(0, 100)}${selectedText.length > 100 ? '...' : ''}"`);
      }
    });
  
    // Get page content when popup opens
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getPageContent'}, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Error:', chrome.runtime.lastError.message);
            addMessage('system', 'Could not access page content. Try refreshing the page.');
          } else if (response) {
            pageContent = response;
            let message = `✅ Ready to answer questions about: ${response.title}`;
            if (response.selectedText) {
              message += `\n�� Selected text: "${response.selectedText.substring(0, 100)}${response.selectedText.length > 100 ? '...' : ''}"`;
            }
            addMessage('system', message);
          }
        });
      }
    });
  
    sendBtn.addEventListener('click', sendMessage);
    questionInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  
    // Replace the sendMessage function with the original version that calls chrome.runtime.sendMessage
    function sendMessage() {
      const question = questionInput.value.trim();
      if (question && pageContent) {
        addMessage('user', question);
        questionInput.value = '';
        
        // Show loading message
        const loadingId = addMessage('assistant', '🤔 Thinking...');
        
        // Send to background script for Gemini API call
        chrome.runtime.sendMessage({
          action: 'askQuestion',
          question: question,
          pageContent: pageContent
        }, (response) => {
          // Remove loading message
          document.getElementById(loadingId).remove();
          
          if (response && response.answer) {
            addMessage('assistant', response.answer);
          } else {
            addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
          }
        });
      } else if (!pageContent) {
        addMessage('system', 'Please wait for page content to load first.');
      }
    }
  
    function addMessage(sender, text) {
      const messageDiv = document.createElement('div');
      const messageId = 'msg-' + Date.now();
      messageDiv.id = messageId;
      messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
      messageDiv.style.marginBottom = '8px';
      messageDiv.style.padding = '8px';
      messageDiv.style.borderRadius = '4px';
      
      if (sender === 'user') {
        messageDiv.style.backgroundColor = '#e3f2fd';
      } else if (sender === 'assistant') {
        messageDiv.style.backgroundColor = '#f3e5f5';
      }
      
      messages.appendChild(messageDiv);
      messages.scrollTop = messages.scrollHeight;
      return messageId;
    }
  });
  