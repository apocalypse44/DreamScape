"""Serve Dreamscape locally and open it in the default browser."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import sys
import threading
import webbrowser


class DemoRequestHandler(SimpleHTTPRequestHandler):
    # Windows registry associations can label .js as text/plain. Modules
    # require a JavaScript MIME type, regardless of local file associations.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".gltf": "model/gltf+json",
        ".glb": "model/gltf-binary",
        ".bin": "application/octet-stream",
        ".exr": "application/octet-stream",
    }


def open_browser(url):
    # Exactly one attempt. webbrowser.open() walks a fallback list (Windows default, then Edge), so a
    # default browser that opens the page but reports an error made a second window appear in Edge.
    try:
        if hasattr(os, "startfile"):
            os.startfile(url)
        elif not webbrowser.get().open(url):
            raise webbrowser.Error
    except (OSError, webbrowser.Error):
        print(f"Open this address in your browser: {url}", flush=True)


def main():
    # Optional folder argument, e.g. `python serve.py dist` to test the hosting build;
    # --no-browser only starts the server.
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    root = Path(__file__).resolve().parent
    directory = root / args[0] if args else root
    handler = partial(DemoRequestHandler, directory=str(directory))
    # An available port avoids conflicts with other development servers.
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        url = f"http://127.0.0.1:{server.server_port}/index.html"
        print(f"Dreamscape: {url}", flush=True)
        print("Keep this window open while playing. Press Ctrl+C to stop.", flush=True)

        if "--no-browser" not in sys.argv:
            threading.Thread(target=open_browser, args=(url,), daemon=True).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nDreamscape server stopped.")


if __name__ == "__main__":
    main()
