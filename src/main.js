// Import styles
import '../style.css';

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5fjkXd_lirXDEY5wyH-upF9yU_nzLAJw",
  authDomain: "web-rtc-server-50d56.firebaseapp.com",
  projectId: "web-rtc-server-50d56",
  storageBucket: "web-rtc-server-50d56.firebasestorage.app",
  messagingSenderId: "1017642181996",
  appId: "1:1017642181996:web:e325acd4ee82baa9087f49",
  measurementId: "G-KVDMZRQKBP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// src/main.js (below the Firebase initialization)

// Global WebRTC variables
const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Global State
// per-peer RTCPeerConnections will be stored in the `peers` map below
let localStream = null;
let remoteStream = null; // used for legacy single-view fallback

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const videoSelect = document.getElementById('videoSelect');
const audioSelect = document.getElementById('audioSelect');
const audioOutputSelect = document.getElementById('audioOutputSelect');
const createCallModal = document.getElementById('createCallModal');
const closeCreateCall = document.getElementById('closeCreateCall');
const callIdDisplay = document.getElementById('callIdDisplay');
const copyCallId = document.getElementById('copyCallId');
const shareGmail = document.getElementById('shareGmail');
const shareOutlook = document.getElementById('shareOutlook');
const joinCallModal = document.getElementById('joinCallModal');
const joinCallInput = document.getElementById('joinCallInput');
const confirmJoinCall = document.getElementById('confirmJoinCall');
const closeJoinCall = document.getElementById('closeJoinCall');
const toggleMute = document.getElementById('toggleMute');
const toggleCamera = document.getElementById('toggleCamera');
const toggleFullscreen = document.getElementById('toggleFullscreen');
const callTimer = document.getElementById('callTimer');
const videoContainer = document.getElementById('videoContainer');
const localCameraOff = document.getElementById('slot-0-camera-off');
const remoteCameraOff = document.getElementById('remoteCameraOff');
const localMuted = document.getElementById('slot-0-muted');
const remoteMuted = document.getElementById('remoteMuted');
const connectionIndicator = document.getElementById('connectionIndicator');
const networkStats = document.getElementById('networkStats');
const videoStat = document.getElementById('videoStat');
const audioStat = document.getElementById('audioStat');
const latencyStat = document.getElementById('latencyStat');
const packetLossStat = document.getElementById('packetLossStat');
const chatPanel = document.getElementById('chatPanel');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessage = document.getElementById('sendMessage');
const openChat = document.getElementById('openChat');
const toggleChat = document.getElementById('toggleChat');
const showStatsToggle = document.getElementById('showStatsToggle');
const usernameInput = document.getElementById('usernameInput');
const localNameTag = document.getElementById('localNameTag');
const remoteNameTag = document.getElementById('remoteNameTag');

// Call state
let isMuted = false;
let isCameraOff = false;
let callStartTime = null;
let timerInterval = null;
let statsInterval = null;
let showStats = false;
let username = 'Guest';

// Device selection
let currentVideoDevice = null;
let currentAudioDevice = null;

// Multi-peer support
const clientId = localStorage.getItem('clientId') || Math.random().toString(36).substring(2, 10);
localStorage.setItem('clientId', clientId);

// Map of peerId -> { pc, dataChannel, remoteStream, slotIndex, username }
const peers = {};
const MAX_PARTICIPANTS = 10; // including local

let focusedPeerId = null; // currently selected thumbnail (to show in main area)

function broadcastData(obj) {
  Object.values(peers).forEach(p => {
    const dc = p.dataChannel;
    if (dc && dc.readyState === 'open') {
      try { dc.send(JSON.stringify(obj)); } catch (err) { /* ignore */ }
    }
  });
}

function updateFocusedSlotUI() {
  document.querySelectorAll('.thumb-slot').forEach(el => el.classList.remove('active'));
  if (focusedPeerId) {
    const p = peers[focusedPeerId];
    if (p && p.slotIndex) {
      const el = document.getElementById(`slot-${p.slotIndex}`);
      if (el) el.classList.add('active');
    }
  } else {
    const local = document.getElementById('slot-0');
    if (local) local.classList.add('active');
  }
}

