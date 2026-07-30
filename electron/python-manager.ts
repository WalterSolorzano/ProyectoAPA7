import { spawn, ChildProcess } from 'child_process'
import { app, BrowserWindow } from 'electron'
import http from 'http'
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

  static async start(): Promise<void> {
    this.port = await getFreePort()
    
    log('info', 'python-manager', `Iniciando backend Python...`, { port: this.port })

    return new Promise((resolve, reject) => {
      let command = 'python'
      let args: string[] = []

      if (app.isPackaged) {
        command = path.join(process.resourcesPath, 'python-backend', 'wordapa7-backend', 'wordapa7-backend.exe')
        args = ['--port', String(this.port)]
      } else {
        const scriptPath = path.join(app.getAppPath(), 'python', 'main.py')
        args = [scriptPath, '--port', String(this.port)]
      }

      // Kill any zombie process from a previous installation before starting
      if (process.platform === 'win32') {
        try {
          require('child_process').execSync('taskkill /F /IM wordapa7-backend.exe', { stdio: 'ignore' })
          log('info', 'python-manager', 'Zombies eliminados exitosamente')
        } catch (e) {
          // Normal if no zombie exists
        }
      }

      this.pythonProcess = spawn(command, args, {
        env: {
          ...process.env,
          APP_USERDATA: app.getPath('userData')
        }
      })

      if (this.pythonProcess.stdout) {
        this.pythonProcess.stdout.on('data', (data) => {
          log('info', 'python-stdout', data.toString().trim())
        })
      }

      // PyInstaller with console=False suppresses stdout on Windows, so we cannot wait for logs.
      // Instead, we poll the backend API until it responds.
      let retries = 0;
      const maxRetries = 30; // 30 seconds timeout
      const pollBackend = () => {
        if (retries >= maxRetries) {
          log('error', 'python-manager', 'Python backend failed to start (timeout)')
          return reject(new Error('Python backend failed to start (timeout).'))
        }
        retries++;
        http.get(`http://127.0.0.1:${this.port}/api/version`, (res) => {
          if (res.statusCode === 200) {
            log('info', 'python-manager', 'Backend Python listo y respondiendo', { retries })
            // Notify all renderer windows that Python is ready
            BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('python-ready')
            })
            return resolve()
          } else {
            setTimeout(pollBackend, 1000)
          }
        }).on('error', () => {
          setTimeout(pollBackend, 1000)
        })
      }
      setTimeout(pollBackend, 1000)

      this.pythonProcess.stderr?.on('data', (data) => {
        log('error', 'python-stderr', data.toString().trim())
      })

      this.pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`)
      })

      this.pythonProcess.on('error', (err) => {
        console.error('Failed to start Python process', err)
        reject(err)
      })
    })
  }

  static stop() {
    if (this.pythonProcess) {
      this.pythonProcess.kill()
      this.pythonProcess = null
    }
  }
}
