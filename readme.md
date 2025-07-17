# Page Q&A Assistant

Ask questions about any webpage using AI. Press Alt+Q to open a floating chatbot.

## What it does

- Extracts page content and selected text
- Sends questions to Gemini API
- Maintains conversation history per page
- Saves overlay position and conversations locally

## Requirements

- Chrome/Chromium browser
- Internet connection
- Valid Gemini API key

## Setup

**Get Gemini API key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create API key
3. Keep it private

**Install extension:**
1. Download this repository
2. Replace `YOUR_API_KEY_HERE` in `background.js` with your key
3. Open `chrome://extensions/`
4. Enable Developer mode → Load unpacked → Select folder

## Usage

Press **Alt+Q** (Mac: **Option+Q**) on any webpage. Select text first for specific questions.

## Troubleshooting

**Extension not responding:** Check API key in `background.js`  
**No overlay:** Click extension icon or verify keyboard shortcut  
**Errors:** Check Developer Tools (F12)

## Privacy

API key and conversations stored locally. Data shared only with Google's Gemini API.

---

MIT License