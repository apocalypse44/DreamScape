"""Serve Dreamscape locally and open it in the default browser."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
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


def main():
    directory = Path(__file__).resolve().parent
    handler = partial(DemoRequestHandler, directory=str(directory))
    # An available port avoids conflicts with other development servers.
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        url = f"http://127.0.0.1:{server.server_port}/index.html"
        print(f"Dreamscape: {url}", flush=True)
        print("Keep this window open while playing. Press Ctrl+C to stop.", flush=True)

        def open_browser():
            try:
                if not webbrowser.open(url):
                    print(f"Open this address in your browser: {url}", flush=True)
            except webbrowser.Error:
                print(f"Open this address in your browser: {url}", flush=True)

        threading.Thread(target=open_browser, daemon=True).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nDreamscape server stopped.")


if __name__ == "__main__":
    main()
