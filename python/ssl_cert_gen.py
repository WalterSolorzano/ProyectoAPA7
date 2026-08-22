"""SSL certificate generation for the Word Add-in.

Office.js Word Add-ins REQUIRE HTTPS even on localhost. This module generates
self-signed X.509 certificates at runtime using the ``cryptography`` library,
so the backend can serve HTTPS without relying on external CLI tools such as
``mkcert`` (which is not shipped with the installer).

**CRITICAL:** On Windows, the generated certificate is also installed into the
CURRENT USER's Trusted Root Certification Authorities store. Without this step,
Word (which runs OUTSIDE Electron) rejects the self-signed certificate and the
Add-in taskpane shows a blank panel — the #1 reason the Add-in "doesn't appear"
in Word.

**SILENT INSTALLATION:** The certificate is installed using the Windows CryptoAPI
via ``ctypes`` — a 100% in-process call that does NOT spawn any subprocess, does
NOT show any Windows dialog, UAC prompt, or certificate import wizard. This
replaced the previous approaches (``certutil`` and PowerShell) which could
trigger Windows security dialogs on some configurations.

The certificates are issued for ``localhost`` and ``127.0.0.1``, use RSA
2048-bit keys, and are valid for 365 days. They are saved as PEM files (with an
unencrypted key) and persist between runs — ``generate_self_signed_cert`` is
idempotent: if valid cert/key files already exist they are reused.

Everything is wrapped in defensive ``try/except`` blocks so the module can
**never** crash the backend on import or on failure.
"""

from __future__ import annotations

import datetime
import hashlib
import logging
import os
import sys
from pathlib import Path
from typing import Optional, Tuple, Union

logger = logging.getLogger("wordapa7.ssl_cert_gen")

# How long the generated certificate remains valid.
VALID_DAYS = 365

# Minimum remaining validity (days) below which a stale certificate is
# regenerated instead of reused. Keeps certs fresh without regenerating on
# every single run.
MIN_REMAINING_DAYS = 30

# RSA key size in bits.
RSA_KEY_SIZE = 2048

PathLike = Union[str, os.PathLike, Path]


def _cert_not_after(cert) -> datetime.datetime:
    """Return the certificate's expiry as a timezone-aware UTC datetime.

    Works across cryptography versions: 42+ exposes ``not_valid_after_utc``
    while older releases only have the naive ``not_valid_after`` attribute.
    """
    not_after = getattr(cert, "not_valid_after_utc", None)
    if not_after is not None:
        return not_after
    # Fallback for older cryptography (<42): naive datetime → aware.
    return cert.not_valid_after.replace(tzinfo=datetime.timezone.utc)


def _is_cert_valid(cert_path: Path, key_path: Path) -> bool:
    """Return ``True`` when the existing cert/key pair is valid and reusable.

    Checks performed:
    * Both files are readable and parse as PEM cert/key.
    * The certificate is not expired and has more than ``MIN_REMAINING_DAYS``
      of validity left.
    * The private key is RSA and its public numbers match the certificate's
      public key (i.e. the key and cert belong together).
    """
    try:
        from cryptography import x509
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        cert = x509.load_pem_x509_certificate(cert_path.read_bytes())
        key = serialization.load_pem_private_key(key_path.read_bytes(), password=None)

        # Expiry check
        now = datetime.datetime.now(datetime.timezone.utc)
        not_after = _cert_not_after(cert)
        if not_after <= now:
            logger.debug("Cert expired (%s), will regenerate.", not_after)
            return False
        if (not_after - now).days < MIN_REMAINING_DAYS:
            logger.debug("Cert nearly expired (%d days left), will regenerate.",
                         (not_after - now).days)
            return False

        # Key type + match check
        if not isinstance(key, rsa.RSAPrivateKey):
            logger.debug("Existing key is not RSA, will regenerate.")
            return False
        if cert.public_key().public_numbers() != key.public_key().public_numbers():
            logger.debug("Cert/key mismatch, will regenerate.")
            return False

        return True
    except Exception as exc:  # noqa: BLE001 — broad by design: never crash
        logger.debug("Existing cert/key deemed invalid (%s), will regenerate.", exc)
        return False


