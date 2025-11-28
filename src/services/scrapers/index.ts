/**
 * Scraper Factory - Creates the appropriate scraper based on configuration
 * Default: Gemini (100% Google AI)
 */

import { ScraperProvider, ScraperProviderType } from './types';
import { GeminiScraper } from './gemini';

/**
 * Get the configured scraper provider
 * Defaults to 'gemini' - 100% Gemini for cost efficiency
 */
export function getScraperProvider(): ScraperProvider {
  const providerType = (process.env.SCRAPER_PROVIDER || 'gemini') as ScraperProviderType;

  console.log(`[ScraperFactory] Creating scraper: ${providerType}`);

  // 100% Gemini - always use Gemini
  return new GeminiScraper();
}

/**
 * Get a scraper that supports image extraction
 * Gemini supports multimodal (text + images)
 */
export function getImageScraper(): ScraperProvider {
  return new GeminiScraper();
}

export * from './types';
