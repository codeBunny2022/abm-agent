export const ABM_PROMPTS = {
  generateInsights: (companyName: string, scrapedData: string, citations: Array<{ text: string; url: string; title?: string }>) => {
    const citationsText = citations
      .map((c, i) => `${i + 1}. ${c.text}\n   Source: ${c.title || c.url}`)
      .join('\n\n');

    return `You are an ABM (Account-Based Marketing) research assistant. Generate personalized insights and outreach content for ${companyName}.

Company Information:
${scrapedData}

Recent Research & Citations:
${citationsText}

Generate a comprehensive ABM analysis with the following structure:
1. Key Insights (3-5 bullet points about the company's current state, recent news, or opportunities)
2. Personalized Email Subject Line (compelling, specific to recent news/insights)
3. Personalized Email Body (professional, warm, references specific recent developments, includes a clear value proposition)
4. Citations (list of source URLs used)

Return your response as a JSON object with this exact structure:
{
  "insights": ["insight 1", "insight 2", ...],
  "email_subject": "Subject line here",
  "email_body": "Full email body here",
  "citations": ["url1", "url2", ...]
}

Be specific, reference recent news or developments, and make the outreach feel personalized and relevant.`;
  },

  generateRAGContext: (companyName: string) => {
    return `Generate relevant ABM insights for ${companyName}. Focus on:
- Recent company news and developments
- Product launches or updates
- Industry trends affecting the company
- Potential pain points or opportunities
- Key decision makers or team information`;
  },
};
