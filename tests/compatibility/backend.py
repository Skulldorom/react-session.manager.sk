"""Real Flask companion used by the browser compatibility test."""

import argparse
from datetime import timedelta

from flask import Flask, jsonify, request, send_from_directory
from flask_jwt_extended import create_access_token, current_user, jwt_required
from flask_session_manager_sk import (
    SessionManager,
    SessionManagerCallbacks,
    session_response,
    token_response,
)
from flask_session_manager_sk.cookies import clear_token_response


class User:
    id = "compat-user"

    def __init__(self):
        self.current_token = None

    def issue_token(self, expires_delta=None):
        token = create_access_token(identity=self.id, expires_delta=expires_delta)
        self.current_token = token
        return token


def create_app(frontend_origin, api_origin, static_dir):
    app = Flask(__name__, static_folder=None)
    app.config.update(
        SECRET_KEY="compatibility-test-secret-key-at-least-32-bytes",
        JWT_SECRET_KEY="compatibility-test-jwt-secret-at-least-32-bytes",
        JWT_TOKEN_LOCATION=["cookies"],
        JWT_ACCESS_COOKIE_NAME="access_token_cookie",
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(seconds=30),
        JWT_COOKIE_CSRF_PROTECT=True,
        JWT_COOKIE_SECURE=True,
        JWT_COOKIE_SAMESITE="None",
        FSM_COOKIE_PARTITIONED=True,
        FRONTEND_URL=frontend_origin,
        CORS_ORIGINS=[frontend_origin, api_origin],
    )

    user = User()
    callbacks = SessionManagerCallbacks(
        user_lookup=lambda identity: user if identity == user.id else None,
        refresh_user_token=lambda _user, _agent, _device_uid: user.issue_token(),
        verify_user_token=lambda _user, _agent, _device_uid, token: (
            token == user.current_token
        ),
    )
    SessionManager(app, callbacks=callbacks)

    @app.after_request
    def cors(response):
        origin = request.headers.get("Origin")
        if origin == frontend_origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, X-CSRF-TOKEN, deviceUID, appVersion"
            )
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            exposed = response.headers.get("Access-Control-Expose-Headers", "")
            names = {name.strip() for name in exposed.split(",") if name.strip()}
            names.add("X-CSRF-TOKEN")
            response.headers["Access-Control-Expose-Headers"] = ", ".join(sorted(names))
        return response

    @app.post("/auth/login")
    def login():
        return token_response({"status": "success"}, access_token=user.issue_token())

    @app.get("/auth/who")
    @jwt_required(optional=True)
    def who():
        if current_user:
            return session_response(
                {
                    "logged_in": True,
                    "is_admin": False,
                    "Info": {"id": user.id, "roles": ["user"]},
                }
            )
        return jsonify(logged_in=False, is_admin=False, Info={})

    @app.get("/protected")
    @jwt_required()
    def protected():
        return jsonify(status="protected-ok")

    @app.post("/unsafe")
    @jwt_required()
    def unsafe():
        return jsonify(status="unsafe-ok")

    @app.post("/auth/prepare-rotation")
    @jwt_required()
    def prepare_rotation():
        return token_response(
            {"status": "rotation-prepared"},
            access_token=user.issue_token(timedelta(seconds=1)),
        )

    @app.post("/auth/invalidate")
    @jwt_required()
    def invalidate():
        user.current_token = None
        return jsonify(status="invalidated")

    @app.post("/auth/logout")
    @jwt_required(optional=True)
    def logout():
        user.current_token = None
        return clear_token_response()

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    @app.get("/")
    @app.get("/<path:path>")
    def frontend(path="index.html"):
        return send_from_directory(static_dir, path)

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--frontend-origin", required=True)
    parser.add_argument("--api-origin", required=True)
    parser.add_argument("--static-dir", required=True)
    parser.add_argument("--cert", required=True)
    parser.add_argument("--key", required=True)
    args = parser.parse_args()
    create_app(args.frontend_origin, args.api_origin, args.static_dir).run(
        host="127.0.0.1",
        port=args.port,
        ssl_context=(args.cert, args.key),
        threaded=True,
        use_reloader=False,
    )
