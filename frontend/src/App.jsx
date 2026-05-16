import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Policies from './pages/Policies';
import Services from './pages/Services';
import Claims from './pages/Claims';
import ClaimDetail from './pages/ClaimDetail';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/services" element={<Services />} />
            <Route path="/claims" element={<Claims />} />
            <Route path="/claims/:id" element={<ClaimDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
