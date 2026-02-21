import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { cn } from '../lib/utils';
import { toast, ToastContainer } from '../components/ui/Toast';

function OptionsPage() {
  const { apiKeys, setAPIKey, isLocalAIAvailable, localAIStatus, loadFromStorage, checkLocalAI, v3Enabled, setV3Enabled } = useAppStore();
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showGrokKey, setShowGrokKey] = useState(false);
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
    setGrokKey(apiKeys.grok || '');
  }, [apiKeys]);

  const handleSaveOpenAI = () => {
    if (openaiKey.trim()) {
      setAPIKey('openai', openaiKey.trim());
      toast.success('OpenAI API key saved!');
    }
  };

  const handleSaveAnthropic = () => {
    if (anthropicKey.trim()) {
      setAPIKey('anthropic', anthropicKey.trim());
      toast.success('Anthropic API key saved!');
    }
  };

  const handleSaveGemini = () => {
    if (geminiKey.trim()) {
      setAPIKey('gemini', geminiKey.trim());
      toast.success('Gemini API key saved!');
    }
  };

  const handleSaveGrok = () => {
    if (grokKey.trim()) {
      setAPIKey('grok', grokKey.trim());
      toast.success('Grok API key saved!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-4xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Configure your AI providers and customize your experience
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* AI Provider Settings */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              AI Provider Settings
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Choose between local AI (free) or cloud AI (requires API key)
            </p>
          </div>

          {/* Local AI Status */}
          <div className="p-6 space-y-3 card-clean">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-3 h-3 rounded-full transition-all duration-300',
                  localAIStatus === 'ready' && 'bg-green-500',
                  localAIStatus === 'downloading' && 'bg-blue-400 animate-pulse',
                  (localAIStatus === 'unavailable' || localAIStatus === 'unknown') && 'bg-gray-400'
                )} />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Chrome Built-in AI (Gemini Nano)
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
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
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
              >
                {checkingAI ? 'Checking…' : 'Refresh Status'}
              </button>
            </div>

            {(localAIStatus === 'unavailable' || localAIStatus === 'unknown') && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  How to enable free AI (Chrome 127+):
                </p>
                <ol className="list-decimal list-inside text-amber-800 dark:text-amber-300 space-y-1">
                  <li>
                    Open{' '}
                    <button
                      onClick={() => chrome.tabs.create({ url: 'chrome://flags/#optimization-guide-on-device-model' })}
                      className="underline font-semibold hover:text-amber-950 dark:hover:text-amber-100"
                    >
                      chrome://flags/#optimization-guide-on-device-model
                    </button>
                    {' '}→ set to <strong>Enabled BypassPerfRequirement</strong>
                  </li>
                  <li>
                    Open{' '}
                    <button
                      onClick={() => chrome.tabs.create({ url: 'chrome://flags/#prompt-api-for-gemini-nano' })}
                      className="underline font-semibold hover:text-amber-950 dark:hover:text-amber-100"
                    >
                      chrome://flags/#prompt-api-for-gemini-nano
                    </button>
                    {' '}→ set to <strong>Enabled</strong>
                  </li>
                  <li>Relaunch Chrome completely (close all windows, reopen)</li>
                  <li>Come back here and click <strong>Refresh Status</strong> — it will start the download</li>
                </ol>
                <p className="text-amber-700 dark:text-amber-400 text-xs">
                  Until then, add an OpenAI or Anthropic key below to use cloud AI.
                </p>
              </div>
            )}

            {localAIStatus === 'downloading' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>Chrome is downloading Gemini Nano in the background (usually 2–5 min).</p>
                <p>
                  To see real-time download progress, open{' '}
                  <button
                    onClick={() => chrome.tabs.create({ url: 'chrome://components/' })}
                    className="underline font-semibold hover:text-blue-950 dark:hover:text-blue-100"
                  >
                    chrome://components/
                  </button>
                  {' '}and look for <strong>"Optimization Guide On Device Model"</strong>.
                </p>
              </div>
            )}
          </div>

          {/* BYOK Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Bring Your Own Key (BYOK)
            </h3>

            {/* OpenAI */}
            <div className="p-6 space-y-3 card-clean">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">OpenAI API</h4>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  GPT-4 Turbo
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="input-clean flex-1"
                  />
                  <button
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-all duration-200"
                  >
                    {showOpenaiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  onClick={handleSaveOpenAI}
                  className="btn-primary w-full"
                >
                  Save Key
                </button>
              </div>
            </div>

            {/* Anthropic */}
            <div className="p-6 space-y-3 card-clean">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Anthropic API</h4>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  Claude 3.5 Sonnet
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type={showAnthropicKey ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="input-clean flex-1"
                  />
                  <button
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-all duration-200"
                  >
                    {showAnthropicKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  onClick={handleSaveAnthropic}
                  className="btn-primary w-full"
                >
                  Save Key
                </button>
              </div>
            </div>

            {/* Google Gemini */}
            <div className="p-6 space-y-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700 rounded-lg shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  Google Gemini API
                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">FREE</span>
                </h4>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Gemini 2.5 Flash
                </span>
              </div>
              <div className="text-xs text-green-800 dark:text-green-200 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                <strong>Free tier:</strong> Generous quotas, no credit card required. Get your key at{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold hover:text-green-950 dark:hover:text-green-100"
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
                    className="input-clean flex-1 focus:border-green-500 focus:ring-green-500/20"
                  />
                  <button
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-green-500 transition-all duration-200"
                  >
                    {showGeminiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  onClick={handleSaveGemini}
                  className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Save Key
                </button>
              </div>
            </div>

            {/* Grok (xAI) */}
            <div className="p-6 space-y-3 card-clean">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Grok API (xAI)</h4>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  Grok Beta
                </span>
              </div>
              <div className="text-xs text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <strong>xAI's Grok:</strong> Advanced AI from Elon Musk's team. Get your key at{' '}
                <a
                  href="https://console.x.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold hover:text-blue-950 dark:hover:text-blue-100"
                >
                  console.x.ai
                </a>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type={showGrokKey ? 'text' : 'password'}
                    value={grokKey}
                    onChange={(e) => setGrokKey(e.target.value)}
                    placeholder="xai-..."
                    className="input-clean flex-1"
                  />
                  <button
                    onClick={() => setShowGrokKey(!showGrokKey)}
                    className="px-4 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-all duration-200"
                  >
                    {showGrokKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  onClick={handleSaveGrok}
                  className="btn-primary w-full"
                >
                  Save Key
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              Keys are stored locally on your device. We never see or transmit them.
            </p>
          </div>
        </section>

        {/* V3 Architecture Settings */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Interview Mode
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Choose between V2 (adaptive one-at-a-time) or V3 (tabbed, faster)
            </p>
          </div>

          <div className="p-6 space-y-4 card-clean">
            <label className="flex items-start gap-4 cursor-pointer group">
              <input
                type="checkbox"
                checked={v3Enabled}
                onChange={(e) => {
                  setV3Enabled(e.target.checked);
                  toast.success(e.target.checked ? 'V3 mode enabled!' : 'V2 mode enabled!');
                }}
                className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Use V3 Architecture (Recommended)
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  2 API calls, tabbed UI, works with any provider (Gemini, OpenAI, Claude, Grok)
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded px-2 py-1 text-green-700 dark:text-green-300">
                    ✓ ~70% cost reduction
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded px-2 py-1 text-green-700 dark:text-green-300">
                    ✓ ~50% faster
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded px-2 py-1 text-green-700 dark:text-green-300">
                    ✓ All questions at once
                  </div>
                </div>
              </div>
            </label>

            {v3Enabled && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>ⓘ V3 Mode:</strong> Uses your selected AI provider for both question generation and mega-prompt compilation
                </p>
              </div>
            )}

            {!v3Enabled && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>V2 Mode:</strong> Uses adaptive one-at-a-time questioning (4-6 API calls)
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Custom Variables Section (Placeholder) */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Custom Injection Rules
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Create custom variable injections (Coming soon)
            </p>
          </div>
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 card-clean">
            <p className="font-medium">Feature under development</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default OptionsPage;
