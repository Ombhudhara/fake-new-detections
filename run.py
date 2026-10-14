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
STARTUP_TIMEOUT = 180


def chatbot_is_ready(url):
    try:
        with urlopen(url, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status == 200 and payload.get("status") == "online"
    except HTTPError as error:
        raise RuntimeError(f"Port is responding but not as the chatbot API: {error}") from error
    except (URLError, TimeoutError, json.JSONDecodeError):
        return False


def chatbot_port_is_in_use(port):
    with socket.socket() as connection:
        return connection.connect_ex(("127.0.0.1", int(port))) == 0


def stop_process(process):
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


def main():
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(CHATBOT_DIR / ".env")
    backend_port = os.getenv("PORT", "5000")
    chatbot_port = os.getenv("CHATBOT_PORT", "8000")
    startup_timeout = int(os.getenv("CHATBOT_STARTUP_TIMEOUT", "600"))
    chatbot_url = f"http://127.0.0.1:{chatbot_port}/"
    chatbot_process = None
    backend_process = None

    try:
        if not chatbot_is_ready(chatbot_url):
            if chatbot_port_is_in_use(chatbot_port):
                raise RuntimeError(
                    f"Port {chatbot_port} is already in use by a chatbot that is not ready; "
                    "refusing to start a duplicate instance."
                )
            chatbot_env = os.environ.copy()
            chatbot_env.setdefault(
                "FLASK_BASE_URL", f"http://127.0.0.1:{backend_port}"
            )
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
                cwd=CHATBOT_DIR,
                env=chatbot_env,
            )

            deadline = time.monotonic() + startup_timeout
            while time.monotonic() < deadline:
                if chatbot_process.poll() is not None:
                    raise RuntimeError(
                        "The chatbot process exited during startup; see its log output."
                    )
                if chatbot_is_ready(chatbot_url):
                    break
                time.sleep(1)
            else:
                raise RuntimeError(
                    f"The chatbot did not become ready within {startup_timeout} seconds."
                )

        backend_env = os.environ.copy()
        backend_env.setdefault("CHATBOT_API_URL", f"http://127.0.0.1:{chatbot_port}")
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
            cwd=BACKEND_DIR,
            env=backend_env,
        )
        return backend_process.wait()
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        print(f"Startup failed: {error}", file=sys.stderr)
        return 1
    finally:
        stop_process(backend_process)
        stop_process(chatbot_process)


if __name__ == "__main__":
    raise SystemExit(main())