import http.server
import socketserver
import requests
import urllib.parse
import logging
import sys
import os
from http.cookies import SimpleCookie
import certifi
import ssl

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MapMetrics gateway configuration
GATEWAY_HOST = "gateway.mapmetrics1.org"
GATEWAY_SCHEME = "https"

# Store cookies for reuse
cookies_store = {}

class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', 'https://localhost:8000')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        try:
            # Parse the request path
            parsed_path = urllib.parse.urlparse(self.path)
            path_parts = parsed_path.path.strip('/').split('/')
            
            # Check if this is a proxy request
            if path_parts[0] == 'proxy':
                # Extract the path after /proxy/
                proxy_path = '/'.join(path_parts[1:])
                
                # Construct the target URL
                target_url = f"{GATEWAY_SCHEME}://{GATEWAY_HOST}/{proxy_path}"
                if parsed_path.query:
                    target_url += f"?{parsed_path.query}"
                
                logger.info(f"Proxying request:")
                logger.info(f"Original path: {self.path}")
                logger.info(f"Proxy path: {proxy_path}")
                logger.info(f"Target URL: {target_url}")
                
                # Get cookies from the request
                cookie_header = self.headers.get('Cookie', '')
                cookies = SimpleCookie(cookie_header)
                
                # Convert SimpleCookie to dict for requests
                cookies_dict = {k: v.value for k, v in cookies.items()}
                
                # Add any stored cookies
                for key, value in cookies_store.items():
                    if key not in cookies_dict:
                        cookies_dict[key] = value
                
                # Prepare headers for the gateway request
                headers = {
                    'Accept': 'application/x-protobuf',
                    'User-Agent': 'MapMetrics-GL/1.0',
                    'Origin': self.headers.get('Origin', 'http://localhost:8000')
                }
                
                # Add Authorization header if present
                auth_header = self.headers.get('Authorization')
                if auth_header:
                    headers['Authorization'] = auth_header
                
                logger.info(f"Request headers: {headers}")
                logger.info(f"Request cookies: {cookies_dict}")
                
                try:
                    # Make the request to the gateway
                    response = requests.get(
                        target_url,
                        headers=headers,
                        cookies=cookies_dict,
                        verify=certifi.where(),
                        stream=True,
                        timeout=30
                    )
                    
                    logger.info(f"Response status: {response.status_code}")
                    logger.info(f"Response headers: {dict(response.headers)}")
                    
                    # Store any new cookies from the response
                    if 'set-cookie' in response.headers:
                        new_cookies = SimpleCookie(response.headers['set-cookie'])
                        for key, value in new_cookies.items():
                            cookies_store[key] = value.value
                            # Set the cookie for gateway.mapmetrics.org domain
                            self.send_header('Set-Cookie', f"{key}={value.value}; Path=/; Domain=gateway.mapmetrics2.org; HttpOnly; SameSite=None; Secure")
                    
                    # Forward the response status
                    self.send_response(response.status_code)
                    
                    # Forward response headers
                    for key, value in response.headers.items():
                        if key.lower() not in ['transfer-encoding', 'connection', 'content-encoding', 'set-cookie', 'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-allow-credentials']:
                            self.send_header(key, value)
                    
                    self.end_headers()
                    
                    # Stream the response content in smaller chunks
                    try:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                self.wfile.write(chunk)
                                self.wfile.flush()
                    except (ConnectionResetError, BrokenPipeError) as e:
                        logger.error(f"Connection error while streaming: {str(e)}")
                        return
                    
                    return
                    
                except requests.exceptions.RequestException as e:
                    logger.error(f"Request error: {str(e)}")
                    self.send_error(500, f"Proxy request failed: {str(e)}")
                    return
            
            # If not a proxy request, serve the file
            return super().do_GET()
            
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            self.send_error(500, f"Internal Server Error: {str(e)}")

def run(port=8000):
    server_address = ('', port)
    httpd = socketserver.TCPServer(server_address, ProxyHandler)
    
    # SSL configuration
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain('localhost.crt', 'localhost.key')  # You'll need to generate these
    
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    print(f"Starting HTTPS server on port {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    run() 