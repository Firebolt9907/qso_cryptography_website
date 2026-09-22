/**
 * QSO Cryptography Lab — Core Engine
 * Interactive Secure Messaging, Packet Routing, Interception & Cryptanalysis
 */

// ============================================================================
// Global State & Configuration
// ============================================================================
const state = {
  soundEnabled: true,
  transitSpeedMs: 1000,
  interceptMode: 'passive', // 'passive' | 'active' | 'bypass'
  packetCounter: 100,
  activeTrappedPacket: null,
  isTransmitting: false,
  allPackets: new Map(), // id -> packet
  aliceSent: [],
  eveIntercepted: [],
  bobInbox: []
};

// ============================================================================
// Web Audio API Synthesizer (Zero External Dependencies)
// ============================================================================
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq, type, duration, gainVal = 0.15) {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.debug('Audio error:', e);
  }
}

function soundTxChirp() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) {}
}

function soundInterceptAlert() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Two-tone warning beep
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(740, now);
    osc1.frequency.setValueAtTime(580, now + 0.1);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.linearRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);
  } catch (e) {}
}

function soundDeliveryPing() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.setValueAtTime(1046.50, now + 0.16); // C6
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
}

function soundTamperAlarm() {
  if (!state.soundEnabled) return;
  playTone(220, 'sawtooth', 0.35, 0.2);
}

function soundDropDissipate() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {}
}

// ============================================================================
// Cryptography Implementations
// ============================================================================

// 1. SHA-256 Checksum / Hash (Hardware Web Crypto + Universal Fallback)
function sha256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  let i, j;
  let result = '';
  const words = [];
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let compositeChar = '';
  for (let c = 0; c < ascii.length; c++) {
    const code = ascii.charCodeAt(c);
    if (code < 128) {
      compositeChar += String.fromCharCode(code);
    } else if (code < 2048) {
      compositeChar += String.fromCharCode((code >> 6) | 192, (code & 63) | 128);
    } else {
      compositeChar += String.fromCharCode((code >> 12) | 224, ((code >> 6) & 63) | 128, (code & 63) | 128);
    }
  }

  const bitLength = compositeChar.length * 8;
  for (i = 0; i < compositeChar.length; i++) {
    words[i >> 2] |= (compositeChar.charCodeAt(i) & 0xff) << ((3 - (i % 4)) * 8);
  }
  words[bitLength >> 5] |= 0x80 << ((3 - ((bitLength >> 3) % 4)) * 8);
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  const w = new Array(64);
  for (i = 0; i < words.length; i += 16) {
    const s = hash.slice(0);
    for (j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] | 0;
      } else {
        const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
      }
      const ch = (s[4] & s[5]) ^ (~s[4] & s[6]);
      const maj = (s[0] & s[1]) ^ (s[0] & s[2]) ^ (s[1] & s[2]);
      const sigma0 = rightRotate(s[0], 2) ^ rightRotate(s[0], 13) ^ rightRotate(s[0], 22);
      const sigma1 = rightRotate(s[4], 6) ^ rightRotate(s[4], 11) ^ rightRotate(s[4], 25);
      const temp1 = (s[7] + sigma1 + ch + k[j] + w[j]) | 0;
      const temp2 = (sigma0 + maj) | 0;

      s[7] = s[6];
      s[6] = s[5];
      s[5] = s[4];
      s[4] = (s[3] + temp1) | 0;
      s[3] = s[2];
      s[2] = s[1];
      s[1] = s[0];
      s[0] = (temp1 + temp2) | 0;
    }
    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + s[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

async function computeSha256(text) {
  if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
    try {
      const enc = new TextEncoder();
      const data = enc.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {}
  }
  return sha256Sync(text);
}

// 2. Caesar Substitution Cipher
function caesarCipher(str, shift) {
  const s = ((shift % 26) + 26) % 26;
  return str.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + s) % 26) + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + s) % 26) + 97);
    }
    return char;
  }).join('');
}

// Frequency Analysis & English scoring for cracking Caesar
const COMMON_ENGLISH_WORDS = ['the', 'and', 'to', 'of', 'in', 'is', 'that', 'for', 'you', 'it', 'on', 'with', 'at', 'by', 'this', 'be', 'are', 'from', 'or', 'have', 'coordinates', 'sector', 'signal', 'code', 'qso', 'plan', 'secret'];

