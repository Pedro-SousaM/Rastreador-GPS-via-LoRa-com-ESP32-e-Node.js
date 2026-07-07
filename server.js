const express = require("express");
const cors = require("cors");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const app = express();
const PORT = 3010;
const BAUD_RATE = 115200;
const SERIAL_PORT = process.env.SERIAL_PORT;

app.use(cors());
app.use(express.json());

let coordenadas = [];
let clients = [];
let serialStatus = "Serial não configurada";

function registrarCoordenada(lat, lng, origem = "serial") {
  const novaCoordenada = {
    lat,
    lng,
    origem,
    data: new Date().toISOString(),
  };

  coordenadas.push(novaCoordenada);
  console.log("Nova coordenada:", novaCoordenada);

  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(novaCoordenada)}\n\n`);
  });

  return novaCoordenada;
}

function processarLinhaSerial(linha) {
  const texto = linha.trim();
  if (!texto) return;

  try {
    const data = JSON.parse(texto);
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      registrarCoordenada(data.lat, data.lng, "serial");
      serialStatus = "Recebendo coordenadas";
      return;
    }
  } catch {
    // formato alternativo: lat,lng
    const partes = texto.split(",");
    if (partes.length === 2) {
      const lat = parseFloat(partes[0]);
      const lng = parseFloat(partes[1]);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        registrarCoordenada(lat, lng, "serial");
        serialStatus = "Recebendo coordenadas";
      }
    }
  }
}

async function iniciarSerial() {
  if (!SERIAL_PORT) {
    console.log("SERIAL_PORT não definida. Use: SERIAL_PORT=COM3 npm start");
    console.log("Execute 'npm run ports' para listar portas disponíveis.");
    serialStatus = "Defina SERIAL_PORT (ex: COM3)";
    return;
  }

  const port = new SerialPort({
    path: SERIAL_PORT,
    baudRate: BAUD_RATE,
    autoOpen: false,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  parser.on("data", processarLinhaSerial);

  port.on("open", () => {
    serialStatus = `Conectado em ${SERIAL_PORT} @ ${BAUD_RATE}`;
    console.log(serialStatus);
  });

  port.on("error", (err) => {
    serialStatus = `Erro serial: ${err.message}`;
    console.error(serialStatus);
  });

  port.on("close", () => {
    serialStatus = `Porta ${SERIAL_PORT} fechada`;
    console.log(serialStatus);
  });

  try {
    await port.open();
  } catch (err) {
    serialStatus = `Falha ao abrir ${SERIAL_PORT}: ${err.message}`;
    console.error(serialStatus);
    if (/access denied/i.test(err.message)) {
      console.error("");
      console.error("A porta COM está em uso. Tente:");
      console.error("  1. Fechar o Monitor Serial do Arduino IDE (e o IDE inteiro)");
      console.error("  2. Parar outro 'npm start' com Ctrl+C");
      console.error("  3. Desconectar e reconectar o cabo USB do ESP32");
      console.error("  4. Rodar o PowerShell como Administrador");
      console.error("");
      console.error("O mapa em http://localhost:3010 funciona mesmo assim,");
      console.error("mas só receberá coordenadas quando a serial estiver livre.");
    }
  }
}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Mapa GPS Leaflet</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; }
    .painel {
      position: absolute;
      z-index: 999;
      top: 10px;
      left: 10px;
      background: white;
      padding: 10px 14px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-size: 14px;
      line-height: 1.5;
    }
    .serial { color: #555; font-size: 12px; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="painel">
    <strong>Mapa GPS</strong>
    <div id="status">Aguardando coordenadas...</div>
    <div class="serial" id="serialStatus"></div>
  </div>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <script>
    const map = L.map("map").setView([-2.5307, -44.3068], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    let marcadorAtual = null;
    let trilha = L.polyline([], { color: "#2563eb", weight: 3 }).addTo(map);
    const status = document.getElementById("status");
    const serialStatus = document.getElementById("serialStatus");

    function adicionarMarcador(lat, lng, dataHora) {
      const posicao = [lat, lng];
      if (marcadorAtual) {
        marcadorAtual.setLatLng(posicao);
      } else {
        marcadorAtual = L.marker(posicao).addTo(map);
      }
      trilha.addLatLng(posicao);
      marcadorAtual
        .bindPopup("Latitude: " + lat + "<br>Longitude: " + lng + (dataHora ? "<br>" + dataHora : ""))
        .openPopup();
      map.setView(posicao, 16);
      status.innerHTML = "Lat: " + lat + "<br>Lng: " + lng;
    }

    fetch("/status").then(r => r.json()).then(s => {
      serialStatus.textContent = s.serial;
    });

    const eventos = new EventSource("/eventos");
    eventos.onmessage = function(event) {
      const data = JSON.parse(event.data);
      adicionarMarcador(data.lat, data.lng, data.data);
    };

    fetch("/coordenadas").then(res => res.json()).then(lista => {
      if (lista.length > 0) {
        lista.forEach(c => trilha.addLatLng([c.lat, c.lng]));
        const ultima = lista[lista.length - 1];
        adicionarMarcador(ultima.lat, ultima.lng, ultima.data);
      }
    });
  </script>
</body>
</html>
  `);
});

app.get("/status", (req, res) => {
  res.json({
    serial: serialStatus,
    porta: SERIAL_PORT || null,
    baudRate: BAUD_RATE,
    totalCoordenadas: coordenadas.length,
  });
});

app.post("/coordenada", (req, res) => {
  const { lat, lng } = req.body;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return res.status(400).json({
      erro: 'Envie um JSON no formato: { "lat": -2.5307, "lng": -44.3068 }',
    });
  }

  const novaCoordenada = registrarCoordenada(lat, lng, "http");

  res.json({
    mensagem: "Coordenada recebida com sucesso",
    coordenada: novaCoordenada,
  });
});

app.get("/coordenadas", (req, res) => {
  res.json(coordenadas);
});

app.get("/eventos", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  clients.push(res);

  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  iniciarSerial();
});
