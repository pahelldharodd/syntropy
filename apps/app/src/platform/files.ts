'use client'

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNative } from './native'

/** Share a JSON backup (Android share sheet) or download it (web). */
export function exportJson(filename: string, data: unknown): Promise<void> {
  return exportText(filename, JSON.stringify(data, null, 2), 'application/json', 'Syntropy backup')
}

/** Share a text file (Android share sheet) or download it (web). */
export async function exportText(
  filename: string,
  text: string,
  mime: string,
  title: string,
): Promise<void> {
  if (isNative()) {
    const r = await Filesystem.writeFile({
      path: filename,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({ title, url: r.uri, dialogTitle: `Save your ${title}` })
    return
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function pickJsonFile(): Promise<unknown | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      try {
        resolve(JSON.parse(await f.text()))
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}
