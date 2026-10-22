import { describe, expect, it } from 'vitest'
import { DEFAULT_MODELS, upgradeModels } from './models'

describe('AI model defaults', () => {
  it('scans photos with the fast lite model', () => {
    expect(DEFAULT_MODELS.vision).toBe('gemini-3.5-flash-lite')
  })

  it('moves saved settings off the old, overloaded photo default', () => {
    const saved = { vision: 'gemini-3.8-flash', chat: 'x-chat', text: 'x-text' }
    expect(upgradeModels(saved)).toEqual({
      vision: 'gemini-3.5-flash-lite',
      chat: 'x-chat',
      text: 'x-text',
    })
  })

  it('keeps a photo model the user chose themselves', () => {
    const saved = { vision: 'my-custom-model', chat: 'a', text: 'b' }
    expect(upgradeModels(saved)).toEqual(saved)
  })

  it('fills in missing models from the defaults', () => {
    expect(upgradeModels(undefined)).toEqual(DEFAULT_MODELS)
  })
})
