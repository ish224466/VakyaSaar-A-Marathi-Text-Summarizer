// Use VITE_CUSTOM_MODEL_URL when provided and non-empty; otherwise default to localhost:8000
const envBase = (import.meta.env.VITE_CUSTOM_MODEL_URL as string) || '';
const BASE = envBase.trim().length > 0 ? envBase : 'http://localhost:8000';

// Helpful debug output when developing. Remove or lower verbosity in production.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.debug('[CustomModelService] BASE =', BASE);
}

export default class CustomModelService {
  static async summarize(text: string, min_length?: number, max_length?: number): Promise<string> {
    const resp = await fetch(`${BASE}/summarize-marathi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ text, min_length, max_length }),
    });

    if (!resp.ok) {
      const textErr = await resp.text();
      throw new Error(textErr || 'Summarization request failed');
    }

    const data = await resp.json();
    return data.summary;
  }

  static async isReady(): Promise<boolean> {
    try {
      const resp = await fetch(`${BASE}/ready`);
      if (!resp.ok) return false;
      const data = await resp.json();
      // eslint-disable-next-line no-console
      if (typeof window !== 'undefined') console.debug('[CustomModelService] /ready ->', data);
      return !!data.loaded;
    } catch (e) {
      // eslint-disable-next-line no-console
      if (typeof window !== 'undefined') console.error('[CustomModelService] /ready error', e);
      return false;
    }
  }

  static async warmUp(): Promise<void> {
    try {
      await fetch(`${BASE}/load`, { method: 'POST' });
    } catch (e) {
      // ignore
    }
  }
}