// utility: find an available thumbnail slot (1..9) for remote peers
function allocateSlotForPeer(peerId) {
  // try to reuse if already allocated
  for (const [id, p] of Object.entries(peers)) {
    if (id === peerId && p.slotIndex) return p.slotIndex;
  }

  // find next empty slot 1..9
  for (let i = 1; i < MAX_PARTICIPANTS; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    if (!slotEl) continue;
    // check if any peer already uses this index
    const used = Object.values(peers).some(p => p.slotIndex === i);
    if (!used) return i;
  }
  return null;
}

function getSlotElementFor(peerId) {
  const p = peers[peerId];
  if (!p || !p.slotIndex) return null;
  return document.getElementById(`slot-${p.slotIndex}`);
}

function createOrGetVideoForPeer(peerId) {
  const slotIndex = peers[peerId].slotIndex || allocateSlotForPeer(peerId);
  if (!slotIndex) return null;
  peers[peerId].slotIndex = slotIndex;

  const slotEl = document.getElementById(`slot-${slotIndex}`);
  slotEl.classList.remove('empty');

  // ensure a video element exists
  let vid = slotEl.querySelector('video');
  if (!vid) {
    vid = document.createElement('video');
    vid.className = 'thumb-video';
    vid.autoplay = true;
    vid.playsInline = true;
    vid.id = `slot-${slotIndex}-video`;
    slotEl.appendChild(vid);
  }

  // ensure name tag
  let nameTag = slotEl.querySelector('.slot-name');
  if (!nameTag) {
    nameTag = document.createElement('div');
    nameTag.className = 'video-name-tag slot-name';
    nameTag.id = `slot-${slotIndex}-name`;
    nameTag.textContent = peers[peerId].username || 'Guest';
    slotEl.appendChild(nameTag);
  }

  // ensure small camera-off overlay and muted indicator for this slot
  if (!slotEl.querySelector('.camera-off-overlay')) {
    const overlay = document.createElement('div');
    overlay.className = 'camera-off-overlay small';
    overlay.id = `slot-${slotIndex}-camera-off`;
    overlay.innerHTML = '<div class="camera-off-icon">📷</div>';
    slotEl.appendChild(overlay);
  }

  if (!slotEl.querySelector('.muted-indicator')) {
    const m = document.createElement('div');
    m.className = 'muted-indicator small';
    m.id = `slot-${slotIndex}-muted`;
    m.textContent = '🔇';
    slotEl.appendChild(m);
  }

  return vid;
}

// Firestore helpers + multi-peer signal handlers
let currentCallRef = null;
let participantsUnsub = null;
let signalsUnsub = null;

async function sendSignal(payload) {
  if (!currentCallRef) return;
  const signalsCol = collection(currentCallRef, 'signals');
  await addDoc(signalsCol, { ...payload, createdAt: serverTimestamp() });
}

async function updateMyParticipantRecord() {
  if (!currentCallRef) return;
  const myDoc = doc(currentCallRef, 'participants', clientId);
  try {
    await setDoc(myDoc, { username }, { merge: true });
  } catch (err) {
    console.error('Failed to update participant record:', err);
  }
}

