# Rastreador GPS via LoRa com ESP32 e Node.js

Projeto experimental de rastreamento de localização utilizando **ESP32**, **GPS NEO-6M**, módulos **LoRa E32**, **Node.js**, **Leaflet** e **OpenStreetMap**.

A ideia do projeto é montar um sistema em que um ESP32 móvel, alimentado futuramente por powerbank, coleta latitude e longitude por GPS e envia esses dados via LoRa para outro ESP32 conectado ao computador. A aplicação Node.js escuta a porta COM desse ESP32 receptor, recebe as coordenadas e exibe o caminho percorrido em um mapa web em tempo real.

## Visão geral

O projeto é dividido em três partes principais:

1. **ESP32 emissor**

   * Lê dados de localização de um módulo GPS NEO-6M.
   * Envia as coordenadas por LoRa usando um módulo E32.
   * Será alimentado por powerbank para funcionar como dispositivo móvel.

2. **ESP32 receptor**

   * Recebe mensagens LoRa enviadas pelo ESP32 emissor.
   * Repassa os dados recebidos para o computador pela porta serial USB.

3. **Servidor Node.js**

   * Escuta a porta COM do computador.
   * Processa coordenadas recebidas pela serial.
   * Armazena temporariamente os pontos em memória.
   * Disponibiliza uma página web com mapa.
   * Atualiza o mapa em tempo real usando Server-Sent Events.
   * Desenha o caminho percorrido pelo dispositivo emissor.

## Arquitetura do projeto

```txt
GPS NEO-6M
    ↓
ESP32 emissor
    ↓
LoRa E32
    ↓
LoRa E32
    ↓
ESP32 receptor
    ↓
Porta COM / USB
    ↓
Servidor Node.js
    ↓
Leaflet + OpenStreetMap
    ↓
Mapa com trilha percorrida
```

## Tecnologias utilizadas

* ESP32
* Módulo GPS NEO-6M
* Módulo LoRa E32
* Arduino IDE
* Node.js
* Express
* SerialPort
* Server-Sent Events
* Leaflet
* OpenStreetMap

## Status atual

O projeto ainda está em desenvolvimento.

### Já implementado

* Teste isolado do GPS NEO-6M no ESP32.
* Teste de comunicação LoRa entre dois ESP32 usando módulos E32.
* Servidor Node.js com Express.
* Leitura de dados pela porta serial.
* Página web com mapa Leaflet.
* Exibição da posição no mapa.
* Desenho da trilha percorrida.
* Endpoint HTTP para testar envio manual de coordenadas.
* Atualização em tempo real usando `/eventos`.

### Em desenvolvimento

* Integração final entre GPS e LoRa no mesmo ESP32 emissor.
* Envio real de latitude e longitude via LoRa.
* Ajuste da pinagem final do ESP32 emissor.
* Alimentação do ESP32 emissor por powerbank.
* Testes práticos de alcance e estabilidade em campo.

## Funcionamento esperado

O ESP32 emissor deverá enviar coordenadas no formato:

```txt
-2.530700,-44.306800
```

ou em JSON:

```json
{"lat":-2.5307,"lng":-44.3068}
```

O servidor Node.js aceita os dois formatos.

Quando uma coordenada válida é recebida, ela é salva em memória e enviada em tempo real para a página web. O mapa move o marcador para a nova localização e adiciona o ponto à linha que representa o caminho percorrido.

## Pinagem usada no teste LoRa E32

A mesma ligação foi usada nos dois ESP32 durante o teste de comunicação LoRa:

| Módulo E32 | ESP32  |
| ---------- | ------ |
| VCC        | 3.3V   |
| GND        | GND    |
| AUX        | GPIO27 |
| TXD        | GPIO26 |
| RXD        | GPIO25 |
| M0         | GPIO33 |
| M1         | GPIO32 |

O módulo E32 foi utilizado em modo normal:

```txt
M0 = LOW
M1 = LOW
```

## Pinagem usada no teste GPS NEO-6M

No teste isolado do GPS:

| Módulo GPS NEO-6M | ESP32        |
| ----------------- | ------------ |
| VCC               | VIN          |
| GND               | GND          |
| TX                | GPIO32       |
| RX                | Desconectado |

O RX do GPS foi deixado desconectado, pois para este teste o ESP32 apenas recebe dados NMEA enviados pelo módulo GPS.

> Atenção: essa pinagem serve para o teste isolado do GPS. No projeto final, o GPIO32 já está sendo usado como `M1` do módulo E32. Portanto, será necessário mover o GPS para outro pino, por exemplo `GPIO16`, e usar outra UART do ESP32.

## Servidor Node.js

O servidor está no arquivo `server.js`.

Ele utiliza:

