import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedCompanyData {
  name: string;
  description: string;
  domain: string;
  metadata?: {
    title?: string;
    keywords?: string;
    about?: string;
  };
}

/**
 * Scrapes basic company information from a website domain
 */
export async function scrapeCompany(domain: string): Promise<ScrapedCompanyData> {
  try {
    // Ensure domain has protocol
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);

    // Extract title
    const title = $('title').text().trim() || '';
    
    // Extract meta description
    const metaDescription = $('meta[name="description"]').attr('content') || 
                           $('meta[property="og:description"]').attr('content') || '';

    // Extract keywords
    const keywords = $('meta[name="keywords"]').attr('content') || '';

    // Try to find about section - common selectors
    const aboutSelectors = [
      'section.about',
      '.about',
      '#about',
      '[class*="about"]',
      '[id*="about"]',
      'section[class*="company"]',
      '.company-info',
    ];

    let aboutText = '';
    for (const selector of aboutSelectors) {
      const element = $(selector).first();
      if (element.length) {
        aboutText = element.text().trim();
        if (aboutText.length > 50) break; // Found substantial content
      }
    }

    // Fallback: try to get first paragraph from main content
    if (!aboutText) {
      aboutText = $('main p').first().text().trim() || 
                  $('article p').first().text().trim() ||
                  $('body p').first().text().trim();
    }

    // Extract company name from title or h1
    const companyName = title.split('|')[0].split('-')[0].trim() || 
                       $('h1').first().text().trim() ||
                       domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];

    return {
      name: companyName,
      description: metaDescription || aboutText || title,
      domain: domain.replace(/^https?:\/\//, '').replace(/^www\./, ''),
      metadata: {
        title,
        keywords,
        about: aboutText,
      },
    };
  } catch (error) {
    // Fallback: return minimal data
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
    return {
      name: cleanDomain.split('.')[0],
      description: `Company information for ${cleanDomain}`,
      domain: cleanDomain,
      metadata: {},
    };
  }
}