async function enterCall(callId, isCreator = false) {
  currentCallRef = doc(db, 'calls', callId);

  // if creator, ensure the call doc exists
  if (isCreator) {
    try {
      await setDoc(currentCallRef, { createdAt: serverTimestamp() });
    } catch (err) {
      console.error('Error creating call doc:', err);
    }
  }

  // add this client to participants
  try {
    const participantsColNow = collection(currentCallRef, 'participants');
    // if the room is full, don't join
    const existing = await getDocs(participantsColNow);
    if (!isCreator && existing.size >= MAX_PARTICIPANTS) {
      alert('Call is full (maximum ' + MAX_PARTICIPANTS + ' participants)');
      return;
    }

    await setDoc(doc(currentCallRef, 'participants', clientId), { username, joinedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.error('Failed to join call participants collection:', err);
  }

  // Watch participants list
  const participantsCol = collection(currentCallRef, 'participants');
  participantsUnsub = onSnapshot(participantsCol, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      const pid = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'added') {
        if (pid === clientId) return; // ignore self
        peers[pid] = peers[pid] || {};
        peers[pid].username = data.username || 'Guest';

        // assign slot and create video element placeholder
        createOrGetVideoForPeer(pid);

        // who should initiate? deterministic rule by id ordering
        if (clientId < pid) {
          // we initiate to them
          await createPeerConnection(pid, true);
        } else {
          // wait for offer from them
          await createPeerConnection(pid, false);
        }
        // If nothing is focused yet, auto-focus the first remote who joined
          if (!focusedPeerId) {
          focusedPeerId = pid;
          remoteVideo.srcObject = peers[pid].remoteStream;
          remoteNameTag.textContent = peers[pid].username || 'Guest';
             updateFocusedSlotUI();
        }
      } else if (change.type === 'removed') {
        cleanupPeer(pid);
      } else if (change.type === 'modified') {
        // update username change
        if (peers[pid]) {
          peers[pid].username = data.username || 'Guest';
          const slot = getSlotElementFor(pid);
          if (slot) {
            const n = slot.querySelector('.slot-name');
            if (n) n.textContent = peers[pid].username;
          }
        }
      }
    });
  });

  // Watch signals subcollection
  const signalsCol = collection(currentCallRef, 'signals');
  signalsUnsub = onSnapshot(signalsCol, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type !== 'added') return;
      const data = change.doc.data();
      if (!data || data.to !== clientId) return;

      const from = data.from;
      if (data.type === 'offer') {
        // someone offered to us; create pc (if not exists), set remote and answer
        peers[from] = peers[from] || {};
        peers[from].username = peers[from].username || 'Guest';
        const pc = await createPeerConnection(from, false);
        const offerDesc = { type: 'offer', sdp: data.sdp };
        await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ type: 'answer', from: clientId, to: from, sdp: answer.sdp });
      } else if (data.type === 'answer') {
        // an answer to our earlier offer
        const pc = peers[from] && peers[from].pc;
        if (pc) {
          const answerDesc = { type: 'answer', sdp: data.sdp };
          await pc.setRemoteDescription(new RTCSessionDescription(answerDesc));
        }
      } else if (data.type === 'ice') {
        const pc = peers[from] && peers[from].pc;
        if (pc && data.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.warn('Failed to add remote ICE candidate', err);
          }
          } else if (data.type === 'left') {
            // remote left the call
            console.log('Peer left:', from);
            cleanupPeer(from);
        }
      }
    });
  });

  // update our participant record with current username
  await updateMyParticipantRecord();

  // show chat, start timer and stats
  startCallTimer();
  startStatsMonitoring();
  openChat.classList.add('active');
}

async function leaveCall() {
  // remove participant doc
  if (currentCallRef) {
    try {
      await addDoc(collection(currentCallRef, 'signals'), { type: 'left', from: clientId, createdAt: serverTimestamp() });
      // remove our participant record
      await deleteDoc(doc(currentCallRef, 'participants', clientId));
    } catch (_) {}

    // cleanup listeners
    if (participantsUnsub) participantsUnsub();
    if (signalsUnsub) signalsUnsub();
  }

  // cleanup peers
  Object.keys(peers).forEach(pid => cleanupPeer(pid));

  currentCallRef = null;
  stopCallTimer();
  stopStatsMonitoring();
  openChat.classList.remove('active');
}