function caesarCrack(ciphertext) {
  const results = [];
  for (let shift = 1; shift < 26; shift++) {
    const candidate = caesarCipher(ciphertext, 26 - shift);
    const lower = candidate.toLowerCase();
    
    // Score based on word matches and vowel ratio
    let score = 0;
    COMMON_ENGLISH_WORDS.forEach(word => {
      const regex = new RegExp('\\b' + word + '\\b', 'gi');
      const matches = lower.match(regex);
      if (matches) score += matches.length * 15;
    });

    // Vowel count heuristic
    const vowels = (lower.match(/[aeiou]/g) || []).length;
    const letters = (lower.match(/[a-z]/g) || []).length;
    if (letters > 0) {
      const vowelRatio = vowels / letters;
      if (vowelRatio >= 0.3 && vowelRatio <= 0.45) score += 10;
    }

    results.push({ shift, candidate, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// 3. XOR Stream Cipher (Returns Hex)
function xorEncrypt(text, key) {
  if (!key) key = 'KEY';
  let hexOut = '';
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const xorVal = charCode ^ keyChar;
    hexOut += xorVal.toString(16).padStart(2, '0');
  }
  return hexOut;
}

function xorDecrypt(hexText, key) {
  if (!key) key = 'KEY';
  let plain = '';
  const cleanHex = hexText.replace(/[^0-9a-fA-F]/g, '');
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substr(i, 2), 16);
    const keyChar = key.charCodeAt((i / 2) % key.length);
    plain += String.fromCharCode(byte ^ keyChar);
  }
  return plain;
}

// 4. Modern AES-256-GCM with Authenticated Encryption
async function deriveAesKey(passphrase) {
  const enc = new TextEncoder();
  const passKey = enc.encode(passphrase);
  const hash = await crypto.subtle.digest('SHA-256', passKey);
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function aesGcmEncrypt(plaintext, passphrase) {
  if (window.crypto && window.crypto.subtle && window.crypto.subtle.encrypt) {
    try {
      const cryptoKey = await deriveAesKey(passphrase);
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for GCM
      const enc = new TextEncoder();
      const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        enc.encode(plaintext)
      );

      const ivBase64 = arrayBufferToBase64(iv);
      const ctBase64 = arrayBufferToBase64(ciphertextBuffer);
      return `ENC:AES-GCM:${ivBase64}:${ctBase64}`;
    } catch (e) {
      console.warn('SubtleCrypto error, falling back to authenticated simulation:', e);
    }
  }

  // Universal authenticated cipher fallback (works even on restricted file:// contexts)
  const ivBytes = Array.from({ length: 12 }, () => Math.floor(Math.random() * 256));
  const ivBase64 = window.btoa(String.fromCharCode(...ivBytes));
  const xorPart = xorEncrypt(plaintext, passphrase + ivBase64);
  const authTag = sha256Sync(xorPart + passphrase).substring(0, 32);
  return `ENC:AES-GCM-SIM:${ivBase64}:${xorPart}:${authTag}`;
}

async function aesGcmDecrypt(wirePayload, passphrase) {
  if (wirePayload.startsWith('ENC:AES-GCM-SIM:')) {
    const parts = wirePayload.split(':');
    const ivBase64 = parts[2];
    const xorPart = parts[3];
    const authTag = parts[4];
    const expectedTag = sha256Sync(xorPart + passphrase).substring(0, 32);
    if (authTag !== expectedTag) {
      throw new Error('AEAD Authentication Tag Mismatch: Message or tag was modified in transit!');
    }
    return xorDecrypt(xorPart, passphrase + ivBase64);
  }

  if (!wirePayload.startsWith('ENC:AES-GCM:')) {
    throw new Error('Not an AES-GCM wire package.');
  }

  const parts = wirePayload.split(':');
  if (parts.length < 4) {
    throw new Error('Malformed AES-GCM package header.');
  }
  const ivBase64 = parts[2];
  const ctBase64 = parts[3];

  const cryptoKey = await deriveAesKey(passphrase);
  const iv = base64ToArrayBuffer(ivBase64);
  const ctBuffer = base64ToArrayBuffer(ctBase64);

  const decBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    cryptoKey,
    ctBuffer
  );

  const dec = new TextDecoder();
  return dec.decode(decBuffer);
}

