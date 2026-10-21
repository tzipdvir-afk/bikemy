// Copies www/ into build/app/ for the Android app, leaving out the downloadable APK
// (otherwise every app build would bundle the previous APK inside itself).
// Also refreshes www/capacitor.js (Capacitor's JS runtime: registerPlugin etc.) from node_modules,
// and writes www/version.json from android/app/build.gradle so installed apps can offer the update.
import { cpSync, rmSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
copyFileSync('node_modules/@capacitor/core/dist/capacitor.js', 'www/capacitor.js');
const gradle = readFileSync('android/app/build.gradle', 'utf8');
const versionCode = +/versionCode\s+(\d+)/.exec(gradle)[1], versionName = /versionName\s+"([^"]+)"/.exec(gradle)[1];
writeFileSync('www/version.json', JSON.stringify({ versionCode, versionName }) + '\n');
rmSync('build/app', { recursive: true, force: true });
cpSync('www', 'build/app', { recursive: true, filter: src => !src.endsWith('.apk') });
