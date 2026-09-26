'use client'

import { useState } from 'react'

export default function CarouselSetupPage() {
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function checkStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/templates/carousel-setup')
      const data = await res.json()
      setStatus(JSON.stringify(data, null, 2))
    } catch (err) {
      setStatus('Error: ' + (err instanceof Error ? err.message : String(err)))
    }
    setLoading(false)
  }

  async function setupCarousel() {
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/templates/carousel-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setStatus(JSON.stringify(data, null, 2))
    } catch (err) {
      setStatus('Error: ' + (err instanceof Error ? err.message : String(err)))
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Carousel Template Setup
      </h1>
      <p style={{ marginBottom: 20, color: '#666' }}>
        Create a WhatsApp carousel template for product image galleries.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          onClick={checkStatus}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          Check Status
        </button>
        <button
          onClick={setupCarousel}
          disabled={loading}
          style={{
            padding: '10px 20px',
            background: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Setting up...' : '🚀 Setup Carousel Template'}
        </button>
      </div>

      {status && (
        <pre
          style={{
            background: '#1e1e1e',
            color: '#0f0',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 14,
          }}
        >
          {status}
        </pre>
      )}
    </div>
  )
}