* `express` para criar o servidor HTTP.
* `cors` para permitir requisições.
* `serialport` para escutar a porta serial.
* `@serialport/parser-readline` para processar as linhas recebidas.
* `EventSource` no navegador para receber coordenadas em tempo real.

## Instalação

Clone o repositório:

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
```

Instale as dependências:

```bash
npm install
```

Caso ainda não tenha um `package.json`, as principais dependências são:

```bash
npm install express cors serialport @serialport/parser-readline
```

## Execução

Antes de iniciar o servidor, defina a porta serial onde o ESP32 receptor está conectado.

No Windows PowerShell:

```powershell
$env:SERIAL_PORT="COM3"; npm start
```

No CMD:

```cmd
set SERIAL_PORT=COM3 && npm start
```

No Linux ou macOS:

```bash
SERIAL_PORT=/dev/ttyUSB0 npm start
```

O servidor será iniciado em:

```txt
http://localhost:3010
```

## Como descobrir a porta COM

No Windows, a porta pode ser vista pelo Gerenciador de Dispositivos, geralmente com nomes como:

```txt
COM3
COM4
COM5
```

Também é importante fechar o Monitor Serial da Arduino IDE antes de iniciar o servidor Node.js, pois a porta COM não pode ser usada por dois programas ao mesmo tempo.

## Rotas disponíveis

### `GET /`

Abre a página principal com o mapa.

```txt
http://localhost:3010
```

### `GET /status`

Retorna o status da serial e a quantidade de coordenadas recebidas.

Exemplo de resposta:

```json
{
  "serial": "Conectado em COM3 @ 115200",
  "porta": "COM3",
  "baudRate": 115200,
  "totalCoordenadas": 3
}
```

### `GET /coordenadas`

Retorna todas as coordenadas recebidas desde que o servidor foi iniciado.

### `POST /coordenada`

Permite enviar uma coordenada manualmente para teste.

Exemplo:

```bash
curl -X POST http://localhost:3010/coordenada \
  -H "Content-Type: application/json" \
  -d "{\"lat\":-2.5307,\"lng\":-44.3068}"
```

Body esperado:

```json
{
  "lat": -2.5307,
  "lng": -44.3068
}
```

### `GET /eventos`

Rota usada pelo navegador para receber novas coordenadas em tempo real via Server-Sent Events.

## Teste manual do mapa

Mesmo sem a comunicação LoRa finalizada, é possível testar o mapa enviando uma coordenada manualmente para o servidor:

```bash
curl -X POST http://localhost:3010/coordenada \
  -H "Content-Type: application/json" \
  -d "{\"lat\":-2.5307,\"lng\":-44.3068}"
```

Após isso, o ponto deve aparecer no mapa.

## Formato esperado pela serial

O servidor aceita linhas no formato JSON:

```json
{"lat":-2.5307,"lng":-44.3068}
```

ou no formato simples:

```txt
-2.5307,-44.3068
```

Cada coordenada deve ser enviada em uma nova linha.

## Observação sobre o código atual do receptor LoRa

No teste atual, o receptor imprime mensagens assim:

```txt
Mensagem recebida: teste concluído
```

Para integração direta com o servidor Node.js, o ideal é que o ESP32 receptor envie pela serial apenas a coordenada limpa, por exemplo:

```txt
-2.5307,-44.3068
```

ou:

```json
{"lat":-2.5307,"lng":-44.3068}
```

Dessa forma, o `server.js` consegue interpretar automaticamente os dados recebidos pela porta COM.

## Exemplo de fluxo final

1. O GPS NEO-6M obtém fix dos satélites.
2. O ESP32 emissor lê latitude e longitude.
3. O ESP32 emissor envia a coordenada pelo módulo LoRa E32.
4. O ESP32 receptor recebe a mensagem LoRa.
5. O ESP32 receptor envia a coordenada pela USB serial.
6. O servidor Node.js recebe a linha pela porta COM.
7. O servidor processa a coordenada.
8. O mapa Leaflet exibe a posição.
9. A trilha do percurso é atualizada.

## Possíveis melhorias futuras

* Salvar as coordenadas em banco de dados.
* Exportar o trajeto em CSV ou GPX.
* Exibir velocidade, altitude, satélites e HDOP no mapa.
* Criar botão para limpar trilha.
* Criar múltiplos rastreadores.
* Adicionar autenticação.
* Melhorar o painel visual do mapa.
* Adicionar status de bateria.
* Adicionar tratamento de perda de sinal.
* Criar uma versão com frontend separado.
* Fazer deploy da interface web.
* Criar caixa/protótipo físico para o ESP32 emissor.

## Licença

Este projeto é experimental e foi desenvolvido para estudo de comunicação LoRa, rastreamento GPS e integração entre hardware e aplicações web.
