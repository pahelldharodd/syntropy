/**
 * Default Gemini models. Photo scans use the lite model: on the free tier gemini-3.8-flash was
 * returning 503 "high demand" or taking ~90 s per plate, while flash-lite answered in ~5 s.
 */
export const DEFAULT_MODELS = {
  vision: 'gemini-3.5-flash-lite',
  chat: 'gemini-3.5-flash-lite',
  text: 'gemini-3.5-flash-lite',
}

export type Models = typeof DEFAULT_MODELS

const OLD_VISION_DEFAULT = 'gemini-3.8-flash'

/** Saved models with the old photo default swapped out; a model the user typed is kept. */
export function upgradeModels(saved: Partial<Models> | undefined): Models {
  const m = { ...DEFAULT_MODELS, ...saved }
  return m.vision === OLD_VISION_DEFAULT ? { ...m, vision: DEFAULT_MODELS.vision } : m
}
