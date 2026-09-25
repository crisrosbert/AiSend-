'use client'

import { useState, useTransition } from 'react'
import { updateOrderStatus } from './actions'
import { Loader2, Check } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function OrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(newStatus: string) {
    if (newStatus === status) return
    setStatus(newStatus)
    setSaved(false)
    setError(null)

    startTransition(async () => {
      const result = await updateOrderStatus(orderId, newStatus)
      if (result.error) {
        setError(result.error)
        setStatus(currentStatus) // revert on error
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    })
  }

  return (
    <div className="space-y-2">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Feedback */}
      <div className="h-5">
        {isPending && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating...
          </p>
        )}
        {saved && (
          <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" />
            Status updated
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Error: {error}
          </p>
        )}
      </div>
    </div>
  )
}
