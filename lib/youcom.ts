import { env } from './env';

export interface Citation {
  text: string;
  url: string;
  title?: string;
}

export interface YouComSearchResult {
  citations: Citation[];
  summary?: string;
}

/**
 * Fetches cited research from You.com API for a company
 */
export async function fetchCitedResearch(company: string): Promise<YouComSearchResult> {
  try {
    const query = `recent news and updates about ${company} company products services`;
    
    // Using You.com Search API
    // Based on docs.you.com - using the search endpoint
    const response = await fetch('https://api.you.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.YOU_API_KEY,
      },
      body: JSON.stringify({
        query,
        mode: 'research',
        count: 8, // Get top 8 results
      }),
    });

    if (!response.ok) {
      throw new Error(`You.com API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse You.com response structure
    // Adapt based on actual API response format
    const citations: Citation[] = [];
    
    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results.slice(0, 8)) {
        if (result.url && result.snippet) {
          citations.push({
            text: result.snippet,
            url: result.url,
            title: result.title || result.url,
          });
        }
      }
    } else if (data.citations && Array.isArray(data.citations)) {
      // Alternative response format
      for (const citation of data.citations.slice(0, 8)) {
        citations.push({
          text: citation.text || citation.snippet || '',
          url: citation.url || citation.link || '',
          title: citation.title || citation.source || '',
        });
      }
    } else if (data.snippets && Array.isArray(data.snippets)) {
      // Another possible format
      for (const snippet of data.snippets.slice(0, 8)) {
        citations.push({
          text: snippet.text || snippet.content || '',
          url: snippet.url || snippet.link || '',
          title: snippet.title || '',
        });
      }
    }

    // Fallback: if no structured data, try to extract from response
    if (citations.length === 0 && data.text) {
      // If API returns plain text, create a single citation
      citations.push({
        text: data.text.substring(0, 500),
        url: data.url || `https://you.com/search?q=${encodeURIComponent(query)}`,
        title: `Research about ${company}`,
      });
    }

    return {
      citations: citations.slice(0, 8), // Ensure max 8
      summary: data.summary || data.answer || undefined,
    };
  } catch (error) {
    console.error('Error fetching You.com research:', error);
    // Return empty result on error
    return {
      citations: [],
    };
  }
}

/**
 * Alternative: Use You.com Express API for more structured responses
 */
export async function fetchExpressResearch(company: string): Promise<YouComSearchResult> {
  try {
    const query = `What are the latest news, products, and business updates about ${company}?`;
    
    const response = await fetch('https://api.you.com/express', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.YOU_API_KEY,
      },
      body: JSON.stringify({
        query,
        format: 'citations',
      }),
    });

    if (!response.ok) {
      // Fallback to search API
      return fetchCitedResearch(company);
    }

    const data = await response.json();

    const citations: Citation[] = [];
    
    if (data.citations && Array.isArray(data.citations)) {
      for (const citation of data.citations.slice(0, 8)) {
        citations.push({
          text: citation.text || citation.content || '',
          url: citation.url || citation.source || '',
          title: citation.title || citation.source_name || '',
        });
      }
    }

    return {
      citations: citations.slice(0, 8),
      summary: data.answer || data.summary,
    };
  } catch (error) {
    // Fallback to search API
    return fetchCitedResearch(company);
  }
}
