# Android APK Setup & Build Guide

This guide will help you convert your WebRTC web app into an Android APK that works globally.

## Prerequisites

1. **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
2. **Android Studio** - [Download](https://developer.android.com/studio)
3. **Java JDK** (11 or higher) - Usually comes with Android Studio
4. **Git** (optional, for deployment)

## Step 1: Deploy Backend Server Globally

Your backend server needs to be accessible globally, not just on localhost. Here are free hosting options:

### Option A: Railway (Recommended - Free Tier Available)

1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo" (or use Railway CLI)
3. Connect your repository or upload files
4. Railway will auto-detect Node.js and deploy
5. Your server URL will be: `https://your-app-name.railway.app`
6. Copy this URL - you'll need it for the app

### Option B: Render (Free Tier Available)

1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your repository or upload files
4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Your server URL will be: `https://your-app-name.onrender.com`

### Option C: Heroku (Free Tier Discontinued, but works)

1. Install Heroku CLI: `npm install -g heroku`
2. Run: `heroku login`
3. Run: `heroku create your-app-name`
4. Run: `git push heroku main`
5. Your server URL will be: `https://your-app-name.herokuapp.com`

### Important: Update Server URL in Frontend

After deploying, update `public/index.html`:

```javascript
window.SERVER_URL = 'https://your-deployed-server-url.com';
```

## Step 2: Install Capacitor

Capacitor converts your web app into a native Android app.

```bash
npm install
npm install @capacitor/cli @capacitor/core @capacitor/android --save-dev
```

## Step 3: Initialize Capacitor

```bash
# Initialize Capacitor (if not already done)
npx cap init

# Add Android platform
npx cap add android
```

## Step 4: Configure Android Permissions

Capacitor should create `android/app/src/main/AndroidManifest.xml`. Ensure it has:

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
    
    <application
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config"
        ...>
```

## Step 5: Create Network Security Config

Create `android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

## Step 6: Sync Web Assets

After making changes to your web app:

```bash
npx cap sync
```

This copies your `public` folder to the Android app.

## Step 7: Open in Android Studio

```bash
npx cap open android
```

This will open your project in Android Studio.

## Step 8: Build APK in Android Studio

1. In Android Studio, go to **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Wait for the build to complete
3. Click **locate** when done
4. The APK will be in: `android/app/build/outputs/apk/release/app-release.apk`

## Step 9: Build Signed APK (For Distribution)

1. In Android Studio: **Build** → **Generate Signed Bundle / APK**
2. Select **APK**
3. Create a new keystore (first time only):
   - Click **Create new...**
   - Fill in details (store password, key alias, key password)
   - Save the keystore file securely
4. Select your keystore and enter passwords
5. Click **Next** → **release** → **Finish**
6. Your signed APK will be in: `android/app/release/app-release.apk`

## Step 10: Install APK on Android Device

### Option A: Direct Transfer
1. Transfer the APK file to your Android device (USB, email, cloud storage)
2. On your device, open the APK file
3. Allow "Install from unknown sources" if prompted
4. Install the app

### Option B: ADB (Android Debug Bridge)
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

## Troubleshooting

### App won't connect to server
- Check that `SERVER_URL` in `index.html` matches your deployed server
- Ensure server is running and accessible
- Check device has internet connection
- For HTTP (non-HTTPS) servers, ensure `cleartextTrafficPermitted="true"` in manifest

### Camera/Microphone not working
- Check Android permissions are granted in device settings
- Ensure manifest has camera and audio permissions
- Test on a physical device (emulators may have issues)

### Build errors
- Ensure Android Studio is up to date
- Check Java JDK version (should be 11+)
- Clean build: **Build** → **Clean Project**
- Rebuild: **Build** → **Rebuild Project**

### WebRTC not working
- Ensure you're using HTTPS (or cleartext for development)
- Check STUN servers are accessible
- Some networks block WebRTC - try different network

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Sync web assets to native
npx cap sync

# Open Android Studio
npx cap open android

# Build release APK (command line)
cd android && ./gradlew assembleRelease
```

## Distribution

### For Testing
- Share APK directly via email, cloud storage, or file sharing

### For Production
- Upload to Google Play Store (requires developer account - $25 one-time fee)
- Use Firebase App Distribution for beta testing
- Use internal distribution channels

## Important Notes

1. **Server URL**: Must be updated in `public/index.html` before building APK
2. **Permissions**: Users will be prompted for camera/mic permissions on first use
3. **HTTPS**: For production, use HTTPS for your server (free SSL from Let's Encrypt)
4. **Testing**: Always test on real devices, not just emulators
5. **Security**: For production, use signed APKs and proper security configurations

## Next Steps

1. Deploy your backend server
2. Update `SERVER_URL` in `index.html`
3. Build and test the APK
4. Distribute to users

Good luck! 🚀

