# 🎥 Pure PeerJS Video Call App

**100% Frontend - No Backend Needed!**

## ✨ Features

- ✅ Pure P2P mesh topology (3-4 users)
- ✅ Uses free PeerServer Cloud (no backend)
- ✅ Screen sharing
- ✅ Audio/video controls
- ✅ Room management
- ✅ Copy room link
- ✅ Responsive design

## 🚀 Deploy Anywhere (Static Hosting)

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd peerjs-pure-frontend
vercel
```

### Option 2: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd peerjs-pure-frontend
netlify deploy --prod
```

### Option 3: GitHub Pages

1. Push to GitHub
2. Settings → Pages
3. Select branch → Save
4. Done!

### Option 4: Railway (Static Site)

1. New Project → Static Site
2. Root Directory: `peerjs-pure-frontend`
3. Deploy!

## 📁 Files

```
peerjs-pure-frontend/
├── index.html    ← Main HTML
├── app.js        ← JavaScript logic
├── styles.css    ← Styling
└── README.md     ← This file
```

## 🎯 How It Works

1. **Room Host** creates room → Gets peer ID
2. **Room ID** = Host's peer ID
3. **Joiners** connect to host's peer ID
4. **Mesh topology** - All connect to all
5. **PeerServer Cloud** handles signaling (free!)

## 🔧 No Configuration Needed!

- ✅ No backend server
- ✅ No environment variables
- ✅ No CORS issues
- ✅ Just deploy and use!

## 📊 Architecture

```
User A (Host) ←→ User B
     ↕              ↕
User C ←→ User D

All connections are P2P via PeerJS
Signaling via PeerServer Cloud (free)
```

## 🧪 Test Locally

```bash
# Option 1: Python
cd peerjs-pure-frontend
python -m http.server 8000

# Option 2: Node.js
npx serve peerjs-pure-frontend

# Option 3: VS Code Live Server
# Right-click index.html → Open with Live Server
```

Open `http://localhost:8000` in multiple tabs to test!

## ✅ Advantages

- **No Backend** - Pure frontend
- **Free Forever** - PeerServer Cloud is free
- **Simple** - Just HTML/CSS/JS
- **Fast** - No server latency
- **Scalable** - Deploy anywhere
- **Reliable** - P2P mesh topology

## 🎉 Result

**One deployment = Everything works!**

- ✅ No backend needed
- ✅ Free signaling
- ✅ Works globally
- ✅ Simple and reliable

---

**Deploy and enjoy!** 🚀

