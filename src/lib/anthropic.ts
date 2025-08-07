// src/lib/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('ANTHROPIC_API_KEY not found in environment variables');
  console.warn('Please add ANTHROPIC_API_KEY to your .env.local file');
  console.warn('This is required for book preprocessing features to work');
}

// Validate API key format
if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
  console.warn('ANTHROPIC_API_KEY appears to be in an incorrect format');
  console.warn('Anthropic API keys should start with "sk-ant-"');
  console.warn('Please check your .env.local file and update the key');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export { anthropic };