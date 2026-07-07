#define E32_RX 26
#define E32_TX 25
#define E32_AUX 27
#define E32_M0  33
#define E32_M1  32

HardwareSerial loraSerial(2);

String mensagemRecebida = "";

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(E32_M0, OUTPUT);
  pinMode(E32_M1, OUTPUT);
  pinMode(E32_AUX, INPUT);

  // Modo normal: M0 = LOW, M1 = LOW
  digitalWrite(E32_M0, LOW);
  digitalWrite(E32_M1, LOW);
  delay(500);

  loraSerial.begin(9600, SERIAL_8N1, E32_RX, E32_TX);

  Serial.println("Receptor LoRa iniciado.");
  Serial.println("Aguardando mensagem...");
}

void loop() {
  while (loraSerial.available()) {
    char c = loraSerial.read();

    if (c == '\n') {
      mensagemRecebida.trim();

      if (mensagemRecebida.length() > 0) {
        Serial.println(mensagemRecebida);
      }

      mensagemRecebida = "";
    } else {
      mensagemRecebida += c;
    }
  }
}