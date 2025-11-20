// src/service/CustomModelService.ts  (or wherever you have it)

const envBase = (import.meta.env.VITE_CUSTOM_MODEL_URL as string) || '';
const BASE = envBase.trim().length > 0 ? envBase.trim() : 'http://localhost:8000';

if (typeof window !== 'undefined') {
  console.debug('[CustomModelService] BASE =', BASE);
}

// Map model names to their specific endpoints
const MODEL_ENDPOINTS: Record<string, string> = {
  'mT5-Marathi': '/summarize',
  'IndicBART': '/summarize-marathi',
  'Pegasus-Marathi': '/summarize-pegasus',
};

export default class CustomModelService {
    static async summarize(
  text: string,
  modelName: 'mT5-Marathi' | 'IndicBART' | 'Pegasus-Marathi',
  tone: 'formal' | 'casual' | 'neutral' = 'neutral',
  length: 'short' | 'medium' | 'long' = 'medium'
): Promise<string> {
  const endpoint = MODEL_ENDPOINTS[modelName] || '/summarize';

  // Force Formal + Long for Pegasus-Marathi (Model 3)
  const finalTone = modelName === 'Pegasus-Marathi' ? 'formal' : tone;
  const finalLength = modelName === 'Pegasus-Marathi' ? 'long' : length;

  let min_length = 50;
  let max_length = 200;

  if (finalLength === 'short') { min_length = 30; max_length = 80; }
  else if (finalLength === 'medium') { min_length = 80; max_length = 180; }
  else if (finalLength === 'long') { min_length = 150; max_length = 400; }

  const resp = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      text,
      min_length,
      max_length,
      tone: finalTone,
      length: finalLength
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`[${modelName}] ${errText || 'Failed'}`);
  }

  const data = await resp.json();
  return data.summary || '';
}

  static async isReady(): Promise<boolean> {
    try {
      const resp = await fetch(`${BASE}/ready`);
      if (!resp.ok) return false;
      const data = await resp.json();
      return data.loaded === true;
    } catch (err){
      console.error('[CustomModelService] /ready failed:', err);
      return false;
    }
  }

  static async warmUp(): Promise<void> {
    try {
      await fetch(`${BASE}/load`, { method: 'POST' });
    } catch {
      // ignore
    }
  }
}