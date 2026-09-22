# QSO Cryptography Lab — Interception & Secure Messaging Simulator

An interactive web application designed to demonstrate the mechanics of **transmitting, receiving, and intercepting network messages**, highlighting the differences between unencrypted cleartext transmissions, basic classical substitution ciphers, and modern authenticated cryptographic protocols (AEAD / AES-256-GCM).

---

## 🌟 Key Features

### 1. 📡 Station Alice (Sender)
- **Target Selection**: Send messages to **Bob** (the intended recipient), **Charlie** (a third party), or **Broadcast**.
- **Cryptographic Suites**:
  - **Plaintext (No Encryption)**: Shows cleartext vulnerability over an untrusted channel.
  - **Caesar Cipher**: Symmetric substitution with customizable shift key (1–25).
  - **XOR Stream Cipher**: Symmetric byte-wise XOR returning hexadecimal wire data.
  - **AES-256-GCM**: Modern authenticated encryption using Web Crypto API (`window.crypto.subtle`) with random 96-bit IVs and AEAD integrity tags.
- **Integrity Signatures**: Option to attach a SHA-256 checksum in the packet header.
- **Wire Preview**: Live preview showing the exact byte/text stream traveling through the physical wire.

### 2. 🕵️ Station Eve (Wiretap & Interceptor Console)
Eve represents an unauthorized node situated on the network channel.
- **Interception Modes**:
  - **Passive Sniffer (Promiscuous)**: Silently logs and inspects copies of all packets crossing the wire while allowing them to continue to Bob.
  - **Active MitM (Trap & Tamper)**: Traps packets in transit at the wiretap junction, halting the transmission.
  - **Bypass**: Turns off the wiretap tap.
- **Eve's Decryption & Cryptanalysis Workbench**:
  - **Cleartext Leaks**: Immediately reads unprotected messages.
  - **Caesar Frequency Analysis**: Automatically computes all 25 shift permutations and uses English letter/word frequency heuristics to score and crack the shift key.
  - **XOR Dictionary Attack**: Tests common passwords against the ciphertext.
  - **AES-256-GCM**: Demonstrates cipher resistance against brute-force inspection.
- **Man-in-the-Middle (MitM) Tamper Suite**:
  - **Alter Payload**: Modify the message in transit before forwarding (e.g. changing coordinates or instructions).
  - **Redirect Destination**: Reroute packets addressed to Bob to someone else.
  - **Forge Checksums**: Option to recalculate the SHA-256 checksum to evade naive hash verification.
  - **Drop Packet (DoS)**: Discards the message entirely so the recipient never receives it.
- **Spoofed Sender Injection**: Eve can craft and transmit forged packets onto the wire claiming to originate from Alice.

### 3. 📥 Station Bob (Intended Recipient)
- **Local Credentials**: Configure Bob's shared key for decrypting incoming AES or XOR messages.
- **Integrity & Authenticity Verifier**:
  - Automatically calculates SHA-256 hashes of incoming payloads.
  - Alerts the recipient if a packet was modified in transit:
    - `✅ INTEGRITY VERIFIED`: Untampered message.
    - `🚨 INTEGRITY BREACH`: Checksum mismatch detected!
    - `❌ DECRYPTION FAILED`: Authenticated cipher tag mismatch (e.g., tampered AES payload).
- **Two-Way Communication**: Send acknowledgments and replies back to Alice (which Eve can also intercept).

### 4. ⚡ Visual Wire & Audio Feedback
- Real-time animated packet token traveling across an SVG network pipeline.
- Procedural audio sound effects synthesized using the **Web Audio API** (transmission chirps, wiretap intercept sirens, delivery chimes, and tamper alarms).

---

## 🚀 How to Run

### Option 1: Using the Included Python Server
```bash
python3 serve.py
```
Open your browser and navigate to:
**[http://localhost:8080](http://localhost:8080)**

### Option 2: Direct File Open
You can also open [index.html](file:///Users/rishu/Github/qso_cryptography_website/index.html) directly in any modern web browser.

---

## 🧪 Guided Scenarios to Try

Use the **"Presets / Scenarios"** dropdown in the top header to quickly test key concepts:
1. **Plaintext Leak**: Send an unencrypted message and observe how Eve immediately reads confidential cleartext.
2. **Caesar Substitution & Brute-Force**: Send a shifted message; Eve's workbench will automatically crack the shift key using frequency analysis.
3. **Active MitM Tampering**: Alice sends an order with a checksum; Eve holds it, modifies the payload to an ambush location, and forwards it. Bob's console flags a major integrity alarm!
4. **Modern AES-256-GCM**: Send an authenticated message; Eve sees random noise. If Eve modifies even a single character, AES-GCM's AEAD tag rejects the message at Bob's station.
5. **Spoofed Sender Injection**: Eve injects a forged message pretending to be Alice.
