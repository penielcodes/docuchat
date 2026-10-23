import axios, { AxiosInstance } from 'axios';

export const openaiClient: AxiosInstance = axios.create({
  baseURL: 'https://api.openai.com/v1',
  timeout: 30000,
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY || 'placeholder'}`,
    'Content-Type': 'application/json',
    'User-Agent': 'DocuChat/1.0',
  },
});

// Logs timing on every outgoing call
openaiClient.interceptors.request.use((cfg) => {
  (cfg as any).metadata = { startTime: Date.now() };
  console.log(`→ OpenAI ${cfg.method?.toUpperCase()} ${cfg.url}`);
  return cfg;
});

// Distinguishes 3 different failure shapes — each needs a different fix
openaiClient.interceptors.response.use(
  (response) => {
    const ms = Date.now() - ((response.config as any).metadata?.startTime ?? Date.now());
    console.log(`← OpenAI ${response.status} ${response.config.url} (${ms}ms)`);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`✕ OpenAI ${error.response.status} ${error.config?.url}:`, error.response.data);
    } else if (error.request) {
      console.error(`✕ OpenAI no response ${error.config?.url}:`, error.message);
    } else {
      console.error('✕ OpenAI request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);