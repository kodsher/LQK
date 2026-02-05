#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_DELETE(self):
        if self.path == '/api/delete-part':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            search_term = data.get('searchTerm')
            if not search_term:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Missing searchTerm'}).encode())
                return

            # Determine the data.json path based on the request
            # For the parts directory
            data_file = os.path.join(os.path.dirname(__file__), 'parts', 'data.json')

            if not os.path.exists(data_file):
                self.send_response(404)
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'data.json not found'}).encode())
                return

            # Read current data
            try:
                with open(data_file, 'r') as f:
                    parts_data = json.load(f)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'Failed to read data.json: {str(e)}'}).encode())
                return

            # Filter out the item
            original_length = len(parts_data)
            parts_data = [item for item in parts_data if item.get('searchTerm') != search_term]

            if len(parts_data) == original_length:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Item not found'}).encode())
                return

            # Write updated data back
            try:
                with open(data_file, 'w') as f:
                    json.dump(parts_data, f, indent=2)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'Failed to write data.json: {str(e)}'}).encode())
                return

            # Send success response
            self.send_response(200)
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': 'Item deleted successfully'}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8000), CORSRequestHandler)
    print("Server running at http://localhost:8000/")
    server.serve_forever()
