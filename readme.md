# Chrome Extension Q&A Assistant

An AI-powered Chrome extension that helps you ask questions about any webpage content. Select text, press a keyboard shortcut, and get instant AI responses with full page context.

## Features

- 🤖 **AI-powered Q&A** using Google's Gemini API
- 📝 **Smart context handling** - prioritizes selected text, viewport content, and full page
- ⌨️ **Keyboard shortcut** (Option+Q on Mac, Alt+Q on Windows/Linux)
- 🖱️ **Draggable & resizable** floating overlay
- 💾 **Position memory** - remembers where you left it

## Installation

### Step 1: Download the Extension

1. Clone or download this repository:
Copy
git clone https://github.com/Aditya-Kabra/chrome_extension_qa.git


Or download as ZIP and extract it.

2. Navigate to the extension folder:
Copy
cd chrome_extension_qa


### Step 2: Get Your Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API key"**
4. Copy the generated API key

3. Update `background.js` to use the key:
- Open `background.js`
- Find the line: `const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';`
- Replace it with: `const GEMINI_API_KEY = 'your_actual_api_key_here';`

### Step 4: Install in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in the top right)
3. Click **"Load unpacked"**
4. Select the `chrome_extension_qa` folder
5. The extension should now appear in your extensions list
6. Ignore the errors

### Step 5: Set Up Keyboard Shortcut (Optional)

1. Go to `chrome://extensions/shortcuts`
2. Find "Page Q&A Assistant"
3. Set your preferred shortcut (default is Alt+Q)

## Usage

### Method 1: Keyboard Shortcut (Recommended)
1. Select text on any webpage
2. Press **Option+Q** (Mac) or **Alt+Q** (Windows/Linux)
3. A floating overlay will appear
4. Ask questions about the selected text or page content

### Method 2: Extension Button
1. Click the extension icon in your toolbar
2. A popup will appear
3. Ask questions about the current page

## Privacy

- This extension only processes content from pages you explicitly interact with
- Your API key is stored locally and never shared
- Conversations are stored in your browser's local storage
- No data is sent to any servers except Google's Gemini API

## License

MIT License - feel free to modify and distribute

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Open browser Developer Tools to check for errors
3. Verify your API key is correctly configured
4. Make sure you're using a supported browser (Chrome/Chromium)

---

**Enjoy your AI-powered browsing experience!** 🚀