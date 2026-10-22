'use client'

import { Suspense } from 'react'
import { NutrientsScreen } from '@/screens/nutrition/Nutrients'

export default function Page() {
  return (
    <Suspense>
      <NutrientsScreen />
    </Suspense>
  )
}
