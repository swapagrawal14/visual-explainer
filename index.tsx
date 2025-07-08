/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, Modality} from '@google/genai';
import {marked} from 'marked';

// IMPORTANT: Your API key is now handled by Vercel's Environment Variables.
// This line uses the key you added in Vercel's settings.
const ai = new GoogleGenAI({apiKey: process.env.VITE_GEMINI_API_KEY});

const chat = ai.chats.create({
  model: 'gemini-1.5-flash', // Using a standard, reliable model
  config: {
    responseModalities: [Modality.TEXT, Modality.IMAGE],
  },
  history: [],
});

// Using querySelector to find the elements in your HTML
const userInput = document.querySelector('#input') as HTMLTextAreaElement;
const modelOutput = document.querySelector('#output') as HTMLDivElement;
const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
const error = document.querySelector('#error') as HTMLDivElement;
const explainButton = document.querySelector('#explain-button') as HTMLButtonElement; // Assuming you have a button with id="explain-button"

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
    return error;
  }
}

async function generate(message: string) {
  if (!message.trim()) return; // Don't run if the input is empty

  userInput.disabled = true;
  explainButton.disabled = true;

  chat.history.length = 0;
  slideshow.innerHTML = '';
  error.innerHTML = '';
  error.toggleAttribute('hidden', true);

  try {
    userInput.value = '';

    const result = await chat.sendMessageStream({
      message: message + additionalInstructions,
    });

    let text = '';
    let img = null;

    for await (const chunk of result) {
      for (const candidate of chunk.candidates) {
        for (const part of candidate.content.parts ?? []) {
          if (part.text) {
            text += part.text;
          } else {
            try {
              const data = part.inlineData;
              if (data) {
                img = document.createElement('img');
                img.src = `data:image/png;base64,` + data.data;
              }
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
    if (img) { // If there's a leftover image
      await addSlide(text || ' ', img); // Add with any remaining text or just a space
      slideshow.removeAttribute('hidden');
    }
  } catch (e) {
    const msg = parseError(String(e));
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
  }
  userInput.disabled = false;
  explainButton.disabled = false;
  userInput.focus();
}

// --- YEH HAI ENTER KEY KA CODE ---
// This listens for any key press in the input box
userInput.addEventListener('keydown', async (e: KeyboardEvent) => {
  // Checks if the pressed key is 'Enter' AND Shift key is NOT pressed
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // This stops the 'Enter' key from creating a new line
    const message = userInput.value;
    await generate(message); // Calls the same function as the button
  }
});

// This is for the button click
explainButton.addEventListener('click', async () => {
  const message = userInput.value;
  await generate(message);
});


// This is for the example prompts
const examples = document.querySelectorAll('#examples li');
examples.forEach((li) =>
  li.addEventListener('click', async () => {
    const message = li.textContent || '';
    userInput.value = message;
    await generate(message);
  }),
);
