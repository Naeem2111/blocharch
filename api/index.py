# Vercel serverless entry: route all requests to Flask and strip /api/index prefix
from app import app as flask_app

def middleware(wsgi_app, prefix="/api/index"):
    def wrapper(environ, start_response):
        path = environ.get("PATH_INFO", "")
        if path.startswith(prefix):
            environ["PATH_INFO"] = path[len(prefix):] or "/"
            environ["SCRIPT_NAME"] = prefix
        return wsgi_app(environ, start_response)
    return wrapper

app = middleware(flask_app)
