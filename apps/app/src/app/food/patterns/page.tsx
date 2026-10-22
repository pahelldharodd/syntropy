'use client'

import { Suspense } from 'react'
import { DietPatternsScreen } from '@/screens/nutrition/DietPatterns'

export default function Page() {
  return (
    <Suspense>
      <DietPatternsScreen />
    </Suspense>
  )
}
