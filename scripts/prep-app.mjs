// Copies www/ into build/app/ for the Android app, leaving out the downloadable APK
// (otherwise every app build would bundle the previous APK inside itself).
// Also refreshes www/capacitor.js (Capacitor's JS runtime: registerPlugin etc.) from node_modules.
import { cpSync, rmSync, copyFileSync } from 'node:fs';
copyFileSync('node_modules/@capacitor/core/dist/capacitor.js', 'www/capacitor.js');
rmSync('build/app', { recursive: true, force: true });
cpSync('www', 'build/app', { recursive: true, filter: src => !src.endsWith('.apk') });
