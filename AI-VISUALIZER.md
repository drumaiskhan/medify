# AI visualizer and AI settings

## Admin
Admin panel → Settings → **AI**. Choose a provider (Anthropic, OpenAI or any OpenAI-compatible
service such as OpenRouter/Groq via Base URL, Google Gemini), enter the model name and paste the API key.
Use **Test connection** after saving. **Remove key** switches the feature off.

- The key is encrypted (AES-256-GCM) in the new `ai_config` table and is never sent to any browser;
  the admin page only shows the last four characters.
- Optional: set `AI_KEY_SECRET` in the backend environment to choose the encryption secret.
  Without it the database URL is used. Changing it later means the key must be pasted again.
- The `ai_config` table is created by `schema.sql` (run `npm run migrate`) and also on first use.

## Students
Study visualizer (`/visualizer`) sends the topic (and optional pasted notes) to `POST /api/ai/visualize`.
The server calls your provider and returns a validated concept map (max 16 nodes). Limits: 12 maps/hour and
40/day per student (admins unlimited). Students never see the key or the provider.

## Student panel
The "Manage membership" button and the Membership quick card were removed from the student dashboard. The sidebar Membership link remains.


Run `cd student && npm ci && npm run build` and `cd admin && npm ci && npm run build` before deploying.