async function createPeerConnection(peerId, isInitiator = false) {
  if (!currentCallRef) throw new Error('Not in a call');
  if (peers[peerId] && peers[peerId].pc) return peers[peerId].pc;

  const pc = new RTCPeerConnection(servers);
  const remoteStream = new MediaStream();

  peers[peerId] = peers[peerId] || {};
  peers[peerId].pc = pc;
  peers[peerId].remoteStream = remoteStream;

  // Attach remote stream to a slot video
  const vid = createOrGetVideoForPeer(peerId);
    if (vid) {
      vid.srcObject = remoteStream;
      updateFocusedSlotUI();
    }

  // Add local tracks if available
  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  // Data channel handling
  if (isInitiator) {
    const dc = pc.createDataChannel('data');
    peers[peerId].dataChannel = dc;
    setupDataChannel(dc, peerId);
  } else {
    pc.ondatachannel = (ev) => {
      peers[peerId].dataChannel = ev.channel;
      setupDataChannel(ev.channel, peerId);
    };
  }

  // Tracks
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
  };

  // ICE candidate -> send to the specific peer
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      // make sure we don't send a class instance to Firestore
      const serial = candidate && typeof candidate.toJSON === 'function' ? candidate.toJSON() : candidate;
      sendSignal({ type: 'ice', from: clientId, to: peerId, candidate: serial });
    }
  };

  // If initiator, create an offer
  if (isInitiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal({ type: 'offer', from: clientId, to: peerId, sdp: offer.sdp });
  }

  return pc;
}

function cleanupPeer(peerId) {
  const p = peers[peerId];
  if (!p) return;
  if (p.pc) {
    try { p.pc.close(); } catch(_){}
  }
  if (p.dataChannel) {
    try { p.dataChannel.close(); } catch(_){}
  }
  // clear remote video slot
  if (p.slotIndex) {
    const el = document.getElementById(`slot-${p.slotIndex}`);
    if (el) {
      el.innerHTML = '';
      el.classList.add('empty');
    }
  }
  delete peers[peerId];
}

async function getDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  
  videoSelect.innerHTML = '';
  audioSelect.innerHTML = '';
  audioOutputSelect.innerHTML = '';
  
  devices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.text = device.label || `${device.kind} ${videoSelect.length + 1}`;
    
    if (device.kind === 'videoinput') {
      videoSelect.appendChild(option);
    } else if (device.kind === 'audioinput') {
      audioSelect.appendChild(option);
    } else if (device.kind === 'audiooutput') {
      audioOutputSelect.appendChild(option);
    }
  });
}

videoSelect.onchange = async () => {
  currentVideoDevice = videoSelect.value;
  if (localStream) {
    await updateStream();
  }
};

audioSelect.onchange = async () => {
  currentAudioDevice = audioSelect.value;
  if (localStream) {
    await updateStream();
  }
};

audioOutputSelect.onchange = async () => {
  if (typeof remoteVideo.setSinkId !== 'undefined') {
    try {
      await remoteVideo.setSinkId(audioOutputSelect.value);
    } catch (error) {
      console.error('Error setting audio output:', error);
    }
  }
};

async function updateStream() {
  const constraints = {
    video: currentVideoDevice ? { deviceId: { exact: currentVideoDevice } } : true,
    audio: currentAudioDevice ? { deviceId: { exact: currentAudioDevice } } : true
  };
  
  const oldStream = localStream;
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  
  webcamVideo.srcObject = localStream;
  
  // Update each peer connection with the new tracks
  Object.values(peers).forEach(p => {
    if (!p.pc) return;
    const senders = p.pc.getSenders ? p.pc.getSenders() : [];
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];
    senders.forEach(sender => {
      if (!sender.track) return;
      if (sender.track.kind === 'video' && videoTrack) {
        sender.replaceTrack(videoTrack);
      } else if (sender.track.kind === 'audio' && audioTrack) {
        sender.replaceTrack(audioTrack);
      }
    });
  });
  
  // Stop old tracks
  if (oldStream) {
    oldStream.getTracks().forEach(track => track.stop());
  }
}

settingsButton.onclick = () => {
  settingsModal.classList.add('active');
};

closeSettings.onclick = () => {
  settingsModal.classList.remove('active');
};

settingsModal.onclick = (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.remove('active');
  }
};

showStatsToggle.onchange = () => {
  showStats = showStatsToggle.checked;
  if (showStats && statsInterval) {
    connectionIndicator.classList.add('active');
    networkStats.classList.add('active');
  } else {
    connectionIndicator.classList.remove('active');
    networkStats.classList.remove('active');
  }
};

// Load username from localStorage
if (localStorage.getItem('username')) {
  username = localStorage.getItem('username');
  usernameInput.value = username;
  localNameTag.textContent = username;
}

