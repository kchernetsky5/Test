import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    anthropic_api_key: str
    access_code: str
    system_prompt: str
    claude_model: str
    max_history_turns: int
    port: int


def load_config() -> Config:
    required = {
        "ANTHROPIC_API_KEY": os.getenv("ANTHROPIC_API_KEY"),
        "ACCESS_CODE": os.getenv("ACCESS_CODE"),
        "SYSTEM_PROMPT": os.getenv("SYSTEM_PROMPT"),
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise EnvironmentError(f"Missing required env vars: {', '.join(missing)}")

    system_prompt = required["SYSTEM_PROMPT"]

    knowledge_dir = os.getenv("KNOWLEDGE_DIR")
    if knowledge_dir:
        knowledge_path = Path(knowledge_dir)
        if knowledge_path.is_dir():
            docs = []
            for f in sorted(knowledge_path.glob("**/*")):
                if f.suffix in (".txt", ".md") and f.is_file():
                    docs.append(f"### {f.name}\n{f.read_text(encoding='utf-8')}")
            if docs:
                system_prompt += "\n\n---\n\n# Reference Documents\n\n" + "\n\n".join(docs)

    return Config(
        anthropic_api_key=required["ANTHROPIC_API_KEY"],
        access_code=required["ACCESS_CODE"],
        system_prompt=system_prompt,
        claude_model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6"),
        max_history_turns=int(os.getenv("MAX_HISTORY_TURNS", "20")),
        port=int(os.getenv("PORT", "8000")),
    )
