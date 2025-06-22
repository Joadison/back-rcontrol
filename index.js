const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const fetch = require("node-fetch");
const { spawn } = require("node:child_process");
const LGTV = require("lgtv2");
require("dotenv").config();
const cheerio = require("cheerio");

const app = express();
const PORT = 3333;

let tvClient = null;
let pointerSocket = null;
const clientKey = process.env.CLIENT_KEY;

if (!clientKey) {
  console.log("CLIENT_KEY não definida no .env");
}

const allowedApps = [
  "netflix",
  "paramount",
  "primevideo",
  "disney",
  "youtube",
  "plutotv",
];

const fallbackIcons = {
  "com.netflix.ninja":
    "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg",
  "com.disney.disneyplus":
    "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
  "com.amazon.avod":
    "https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png",
  "com.spotify.tv.android":
    "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg",
  "tv.pluto.android":
    "https://upload.wikimedia.org/wikipedia/commons/8/8f/Pluto_TV_2020_logo.png",
  "com.amazon.firetv.youtube":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/YouTube_2024.svg/1920px-YouTube_2024.svg.png",
};

async function getAppIcon(packageName) {
  if (fallbackIcons[packageName]) return fallbackIcons[packageName];

  try {
    const res = await fetch(
      `https://play.google.com/store/apps/details?id=${packageName}`
    );
    const html = await res.text();
    const $ = cheerio.load(html);
    const iconUrl = $("img.T75of.QNCnCf").attr("src");

    return iconUrl || null;
  } catch (err) {
    console.error(`Erro ao buscar logo para ${packageName}:`, err);
    return null;
  }
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ mensagem: "API Express.js" });
});

// ROKU
app.post("/roku/:ip/keypress/:command", async (req, res) => {
  const { ip, command } = req.params;
  try {
    const rokuRes = await fetch(`http://${ip}:8060/keypress/${command}`, {
      method: "POST",
    });
    res.status(rokuRes.status).send(`Comando ${command} enviado`);
  } catch (err) {
    res.status(500).send("Erro ao enviar comando");
  }
});

app.post("/roku/:ip/launch/:appId", async (req, res) => {
  const { ip, appId } = req.params;
  try {
    const rokuRes = await fetch(`http://${ip}:8060/launch/${appId}`, {
      method: "POST",
    });
    res.status(rokuRes.status).send(`App ${appId} aberto`);
  } catch (err) {
    res.status(500).send("Erro ao abrir app");
  }
});

app.get("/roku/:ip/query/apps", async (req, res) => {
  const { ip } = req.params;
  try {
    const rokuRes = await fetch(`http://${ip}:8060/query/apps`);
    const data = await rokuRes.text();
    res.send(data);
  } catch (err) {
    res.status(500).send("Erro ao buscar apps");
  }
});

app.post("/roku/:ip/input", async (req, res) => {
  const { ip } = req.params;
  const { text } = req.query;
  try {
    const rokuRes = await fetch(
      `http://${ip}:8060/keypress/Lit_${encodeURIComponent(text)}`,
      { method: "POST" }
    );
    res.status(rokuRes.status).send(`Texto enviado: ${text}`);
  } catch (err) {
    res.status(500).send("Erro ao enviar texto");
  }
});

// LG
app.post("/lg/connect", async (req, res) => {
  const { ip } = req.body;

  if (tvClient) {
    tvClient.disconnect();
    tvClient = null;
  }

  tvClient = LGTV({
    url: `ws://${ip}:3000`,
    clientKey: clientKey,
    keyFile: "client-key.json",
  });

  console.log("🔌 Conectando à TV no IP:", ip, clientKey);

  tvClient.on("connect", () => {
    console.log("Conectado à TV");
    if (!clientKey && tvClient.clientKey) {
      clientKey = tvClient.clientKey;
    }
  });
  tvClient.on("prompt", () => console.log("Aceite o pareamento na TV"));
  tvClient.on("error", (err) => console.error("Erro:", err));
  tvClient.on("close", () => {
    pointerSocket = null;
    tvClient = null;
  });

  res.json({ status: "Conectando..." });
});