usernameInput.oninput = () => {
  username = usernameInput.value.trim() || 'Guest';
  localStorage.setItem('username', username);
  localNameTag.textContent = username;
  // update our participant record and broadcast to peers
  updateMyParticipantRecord();
  broadcastData({ type: 'username', username });
};

closeCreateCall.onclick = () => {
  createCallModal.classList.remove('active');
};

createCallModal.onclick = (e) => {
  if (e.target === createCallModal) {
    createCallModal.classList.remove('active');
  }
};

copyCallId.onclick = async () => {
  try {
    await navigator.clipboard.writeText(callIdDisplay.value);
    const originalText = copyCallId.textContent;
    copyCallId.textContent = 'Copied!';
    setTimeout(() => {
      copyCallId.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

shareGmail.onclick = () => {
  const callId = callIdDisplay.value;
  const subject = encodeURIComponent('Join my video call');
  const body = encodeURIComponent(`Hi,\n\nJoin my video call using this ID: ${callId}\n\nGo to ${window.location.origin} and click "Join Call", then enter the call ID.\n\nSee you soon!`);
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank');
};

shareOutlook.onclick = () => {
  const callId = callIdDisplay.value;
  const subject = encodeURIComponent('Join my video call');
  const body = encodeURIComponent(`Hi,\n\nJoin my video call using this ID: ${callId}\n\nGo to ${window.location.origin} and click "Join Call", then enter the call ID.\n\nSee you soon!`);
  window.open(`https://outlook.office.com/mail/deeplink/compose?subject=${subject}&body=${body}`, '_blank');
};

answerButton.onclick = () => {
  joinCallModal.classList.add('active');
};

closeJoinCall.onclick = () => {
  joinCallModal.classList.remove('active');
};

joinCallModal.onclick = (e) => {
  if (e.target === joinCallModal) {
    joinCallModal.classList.remove('active');
  }
};

// Chat functionality
openChat.onclick = () => {
  chatPanel.classList.add('open');
  openChat.classList.remove('has-new');
};

toggleChat.onclick = () => {
  chatPanel.classList.remove('open');
};

sendMessage.onclick = () => {
  sendChatMessage();
};

callButton.onclick = async () => {
  // Create a short call id and enter the call as the creator
  const shortId = Math.random().toString(36).substring(2, 12);
  callIdDisplay.value = shortId;
  createCallModal.classList.add('active');

  // create the empty call doc and then enter
  const callDoc = doc(db, 'calls', shortId);
  await setDoc(callDoc, { createdAt: serverTimestamp() });
  await enterCall(shortId, true);
  hangupButton.disabled = false;
};
// Mute/Unmute microphone
toggleMute.onclick = () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted = !audioTrack.enabled;
      toggleMute.classList.toggle('muted', isMuted);
      toggleMute.textContent = isMuted ? '🔇' : '🎤';
      localMuted.classList.toggle('active', !audioTrack.enabled);
      
      console.log('Mute toggled - audioTrack.enabled:', audioTrack.enabled, 'isMuted:', isMuted);
      console.log('localMuted classes:', localMuted.className);

      // Send mute state to all peers
      broadcastData({ type: 'mute', muted: isMuted });
    }
  }
};

// Toggle camera on/off
toggleCamera.onclick = () => {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isCameraOff = !videoTrack.enabled;
      toggleCamera.classList.toggle('camera-off', isCameraOff);
      toggleCamera.textContent = isCameraOff ? '📷' : '📹';
      localCameraOff.classList.toggle('active', !videoTrack.enabled);
      
      console.log('Camera toggled - videoTrack.enabled:', videoTrack.enabled, 'isCameraOff:', isCameraOff);
      console.log('localCameraOff classes:', localCameraOff.className);

      // Send camera state to all peers
      broadcastData({ type: 'camera', enabled: videoTrack.enabled });
    }
  }
};

// Toggle fullscreen
toggleFullscreen.onclick = () => {
  if (!document.fullscreenElement) {
    videoContainer.requestFullscreen().catch(err => {
      console.error('Error attempting to enable fullscreen:', err);
    });
  } else {
    document.exitFullscreen();
  }
};

