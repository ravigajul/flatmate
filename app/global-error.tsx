'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ fontFamily: 'monospace', padding: '2rem', background: '#1e1e1e', color: '#f0f0f0' }}>
        <h2>Error Details (temp debug)</h2>
        <p><strong>Message:</strong> {error.message}</p>
        <p><strong>Digest:</strong> {error.digest}</p>
        <pre style={{ background: '#333', padding: '1rem', overflow: 'auto', fontSize: '0.8rem' }}>
          {error.stack}
        </pre>
        <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
