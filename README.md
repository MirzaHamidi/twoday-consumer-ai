# Twoday Studio Website

A clean, fast, responsive one-page website for Twoday Studio, built with plain HTML, CSS and minimal JavaScript.

## Files

- `index.html` - main one-page studio site
- `games.html` - game library page
- `dice-clicker-idle.html` - Dice Clicker Idle detail page
- `ninjump.html` - NinJump detail page
- `privacy.html` - placeholder privacy policy
- `styles.css` - shared dark theme and responsive layout
- `script.js` - mobile navigation, sticky header state, footer year and mailto form handling
- `assets/` - local artwork, optimized WebP art and press kit placeholder

## Local Preview

Open `index.html` directly in a browser, or run a tiny local server:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deploy to GitHub Pages

1. Push these files to a GitHub repository.
2. Open the repository settings.
3. Go to **Pages**.
4. Choose the branch that contains the site, usually `main`.
5. Select the root folder and save.

## Deploy to Netlify

1. Create a new Netlify site from the repository.
2. Leave the build command empty.
3. Set the publish directory to the project root.
4. Deploy.

## Deploy to Vercel

1. Import the repository into Vercel.
2. Keep the framework preset as **Other**.
3. Leave the build command empty.
4. Set the output directory to the project root.
5. Deploy.

## Customize

- Replace `assets/twoday-game-art.webp` with final optimized game art or screenshots.
- Replace `assets/dice-clicker-idle-icon.webp` and `assets/ninjump-icon.webp` with final app icons.
- Replace `assets/press-kit-placeholder.txt` with a real press kit zip or PDF.
- Update the social links in `index.html` once profiles are live.
- Business and support forms currently use `mailto:` links so the site can stay static on GitHub Pages.
- The consumer AI must use a server-side proxy or worker; never expose an OpenRouter key in browser JavaScript.
- `Dockerfile.consumer-ai` and `bunny.consumer-ai.jsonc` provide the Bunny Magic Container version. The container serves the static site and `/api/ai/chat` from the same origin, so the website works without a separate API URL.
- For real server-side submissions or a ticket inbox, connect a form service such as Netlify Forms or Formspree later.
- Review `privacy.html` before publishing any game or feature that collects player data.