// Call timer
function startCallTimer() {
  callStartTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    callTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
}

function stopCallTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  callTimer.textContent = '00:00';
  callStartTime = null;
}

// Connection quality monitoring
async function startStatsMonitoring() {
  if (showStats) {
    connectionIndicator.classList.add('active');
    networkStats.classList.add('active');
  }
  
  statsInterval = setInterval(async () => {
    if (!focusedPeerId) return;
    const p = peers[focusedPeerId];
    if (!p || !p.pc) return;

    const stats = await p.pc.getStats();
    let videoBitrate = 0;
    let audioBitrate = 0;
    let latency = 0;
    let packetLoss = 0;
    let packetsLost = 0;
    let packetsReceived = 0;
    
    stats.forEach(report => {
      if (report.type === 'inbound-rtp') {
        if (report.kind === 'video' && report.bytesReceived) {
          videoBitrate = Math.round((report.bytesReceived * 8) / 1000);
        } else if (report.kind === 'audio' && report.bytesReceived) {
          audioBitrate = Math.round((report.bytesReceived * 8) / 1000);
        }
        
        if (report.packetsLost !== undefined) {
          packetsLost += report.packetsLost;
        }
        if (report.packetsReceived !== undefined) {
          packetsReceived += report.packetsReceived;
        }
      }
      
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        if (report.currentRoundTripTime !== undefined) {
          latency = Math.round(report.currentRoundTripTime * 1000);
        }
      }
    });
    
    // Calculate packet loss percentage
    if (packetsReceived > 0) {
      packetLoss = Math.round((packetsLost / (packetsLost + packetsReceived)) * 100);
    }
    
    // Update stats display
    videoStat.textContent = `${videoBitrate} kbps`;
    audioStat.textContent = `${audioBitrate} kbps`;
    latencyStat.textContent = `${latency} ms`;
    packetLossStat.textContent = `${packetLoss}%`;
    
    // Update connection quality indicator
    const connectionText = connectionIndicator.querySelector('.connection-text');
    connectionIndicator.classList.remove('good', 'fair', 'poor');
    
    if (latency < 150 && packetLoss < 2) {
      connectionIndicator.classList.add('good');
      connectionText.textContent = 'Good';
    } else if (latency < 300 && packetLoss < 5) {
      connectionIndicator.classList.add('fair');
      connectionText.textContent = 'Fair';
    } else {
      connectionIndicator.classList.add('poor');
      connectionText.textContent = 'Poor';
    }
  }, 1000);
}

function stopStatsMonitoring() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  connectionIndicator.classList.remove('active');
  networkStats.classList.remove('active');
}

// Data channel setup
function setupDataChannel(channel, peerId) {
  channel.onopen = () => {
    console.log('Data channel opened for', peerId);
    // Send initial username to peer
    try {
      channel.send(JSON.stringify({ type: 'username', username }));
    } catch (err) {
      // channel may not be open yet
    }
  };

  channel.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const p = peers[peerId];
    // update UI for specific peer slot
    const slotEl = getSlotElementFor(peerId);

    if (data.type === 'camera') {
      if (slotEl) {
        const overlay = slotEl.querySelector('.camera-off-overlay');
        overlay && overlay.classList.toggle('active', !data.enabled);
      }
      if (peerId === focusedPeerId) {
        remoteCameraOff.classList.toggle('active', !data.enabled);
      }
    } else if (data.type === 'mute') {
      if (slotEl) {
        const mutedEl = slotEl.querySelector('.muted-indicator');
        mutedEl && mutedEl.classList.toggle('active', data.muted);
      }
      if (peerId === focusedPeerId) {
        remoteMuted.classList.toggle('active', data.muted);
      }
    } else if (data.type === 'chat') {
      addMessage(data.message, 'received', data.username || (p && p.username) || 'Guest');
      // Show notification if chat is closed
      if (!chatPanel.classList.contains('open')) openChat.classList.add('has-new');
    } else if (data.type === 'username') {
      if (p) p.username = data.username || 'Guest';
      if (slotEl) {
        const nameTag = slotEl.querySelector('.slot-name');
        if (nameTag) nameTag.textContent = data.username || 'Guest';
      }
      if (peerId === focusedPeerId) {
        remoteNameTag.textContent = data.username || 'Guest';
      }
    }
  };
  
  channel.onerror = (error) => {
    console.error('Data channel error:', error);
  };
}

