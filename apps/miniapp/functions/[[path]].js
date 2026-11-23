const RCR_ICON_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAAEjElEQVR42u3dPXYbRxBFYbAPQ4UOHXkJjpRpBw4dexdeg3fh2AtwrkyRVqGFKPPhgYnRAOifqurv5iSnqy9fVQ8wwMuHn365AO/RlADkADlADpAD5EBIXjdc869//PnYD379+6+tCvVS/j7HwyrQpaAcQ23YypU6ctzlxAO7OPr3k2OBE0P3ae1fJ8cju7JkSwJe0l5yHGxAqOpnuc4ictwqd/BaJ73sNHK8W990KZ1xFaHlqKFF3hUFleP/RSx2CyHFAsPJUV6LRIuNJcdVsTZ5LSPsqqPIsVVgZFl+CDn2DIz4dVgsBy0i16SpQjSu6rDwReZlyfF2zbSIWaIFcgiMLLVqzNBiQiSHVpKrdI0Z6SJkWn40ZvBjpRzMSOpHYwY/1gyk/109LTLWtjEje4SMy4/GDH5MlWPhywG6TGg5TKBl5tPGDH7MkIMZxfxoo68V8/0IJ4fjSb3DS+trBiodXlrf6xAblYaPNujKUGD4eFYOo0bh4aN1MQMlh4/WV1VUai7teSWZUbW5nH0/x7d/Pk5b1c+/f+n7C4Nc/PzLePIg6eOtNRdymEzvby7kEB7k4Mf94UEOkEN43B8e5AA5hMf94dHhm5pm3rN67BZT9yvszqwafr5cLr/9+0ly4CYnw4McIAcGyeF9G3t2FskBcmCEHHpKMc7f8JAcIAe6y6Gn7NxZJAfIgb5y6Ck7cLDLp5LDkymFxw5tBWYOkANzuPk45NWjsPEfh4z/TrCANTx+4FlyQFsBOUAOkAMB5XDjfDfe3fEfJIcb57U53l9tBTcZ+zhk6kcUZxKzhpID5AA5QA6QA+QAOUAOVOF16G93fyx1DSUHyAFygBwgByLL4S1htXnk8zm8AWw3PNSE+3hd9Ye739sJ9bWMSWsoOeC0AnJggRzPf9k1spxjbx1OJQe0FZADs+UwdhQeOA64+ZlgJ2cWVJ1GtRWYOTBCDnc7tu0pkgPaCgbJobPs2VMkB8iBcXLoLBv2FMmBrnIIjwKx0VkOr61U4uRuaivoIYexdJ9RVHKgqxzCY5/YkBzoKofw2CQ2nk0OfiQyY0ZyXNzzyMkDu9YWionIsfG4HMKjfGw8lRwm06pzaOejLD+KNZQOcmguVRtKn+TQXEo2lJ5thR/FGko3Od7qyY84Zjzf9Pskh+Gj0qjRv60YPsqMGkNmDs2lxqgxRA7DR41RY1Ry8KOMGUPaCj9qmDFq5nB4SXo8mSGHw0vS48kkOfiR3YzLDz9NMHhTNGcMLenwd5+bT/P+s814NIEfSWN40nMr/MjYoOc91MSPdKPb8IH0YJFG1OAVm/045NXaREjk/6XZyeGIm6hEy+TQYuJXZuVT9lpM8P+ZlckhQoLXIYQc78bGVorEXH4UOXaOkLCrjiXHbhESfLHh5NhEkRQLDCrHwfkltSW5VhRajkqKZFxFAjkOihu/vkkvO5kcx7WOVu4s11lKjjPVX7UBAS9pUzlObsnoXVn718nRbZ+e3LPRv58c4SzpS7GbMQXlmOlK7Rv89eXoqMtuLxfvKAdO4is1QA6QA+QAObCU7wRIcIakd55qAAAAAElFTkSuQmCC";

function getPublicOrigin(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value.replace(/\/+$/, "") ? url.origin : "";
  } catch { return ""; }
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const publicOrigin = getPublicOrigin(env.RCR_PUBLIC_URL || "");
  const apiBase = String(env.RCR_API_BASE || "").replace(/\/+$/, "");
  const manifestUrl = publicOrigin ? publicOrigin + "/tonconnect-manifest.json" : "";
  if (url.pathname === "/config.js") {
    const body = "window.RCR_CONFIG = Object.freeze({ apiBase: " + JSON.stringify(apiBase) + ", tonConnectManifestUrl: " + JSON.stringify(manifestUrl) + " });";
    return new Response(body, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" } });
  }
  if (url.pathname === "/tonconnect-manifest.json") {
    if (!publicOrigin) return json({ error: "https_manifest_not_configured" }, 503);
    return json({ url: publicOrigin, name: "RCR TON Rewards", iconUrl: publicOrigin + "/rcr-icon.png" }, 200, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, HEAD",
      "cache-control": "public, max-age=300",
    });
  }
  if (url.pathname === "/rcr-icon.png") {
    const bytes = Uint8Array.from(atob(RCR_ICON_BASE64), ch => ch.charCodeAt(0));
    return new Response(request.method === "HEAD" ? null : bytes, {
      headers: { "content-type": "image/png", "access-control-allow-origin": "*", "cache-control": "public, max-age=86400" },
    });
  }
  return new Response("Not found", { status: 404 });
}
