import uuid
from typing import Annotated

from fastapi import Cookie, FastAPI, HTTPException, Request, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from claude_client import ClaudeClient
from config import load_config

config = load_config()
claude = ClaudeClient(config)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

_valid_sessions: set[str] = set()

SESSION_COOKIE = "session_id"


class AuthRequest(BaseModel):
    code: str


class ChatRequest(BaseModel):
    message: str


def _require_session(session_id: str | None) -> str:
    if not session_id or session_id not in _valid_sessions:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session_id


@app.get("/", response_class=HTMLResponse)
async def index(session_id: Annotated[str | None, Cookie()] = None):
    with open("static/index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/auth")
async def auth(body: AuthRequest, response: Response):
    if body.code != config.access_code:
        raise HTTPException(status_code=401, detail="Invalid access code")
    session_id = str(uuid.uuid4())
    _valid_sessions.add(session_id)
    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )
    return {"ok": True}


@app.post("/chat")
async def chat(
    body: ChatRequest,
    session_id: Annotated[str | None, Cookie()] = None,
):
    sid = _require_session(session_id)

    def generate():
        try:
            for chunk in claude.stream_chat(sid, body.message):
                yield f"data: {chunk}\n\n"
        except Exception as e:
            yield f"data: [ERROR] Sorry, something went wrong. Please try again.\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/reset")
async def reset(session_id: Annotated[str | None, Cookie()] = None):
    sid = _require_session(session_id)
    claude.reset_history(sid)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=config.port, reload=False)
