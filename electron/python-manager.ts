import { spawn, ChildProcess } from 'child_process'
import { app, BrowserWindow } from 'electron'
import http from 'http'
import https from 'https'
import path from 'path'
import net from 'net'
import { log } from './logger'

function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port
      server.close(() => resolve(port))
    })
  })
}

export class PythonManager {
  private static pythonProcess: ChildProcess | null = null
  public static port: number = 8742
  private static restartCount: number = 0
  private static readonly MAX_RESTARTS = 5
  private static stopped = false
  private static addinSideloaded = false

  /**
   * Protocolo detectado del backend durante el polling.
   *
   * El backend Python puede correr en HTTP o HTTPS. Cuando hay certificados
   * SSL disponibles (generados por ssl_cert_gen.py para el Word Add-in),
   * el backend arranca con HTTPS. El módulo ``http`` de Node.js NO soporta
   * HTTPS, así que necesitamos saber qué protocolo usar para las peticiones
   * del main process (polling de readiness + sideload del add-in).
   *
   * Se descubre durante ``pollBackend`` probando HTTPS primero y cayendo a
   * HTTP si no responde.
   */
  private static backendProtocol: 'https' | 'http' = 'https'

  static async start(): Promise<void> {
    this.port = await getFreePort()
    this.stopped = false
    this.restartCount = 0
    this.addinSideloaded = false
    this.backendProtocol = 'https'

    log('info', 'python-manager', `Iniciando backend Python...`, { port: this.port })

    return this.spawnAndPoll()
  }

  /**
   * Hace una petición GET al backend intentando HTTPS primero, luego HTTP.
   *
   * Node.js tiene módulos separados para HTTP y HTTPS (``http`` y ``https``).
   * No podemos usar ``fetch`` aquí porque estamos en el main process (Node),
   * no en el renderer (Chromium). El ``setCertificateVerifyProc`` solo aplica
   * a Chromium, no a Node.js, así que para HTTPS necesitamos
   * ``rejectUnauthorized: false`` para aceptar el cert auto-firmado.
   *
   * Retorna ``true`` si el backend respondió con status 200.
   */
  private static pingBackend(): Promise<boolean> {
    return new Promise((resolve) => {
      const tryHttps = () => {
        const req = https.get(
          `https://127.0.0.1:${this.port}/api/version`,
          { rejectUnauthorized: false, timeout: 2000 },
          (res) => {
            if (res.statusCode === 200) {
              this.backendProtocol = 'https'
              resolve(true)
            } else {
              resolve(false)
            }
            // Drenar el response para evitar que el socket se quede colgado
            res.resume()
          }
        )
        req.on('error', () => {
          // HTTPS falló — intentar HTTP como fallback
          tryHttp()
        })
        req.on('timeout', () => {
          req.destroy()
          tryHttp()
        })
      }

      const tryHttp = () => {
        const req = http.get(
          `http://127.0.0.1:${this.port}/api/version`,
          { timeout: 2000 },
          (res) => {
            if (res.statusCode === 200) {
              this.backendProtocol = 'http'
              resolve(true)
            } else {
              resolve(false)
            }
            res.resume()
          }
        )
        req.on('error', () => {
          resolve(false)
        })
        req.on('timeout', () => {
          req.destroy()
          resolve(false)
        })
      }

      tryHttps()
    })
  }

