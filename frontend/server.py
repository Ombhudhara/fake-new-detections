"""
Standalone Frontend Server for Fake News Detection.
Serves frontend HTML templates, CSS, JavaScript, and images independently on port 5500.
Does not start or require the Python backend to run.
"""

import http.server
import mimetypes
import os
import socketserver
import sys
from pathlib import Path

# Ensure mime types are registered
mimetypes.init()
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")

FRONTEND_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = FRONTEND_DIR / "templates"
STATIC_DIR = FRONTEND_DIR / "static"
DEFAULT_PORT = int(os.environ.get("FRONTEND_PORT", 5500))

# Route mapping for clean URLs to template files
ROUTE_MAP = {
    "/": "index.html",
    "/index": "index.html",
    "/index.html": "index.html",
    "/dashboard": "dashboard.html",
    "/dashboard.html": "dashboard.html",
    "/analytics": "analytics.html",
    "/analytics.html": "analytics.html",
    "/learn": "learn.html",
    "/learn.html": "learn.html",
    "/report": "report.html",
    "/report.html": "report.html",
    "/credibility-checker": "credibility_checker.html",
    "/credibility_checker.html": "credibility_checker.html",
}


class FrontendRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and caching headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # Clean path
        path = self.path.split("?")[0].split("#")[0]
        
        # Check clean route mapping
        if path in ROUTE_MAP:
            target_name = ROUTE_MAP[path]
            # Look in templates dir first, then frontend dir
            target_file = TEMPLATES_DIR / target_name
            if not target_file.exists():
                target_file = FRONTEND_DIR / target_name

            if target_file.exists():
                return self._serve_file(target_file, "text/html; charset=utf-8")

        # Static assets (/static/...)
        if path.startswith("/static/"):
            rel_path = path[len("/static/"):]
            target_file = STATIC_DIR / rel_path
            if target_file.exists() and target_file.is_file():
                ctype = mimetypes.guess_type(str(target_file))[0] or "application/octet-stream"
                return self._serve_file(target_file, ctype)

        # Direct file in templates
        direct_template = TEMPLATES_DIR / path.lstrip("/")
        if direct_template.exists() and direct_template.is_file():
            ctype = mimetypes.guess_type(str(direct_template))[0] or "text/html; charset=utf-8"
            return self._serve_file(direct_template, ctype)

        # Direct file in frontend root
        direct_root = FRONTEND_DIR / path.lstrip("/")
        if direct_root.exists() and direct_root.is_file():
            ctype = mimetypes.guess_type(str(direct_root))[0] or "application/octet-stream"
            return self._serve_file(direct_root, ctype)

        # Fallback to 404
        self.send_error(404, f"File not found: {path}")

    def _serve_file(self, filepath: Path, content_type: str):
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_error(500, f"Error reading file: {e}")

    def log_message(self, format, *args):
        # Concise logging
        sys.stderr.write(f"[Frontend Server] {self.address_string()} - {format % args}\n")


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def run_server(port=DEFAULT_PORT):
    server_address = ("0.0.0.0", port)
    try:
        httpd = ThreadedHTTPServer(server_address, FrontendRequestHandler)
    except OSError as e:
        sys.stderr.write(f"Error: Could not bind to port {port}: {e}\n")
        sys.exit(1)

    print("=" * 60)
    print(" Fake News Detection — Standalone Frontend Server")
    print("=" * 60)
    print(f" Local URL  : http://localhost:{port}")
    print(f" Network URL: http://127.0.0.1:{port}")
    print(" Backend API: Configured in static/js/config.js (default: http://127.0.0.1:5000)")
    print(" Status     : Frontend running independently.")
    print(" Press Ctrl+C to stop the frontend server.")
    print("=" * 60)
    sys.stdout.flush()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping frontend server...")
        httpd.shutdown()
        httpd.server_close()
        print("Frontend server stopped.")


if __name__ == "__main__":
    port = DEFAULT_PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port)
