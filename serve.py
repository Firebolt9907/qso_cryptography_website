#!/usr/bin/env python3
"""
Simple local web server for QSO Cryptography Lab.
Allows testing with full Web Crypto API on localhost.
"""
import http.server
import socketserver
import sys
import os
import functools

PORT = 8080
DOC_DIR = os.path.dirname(os.path.abspath(__file__))

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOC_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def main():
    # Allow port reuse immediately
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("🚀 QSO Cryptography Lab is running!")
        print(f"👉 Open in browser: {url}")
        print("Press Ctrl+C to stop the server.")
        print("=" * 60)
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer shutting down gracefully.")
            sys.exit(0)

if __name__ == '__main__':
    main()
