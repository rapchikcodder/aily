import { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../lib/utils';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Content */}
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 animate-in fade-in slide-in-from-top duration-500">
            Prompt Architect
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 animate-in fade-in delay-200 duration-500">
            Transform ideas into perfect prompts through AI-powered interviews
          </p>
        </div>

        {/* Main Card */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md p-8 space-y-6 card-clean animate-in zoom-in duration-500 delay-300">
            {/* AI Status Badge */}
            <div className="flex items-center justify-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                isLocalAIAvailable ? 'bg-green-500' : 'bg-amber-500'
              )} />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                {isLocalAIAvailable ? 'Local AI Ready' : 'Cloud AI Mode'}
              </span>
            </div>

            {/* Input Section */}
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                What would you like to create?
              </label>
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g., Write a blog post about AI, Build a todo app..."
                  className="input-clean min-h-[120px] resize-none"
                />
                {/* Character count */}
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {input.length} characters
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={handleStartInterview}
                disabled={input.trim().length < 5}
                className="btn-primary w-full"
              >
                Start Interview
              </button>
            </div>

            {/* Quick Links */}
            <div className="flex items-center justify-center gap-4 text-sm">
              <button className="text-gray-600 dark:text-gray-300 hover:text-blue-500 transition-colors">
                History
              </button>
              <span className="text-gray-300 dark:text-gray-700">•</span>
              <button
                onClick={() => chrome.runtime.openOptionsPage()}
                className="text-gray-600 dark:text-gray-300 hover:text-blue-500 transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
          v1.0.0 • Powered by AI
        </div>
      </div>
    </div>
  );
}

export default HomePage;
