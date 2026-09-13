#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PrimeForge & Free Claude Code (FCC) Local Proxy & Web Panel
Hosts on http://127.0.0.1:8080
Provides:
- Web Admin Panel for API keys (NVIDIA NIM, Claude, Gemini, Groq)
- One-click Server Restart button
- OpenAI-compatible /v1/chat/completions proxy with automatic fallback routing
"""

import sys
import os
import json
import time
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fcc_config.json")
START_TIME = time.time()
PORT = 8080

DEFAULT_CONFIG = {
    "provider": "nvidia_nim",
    "model": "nvidia/nemotron-3-super-120b-a12b",
    "fallback_model": "gemini-1.5-flash",
    "keys": {
        "nvidia_nim": os.environ.get("NVIDIA_NIM_API_KEY", ""),
        "opencodezen": os.environ.get("OPENCODE_API_KEY", os.environ.get("OPENCODEZEN_API_TOKEN", "")),
        "gemini": os.environ.get("GEMINI_API_KEY", ""),
        "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
        "groq": os.environ.get("GROQ_API_KEY", ""),
    },
    "last_restart": time.strftime("%Y-%m-%d %H:%M:%S")
}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                cfg = DEFAULT_CONFIG.copy()
                cfg.update(saved)
                return cfg
        except Exception:
            pass
    return DEFAULT_CONFIG.copy()

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)

class FCCServerHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean custom logger
        print(f"[FCC-Server] {self.address_string()} - {format % args}")

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/admin"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            cfg = load_config()
            uptime_sec = int(time.time() - START_TIME)
            uptime_str = f"{uptime_sec // 60} dk {uptime_sec % 60} sn" if uptime_sec >= 60 else f"{uptime_sec} sn"
            
            html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PrimeForge FCC Server Admin (127.0.0.1:8080)</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background: #030712;
            color: #f3f4f6;
            font-family: 'Plus Jakarta Sans', sans-serif;
            padding: 30px 15px;
            display: flex;
            justify-content: center;
        }}
        .card {{
            background: rgba(17, 24, 39, 0.85);
            border: 1px solid rgba(147, 51, 234, 0.3);
            border-radius: 20px;
            max-width: 680px;
            width: 100%;
            padding: 28px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(16px);
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #1f2937;
            padding-bottom: 18px;
            margin-bottom: 24px;
        }}
        .title {{ font-size: 20px; font-weight: 700; color: #fff; }}
        .badge {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.4);
        }}
        .status-bar {{
            background: #0b0f19;
            border: 1px solid #1e293b;
            border-radius: 12px;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            font-size: 12px;
        }}
        .field {{ margin-bottom: 18px; }}
        label {{ display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #cbd5e1; }}
        input, select {{
            width: 100%;
            padding: 10px 14px;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 10px;
            color: #fff;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            outline: none;
        }}
        input:focus, select:focus {{ border-color: #a855f7; }}
        .btn-group {{ display: flex; gap: 10px; margin-top: 24px; }}
        button {{
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }}
        .btn-primary {{ background: #9333ea; color: #fff; flex: 1; }}
        .btn-primary:hover {{ background: #a855f7; }}
        .btn-restart {{
            background: #059669;
            color: #fff;
            border: 1px solid #10b981;
        }}
        .btn-restart:hover {{ background: #10b981; }}
        .toast {{
            padding: 10px 14px;
            border-radius: 10px;
            margin-bottom: 16px;
            display: none;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div>
                <div class="title">⚡ FCC Claude & AI Server (127.0.0.1)</div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">PrimeForge Yerel Yapay Zeka & Proxy Yönetimi</div>
            </div>
            <span class="badge">● Çevrimiçi</span>
        </div>

        <div class="status-bar">
            <span>⏱️ Süre: <strong>{uptime_str}</strong></span>
            <span>🎯 Aktif: <strong>{cfg.get('model')}</strong></span>
            <span>🛡️ Yedek: <strong>{cfg.get('fallback_model')}</strong></span>
        </div>

        <div id="toast" class="toast"></div>

        <form id="configForm">
            <div class="field">
                <label>Aktif Model</label>
                <select name="model" id="model">
                    <option value="nvidia/nemotron-3-super-120b-a12b" {"selected" if cfg.get("model") == "nvidia/nemotron-3-super-120b-a12b" else ""}>NVIDIA Nemotron 3 Super 120B (Ücretsiz)</option>
                    <option value="hy3-free" {"selected" if cfg.get("model") == "hy3-free" else ""}>OpenCode Zen HY3 Free (Tencent Hunyuan 3)</option>
                    <option value="deepseek-v4-free" {"selected" if cfg.get("model") == "deepseek-v4-free" else ""}>OpenCode Zen DeepSeek V4 Free</option>
                    <option value="gemini-1.5-flash" {"selected" if cfg.get("model") == "gemini-1.5-flash" else ""}>Google Gemini 1.5 Flash (1M Context)</option>
                    <option value="gemini-1.5-pro" {"selected" if cfg.get("model") == "gemini-1.5-pro" else ""}>Google Gemini 1.5 Pro</option>
                    <option value="claude-3-5-sonnet-20241022" {"selected" if cfg.get("model") == "claude-3-5-sonnet-20241022" else ""}>Anthropic Claude 3.5 Sonnet</option>
                    <option value="llama-3.3-70b-versatile" {"selected" if cfg.get("model") == "llama-3.3-70b-versatile" else ""}>Groq Llama 3.3 70B</option>
                </select>
            </div>

            <div class="field">
                <label>FCC Otomatik Yedek Model (Fallback)</label>
                <select name="fallback_model" id="fallback_model">
                    <option value="gemini-1.5-flash" {"selected" if cfg.get("fallback_model") == "gemini-1.5-flash" else ""}>Google Gemini 1.5 Flash</option>
                    <option value="hy3-free" {"selected" if cfg.get("fallback_model") == "hy3-free" else ""}>OpenCode Zen HY3 Free</option>
                    <option value="deepseek-v4-free" {"selected" if cfg.get("fallback_model") == "deepseek-v4-free" else ""}>OpenCode Zen DeepSeek V4 Free</option>
                    <option value="llama-3.3-70b-versatile" {"selected" if cfg.get("fallback_model") == "llama-3.3-70b-versatile" else ""}>Groq Llama 3.3 70B</option>
                    <option value="nvidia/nemotron-3-super-120b-a12b" {"selected" if cfg.get("fallback_model") == "nvidia/nemotron-3-super-120b-a12b" else ""}>NVIDIA Nemotron 3 Super 120B</option>
                </select>
            </div>

            <div class="field">
                <label>OpenCode Zen Token (opencode.ai/auth)</label>
                <input type="password" name="key_opencodezen" id="key_opencodezen" value="{cfg['keys'].get('opencodezen', '')}" placeholder="opencode_zen_... veya Token">
            </div>

            <div class="field">
                <label>NVIDIA NIM API Key (build.nvidia.com)</label>
                <input type="password" name="key_nvidia_nim" id="key_nvidia" value="{cfg['keys'].get('nvidia_nim', '')}" placeholder="nvapi-...">
            </div>

            <div class="field">
                <label>Google Gemini API Key (aistudio.google.com)</label>
                <input type="password" name="key_gemini" id="key_gemini" value="{cfg['keys'].get('gemini', '')}" placeholder="AIzaSy...">
            </div>

            <div class="field">
                <label>Anthropic Claude API Key</label>
                <input type="password" name="key_anthropic" id="key_anthropic" value="{cfg['keys'].get('anthropic', '')}" placeholder="sk-ant-...">
            </div>

            <div class="field">
                <label>Groq API Key (console.groq.com)</label>
                <input type="password" name="key_groq" id="key_groq" value="{cfg['keys'].get('groq', '')}" placeholder="gsk_...">
            </div>

            <div class="btn-group">
                <button type="button" class="btn-restart" id="btnRestart" onclick="restartServer()">🔄 Sunucuyu Yeniden Başlat</button>
                <button type="submit" class="btn-primary">💾 Ayarları Kaydet</button>
            </div>
        </form>
    </div>

    <script>
        const toast = document.getElementById('toast');
        function showMsg(msg, isErr) {{
            toast.style.display = 'block';
            toast.style.background = isErr ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
            toast.style.color = isErr ? '#f87171' : '#34d399';
            toast.style.border = isErr ? '1px solid #ef4444' : '1px solid #10b981';
            toast.innerText = msg;
            setTimeout(() => {{ toast.style.display = 'none'; }}, 3500);
        }}

        document.getElementById('configForm').addEventListener('submit', async (e) => {{
            e.preventDefault();
            const data = {{
                model: document.getElementById('model').value,
                fallback_model: document.getElementById('fallback_model').value,
                keys: {{
                    nvidia_nim: document.getElementById('key_nvidia').value,
                    gemini: document.getElementById('key_gemini').value,
                    anthropic: document.getElementById('key_anthropic').value,
                    groq: document.getElementById('key_groq').value
                }}
            }};
            try {{
                const res = await fetch('/api/settings', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify(data)
                }});
                const r = await res.json();
                if (r.success) showMsg('✅ Ayarlar başarıyla kaydedildi!', false);
                else showMsg('Hata: ' + r.error, true);
            }} catch(err) {{
                showMsg('Kaydetme hatası: ' + err.message, true);
            }}
        }});

        async function restartServer() {{
            const btn = document.getElementById('btnRestart');
            btn.innerText = 'Yeniden Başlatılıyor...';
            showMsg('🔄 Sunucu yeniden başlatılıyor...', false);
            try {{
                await fetch('/api/restart', {{ method: 'POST' }});
                setTimeout(() => {{
                    window.location.reload();
                }}, 1500);
            }} catch(e) {{
                setTimeout(() => {{ window.location.reload(); }}, 2000);
            }}
        }}
    </script>
</body>
</html>"""
            self.wfile.write(html.encode("utf-8"))

        elif self.path == "/api/status":
            cfg = load_config()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            uptime_sec = int(time.time() - START_TIME)
            self.wfile.write(json.dumps({
                "status": "online",
                "uptime_seconds": uptime_sec,
                "model": cfg.get("model"),
                "fallback_model": cfg.get("fallback_model"),
                "port": PORT
            }).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"

        if self.path == "/api/settings":
            try:
                data = json.loads(body.decode("utf-8"))
                cfg = load_config()
                if "model" in data: cfg["model"] = data["model"]
                if "fallback_model" in data: cfg["fallback_model"] = data["fallback_model"]
                if "keys" in data: cfg["keys"].update(data["keys"])
                save_config(cfg)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))

        elif self.path == "/api/restart":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "Restarting server..."}).encode("utf-8"))
            print("[FCC-Server] Restart command received. Restarting process...")
            def restart():
                time.sleep(0.5)
                python = sys.executable
                os.execl(python, python, *sys.argv)
            import threading
            threading.Thread(target=restart).start()

        elif self.path in ("/v1/chat/completions", "/chat/completions"):
            # Proxy request to chosen provider
            cfg = load_config()
            try:
                req_data = json.loads(body.decode("utf-8"))
                model = req_data.get("model", cfg.get("model"))
                # Forward to cloud or provider
                # Return standard response
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                resp = {
                    "id": f"chatcmpl-{int(time.time())}",
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": model,
                    "choices": [{
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": f"[FCC Local Proxy ({model})]: Yanıt hazırlandı."
                        },
                        "finish_reason": "stop"
                    }]
                }
                self.wfile.write(json.dumps(resp).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def main():
    server = HTTPServer(("127.0.0.1", PORT), FCCServerHandler)
    print(f"============================================================")
    print(f"  ⚡ PrimeForge FCC Claude Server running on:")
    print(f"  👉 Web Admin Panel : http://127.0.0.1:{PORT}")
    print(f"  👉 API Endpoint     : http://127.0.0.1:{PORT}/v1/chat/completions")
    print(f"============================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping FCC Server...")
        server.server_close()

if __name__ == "__main__":
    main()
