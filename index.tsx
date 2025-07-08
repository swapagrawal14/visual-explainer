/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, Modality} from '@google/genai';
import {marked} from 'marked';

// --- YEH LINE THEEK KAR DI GAYI HAI ---
// This is the correct way to get the secret key on Vercel
const ai = new GoogleGenAI({apiKey: import.meta.env.VITE_GEMINI_API_KEY});

const chat = ai.chats.create({
  model: 'gemini-1.5-flash',
  config: {
    responseModalities: [Modality.TEXT, Modality.IMAGE],
  },
  history: [],
});

const userInput = document.querySelector('#input') as HTMLTextAreaElement;
const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
const error = document.querySelector('#error') as HTMLDivElement;
const explainButton = document.querySelector('#explain-button') as HTMLButtonElement;

const additionalInstructions = `
Explain the topic in a series of simple, easy-to-understand points.
Keep sentences short but conversational, casual, and engaging.
For each point, generate a cute, minimal illustration with black ink on a white background that visually represents the concept.
No commentary, just begin your explanation.
Keep going until you're done.`;

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

async function generate(message: string) {
  if (!message.trim()) return;

  userInput.disabled = true;
  explainButton.disabled = true;
  explainButton.textContent = 'Generating...';

  chat.history.length = 0;
  slideshow.innerHTML = '';
  error.innerHTML = '';
  slideshow.toggleAttribute('hidden', true);
  error.toggleAttribute('hidden', true);

  try {
    const result = await chat.sendMessageStream({
      message: message + additionalInstructions,
    });
    
    userInput.value = '';
    let text = '';
    let img = null;

    for await (const chunk of result) {
      for (const candidate of chunk.candidates) {
        for (const part of candidate.content.parts ?? []) {
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
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
  }
  
  userInput.disabled = false;
  explainButton.disabled = false;
  explainButton.textContent = 'Explain';
  userInput.focus();
}

userInput.addEventListener('keydown', async (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    await generate(userInput.value);
  }
});

explainButton.addEventListener('click', async () => {
  await generate(userInput.value);
});

const examples = document.querySelectorAll('#examples li');
examples.forEach((li) =>
  li.addEventListener('click', async () => {
    const message = li.textContent || '';
    userInput.value = message;
    await generate(message);
  }),
);
