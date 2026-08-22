"""SSL certificate generation for the Word Add-in.

Office.js Word Add-ins REQUIRE HTTPS even on localhost. This module generates
self-signed X.509 certificates at runtime using the ``cryptography`` library,
so the backend can serve HTTPS without relying on external CLI tools such as
``mkcert`` (which is not shipped with the installer).

**CRITICAL:** On Windows, the generated certificate is also installed into the
CURRENT USER's Trusted Root Certification Authorities store using ``certutil``.
Without this step, Word (which runs OUTSIDE Electron) rejects the self-signed
certificate and the Add-in taskpane shows a blank panel — the #1 reason the
Add-in "doesn't appear" in Word.

The certificates are issued for ``localhost`` and ``127.0.0.1``, use RSA
2048-bit keys, and are valid for 365 days. They are saved as PEM files (with an
unencrypted key) and persist between runs — ``generate_self_signed_cert`` is
idempotent: if valid cert/key files already exist they are reused.

Everything is wrapped in defensive ``try/except`` blocks so the module can
**never** crash the backend on import or on failure.
"""

from __future__ import annotations

import datetime
import logging
import os
import subprocess
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

    Uses ``certutil -user -addstore Root <cert_path>`` which does NOT require
    administrator privileges. This is essential because Word runs as a
    separate process outside Electron and has its own certificate validation —
    it will NOT accept self-signed certificates that aren't in the Windows
    Trusted Root store.

    Returns ``True`` on success, ``False`` on failure or non-Windows platforms.
    Never raises — failures are logged but don't crash the backend.
    """
    if sys.platform != "win32":
        return False

    try:
        # Use -user to install in the current user's store (no admin needed)
        result = subprocess.run(
            ["certutil", "-user", "-addstore", "Root", str(cert_path)],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0:
            logger.info("[SSL] Certificate installed in Windows Trusted Root store (current user).")
            print("[SSL] Certificate installed in Windows Trusted Root store (current user).")
            return True
        else:
            # certutil might return non-zero if the cert is already there
            # Check stderr/stdout for "already in store" type messages
            output = (result.stdout or "") + (result.stderr or "")
            if "already" in output.lower() or "exist" in output.lower():
                logger.info("[SSL] Certificate already in Windows Trusted Root store.")
                return True
            logger.warning("[SSL] certutil failed (rc=%d): %s", result.returncode, output[:300])
            print(f"[SSL] certutil failed (rc={result.returncode}): {output[:200]}")
            return False
    except FileNotFoundError:
        logger.warning("[SSL] certutil not found — certificate NOT installed in Windows trust store.")
        print("[SSL] WARNING: certutil not found — Word may not load the Add-in.")
        return False
    except Exception as exc:
        logger.warning("[SSL] Failed to install cert in Windows trust store: %s", exc)
        print(f"[SSL] Failed to install cert in Windows trust store: {exc}")
        return False


def _is_cert_in_windows_trust_store(cert_path: Path) -> bool:
    """Check if the certificate is already in the Windows Trusted Root store.

    Uses ``certutil -user -store Root`` and searches for the cert's SHA1
    fingerprint. Returns ``True`` if found, ``False`` otherwise.
    """
    if sys.platform != "win32":
        return False

    try:
        # Get the cert's SHA1 fingerprint
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes
        cert = x509.load_pem_x509_certificate(cert_path.read_bytes())
        fingerprint = cert.fingerprint(hashes.SHA1()).hex().upper()

        # Search in the current user's Root store
        result = subprocess.run(
            ["certutil", "-user", "-store", "Root"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0 and fingerprint in (result.stdout or "").upper():
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
      ``certutil -user -addstore Root`` (no admin privileges needed).
    """
    try:
        cert_p = Path(cert_path)
        key_p = Path(key_path)

        cert_was_regenerated = False

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

        cert_was_regenerated = True
        logger.info("[SSL] Self-signed certificate generated: %s", cert_p)
        print(f"[SSL] Self-signed certificate generated (cryptography): {cert_p}")

        # ── CRITICAL: Install in Windows Trusted Root store ─────────────
        # Word runs as a separate process and does NOT accept self-signed
        # certificates that aren't in the OS trust store. This is the #1
        # reason the Add-in shows a blank panel in Word.
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
