/**
 * QSO Quantum Cryptography Lab — UI Controller & Quantum Engine
 * 
 * ----------------------------------------------------------------------------
 * NOTE FOR DEVELOPERS:
 * The quantum physics logic (qubit preparation, Eve's intercept-resend,
 * Bob's measurement, basis sifting, QBER calculation, and OTP encryption)
 * is cleanly decoupled in the `QuantumLogic` object below.
 * You can replace or plug your own quantum simulation / hardware backend into
 * these hook functions!
 * ----------------------------------------------------------------------------
 */

// ============================================================================
// 1. QUANTUM LOGIC HOOKS — PLUG IN YOUR QUANTUM ALGORITHMS HERE
// ============================================================================
const QuantumLogic = {
  /**
   * Alice prepares single photons in random polarization states.
   * Basis: '+' (Rectilinear: 0 = |H⟩, 1 = |V⟩) or '×' (Diagonal: 0 = |↗⟩, 1 = |↘⟩)
   */
  prepareQubits(count = 12) {
    const bases = ['+', '×'];
    const qubits = [];

    for (let i = 0; i < count; i++) {
      const bit = Math.random() < 0.5 ? 0 : 1;
      const basis = bases[Math.floor(Math.random() * bases.length)];
      let symbol = '|H⟩';

      if (basis === '+') {
        symbol = bit === 0 ? '|H⟩' : '|V⟩';
      } else {
        symbol = bit === 0 ? '|↗⟩' : '|↘⟩';
      }

      qubits.push({
        index: i + 1,
        aliceBit: bit,
        aliceBasis: basis,
        aliceSymbol: symbol,
        currentSymbol: symbol,
        collapsedByEve: false
      });
    }
    return qubits;
  },

  /**
   * Eve's Intercept-Resend Attack on the Quantum Optical Fiber.
   * Eve measures each photon. If Eve's basis differs from Alice's,
   * the quantum state collapses into Eve's basis (Heisenberg Uncertainty).
   */
  eveIntercept(qubits, basisStrategy = 'random') {
    return qubits.map(q => {
      let eveBasis = '+';
      if (basisStrategy === 'random') {
        eveBasis = Math.random() < 0.5 ? '+' : '×';
      } else if (basisStrategy === 'diagonal') {
        eveBasis = '×';
      }

      let eveMeasuredBit = 0;
      let newSymbol = q.currentSymbol;
      let stateDisturbed = false;

      if (eveBasis === q.aliceBasis) {
        // Measurement matches Alice's basis: Eve gets deterministic result
        eveMeasuredBit = q.aliceBit;
      } else {
        // Basis mismatch: Quantum state collapses randomly (50/50)!
        eveMeasuredBit = Math.random() < 0.5 ? 0 : 1;
        stateDisturbed = true;
        newSymbol = eveBasis === '+' 
          ? (eveMeasuredBit === 0 ? '|H⟩' : '|V⟩') 
          : (eveMeasuredBit === 0 ? '|↗⟩' : '|↘⟩');
      }

      return {
        ...q,
        eveBasis,
        eveMeasuredBit,
        currentSymbol: newSymbol,
        collapsedByEve: stateDisturbed
      };
    });
  },

  /**
   * Bob measures received photons with his randomly chosen bases.
   */
  bobMeasure(qubits) {
    const bases = ['+', '×'];
    return qubits.map(q => {
      const bobBasis = bases[Math.floor(Math.random() * bases.length)];
      let bobBit = 0;

      // Check if Bob's basis matches the state of the photon arriving at Bob's detector
      const arrivingBasis = q.eveBasis ? q.eveBasis : q.aliceBasis;
      const arrivingBit = q.eveBasis !== undefined ? q.eveMeasuredBit : q.aliceBit;

      if (bobBasis === arrivingBasis) {
        bobBit = arrivingBit;
      } else {
        // Bob measures in incompatible basis: 50% random outcome
        bobBit = Math.random() < 0.5 ? 0 : 1;
      }

      return {
        ...q,
        bobBasis,
        bobBit
      };
    });
  },

  /**
   * Basis Sifting & Quantum Bit Error Rate (QBER) Calculation.
   * Alice & Bob publish their bases, keep matching bases, and check error rate.
   */
  siftAndReconcile(measuredQubits) {
    let siftedBitsAlice = [];
    let siftedBitsBob = [];
    let matchedCount = 0;
    let errorsCount = 0;

    const reconciled = measuredQubits.map(q => {
      const basesMatch = q.aliceBasis === q.bobBasis;
      let hasError = false;

      if (basesMatch) {
        matchedCount++;
        siftedBitsAlice.push(q.aliceBit);
        siftedBitsBob.push(q.bobBit);

        if (q.aliceBit !== q.bobBit) {
          hasError = true;
          errorsCount++;
        }
      }

      return {
        ...q,
        basesMatch,
        hasError,
        siftedBit: basesMatch ? q.aliceBit : null
      };
    });

    const qber = matchedCount > 0 ? (errorsCount / matchedCount) * 100 : 0;
    const isSecure = qber <= 11.0; // Standard BB84 security limit (11% threshold)

    const keyString = isSecure ? siftedBitsAlice.join('') : null;

    return {
      reconciledQubits: reconciled,
      matchedCount,
      errorsCount,
      qber: parseFloat(qber.toFixed(1)),
      isSecure,
      aliceKey: keyString,
      bobKey: keyString
    };
  },

  /**
   * One-Time Pad (OTP) Message Encryption:
   * Ciphertext = Plaintext ⊕ QKD_Key
   */
  encryptOtp(plaintext, qkdKey) {
    if (!qkdKey) throw new Error('No established QKD key available.');
    let hexOut = '';
    for (let i = 0; i < plaintext.length; i++) {
      const charCode = plaintext.charCodeAt(i);
      const keyChar = qkdKey.charCodeAt(i % qkdKey.length);
      const xorVal = charCode ^ keyChar;
      hexOut += xorVal.toString(16).padStart(2, '0');
    }
    return hexOut;
  },

  /**
   * One-Time Pad (OTP) Message Decryption:
   * Plaintext = Ciphertext ⊕ QKD_Key
   */
  decryptOtp(hexCiphertext, qkdKey) {
    if (!qkdKey) throw new Error('No established QKD key available.');
    let plain = '';
    const cleanHex = hexCiphertext.replace(/[^0-9a-fA-F]/g, '');
    for (let i = 0; i < cleanHex.length; i += 2) {
      const byte = parseInt(cleanHex.substr(i, 2), 16);
      const keyChar = qkdKey.charCodeAt((i / 2) % qkdKey.length);
      plain += String.fromCharCode(byte ^ keyChar);
    }
    return plain;
  }
};

