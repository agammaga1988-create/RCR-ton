(() => {
  const tg = window.Telegram?.WebApp;
  const button = document.getElementById("start");
  const status = document.getElementById("status");
  const timer = document.getElementById("timer");
  const state = document.getElementById("session-state");
  const copy = document.getElementById("session-copy");
  const apiBase = window.RCR_CONFIG?.apiBase || "";
  let activeSession = null;
  let ticker = null;
  if (tg) { tg.ready(); tg.expand(); }

  function message(text, kind = "") {
    status.textContent = text;
    status.className = kind;
  }
  function formatRemaining(seconds) {
    const s = Math.max(0, seconds);
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return h + ":" + m + ":" + sec;
  }
  function showSession(session) {
    activeSession = session;
    state.textContent = "SESSION ACTIVE";
    copy.textContent = "Session is recorded. No reward amount is calculated or payable yet; claims remain disabled.";
    button.textContent = "Session active";
    button.disabled = true;
    const tick = () => {
      const remaining = Math.max(0, Number(session.endsAt) - Math.floor(Date.now() / 1000));
      timer.textContent = formatRemaining(remaining);
      if (remaining === 0) {
        state.textContent = "SESSION COMPLETED";
        copy.textContent = "Your session period has ended. Claiming is not enabled yet. You can start another session.";
        button.disabled = false;
        button.textContent = "Start next 24-hour session";
        clearInterval(ticker);
      }
    };
    tick();
    if (ticker) clearInterval(ticker);
    ticker = setInterval(tick, 1000);
  }
  async function start() {
    if (!tg?.initData) {
      message("Open RCR from its Telegram Mini App button. Browser identity is not accepted.", "error");
      return;
    }
    button.disabled = true;
    button.textContent = "Starting securely…";
    try {
      const response = await fetch(apiBase + "/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
        credentials: "omit",
        cache: "no-store"
      });
      const data = await response.json();
      if (response.status === 409) throw new Error("You already have an active session.");
      if (!response.ok) throw new Error(data.error || "Session could not be started.");
      showSession(data.session);
      message("Your session is active. Keep this page open to see the countdown.", "success");
    } catch (error) {
      message(error.message || "Network error. Please try again.", "error");
      button.disabled = false;
      button.textContent = "Start 24-hour session";
    }
  }
  button.addEventListener("click", start);
  async function restoreSession() {
    if (!tg?.initData) {
      button.textContent = "Open inside Telegram";
      message("Telegram authentication data is missing. Open this app inside Telegram.", "error");
      return;
    }
    button.textContent = "Checking your session…";
    button.disabled = true;
    try {
      const response = await fetch(apiBase + "/sessions/current", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
        credentials: "omit",
        cache: "no-store"
      });
      if (response.status === 404) {
        button.textContent = "Start 24-hour session";
        button.disabled = false;
        message("Telegram verified. You can start your 24-hour session.");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not restore your session.");
      showSession(data.session);
      message("Your active session was restored securely.", "success");
    } catch (error) {
      button.textContent = "Retry session check";
      button.disabled = false;
      message(error.message || "Could not reach the session service.", "error");
    }
  }
  restoreSession();
})();
