import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import GamesList from './pages/GamesList';
import GameForm from './pages/GameForm';
import GameDetail from './pages/GameDetail';
import Players from './pages/Players';
import Stats from './pages/Stats';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index                 element={<Dashboard />} />
            <Route path="games"          element={<GamesList />} />
            <Route path="games/new"      element={<GameForm />} />
            <Route path="games/:id/edit" element={<GameForm />} />
            <Route path="games/:id"      element={<GameDetail />} />
            <Route path="players"        element={<Players />} />
            <Route path="stats"          element={<Stats />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
