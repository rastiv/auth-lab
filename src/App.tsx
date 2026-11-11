import { useEffect, useState } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json() as Promise<{ status: string }>)
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus('unreachable'))
  }, [])

  return (
    <main>
      <h1>auth-lab</h1>
      <p>API: {apiStatus}</p>
    </main>
  )
}

export default App
