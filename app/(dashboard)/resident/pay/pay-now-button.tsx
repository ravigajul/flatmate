'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface PayNowButtonProps {
  feeScheduleId: string
  label?: string
}

export default function PayNowButton({ feeScheduleId, label = 'Pay Now' }: PayNowButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeScheduleId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Payment initiation failed')
      }

      window.location.href = data.redirectUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={handlePay} loading={loading} size="lg">
        {label}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
