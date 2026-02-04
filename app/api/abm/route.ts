import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { scrapeCompany } from '@/lib/scraper';
import { fetchCitedResearch, fetchExpressResearch } from '@/lib/youcom';
import { runRAGPipeline } from '@/lib/rag';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const requestSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  domain: z.string().min(1, 'Domain is required'),
  send_via_n8n: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);

    const { company, domain, send_via_n8n } = validated;

    // Create a new run record
    const { data: runData, error: runError } = await supabase
      .from('abm_runs')
      .insert({
        company,
        domain,
        status: 'processing',
      })
      .select()
      .single();

    if (runError || !runData) {
      return NextResponse.json(
        { error: 'Failed to create run record', details: runError },
        { status: 500 }
      );
    }

    const runId = runData.id;

    try {
      // Step 1: Scrape company basics
      const scrapedData = await scrapeCompany(domain);

      // Step 2: Fetch You.com cited research
      let youComData;
      try {
        youComData = await fetchExpressResearch(company);
        // If no citations, try search API
        if (youComData.citations.length === 0) {
          youComData = await fetchCitedResearch(company);
        }
      } catch (error) {
        console.error('You.com API error:', error);
        youComData = { citations: [] };
      }

      // Step 3: Run RAG pipeline
      const insights = await runRAGPipeline(
        runId,
        company,
        scrapedData,
        youComData.citations
      );

      // Prepare full result
      const fullResult = {
        insights,
        scraped_data: scrapedData,
        you_com_citations: youComData.citations.length,
      };

      // Step 4: Update run status and store result
      await supabase
        .from('abm_runs')
        .update({ 
          status: 'completed',
          result_json: fullResult,
        })
        .eq('id', runId);

      // Step 5: Trigger n8n webhook if requested
      if (send_via_n8n && env.N8N_WEBHOOK_URL) {
        try {
          await fetch(env.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              company,
              domain,
              email_subject: insights.email_subject,
              email_body: insights.email_body,
              insights: insights.insights,
              citations: insights.citations,
              run_id: runId,
            }),
          });
        } catch (n8nError) {
          console.error('n8n webhook error:', n8nError);
          // Don't fail the request if n8n fails
        }
      }

      return NextResponse.json({
        success: true,
        run_id: runId,
        company,
        domain,
        insights,
        scraped_data: scrapedData,
        you_com_citations: youComData.citations.length,
      });
    } catch (error) {
      // Update run status to failed
      await supabase
        .from('abm_runs')
        .update({ status: 'failed' })
        .eq('id', runId);

      console.error('ABM processing error:', error);
      return NextResponse.json(
        {
          error: 'Failed to process ABM request',
          details: error instanceof Error ? error.message : 'Unknown error',
          run_id: runId,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const runId = searchParams.get('run_id');

  if (!runId) {
    return NextResponse.json({ error: 'run_id is required' }, { status: 400 });
  }

  try {
    // Fetch run details
    const { data: run, error: runError } = await supabase
      .from('abm_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Fetch insights
    const { data: insights, error: insightsError } = await supabase
      .from('abm_insights')
      .select('*')
      .eq('run_id', runId);

    // Return full result including stored result_json
    const result = {
      run_id: run.id,
      company: run.company,
      domain: run.domain,
      insights: run.result_json?.insights || {},
      scraped_data: run.result_json?.scraped_data || {},
      you_com_citations: run.result_json?.you_com_citations || 0,
      vector_insights: insights || [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching run:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