// ============================================================================
// 2. UI STATE & SOUND CONTROLLER
// ============================================================================
const state = {
  soundEnabled: true,
  photonCount: 12,
  transitSpeedMs: 900,
  interceptMode: 'passive', // 'passive' | 'active'
  activeTrappedPacket: null,
  isTransmitting: false,
  establishedQkdKey: null,
  qkdAuditRecord: [],
  allPackets: new Map(),
  aliceSent: [],
  eveIntercepted: [],
  bobInbox: []
};

// Web Audio API Synthesizer
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
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
  } catch (e) {}
}

function soundPhotonChirp() {
  playTone(880, 'sine', 0.1, 0.12);
}

function soundQuantumCollapse() {
  playTone(320, 'sawtooth', 0.18, 0.15);
}

function soundTrapAlert() {
  if (!state.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.setValueAtTime(550, now + 0.1);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch (e) {}
}

function soundDeliveryDing() {
  playTone(659.25, 'sine', 0.25, 0.15);
}

function soundTamperAlarm() {
  playTone(180, 'sawtooth', 0.35, 0.2);
}

// ============================================================================
// 3. DOM ELEMENT REFERENCES
// ============================================================================
const dom = {
  // Global
  scenarioSelect: document.getElementById('scenarioSelect'),
  speedSelect: document.getElementById('speedSelect'),
  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundIcon: document.getElementById('soundIcon'),
  soundLabel: document.getElementById('soundLabel'),
  resetAllBtn: document.getElementById('resetAllBtn'),
  wireStatusPill: document.getElementById('wireStatusPill'),

  // Visualizer
  flyingPhoton: document.getElementById('flyingPhoton'),
  flyingPhotonSymbol: document.getElementById('flyingPhotonSymbol'),
  flyingPhotonTag: document.getElementById('flyingPhotonTag'),
  flyingPacket: document.getElementById('flyingPacket'),
  flyingPacketTag: document.getElementById('flyingPacketTag'),
  eveQuantumTapMarker: document.getElementById('eveQuantumTapMarker'),

  // Alice
  photonCountBtns: document.querySelectorAll('.photon-count-btn'),
  runQkdBtn: document.getElementById('runQkdBtn'),
  aliceKeyStatusBadge: document.getElementById('aliceKeyStatusBadge'),
  aliceKeyString: document.getElementById('aliceKeyString'),
  aliceKeyHelper: document.getElementById('aliceKeyHelper'),
  aliceRecipient: document.getElementById('aliceRecipient'),
  aliceMessageText: document.getElementById('aliceMessageText'),
  transmitMessageBtn: document.getElementById('transmitMessageBtn'),
  aliceSentCount: document.getElementById('aliceSentCount'),
  aliceSentList: document.getElementById('aliceSentList'),

  // Eve
  eveStatusTag: document.getElementById('eveStatusTag'),
  eveQuantumTapToggle: document.getElementById('eveQuantumTapToggle'),
  eveBasisStrategy: document.getElementById('eveBasisStrategy'),
  eveQubitCount: document.getElementById('eveQubitCount'),
  eveQubitLog: document.getElementById('eveQubitLog'),
  eveQubitHelper: document.getElementById('eveQubitHelper'),
  interceptModeRadios: document.querySelectorAll('input[name="interceptMode"]'),
  trappedPacketPanel: document.getElementById('trappedPacketPanel'),
  trappedRecipientBadge: document.getElementById('trappedRecipientBadge'),
  trapPktId: document.getElementById('trapPktId'),
  trapPktSender: document.getElementById('trapPktSender'),
  trapPktRecipient: document.getElementById('trapPktRecipient'),
  trapRawPayload: document.getElementById('trapRawPayload'),
  tamperPayloadInput: document.getElementById('tamperPayloadInput'),
  forwardOriginalBtn: document.getElementById('forwardOriginalBtn'),
  tamperAndForwardBtn: document.getElementById('tamperAndForwardBtn'),
  dropPacketBtn: document.getElementById('dropPacketBtn'),
  eveInterceptCount: document.getElementById('eveInterceptCount'),
  eveInterceptList: document.getElementById('eveInterceptList'),

  // Bob
  qberValueBadge: document.getElementById('qberValueBadge'),
  qberBarFill: document.getElementById('qberBarFill'),
  qkdVerdictBanner: document.getElementById('qkdVerdictBanner'),
  bobKeyStatusBadge: document.getElementById('bobKeyStatusBadge'),
  bobKeyString: document.getElementById('bobKeyString'),
  bobKeyHelper: document.getElementById('bobKeyHelper'),
  bobInboxList: document.getElementById('bobInboxList'),
  bobReplyText: document.getElementById('bobReplyText'),
  bobReplyBtn: document.getElementById('bobReplyBtn'),

  // Tabs & Matrix Modal
  tabButtons: document.querySelectorAll('.tab-btn'),
  stationCards: document.querySelectorAll('.station-card'),
  openMatrixBtn: document.getElementById('openMatrixBtn'),
  matrixModal: document.getElementById('matrixModal'),
  closeMatrixBtn: document.getElementById('closeMatrixBtn'),
  qkdMatrixBody: document.getElementById('qkdMatrixBody'),
  packetModal: document.getElementById('packetModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  closeModalBtn: document.getElementById('closeModalBtn')
};

// ============================================================================
// 4. QKD TRANSMISSION & BASIS RECONCILIATION FLOW
// ============================================================================

dom.runQkdBtn.addEventListener('click', async () => {
  if (state.isTransmitting) return;
  state.isTransmitting = true;
  dom.runQkdBtn.disabled = true;

  setWireStatus('EMITTING PHOTONS ALONG QUANTUM OPTICAL FIBER...', 'transmitting');

  // Step A: Alice Prepares Qubits
  const preparedQubits = QuantumLogic.prepareQubits(state.photonCount);

  // Step B: Eve Quantum Wiretap (if active)
  const isEveTapped = dom.eveQuantumTapToggle.checked;
  const eveStrategy = dom.eveBasisStrategy.value;

  let opticalQubits = preparedQubits;
  if (isEveTapped) {
    opticalQubits = QuantumLogic.eveIntercept(preparedQubits, eveStrategy);
  }

  // Step C: Bob Measures
  const measuredQubits = QuantumLogic.bobMeasure(opticalQubits);

  // Animate Quantum Photons on the Fiber
  await animateQuantumFiber(opticalQubits, isEveTapped);

  // Step D: Basis Sifting & QBER Reconciliation
  const result = QuantumLogic.siftAndReconcile(measuredQubits);
  state.qkdAuditRecord = result.reconciledQubits;

  // Update UI with QKD Results
  applyQkdResultsToUi(result, isEveTapped);

  state.isTransmitting = false;
  dom.runQkdBtn.disabled = false;
});

// Photon Animation on Quantum Fiber
async function animateQuantumFiber(qubits, isEveTapped) {
  const flying = dom.flyingPhoton;
  const symbolEl = dom.flyingPhotonSymbol;
  const tagEl = dom.flyingPhotonTag;
  const speed = state.transitSpeedMs;

  flying.classList.remove('hidden', 'collapsed');

  // Sample a few photons to animate visually
  const sampleCount = Math.min(qubits.length, 3);
  for (let i = 0; i < sampleCount; i++) {
    const q = qubits[i];
    symbolEl.textContent = q.aliceSymbol;
    tagEl.textContent = `λ0${q.index}`;
    soundPhotonChirp();

    // Start at Alice (4%)
    flying.style.transition = 'none';
    flying.style.left = '4%';

    await wait(30);
    // Move to Eve (50%)
    flying.style.transition = `left ${speed / 2}ms linear`;
    flying.style.left = '50%';
    await wait(speed / 2);

    if (isEveTapped && q.collapsedByEve) {
      flying.classList.add('collapsed');
      symbolEl.textContent = q.currentSymbol;
      soundQuantumCollapse();
      setWireStatus(`HEISENBERG COLLAPSE! Eve measured λ0${q.index} in ${q.eveBasis} basis`, 'trapped');
      await wait(180);
    }

    // Move to Bob (96%)
    flying.style.transition = `left ${speed / 2}ms linear`;
    flying.style.left = '96%';
    await wait(speed / 2);
  }

  flying.classList.add('hidden');
}

// Update UI with reconciliation results
function applyQkdResultsToUi(result, isEveTapped) {
  const { qber, isSecure, aliceKey, bobKey, reconciledQubits } = result;

  // QBER meter
  dom.qberValueBadge.textContent = `${qber}%`;
  dom.qberBarFill.style.width = `${Math.min(qber * 2, 100)}%`;

  if (isSecure) {
    dom.qberBarFill.className = 'qber-bar-fill';
    dom.qkdVerdictBanner.className = 'qkd-verdict-banner secure';
    dom.qkdVerdictBanner.innerHTML = `
      <span>🛡️ <strong>CHANNEL SECURE!</strong> QBER (${qber}%) &le; 11% threshold.<br>
      No eavesdropping detected. QKD One-Time Pad key certified.</span>
    `;

    state.establishedQkdKey = aliceKey;

    dom.aliceKeyStatusBadge.textContent = 'SECURE KEY';
    dom.aliceKeyStatusBadge.className = 'mono-badge pill-success';
    dom.aliceKeyString.textContent = aliceKey;
    dom.aliceKeyHelper.textContent = `${aliceKey.length}-bit One-Time Pad ready for secure messaging.`;

    dom.bobKeyStatusBadge.textContent = 'SECURE KEY';
    dom.bobKeyStatusBadge.className = 'mono-badge pill-success';
    dom.bobKeyString.textContent = bobKey;
    dom.bobKeyHelper.textContent = 'Matching certified key established.';

    dom.transmitMessageBtn.disabled = false;
    dom.bobReplyBtn.disabled = false;
    setWireStatus(`QKD COMPLETE: Secure Key Established (QBER = ${qber}%)`, 'delivered');
    soundDeliveryDing();

  } else {
    dom.qberBarFill.className = 'qber-bar-fill warning';
    dom.qkdVerdictBanner.className = 'qkd-verdict-banner compromised';
    dom.qkdVerdictBanner.innerHTML = `
      <span>🚨 <strong>EAVESDROPPER DETECTED!</strong> QBER (${qber}%) &gt; 11% threshold!<br>
      State collapse detected on quantum fiber. Key aborted!</span>
    `;

    state.establishedQkdKey = null;

    dom.aliceKeyStatusBadge.textContent = 'KEY ABORTED';
    dom.aliceKeyStatusBadge.className = 'mono-badge pill-danger';
    dom.aliceKeyString.textContent = '-- ABORTED (UNSAFE) --';
    dom.aliceKeyHelper.textContent = 'Eavesdropper altered quantum states. Key discarded.';

    dom.bobKeyStatusBadge.textContent = 'KEY ABORTED';
    dom.bobKeyStatusBadge.className = 'mono-badge pill-danger';
    dom.bobKeyString.textContent = '-- ABORTED (UNSAFE) --';
    dom.bobKeyHelper.textContent = 'High QBER detected. Communication untrusted.';

    dom.transmitMessageBtn.disabled = true;
    dom.bobReplyBtn.disabled = true;
    setWireStatus(`🚨 EAVESDROPPER DETECTED: QBER = ${qber}%! KEY ABORTED!`, 'trapped');
    soundTamperAlarm();
  }

  // Update Eve's Qubit Logs
  if (isEveTapped) {
    const eveSummary = reconciledQubits.map(q => `${q.eveBasis}${q.eveMeasuredBit}`).join(' ');
    dom.eveQubitCount.textContent = `${reconciledQubits.length} qubits`;
    dom.eveQubitLog.textContent = eveSummary;
    dom.eveQubitHelper.textContent = 'Eve measured photons, but basis mismatch collapsed quantum states!';
  } else {
    dom.eveQubitCount.textContent = '0 captured';
    dom.eveQubitLog.textContent = '-- Quantum wiretap was disabled --';
    dom.eveQubitHelper.textContent = 'Photons passed to Bob undisturbed.';
  }

  // Render BB84 Matrix Table
  renderMatrixTable(reconciledQubits);
}

// Render BB84 Matrix in modal
function renderMatrixTable(qubits) {
  const tbody = dom.qkdMatrixBody;
  tbody.innerHTML = qubits.map(q => `
    <tr>
      <td>${q.index}</td>
      <td><strong>${q.aliceBit}</strong></td>
      <td><code>${q.aliceBasis}</code></td>
      <td><span class="mono-badge">${q.aliceSymbol}</span></td>
      <td class="col-eve">${q.eveBasis ? `<code>${q.eveBasis}</code>` : '-'}</td>
      <td class="col-eve">${q.eveMeasuredBit !== undefined ? q.eveMeasuredBit : '-'}</td>
      <td><code>${q.bobBasis}</code></td>
      <td><strong>${q.bobBit}</strong></td>
      <td class="${q.basesMatch ? 'cell-match' : 'cell-mismatch'}">${q.basesMatch ? 'YES ✓' : 'NO ✗'}</td>
      <td class="${q.basesMatch ? 'cell-match' : ''}">${q.siftedBit !== null ? q.siftedBit : '-'}</td>
      <td class="${q.hasError ? 'cell-error' : ''}">${q.hasError ? 'ERROR ⚠️' : (q.basesMatch ? 'MATCH ✓' : '-')}</td>
    </tr>
  `).join('');
}

// ============================================================================
// 5. MESSAGE TRANSMISSION & CLASSICAL INTERCEPTION
// ============================================================================

dom.transmitMessageBtn.addEventListener('click', async () => {
  if (state.isTransmitting) return;
  const plaintext = dom.aliceMessageText.value.trim();
  if (!plaintext) {
    alert('Please enter a message.');
    return;
  }

  if (!state.establishedQkdKey) {
    alert('No secure QKD key established yet. Please run the QKD exchange first!');
    return;
  }

  const ciphertextHex = QuantumLogic.encryptOtp(plaintext, state.establishedQkdKey);
  const packet = {
    id: `MSG-${Date.now().toString().slice(-4)}`,
    from: 'Alice',
    to: dom.aliceRecipient.value,
    plaintext,
    ciphertextHex,
    wirePayload: ciphertextHex,
    qkdKeyUsed: state.establishedQkdKey,
    tampered: false,
    timestamp: new Date()
  };

  transmitMessagePacket(packet, 'alice_to_bob');
});

// Transmit Classical Message over the Public Channel
async function transmitMessagePacket(packet, direction = 'alice_to_bob') {
  state.isTransmitting = true;
  state.allPackets.set(packet.id, packet);

  if (packet.from === 'Alice') {
    state.aliceSent.unshift(packet);
    renderAliceSent();
  }

  setWireStatus(`TRANSMITTING ${packet.id} TO ${packet.to.toUpperCase()}...`, 'transmitting');
  soundPhotonChirp();

  const flying = dom.flyingPacket;
  const tag = dom.flyingPacketTag;
  flying.classList.remove('hidden', 'trapped', 'tampered');
  tag.textContent = packet.id;

  const speed = state.transitSpeedMs;

  // Start at Alice (4%)
  flying.style.transition = 'none';
  flying.style.left = '4%';

  await wait(30);
  // Animate to Interceptor (Eve at 50%)
  flying.style.transition = `left ${speed / 2}ms linear`;
  flying.style.left = '50%';
  await wait(speed / 2);

  // ==========================================================================
  // EVE INTERCEPT POINT
  // ==========================================================================
  if (state.interceptMode === 'passive') {
    // Passive Sniffer: Eve copies the packet
    handleEvePassiveMessageIntercept(packet);
    setWireStatus(`WIRETAP: Eve copied ${packet.id}. Forwarding to ${packet.to}...`, 'transmitting');

    flying.style.transition = `left ${speed / 2}ms linear`;
    flying.style.left = '96%';
    await wait(speed / 2);

    deliverMessageToBob(packet);
    finishTransmission();

  } else if (state.interceptMode === 'active') {
    // Active MitM: Trap the message on the wire!
    flying.classList.add('trapped');
    soundTrapAlert();
    setWireStatus(`🚨 ALERT: ${packet.id} TRAPPED BY EVE (NOT MEANT FOR HER)!`, 'trapped');
    handleEveActiveMessageTrap(packet);
  }
}

// Eve's Passive Logging
function handleEvePassiveMessageIntercept(packet) {
  state.eveIntercepted.unshift({ ...packet, interceptType: 'Passive Sniff' });
  renderEveInterceptList();
}

// Eve's Active Trapping
function handleEveActiveMessageTrap(packet) {
  state.activeTrappedPacket = packet;

  dom.trappedPacketPanel.classList.remove('hidden');
  dom.trappedRecipientBadge.textContent = packet.to;
  dom.trapPktId.textContent = packet.id;
  dom.trapPktSender.textContent = packet.from;
  dom.trapPktRecipient.textContent = packet.to;
  dom.trapRawPayload.textContent = packet.wirePayload;

  dom.tamperPayloadInput.value = packet.wirePayload;

  state.eveIntercepted.unshift({ ...packet, interceptType: 'Trapped (MitM)' });
  renderEveInterceptList();
}

// Eve Actions: Forward Unaltered
dom.forwardOriginalBtn.addEventListener('click', async () => {
  if (!state.activeTrappedPacket) return;
  const packet = state.activeTrappedPacket;
  closeTrappedPanel();

  setWireStatus(`Eve forwarded ${packet.id} unaltered to ${packet.to}...`, 'transmitting');
  const speed = state.transitSpeedMs;
  const flying = dom.flyingPacket;
  flying.classList.remove('trapped');

  flying.style.transition = `left ${speed / 2}ms linear`;
  flying.style.left = '96%';
  await wait(speed / 2);

  deliverMessageToBob(packet);
  finishTransmission();
});

// Eve Actions: Tamper & Forward (Active Attack)
dom.tamperAndForwardBtn.addEventListener('click', async () => {
  if (!state.activeTrappedPacket) return;
  const packet = state.activeTrappedPacket;
  const tamperedHex = dom.tamperPayloadInput.value.trim();

  packet.tampered = true;
  packet.wirePayload = tamperedHex;

  closeTrappedPanel();
  soundTamperAlarm();

  setWireStatus(`⚠️ TAMPERED CIPHERTEXT FORWARDED TO ${packet.to.toUpperCase()}!`, 'tampered');
  const speed = state.transitSpeedMs;
  const flying = dom.flyingPacket;
  flying.classList.remove('trapped');
  flying.classList.add('tampered');

  flying.style.transition = `left ${speed / 2}ms linear`;
  flying.style.left = '96%';
  await wait(speed / 2);

  deliverMessageToBob(packet);
  finishTransmission();
});

// Eve Actions: Drop Message
dom.dropPacketBtn.addEventListener('click', () => {
  if (!state.activeTrappedPacket) return;
  const packet = state.activeTrappedPacket;
  packet.status = 'dropped_by_eve';

  closeTrappedPanel();
  dom.flyingPacket.classList.add('hidden');
  setWireStatus(`🗑️ MESSAGE ${packet.id} DROPPED BY EVE!`, 'trapped');
  renderAliceSent();
  renderEveInterceptList();

  setTimeout(() => {
    state.isTransmitting = false;
    setWireStatus('WIRE IDLE: Channel Clear', 'idle');
  }, 1200);
});

function closeTrappedPanel() {
  dom.trappedPacketPanel.classList.add('hidden');
  state.activeTrappedPacket = null;
}

// Deliver Message to Bob
function deliverMessageToBob(packet) {
  if (packet.to !== 'Bob' && packet.to !== 'Broadcast') {
    setWireStatus(`DELIVERED TO ${packet.to.toUpperCase()} (NOT BOB)`, 'delivered');
    return;
  }

  // Bob decrypts with his QKD key
  let decrypted = '';
  let decryptError = null;

  try {
    decrypted = QuantumLogic.decryptOtp(packet.wirePayload, state.establishedQkdKey);
  } catch (e) {
    decryptError = e.message;
  }

  packet.bobProcessed = {
    decrypted,
    decryptError,
    tamperedDetected: packet.tampered
  };

  state.bobInbox.unshift(packet);
  renderBobInbox();

  if (packet.tampered) {
    soundTamperAlarm();
    setWireStatus(`⚠️ BOB RECEIVED ${packet.id}: CIPHERTEXT TAMPERED IN TRANSIT!`, 'tampered');
  } else {
    soundDeliveryDing();
    setWireStatus(`✅ BOB RECEIVED ${packet.id}: DECRYPTED VIA QKD KEY!`, 'delivered');
  }
}

// Bob Reply Action
dom.bobReplyBtn.addEventListener('click', () => {
  const replyText = dom.bobReplyText.value.trim();
  if (!replyText || !state.establishedQkdKey) return;

  const hexCiphertext = QuantumLogic.encryptOtp(replyText, state.establishedQkdKey);
  const packet = {
    id: `REPLY-${Date.now().toString().slice(-4)}`,
    from: 'Bob',
    to: 'Alice',
    plaintext: replyText,
    ciphertextHex: hexCiphertext,
    wirePayload: hexCiphertext,
    qkdKeyUsed: state.establishedQkdKey,
    tampered: false,
    timestamp: new Date()
  };

  state.bobInbox.unshift(packet);
  renderBobInbox();
  setWireStatus('BOB TRANSMITTED QKD-ENCRYPTED ACKNOWLEDGMENT TO ALICE', 'delivered');
  soundDeliveryDing();
});

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
  return new Promise(res => setTimeout(res, ms));
}

// ============================================================================
// 6. UI RENDERING FUNCTIONS
// ============================================================================
function renderAliceSent() {
  dom.aliceSentCount.textContent = `${state.aliceSent.length} sent`;
  const list = dom.aliceSentList;

  if (state.aliceSent.length === 0) {
    list.innerHTML = '<div class="empty-state">No messages transmitted yet.</div>';
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
        <div class="plain-val">"${escapeHtml(pkt.plaintext)}"</div>
        <div class="helper-text" style="margin-top: 3px;">Encrypted with QKD Key (OTP)</div>
      </div>
    </div>
  `).join('');
}

function renderEveInterceptList() {
  dom.eveInterceptCount.textContent = `${state.eveIntercepted.length} captured`;
  const list = dom.eveInterceptList;

  if (state.eveIntercepted.length === 0) {
    list.innerHTML = '<div class="empty-state">No messages intercepted yet.</div>';
    return;
  }

  list.innerHTML = state.eveIntercepted.map(pkt => `
    <div class="packet-card" onclick="viewPacketModal('${pkt.id}')">
      <div class="packet-card-header">
        <span class="packet-pill ${pkt.tampered ? 'pill-warning' : 'pill-danger'}">
          ${pkt.id} [${escapeHtml(pkt.from)} ➔ ${escapeHtml(pkt.to)}]
        </span>
        <span class="mono-badge" style="font-size: 0.65rem;">${pkt.interceptType}</span>
      </div>
      <div class="packet-content-box">
        <div class="cipher-val">HEX: ${escapeHtml(pkt.wirePayload.substring(0, 40))}...</div>
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
  const list = dom.bobInboxList;

  if (state.bobInbox.length === 0) {
    list.innerHTML = '<div class="empty-state">No messages received yet.</div>';
    return;
  }

  list.innerHTML = state.bobInbox.map(pkt => {
    const proc = pkt.bobProcessed || {};
    return `
      <div class="packet-card" onclick="viewPacketModal('${pkt.id}')">
        <div class="packet-card-header">
          <span class="packet-pill ${proc.tamperedDetected ? 'pill-danger' : 'pill-success'}">
            ${pkt.id} from ${escapeHtml(pkt.from)}
          </span>
          <span>${formatTime(pkt.timestamp)}</span>
        </div>
        <div class="packet-content-box">
          <div class="plain-val">"${escapeHtml(proc.decrypted || pkt.plaintext)}"</div>
        </div>
        ${proc.tamperedDetected ? `
          <div class="integrity-banner integrity-fail">
            🚨 TAMPER DETECTED: Ciphertext bytes altered in transit!
          </div>
        ` : `
          <div class="integrity-banner integrity-pass">
            ✅ VERIFIED: Decrypted seamlessly with certified QKD key.
          </div>
        `}
      </div>
    `;
  }).join('');
}

// Detailed Packet Modal
window.viewPacketModal = function(id) {
  const pkt = state.allPackets.get(id);
  if (!pkt) return;

  dom.modalTitle.textContent = `Message Inspection — ${pkt.id}`;
  dom.modalBody.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      <div class="inspector-meta-grid">
        <div><strong>Packet ID:</strong> <code>${pkt.id}</code></div>
        <div><strong>Timestamp:</strong> <span>${formatTime(pkt.timestamp)}</span></div>
        <div><strong>From:</strong> <code>${escapeHtml(pkt.from)}</code></div>
        <div><strong>To:</strong> <code>${escapeHtml(pkt.to)}</code></div>
        <div><strong>Encryption:</strong> <span class="mono-badge">QKD ONE-TIME PAD</span></div>
        <div><strong>Tampered in Transit:</strong> <span class="${pkt.tampered ? 'pill-danger' : 'pill-success'} mono-badge">${pkt.tampered ? 'YES' : 'NO'}</span></div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #94a3b8; font-weight: bold;">Raw Ciphertext Transmitted on Wire (Hex):</label>
        <div class="mono-display break-all" style="margin-top: 4px;">${escapeHtml(pkt.wirePayload)}</div>
      </div>
      <div>
        <label style="font-size: 0.75rem; color: #94a3b8; font-weight: bold;">Original Alice Plaintext:</label>
        <div class="mono-display" style="color: #4ade80; margin-top: 4px;">"${escapeHtml(pkt.plaintext)}"</div>
      </div>
      ${pkt.bobProcessed ? `
        <div>
          <label style="font-size: 0.75rem; color: #94a3b8; font-weight: bold;">Bob's Decryption Result:</label>
          <div class="mono-display" style="margin-top: 4px;">"${escapeHtml(pkt.bobProcessed.decrypted)}"${pkt.tampered ? ' (Corrupted by bit-flip tampering)' : ''}</div>
        </div>
      ` : ''}
    </div>
  `;
  dom.packetModal.classList.remove('hidden');
};

dom.closeModalBtn.addEventListener('click', () => dom.packetModal.classList.add('hidden'));
dom.packetModal.addEventListener('click', (e) => {
  if (e.target === dom.packetModal) dom.packetModal.classList.add('hidden');
});

// Matrix Modal
dom.openMatrixBtn.addEventListener('click', () => dom.matrixModal.classList.remove('hidden'));
dom.closeMatrixBtn.addEventListener('click', () => dom.matrixModal.classList.add('hidden'));
dom.matrixModal.addEventListener('click', (e) => {
  if (e.target === dom.matrixModal) dom.matrixModal.classList.add('hidden');
});

// ============================================================================
// 7. CONTROLS, TABS & SCENARIOS
// ============================================================================

// Photon Count Selector
dom.photonCountBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    dom.photonCountBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.photonCount = parseInt(btn.getAttribute('data-count'), 10);
  });
});

// Quick Sample Buttons
document.querySelectorAll('.badge-action').forEach(btn => {
  btn.addEventListener('click', () => {
    dom.aliceMessageText.value = btn.getAttribute('data-sample');
  });
});

// Eve Quantum Tap Toggle
dom.eveQuantumTapToggle.addEventListener('change', () => {
  const active = dom.eveQuantumTapToggle.checked;
  dom.eveQuantumTapMarker.style.opacity = active ? '1' : '0.2';
  dom.eveStatusTag.textContent = active ? '● WIRETAP ACTIVE' : '● WIRETAP DISABLED';
  dom.eveStatusTag.className = active ? 'station-status-tag spying' : 'station-status-tag online';
});

// Eve Message Intercept Radios
dom.interceptModeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    state.interceptMode = e.target.value;
  });
});

// Speed
dom.speedSelect.addEventListener('change', () => {
  state.transitSpeedMs = parseInt(dom.speedSelect.value, 10);
});

// Sound Toggle
dom.soundToggleBtn.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  dom.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
  dom.soundLabel.textContent = state.soundEnabled ? 'Audio FX' : 'Muted';
});

// Reset All
dom.resetAllBtn.addEventListener('click', () => {
  state.establishedQkdKey = null;
  state.aliceSent = [];
  state.eveIntercepted = [];
  state.bobInbox = [];
  state.qkdAuditRecord = [];
  state.allPackets.clear();
  state.isTransmitting = false;

  dom.aliceKeyStatusBadge.textContent = 'NO KEY YET';
  dom.aliceKeyStatusBadge.className = 'mono-badge';
  dom.aliceKeyString.textContent = '-- NONE --';
  dom.aliceKeyHelper.textContent = 'Run QKD exchange to negotiate a One-Time Pad key.';

  dom.bobKeyStatusBadge.textContent = 'NO KEY YET';
  dom.bobKeyStatusBadge.className = 'mono-badge';
  dom.bobKeyString.textContent = '-- NONE --';
  dom.bobKeyHelper.textContent = 'Will match Alice\'s key if no eavesdropping occurred.';

  dom.qberValueBadge.textContent = '0.0%';
  dom.qberBarFill.style.width = '0%';
  dom.qberBarFill.className = 'qber-bar-fill';
  dom.qkdVerdictBanner.className = 'qkd-verdict-banner pending';
  dom.qkdVerdictBanner.innerHTML = '<span>Waiting for QKD photon exchange...</span>';

  dom.transmitMessageBtn.disabled = true;
  dom.bobReplyBtn.disabled = true;

  dom.qkdMatrixBody.innerHTML = '<tr><td colspan="11" class="text-center">No QKD exchange performed yet.</td></tr>';

  renderAliceSent();
  renderEveInterceptList();
  renderBobInbox();
  closeTrappedPanel();
  dom.flyingPacket.classList.add('hidden');
  dom.flyingPhoton.classList.add('hidden');
  setWireStatus('WIRE IDLE: Channel Clear', 'idle');
});

// Role Tabs
dom.tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    if (target === 'matrix') return;

    dom.tabButtons.forEach(b => {
      if (b.getAttribute('data-target') !== 'matrix') b.classList.remove('active');
    });
    btn.classList.add('active');

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

// Guided Scenarios
dom.scenarioSelect.addEventListener('change', () => {
  const val = dom.scenarioSelect.value;
  if (!val) return;

  if (val === 'clean_qkd') {
    dom.eveQuantumTapToggle.checked = false;
    dom.eveQuantumTapToggle.dispatchEvent(new Event('change'));
    dom.interceptModeRadios[0].checked = true; // passive
    state.interceptMode = 'passive';
    alert('Scenario 1 Loaded: Clean QKD (No Eve)\n\n1. Quantum wiretap is OFF.\n2. Click "Emit Photons & Run QKD Exchange".\n3. QBER will be 0.0%, generating a certified One-Time Pad key!');

  } else if (val === 'eve_quantum_tap') {
    dom.eveQuantumTapToggle.checked = true;
    dom.eveQuantumTapToggle.dispatchEvent(new Event('change'));
    dom.eveBasisStrategy.value = 'random';
    alert('Scenario 2 Loaded: Eve Quantum Interception (State Collapse)\n\n1. Eve\'s Quantum Wiretap is ON.\n2. Click "Emit Photons & Run QKD Exchange".\n3. Notice how Eve\'s measurement collapses photon polarizations, causing high QBER (> 11%) and immediately alerting Alice and Bob to abort!');

  } else if (val === 'eve_classical_sniff') {
    dom.eveQuantumTapToggle.checked = false;
    dom.eveQuantumTapToggle.dispatchEvent(new Event('change'));
    dom.interceptModeRadios[0].checked = true; // passive
    state.interceptMode = 'passive';
    alert('Scenario 3 Loaded: Eve Intercepts Message (OTP Uncrackability)\n\n1. First run QKD with Eve OFF to establish a safe key.\n2. Click "Send Encrypted Message".\n3. Eve intercepts the ciphertext not meant for her, but One-Time Pad makes it mathematically uncrackable without the QKD key!');

  } else if (val === 'eve_mitm_tamper') {
    dom.eveQuantumTapToggle.checked = false;
    dom.eveQuantumTapToggle.dispatchEvent(new Event('change'));
    dom.interceptModeRadios[1].checked = true; // active MitM
    state.interceptMode = 'active';
    alert('Scenario 4 Loaded: Active MitM Tampering\n\n1. Run QKD to get a key.\n2. Click "Send Encrypted Message".\n3. Eve will halt the message in transit! Modify the hex payload and click "Tamper & Forward". Watch Bob detect the corrupted transmission!');
  }
});

// Utilities
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(d) {
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Expose QuantumLogic globally so you can test or replace it in console / scripts
window.QuantumLogic = QuantumLogic;
