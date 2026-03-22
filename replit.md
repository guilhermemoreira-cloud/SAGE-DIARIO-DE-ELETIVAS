# SAGE 2026 - Sistema de Gestão de Eletivas

## Overview
A static web application for managing elective courses ("eletivas") at EEMTI Filgueiras Lima school. The system supports student enrollment, teacher management, and schedule management for elective classes.

## Architecture
- **Type**: Pure static HTML/CSS/JavaScript — no backend, no build step
- **Runtime**: Node.js 20 (used only for serving static files via `npx serve`)
- **Database**: Firebase Firestore (cloud) with offline persistence enabled
- **External API**: Google Apps Script (Google Sheets integration for data sync)

## Project Structure
```
/
├── index.html              # Main entry point (profile/role selection)
├── selecionar-professor.html  # Teacher selection screen
├── selecionar-gestor.html     # Manager selection screen
├── professor.html          # Teacher dashboard
├── gestor.html             # Manager dashboard
├── gestao-completa.html    # Full management interface
├── css/
│   └── style.css           # Main stylesheet
├── js/
│   ├── config.js           # App configuration (Firebase, Google Sheets URLs, etc.)
│   ├── firebase-config.js  # Firebase initialization and connection
│   ├── firebase-sync.js    # Firebase synchronization logic
│   ├── utils.js            # Utility functions
│   ├── storage.js          # Local storage management
│   ├── init-data.js        # Data initialization
│   ├── sincronizacao.js    # Sync logic
│   ├── professor.js        # Teacher view logic
│   └── gestor.js           # Manager view logic
├── data/
│   └── dados-planilha.json # Local fallback data
├── assets/                 # Images (logos)
└── manifest.json           # PWA manifest
```

## Workflow
- **Start application**: `npx serve -s . -l 5000` (port 5000, webview)

## Deployment
- **Target**: Static
- **Public directory**: `.` (root)

## Firebase Configuration
- Project: `diario-sage`
- Auth Domain: `diario-sage.firebaseapp.com`
- Config is stored in `js/firebase-config.js` and `js/config.js`

## Key Notes
- The app uses Firebase Firestore for real-time sync and offline persistence
- Falls back to `localStorage` when offline
- Google Sheets integration via Apps Script for importing student/teacher data
- Portuguese (Brazilian) UI language

## Firebase Sync Architecture (updated)
- `firebase-sync.js` exports two new functions:
  - `carregarColecoesGestor()`: One-time async load of eletivas/alunos/matriculas/notas/liberacao_notas from Firestore, merging into state by ID
  - `escutarColecoesGestor(callback)`: Sets up real-time `onSnapshot` listeners on those collections; calls `callback(colecao)` on changes
- `professor.js` calls `carregarColecoesGestor()` on startup (1.5s delay to let Firebase init) and activates `escutarColecoesGestor()` for live updates; refreshes UI on every change
- `gestao-completa.js` also calls `carregarColecoesGestor()` on startup to get latest state
- Bug fixes: old student matriculas are now properly deleted from Firebase when editing a student; `removerEstudante` uses `deletarDadosFirebase` instead of saving null
