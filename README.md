# Real Estate Assistant — Web Chat

A self-hosted web chat that gives your real estate agents access to a Claude-powered assistant. Agents visit a URL and enter an access code — no Claude account required.

## Quick Start

```bash
# 1. Install dependencies
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
# Edit .env — fill in your API key, access code, and system prompt

# 3. Run
python app.py
# Visit http://localhost:8000
```

## Configuration (.env)

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | From [console.anthropic.com](https://console.anthropic.com) |
| `ACCESS_CODE` | Yes | The password agents enter to log in |
| `SYSTEM_PROMPT` | Yes | Your Claude project instructions |
| `KNOWLEDGE_DIR` | No | Path to folder of `.txt`/`.md` knowledge files |
| `CLAUDE_MODEL` | No | Default: `claude-sonnet-4-6` |
| `MAX_HISTORY_TURNS` | No | Default: `20` (turns per agent session) |
| `PORT` | No | Default: `8000` |

## Adding Your Claude Project Files

Your claude.ai project files need to be added as plain text so the API can read them:

1. Open each uploaded file in your Claude project
2. Copy the text content
3. Save it as a `.txt` or `.md` file in the `knowledge/` folder
4. Add `KNOWLEDGE_DIR=./knowledge` to your `.env`

The server loads all files at startup and appends them to the system prompt automatically.

## Sharing with Agents

Give agents:
- **The URL** where the app is running (see Deployment below)
- **The access code** from your `.env`

They open the URL in any browser, enter the code, and start chatting. No account or install needed.

## Deployment

The app runs on any server that can run Python. Free-tier options:

**[Railway](https://railway.app)** (recommended)
1. Connect your GitHub repo
2. Set environment variables in the Railway dashboard
3. Railway auto-detects and runs `python app.py`

**[Render](https://render.com)**
1. New Web Service → connect repo
2. Start command: `python app.py`
3. Add env vars in the Render dashboard

**[Fly.io](https://fly.io)**
```bash
fly launch
fly secrets set ANTHROPIC_API_KEY=... ACCESS_CODE=... SYSTEM_PROMPT="..."
fly deploy
```

**Local with public URL (for testing)**
```bash
# Using ngrok
ngrok http 8000
# Share the https://... URL with agents
```

## How It Works

- Each agent browser session gets its own conversation history on the server
- History resets when the agent clicks "New conversation" or closes their browser
- The system prompt (your project instructions + knowledge files) is sent with every message
- Responses stream word-by-word like claude.ai
