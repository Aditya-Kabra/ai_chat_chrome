console.log('Conversation manager loaded');

// Conversation Management
class ConversationManager {
  constructor() {
    this.currentConversationId = null;
  }

  // Generate conversation ID
  generateId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Generate conversation title from first question
  generateTitle(question, pageTitle) {
    const shortQuestion = question.length > 25 ? question.substring(0, 25) + '...' : question;
    const shortPageTitle = pageTitle.length > 20 ? pageTitle.substring(0, 20) + '...' : pageTitle;
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${shortPageTitle} • ${shortQuestion} • ${date}`;
  }

  // Get current active conversation
  async getCurrentConversation() {
    if (!this.currentConversationId) {
      return null;
    }
    
    // Use local storage only (session storage requires Chrome 102+ and additional permissions)
    // try {
    //   const sessionResult = await chrome.storage.session.get([this.currentConversationId]);
    //   if (sessionResult[this.currentConversationId]) {
    //     return sessionResult[this.currentConversationId];
    //   }
    // } catch (error) {
    //   console.log('Session storage not available, using local storage');
    // }
    
    // Fallback to local storage
    const result = await chrome.storage.local.get(['conversations']);
    const conversations = result.conversations || {};
    return conversations[this.currentConversationId] || null;
  }

  // Create new conversation
  async createConversation(pageContent, question) {
    const conversationId = this.generateId();
    const conversation = {
      id: conversationId,
      title: this.generateTitle(question, pageContent.title),
      pageUrl: pageContent.url,
      pageTitle: pageContent.title,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      messages: []
    };

    // Store in session for immediate access (with fallback)
    // try {
    //   await chrome.storage.session.set({ [conversationId]: conversation });
    // } catch (error) {
    //   console.log('Session storage not available, using local storage only');
    // }
    
    // Also store in local storage for persistence
    await this.saveToLocalStorage(conversation);
    
    this.currentConversationId = conversationId;
    return conversation;
  }

  // Add message to conversation
  async addMessage(role, content, conversationId = null) {
    const id = conversationId || this.currentConversationId;
    if (!id) return null;

    const conversation = await this.getCurrentConversation();
    if (!conversation) return null;

    const message = {
      role,
      content,
      timestamp: Date.now()
    };

    conversation.messages.push(message);
    conversation.lastUpdated = Date.now();

    // Update session storage (with fallback)
    // try {
    //   await chrome.storage.session.set({ [id]: conversation });
    // } catch (error) {
    //   console.log('Session storage not available, using local storage only');
    // }
    
    // Update local storage
    await this.saveToLocalStorage(conversation);

    return conversation;
  }

  // Save conversation to local storage
  async saveToLocalStorage(conversation) {
    const existing = await chrome.storage.local.get(['conversations']);
    const conversations = existing.conversations || {};
    conversations[conversation.id] = conversation;
    await chrome.storage.local.set({ conversations });
  }

  // Get all conversations from local storage
  async getAllConversations() {
    const result = await chrome.storage.local.get(['conversations']);
    const conversations = result.conversations || {};
    return Object.values(conversations).sort((a, b) => b.lastUpdated - a.lastUpdated);
  }

  // Load conversation into session
  async loadConversation(conversationId) {
    const result = await chrome.storage.local.get(['conversations']);
    const conversations = result.conversations || {};
    const conversation = conversations[conversationId];
    
    if (conversation) {
      // try {
      //   await chrome.storage.session.set({ [conversationId]: conversation });
      // } catch (error) {
      //   console.log('Session storage not available, using local storage only');
      // }
      this.currentConversationId = conversationId;
      return conversation;
    }
    return null;
  }

  // Get conversation context for API (last N messages to stay within limits)
  getConversationContext(conversation, maxMessages = 6) {
    if (!conversation || !conversation.messages.length) {
      return '';
    }

    const recentMessages = conversation.messages.slice(-maxMessages);
    return recentMessages.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n\n');
  }

  // Set current conversation
  setCurrentConversation(conversationId) {
    this.currentConversationId = conversationId;
  }

  // Reset to no current conversation
  resetCurrentConversation() {
    this.currentConversationId = null;
  }
}

// Make globally available for extension scripts
// Note: Using globalThis works in both service workers and content scripts
if (typeof globalThis !== 'undefined') {
  globalThis.ConversationManager = ConversationManager;
} 