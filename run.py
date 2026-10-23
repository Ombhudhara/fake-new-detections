import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent
CHATBOT_DIR = ROOT_DIR / "fake_news_chatbot"
BACKEND_DIR = ROOT_DIR / "backend"
STARTUP_TIMEOUT = int(os.getenv("CHATBOT_STARTUP_TIMEOUT", "60"))


def chatbot_is_ready(url):
    try:
        with urlopen(url, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status == 200 and payload.get("status") == "online"
    except HTTPError:
        return False
    except (URLError, TimeoutError, json.JSONDecodeError):
        return False


def chatbot_port_is_in_use(port):
    with socket.socket() as connection:
        return connection.connect_ex(("127.0.0.1", int(port))) == 0


def stop_process(process):
    if process is None or process.poll() is not None:
        return
    try:
        process.terminate()
        process.wait(timeout=5)
    except (subprocess.TimeoutExpired, Exception):
        try:
            process.kill()
            process.wait(timeout=5)
        except Exception:
            pass


def main():
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(CHATBOT_DIR / ".env")
    backend_port = os.getenv("PORT", "5000")
    chatbot_port = os.getenv("CHATBOT_PORT", "8000")
    startup_timeout = int(os.getenv("CHATBOT_STARTUP_TIMEOUT", str(STARTUP_TIMEOUT)))
    chatbot_url = f"http://127.0.0.1:{chatbot_port}/"
    chatbot_process = None
    backend_process = None

    print("=" * 60)
    print(" Fake News Detection — Python Backend & Chatbot Launcher")
    print("=" * 60)

    try:
        if chatbot_is_ready(chatbot_url):
            print(f"[OK] Chatbot service is already running at {chatbot_url}")
        elif chatbot_port_is_in_use(chatbot_port):
            print(f"[!] Notice: Port {chatbot_port} is in use; connecting to existing service.")
        else:
            print(f"[*] Initializing chatbot service on port {chatbot_port}...")
            chatbot_env = os.environ.copy()
            chatbot_env.setdefault("FLASK_BASE_URL", f"http://127.0.0.1:{backend_port}")
            chatbot_process = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "api:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    chatbot_port,
                ],
                cwd=str(CHATBOT_DIR),
                env=chatbot_env,
            )

            # Give chatbot a short window to initialize immediately, then proceed with backend
            quick_wait = min(startup_timeout, 15)
            deadline = time.monotonic() + quick_wait
            chatbot_online = False
            print("    Waiting for chatbot service to become ready...", end="", flush=True)

            while time.monotonic() < deadline:
                if chatbot_process.poll() is not None:
                    print("\n[!] Warning: Chatbot process exited early (check fake_news_chatbot/.env).", file=sys.stderr)
                    print("    Core fake news classification and API features will continue running normally.", file=sys.stderr)
                    break
                if chatbot_is_ready(chatbot_url):
                    chatbot_online = True
                    print(f"\n[OK] Chatbot service is online at {chatbot_url}", flush=True)
                    break
                time.sleep(1)
                print(".", end="", flush=True)

            if not chatbot_online and chatbot_process and chatbot_process.poll() is None:
                print(f"\n[*] Chatbot is initializing in background. Backend starting now...", flush=True)

        backend_env = os.environ.copy()
        backend_env.setdefault("CHATBOT_API_URL", f"http://127.0.0.1:{chatbot_port}")

        print(f"[*] Starting Python backend API on port {backend_port}...")
        print(f"    Backend URL : http://127.0.0.1:{backend_port}")
        print(f"    Chatbot URL : http://127.0.0.1:{chatbot_port}")
        print("    Frontend    : Run start_frontend.bat (http://localhost:5500) to view UI")
        print("=" * 60)

        if os.name == "nt":
            backend_command = [
                sys.executable,
                "-m",
                "flask",
                "--app",
                "app",
                "run",
                "--host",
                "0.0.0.0",
                "--port",
                backend_port,
                "--no-reload",
            ]
        else:
            backend_command = [
                sys.executable,
                "-m",
                "gunicorn",
                "app:app",
                "--bind",
                f"0.0.0.0:{backend_port}",
                "--workers",
                os.getenv("WEB_CONCURRENCY", "2"),
            ]

        backend_process = subprocess.Popen(
            backend_command,
            cwd=str(BACKEND_DIR),
            env=backend_env,
        )
        return backend_process.wait()

    except KeyboardInterrupt:
        print("\n[*] Stopping backend and chatbot services...")
        return 0
    except Exception as error:
        print(f"Startup error: {error}", file=sys.stderr)
        return 1
    finally:
        stop_process(backend_process)
        stop_process(chatbot_process)
        print("[*] Backend and chatbot services stopped.")


if __name__ == "__main__":
    raise SystemExit(main())