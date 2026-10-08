import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import 'bootstrap/dist/css/bootstrap.min.css'
import './theme/theme.css'
import App from './App.jsx'
import { klienQuery } from './shared/store/klienQuery.js'
import { mulaiTema } from './shared/store/tema.js'

// Pasang tema sebelum render pertama agar tidak berkedip terang → gelap.
mulaiTema()

const container = document.getElementById('root')
if (!container) {
  throw new Error('Elemen #root tidak ditemukan di index.html')
}

/**
 * Error boundary level aplikasi (chunk theme: wajib satu level aplikasi;
 * boundary khusus halaman ulangan ditambahkan pada slice 04).
 */
function FallbackAplikasi() {
  return (
    <div role="alert" className="container py-5 text-center">
      <h1 className="h3 fw-bold">Ada yang tidak beres.</h1>
      <p className="teks-lembut">Jangan khawatir, coba muat ulang halamannya.</p>
      <button type="button" className="btn btn-aksen btn-besar" onClick={() => window.location.reload()}>
        Muat ulang
      </button>
    </div>
  )
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={klienQuery}>
      <BrowserRouter>
        <ErrorBoundary FallbackComponent={FallbackAplikasi}>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
