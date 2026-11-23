const rawToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
const token = rawToken.trim().replace(/^https:\/\/api\.telegram\.org\/bot/i, "").replace(/^bot(?=\d+:)/i, "").trim();
const miniAppUrl = (process.env.RCR_MINIAPP_URL ?? "").trim();
const api = token ? "https://api.telegram.org/bot" + token : "";
const requestTimeoutMs = 35_000;

if (!/^\d{5,}:\w{20,}$/.test(token)) throw new Error("TELEGRAM_BOT_TOKEN is missing or has an invalid format");
if (!/^https:\/\//i.test(miniAppUrl)) throw new Error("RCR_MINIAPP_URL must be a public HTTPS URL");

let offset = 0;
let stopping = false;

async function telegram(method, payload = {}) {
  const response = await fetch(api + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error("Telegram API " + method + " returned HTTP " + response.status); }
  if (!response.ok || !result?.ok) {
    const error = new Error("Telegram API " + method + " failed (" + (result?.error_code ?? response.status) + "): " + (result?.description ?? response.statusText));
    error.retryAfter = result?.parameters?.retry_after;
    throw error;
  }
  return result.result;
}

const mainKeyboard = () => ({
  inline_keyboard: [
    [{ text: "🚀 Open RCR App", web_app: { url: miniAppUrl } }],
    [{ text: "⛏️ How earning works", callback_data: "guide" }, { text: "📊 Project status", callback_data: "status" }],
    [{ text: "🛡️ Safety & rules", callback_data: "rules" }, { text: "💼 Wallet", callback_data: "wallet" }],
  ],
});

const welcomeText = (firstName = "there") =>
  "Welcome " + firstName + " to RCR on TON.\n\n" +
  "RCR is a Telegram-first rewards platform built around transparent 24-hour sessions. " +
  "Open the Mini App to view the dashboard and connect a TON wallet.\n\n" +
  "⚠️ Testnet stage: token claims and withdrawals are not enabled. Never share your seed phrase or private key.";

async function sendMessage(chatId, text, extra = {}) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    ...extra,
    disable_web_page_preview: true,
  });
}

async function showStatus(chatId) {
  let appState = "unreachable";
  try {
    const response = await fetch(new URL("/health", miniAppUrl), { signal: AbortSignal.timeout(8000) });
    if (response.ok) appState = "online";
  } catch {}
  const statusText = appState === "online"
    ? "🟢 RCR Mini App: online\n🟡 Network: testnet setup\n🔒 Claims and withdrawals: disabled"
    : "🔴 RCR Mini App: currently unreachable\n🔒 Claims and withdrawals: disabled";
  return sendMessage(chatId, statusText, { reply_markup: mainKeyboard() });
}

