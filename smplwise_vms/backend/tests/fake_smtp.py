"""A small in-process fake SMTP server for the e-mail channel tests (CR-018 S4): no mail ever leaves the machine.

Binds 127.0.0.1 in the agent port range 4691-4700, speaks enough ESMTP for smtplib (EHLO, STARTTLS, AUTH PLAIN / LOGIN, MAIL, RCPT, DATA,
RSET, NOOP, QUIT) in one of three modes - `none` (plain), `starttls` (offers STARTTLS; AUTH only after it) and `ssl` (implicit TLS) - with a
throw-away self-signed certificate for 127.0.0.1 / localhost (the test trusts it through `FakeSMTP.client_context()`).

Behaviour switches (set on the instance before or between sends): `auth` (a (user, password) pair the server accepts; None = no AUTH offered),
`rcpt_reply` / `data_reply` / `mail_reply` (a reply line to send instead of 250 / 250 / 250; may be a callable of the address), `hang` (accept and
never answer: a client timeout), `greeting_delay` (a slow server), `drop` (close right after the TCP accept), `banner` (the greeting text), `max_size`, `extra_reply_text`
(appended to every error reply, to prove a client never echoes server text).
"""
from __future__ import annotations

import base64
import datetime as dt
import ipaddress
import socket
import ssl
import threading
from pathlib import Path
from typing import Callable

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

PORTS = range(4691, 4701)


def make_cert(directory: Path) -> tuple[Path, Path, bytes]:
    """A self-signed certificate valid for 127.0.0.1 and localhost; returns (cert path, key path, cert PEM)."""
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = dt.datetime.now(dt.timezone.utc)
    cert = (
        x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(days=1)).not_valid_after(now + dt.timedelta(days=30))
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    pem = cert.public_bytes(serialization.Encoding.PEM)
    cert_path, key_path = directory / "fake-smtp.crt", directory / "fake-smtp.key"
    cert_path.write_bytes(pem)
    key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    return cert_path, key_path, pem


