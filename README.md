# 🛡️ Zcash Shielded Viewer

A modern, lightweight desktop application for managing and viewing Zcash (ZEC) shielded transaction history. Built with **Tauri (Rust)** for a secure, high-performance backend and **React** for a responsive, dark-mode UI.

## 🚀 What This App Does

This is a specialized "Light Wallet" viewer. Unlike full nodes that require downloading 300GB+ of blockchain data, this app connects to public `lightwalletd` servers to sync only the data relevant to your keys.

- **Privacy First**: Uses Zcash's zero-knowledge proof technology (via `zingolib`) to view shielded balances and transactions.
- **Dual Network Support**: Switch instantly between **Testnet** (safe for testing) and **Mainnet** (real funds) with separated databases.
- **Fast Sync**: Supports "Wallet Birthday" scanning to skip years of history and sync in seconds.
- **Detailed Analytics**:
    - View Total Inflow vs. Outflow.
    - See raw Transaction IDs (TXID) and Memos.
    - Inspect raw backend logs for developer verification.

## 🛠️ Technology Stack

This project solves the "dependency hell" often associated with Zcash development by using a hybrid architecture:

### Frontend: React (Vite + TypeScript)
- Handles UI, parsing logs, and calculating stats.
- Communicates with Rust via Tauri commands.

### Backend: Rust (Tauri v2)
- **Core Engine**: `zingolib` (The official library behind Zingo! Mobile).
- **Cryptography**: `librustzcash` (managed via Git patches to ensure compatibility).
- **Networking**: `rustls` (configured with `ring` provider for stability).

## ⚙️ Setup & Installation

### Prerequisites
- **Node.js**: v18+
- **Rust**: Latest Stable
- **Protobuf Compiler**: Required for gRPC
    - **Ubuntu/WSL**: `sudo apt install protobuf-compiler libssl-dev pkg-config`
    - **Mac**: `brew install protobuf`
    - **Windows**: `choco install protoc`

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/zcash-viewer.git
cd zcash-viewer
npm install
```

### 2. Initialize Rust Backend

The `src-tauri` folder contains the Rust logic. We need to ensure the heavy cryptographic libraries are downloaded and compiled correctly.

```bash
cd src-tauri
# This aligns all Zcash versions to match zingolib's requirements
cargo update 
cd ..
```

### 3. Run in Development Mode

This starts the React dev server and compiles the Rust backend.

```bash
npm run tauri dev
```

> **Note**: First run may take 5-10 minutes to compile `librustzcash`.

## 🧠 How It Works (The "Secret Sauce")

We overcame several critical technical challenges to make this work:

### 1. The "Lazy Sync" Fix
Zcash libraries often optimize by skipping re-scans. This app implements a "Nuclear Option" logic:
- When you request a scan from Block 0 (Start of time), the backend automatically deletes the local database.
- This forces a clean, cryptographic re-verification of the blockchain, ensuring no transaction is ever missed.

### 2. The Dependency Patch
`zingolib` uses a "bleeding edge" version of the Zcash protocol that isn't on crates.io yet. We solved this by adding a specific `[patch.crates-io]` section in `Cargo.toml` that redirects all Zcash library requests to a specific commit hash (`3ba772c9b8`), preventing version conflicts.

### 3. Dynamic Network Switching
The app maintains two completely separate database directories:
- `zcash_data_mainnet`
- `zcash_data_testnet`

When you toggle the switch in the UI, the Rust backend instantly swaps context, ensuring you never accidentally mix real and test funds.

## 🏗️ Building for Production

To create a standalone executable (`.exe`, `.dmg`, or `.deb`):

1. Update identifier in `src-tauri/tauri.conf.json` to something unique (e.g., `com.myname.zcashviewer`).
2. Run the build command:

```bash
npm run tauri build
```

3. Find your app in `src-tauri/target/release/bundle/`.

> **Note for Windows Users**: If developing on WSL (Linux Subsystem), you cannot build `.exe` files directly. Push your code to GitHub and use GitHub Actions to build the Windows binary automatically.

## 📝 License

This project is open-source and intended for educational and personal use.

> **Disclaimer**: Zcash privacy relies on complex cryptography. While this viewer uses official libraries, always exercise caution when handling real funds and viewing keys.