'use client'

import { useState, useTransition } from 'react'
import { updateOrderStatus, updateOrderTracking } from './actions'
import { Loader2, Check, Package } from 'lucide-react'

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
  currentTracking,
  currentTrackingUrl,
}: {
  orderId: string
  currentStatus: string
  currentTracking?: string | null
  currentTrackingUrl?: string | null
}) {
  const [status, setStatus] = useState(currentStatus)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [trackingNumber, setTrackingNumber] = useState(currentTracking || '')
  const [trackingUrl, setTrackingUrl] = useState(currentTrackingUrl || '')
  const [trackingSaved, setTrackingSaved] = useState(false)
  const [isTrackingPending, startTrackingTransition] = useTransition()

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

  function handleSaveTracking() {
    if (!trackingNumber.trim()) return
    setTrackingSaved(false)
    setError(null)

    startTrackingTransition(async () => {
      const result = await updateOrderTracking(
        orderId,
        trackingNumber.trim(),
        trackingUrl.trim() || undefined
      )
      if (result.error) {
        setError(result.error)
      } else {
        setTrackingSaved(true)
        setTimeout(() => setTrackingSaved(false), 2000)
      }
    })
  }

  const showTrackingFields = status === 'shipped' || status === 'delivered'

  return (
    <div className="space-y-3">
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

      {showTrackingFields && (
        <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            <Package className="h-3 w-3" />
            Tracking Details
          </div>
          <input
            type="text"
            placeholder="Tracking number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            disabled={isTrackingPending}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
          />
          <input
            type="url"
            placeholder="Tracking URL (optional)"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            disabled={isTrackingPending}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-500"
          />
          <button
            type="button"
            onClick={handleSaveTracking}
            disabled={isTrackingPending || !trackingNumber.trim()}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTrackingPending ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            ) : (
              'Save Tracking'
            )}
          </button>
        </div>
      )}

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
        {trackingSaved && (
          <p className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" />
            Tracking saved
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
