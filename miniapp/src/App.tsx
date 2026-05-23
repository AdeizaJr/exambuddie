import { Routes, Route } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Practice from './pages/Practice';
import Quiz from './pages/Quiz';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div style={{ background: 'var(--tg-secondary-bg)', minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
