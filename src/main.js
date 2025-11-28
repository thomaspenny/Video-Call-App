// Import styles
import '../style.css';

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, addDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
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
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let dataChannel = null;

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
const localCameraOff = document.getElementById('localCameraOff');
const remoteCameraOff = document.getElementById('remoteCameraOff');
const localMuted = document.getElementById('localMuted');
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
  
  // Update peer connection with new tracks
  if (pc) {
    const senders = pc.getSenders();
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];
    
    senders.forEach(sender => {
      if (sender.track.kind === 'video' && videoTrack) {
        sender.replaceTrack(videoTrack);
      } else if (sender.track.kind === 'audio' && audioTrack) {
        sender.replaceTrack(audioTrack);
      }
    });
  }
  
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
  
  // Send username update to remote peer
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify({ 
      type: 'username', 
      username: username
    }));
  }
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

chatInput.onkeypress = (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
};

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || !dataChannel || dataChannel.readyState !== 'open') return;
  
  // Add message to own chat
  addMessage(message, 'sent', username);
  
  // Send to remote peer
  dataChannel.send(JSON.stringify({ 
    type: 'chat', 
    message: message,
    username: username,
    timestamp: Date.now()
  }));
  
  chatInput.value = '';
}

function addMessage(text, type, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  
  const senderSpan = document.createElement('div');
  senderSpan.className = 'message-sender';
  senderSpan.textContent = sender || 'Guest';
  
  const messageText = document.createElement('span');
  messageText.textContent = text;
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'message-time';
  const now = new Date();
  timeSpan.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageDiv.appendChild(senderSpan);
  messageDiv.appendChild(messageText);
  messageDiv.appendChild(timeSpan);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Mute/Unmute microphone
toggleMute.onclick = () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isMuted = !audioTrack.enabled;
      toggleMute.classList.toggle('muted', isMuted);
      toggleMute.textContent = isMuted ? '🔇' : '🎤';
      localMuted.classList.toggle('active', isMuted);
      
      // Send mute state to remote peer
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'mute', muted: isMuted }));
      }
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
      localCameraOff.classList.toggle('active', isCameraOff);
      
      // Send camera state to remote peer
      if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(JSON.stringify({ type: 'camera', enabled: videoTrack.enabled }));
      }
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
    if (!pc) return;
    
    const stats = await pc.getStats();
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
function setupDataChannel(channel) {
  channel.onopen = () => {
    console.log('Data channel opened');
    // Send initial username
    channel.send(JSON.stringify({ 
      type: 'username', 
      username: username
    }));
  };
  
  channel.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'camera') {
      remoteCameraOff.classList.toggle('active', !data.enabled);
    } else if (data.type === 'mute') {
      remoteMuted.classList.toggle('active', data.muted);
    } else if (data.type === 'chat') {
      addMessage(data.message, 'received', data.username || 'Guest');
      // Show notification if chat is closed
      if (!chatPanel.classList.contains('open')) {
        openChat.classList.add('has-new');
      }
    } else if (data.type === 'username') {
      remoteNameTag.textContent = data.username || 'Guest';
    }
  };
  
  channel.onerror = (error) => {
    console.error('Data channel error:', error);
  };
}

// Make local video draggable and resizable
let isDragging = false;
let isResizing = false;
let currentX, currentY, initialX, initialY;
let initialWidth, initialHeight;

const videoWrapper = document.querySelector('.local-video-wrapper');
const resizeHandle = document.querySelector('.resize-handle');

videoWrapper.addEventListener('mousedown', startDrag);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', stopDrag);

function startDrag(e) {
  if (e.target === resizeHandle || e.target.closest('.resize-handle')) {
    isResizing = true;
    const rect = videoWrapper.getBoundingClientRect();
    initialWidth = rect.width;
    initialHeight = rect.height;
    webcamVideo.style.opacity = '0.3'; // Dim video during resize
    e.preventDefault();
  } else if (e.target === webcamVideo || e.target.closest('.local-video-wrapper')) {
    isDragging = true;
    const rect = videoWrapper.getBoundingClientRect();
    initialX = e.clientX - rect.left;
    initialY = e.clientY - rect.top;
    e.preventDefault();
  }
}

function drag(e) {
  if (isDragging) {
    e.preventDefault();
    const container = document.querySelector('.video-container');
    const containerRect = container.getBoundingClientRect();
    
    let newLeft = e.clientX - containerRect.left - initialX;
    let newTop = e.clientY - containerRect.top - initialY;
    
    // Keep within bounds
    const wrapperRect = videoWrapper.getBoundingClientRect();
    newLeft = Math.max(0, Math.min(newLeft, containerRect.width - wrapperRect.width));
    newTop = Math.max(0, Math.min(newTop, containerRect.height - wrapperRect.height));
    
    videoWrapper.style.left = newLeft + 'px';
    videoWrapper.style.top = newTop + 'px';
    videoWrapper.style.right = 'auto';
  } else if (isResizing) {
    e.preventDefault();
    const rect = videoWrapper.getBoundingClientRect();
    const newWidth = initialWidth + (e.clientX - rect.right);
    const newHeight = initialHeight + (e.clientY - rect.bottom);
    
    if (newWidth > 80 && newWidth < 600) {
      videoWrapper.style.width = newWidth + 'px';
      videoWrapper.style.height = (newWidth * 0.75) + 'px'; // Maintain aspect ratio
    }
  }
}

function stopDrag() {
  isDragging = false;
  if (isResizing) {
    webcamVideo.style.opacity = '1'; // Restore video
  }
  isResizing = false;
}

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
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // Pull tracks from remote stream, add to video stream
  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;

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
  
  // Reference Firestore collections for signaling
  const callDoc = doc(db, 'calls', shortId);
  const offerCandidates = collection(callDoc, 'offerCandidates');
  const answerCandidates = collection(callDoc, 'answerCandidates');

  // Show modal with call ID
  callIdDisplay.value = shortId;
  createCallModal.classList.add('active');

  // Create data channel for camera state
  dataChannel = pc.createDataChannel('cameraState');
  setupDataChannel(dataChannel);

  // Get candidates for caller, save to db
  pc.onicecandidate = (event) => {
    event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
  };

  // Create offer
  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);

  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type,
  };

  await setDoc(callDoc, { offer, createdAt: serverTimestamp() });

  // Start call timer
  startCallTimer();
  
  // Start stats monitoring
  startStatsMonitoring();
  
  // Show chat button
  openChat.classList.add('active');

  // Listen for remote answer
  onSnapshot(callDoc, (snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const answerDescription = new RTCSessionDescription(data.answer);
      pc.setRemoteDescription(answerDescription);
    }
  });

  // When answered, add candidate to peer connection
  onSnapshot(answerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });

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
  
  const callDoc = doc(db, 'calls', callId);
  const answerCandidates = collection(callDoc, 'answerCandidates');
  const offerCandidates = collection(callDoc, 'offerCandidates');

  // Listen for data channel from caller
  pc.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel(dataChannel);
  };

  pc.onicecandidate = (event) => {
    event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
  };

  const callData = (await getDoc(callDoc)).data();

  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    type: answerDescription.type,
    sdp: answerDescription.sdp,
  };

  await updateDoc(callDoc, { answer });

  // Start call timer
  startCallTimer();
  
  // Start stats monitoring
  startStatsMonitoring();
  
  // Show chat button
  openChat.classList.add('active');

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change);
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};
