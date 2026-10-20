// Copies www/ into build/app/ for the Android app, leaving out the downloadable APK
// (otherwise every app build would bundle the previous APK inside itself).
import { cpSync, rmSync } from 'node:fs';
rmSync('build/app', { recursive: true, force: true });
cpSync('www', 'build/app', { recursive: true, filter: src => !src.endsWith('.apk') });
