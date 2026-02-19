import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';

function OptionsPage() {
  const { apiKeys, setAPIKey, isLocalAIAvailable, localAIStatus, loadFromStorage, checkLocalAI } = useAppStore();
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [checkingAI, setCheckingAI] = useState(false);

  useEffect(() => {
    loadFromStorage();
    // Check actual window.ai status on every open — store starts as false
    checkLocalAI().catch(() => { /* not available */ });
  }, [loadFromStorage, checkLocalAI]);

  const handleCheckAI = async () => {
    setCheckingAI(true);
    await checkLocalAI();
    setCheckingAI(false);
  };

  useEffect(() => {
    setOpenaiKey(apiKeys.openai || '');
    setAnthropicKey(apiKeys.anthropic || '');
    setGeminiKey(apiKeys.gemini || '');
  }, [apiKeys]);

  const handleSaveOpenAI = () => {
    if (openaiKey.trim()) {
      setAPIKey('openai', openaiKey.trim());
      alert('OpenAI API key saved!');
    }
  };

  const handleSaveAnthropic = () => {
    if (anthropicKey.trim()) {
      setAPIKey('anthropic', anthropicKey.trim());
      alert('Anthropic API key saved!');
    }
  };

  const handleSaveGemini = () => {
    if (geminiKey.trim()) {
      setAPIKey('gemini', geminiKey.trim());
      alert('Gemini API key saved!');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure your AI providers and customize your experience
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* AI Provider Settings */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">AI Provider Settings</h2>
            <p className="text-sm text-muted-foreground">
              Choose between local AI (free) or cloud AI (requires API key)
            </p>
          </div>

          {/* Local AI Status */}
          <div className="p-4 border rounded-lg bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  localAIStatus === 'ready' ? 'bg-green-500' :
                  localAIStatus === 'downloading' ? 'bg-blue-400 animate-pulse' :
                  'bg-gray-400'
                }`} />
                <div>
                  <h3 className="font-medium">Chrome Built-in AI (Gemini Nano)</h3>
                  <p className="text-sm text-muted-foreground">
                    {localAIStatus === 'ready' && 'Ready — completely free!'}
                    {localAIStatus === 'downloading' && 'Downloading model… check back in a few minutes'}
                    {localAIStatus === 'unavailable' && 'Not enabled — follow the steps below'}
                    {localAIStatus === 'unknown' && 'Checking…'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCheckAI}
                disabled={checkingAI}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {checkingAI ? 'Checking…' : 'Refresh Status'}
              </button>
            </div>

            {(localAIStatus === 'unavailable' || localAIStatus === 'unknown') && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2 text-sm">
                <p className="font-medium text-amber-800">How to enable free AI (Chrome 127+):</p>
                <ol className="list-decimal list-inside text-amber-700 space-y-1">
                  <li>
                    Open{' '}
                    <button
                      onClick={() => chrome.tabs.create({ url: 'chrome://flags/#optimization-guide-on-device-model' })}
                      className="underline font-medium hover:text-amber-900"
                    >
                      chrome://flags/#optimization-guide-on-device-model
                    </button>
                    {' '}→ set to <strong>Enabled BypassPerfRequirement</strong>
                  </li>
                  <li>
                    Open{' '}
                    <button
                      onClick={() => chrome.tabs.create({ url: 'chrome://flags/#prompt-api-for-gemini-nano' })}
                      className="underline font-medium hover:text-amber-900"
                    >
                      chrome://flags/#prompt-api-for-gemini-nano
                    </button>
                    {' '}→ set to <strong>Enabled</strong>
                  </li>
                  <li>Relaunch Chrome completely (close all windows, reopen)</li>
                  <li>Come back here and click <strong>Refresh Status</strong> — it will start the download</li>
                </ol>
                <p className="text-amber-600 text-xs">
                  Until then, add an OpenAI or Anthropic key below to use cloud AI.
                </p>
              </div>
            )}

            {localAIStatus === 'downloading' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700 space-y-2">
                <p>Chrome is downloading Gemini Nano in the background (usually 2–5 min).</p>
                <p>
                  To see real-time download progress, open{' '}
                  <button
                    onClick={() => chrome.tabs.create({ url: 'chrome://components/' })}
                    className="underline font-medium hover:text-blue-900"
                  >
                    chrome://components/
                  </button>
                  {' '}and look for <strong>"Optimization Guide On Device Model"</strong>.
                  Click <em>Check for update</em> there to force-start the download, then click{' '}
                  <strong>Refresh Status</strong> here once the version number appears.
                </p>
              </div>
            )}

            {/* Always-visible helper for unavailable state */}
            {localAIStatus === 'unavailable' && (
              <p className="text-xs text-muted-foreground">
                Already set the flags?{' '}
                <strong>Close all Chrome windows completely and reopen</strong> — the flags only take effect after a full relaunch.
                Then come back here and click <strong>Refresh Status</strong>.
              </p>
            )}
          </div>

          {/* BYOK Section */}
          <div className="space-y-4">
            <h3 className="font-medium">Bring Your Own Key (BYOK)</h3>

            {/* OpenAI */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">OpenAI API</h4>
                <span className="text-xs text-muted-foreground">GPT-4, GPT-4-Turbo</span>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="flex-1 px-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="px-3 py-2 border rounded-md hover:bg-accent transition-colors"
                  >
                    {showOpenaiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  onClick={handleSaveOpenAI}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Save Key
                </button>
              </div>
            </div>

            {/* Anthropic */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Anthropic API</h4>
                <span className="text-xs text-muted-foreground">Claude 3.5 Sonnet</span>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type={showAnthropicKey ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="flex-1 px-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="px-3 py-2 border rounded-md hover:bg-accent transition-colors"
                  >
                    {showAnthropicKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  onClick={handleSaveAnthropic}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Save Key
                </button>
              </div>
            </div>

            {/* Google Gemini */}
            <div className="p-4 border rounded-lg space-y-3 bg-green-50/50 border-green-200">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  Google Gemini API
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">FREE</span>
                </h4>
                <span className="text-xs text-muted-foreground">Gemini 2.5 Flash</span>
              </div>
              <div className="text-xs text-green-700 bg-green-100 border border-green-200 rounded-md p-2">
                ✨ <strong>Free tier:</strong> Generous quotas, no credit card required. Get your key at{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium hover:text-green-900"
                >
                  aistudio.google.com/app/apikey
                </a>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    className="flex-1 px-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="px-3 py-2 border rounded-md hover:bg-accent transition-colors"
                  >
                    {showGeminiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  onClick={handleSaveGemini}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Save Key
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              ⚠️ Keys are stored locally on your device. We never see or transmit them.
            </p>
          </div>
        </section>

        {/* Custom Variables Section (Placeholder) */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Custom Injection Rules</h2>
            <p className="text-sm text-muted-foreground">
              Create custom variable injections (Coming soon)
            </p>
          </div>
          <div className="p-8 border rounded-lg border-dashed text-center text-muted-foreground">
            Feature under development
          </div>
        </section>
      </div>
    </div>
  );
}

export default OptionsPage;