  /**
   * Registra el manifiesto del Add-in en el registro de Windows (sideload).
   *
   * Llama al endpoint GET /api/addin/registry-sideload del backend, que escribe
   * en HKCU\\Software\\Microsoft\\Office\\16.0\\Wef\\Developer\\WordAPA7 con la URL
   * del manifiesto dinámico. No requiere permisos de administrador (usa HKCU).
   *
   * Es idempotente: llamarlo múltiples veces actualiza la URL sin duplicar.
   * Solo se ejecuta una vez por sesión (bandera addinSideloaded).
   *
   * Usa el protocolo detectado durante ``pingBackend`` (HTTPS o HTTP).
   *
   * Si la operación es exitosa, envía el evento IPC 'addin-sideloaded' al
   * renderer para que muestre un toast informando al usuario.
   */
  private static sideloadAddin(): void {
    if (this.addinSideloaded) return
    if (process.platform !== 'win32') return

    const proto = this.backendProtocol
    const url = `${proto}://127.0.0.1:${this.port}/api/addin/registry-sideload`
    log('info', 'python-manager', 'Auto-sideload del Add-in de Word...', { url, proto })

    const requestLib = proto === 'https' ? https : http
    const options = proto === 'https'
      ? { rejectUnauthorized: false, timeout: 5000 }
      : { timeout: 5000 }

    requestLib.get(url, options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          const result = JSON.parse(body)
          if (result.status === 'ok') {
            this.addinSideloaded = true
            log('info', 'python-manager', 'Add-in registrado en Windows', {
              registry_key: result.registry_key,
              manifest_url: result.manifest_url,
            })
            // Notificar al renderer para que muestre un toast (solo primera vez)
            BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('addin-sideloaded', {
                status: 'ok',
                hint: result.hint,
                manifest_url: result.manifest_url,
              })
            })
          } else if (result.status === 'not_supported') {
            log('info', 'python-manager', 'Sideload no soportado en esta plataforma')
          }
        } catch {
          log('warn', 'python-manager', 'Respuesta de sideload no era JSON válido')
        }
      })
    }).on('error', (err) => {
      // El endpoint puede no existir si el backend no tiene addin_static montado.
      // No es crítico: el add-in se puede cargar manualmente.
      log('warn', 'python-manager', 'No se pudo auto-sideload el Add-in', { error: String(err) })
    })
  }

  private static spawnAndPoll(): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = 'python'
      let args: string[] = []

      if (app.isPackaged) {
        // El backend PyInstaller viaja en resources/python-backend/python-backend/
        // (extraResources: dist-python/ -> python-backend/). Este path DEBE
        // coincidir con el layout real del paquete, o el backend nunca arranca
        // y la app queda en "Conectando con el motor de procesamiento..." para siempre.
        command = path.join(process.resourcesPath, 'python-backend', 'python-backend', 'python-backend.exe')
        args = ['--port', String(this.port)]
      } else {
        const scriptPath = path.join(app.getAppPath(), 'python', 'main.py')
        // En desarrollo preferir el venv del repo; si no existe, el python del PATH.
        const venvPython = path.join(app.getAppPath(), 'venv', 'Scripts', 'python.exe')
        if (require('fs').existsSync(venvPython)) {
          command = venvPython
        }
        args = [scriptPath, '--port', String(this.port)]
      }

      // Kill any zombie process from a previous installation before starting
      if (process.platform === 'win32') {
        try {
          require('child_process').execSync('taskkill /F /IM python-backend.exe', { stdio: 'ignore' })
          log('info', 'python-manager', 'Zombies eliminados exitosamente')
        } catch (e) {
          // Normal if no zombie exists
        }
      }

      this.pythonProcess = spawn(command, args, {
        env: {
          ...process.env,
          APP_USERDATA: app.getPath('userData')
        },
        windowsHide: true,
      })

      if (this.pythonProcess.stdout) {
        this.pythonProcess.stdout.on('data', (data) => {
          log('info', 'python-stdout', data.toString().trim())
        })
      }

      // PyInstaller with console=False suppresses stdout on Windows, so we cannot wait for logs.
      // Instead, we poll the backend API until it responds.
      // IMPORTANTE: usamos pingBackend() que prueba HTTPS primero y cae a HTTP,
      // porque el backend puede correr con SSL (necesario para el Word Add-in).
      // El módulo ``http`` de Node.js NO soporta HTTPS, por lo que un ``http.get``
      // a un servidor HTTPS siempre falla — eso causaba que el polling nunca
      // pasara, el evento 'python-ready' nunca se disparara y el sideload del
      // add-in nunca se ejecutara.
      let retries = 0;
      const SOFT_TIMEOUT = 90; // Loguear advertencia a los 90s pero seguir intentando
      const pollBackend = async () => {
        if (this.stopped) return
        retries++;
        if (retries === SOFT_TIMEOUT) {
          log('warn', 'python-manager', `Backend tardó más de ${SOFT_TIMEOUT}s — seguimos esperando...`)
        }
        const ok = await this.pingBackend()
        if (ok) {
          log('info', 'python-manager', 'Backend Python listo y respondiendo', {
            retries,
            protocol: this.backendProtocol,
          })
          // Notify all renderer windows that Python is ready
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('python-ready')
          })
          // Auto-sideload del Add-in de Word: registrar el manifiesto en el
          // registro de Windows para que Word lo detecte automáticamente.
          // Se hace después de confirmar que el backend está listo, con un
          // pequeño delay para no competir con otras peticiones de arranque.
          setTimeout(() => { this.sideloadAddin() }, 2000)
          return resolve()
        } else {
          setTimeout(pollBackend, 1000)
        }
      }
      setTimeout(pollBackend, 1000)

      this.pythonProcess.stderr?.on('data', (data) => {
        log('error', 'python-stderr', data.toString().trim())
      })

      // Watchdog: si el backend crashea, reiniciarlo automáticamente (con tope)
      this.pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`)
        if (this.stopped) return
        if (this.restartCount >= this.MAX_RESTARTS) {
          log('error', 'python-manager', 'Backend crasheó demasiadas veces, se detiene el watchdog')
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('python-crashed')
          })
          return
        }
        this.restartCount++
        log('warn', 'python-manager', `Backend crasheó (código ${code}), reiniciando en 2s (intento ${this.restartCount})`)
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('python-restarting')
        })
        setTimeout(() => {
          if (!this.stopped) {
            this.spawnAndPoll().catch(err => {
              log('error', 'python-manager', `Reintento fallido: ${err}`)
            })
          }
        }, 2000)
      })

      this.pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process', err)
        reject(err)
      })
    })
  }

  static stop() {
    this.stopped = true
    if (this.pythonProcess) {
      this.pythonProcess.kill()
      this.pythonProcess = null
    }
  }
}
