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

// HTML elements
const webcamButton = document.getElementById('webcamButton');
const webcamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');

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

  callButton.disabled = false;
  answerButton.disabled = false;
  webcamButton.disabled = true;
  hangupButton.disabled = false;
};

// 2. Create an offer
callButton.onclick = async () => {
  // Generate short call ID (10 characters)
  const shortId = Math.random().toString(36).substring(2, 12);
  
  // Reference Firestore collections for signaling
  const callDoc = doc(db, 'calls', shortId);
  const offerCandidates = collection(callDoc, 'offerCandidates');
  const answerCandidates = collection(callDoc, 'answerCandidates');

  callInput.value = shortId;

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
answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = doc(db, 'calls', callId);
  const answerCandidates = collection(callDoc, 'answerCandidates');
  const offerCandidates = collection(callDoc, 'offerCandidates');

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
