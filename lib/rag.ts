import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { env } from './env';
import { ABM_PROMPTS } from './prompts';
import { ScrapedCompanyData } from './scraper';
import { Citation } from './youcom';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export interface ABMInsights {
  insights: string[];
  email_subject: string;
  email_body: string;
  citations: string[];
}

export interface RAGResult {
  insights: ABMInsights;
  runId: string;
}

/**
 * Creates embeddings for text chunks and stores them in Supabase
 */
async function createAndStoreEmbeddings(
  runId: string,
  texts: string[],
  citations: Citation[]
): Promise<void> {
  try {
    // Create embeddings using OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensions
      input: texts,
    });

    const embeddings = embeddingResponse.data.map((item) => item.embedding);

    // Store in Supabase
    const records = texts.map((text, idx) => ({
      run_id: runId,
      content_json: { text, chunk_index: idx },
      embedding: embeddings[idx],
      citations: citations[idx] ? [citations[idx]] : [],
    }));

    // Insert in batches
    const { error } = await supabase.from('abm_insights').insert(records);

    if (error) {
      console.error('Error storing embeddings:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error creating embeddings:', error);
    throw error;
  }
}

/**
 * Performs similarity search in vector database
 */
async function similaritySearch(
  queryEmbedding: number[],
  runId: string,
  limit: number = 5
): Promise<Array<{ text: string; citations: Citation[] }>> {
  try {
    // Use Supabase pgvector similarity search
    const { data, error } = await supabase.rpc('match_abm_insights', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit,
      run_id: runId,
    });

    if (error) {
      // Fallback: if RPC doesn't exist, use direct query
      console.warn('RPC function not found, using fallback query');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('abm_insights')
        .select('content_json, citations')
        .eq('run_id', runId)
        .limit(limit);

      if (fallbackError) throw fallbackError;
      return (fallbackData || []).map((item) => ({
        text: item.content_json?.text || '',
        citations: (item.citations as Citation[]) || [],
      }));
    }

    return (data || []).map((item: any) => ({
      text: item.content_json?.text || '',
      citations: (item.citations as Citation[]) || [],
    }));
  } catch (error) {
    console.error('Error in similarity search:', error);
    return [];
  }
}

/**
 * Main RAG pipeline: combines scraped data + You.com citations, creates embeddings, and generates insights
 */
export async function runRAGPipeline(
  runId: string,
  companyName: string,
  scrapedData: ScrapedCompanyData,
  youComCitations: Citation[]
): Promise<ABMInsights> {
  try {
    // Combine scraped data and citations into text chunks
    const textChunks: string[] = [];
    const chunkCitations: Citation[] = [];

    // Add scraped company info
    if (scrapedData.description) {
      textChunks.push(`Company: ${scrapedData.name}\nDescription: ${scrapedData.description}`);
      chunkCitations.push({ text: '', url: `https://${scrapedData.domain}`, title: scrapedData.name });
    }

    if (scrapedData.metadata?.about) {
      textChunks.push(`About: ${scrapedData.metadata.about}`);
      chunkCitations.push({ text: '', url: `https://${scrapedData.domain}`, title: scrapedData.name });
    }

    // Add You.com citations as chunks
    for (const citation of youComCitations) {
      textChunks.push(citation.text);
      chunkCitations.push(citation);
    }

    if (textChunks.length === 0) {
      throw new Error('No text chunks to process');
    }

    // Create and store embeddings
    await createAndStoreEmbeddings(runId, textChunks, chunkCitations);

    // Create query embedding for similarity search
    const queryText = ABM_PROMPTS.generateRAGContext(companyName);
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
    });

    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    // Perform similarity search
    const relevantChunks = await similaritySearch(queryEmbedding, runId, 5);

    // Combine relevant chunks for LLM context
    const contextText = relevantChunks
      .map((chunk, idx) => `[${idx + 1}] ${chunk.text}`)
      .join('\n\n');

    const allCitations = relevantChunks.flatMap((chunk) => chunk.citations);
    const uniqueCitations = Array.from(
      new Map(allCitations.map((c) => [c.url, c])).values()
    );

    // Generate final insights using OpenAI
    const prompt = ABM_PROMPTS.generateInsights(
      companyName,
      `Company: ${scrapedData.name}\n${scrapedData.description}\n\n${contextText}`,
      uniqueCitations
    );

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert ABM strategist. Always return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(responseText) as ABMInsights;

    // Ensure citations are included
    if (!parsed.citations || parsed.citations.length === 0) {
      parsed.citations = uniqueCitations.map((c) => c.url);
    }

    return parsed;
  } catch (error) {
    console.error('Error in RAG pipeline:', error);
    
    // Fallback: return basic insights without RAG
    return {
      insights: [
        `Company: ${scrapedData.name}`,
        `Domain: ${scrapedData.domain}`,
        'Research completed with available data',
      ],
      email_subject: `Opportunity for ${scrapedData.name}`,
      email_body: `Hello ${scrapedData.name} team,\n\nI wanted to reach out regarding potential collaboration opportunities.\n\nBest regards`,
      citations: youComCitations.map((c) => c.url),
    };
  }
}
