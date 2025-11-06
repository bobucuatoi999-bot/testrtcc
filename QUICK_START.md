# Quick Start Guide - Android APK

This is a simplified guide to get your WebRTC app running as an Android APK.

## 🎯 Overview

You need to:
1. Deploy backend server (so it's accessible globally)
2. Update server URL in frontend
3. Build Android APK
4. Install on Android device

---

## 📋 Step-by-Step

### Step 1: Deploy Backend Server (5-10 minutes)

**Easiest Option: Railway**

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your repo OR upload your project files
4. Wait for deployment (2-5 minutes)
5. Copy your server URL (e.g., `https://your-app.railway.app`)

**Alternative: Render**
1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect repo or upload files
4. Set Build: `npm install`, Start: `npm start`
5. Copy your server URL

---

### Step 2: Update Frontend Configuration (1 minute)

Edit `public/config.js`:
```javascript
// Replace with your deployed server URL
window.SERVER_URL = 'https://your-app.railway.app';
```

Save the file.

---

### Step 3: Install Capacitor (2 minutes)

```bash
npm install
npm install @capacitor/cli @capacitor/core @capacitor/android --save-dev
```

---

### Step 4: Initialize Capacitor (2 minutes)

```bash
# Initialize Capacitor
npx cap init

# When prompted:
# - App name: WebRTC Call
# - App ID: com.webrtc.call.app
# - Web dir: public

# Add Android platform
npx cap add android
```

---

### Step 5: Configure Android Permissions (3 minutes)

After running `npx cap add android`, Capacitor creates the Android project.

1. Navigate to `android/app/src/main/`
2. Create folder `res/xml` if it doesn't exist
3. Copy `network-security-config.xml` to `android/app/src/main/res/xml/`
4. Edit `android/app/src/main/AndroidManifest.xml` and ensure it has:
   - Camera permission
   - Audio permission
   - Internet permission
   - `android:usesCleartextTraffic="true"` in `<application>`
   - `android:networkSecurityConfig="@xml/network_security_config"` in `<application>`

See `android-manifest-template.xml` for reference.

---

### Step 6: Sync and Open (2 minutes)

```bash
# Sync web assets to Android
npx cap sync

# Open in Android Studio
npx cap open android
```

---

### Step 7: Build APK in Android Studio (5-10 minutes)

1. **Wait for Gradle sync** (first time takes 5-10 minutes)
2. Go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. Wait for build to complete
4. Click **locate** when done
5. APK is at: `android/app/build/outputs/apk/release/app-release.apk`

---

### Step 8: Install on Android Device

**Option A: Direct Transfer**
1. Transfer APK to your phone (USB, email, cloud)
2. Open APK file on phone
3. Allow "Install from unknown sources"
4. Install

**Option B: ADB**
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## ✅ Testing Checklist

- [ ] Backend server deployed and accessible
- [ ] Server URL updated in `public/config.js`
- [ ] App installed on Android device
- [ ] Permissions granted (camera, microphone)
- [ ] Can enter name and room code
- [ ] Can start video/voice call
- [ ] Can see/hear other user
- [ ] Mute button works
- [ ] End call button works

---

## 🐛 Common Issues

### "Can't connect to server"
- ✅ Check `SERVER_URL` in `config.js` matches deployed server
- ✅ Test server URL in browser first
- ✅ Check device has internet connection

### "Camera/Mic not working"
- ✅ Grant permissions in Android Settings → Apps → WebRTC Call → Permissions
- ✅ Test on real device (not emulator)
- ✅ Check manifest has permissions

### "Build failed"
- ✅ Update Android Studio
- ✅ Check Java JDK version (should be 11+)
- ✅ Clean build: Build → Clean Project

---

## 📱 What Users Will Experience

1. **Open app** → See name and room code input
2. **Enter name** → e.g., "John"
3. **Enter room code** → e.g., "room123"
4. **Click "Start Video Call"** → Permission prompts appear
5. **Allow camera/mic** → Connection starts
6. **Wait for other user** → When someone joins same room, call connects
7. **Video/voice works** → Can see and hear each other
8. **Mute/Unmute** → Toggle audio
9. **End Call** → Disconnects and cleans up

---

## 🚀 Next Steps

1. **Test thoroughly** on multiple devices
2. **Build signed APK** for distribution (see ANDROID_SETUP.md)
3. **Share APK** with users
4. **Consider Play Store** for wider distribution

---

## 📚 Full Documentation

- **ANDROID_SETUP.md** - Detailed Android setup
- **DEPLOYMENT_GUIDE.md** - Backend deployment options
- **README.md** - General project info

---

## 💡 Tips

- **HTTPS**: For production, use HTTPS for your server (free SSL from Let's Encrypt)
- **Testing**: Always test on real devices, emulators may have WebRTC issues
- **Distribution**: Use Firebase App Distribution for beta testing
- **Monitoring**: Monitor server logs for connection issues

Good luck! 🎉

