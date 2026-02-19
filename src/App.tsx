import { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import HomePage from './pages/HomePage';

function App() {
  const { checkLocalAI } = useAppStore();

  useEffect(() => {
    // Check if local AI is available on mount
    checkLocalAI();
  }, [checkLocalAI]);

  return (
    <div className="w-[400px] h-[600px] overflow-hidden">
      <HomePage />
    </div>
  );
}

export default App;
