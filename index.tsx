/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, Modality} from '@google/genai';
import {marked} from 'marked';

// Global AI instance - will be initialized when API key is provided
let ai: GoogleGenAI | null = null;

// DOM elements
const userInput = document.querySelector('#input') as HTMLTextAreaElement;
const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
const error = document.querySelector('#error') as HTMLDivElement;
const explainButton = document.querySelector('#explain-button') as HTMLButtonElement;
const apiKeyInput = document.querySelector('#api-key-input') as HTMLInputElement;
const saveKeyButton = document.querySelector('#save-key-button') as HTMLButtonElement;
const clearKeyButton = document.querySelector('#clear-key-button') as HTMLButtonElement;
const apiKeyStatus = document.querySelector('#api-key-status') as HTMLParagraphElement;

const additionalInstructions = `
Explain the topic in a series of simple, easy-to-understand points.
Keep sentences short but conversational, casual, and engaging.
For each point, generate a cute, minimal illustration with black ink on a white background that visually represents the concept.
No commentary, just begin your explanation.
Keep going until you're done.`;

// API Key Management
const API_KEY_STORAGE_KEY = 'gemini_api_key';

function saveApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
  initializeAI(key);
  updateApiKeyStatus(true);
  updateButtonStates();
}

function loadApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  ai = null;
  apiKeyInput.value = '';
  updateApiKeyStatus(false);
  updateButtonStates();
}

function initializeAI(apiKey: string) {
  try {
    ai = new GoogleGenAI({apiKey});
    return true;
  } catch (e) {
    console.error('Failed to initialize AI:', e);
    return false;
  }
}

function updateApiKeyStatus(configured: boolean) {
  if (configured) {
    apiKeyStatus.textContent = 'API key configured ✓';
    apiKeyStatus.className = 'api-key-status configured';
  } else {
    apiKeyStatus.textContent = 'No API key configured';
    apiKeyStatus.className = 'api-key-status not-configured';
  }
}

function updateButtonStates() {
  const hasApiKey = ai !== null;
  explainButton.disabled = !hasApiKey;
  
  // Update examples clickability - Fixed type casting
  const examples = document.querySelectorAll('#examples li') as NodeListOf<HTMLLIElement>;
  examples.forEach((li) => {
    if (hasApiKey) {
      li.style.cursor = 'pointer';
      li.style.opacity = '1';
    } else {
      li.style.cursor = 'not-allowed';
      li.style.opacity = '0.6';
    }
  });
}

// Initialize on page load
function initializeApp() {
  const savedKey = loadApiKey();
  if (savedKey) {
    initializeAI(savedKey);
    updateApiKeyStatus(true);
  } else {
    updateApiKeyStatus(false);
  }
  updateButtonStates();
}

// Event listeners for API key management
saveKeyButton.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (key) {
    if (initializeAI(key)) {
      saveApiKey(key);
      apiKeyInput.value = ''; // Clear input for security
    } else {
      showError('Invalid API key. Please check your key and try again.');
    }
  }
});

clearKeyButton.addEventListener('click', () => {
  clearApiKey();
});

apiKeyInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveKeyButton.click();
  }
});

// Utility functions
async function addSlide(text: string, image: HTMLImageElement) {
  const slide = document.createElement('div');
  slide.className = 'slide';
  const caption = document.createElement('div') as HTMLDivElement;
  caption.innerHTML = await marked.parse(text);
  slide.append(image);
  slide.append(caption);
  slideshow.append(slide);
}

function parseError(error: string) {
  try {
    const e = JSON.parse(error.replace(/^[^{]*/, ''));
    return e.error.message;
  } catch (e) {
    return String(error);
  }
}

function showError(message: string) {
  error.innerHTML = message;
  error.removeAttribute('hidden');
}

function hideError() {
  error.innerHTML = '';
  error.toggleAttribute('hidden', true);
}

// Main generation function
async function generate(message: string) {
  if (!message.trim()) return;
  
  if (!ai) {
    showError('Please configure your Gemini API key first.');
    return;
  }

  userInput.disabled = true;
  explainButton.disabled = true;
  explainButton.textContent = 'Generating...';

  const chat = ai.chats.create({
    model: 'gemini-2.0-flash-preview-image-generation',
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  slideshow.innerHTML = '';
  hideError();
  slideshow.toggleAttribute('hidden', true);

  try {
    const result = await chat.sendMessageStream({
      message: message + additionalInstructions,
    });
    
    userInput.value = '';
    let text = '';
    let img: HTMLImageElement | null = null;

    for await (const chunk of result) {
      const candidates = chunk?.candidates ?? [];
      for (const candidate of candidates) {
        const parts = candidate?.content?.parts ?? [];
        for (const part of parts) {
          if (part.text) {
            text += part.text;
          } else if (part.inlineData) {
            try {
              img = document.createElement('img');
              img.src = `data:image/png;base64,` + part.inlineData.data;
            } catch (e) {
              console.log('Error processing image data', e);
            }
          }
          if (text && img) {
            await addSlide(text, img);
            slideshow.removeAttribute('hidden');
            text = '';
            img = null;
          }
        }
      }
    }
    if (img) {
      await addSlide(text || ' ', img);
      slideshow.removeAttribute('hidden');
    }
  } catch (e) {
    const msg = parseError(String(e));
    showError(`Something went wrong: ${msg}`);
  }
  
  userInput.disabled = false;
  explainButton.disabled = false;
  explainButton.textContent = 'Explain';
  userInput.focus();
}

// Event listeners for main functionality
userInput.addEventListener('keydown', async (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    await generate(userInput.value);
  }
});

explainButton.addEventListener('click', async () => {
  await generate(userInput.value);
});

// Example click handlers - Fixed type casting
const examples = document.querySelectorAll('#examples li') as NodeListOf<HTMLLIElement>;
examples.forEach((li) =>
  li.addEventListener('click', async () => {
    if (!ai) {
      showError('Please configure your Gemini API key first.');
      return;
    }
    const message = li.textContent || '';
    userInput.value = message;
    await generate(message);
  }),
);

// Initialize the app when the page loads
initializeApp();
