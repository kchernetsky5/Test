from collections import defaultdict
from threading import Lock
from typing import Generator
import anthropic
from config import Config


class ClaudeClient:
    def __init__(self, config: Config):
        self.client = anthropic.Anthropic(api_key=config.anthropic_api_key)
        self.config = config
        self._histories: dict[str, list[dict]] = defaultdict(list)
        self._lock = Lock()

    def stream_chat(self, session_id: str, user_message: str) -> Generator[str, None, None]:
        with self._lock:
            history = list(self._histories[session_id])
            history.append({"role": "user", "content": user_message})

            max_messages = self.config.max_history_turns * 2
            if len(history) > max_messages:
                history = history[-max_messages:]

        full_reply = []

        with self.client.messages.stream(
            model=self.config.claude_model,
            max_tokens=4096,
            system=self.config.system_prompt,
            messages=history,
        ) as stream:
            for text in stream.text_stream:
                full_reply.append(text)
                yield text

        with self._lock:
            msgs = self._histories[session_id]
            msgs.append({"role": "user", "content": user_message})
            msgs.append({"role": "assistant", "content": "".join(full_reply)})

            max_messages = self.config.max_history_turns * 2
            if len(msgs) > max_messages:
                self._histories[session_id] = msgs[-max_messages:]

    def reset_history(self, session_id: str) -> None:
        with self._lock:
            self._histories.pop(session_id, None)
