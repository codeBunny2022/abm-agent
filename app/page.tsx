'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendViaN8n, setSendViaN8n] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/abm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company,
          domain,
          send_via_n8n: sendViaN8n,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      // Navigate to results page
      router.push(`/abm/${encodeURIComponent(company)}?run_id=${data.run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-2xl flex-col items-center justify-center py-16 px-8">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
              You.com ABM Agent
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Generate personalized ABM insights with cited research
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-zinc-900 p-8 rounded-lg shadow-lg">
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Company Name
              </label>
              <input
                id="company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., StratNova"
              />
            </div>

            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Company Domain
              </label>
              <input
                id="domain"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., stratnova.com"
              />
            </div>

            <div className="flex items-center">
              <input
                id="n8n"
                type="checkbox"
                checked={sendViaN8n}
                onChange={(e) => setSendViaN8n(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-zinc-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="n8n" className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">
                Send outreach via n8n webhook
              </label>
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? 'Processing...' : 'Generate ABM Insights'}
            </button>
          </form>

          <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            <p>Powered by You.com API, OpenAI, and Supabase</p>
          </div>
        </div>
      </main>
    </div>
  );
}
