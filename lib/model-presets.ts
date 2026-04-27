export const HOST_PRESETS = [
  {
    label: "Hosted providers",
    options: [
      { value: "https://openrouter.ai/api/v1", label: "OpenRouter (recommended) - https://openrouter.ai/api/v1" },
      { value: "https://api.openai.com/v1", label: "OpenAI - https://api.openai.com/v1" },
      { value: "https://api.together.xyz/v1", label: "Together AI - https://api.together.xyz/v1" },
      { value: "https://api.groq.com/openai/v1", label: "Groq - https://api.groq.com/openai/v1" },
      { value: "https://api.fireworks.ai/inference/v1", label: "Fireworks AI - https://api.fireworks.ai/inference/v1" },
      { value: "https://api.deepinfra.com/v1/openai", label: "DeepInfra - https://api.deepinfra.com/v1/openai" },
      { value: "https://api.x.ai/v1", label: "xAI - https://api.x.ai/v1" },
      { value: "https://api.deepseek.com/v1", label: "DeepSeek - https://api.deepseek.com/v1" },
      { value: "https://generativelanguage.googleapis.com/v1beta/openai", label: "Google AI Studio - generativelanguage.googleapis.com/v1beta/openai" },
    ],
  },
  {
    label: "Local",
    options: [
      { value: "http://localhost:11434/v1", label: "Ollama - http://localhost:11434/v1" },
      { value: "http://localhost:1234/v1", label: "LM Studio - http://localhost:1234/v1" },
      { value: "http://localhost:8080/v1", label: "llama.cpp / vLLM - http://localhost:8080/v1" },
    ],
  },
];

export const MODEL_PRESETS = [
  {
    label: "OpenRouter (set base URL to https://openrouter.ai/api/v1)",
    options: [
      { value: "openai/gpt-5.4-image-2", label: "openai/gpt-5.4-image-2 (recommended)" },
      { value: "openai/gpt-5-image", label: "openai/gpt-5-image" },
      { value: "openai/gpt-5-image-mini", label: "openai/gpt-5-image-mini" },
      { value: "openai/gpt-image-2", label: "openai/gpt-image-2" },
      { value: "openai/gpt-image-1", label: "openai/gpt-image-1" },
      { value: "google/gemini-3-pro-image-preview", label: "google/gemini-3-pro-image-preview (Nano Banana Pro)" },
      { value: "google/gemini-3.1-flash-image-preview", label: "google/gemini-3.1-flash-image-preview (Nano Banana 2)" },
      { value: "google/gemini-2.5-flash-image", label: "google/gemini-2.5-flash-image (Nano Banana)" },
      { value: "google/gemini-2.5-flash-image-preview", label: "google/gemini-2.5-flash-image-preview (legacy)" },
      { value: "black-forest-labs/flux-1.1-pro", label: "black-forest-labs/flux-1.1-pro (legacy)" },
    ],
  },
  {
    label: "OpenAI (default base URL)",
    options: [
      { value: "gpt-image-2", label: "gpt-image-2 (default)" },
      { value: "gpt-image-1.5", label: "gpt-image-1.5" },
      { value: "gpt-5-image", label: "gpt-5-image" },
      { value: "gpt-5-image-mini", label: "gpt-5-image-mini" },
      { value: "gpt-image-1", label: "gpt-image-1" },
      { value: "gpt-image-1-mini", label: "gpt-image-1-mini" },
    ],
  },
];
