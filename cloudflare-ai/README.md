# Twoday consumer AI worker

This worker is a legacy alternative. The Bunny deployment uses the repository-root server and the OpenAI-compatible local AI endpoint described below.

```powershell
wrangler secret put OPENROUTER_API_KEY
wrangler deploy
```

The website expects the worker to be available at `/api/ai/chat`. If it is deployed on a separate hostname, set `window.TWODAY_AI_ENDPOINT` before `consumer-ai.js` loads. The Bunny server accepts `en`, `tr`, `ar`, and `zh`, and forwards requests to the configured OpenAI-compatible local API.

For Bunny Magic Containers, use the repository-root `Dockerfile.consumer-ai` instead. It serves both the static website and this API from one origin; configure `LOCAL_AI_BASE_URL`, `LOCAL_AI_API_KEY`, and `LOCAL_AI_MODEL` as container values and use `bunny.consumer-ai.jsonc` as the deployment template.
