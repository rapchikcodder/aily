import { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';

function HomePage() {
  const [input, setInput] = useState('');
  const { setTopic, isLocalAIAvailable } = useAppStore();

  const handleStartInterview = () => {
    if (input.trim().length >= 5) {
      setTopic(input);
      // TODO: Navigate to interview screen
      console.log('Starting interview for:', input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Header */}
      <div className="p-6 text-center border-b">
        <h1 className="text-2xl font-bold text-primary mb-2">Prompt Architect</h1>
        <p className="text-sm text-muted-foreground">
          Build better prompts, ask better questions
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        {/* AI Status Indicator */}
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${isLocalAIAvailable ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-muted-foreground">
              {isLocalAIAvailable ? 'Local AI Ready' : 'Cloud AI Mode'}
            </span>
          </div>
        </div>

        {/* Input Section */}
        <div className="w-full max-w-md space-y-4">
          <div>
            <label htmlFor="topic-input" className="block text-sm font-medium mb-2">
              What do you want to create?
            </label>
            <textarea
              id="topic-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., Make a fitness app, Write a blog about climate change..."
              className="w-full min-h-[100px] p-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <button
            onClick={handleStartInterview}
            disabled={input.trim().length < 5}
            className="w-full py-3 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start Interview
          </button>
        </div>

        {/* Secondary Actions */}
        <div className="flex gap-4 text-sm">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            View History
          </button>
          <span className="text-muted-foreground">•</span>
          <button
            onClick={() => chrome.runtime.openOptionsPage()}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-xs text-muted-foreground border-t">
        v1.0.0 • Local-First AI
      </div>
    </div>
  );
}

export default HomePage;
