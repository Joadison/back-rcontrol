const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const fetch = require("node-fetch");
const { spawn } = require("node:child_process");
const LGTV = require("lgtv2");
const path = require("path");
require("dotenv").config();

const app = express();

let clientLG = null;
let pointerSocket = null;
let clientKey = process.env.CLIENT_KEY;
const keyFile = path.resolve(__dirname, "lgtv-client-key.json");
const adbPath = path.resolve(__dirname, "adb/platform-tools/adb.exe");

if (!clientKey) {
  console.log("CLIENT_KEY não definida no .env");
}

const allowedApps = [
  "netflix",
  "com.cbs.ca",
  "amazon.avod",
  "disney",
  "youtube",
  "tv.pluto.android",
  "thechosen",
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
  "com.cbs.ca":
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Paramount_Plus.svg/1920px-Paramount_Plus.svg.png",
  thechosen:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/The_Chosen_-_logo.jpg/1920px-The_Chosen_-_logo.jpg",
};

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

  if (clientLG) {
    clientLG.disconnect();
    clientLG = null;
  }

  clientLG = LGTV({
    url: `ws://${ip}:3000`,
    clientKey,
    keyFile: "client-key.json",
  });

  clientLG.on("connect", () => {
    console.log("🔌 Conectando à TV no IP:", ip, clientKey);
    if (!clientKey && tvClient.clientKey) {
      clientKey = tvClient.clientKey;
    }
  });
  clientLG.on("prompt", () => console.log("Aceite o pareamento na TV"));
  clientLG.on("error", (err) => console.error("Erro:", err));
  clientLG.on("close", () => {
    clientLG = null;
  });

  res.json({ status: "Conectando..." });
});

app.post("/lg/command/:action", (req, res) => {
  if (!clientLG) return res.status(400).json({ error: "TV não conectada" });
  const actions = {
    power: () => clientLG.request("ssap://system/turnOff"),
    volumeup: () => clientLG.request("ssap://audio/volumeUp"),
    volumedown: () => clientLG.request("ssap://audio/volumeDown"),
    mute: () => clientLG.request("ssap://audio/setMute", { mute: true }),
    unmute: () => clientLG.request("ssap://audio/setMute", { mute: false }),
    play: () => clientLG.request("ssap://media.controls/play"),
    pause: () => clientLG.request("ssap://media.controls/pause"),
    netflix: () =>
      clientLG.request("ssap://system.launcher/launch", { id: "netflix" }),
    hdmi: () =>
      clientLG.request("ssap://tv/switchInput", { inputId: "HDMI_1" }),
    info: () =>
      clientLG.request(
        "ssap://com.webos.service.update/getCurrentSWInformation"
      ),
    home: () =>
      clientLG.getSocket(
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
      clientLG.request("ssap://system.launcher/getAppState", (err, res) => {
        if (err) console.error("Erro:", err);
        else console.log("Launcher aberto", res);
      }),
    up: () =>
      clientLG.getSocket(
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
      clientLG.request("ssap://tv/switchInput", { inputId: "HDMI_1" }),
    left: () =>
      clientLG.getSocket(
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
      clientLG.getSocket(
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
      clientLG.getSocket(
        "ssap://com.webos.service.networkinput/getPointerInputSocket",
        function (err, sock) {
          if (!err) {
            sock.send("click");
            return;
          }
        }
      ),

    /* home: () =>
      clientLG.request(
        "ssap://system.notifications/createToast",
        { message: "AAAA" },
        (err, res) => {
          if (err) console.error("Erro:", err);
          else console.log("Launcher aberto", res);
        }
      ), */
  };

  const action = actions[req.params.action.toLowerCase()];
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
  if (!clientLG) return res.status(400).json({ error: "TV não conectada" });

  const endpoints = {
    apps: "ssap://com.webos.applicationManager/listLaunchPoints",
    "current-app": "ssap://com.webos.applicationManager/getForegroundAppInfo",
    volume: "ssap://audio/getVolume",
    inputs: "ssap://tv/getExternalInputList",
  };

  const endpoint = endpoints[req.params.type];
  if (!endpoint) return res.status(400).json({ error: "Tipo inválido" });

  clientLG.request(endpoint, (err, response) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(response);
  });
});

// Amazon
app.post("/firetv/:ip/connect", async (req, res) => {
  const { ip } = req.params;
  const connect = spawn(adbPath, ["connect", `${ip}:5555`]);
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
  const keyEvent = keycodes[keycode];
  if (!keyEvent) {
    console.error("Botão inválido:", keycode);
    return;
  }

  const adb = spawn(adbPath, [
    "-s",
    `${ip}:5555`,
    "shell",
    "input",
    "keyevent",
    keyEvent.toString(),
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

app.post("/firetv/:ip/launch", async (req, res) => {
  const { ip } = req.params;
  const { packageName } = req.body;
  const adb = spawn(adbPath, [
    "-s",
    `${ip}:5555`,
    "shell",
    "am",
    "start",
    "-n",
    `${packageName}/.MainActivity`,
    "-a",
    "android.intent.action.VIEW",
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
  const adb = spawn(adbPath, [
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
    console.log(output);
    if (code === 0) {
      const lines = output
        .split("\n")
        .map((line) => line.replace("package:", "").trim())
        .filter(Boolean);

      const packages = [...new Set(lines)];
      const filteredPackages = packages.filter((line) =>
        allowedApps.some((app) =>
          line.toLowerCase().includes(app.toLowerCase())
        )
      );
      const appData = filteredPackages
        .map((pkg) => {
          const lowerPkg = pkg.toLowerCase();
          for (const key in fallbackIcons) {
            if (lowerPkg.includes(key)) {
              return { package: pkg, icon: fallbackIcons[key] };
            }
          }
          return null; // { package: pkg };
        })
        .filter(Boolean);

      res.send(appData);
    } else {
      res.status(500).send("Erro ao listar apps");
    }
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3333;
  app.listen(PORT, () => {
    console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.handler = serverless(app);
