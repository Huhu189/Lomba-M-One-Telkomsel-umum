import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import 'bootstrap/dist/css/bootstrap.min.css'
import './theme/theme.css'
import App from './App.jsx'
import { MaskotBuku } from './shared/ui/Maskot.jsx'
import { mulaiTema } from './shared/store/tema.js'

// Pasang tema sebelum render pertama agar tidak berkedip terang → gelap.
mulaiTema()

const container = document.getElementById('root')
if (!container) {
  throw new Error('Elemen #root tidak ditemukan di index.html')
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
})

/**
 * Error boundary level aplikasi (chunk theme: wajib satu level aplikasi;
 * boundary khusus halaman ulangan ditambahkan pada slice 04).
 */
function FallbackAplikasi() {
  return (
    <div role="alert" className="container py-5 text-center">
      <MaskotBuku ukuran={150} suasana="sedih" label="Maskot buku sedih" className="mb-3" />
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary FallbackComponent={FallbackAplikasi}>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
