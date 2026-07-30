import sys
import time
import logging
import threading
import psutil
from typing import Any

logger = logging.getLogger(__name__)

class WordCOMService:
    def __init__(self):
        self._lock = threading.Lock()
        self.is_windows = sys.platform == "win32"
        self._word = None
        self._pid = None

    def is_available(self) -> bool:
        if not self.is_windows:
            return False
        try:
            import win32com.client
            return True
        except ImportError:
            return False

    def start(self):
        if not self.is_available():
            return
        with self._lock:
            if self._word is not None:
                return
            try:
                import pythoncom
                import win32com.client
                pythoncom.CoInitialize()
                
                pids_before = set(p.pid for p in psutil.process_iter(['name']) if p.info['name'] == 'WINWORD.EXE')
                self._word = win32com.client.DispatchEx("Word.Application")
                pids_after = set(p.pid for p in psutil.process_iter(['name']) if p.info['name'] == 'WINWORD.EXE')
                new_pids = pids_after - pids_before
                if new_pids:
                    self._pid = new_pids.pop()
                    
                self._word.Visible = False
                self._word.DisplayAlerts = 0
                logger.info(f"[WordCOMService] Instancia compartida de Word iniciada (PID: {self._pid}).")
            except Exception as e:
                logger.error(f"[WordCOMService] Error iniciando Word: {e}")
                self._word = None

    def stop(self):
        with self._lock:
            if self._word:
                try:
                    self._word.Quit(0)
                except Exception:
                    pass
                self._word = None
            if self._pid:
                try:
                    p = psutil.Process(self._pid)
                    if p.name() == 'WINWORD.EXE':
                        p.kill()
                        time.sleep(0.5)
                except Exception:
                    pass
                self._pid = None

    @property
    def word(self) -> Any:
        # Permite uso en distintos threads asegurando CoInitialize
        import pythoncom
        try:
            pythoncom.CoInitialize()
        except Exception:
            pass
            
        with self._lock:
            if not self._word:
                self.start()
            else:
                try:
                    _ = self._word.Name
                except Exception:
                    logger.warning("[WordCOMService] Instancia de Word muerta, reiniciando...")
                    self.stop()
                    self.start()
            
            # Para usar en el thread actual, obtenemos una referencia dinámica desde el ROT 
            # (Running Object Table) o pasamos el DispatchEx.
            # Pero pythoncom / win32com no permite compartir el mismo objeto _word entre hilos fácilmente
            # sin hacer un marshall. Para simplificar y cumplir con el plan, devolvemos un Dispatch al proceso actual.
            if self._word:
                try:
                    import win32com.client
                    return win32com.client.Dispatch("Word.Application")
                except Exception:
                    return self._word
            return None

# Singleton
_word_com_service = WordCOMService()

def get_word_com_service() -> WordCOMService:
    return _word_com_service