// ============================================================================
// UI Elements & References
// ============================================================================
const dom = {
  scenarioSelect: document.getElementById('scenarioSelect'),
  speedSelect: document.getElementById('speedSelect'),
  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundIcon: document.getElementById('soundIcon'),
  soundLabel: document.getElementById('soundLabel'),
  resetAllBtn: document.getElementById('resetAllBtn'),

  // Wire Visualizer
  wireTrack: document.getElementById('wireTrack'),
  flyingPacket: document.getElementById('flyingPacket'),
  flyingPacketTag: document.getElementById('flyingPacketTag'),
  wireStatusPill: document.getElementById('wireStatusPill'),
  eveTrapZone: document.getElementById('eveTrapZone'),

  // Alice
  aliceRecipient: document.getElementById('aliceRecipient'),
  alicePlaintext: document.getElementById('alicePlaintext'),
  cryptoMethod: document.getElementById('cryptoMethod'),
  caesarConfig: document.getElementById('caesarConfig'),
  caesarShift: document.getElementById('caesarShift'),
  caesarShiftVal: document.getElementById('caesarShiftVal'),
  xorConfig: document.getElementById('xorConfig'),
  xorKey: document.getElementById('xorKey'),
  aesConfig: document.getElementById('aesConfig'),
  aesKey: document.getElementById('aesKey'),
  randomizeKeyBtn: document.getElementById('randomizeKeyBtn'),
  attachChecksum: document.getElementById('attachChecksum'),
  aliceWirePreview: document.getElementById('aliceWirePreview'),
  transmitBtn: document.getElementById('transmitBtn'),
  aliceSentCount: document.getElementById('aliceSentCount'),
  aliceSentList: document.getElementById('aliceSentList'),

  // Eve
  eveStatusTag: document.getElementById('eveStatusTag'),
  interceptModeRadios: document.querySelectorAll('input[name="interceptMode"]'),
  trappedPacketPanel: document.getElementById('trappedPacketPanel'),
  trappedRecipientBadge: document.getElementById('trappedRecipientBadge'),
  trapPktId: document.getElementById('trapPktId'),
  trapPktSender: document.getElementById('trapPktSender'),
  trapPktRecipient: document.getElementById('trapPktRecipient'),
  trapPktCipher: document.getElementById('trapPktCipher'),
  trapRawPayload: document.getElementById('trapRawPayload'),
  eveDecipherStatus: document.getElementById('eveDecipherStatus'),
  evePlaintextResultBox: document.getElementById('evePlaintextResultBox'),
  tamperPayloadInput: document.getElementById('tamperPayloadInput'),
  tamperRecipientInput: document.getElementById('tamperRecipientInput'),
  tamperRecomputeChecksum: document.getElementById('tamperRecomputeChecksum'),
  forwardOriginalBtn: document.getElementById('forwardOriginalBtn'),
  tamperAndForwardBtn: document.getElementById('tamperAndForwardBtn'),
  dropPacketBtn: document.getElementById('dropPacketBtn'),
  spoofSender: document.getElementById('spoofSender'),
  spoofRecipient: document.getElementById('spoofRecipient'),
  spoofMessage: document.getElementById('spoofMessage'),
  injectSpoofedBtn: document.getElementById('injectSpoofedBtn'),
  eveInterceptCount: document.getElementById('eveInterceptCount'),
  eveInterceptList: document.getElementById('eveInterceptList'),

  // Bob
  bobKeyInput: document.getElementById('bobKeyInput'),
  bobInboxCount: document.getElementById('bobInboxCount'),
  bobInboxList: document.getElementById('bobInboxList'),
  bobReplyText: document.getElementById('bobReplyText'),
  bobReplyBtn: document.getElementById('bobReplyBtn'),

  // Tabs & Modals
  tabButtons: document.querySelectorAll('.tab-btn'),
  stationCards: document.querySelectorAll('.station-card'),
  packetModal: document.getElementById('packetModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  closeModalBtn: document.getElementById('closeModalBtn')
};

// ============================================================================
// Core Packet Generation & Encryption Helper
// ============================================================================
async function buildPacket({ from, to, plaintext, method, key, attachChecksum }) {
  state.packetCounter++;
  const id = `PKT-${state.packetCounter}`;
  let wirePayload = '';
  let cipherKeyUsed = key;

  if (method === 'none') {
    wirePayload = plaintext;
  } else if (method === 'caesar') {
    const shift = parseInt(key, 10) || 7;
    wirePayload = caesarCipher(plaintext, shift);
    cipherKeyUsed = shift;
  } else if (method === 'xor') {
    wirePayload = xorEncrypt(plaintext, key);
  } else if (method === 'aes') {
    wirePayload = await aesGcmEncrypt(plaintext, key);
  }

  let checksum = null;
  if (attachChecksum) {
    checksum = await computeSha256(wirePayload);
  }

  return {
    id,
    timestamp: new Date(),
    from,
    to,
    originalPlaintext: plaintext,
    method,
    key: cipherKeyUsed,
    wirePayload,
    hasChecksum: attachChecksum,
    originalChecksum: checksum,
    checksum,
    tampered: false,
    interceptedByEve: false,
    status: 'created'
  };
}

// Live update of Alice's preview
async function updateAlicePreview() {
  const plaintext = dom.alicePlaintext.value;
  const method = dom.cryptoMethod.value;
  let key = '';

  if (method === 'caesar') key = dom.caesarShift.value;
  else if (method === 'xor') key = dom.xorKey.value;
  else if (method === 'aes') key = dom.aesKey.value;

  try {
    if (method === 'none') {
      dom.aliceWirePreview.textContent = plaintext || '[Empty]';
    } else if (method === 'caesar') {
      dom.aliceWirePreview.textContent = caesarCipher(plaintext, parseInt(key, 10) || 7);
    } else if (method === 'xor') {
      dom.aliceWirePreview.textContent = xorEncrypt(plaintext, key) || '[XOR Hex Output]';
    } else if (method === 'aes') {
      dom.aliceWirePreview.textContent = `ENC:AES-GCM:[Random 12-byte IV]:[Encrypted Ciphertext + 128-bit Auth Tag]`;
    }
  } catch (err) {
    dom.aliceWirePreview.textContent = 'Error computing preview.';
  }
}

// ============================================================================
// Transmission & Wire Animation Pipeline
// ============================================================================
async function transmitPacket(packet, direction = 'alice_to_bob') {
  if (state.isTransmitting) {
    alert('A packet is already in transit. Please wait or resolve the held packet.');
    return;
  }

  state.isTransmitting = true;
  state.allPackets.set(packet.id, packet);

  // Log in sender station
  if (packet.from.toLowerCase().includes('alice')) {
    state.aliceSent.unshift(packet);
    renderAliceSent();
  }

  // Update wire status
  setWireStatus(`TRANSMITTING ${packet.id} FROM ${packet.from.toUpperCase()}...`, 'transmitting');
  soundTxChirp();

  // Position setup for animation
  const flying = dom.flyingPacket;
  const flyingTag = dom.flyingPacketTag;
  flying.classList.remove('hidden', 'trapped', 'tampered');
  flyingTag.textContent = packet.id;

  const speed = state.transitSpeedMs;

  if (direction === 'alice_to_bob') {
    // Start at Alice (4%)
    flying.style.transition = 'none';
    flying.style.left = '4%';

    // Animate to Interceptor (Eve at 50%)
    await wait(30);
    flying.style.transition = `left ${speed / 2}ms linear`;
    flying.style.left = '50%';

    await wait(speed / 2);

    // ========================================================================
    // Packet arrives at Eve's wiretap point!
    // ========================================================================
    if (state.interceptMode === 'passive') {
      // Eve silently captures a copy
      handleEvePassiveIntercept(packet);
      setWireStatus(`WIRETAP: Eve copied ${packet.id} (Passive). Continuing to ${packet.to}...`, 'transmitting');

      // Continue to Bob (96%)
      flying.style.transition = `left ${speed / 2}ms linear`;
      flying.style.left = '96%';
      await wait(speed / 2);

      // Packet delivered to recipient
      deliverPacketToRecipient(packet);
      finishTransmission();

    } else if (state.interceptMode === 'active') {
      // Eve traps the packet on the wire!
      flying.classList.add('trapped');
      soundInterceptAlert();
      setWireStatus(`🚨 ALERT: ${packet.id} TRAPPED IN TRANSIT BY EVE!`, 'trapped');
      handleEveActiveTrap(packet);
      // Wait for Eve's user action: forward, tamper, or drop!

    } else {
      // Bypass mode
      setWireStatus(`PACKET IN TRANSIT TO ${packet.to.toUpperCase()}...`, 'transmitting');
      flying.style.transition = `left ${speed / 2}ms linear`;
      flying.style.left = '96%';
      await wait(speed / 2);
      deliverPacketToRecipient(packet);
      finishTransmission();
    }

  } else if (direction === 'bob_to_alice') {
    // Reverse direction (Bob replying to Alice)
    flying.style.transition = 'none';
    flying.style.left = '96%';

    await wait(30);
    flying.style.transition = `left ${speed / 2}ms linear`;
    flying.style.left = '50%';
    await wait(speed / 2);

    if (state.interceptMode === 'passive') {
      handleEvePassiveIntercept(packet);
      flying.style.transition = `left ${speed / 2}ms linear`;
      flying.style.left = '4%';
      await wait(speed / 2);
      handleAliceReceivedAck(packet);
      finishTransmission();
    } else if (state.interceptMode === 'active') {
      flying.classList.add('trapped');
      soundInterceptAlert();
      setWireStatus(`🚨 ALERT: Reply ${packet.id} TRAPPED IN TRANSIT BY EVE!`, 'trapped');
      handleEveActiveTrap(packet);
    } else {
      flying.style.transition = `left ${speed / 2}ms linear`;
      flying.style.left = '4%';
      await wait(speed / 2);
      handleAliceReceivedAck(packet);
      finishTransmission();
    }
  }
}

function finishTransmission() {
  state.isTransmitting = false;
  setTimeout(() => {
    dom.flyingPacket.classList.add('hidden');
    setWireStatus('WIRE IDLE: Channel Clear', 'idle');
  }, 1200);
}

function setWireStatus(text, type = 'idle') {
  dom.wireStatusPill.textContent = text;
  dom.wireStatusPill.className = `wire-status-pill ${type}`;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Eve Interceptor Logic: Passive & Active
// ============================================================================
function handleEvePassiveIntercept(packet) {
  packet.interceptedByEve = true;
  playTone(880, 'sine', 0.08, 0.08); // Subtle wiretap blip
  state.eveIntercepted.unshift({ ...packet, interceptType: 'Passive Sniff' });
  renderEveInterceptList();
}

async function handleEveActiveTrap(packet) {
  state.activeTrappedPacket = packet;
  packet.interceptedByEve = true;

  // Reveal trapped panel
  dom.trappedPacketPanel.classList.remove('hidden');
  dom.trappedRecipientBadge.textContent = packet.to;
  dom.trapPktId.textContent = packet.id;
  dom.trapPktSender.textContent = packet.from;
  dom.trapPktRecipient.textContent = packet.to;
  dom.trapPktCipher.textContent = packet.method.toUpperCase();
  dom.trapRawPayload.textContent = packet.wirePayload;

  // Pre-fill tamper box
  dom.tamperPayloadInput.value = packet.wirePayload;
  dom.tamperRecipientInput.value = packet.to === 'Bob' ? 'Bob' : (packet.to === 'Alice' ? 'Alice' : 'Charlie');
  dom.tamperRecomputeChecksum.checked = false;

  // Perform cryptanalysis for Eve's workbench
  await performEveCryptanalysis(packet);

  // Add to Eve's logs
  state.eveIntercepted.unshift({ ...packet, interceptType: 'Trapped (MitM)' });
  renderEveInterceptList();
}

async function performEveCryptanalysis(packet) {
  const resultBox = dom.evePlaintextResultBox;
  resultBox.innerHTML = '';
  const statusBadge = dom.eveDecipherStatus;

  if (packet.method === 'none') {
    statusBadge.textContent = 'CLEARTEXT LEAK';
    statusBadge.className = 'mono-badge pill-danger';
    resultBox.innerHTML = `
      <div class="analysis-match-success">
        <strong>⚠️ Unencrypted Transmission!</strong><br>
        Eve can directly read the full message without cracking any key:<br>
        <span class="plain-val" style="font-size: 0.9rem;">"${escapeHtml(packet.wirePayload)}"</span>
      </div>
    `;
  } else if (packet.method === 'caesar') {
    statusBadge.textContent = 'CRACKING CAESAR...';
    const cracks = caesarCrack(packet.wirePayload);
    const topGuess = cracks[0];

    statusBadge.textContent = `CRACKED (Shift: ${topGuess.shift})`;
    statusBadge.className = 'mono-badge pill-warning';

    resultBox.innerHTML = `
      <div class="analysis-match-success">
        <strong>🔓 Caesar Cipher Broken via Frequency Analysis!</strong><br>
        <span>Top Shift Detected: <strong>Shift ${topGuess.shift}</strong> (Score: ${topGuess.score})</span><br>
        <span>Deciphered Plaintext:</span><br>
        <div class="plain-val" style="margin-top: 4px;">"${escapeHtml(topGuess.candidate)}"</div>
      </div>
      <details style="margin-top: 6px; font-size: 0.72rem; color: #94a3b8;">
        <summary style="cursor: pointer;">View all 25 shift attempts</summary>
        <div style="max-height: 120px; overflow-y: auto; background: #070a12; padding: 4px; margin-top: 4px; border-radius: 4px;">
          ${cracks.map(c => `<div>Shift ${c.shift}: ${escapeHtml(c.candidate)}</div>`).join('')}
        </div>
      </details>
    `;
  } else if (packet.method === 'xor') {
    statusBadge.textContent = 'XOR STREAM DETECTED';
    statusBadge.className = 'mono-badge pill-warning';
    
    // Test if common key works
    const testKeys = ['KEY', 'SECRET', 'PASSWORD', 'CRYPTO', 'CRYPTO2026', 'ADMIN'];
    let foundKey = null;
    let decodedText = '';

    for (const tk of testKeys) {
      const dec = xorDecrypt(packet.wirePayload, tk);
      if (COMMON_ENGLISH_WORDS.some(w => dec.toLowerCase().includes(w))) {
        foundKey = tk;
        decodedText = dec;
        break;
      }
    }

    if (foundKey) {
      resultBox.innerHTML = `
        <div class="analysis-match-success">
          <strong>🔓 Weak XOR Key Dictionary Crack Success!</strong><br>
          <span>Key found in dictionary: <code>${foundKey}</code></span><br>
          <span class="plain-val">"${escapeHtml(decodedText)}"</span>
        </div>
      `;
    } else {
      resultBox.innerHTML = `
        <div class="analysis-match-fail">
          <strong>🔒 XOR Stream Cipher: Key Unknown</strong><br>
          <span>Raw Hex Bytes: <code>${escapeHtml(packet.wirePayload.substring(0, 40))}...</code></span><br>
          <small>Eve needs the keystream or repeated XOR cribs to decipher.</small>
        </div>
      `;
    }
  } else if (packet.method === 'aes') {
    statusBadge.textContent = 'AES-256-GCM (SECURE)';
    statusBadge.className = 'mono-badge pill-success';

    resultBox.innerHTML = `
      <div class="analysis-match-fail">
        <strong>🛡️ Indistinguishable from Random Noise!</strong><br>
        <span>Protected with 256-bit AES-GCM Authenticated Encryption.</span><br>
        <span>Brute force resistance: 2<sup>256</sup> keys (~10<sup>77</sup> operations). Infeasible to crack without key.</span>
      </div>
    `;
  }
}

// Eve's Action: Forward Unaltered
dom.forwardOriginalBtn.addEventListener('click', async () => {
  if (!state.activeTrappedPacket) return;
  const packet = state.activeTrappedPacket;
  closeTrappedPanel();

  setWireStatus(`Eve released ${packet.id} unaltered to ${packet.to}...`, 'transmitting');
  const speed = state.transitSpeedMs;
  const flying = dom.flyingPacket;
  flying.classList.remove('trapped');

  // Resume to destination
  const targetLeft = packet.to === 'Alice' ? '4%' : '96%';
  flying.style.transition = `left ${speed / 2}ms linear`;
  flying.style.left = targetLeft;

  await wait(speed / 2);
  deliverPacketToRecipient(packet);
  finishTransmission();
});

// Eve's Action: Tamper & Forward (Active MitM Attack)
dom.tamperAndForwardBtn.addEventListener('click', async () => {
  if (!state.activeTrappedPacket) return;
  const packet = state.activeTrappedPacket;

  const modifiedPayload = dom.tamperPayloadInput.value;
  const modifiedRecipient = dom.tamperRecipientInput.value;
  const recomputeHash = dom.tamperRecomputeChecksum.checked;

  packet.tampered = true;
  packet.tamperedBy = 'Eve';
  packet.wirePayload = modifiedPayload;
  packet.to = modifiedRecipient;

  if (recomputeHash) {
    packet.checksum = await computeSha256(modifiedPayload);
    packet.checksumForged = true;
  }

  closeTrappedPanel();
  soundTamperAlarm();

  setWireStatus(`⚠️ TAMPERED PACKET ${packet.id} FORWARDED TO ${packet.to.toUpperCase()}!`, 'tampered');
  const speed = state.transitSpeedMs;
  const flying = dom.flyingPacket;
  flying.classList.remove('trapped');
  flying.classList.add('tampered');

  const targetLeft = packet.to === 'Alice' ? '4%' : '96%';
  flying.style.transition = `left ${speed / 2}ms linear`;
  flying.style.left = targetLeft;

  await wait(speed / 2);
  deliverPacketToRecipient(packet);
  finishTransmission();
});

// Eve's Action: Drop Packet (Denial of Service)
dom.dropPacketBtn.addEventListener('click', () => {
  if (!state.activeTrappedPacket) return;
  const packet = state.activeTrappedPacket;
  packet.status = 'dropped_by_eve';

  closeTrappedPanel();
  soundDropDissipate();

  dom.flyingPacket.classList.add('hidden');
  setWireStatus(`🗑️ PACKET ${packet.id} DROPPED BY EVE! Target will never receive it.`, 'trapped');

  // Update Alice's log to indicate lost packet
  renderAliceSent();
  renderEveInterceptList();

  setTimeout(() => {
    state.isTransmitting = false;
    setWireStatus('WIRE IDLE: Channel Clear', 'idle');
  }, 1500);
});

function closeTrappedPanel() {
  dom.trappedPacketPanel.classList.add('hidden');
  state.activeTrappedPacket = null;
}

// Eve's Action: Inject Spoofed Packet
dom.injectSpoofedBtn.addEventListener('click', async () => {
  const fakeFrom = dom.spoofSender.value.trim() || 'Alice';
  const target = dom.spoofRecipient.value.trim() || 'Bob';
  const message = dom.spoofMessage.value.trim();

  if (!message) {
    alert('Please enter a message to inject.');
    return;
  }

  const packet = await buildPacket({
    from: `${fakeFrom} [SPOOFED BY EVE]`,
    to: target,
    plaintext: message,
    method: 'none',
    key: '',
    attachChecksum: true
  });

  packet.isSpoofed = true;

  // Eve transmits from the wiretap tap (50%) to Bob (96%)
  setWireStatus(`🎭 EVE INJECTED FORGED PACKET ${packet.id} AS ${fakeFrom}!`, 'tampered');
  soundTxChirp();

  state.allPackets.set(packet.id, packet);
  state.eveIntercepted.unshift({ ...packet, interceptType: 'Injected Spoof' });
  renderEveInterceptList();

  const speed = state.transitSpeedMs;
  const flying = dom.flyingPacket;
  flying.classList.remove('hidden', 'trapped');
  flying.classList.add('tampered');
  dom.flyingPacketTag.textContent = packet.id;

  flying.style.transition = 'none';
  flying.style.left = '50%';

  await wait(30);
  flying.style.transition = `left ${speed / 2}ms linear`;
  flying.style.left = '96%';

  await wait(speed / 2);
  deliverPacketToRecipient(packet);
  finishTransmission();
});

// ============================================================================
// Bob (Recipient) Processing & Decryption
// ============================================================================
async function deliverPacketToRecipient(packet) {
  // Check destination
  const isMeantForBob = packet.to.toLowerCase().includes('bob') || packet.to === 'Broadcast';

  if (!isMeantForBob) {
    // Packet delivered to someone else (e.g. Charlie)
    soundDeliveryPing();
    setWireStatus(`PACKET ${packet.id} DELIVERED TO ${packet.to.toUpperCase()} (NOT BOB)`, 'delivered');
    return;
  }

  // Bob processes packet
  packet.status = 'received_by_bob';

  // 1. Verify Integrity Checksum
  let integrityStatus = 'none'; // 'pass' | 'fail' | 'forged' | 'none'
  if (packet.hasChecksum) {
    const calculatedChecksum = await computeSha256(packet.wirePayload);
    if (calculatedChecksum === packet.checksum) {
      if (packet.tampered && packet.checksumForged) {
        integrityStatus = 'forged'; // Hash matches forged hash!
      } else {
        integrityStatus = 'pass';
      }
    } else {
      integrityStatus = 'fail';
    }
  }

  // 2. Decrypt Payload
  let decryptedText = '';
  let decryptError = null;

  try {
    if (packet.method === 'none') {
      decryptedText = packet.wirePayload;
    } else if (packet.method === 'caesar') {
      const shift = parseInt(packet.key, 10) || 7;
      decryptedText = caesarCipher(packet.wirePayload, 26 - shift);
    } else if (packet.method === 'xor') {
      const bobKey = dom.bobKeyInput.value.trim();
      decryptedText = xorDecrypt(packet.wirePayload, bobKey);
    } else if (packet.method === 'aes') {
      const bobKey = dom.bobKeyInput.value.trim();
      decryptedText = await aesGcmDecrypt(packet.wirePayload, bobKey);
    }
  } catch (err) {
    decryptError = err.message || 'Decryption failed: Ciphertext or Auth Tag corrupted!';
  }

  packet.bobProcessed = {
    decryptedText,
    decryptError,
    integrityStatus
  };

  state.bobInbox.unshift(packet);
  renderBobInbox();

  // Play appropriate sound feedback
  if (decryptError || integrityStatus === 'fail') {
    soundTamperAlarm();
    setWireStatus(`⚠️ BOB RECEIVED ${packet.id}: INTEGRITY OR DECRYPTION ALERT!`, 'tampered');
  } else {
    soundDeliveryPing();
    setWireStatus(`✅ BOB RECEIVED ${packet.id} SUCCESSFULLY`, 'delivered');
  }
}

function handleAliceReceivedAck(packet) {
  soundDeliveryPing();
  setWireStatus(`ALICE RECEIVED ACKNOWLEDGMENT FROM ${packet.from.toUpperCase()}`, 'delivered');
  renderAliceSent();
}

// ============================================================================
// Bob Quick Reply
// ============================================================================
dom.bobReplyBtn.addEventListener('click', async () => {
  const replyText = dom.bobReplyText.value.trim();
  if (!replyText) return;

  const packet = await buildPacket({
    from: 'Bob',
    to: 'Alice',
    plaintext: replyText,
    method: 'none',
    key: '',
    attachChecksum: true
  });

  transmitPacket(packet, 'bob_to_alice');
});

// ============================================================================
// Rendering Functions
// ============================================================================
function renderAliceSent() {
  dom.aliceSentCount.textContent = `${state.aliceSent.length} sent`;
  const list = dom.aliceSentList;

  if (state.aliceSent.length === 0) {
    list.innerHTML = '<div class="empty-state">No packets transmitted yet.</div>';
    return;
  }

  list.innerHTML = state.aliceSent.map(pkt => `
    <div class="packet-card" onclick="viewPacketModal('${pkt.id}')">
      <div class="packet-card-header">
        <span class="packet-pill ${pkt.status === 'dropped_by_eve' ? 'pill-danger' : 'pill-success'}">
          ${pkt.id} ➔ ${escapeHtml(pkt.to)}
        </span>
        <span>${formatTime(pkt.timestamp)}</span>
      </div>
      <div class="packet-content-box">
        <div class="plain-val">"${escapeHtml(pkt.originalPlaintext)}"</div>
        <div class="helper-text" style="margin-top: 3px;">Method: <strong>${pkt.method.toUpperCase()}</strong></div>
      </div>
      ${pkt.status === 'dropped_by_eve' ? `
        <div class="integrity-banner integrity-fail">
          ⚠️ Delivery Failed: Dropped in transit!
        </div>
      ` : ''}
    </div>
  `).join('');
}

function renderEveInterceptList() {
  dom.eveInterceptCount.textContent = `${state.eveIntercepted.length} captured`;
  const list = dom.eveInterceptList;

  if (state.eveIntercepted.length === 0) {
    list.innerHTML = '<div class="empty-state">No transmissions intercepted yet.</div>';
    return;
  }

  list.innerHTML = state.eveIntercepted.map(pkt => `
    <div class="packet-card" onclick="viewPacketModal('${pkt.id}')">
      <div class="packet-card-header">
        <span class="packet-pill ${pkt.tampered ? 'pill-warning' : 'pill-danger'}">
          ${pkt.id} [${escapeHtml(pkt.from)} ➔ ${escapeHtml(pkt.to)}]
        </span>
        <span class="mono-badge" style="font-size: 0.65rem;">${pkt.interceptType || 'Intercepted'}</span>
      </div>
      <div class="packet-content-box">
        <div class="cipher-val">${escapeHtml(pkt.wirePayload.substring(0, 60))}${pkt.wirePayload.length > 60 ? '...' : ''}</div>
      </div>
      ${pkt.tampered ? `
        <div class="integrity-banner integrity-warning">
          ✂️ Tampered by Eve before forwarding
        </div>
      ` : ''}
    </div>
  `).join('');
}

function renderBobInbox() {
  dom.bobInboxCount.textContent = `${state.bobInbox.length} received`;
  const list = dom.bobInboxList;

  if (state.bobInbox.length === 0) {
    list.innerHTML = '<div class="empty-state">Inbox is empty. Waiting for packets on the wire...</div>';
    return;
  }

  list.innerHTML = state.bobInbox.map(pkt => {
    const proc = pkt.bobProcessed || {};
    let integrityBannerHtml = '';

    if (proc.integrityStatus === 'pass') {
      integrityBannerHtml = `
        <div class="integrity-banner integrity-pass">
          ✅ INTEGRITY VERIFIED: Checksum matches. Message untampered.
        </div>
      `;
    } else if (proc.integrityStatus === 'fail') {
      integrityBannerHtml = `
        <div class="integrity-banner integrity-fail">
          🚨 INTEGRITY BREACH: Checksum mismatch! Message was altered in transit!
        </div>
      `;
    } else if (proc.integrityStatus === 'forged') {
      integrityBannerHtml = `
        <div class="integrity-banner integrity-warning">
          ⚠️ Checksum matches modified payload (Attacker forged the checksum!).
        </div>
      `;
    }

    let decryptBannerHtml = '';
    if (proc.decryptError) {
      decryptBannerHtml = `
        <div class="integrity-banner integrity-fail" style="margin-top: 4px;">
          ❌ Decryption Failed: ${escapeHtml(proc.decryptError)}
        </div>
      `;
    }

    return `
      <div class="packet-card" onclick="viewPacketModal('${pkt.id}')">
        <div class="packet-card-header">
          <span class="packet-pill ${proc.decryptError || proc.integrityStatus === 'fail' ? 'pill-danger' : 'pill-success'}">
            ${pkt.id} from ${escapeHtml(pkt.from)}
          </span>
          <span>${formatTime(pkt.timestamp)}</span>
        </div>
        <div class="packet-content-box">
          ${proc.decryptError ? `
            <div class="cipher-val">Raw Ciphertext: ${escapeHtml(pkt.wirePayload.substring(0, 50))}...</div>
          ` : `
            <div class="plain-val">"${escapeHtml(proc.decryptedText || pkt.wirePayload)}"</div>
          `}
        </div>
        ${integrityBannerHtml}
        ${decryptBannerHtml}
      </div>
    `;
  }).join('');
}

// ============================================================================
// Detailed Packet Inspection Modal
// ============================================================================
window.viewPacketModal = function(id) {
  const pkt = state.allPackets.get(id);
  if (!pkt) return;

  dom.modalTitle.textContent = `Detailed Packet Inspection — ${pkt.id}`;
  dom.modalBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div class="inspector-meta-grid">
        <div><strong>Packet ID:</strong> <code>${pkt.id}</code></div>
        <div><strong>Timestamp:</strong> <span>${formatTime(pkt.timestamp)}</span></div>
        <div><strong>Declared Sender:</strong> <code>${escapeHtml(pkt.from)}</code></div>
        <div><strong>Target Recipient:</strong> <code>${escapeHtml(pkt.to)}</code></div>
        <div><strong>Cipher Method:</strong> <span class="mono-badge">${pkt.method.toUpperCase()}</span></div>
        <div><strong>Tampered in Transit:</strong> <span class="${pkt.tampered ? 'pill-danger' : 'pill-success'} mono-badge">${pkt.tampered ? 'YES' : 'NO'}</span></div>
      </div>

      <div>
        <label style="font-size: 0.75rem; color: #94a3b8; font-weight: bold;">Wire Payload (Transmitted Bytes / Text):</label>
        <div class="mono-display break-all" style="margin-top: 4px;">${escapeHtml(pkt.wirePayload)}</div>
      </div>

      ${pkt.originalPlaintext ? `
        <div>
          <label style="font-size: 0.75rem; color: #94a3b8; font-weight: bold;">Alice's Original Plaintext:</label>
          <div class="mono-display" style="color: #4ade80; margin-top: 4px;">"${escapeHtml(pkt.originalPlaintext)}"</div>
        </div>
      ` : ''}

      <div>
        <label style="font-size: 0.75rem; color: #94a3b8; font-weight: bold;">SHA-256 Checksum Signature:</label>
        <div class="mono-display break-all" style="color: #38bdf8; font-size: 0.72rem; margin-top: 4px;">
          ${pkt.checksum || 'None attached'}
        </div>
      </div>

      ${pkt.bobProcessed ? `
        <div>
          <label style="font-size: 0.75rem; color: #94a3b8; font-weight: bold;">Bob's Processing Verdict:</label>
          <div class="mono-display" style="margin-top: 4px; color: ${pkt.bobProcessed.decryptError ? '#f87171' : '#f8fafc'};">
            ${pkt.bobProcessed.decryptError ? `Error: ${escapeHtml(pkt.bobProcessed.decryptError)}` : `Decrypted Plaintext: "${escapeHtml(pkt.bobProcessed.decryptedText)}"`}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  dom.packetModal.classList.remove('hidden');
};

dom.closeModalBtn.addEventListener('click', () => {
  dom.packetModal.classList.add('hidden');
});

dom.packetModal.addEventListener('click', (e) => {
  if (e.target === dom.packetModal) {
    dom.packetModal.classList.add('hidden');
  }
});

// ============================================================================
// Event Listeners & UI Binding
// ============================================================================

// Transmit Button
dom.transmitBtn.addEventListener('click', async () => {
  const plaintext = dom.alicePlaintext.value.trim();
  if (!plaintext) {
    alert('Please enter a message to transmit.');
    return;
  }

  const to = dom.aliceRecipient.value;
  const method = dom.cryptoMethod.value;
  let key = '';

  if (method === 'caesar') key = dom.caesarShift.value;
  else if (method === 'xor') key = dom.xorKey.value;
  else if (method === 'aes') key = dom.aesKey.value;

  const attachChecksum = dom.attachChecksum.checked;

  const packet = await buildPacket({
    from: 'Alice',
    to,
    plaintext,
    method,
    key,
    attachChecksum
  });

  transmitPacket(packet, 'alice_to_bob');
});

// Quick Sample Buttons
document.querySelectorAll('.badge-action').forEach(btn => {
  btn.addEventListener('click', () => {
    dom.alicePlaintext.value = btn.getAttribute('data-sample');
    updateAlicePreview();
  });
});

// Cipher Switcher in Alice
dom.cryptoMethod.addEventListener('change', () => {
  const method = dom.cryptoMethod.value;
  dom.caesarConfig.classList.add('hidden');
  dom.xorConfig.classList.add('hidden');
  dom.aesConfig.classList.add('hidden');

  if (method === 'caesar') dom.caesarConfig.classList.remove('hidden');
  else if (method === 'xor') dom.xorConfig.classList.remove('hidden');
  else if (method === 'aes') dom.aesConfig.classList.remove('hidden');

  updateAlicePreview();
});

dom.caesarShift.addEventListener('input', () => {
  dom.caesarShiftVal.textContent = `Shift: ${dom.caesarShift.value}`;
  updateAlicePreview();
});

dom.xorKey.addEventListener('input', updateAlicePreview);
dom.aesKey.addEventListener('input', () => {
  // Synchronize with Bob's default key for convenience
  dom.bobKeyInput.value = dom.aesKey.value;
  updateAlicePreview();
});
dom.alicePlaintext.addEventListener('input', updateAlicePreview);

// Random Key Generator
dom.randomizeKeyBtn.addEventListener('click', () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let randKey = '';
  for (let i = 0; i < 16; i++) {
    randKey += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  dom.aesKey.value = randKey;
  dom.bobKeyInput.value = randKey;
  updateAlicePreview();
});

// Interception Mode Switcher
dom.interceptModeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    state.interceptMode = e.target.value;
    if (state.interceptMode === 'passive') {
      dom.eveStatusTag.textContent = '● PASSIVE SNIFFER';
      dom.eveStatusTag.className = 'station-status-tag spying';
    } else if (state.interceptMode === 'active') {
      dom.eveStatusTag.textContent = '● ACTIVE MITM';
      dom.eveStatusTag.className = 'station-status-tag spying';
    } else {
      dom.eveStatusTag.textContent = '● BYPASS (OFF)';
      dom.eveStatusTag.className = 'station-status-tag online';
    }
  });
});

// Speed Selector
dom.speedSelect.addEventListener('change', () => {
  state.transitSpeedMs = parseInt(dom.speedSelect.value, 10);
});

// Sound Toggle
dom.soundToggleBtn.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  dom.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
  dom.soundLabel.textContent = state.soundEnabled ? 'Audio FX' : 'Muted';
  if (state.soundEnabled) soundTxChirp();
});

// Reset All State
dom.resetAllBtn.addEventListener('click', () => {
  state.packetCounter = 100;
  state.aliceSent = [];
  state.eveIntercepted = [];
  state.bobInbox = [];
  state.allPackets.clear();
  state.isTransmitting = false;
  closeTrappedPanel();
  dom.flyingPacket.classList.add('hidden');
  renderAliceSent();
  renderEveInterceptList();
  renderBobInbox();
  setWireStatus('WIRE IDLE: Channel Clear', 'idle');
});

// View Mode Tabs (for smaller screens or role focusing)
dom.tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    dom.tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.getAttribute('data-target');
    if (target === 'all') {
      dom.stationCards.forEach(card => card.classList.remove('hidden'));
    } else {
      dom.stationCards.forEach(card => {
        if (card.id === target) card.classList.remove('hidden');
        else card.classList.add('hidden');
      });
    }
  });
});

// ============================================================================
// Guided Scenario Presets
// ============================================================================
dom.scenarioSelect.addEventListener('change', () => {
  const val = dom.scenarioSelect.value;
  if (!val) return;

  if (val === 'plaintext') {
    // 1. Plaintext Leak
    dom.aliceRecipient.value = 'Bob';
    dom.alicePlaintext.value = 'Top secret coordinates: Sector 7G at 2200 hrs.';
    dom.cryptoMethod.value = 'none';
    dom.cryptoMethod.dispatchEvent(new Event('change'));
    setInterceptMode('passive');
    alert('Scenario 1 Loaded: Plaintext (No Encryption).\n\nClick "Transmit Packet" to observe how Eve intercepts and reads the entire cleartext message in transit!');

  } else if (val === 'caesar_crack') {
    // 2. Caesar Substitution
    dom.aliceRecipient.value = 'Bob';
    dom.alicePlaintext.value = 'The rendezvous plan is confirmed. Bring the encryption keys.';
    dom.cryptoMethod.value = 'caesar';
    dom.caesarShift.value = 7;
    dom.caesarShiftVal.textContent = 'Shift: 7';
    dom.cryptoMethod.dispatchEvent(new Event('change'));
    setInterceptMode('active');
    alert('Scenario 2 Loaded: Caesar Cipher & Interceptor Crack.\n\nEve is set to Active MitM. Transmit the packet: Eve will trap it, and Eve\'s cryptanalysis workbench will automatically brute-force frequency analysis to crack the shift key!');

  } else if (val === 'mitm_tamper') {
    // 3. MitM Tampering
    dom.aliceRecipient.value = 'Bob';
    dom.alicePlaintext.value = 'Transfer 500 crates of supplies to Safehouse Alpha.';
    dom.cryptoMethod.value = 'none';
    dom.attachChecksum.checked = true;
    dom.cryptoMethod.dispatchEvent(new Event('change'));
    setInterceptMode('active');
    alert('Scenario 3 Loaded: Active Man-in-the-Middle Tampering.\n\nAlice will send an authorized order with a SHA-256 checksum. Eve will trap it in transit, alter the text (e.g. to ambush site), and forward it to Bob. Bob will detect the checksum mismatch alarm!');

  } else if (val === 'aes_secure') {
    // 4. Modern AES-GCM
    dom.aliceRecipient.value = 'Bob';
    dom.alicePlaintext.value = 'Quantum Security Protocol: Node 4 authorized. Key checksum verified.';
    dom.cryptoMethod.value = 'aes';
    dom.aesKey.value = 'SuperSecureSecret2026!';
    dom.bobKeyInput.value = 'SuperSecureSecret2026!';
    dom.attachChecksum.checked = true;
    dom.cryptoMethod.dispatchEvent(new Event('change'));
    setInterceptMode('active');
    alert('Scenario 4 Loaded: Modern Authenticated AES-GCM.\n\nEve receives only high-entropy pseudorandom ciphertext. If Eve tampers with even a single bit and forwards it, AES-GCM\'s AEAD authentication tag will reject the message instantly!');

  } else if (val === 'spoof_inject') {
    // 5. Spoofed Sender Injection
    setInterceptMode('passive');
    const spoofDetails = document.querySelector('.collapsible-spoof');
    if (spoofDetails) spoofDetails.open = true;
    alert('Scenario 5 Loaded: Spoofed Sender Injection.\n\nScroll to Eve\'s Station and expand the "Forge & Inject Spoofed Packet" panel. Eve can pretend to be Alice and send a fraudulent message directly to Bob!');
  }
});

function setInterceptMode(mode) {
  state.interceptMode = mode;
  dom.interceptModeRadios.forEach(r => {
    if (r.value === mode) r.checked = true;
  });
  dom.interceptModeRadios[0].dispatchEvent(new Event('change'));
}

// Utility: Escape HTML
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function formatTime(d) {
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Initial preview
updateAlicePreview();
