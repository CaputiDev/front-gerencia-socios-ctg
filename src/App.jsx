import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import Painel from './pages/Painel'
import Socios from './pages/Socios'
import NovoSocio from './pages/NovoSocio'
import Relatorios from './pages/Relatorios'
import SocioDetalhe from './pages/SocioDetalhe'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/socios" element={<Socios />} />
          <Route path="/socios/novo" element={<NovoSocio />} />
          <Route path="/socios/:id" element={<SocioDetalhe />} />
          <Route path="/relatorios" element={<Relatorios />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
