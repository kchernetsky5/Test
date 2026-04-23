const MAX_SLACK_LEN = 3900;

const loginScreen = document.getElementById("login-screen");
const chatScreen  = document.getElementById("chat-screen");
const loginForm   = document.getElementById("login-form");
const loginError  = document.getElementById("login-error");
const codeInput   = document.getElementById("access-code-input");
const messages    = document.getElementById("messages");
const input       = document.getElementById("message-input");
const sendBtn     = document.getElementById("send-btn");
const resetBtn    = document.getElementById("reset-btn");

// ── Auth ──────────────────────────────────────────────────
async function checkSession() {
  try {
    const res = await fetch("/reset", { method: "POST" });
    if (res.status === 401) {
      showLogin();
    } else {
      // reset was valid — session exists; restore blank history via a fresh reset is fine
      // actually we don't want to reset on load, just verify. Use a lightweight ping instead.
      showChat();
    }
  } catch {
    showLogin();
  }
}

// Lightweight session check: POST /reset only if we actually need to verify.
// Instead, try /chat with an empty message — but that's wasteful.
// Better: the server sets a cookie; we just try to show chat and let the first
// real request 401 if the cookie expired.
function init() {
  // If no session cookie present, show login. Otherwise show chat.
  const hasSession = document.cookie.includes("session_id=");
  if (hasSession) {
    showChat();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
  codeInput.focus();
}

function showChat() {
  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  input.focus();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const code = codeInput.value.trim();
  if (!code) return;

  const res = await fetch("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (res.ok) {
    showChat();
  } else {
    loginError.classList.remove("hidden");
    codeInput.select();
  }
});

// ── Chat ──────────────────────────────────────────────────
function appendBubble(role, text) {
  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (role === "agent") {
    bubble.innerHTML = marked.parse(text || "");
  } else {
    bubble.textContent = text;
  }

  row.appendChild(bubble);
  messages.appendChild(row);
  scrollToBottom();
  return bubble;
}

function appendThinking() {
  const el = document.createElement("div");
  el.className = "thinking";
  el.textContent = "Thinking…";
  messages.appendChild(el);
  scrollToBottom();
  return el;
}

function scrollToBottom() {
  messages.scrollTop = messages.scrollHeight;
}

function setInputEnabled(enabled) {
  input.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  input.style.height = "auto";
  setInputEnabled(false);

  appendBubble("user", text);
  const thinking = appendThinking();

  let agentBubble = null;
  let accumulated = "";

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (res.status === 401) {
      thinking.remove();
      showLogin();
      setInputEnabled(true);
      return;
    }

    if (!res.ok || !res.body) {
      thinking.remove();
      appendBubble("agent", "Sorry, something went wrong. Please try again.");
      setInputEnabled(true);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);

        if (payload === "[DONE]") break;
        if (payload.startsWith("[ERROR]")) {
          if (agentBubble) {
            agentBubble.innerHTML = marked.parse(payload.slice(8));
          }
          break;
        }

        accumulated += payload;
        if (accumulated.length > MAX_SLACK_LEN) {
          accumulated = accumulated.slice(0, MAX_SLACK_LEN) + "\n\n_(Response truncated)_";
        }

        if (thinking.parentNode) thinking.remove();
        if (!agentBubble) {
          agentBubble = appendBubble("agent", "");
        }
        agentBubble.innerHTML = marked.parse(accumulated);
        scrollToBottom();
      }
    }

    if (thinking.parentNode) {
      thinking.remove();
      appendBubble("agent", "_(No response)_");
    }
  } catch (err) {
    thinking.remove();
    appendBubble("agent", "Connection error. Please check your network and try again.");
  }

  setInputEnabled(true);
  input.focus();
}

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

resetBtn.addEventListener("click", async () => {
  const res = await fetch("/reset", { method: "POST" });
  if (res.status === 401) {
    showLogin();
    return;
  }
  messages.innerHTML = "";
  const notice = document.createElement("div");
  notice.className = "thinking";
  notice.textContent = "Conversation cleared. Start a new question below.";
  messages.appendChild(notice);
  input.focus();
});

// ── Init ──────────────────────────────────────────────────
init();
