// ─────────────────────────────────────────────────────────────────
//  Distance Sensor Alert – Arduino R4 WiFi
//  Wiring (HC-SR04):
//    VCC  → 5V
//    GND  → GND
//    TRIG → pin 9
//    ECHO → pin 10
// ─────────────────────────────────────────────────────────────────

#include <WiFiS3.h>

// ── Configure these ──────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST   = "YOUR_LAPTOP_IP";   // e.g. "192.168.1.42"
const int   SERVER_PORT   = 3000;
const float THRESHOLD_CM  = 50.0;               // alert when object closer than this
// ─────────────────────────────────────────────────────────────────

const int TRIG_PIN  = 9;
const int ECHO_PIN  = 10;
const int LED_PIN   = LED_BUILTIN;
const unsigned long POLL_MS      = 500;   // how often to read sensor
const unsigned long DEBOUNCE_MS  = 1000;  // ignore rapid flips

WiFiClient client;
bool        lastTriggered   = false;
unsigned long lastStateChange = 0;
unsigned long lastPoll        = 0;

// ── Setup ────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  while (!Serial);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN,  OUTPUT);

  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Reporting to: http://");
  Serial.print(SERVER_HOST);
  Serial.print(":");
  Serial.println(SERVER_PORT);
}

// ── Ultrasonic distance read ─────────────────────────────────────
float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30 ms timeout (~5 m max)
  if (duration == 0) return -1.0;                 // no echo / out of range
  return (duration * 0.034f) / 2.0f;
}

// ── HTTP POST to Node.js server ──────────────────────────────────
void postAlert(float distance, bool triggered) {
  if (!client.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("[WARN] Could not reach server");
    return;
  }

  String body = "{\"triggered\":" + String(triggered ? "true" : "false") +
                ",\"distance\":"  + String(distance, 1) + "}";

  client.println("POST /alert HTTP/1.1");
  client.println("Host: " + String(SERVER_HOST));
  client.println("Content-Type: application/json");
  client.println("Content-Length: " + String(body.length()));
  client.println("Connection: close");
  client.println();
  client.print(body);

  // Drain response (keeps TCP clean)
  unsigned long t = millis();
  while (client.connected() && millis() - t < 2000) {
    if (client.available()) client.read();
  }
  client.stop();

  Serial.print(triggered ? "[ALERT] " : "[CLEAR] ");
  Serial.print(distance, 1);
  Serial.println(" cm");
}

// ── Main loop ────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();
  if (now - lastPoll < POLL_MS) return;
  lastPoll = now;

  float dist = readDistanceCm();
  if (dist < 0) return;  // bad reading, skip

  bool triggered = (dist < THRESHOLD_CM);

  // Only POST when state changes + debounce rapid flips
  if (triggered != lastTriggered && (now - lastStateChange) >= DEBOUNCE_MS) {
    lastTriggered  = triggered;
    lastStateChange = now;
    digitalWrite(LED_PIN, triggered ? HIGH : LOW);
    postAlert(dist, triggered);
  }

  // Also send periodic distance updates when triggered (for live dashboard)
  if (triggered) {
    postAlert(dist, true);
  }
}
