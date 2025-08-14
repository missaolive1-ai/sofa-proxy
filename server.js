import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

const cache = new Map();
const now = () => Date.now();

function setCorsAndCache(res, ttl) {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": `public, max-age=${ttl}, stale-while-revalidate=30`
  });
}

app.options("*", (req, res) => {
  setCorsAndCache(res, 600);
  res.status(204).end();
});

app.get("/sofa/*", async (req, res) => {
  const path = req.originalUrl.replace(/^\/sofa/, "");
  const key = req.originalUrl;

  const fast = req.query.fast ? true : false;
  let ttl = fast ? 3 : 15;

  const c = cache.get(key);
  if (c && c.exp > now()) {
    setCorsAndCache(res, ttl);
    return res.status(c.status).set(c.headers).send(c.body);
  }

  const navHeaders = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36",
    "Origin": "https://www.sofascore.com",
    "Referer": "https://www.sofascore.com/",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "X-Requested-With": "XMLHttpRequest"
  };

  const targets = [
    "https://api.sofascore.com",
    "https://www.sofascore.com"
  ];

  let upstreamRes;
  for (const base of targets) {
    const url = base + path;
    upstreamRes = await fetch(url, { headers: navHeaders, method: "GET" });
    if (![401, 403].includes(upstreamRes.status)) break;
  }

  const bodyBuf = Buffer.from(await upstreamRes.arrayBuffer());
  const headers = Object.fromEntries(upstreamRes.headers);

  if ([401, 403].includes(upstreamRes.status)) ttl = 30;

  setCorsAndCache(res, ttl);
  res.status(upstreamRes.status).set(headers).send(bodyBuf);

  cache.set(key, {
    body: bodyBuf,
    headers,
    status: upstreamRes.status,
    exp: now() + ttl * 1000
  });
});

app.get("*", (req, res) => res.status(200).send("OK"));

app.listen(PORT, () => {
  console.log("sofa-proxy on", PORT);
});