class FakeSMTP:
    def __init__(self, directory: Path, mode: str = "none", auth: tuple[str, str] | None = None) -> None:
        assert mode in ("none", "starttls", "ssl")
        self.mode = mode
        self.auth = auth
        self.cert_path, self.key_path, self.cert_pem = make_cert(directory)
        self.banner = "fake ESMTP ready"
        self.extra_reply_text = ""
        self.max_size = 10 * 1024 * 1024
        self.hang = False
        self.greeting_delay = 0.0               # seconds before the 220 greeting (a slow server)
        self.drop = False
        self.mail_reply: str | Callable[[str], str] | None = None
        self.rcpt_reply: str | Callable[[str], str] | None = None
        self.data_reply: str | Callable[[], str] | None = None
        self.messages: list[dict] = []          # {"from", "to": [..], "data": bytes, "tls": bool, "user": str | None}
        self.connections = 0
        self.auth_failures = 0
        self.tls_sessions = 0
        self.plain_after_greeting: list[str] = []   # commands received in clear on a starttls server before STARTTLS
        self.sock: socket.socket | None = None
        self.port = 0
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    # -- lifecycle
    def start(self) -> "FakeSMTP":
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        for p in PORTS:
            try:
                sock.bind(("127.0.0.1", p))
                self.port = p
                break
            except OSError:
                continue
        else:
            sock.close()
            raise RuntimeError("no free port in 4691-4700 for the fake SMTP server")
        sock.listen(8)
        sock.settimeout(0.2)
        self.sock = sock
        self._thread = threading.Thread(target=self._accept_loop, name="fake-smtp", daemon=True)
        self._thread.start()
        return self

    def stop(self) -> None:
        self._stop.set()
        if self.sock is not None:
            try:
                self.sock.close()
            except OSError:
                pass
        if self._thread is not None:
            self._thread.join(timeout=2.0)

    def __enter__(self) -> "FakeSMTP":
        return self.start()

    def __exit__(self, *exc) -> None:
        self.stop()

    def client_context(self) -> ssl.SSLContext:
        """A client context that trusts this server's certificate (verification and host name stay ON)."""
        return ssl.create_default_context(cadata=self.cert_pem.decode("ascii"))

    def server_context(self) -> ssl.SSLContext:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(self.cert_path), str(self.key_path))
        return ctx

    # -- the protocol
    def _accept_loop(self) -> None:
        assert self.sock is not None
        while not self._stop.is_set():
            try:
                conn, _ = self.sock.accept()
            except (socket.timeout, OSError):
                continue
            threading.Thread(target=self._serve, args=(conn,), daemon=True).start()

    def _err(self, line: str) -> str:
        return line + (" " + self.extra_reply_text if self.extra_reply_text and not line.startswith("2") else "")

    def _serve(self, raw: socket.socket) -> None:
        with self._lock:
            self.connections += 1
        raw.settimeout(5.0)
        conn: socket.socket | ssl.SSLSocket = raw
        try:
            if self.drop:
                return
            if self.hang:
                self._stop.wait(8.0)
                return
            if self.mode == "ssl":
                conn = self.server_context().wrap_socket(raw, server_side=True)
                with self._lock:
                    self.tls_sessions += 1
            f = conn.makefile("rwb", buffering=0)
            tls = self.mode == "ssl"
            user: str | None = None
            sender, rcpts = "", []

            def send(line: str) -> None:
                f.write((line + "\r\n").encode("utf-8", "replace"))

            if self.greeting_delay:
                self._stop.wait(self.greeting_delay)
            send(f"220 {self.banner}")
            while True:
                line = f.readline()
                if not line:
                    return
                text = line.decode("utf-8", "replace").rstrip("\r\n")
                cmd = text.split(" ", 1)[0].upper()
                if self.mode == "starttls" and not tls and cmd not in ("EHLO", "HELO", "STARTTLS", "QUIT", "NOOP", "RSET"):
                    self.plain_after_greeting.append(cmd)
                if cmd in ("EHLO", "HELO"):
                    caps = ["250-fake.local", f"250-SIZE {self.max_size}"]
                    if self.mode == "starttls" and not tls:
                        caps.append("250-STARTTLS")
                    if self.auth is not None and (tls or self.mode == "none"):
                        caps.append("250-AUTH PLAIN LOGIN")
                    caps.append("250 8BITMIME")
                    f.write(("\r\n".join(caps) + "\r\n").encode())
                elif cmd == "STARTTLS":
                    if self.mode != "starttls" or tls:
                        send(self._err("503 5.5.1 STARTTLS not available"))
                        continue
                    send("220 2.0.0 ready to start TLS")
                    conn = self.server_context().wrap_socket(conn, server_side=True)
                    f = conn.makefile("rwb", buffering=0)
                    tls = True
                    with self._lock:
                        self.tls_sessions += 1
                elif cmd == "AUTH":
                    parts = text.split(" ")
                    mech = parts[1].upper() if len(parts) > 1 else ""
                    creds: tuple[str, str] | None = None
                    if mech == "PLAIN":
                        blob = parts[2] if len(parts) > 2 else None
                        if blob is None:
                            send("334 ")
                            blob = f.readline().decode().strip()
                        bits = base64.b64decode(blob).split(b"\0")
                        creds = (bits[1].decode(), bits[2].decode()) if len(bits) >= 3 else None
                    elif mech == "LOGIN":
                        send("334 " + base64.b64encode(b"Username:").decode())
                        u = base64.b64decode(f.readline().strip()).decode()
                        send("334 " + base64.b64encode(b"Password:").decode())
                        p = base64.b64decode(f.readline().strip()).decode()
                        creds = (u, p)
                    if self.auth is not None and creds == self.auth:
                        user = creds[0]
                        send("235 2.7.0 Authentication successful")
                    else:
                        with self._lock:
                            self.auth_failures += 1
                        send(self._err("535 5.7.8 Authentication credentials invalid"))
                elif cmd == "MAIL":
                    reply = self.mail_reply(text) if callable(self.mail_reply) else self.mail_reply
                    if self.auth is not None and user is None:
                        send("530 5.7.0 Authentication required")
                    elif reply:
                        send(self._err(reply))
                    else:
                        sender = text.split(":", 1)[1].strip().split(" ")[0].strip("<>")
                        rcpts = []
                        send("250 2.1.0 OK")
                elif cmd == "RCPT":
                    addr = text.split(":", 1)[1].strip().strip("<>")
                    reply = self.rcpt_reply(addr) if callable(self.rcpt_reply) else self.rcpt_reply
                    if reply:
                        send(self._err(reply))
                    else:
                        rcpts.append(addr)
                        send("250 2.1.5 OK")
                elif cmd == "DATA":
                    reply = self.data_reply() if callable(self.data_reply) else self.data_reply
                    if reply:
                        send(self._err(reply))
                        continue
                    send("354 End data with <CR><LF>.<CR><LF>")
                    chunks: list[bytes] = []
                    while True:
                        part = f.readline()
                        if not part:
                            return
                        if part in (b".\r\n", b".\n"):
                            break
                        chunks.append(part[1:] if part.startswith(b"..") else part)
                    with self._lock:
                        self.messages.append({"from": sender, "to": list(rcpts), "data": b"".join(chunks), "tls": tls, "user": user})
                    send("250 2.0.0 queued")
                elif cmd == "RSET" or cmd == "NOOP":
                    send("250 2.0.0 OK")
                elif cmd == "QUIT":
                    send("221 2.0.0 bye")
                    return
                else:
                    send(self._err("502 5.5.2 command not recognized"))
        except (OSError, ssl.SSLError, ValueError):
            return
        finally:
            try:
                conn.close()
            except OSError:
                pass
