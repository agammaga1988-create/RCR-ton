const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.RCR_MINIAPP_URL;
const api = token ? "https://api.telegram.org/bot" + token : "";
if (!token || token.length < 20) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!miniAppUrl || !miniAppUrl.startsWith("https://")) throw new Error("RCR_MINIAPP_URL must be a public HTTPS URL");
let offset = 0;
let stopped = false;

async function telegram(method, payload = {}) {
  const response = await fetch(api + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35_000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error("Telegram API " + method + " failed");
  return result.result;
}

async function handle(update) {
  const message = update.message;
  if (!message?.chat?.id || typeof message.text !== "string") return;
  const text = message.text.trim();
  if (text === "/start" || text.startsWith("/start ")) {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: "Welcome to RCR on TON. Open the Mini App to view your 24-hour session and connect your wallet. Rewards, claims and withdrawals are not enabled.",
      reply_markup: {
        inline_keyboard: [[{ text: "Open RCR App", web_app: { url: miniAppUrl } }]],
      },
    });
    return;
  }
  if (text === "/help") {
    await telegram("sendMessage", {
      chat_id: message.chat.id,
      text: "Use /start to open RCR. Never share your wallet recovery phrase or private key. RCR support will never ask for them.",
    });
  }
}

async function poll() {
  while (!stopped) {
    try {
      const updates = await telegram("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        try { await handle(update); } catch { process.stderr.write("RCR bot update handler failed\\n"); }
      }
    } catch {
      process.stderr.write("RCR bot polling request failed; retrying\\n");
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

async function shutdown() {
  stopped = true;
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
await telegram("deleteWebhook", { drop_pending_updates: false });
await telegram("setMyCommands", { commands: [
  { command: "start", description: "Open the RCR Mini App" },
  { command: "help", description: "RCR safety and help" },
] });
process.stdout.write("RCR Telegram bot started\\n");
await poll();