async function handleCommand(message, command, args) {
  const chatId = message.chat.id;
  const firstName = message.from?.first_name || "there";
  switch (command) {
    case "start":
    case "menu":
      return sendMessage(chatId, welcomeText(firstName), { reply_markup: mainKeyboard() });
    case "app":
    case "earn":
      return sendMessage(chatId, "Open your RCR dashboard to view your session and account. Session timing is controlled by the server.", {
        reply_markup: { inline_keyboard: [[{ text: "🚀 Launch RCR Mini App", web_app: { url: miniAppUrl } }]] },
      });
    case "status":
      return showStatus(chatId);
    case "wallet":
      return sendMessage(chatId, "🔐 Connect your TON wallet securely inside the RCR Mini App using TON Connect. RCR never asks for recovery phrases or private keys.", {
        reply_markup: { inline_keyboard: [[{ text: "Connect wallet in RCR", web_app: { url: miniAppUrl } }]] },
      });
    case "guide":
      return sendMessage(chatId,
        "⛏️ RCR earning flow\n\n" +
        "1. Open the Mini App from this bot.\n" +
        "2. Verify your Telegram account and review the dashboard.\n" +
        "3. Start a 24-hour session when the app marks you eligible.\n" +
        "4. Return to the app to see the server-authoritative session status.\n\n" +
        "A running timer is not a token balance or a promise of payment. Reward calculation and claims remain disabled pending review.",
        { reply_markup: mainKeyboard() });
    case "rules":
      return sendMessage(chatId,
        "🛡️ RCR safety rules\n\n" +
        "• Never share your seed phrase, private key, or wallet backup.\n" +
        "• Only connect through the official RCR Mini App opened from this bot.\n" +
        "• Check every wallet transaction before approving it.\n" +
        "• Ignore anyone promising guaranteed rewards or asking for a deposit.\n" +
        "• Claims and withdrawals are currently disabled during testnet development.",
        { reply_markup: mainKeyboard() });
    case "help":
      return sendMessage(chatId,
        "RCR Bot commands\n/start — Open the main menu\n/app — Launch the Mini App\n/earn — View the earning guide\n/status — Check app availability\n/wallet — Wallet connection guidance\n/rules — Safety rules\n/help — Show this help",
        { reply_markup: mainKeyboard() });
    default:
      return sendMessage(chatId, "I didn't recognize that command. Use /menu to see the RCR options.", { reply_markup: mainKeyboard() });
  }
}

async function handleCallback(query) {
  const chatId = query.message?.chat?.id;
  await telegram("answerCallbackQuery", { callback_query_id: query.id });
  if (!chatId) return;
  switch (query.data) {
    case "guide": return handleCommand(query.message, "guide", "");
    case "status": return showStatus(chatId);
    case "wallet": return handleCommand(query.message, "wallet", "");
    case "rules": return handleCommand(query.message, "rules", "");
    default: return;
  }
}

async function handleUpdate(update) {
  if (update.callback_query) return handleCallback(update.callback_query);
  const message = update.message;
  if (!message?.chat?.id || typeof message.text !== "string") return;
  const match = message.text.trim().match(/^\/([a-z0-9_]+)(?:@\w+)?(?:\s+(.*))?$/i);
  if (!match) {
    return sendMessage(message.chat.id, "Use /menu to open RCR features.", { reply_markup: mainKeyboard() });
  }
  return handleCommand(message, match[1].toLowerCase(), match[2] ?? "");
}

async function poll() {
  while (!stopping) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"],
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        try { await handleUpdate(update); }
        catch (error) {
          process.stderr.write("RCR update handler error: " + String(error?.message ?? "unknown").slice(0, 240) + "\n");
        }
      }
    } catch (error) {
      process.stderr.write("RCR polling error: " + String(error?.message ?? "unknown").slice(0, 240) + "\n");
      if (error?.retryAfter) await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
      else await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

const bot = await telegram("getMe");
process.stdout.write("Authenticated Telegram bot @" + bot.username + "\n");
await telegram("deleteWebhook", { drop_pending_updates: false });
await telegram("setMyCommands", { commands: [
  { command: "start", description: "Open the RCR main menu" },
  { command: "app", description: "Launch the RCR Mini App" },
  { command: "earn", description: "Learn how 24-hour sessions work" },
  { command: "status", description: "Check RCR app availability" },
  { command: "wallet", description: "TON wallet connection help" },
  { command: "rules", description: "Security rules and warnings" },
  { command: "help", description: "Show all bot commands" },
] });
await telegram("setMyDescription", {
  description: "Official RCR on TON assistant. Launch the Mini App, check project availability, learn about 24-hour sessions, and get wallet safety guidance. Testnet stage; claims and withdrawals are disabled.",
});
await telegram("setMyShortDescription", {
  short_description: "RCR on TON — Mini App, sessions and wallet safety.",
});
await telegram("setChatMenuButton", {
  menu_button: { type: "web_app", text: "Open RCR", web_app: { url: miniAppUrl } },
});
process.stdout.write("RCR Telegram bot ready. Commands and Mini App menu configured.\n");
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => { stopping = true; });
}
await poll();
