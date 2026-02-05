'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ABMResult {
  run_id: string;
  company: string;
  domain: string;
  insights: {
    insights: string[];
    email_subject: string;
    email_body: string;
    citations: string[];
  };
  scraped_data: {
    name: string;
    description: string;
    domain: string;
  };
  you_com_citations: number;
}

export default function ABMResultsPage({ params }: { params: { company: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runId = searchParams.get('run_id');
  
  const [data, setData] = useState<ABMResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setError('Run ID is required');
      setLoading(false);
      return;
    }

    // Fetch results from API
    fetch(`/api/abm?run_id=${runId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.error) {
          setError(result.error);
        } else {
          // Map API response to expected format
          setData({
            run_id: result.run_id,
            company: result.company,
            domain: result.domain,
            insights: result.insights,
            scraped_data: result.scraped_data,
            you_com_citations: result.you_com_citations,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [runId]);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading ABM insights...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">{error || 'No data found'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const companyName = decodeURIComponent(params.company);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4 inline-block"
          >
            ← Back to Home
          </button>
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-2">
            ABM Insights for {companyName}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Domain: {data.domain} • {data.you_com_citations} citations found
          </p>
        </div>

        {/* Key Insights */}
        <section className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
            Key Insights
          </h2>
          <ul className="space-y-2">
            {data.insights.insights.map((insight, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span className="text-zinc-700 dark:text-zinc-300">{insight}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Email Preview */}
        <section className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
              Personalized Email
            </h2>
            <button
              onClick={() => copyToClipboard(
                `Subject: ${data.insights.email_subject}\n\n${data.insights.email_body}`,
                'email'
              )}
              className="px-3 py-1 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              {copied === 'email' ? 'Copied!' : 'Copy Email'}
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Subject:
              </label>
              <p className="mt-1 text-zinc-800 dark:text-zinc-200 font-medium">
                {data.insights.email_subject}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Body:
              </label>
              <div className="mt-1 p-4 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {data.insights.email_body}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Citations */}
        {data.insights.citations && data.insights.citations.length > 0 && (
          <section className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
              Citations & Sources
            </h2>
            <ul className="space-y-2">
              {data.insights.citations.map((citation, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-blue-600 mr-2">{idx + 1}.</span>
                  <a
                    href={citation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 break-all"
                  >
                    {citation}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Scraped Data */}
        <section className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-4">
            Company Information
          </h2>
          <div className="space-y-2">
            <p className="text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Name:</span> {data.scraped_data.name}
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Description:</span> {data.scraped_data.description}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
