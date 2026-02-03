import { z } from 'zod';

const envSchema = z.object({
  YOU_API_KEY: z.string().min(1, 'YOU_API_KEY is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  N8N_WEBHOOK_URL: z.string().url('N8N_WEBHOOK_URL must be a valid URL').optional(),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const env = {
    YOU_API_KEY: process.env.YOU_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
  };

  return envSchema.parse(env);
}

export const env = getEnv();