// Local video is now fixed in the thumbnail bar. Add click-to-focus handlers
const topThumbnails = document.getElementById('topThumbnails');

// clicking a thumbnail focuses that participant into the main view
topThumbnails?.addEventListener('click', (e) => {
  const slot = e.target.closest('.thumb-slot');
  if (!slot) return;

  // If the slot contains a video element with a stream, focus that on the main remote player
  const vid = slot.querySelector('video');
  if (vid && vid.srcObject) {
    // Set focused peer id (slot 0 = local)
    const idx = parseInt(slot.dataset.index);
    if (idx === 0) {
      focusedPeerId = null;
    } else {
      // find peer id that owns this slot
      const found = Object.entries(peers).find(([id, p]) => p.slotIndex === idx);
      focusedPeerId = found ? found[0] : null;
    }

    // Show the selected stream in the main area
    remoteVideo.srcObject = vid.srcObject;
    // Update the big name tag
    const nameTag = slot.querySelector('.slot-name');
    remoteNameTag.textContent = nameTag ? nameTag.textContent : 'Guest';
  }
});

// 1. Setup media sources

webcamButton.onclick = async () => {
  console.log('Webcam button clicked');
  try {
    console.log('Requesting media devices...');
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    console.log('Media devices granted:', localStream);
  } catch (error) {
    console.error('Error accessing media devices:', error);
    alert('Error accessing webcam: ' + error.message);
    return;
  }
  // For multi-peer, create per-peer tracks and create a remote stream slot for each peer
  Object.keys(peers).forEach(pid => {
    const p = peers[pid];
    if (p.pc) {
      localStream.getTracks().forEach(track => p.pc.addTrack(track, localStream));
    }
  });

  // show local preview in the local thumbnail and set main area to local (until someone else joins/focused)
  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = localStream;

  // Get available devices
  await getDevices();
  
  // Set current devices as selected
  const videoTrack = localStream.getVideoTracks()[0];
  const audioTrack = localStream.getAudioTracks()[0];
  if (videoTrack) {
    currentVideoDevice = videoTrack.getSettings().deviceId;
    videoSelect.value = currentVideoDevice;
  }
  if (audioTrack) {
    currentAudioDevice = audioTrack.getSettings().deviceId;
    audioSelect.value = currentAudioDevice;
  }

  // Ensure indicators are hidden initially (camera and audio are enabled by default)
  localMuted.classList.remove('active');
  localCameraOff.classList.remove('active');
  isMuted = false;
  isCameraOff = false;
  
  console.log('Initial state - isMuted:', isMuted, 'isCameraOff:', isCameraOff);
  console.log('localMuted classes:', localMuted.className);
  console.log('localCameraOff classes:', localCameraOff.className);
  console.log('Video track enabled:', videoTrack?.enabled);
  console.log('Audio track enabled:', audioTrack?.enabled);

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
  hangupButton.disabled = false;
  settingsButton.disabled = false;
  toggleMute.disabled = false;
  toggleCamera.disabled = false;
  toggleFullscreen.disabled = false;
};

// 2. Create an offer
callButton.onclick = async () => {
  // Generate short call ID (10 characters)
  const shortId = Math.random().toString(36).substring(2, 12);
  // Show modal with call ID
  callIdDisplay.value = shortId;
  createCallModal.classList.add('active');

  // Enter a room as the creator
  await enterCall(shortId, true);
  hangupButton.disabled = false;
};

// 3. Answer the call with the unique ID
confirmJoinCall.onclick = async () => {
  const callId = joinCallInput.value.trim();
  if (!callId) {
    alert('Please enter a call ID');
    return;
  }

  joinCallModal.classList.remove('active');
  // Enter existing room as a participant
  await enterCall(callId, false);
};

hangupButton.onclick = async () => {
  await leaveCall();
  hangupButton.disabled = true;
};
