export const samplePreviewHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Codex Preview</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: 'Inter', system-ui, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at top, rgba(108, 92, 231, 0.45), rgba(15, 23, 42, 1));
        color: #e2e8f0;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 3rem;
        box-sizing: border-box;
      }
      .panel {
        width: min(760px, 100%);
        background: rgba(15, 23, 42, 0.75);
        border-radius: 24px;
        padding: 3rem;
        box-shadow: 0 25px 60px -25px rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(148, 163, 184, 0.18);
      }
      h1 {
        font-size: clamp(2.5rem, 3vw + 1rem, 3.75rem);
        margin-bottom: 1rem;
        letter-spacing: -0.04em;
      }
      p {
        max-width: 52ch;
        font-size: 1.05rem;
        line-height: 1.6;
        margin-bottom: 2rem;
        color: rgba(226, 232, 240, 0.82);
      }
      .cta {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 600;
        font-size: 1rem;
        border-radius: 999px;
        padding: 0.85rem 1.8rem;
        background: linear-gradient(135deg, #6C5CE7, #8e9bff);
        color: white;
        text-decoration: none;
        box-shadow: 0 20px 35px -25px rgba(108, 92, 231, 0.85);
        transition: transform 160ms ease, box-shadow 160ms ease;
      }
      .cta:hover {
        transform: translateY(-2px);
        box-shadow: 0 28px 40px -25px rgba(108, 92, 231, 0.9);
      }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 1.25rem;
        margin-top: 2.5rem;
      }
      .meta-card {
        background: rgba(15, 23, 42, 0.65);
        padding: 1rem;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.12);
      }
      .meta-card span {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: rgba(148, 163, 184, 0.85);
        margin-bottom: 0.35rem;
      }
      .meta-card strong {
        font-size: 1.1rem;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <span style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.85rem;letter-spacing:0.25em;text-transform:uppercase;color:rgba(148,163,184,0.8);margin-bottom:1rem;">Codex Studio</span>
      <h1 id="hero-heading">Ship UI updates without leaving the browser.</h1>
      <p>
        Pick any element on the page, describe the change, and watch Codex apply atomic patches in real time.
        Approve, batch, and commit in one streamlined workspace tailored for modern frontend teams.
      </p>
      <a class="cta" href="#">Start a Live Editing Session</a>
      <section class="meta" aria-label="Highlights">
        <div class="meta-card">
          <span>Latency</span>
          <strong>&lt; 3s feedback</strong>
        </div>
        <div class="meta-card">
          <span>Sandbox</span>
          <strong>Shadow workspace</strong>
        </div>
        <div class="meta-card">
          <span>Integrations</span>
          <strong>GitHub &amp; LLM</strong>
        </div>
      </section>
    </main>
  </body>
</html>`;
