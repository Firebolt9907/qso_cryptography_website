# QSO Quantum Cryptography Lab — QKD UI & Simulator

An interactive user interface demonstrating **Quantum Key Distribution (BB84)**, **secure message transmission**, and **wiretap interception** across quantum and classical channels.

---

## 🎯 Designed for Custom Quantum Logic

All quantum mechanics and simulation routines are decoupled into a dedicated `QuantumLogic` object at the top of [`app.js`](file:///Users/rishu/Github/qso_cryptography_website/app.js). 

You can directly replace these hook methods with your own quantum algorithms, simulation backend, or quantum hardware API:

```javascript
// Located at the top of app.js:
const QuantumLogic = {
  prepareQubits(count) {
    // Return array of qubits with basis ('+' or '×') and polarization states
  },

  eveIntercept(qubits, basisStrategy) {
    // Intercept-Resend attack: measure photons and return collapsed states
  },

  bobMeasure(qubits) {
    // Measure incoming photons with Bob's basis choices
  },

  siftAndReconcile(measuredQubits) {
    // Compare bases, discard mismatches, calculate QBER, and return certified key
  },

  encryptOtp(plaintext, qkdKey) {
    // One-Time Pad encryption
  },

  decryptOtp(hexCiphertext, qkdKey) {
    // One-Time Pad decryption
  }
};
```

---

## 🖥️ UI Layout & Stations

### 1. Dual Transmission Wire Visualizer
- **⚡ Quantum Optical Fiber (Top Wire)**: Visualizes single photons with polarization states (`|H⟩`, `|V⟩`, `|↗⟩`, `|↘⟩`) traveling from Alice through Eve's quantum tap to Bob's detectors.
- **📡 Classical Public Channel (Bottom Wire)**: Visualizes public basis reconciliation packets and OTP-encrypted messages.

### 2. 👩‍💻 Station Alice (Transmitter)
- **Step 1: QKD Exchange**: Select photon count (12, 16, 24) and click **"Emit Photons & Run QKD Exchange"**. Displays Alice's certified QKD key.
- **Step 2: Message Transmission**: Compose a message, select recipient (Bob), and transmit the QKD-encrypted payload.
- **Sent Log**: History of transmitted packets.

### 3. 🕵️ Station Eve (Wiretap & Interceptor)
- **Quantum Channel Wiretap**:
  - Toggle the quantum fiber intercept on/off.
  - Choose Eve's measurement basis strategy (Random, Rectilinear `+`, or Diagonal `×`).
  - Displays Eve's captured qubit measurements and state collapse logs.
- **Classical Channel Interception**:
  - Switch between **Passive Sniffer** (copies passing messages) and **Active MitM** (pauses messages in transit).
  - Trapped Message Panel (specifically highlights that the message is addressed to Bob, not Eve).
  - **MitM Tamper Suite**: Allows Eve to edit the ciphertext bytes before forwarding or drop the packet entirely.

### 4. 👨‍💻 Station Bob (Receiver)
- **QBER Error Gauge**: Real-time visual progress bar showing the Quantum Bit Error Rate against the 11% security threshold.
- **Certified Key Status**: Displays Bob's matching QKD key or an alert if eavesdropping forced a key abort.
- **Inbox**: Displays received messages, decrypts with the QKD key, and flags tampering if bytes were altered in transit.
- **Quick Reply**: Bob can reply to Alice using the certified QKD key.

### 5. 🔬 BB84 Sifting Matrix Modal
Click **"🔬 View BB84 Sifting Matrix"** to open a full photon-by-photon audit table:
- Alice's bit and basis
- Eve's measurement and collapsed state
- Bob's detector basis and bit
- Basis match result (`✓` / `✗`)
- Sifted key bits and QBER error flags

---

## 🚀 Running Locally

The local server is running at:
**[http://localhost:8080](http://localhost:8080)**

To run or restart:
```bash
python3 serve.py
```
Or open [index.html](file:///Users/rishu/Github/qso_cryptography_website/index.html) directly in any browser.
