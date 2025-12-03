# Video Call App

A feature-rich, peer-to-peer video calling application built with WebRTC and Firebase Firestore. Connect with up to 10 participants simultaneously with real-time video, audio, and text chat.

This is a work in progress, expect bugs...

## 🌟 Features

### Core Functionality
- **Multi-party Video Calls**: Support for up to 10 participants in a single call
- **Peer-to-Peer Connection**: Direct WebRTC connections for low-latency communication
- **Real-time Chat**: Built-in text chat with message history
- **Screen Layout**: Thumbnail grid view with focus mode for active speaker

### Media Controls
- **Camera Toggle**: Turn video on/off during calls
- **Microphone Mute**: Toggle audio with visual indicators
- **Device Selection**: Choose from multiple cameras, microphones, and speakers
- **Fullscreen Mode**: Immersive viewing experience

### Call Management
- **Easy Sharing**: Share call invitations via Gmail or Outlook
- **Simple Join Process**: Join calls using a unique call ID
- **Visual Indicators**: Connection quality, mute status, and camera state
- **Call Timer**: Track call duration

### User Experience
- **Custom Usernames**: Set and display personalized names
- **Connection Stats**: Real-time network quality monitoring (optional)
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode Interface**: Modern, eye-friendly design

## 🚀 Live Demo

Visit the live application: [https://thomaspenny.github.io/Video-Call-App/](https://thomaspenny.github.io/Video-Call-App/)

## 🛠️ Technologies Used

- **WebRTC**: Real-time peer-to-peer communication
- **Firebase Firestore**: Signaling server and participant management
- **Vite**: Fast build tool and development server
- **Vanilla JavaScript**: Lightweight, no framework dependencies
- **CSS3**: Modern styling with flexbox and animations

## 📋 Prerequisites

- Modern web browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- Camera and microphone permissions
- Stable internet connection

## 🔧 Installation & Setup

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/thomaspenny/Video-Call-App.git
   cd Video-Call-App
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173` (or the port shown in terminal)

### Production Build

```bash
npm run build
```

The optimized build will be created in the `dist/` directory.

### Deploy to GitHub Pages

```bash
npm run deploy
```

## 📖 How to Use

### Starting a Call

1. Click **"Start Webcam"** to enable your camera and microphone
2. Click **"Create Call"** to start a new call
3. Share the generated Call ID with participants via email or manually
4. Wait for others to join

### Joining a Call

1. Click **"Start Webcam"** to enable your camera and microphone
2. Click **"Join Call"**
3. Enter the Call ID provided by the host
4. Click **"Join"** to connect

### During a Call

- **Toggle Video**: Click the camera icon to turn your camera on/off
- **Toggle Audio**: Click the microphone icon to mute/unmute
- **Open Chat**: Click the chat icon to send text messages
- **Switch View**: Click on any participant thumbnail to focus on them
- **Fullscreen**: Click the fullscreen icon for immersive mode
- **Settings**: Access device settings to change camera/microphone
- **End Call**: Click "Hangup" to leave the call

## 🔐 Privacy & Security

- All video and audio streams use encrypted peer-to-peer connections
- Firebase is only used for signaling; media streams are never sent through servers
- No call recordings or data storage
- Participant data is automatically deleted when leaving calls

## 🏗️ Project Structure

```
Video-Call-App/
├── src/
│   └── main.js          # Main application logic
├── index.html           # HTML structure
├── style.css            # Styling and layout
├── vite.config.js       # Vite configuration
├── package.json         # Dependencies and scripts
└── README.md           # Documentation
```

## 🐛 Known Issues & Troubleshooting

### Camera/Microphone Not Working
- Ensure browser permissions are granted
- Check if another application is using the devices
- Try refreshing the page and granting permissions again

### Connection Issues
- Check your internet connection
- Ensure firewall/antivirus isn't blocking WebRTC
- Try using a different network (avoid restrictive corporate networks)

### Third Person Cannot Join
- Maximum of 10 participants supported
- Ensure the call creator hasn't left (room remains active)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

**Thomas Penny**
- GitHub: [@thomaspenny](https://github.com/thomaspenny)


