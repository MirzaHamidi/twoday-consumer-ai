# Twoday consumer AI worker

This worker keeps the OpenRouter key server-side and exposes only `POST /api/ai/chat` to the website. Set the secret before a manual deployment:

```powershell
wrangler secret put OPENROUTER_API_KEY
wrangler deploy
```

The website expects the worker to be available at `/api/ai/chat`. If it is deployed on a separate hostname, set `window.TWODAY_AI_ENDPOINT` before `consumer-ai.js` loads. The worker accepts `en`, `tr`, `ar`, and `zh`, keeps only the last twelve turns supplied by the browser, and uses OpenRouter's free model router. Web search is opt-in from the panel and may have a separate provider charge even when model inference is free.

For Bunny Magic Containers, use the repository-root `Dockerfile.consumer-ai` instead. It serves both the static website and this API from one origin; configure `OPENROUTER_API_KEY` as a container secret and use `bunny.consumer-ai.jsonc` as the deployment template.
