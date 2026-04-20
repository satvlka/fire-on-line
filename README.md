# Distance Sensor Alert — MVP Setup Guide

## What this demo does
1. **Arduino R4 WiFi** reads an HC-SR04 ultrasonic distance sensor
2. When an object enters the threshold zone (default: < 50 cm), the Arduino POSTs an alert to your laptop
3. The **Node.js server** receives the alert and pushes it via WebSocket to every open dashboard tab
4. The **browser dashboard** shows a notification, flashes the UI red, and **starts your laptop webcam**
5. When the object leaves the zone, the camera stops and the dashboard returns to green

---

## Hardware Required
| Item | Notes |
|------|-------|
| Arduino R4 WiFi | The WiFiS3 library is built-in |
| HC-SR04 ultrasonic sensor | ~$2, widely available |
| 4× jumper wires | female–male |

### Wiring
```
HC-SR04   →   Arduino R4
VCC       →   5V
GND       →   GND
TRIG      →   Pin 9
ECHO      →   Pin 10
```

---

## Software Setup

### 1. Node.js server (your laptop)

```bash
# Clone or copy this folder, then:
cd distance_alert
npm install
node server.js
```

The terminal will print your laptop's local IP address — **copy it**.

### 2. Arduino sketch

Open `distance_alert.ino` in the Arduino IDE and fill in:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_SSID";       // your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // your WiFi password
const char* SERVER_HOST   = "192.168.x.x";          // laptop IP from step 1
const float THRESHOLD_CM  = 50.0;                   // adjust to taste
```

Upload to the Arduino R4 WiFi board.

### 3. Open the dashboard

Navigate to `http://localhost:3000` in any browser on your laptop.

> **Camera permission**: The browser will ask for webcam permission the first time the threshold is triggered. Allow it.

---

## Adjusting the threshold

- Change `THRESHOLD_CM` in the `.ino` file and re-upload, **or**
- For a no-reflash approach, add a `/threshold` endpoint to `server.js` and let the dashboard send it down to the Arduino — good next step!

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Arduino can't connect to WiFi | Check SSID/password; ensure 2.4 GHz band |
| Arduino can't reach server | Confirm laptop IP; check firewall allows port 3000 |
| Distance reads -1 | Object too far (> 4 m) or wiring issue on ECHO pin |
| Camera doesn't start | Browser needs HTTPS or localhost for getUserMedia — localhost is fine |
| WebSocket keeps reconnecting | Make sure `node server.js` is still running |

---

## Next steps beyond MVP
- [ ] Adjustable threshold slider on the dashboard (no reflash needed)
- [ ] Email / SMS notification via Twilio or SendGrid
- [ ] Log events to a SQLite database
- [ ] Serve over HTTPS so the dashboard works from any device on the network
- [ ] Multiple sensors / zones