app.post("/lg/command/:action", (req, res) => {
  if (!tvClient) return res.status(400).json({ error: "TV não conectada" });

  //console.log(tvClient.getSocket.toString());
  const actions = {
    power: () => tvClient.request("ssap://system/turnOff"),
    volumeup: () => tvClient.request("ssap://audio/volumeUp"),
    volumedown: () => tvClient.request("ssap://audio/volumeDown"),
    mute: () => tvClient.request("ssap://audio/setMute", { mute: true }),
    unmute: () => tvClient.request("ssap://audio/setMute", { mute: false }),
    play: () => tvClient.request("ssap://media.controls/play"),
    pause: () => tvClient.request("ssap://media.controls/pause"),
    netflix: () =>
      tvClient.request("ssap://system.launcher/launch", { id: "netflix" }),
    hdmi: () =>
      tvClient.request("ssap://tv/switchInput", { inputId: "HDMI_1" }),
    info: () =>
      tvClient.request(
        "ssap://com.webos.service.update/getCurrentSWInformation"
      ),
    home: () =>
      tvClient.getSocket(
        "ssap://com.webos.service.networkinput/getPointerInputSocket",
        (err, sock) => {
          if (err) return reject(err);
          try {
            if (name === "click") {
              sock.send("click");
            } else {
              sock.send("button", { name });
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        }
      ),
    back: () =>
      tvClient.request("ssap://system.launcher/getAppState", (err, res) => {
        if (err) console.error("Erro:", err);
        else console.log("Launcher aberto", res);
      }),
    up: () =>
      tvClient.getSocket(
        "ssap://com.webos.service.networkinput/getPointerInputSocket",
        (err, sock) => {
          if (!err) {
            sock.send("button", { name: "up" });
            sock.send("button", "up");
            return;
          }
        }
      ),
    down: () =>
      tvClient.request("ssap://tv/switchInput", { inputId: "HDMI_1" }),
    left: () =>
      tvClient.getSocket(
        "ssap://com.webos.service.networkinput/getPointerInputSocket",
        function (err, sock) {
          if (!err) {
            sock.send("button", { name: "left" });
            sock.send("button", "left");
            return;
          }
        }
      ),
    right: () =>
      tvClient.getSocket(
        "ssap://com.webos.service.networkinput/getPointerInputSocket",
        function (err, sock) {
          if (!err) {
            sock.send("button", { name: "right" });
            sock.send("button", "right");
            return;
          }
        }
      ),
    select: () =>
      tvClient.getSocket(
        "ssap://com.webos.service.networkinput/getPointerInputSocket",
        function (err, sock) {
          if (!err) {
            sock.send("click");
            return;
          }
        }
      ),

    /* home: () =>
      tvClient.request(
        "ssap://system.notifications/createToast",
        { message: "AAAA" },
        (err, res) => {
          if (err) console.error("Erro:", err);
          else console.log("Launcher aberto", res);
        }
      ), */
  };

  const action = actions[req.params.action.toLowerCase()];
  console.log(action);
  if (!action) return res.status(400).json({ error: "Ação inválida" });

  action();
  res.json({ status: "Comando enviado" });
});

app.post("/lg/pointer/:action", (req, res) => {
  if (!pointerSocket)
    return res.status(400).json({ error: "Socket de ponteiro não disponível" });

  const actions = {
    click: "click",
    up: "buttonUp",
    down: "buttonDown",
    move: () => {
      const { x, y } = req.body;
      pointerSocket.send(`move ${x} ${y}`);
    },
  };

  const action = actions[req.params.action.toLowerCase()];
  if (!action) return res.status(400).json({ error: "Ação inválida" });

  if (typeof action === "function") {
    action();
  } else {
    pointerSocket.send(action);
  }

  res.json({ status: "Ação de ponteiro executada" });
});

app.get("/lg/info/:type", (req, res) => {
  if (!tvClient) return res.status(400).json({ error: "TV não conectada" });

  const endpoints = {
    apps: "ssap://com.webos.applicationManager/listLaunchPoints",
    "current-app": "ssap://com.webos.applicationManager/getForegroundAppInfo",
    volume: "ssap://audio/getVolume",
    inputs: "ssap://tv/getExternalInputList",
  };

  const endpoint = endpoints[req.params.type];
  if (!endpoint) return res.status(400).json({ error: "Tipo inválido" });

  tvClient.request(endpoint, (err, response) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(response);
  });
});

// Amazon
app.post("/firetv/:ip/connect", async (req, res) => {
  const { ip } = req.params;
  const connect = spawn("./adb/platform-tools/adb", ["connect", `${ip}:5555`]);
  connect.stdout.on("data", (data) => {
    const msg = data.toString();
    console.log(`ADB Connect: ${msg}`);
  });

  connect.stderr.on("data", (data) => {
    const error = data.toString();
    console.error(`ADB Error: ${error}`);
  });

  connect.on("close", (code) => {
    if (code === 0) {
      res.send({ status: `Conectado ao Fire TV Stick (${ip})` });
    } else {
      res.status(500).send("Erro ao conectar via ADB");
    }
  });
});

app.post("/firetv/:ip/keypress/:keycode", async (req, res) => {
  const { ip, keycode } = req.params;
  const keycodes = {
    home: 3,
    up: 19,
    down: 20,
    left: 21,
    right: 22,
    select: 23,
    back: 4,
  };
  const btns = keycodes[keycode];
  if (!btns) {
    console.error("Botão inválido:", keycode);
    return;
  }

  const adb = spawn("./adb/platform-tools/adb", [
    "-s",
    `${ip}:5555`,
    "shell",
    "input",
    "keyevent",
    btns.toString(),
  ]);

  adb.stdout.on("data", (data) => {
    console.log(`ADB Keypress: ${data}`);
  });

  adb.stderr.on("data", (data) => {
    console.error(`ADB Error: ${data}`);
  });

  adb.on("close", (code) => {
    if (code === 0) {
      res.send({ status: `Tecla ${keycode} pressionada` });
    } else {
      res.status(500).send("Erro ao enviar comando");
    }
  });
});

app.post("/firetv/:ip/input", async (req, res) => {
  const { ip } = req.params;
  const { text } = req.query;
  const adb = spawn("./adb/platform-tools/adb", [
    "-s",
    `${ip}:5555`,
    "shell",
    "input",
    "text",
    `"${text}"`,
  ]);

  adb.stdout.on("data", (data) => {
    console.log(`ADB Input: ${data}`);
  });

  adb.stderr.on("data", (data) => {
    console.error(`ADB Error: ${data}`);
  });

  adb.on("close", (code) => {
    if (code === 0) {
      res.send({ status: `Texto "${text}" enviado` });
    } else {
      res.status(500).send("Erro ao enviar texto");
    }
  });
});

app.post("/firetv/:ip/launch/:app", async (req, res) => {
  const { ip, app } = req.params;
  const adb = spawn("./adb/platform-tools/adb", [
    "-s",
    `${ip}:5555`,
    "shell",
    "am",
    "start",
    "-n",
    app,
  ]);

  adb.stdout.on("data", (data) => {
    console.log(`ADB Launch: ${data}`);
  });

  adb.stderr.on("data", (data) => {
    console.error(`ADB Error: ${data}`);
  });

  adb.on("close", (code) => {
    if (code === 0) {
      res.send({ status: `App ${app} aberto` });
    } else {
      res.status(500).send("Erro ao abrir app");
    }
  });
});

app.get("/firetv/:ip/apps", async (req, res) => {
  const { ip } = req.params;

  const adb = spawn("./adb/platform-tools/adb", [
    "-s",
    `${ip}:5555`,
    "shell",
    "pm",
    "list",
    "packages",
  ]);

  let output = "";

  adb.stdout.on("data", (data) => {
    output += data.toString();
  });

  adb.stderr.on("data", (data) => {
    console.error(`ADB Error: ${data}`);
  });

  adb.on("close", async (code) => {
    if (code === 0) {
      const lines = output
        .split("\n")
        .map((line) => line.replace("package:", "").trim())
        .filter(Boolean);

      const packages = [...new Set(lines)];
      const filteredPackages = packages.filter((pkg) =>
        allowedApps.some((app) => pkg.toLowerCase().includes(app.toLowerCase()))
      );

      const appData = await Promise.all(
        filteredPackages.map(async (pkg) => {
          const icon = await getAppIcon(pkg);
          return { package: pkg, icon };
        })
      );
      res.send(appData);
    } else {
      res.status(500).send("Erro ao listar apps");
    }
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.handler = serverless(app);
