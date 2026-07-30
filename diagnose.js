#!/usr/bin/env node
/**
 * diagnose.js
 * ------------------------------------------------------------
 * Sistema de diagnóstico para WordAPA7 (Electron + Python/FastAPI)
 *
 * QUÉ HACE:
 * 1. Lanza tu app empaquetada (o `electron .` en dev)
 * 2. Captura stdout/stderr del proceso Electron en tiempo real
 * 3. Al cerrar la app (o tras un timeout), lee:
 *      - debug.log de Electron  (app.getPath('userData')/debug.log)
 *      - el log del backend Python (mismo folder, python-backend.log)
 * 4. Fusiona TODO en una sola línea de tiempo ordenada por timestamp
 * 5. Detecta automáticamente errores, timeouts y tiempos de arranque
 * 6. Genera un reporte report-<fecha>.md listo para pegarle a tu IA
 *
 * USO:
 *   node diagnose.js                  -> corre la app empaquetada (dist/win-unpacked/*.exe)
 *   node diagnose.js --dev            -> corre `npm run dev` en su lugar
 *   node diagnose.js --timeout 30     -> mata el proceso tras 30s si no se cerró solo
 * ------------------------------------------------------------
 */
 
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
 
const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const timeoutIdx = args.indexOf('--timeout');
const timeoutSec = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 25;
 
const APP_EXE = process.platform === 'win32'
  ? path.join(__dirname, 'dist-electron-builder', 'win-unpacked', 'WordAPA7.exe')
  : path.join(__dirname, 'dist-electron-builder', 'WordAPA7');
 
function getUserDataPath() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, 'WordAPA7');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'WordAPA7');
  }
  return path.join(os.homedir(), '.config', 'WordAPA7');
}
 
const userDataPath = getUserDataPath();
const electronLogPath = path.join(userDataPath, 'debug.log');
const pythonLogPath = path.join(userDataPath, 'python-backend.log');
 
console.log(`\n🔎 Diagnóstico iniciado — modo: ${isDev ? 'dev' : 'empaquetado'}`);
console.log(`   Timeout: ${timeoutSec}s | userData: ${userDataPath}\n`);
 
const liveOutput = [];
const startTime = Date.now();
 
const child = isDev
  ? spawn('npm', ['run', 'electron:dev'], { shell: true })
  : spawn(APP_EXE, [], { shell: false });
 
child.stdout?.on('data', (d) => {
  const line = d.toString();
  liveOutput.push({ ts: new Date().toISOString(), source: 'stdout', line });
  process.stdout.write(line);
});
child.stderr?.on('data', (d) => {
  const line = d.toString();
  liveOutput.push({ ts: new Date().toISOString(), source: 'stderr', line });
  process.stderr.write(line);
});
 
const killTimer = setTimeout(() => {
  console.log(`\n⏱ Timeout de ${timeoutSec}s alcanzado, cerrando proceso...`);
  child.kill();
}, timeoutSec * 1000);
 
child.on('exit', (code) => {
  clearTimeout(killTimer);
  const elapsedMs = Date.now() - startTime;
  console.log(`\n✅ Proceso terminado (code=${code}) en ${elapsedMs}ms. Generando reporte...\n`);
  generateReport(code, elapsedMs);
});
 
function readJsonLogSafe(filePath) {
  if (!fs.existsSync(filePath)) return { entries: [], missing: true };
  const raw = fs.readFileSync(filePath, 'utf-8');
  const entries = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      entries.push({ ts: null, level: 'unknown', module: 'unparsed', msg: line });
    }
  }
  return { entries, missing: false };
}
 
function generateReport(exitCode, elapsedMs) {
  const electronLog = readJsonLogSafe(electronLogPath);
  const pythonLog = readJsonLogSafe(pythonLogPath);
 
  const merged = [...electronLog.entries, ...pythonLog.entries]
    .filter((e) => e.ts)
    .sort((a, b) => new Date(a.ts) - new Date(b.ts));
 
  const errors = merged.filter((e) => e.level === 'error' || /error|traceback|exception/i.test(e.msg || ''));
 
  const reportLines = [];
  reportLines.push(`# Reporte de diagnóstico — ${new Date().toISOString()}\n`);
  reportLines.push(`- Código de salida del proceso: **${exitCode}**`);
  reportLines.push(`- Tiempo total de ejecución: **${elapsedMs}ms**`);
  reportLines.push(`- Log de Electron encontrado: ${electronLog.missing ? '❌ NO (' + electronLogPath + ')' : '✅ sí'}`);
  reportLines.push(`- Log de Python encontrado: ${pythonLog.missing ? '❌ NO (' + pythonLogPath + ')' : '✅ sí'}`);
  reportLines.push(`- Errores detectados: **${errors.length}**\n`);
 
  if (errors.length > 0) {
    reportLines.push(`## ❌ Errores encontrados\n`);
    for (const e of errors) {
      reportLines.push(`- \`${e.ts}\` [${e.module || '?'}] ${e.msg}`);
    }
    reportLines.push('');
  }
 
  reportLines.push(`## 🧵 Línea de tiempo completa (Electron + Python fusionados)\n`);
  reportLines.push('```');
  for (const e of merged) {
    reportLines.push(`${e.ts} [${e.level || '?'}] [${e.module || '?'}] ${e.msg}`);
  }
  reportLines.push('```\n');
 
  reportLines.push(`## 📤 Salida cruda de consola (stdout/stderr)\n`);
  reportLines.push('```');
  for (const o of liveOutput) {
    reportLines.push(`[${o.ts}] (${o.source}) ${o.line.trim()}`);
  }
  reportLines.push('```');
 
  const reportPath = path.join(__dirname, `report-${Date.now()}.md`);
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');
 
  console.log(`📄 Reporte generado en: ${reportPath}`);
}
