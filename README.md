# Market Ledger POS (New Fish Center)

A comprehensive, full-stack Point of Sale (POS) and daily accounting ledger dashboard tailored for wholesale market operations. This application is a cross-platform (Web & Android APK) solution designed to handle rapid transactions, day closures, and real-time ledger synchronization.

## 🚀 Features

- **Cross-Platform Compatibility**: Fully responsive desktop workspace ("Laptop Hub") and native-feel mobile interface ("Android Mode") built with Capacitor.
- **Offline-First Capabilities**: Progressive Web App (PWA) architecture with local data persistence using IndexedDB/localStorage.
- **Real-Time Ledger Management ("Halkhata")**: End-of-day ledger locking, daily transaction summaries, and accounting snapshots.
- **Rapid Transaction Numpad**: Custom virtual numpad designed for ultra-fast, touch-friendly input in fast-paced retail environments.
- **Firebase Backend**: Real-time cloud synchronization, Google Workspace OAuth authentication, and secure Firestore database setup to persist transactions and user details.
- **Offline Sync Queuing**: Handles background state syncing when the network connection drops and restores.

## 🛠️ Tech Stack & Skills Demonstrated

- **Frontend Framework**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion (Animations), Lucide Icons
- **Backend & Database**: Firebase (Firestore, Authentication, Hosting)
- **Mobile Packaging**: Capacitor, Android Studio (APK generation)
- **State Management**: React Context API, Custom Hooks
- **Architecture**: Single Page Application (SPA) with offline-first synchronization logic

## 🧠 The "Vibe Coding" Experience

This project was built iteratively using AI-assisted "vibe coding"—partnering with an autonomous AI coding agent (Google AI Studio Build). It highlights the ability to:
- Rapidly prototype complex financial and UI logic using natural language prompting.
- Architect real-world cloud-synchronized ledgers.
- Iterate from a simple PWA to a full-fledged cross-platform (Web + Android APK) solution.

## 📦 Running the Project Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/market-ledger-pos.git
   cd market-ledger-pos
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Rename `.env.example` to `.env` and configure your Firebase credentials.

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Build for Production:**
   ```bash
   npm run build
   ```

## 📱 Building the Android APK

This project uses Capacitor for Android.
```bash
npm run build
npx cap sync android
npx cap open android
```
From Android Studio, you can build the signed APK.

## 📄 License
MIT License
