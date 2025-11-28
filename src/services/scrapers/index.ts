/**
 * Scraper Factory - Creates the appropriate scraper based on configuration
 */

import { ScraperProvider, ScraperProviderType } from './types';
import { GroqScraper } from './groq';
import { OpenAIScraper } from './openai';

/**
 * Get the configured scraper provider
 * Defaults to 'groq' if SCRAPER_PROVIDER is not set
 */
export function getScraperProvider(): ScraperProvider {
  const providerType = (process.env.SCRAPER_PROVIDER || 'groq') as ScraperProviderType;

  console.log(`[ScraperFactory] Creating scraper: ${providerType}`);

  switch (providerType) {
    case 'groq':
      try {
        return new GroqScraper();
      } catch (error) {
        console.warn('[ScraperFactory] Groq unavailable, falling back to OpenAI');
        return new OpenAIScraper();
      }

    case 'openai':
      return new OpenAIScraper();

    case 'gemini':
      // Future: implement GeminiScraper
      console.warn('[ScraperFactory] Gemini not implemented, using OpenAI');
      return new OpenAIScraper();

    default:
      console.warn(`[ScraperFactory] Unknown provider: ${providerType}, using Groq`);
      return new GroqScraper();
  }
}

/**
 * Get a scraper that supports image extraction
 * Falls back to OpenAI if the configured scraper doesn't support images
 */
export function getImageScraper(): ScraperProvider {
  const mainScraper = getScraperProvider();

  if (mainScraper.supportsImageExtraction()) {
    return mainScraper;
  }

  console.log('[ScraperFactory] Main scraper does not support images, using OpenAI');
  return new OpenAIScraper();
}

export * from './types';