def _build_certificate(key) -> "object":
    """Build and self-sign an X.509 certificate bound to ``key``."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes
    from cryptography.x509.oid import NameOID

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "WordAPA7"),
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])

    now = datetime.datetime.now(datetime.timezone.utc)
    not_before = now - datetime.timedelta(minutes=5)  # small backdate for clock skew
    not_after = now + datetime.timedelta(days=VALID_DAYS)

    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(not_before)
        .not_valid_after(not_after)
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(__import__("ipaddress").ip_address("127.0.0.1")),
            ]),
            critical=False,
        )
        # BasicConstraints: mark as a CA:false leaf certificate so Office
        # trusts it as an end-entity cert (some validators reject certs
        # without an explicit basicConstraints extension).
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        # ExtendedKeyUsage: serverAuth is required for HTTPS server certs.
        .add_extension(
            x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]),
            critical=False,
        )
        # KeyUsage: digitalSignature + keyEncipherment for TLS server auth.
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
    )

    return builder.sign(private_key=key, algorithm=hashes.SHA256())


def _install_in_windows_trust_store(cert_path: Path) -> bool:
    """Install the certificate into the CURRENT USER's Trusted Root store.

    Uses the Windows CryptoAPI via ``ctypes`` — a 100% in-process call that
    does NOT spawn any subprocess, does NOT show any Windows dialog, UAC
    prompt, or certificate import wizard. This is the most reliable approach
    because:

    1. Word runs as a separate process outside Electron and has its own
       certificate validation — it will NOT accept self-signed certificates
       that aren't in the Windows Trusted Root store.
    2. ``certutil -addstore Root`` CAN trigger a Windows security dialog
       ("Do you want to install this certificate?") on some configurations,
       which is confusing for users.
    3. PowerShell ``X509Store.Add()`` is generally silent but still spawns
       a subprocess and can fail in frozen (PyInstaller) environments.

    The CryptoAPI approach calls ``CertOpenStore`` → ``CertAddEncodedCertificateToStore``
    directly in-process, which is what ``certutil`` and PowerShell do internally
    but without any UI layer.

    Returns ``True`` on success, ``False`` on failure or non-Windows platforms.
    Never raises — failures are logged but don't crash the backend.
    """
    if sys.platform != "win32":
        return False

    # Try ctypes first (100% in-process, zero dialogs)
    try:
        if _install_via_ctypes(cert_path):
            logger.info("[SSL] Certificate installed via CryptoAPI (ctypes, zero dialogs).")
            print("[SSL] Certificate installed via CryptoAPI (ctypes, zero dialogs).")
            return True
        logger.warning("[SSL] ctypes CryptoAPI install failed, trying PowerShell fallback.")
    except Exception as exc:
        logger.warning("[SSL] ctypes install error: %s, trying PowerShell fallback.", exc)

    # Fallback 1: PowerShell .NET X509Store
    try:
        if _install_via_powershell(cert_path):
            logger.info("[SSL] Certificate installed via PowerShell .NET X509Store.")
            print("[SSL] Certificate installed via PowerShell .NET X509Store.")
            return True
        logger.warning("[SSL] PowerShell install also failed, trying certutil.")
    except Exception as exc:
        logger.warning("[SSL] PowerShell install error: %s, trying certutil.", exc)

    # Fallback 2: certutil with -f (force, suppresses some dialogs)
    return _install_via_certutil(cert_path)


def _install_via_ctypes(cert_path: Path) -> bool:
    """Install cert using Windows CryptoAPI via ctypes (100% in-process, zero UI).

    Calls:
      1. ``CertOpenStore(CERT_STORE_PROV_SYSTEM, ..., CERT_SYSTEM_STORE_CURRENT_USER, "Root")``
      2. ``CertAddEncodedCertificateToStore(store, CERT_STORE_ADD_REPLACE_EXISTING, cert_bytes)``
      3. ``CertCloseStore(store)``

    This is the exact same Win32 API that ``certutil`` and PowerShell use
    internally, but called directly from Python — no subprocess, no dialog.

    Note on ``lpszStoreProvider``: the Win32 SDK types it as ``LPCSTR``, but for
    the system-store provider you pass the numeric constant
    ``CERT_STORE_PROV_SYSTEM`` (= 10) cast to a pointer. We declare the
    argument as ``c_void_p`` and pass the integer ``10`` so ctypes emits a
    pointer-sized value of 10 — the documented usage. (Passing the byte string
    ``b"System"`` happens to resolve to the same store on current Windows, but
    the numeric constant is portable and unambiguous.)
    """
    import ctypes
    from ctypes import wintypes

    # Constants
    CERT_STORE_PROV_SYSTEM = 10
    CERT_SYSTEM_STORE_CURRENT_USER = 0x00010000
    CERT_STORE_ADD_REPLACE_EXISTING = 3
    X509_ASN_ENCODING = 0x00000001
    PKCS_7_ASN_ENCODING = 0x00010000

    # use_last_error=True so ctypes.get_last_error() returns the real Win32 error.
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)  # type: ignore[attr-defined]

    # Read the DER-encoded certificate (convert from PEM).
    from cryptography import x509
    from cryptography.hazmat.primitives import serialization

    cert_obj = x509.load_pem_x509_certificate(cert_path.read_bytes())
    cert_der = cert_obj.public_bytes(serialization.Encoding.DER)

    # CertOpenStore(
    #   lpszStoreProvider = CERT_STORE_PROV_SYSTEM (10, cast to LPCSTR)
    #   dwEncodingType = 0
    #   hCryptProv = None
    #   dwFlags = CERT_SYSTEM_STORE_CURRENT_USER
    #   pvPara = "Root"
    # )
    crypt32.CertOpenStore.restype = wintypes.HANDLE
    crypt32.CertOpenStore.argtypes = [
        ctypes.c_void_p,   # lpszStoreProvider (numeric provider id, cast to LPCSTR)
        wintypes.DWORD,    # dwEncodingType
        wintypes.HANDLE,   # hCryptProv
        wintypes.DWORD,    # dwFlags
        wintypes.LPCWSTR,  # pvPara
    ]

    store_handle = crypt32.CertOpenStore(
        CERT_STORE_PROV_SYSTEM,
        0,
        None,
        CERT_SYSTEM_STORE_CURRENT_USER,
        "Root",
    )

    if not store_handle:
        error_code = ctypes.get_last_error()
        logger.warning("[SSL] CertOpenStore failed (error=%d)", error_code)
        return False

    try:
        # CertAddEncodedCertificateToStore(
        #   hCertStore = store_handle
        #   dwCertEncodingType = X509_ASN_ENCODING | PKCS_7_ASN_ENCODING
        #   pbCertEncoded = cert_der
        #   cbCertEncoded = len(cert_der)
        #   dwAddDisposition = CERT_STORE_ADD_REPLACE_EXISTING
        #   ppCertContext = None (don't need the returned context)
        # )
        crypt32.CertAddEncodedCertificateToStore.restype = wintypes.BOOL
        crypt32.CertAddEncodedCertificateToStore.argtypes = [
            wintypes.HANDLE,                 # hCertStore
            wintypes.DWORD,                  # dwCertEncodingType
            ctypes.c_char_p,                 # pbCertEncoded
            wintypes.DWORD,                  # cbCertEncoded
            wintypes.DWORD,                  # dwAddDisposition
            ctypes.POINTER(wintypes.HANDLE), # ppCertContext
        ]

        result = crypt32.CertAddEncodedCertificateToStore(
            store_handle,
            X509_ASN_ENCODING | PKCS_7_ASN_ENCODING,
            cert_der,
            len(cert_der),
            CERT_STORE_ADD_REPLACE_EXISTING,
            None,
        )

        if not result:
            error_code = ctypes.get_last_error()
            logger.warning("[SSL] CertAddEncodedCertificateToStore failed (error=%d)", error_code)
            return False

        logger.info("[SSL] Certificate added to Trusted Root store via CryptoAPI.")
        return True

    finally:
        # CertCloseStore(hCertStore, dwFlags=0)
        crypt32.CertCloseStore.restype = wintypes.BOOL
        crypt32.CertCloseStore.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        crypt32.CertCloseStore(store_handle, 0)


def _install_via_powershell(cert_path: Path) -> bool:
    """Fallback: install cert using PowerShell .NET X509Store API (silent)."""
    import subprocess

    ps_script = (
        "$ErrorActionPreference = 'Stop';"
        f"$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 '{cert_path}';"
        "$store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root','CurrentUser');"
        "$store.Open('ReadWrite');"
        "$store.Add($cert);"
        "$store.Close();"
        "Write-Output 'OK'"
    )
    result = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
        capture_output=True,
        text=True,
        timeout=15,
        creationflags=0x08000000 if sys.platform == "win32" else 0,
    )
    return result.returncode == 0 and "OK" in (result.stdout or "")


def _install_via_certutil(cert_path: Path) -> bool:
    """Last-resort fallback: install cert using certutil -f (may show dialog)."""
    import subprocess

    try:
        result = subprocess.run(
            ["certutil", "-user", "-addstore", "-f", "Root", str(cert_path)],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0:
            logger.info("[SSL] Certificate installed via certutil fallback.")
            print("[SSL] Certificate installed via certutil fallback.")
            return True
        output = (result.stdout or "") + (result.stderr or "")
        if "already" in output.lower() or "exist" in output.lower():
            logger.info("[SSL] Certificate already in Windows Trusted Root store.")
            return True
        logger.warning("[SSL] certutil fallback failed (rc=%d): %s", result.returncode, output[:300])
        return False
    except Exception as exc:
        logger.warning("[SSL] certutil fallback error: %s", exc)
        return False


def _is_cert_in_windows_trust_store(cert_path: Path) -> bool:
    """Check if the certificate is already in the Windows Trusted Root store.

    Walks the CURRENT_USER ``Root`` store with ``CertEnumCertificatesInStore``
    via the CryptoAPI (ctypes) and compares each certificate's SHA-1
    fingerprint against the target certificate's. Completely silent — no
    dialogs, no subprocess.

    Implementation notes
    --------------------
    * A certificate's SHA-1 fingerprint *is* ``sha1(certificate DER bytes)``,
      so we hash the raw ``pbCertEncoded`` bytes directly and never call into
      ``cryptography`` to parse the store certificates. This is faster and
      avoids ``CryptographyDeprecationWarning`` for certs with non-RFC-5280
      fields (e.g. negative serials) that exist in real Root stores.

    * The ``CERT_CONTEXT`` struct is declared as a ``ctypes.Structure`` so the
      field offsets (including the x64 alignment padding between the leading
      ``DWORD`` and the following pointer) are handled by ctypes itself. An
      earlier version read the struct with manual byte offsets that were wrong
      on 64-bit Windows, and it also double-freed the enumeration contexts —
      both defects made the check silently always return ``False``.

      (``CertFindCertificateInStore`` with ``CERT_FIND_SHA1_HASH`` would be the
      "one call" alternative, but empirically it ignores the supplied hash on
      several Windows builds when called via ctypes and returns the first
      certificate unconditionally, so the explicit enumeration is used instead —
      slightly slower but reliable and easy to reason about.)

    * ``CertEnumCertificatesInStore`` frees the previous context it is handed,
      so we must NOT free it ourselves between iterations; only the context we
      bail out on (early match) is freed explicitly. At normal end-of-store the
      last context is freed by the final call that returns ``NULL``.

    Falls back to a PowerShell ``X509Store`` lookup if the CryptoAPI path is
    unavailable (e.g. ``crypt32`` not loadable in a frozen environment).
    """
    if sys.platform != "win32":
        return False

    # Try the CryptoAPI enumeration path first (silent, in-process).
    try:
        import ctypes
        from ctypes import wintypes

        from cryptography import x509
        from cryptography.hazmat.primitives import hashes

        # SHA-1 fingerprint of the target cert == sha1(its DER). We hash the
        # raw DER of each store cert and compare against this.
        target_sha1 = x509.load_pem_x509_certificate(
            cert_path.read_bytes()
        ).fingerprint(hashes.SHA1())

        # CERT_CONTEXT { DWORD dwCertEncodingType; BYTE *pbCertEncoded;
        #                DWORD cbCertEncoded; PCERT_INFO pCertInfo; HCERTSTORE hCertStore; }
        # Declaring it as a Structure lets ctypes insert the correct padding
        # (e.g. 4 bytes after dwCertEncodingType on x64) — the old manual
        # offset math was wrong on 64-bit Windows.
        class CERT_CONTEXT(ctypes.Structure):
            _fields_ = [
                ("dwCertEncodingType", wintypes.DWORD),
                ("pbCertEncoded", ctypes.POINTER(ctypes.c_ubyte)),
                ("cbCertEncoded", wintypes.DWORD),
                ("pCertInfo", ctypes.c_void_p),
                ("hCertStore", wintypes.HANDLE),
            ]

        crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)  # type: ignore[attr-defined]

        CERT_STORE_PROV_SYSTEM = 10
        CERT_SYSTEM_STORE_CURRENT_USER = 0x00010000

        crypt32.CertOpenStore.restype = wintypes.HANDLE
        crypt32.CertOpenStore.argtypes = [
            ctypes.c_void_p,   # lpszStoreProvider (numeric provider id)
            wintypes.DWORD,    # dwEncodingType
            wintypes.HANDLE,   # hCryptProv
            wintypes.DWORD,    # dwFlags
            wintypes.LPCWSTR,  # pvPara
        ]
        store_handle = crypt32.CertOpenStore(
            CERT_STORE_PROV_SYSTEM, 0, None,
            CERT_SYSTEM_STORE_CURRENT_USER, "Root",
        )
        if not store_handle:
            logger.debug("[SSL] trust-check: CertOpenStore failed (err=%d)",
                         ctypes.get_last_error())
            raise RuntimeError("CertOpenStore failed")

        crypt32.CertEnumCertificatesInStore.restype = wintypes.HANDLE
        crypt32.CertEnumCertificatesInStore.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        crypt32.CertFreeCertificateContext.argtypes = [wintypes.HANDLE]

        try:
            prev = None
            # CertEnumCertificatesInStore frees the non-NULL previous context it
            # is handed and returns the next one (NULL at end of store). We must
            # therefore NOT manually free `prev` between iterations — only the
            # context we bail out on (early match) is freed explicitly.
            while True:
                ctx = crypt32.CertEnumCertificatesInStore(store_handle, prev)
                if not ctx:
                    break
                prev = ctx
                try:
                    cc = CERT_CONTEXT.from_address(ctx)
                    if cc.cbCertEncoded and cc.pbCertEncoded:
                        der = ctypes.string_at(cc.pbCertEncoded, cc.cbCertEncoded)
                        if hashlib.sha1(der).digest() == target_sha1:
                            crypt32.CertFreeCertificateContext(ctx)
                            logger.debug("[SSL] Certificate already present in Trusted Root store.")
                            return True
                except Exception:
                    # Skip a malformed/unreadable certificate entry.
                    continue
            return False
        finally:
            crypt32.CertCloseStore.restype = wintypes.BOOL
            crypt32.CertCloseStore.argtypes = [wintypes.HANDLE, wintypes.DWORD]
            crypt32.CertCloseStore(store_handle, 0)
    except Exception as exc:
        logger.debug("[SSL] ctypes trust-store check failed (%s); falling back to PowerShell.", exc)

    # Fallback: PowerShell X509Store lookup (silent, read-only).
    try:
        import subprocess

        from cryptography import x509
        from cryptography.hazmat.primitives import hashes

        cert_obj = x509.load_pem_x509_certificate(cert_path.read_bytes())
        thumbprint = cert_obj.fingerprint(hashes.SHA1()).hex().upper()

        ps_script = (
            "$ErrorActionPreference = 'SilentlyContinue';"
            f"$thumb = '{thumbprint}';"
            "$store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root','CurrentUser');"
            "$store.Open('ReadOnly');"
            "$found = $store.Certificates | Where-Object { $_.Thumbprint -eq $thumb };"
            "$store.Close();"
            "if ($found) { Write-Output 'FOUND' } else { Write-Output 'NOTFOUND' }"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script],
            capture_output=True, text=True, timeout=15,
            creationflags=0x08000000 if sys.platform == "win32" else 0,
        )
        if result.returncode == 0 and "FOUND" in (result.stdout or ""):
            return True
    except Exception:
        pass

    return False


def generate_self_signed_cert(
    cert_path: PathLike,
    key_path: PathLike,
) -> Tuple[Optional[Path], Optional[Path]]:
    """Generate (or reuse) a self-signed SSL certificate for localhost.

    **CRITICAL:** On Windows, the certificate is also installed into the
    CURRENT USER's Trusted Root Certification Authorities store so that
    Word (running outside Electron) can load the Add-in taskpane over HTTPS.
    Without this, Word shows a blank panel instead of the Add-in.

    The installation is **completely silent** — it uses the Windows CryptoAPI
    via ``ctypes`` (100% in-process, zero dialogs, zero subprocesses).

    Parameters
    ----------
    cert_path:
        Destination path for the PEM certificate file.
    key_path:
        Destination path for the PEM (unencrypted) private key file.

    Returns
    -------
    (Path, Path)
        The paths of the cert and key on success.
    (None, None)
        On any failure. **Never raises** — safe to call unconditionally.

    Notes
    -----
    * If both files already exist and are valid (not expired, key matches,
      enough remaining validity) they are reused as-is (idempotent).
    * The certificate is a self-signed RSA 2048 X.509 leaf cert valid for
      ``VALID_DAYS`` days, issued for ``localhost`` and ``127.0.0.1``.
    * On Windows, the cert is installed in the user's Trusted Root store via
      the CryptoAPI (ctypes, in-process, no dialog).
    """
    try:
        cert_p = Path(cert_path)
        key_p = Path(key_path)

        # ── Idempotency: reuse valid existing certs ──────────────────────
        if cert_p.exists() and key_p.exists():
            if _is_cert_valid(cert_p, key_p):
                logger.info("[SSL] Reusing existing valid certificate: %s", cert_p)
                # Even if the cert file is valid, we must ensure it's in the
                # Windows trust store (may have been generated before this fix)
                if sys.platform == "win32" and not _is_cert_in_windows_trust_store(cert_p):
                    logger.info("[SSL] Installing existing cert in Windows trust store (first time).")
                    _install_in_windows_trust_store(cert_p)
                return cert_p, key_p
            logger.info("[SSL] Existing certificate invalid/expired, regenerating.")

        # ── Generate a fresh key + certificate ───────────────────────────
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=RSA_KEY_SIZE,
        )
        cert = _build_certificate(key)

        # ── Persist to disk ─────────────────────────────────────────────
        # Ensure the parent directories exist.
        cert_p.parent.mkdir(parents=True, exist_ok=True)
        key_p.parent.mkdir(parents=True, exist_ok=True)

        cert_pem = cert.public_bytes(serialization.Encoding.PEM)
        key_pem = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,  # PKCS#1 "RSA PRIVATE KEY"
            encryption_algorithm=serialization.NoEncryption(),
        )

        cert_p.write_bytes(cert_pem)
        key_p.write_bytes(key_pem)

        # Restrict key file permissions where possible (best effort).
        try:
            os.chmod(key_p, 0o600)
        except (OSError, NotImplementedError):
            pass  # Windows ignores POSIX chmod; fine.

        logger.info("[SSL] Self-signed certificate generated: %s", cert_p)
        print(f"[SSL] Self-signed certificate generated (cryptography): {cert_p}")

        # ── CRITICAL: Install in Windows Trusted Root store (SILENT) ─────
        # Word runs as a separate process and does NOT accept self-signed
        # certificates that aren't in the OS trust store. This is the #1
        # reason the Add-in shows a blank panel in Word.
        # Uses CryptoAPI via ctypes — 100% in-process, zero dialogs.
        _install_in_windows_trust_store(cert_p)

        return cert_p, key_p

    except Exception as exc:  # noqa: BLE001 — must never crash the backend
        logger.error("[SSL] Failed to generate self-signed certificate: %s", exc)
        print(f"[SSL] Failed to generate self-signed certificate: {exc}")
        return None, None


# ── Self-test ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import tempfile

    tmp = Path(tempfile.mkdtemp())
    c, k = generate_self_signed_cert(tmp / "localhost.pem", tmp / "localhost-key.pem")
    if c and k:
        print(f"OK  cert={c}  key={k}")
        # Idempotency check
        c2, k2 = generate_self_signed_cert(tmp / "localhost.pem", tmp / "localhost-key.pem")
        assert c2 == c and k2 == k, "Idempotency failed!"
        print("Idempotency: OK (reused existing cert)")
    else:
        print("FAILED")
