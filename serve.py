#!/usr/bin/env python

import SocketServer
import BaseHTTPServer
import SimpleHTTPServer

class ThreadingSimpleServer(SocketServer.ThreadingMixIn, BaseHTTPServer.HTTPServer):
    pass

where = ('127.0.0.1', 8000)
server = ThreadingSimpleServer(where, SimpleHTTPServer.SimpleHTTPRequestHandler)
print "*** Serving on http://%s:%s - press CTRL + c to finish..." % where
try:
    while True:
        server.handle_request()
except KeyboardInterrupt:
    print "\nFinished"

