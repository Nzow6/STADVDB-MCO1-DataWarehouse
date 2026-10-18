import os
import sys
import json
import time
import decimal
import datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import mysql.connector
from mysql.connector import FieldType

SRC_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SRC_DIR)
ENV_FILE = os.path.join(PROJECT_ROOT, '.env')

def load_env(env_path):
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith('#') or '=' not in stripped:
                continue
            k, v = stripped.split('=', 1)
            k = k.strip()
            v = v.strip().strip("'\"")
            if k and k not in os.environ:
                os.environ[k] = v

load_env(ENV_FILE)

DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'root'),
    'password': os.environ.get('MYSQL_PASSWORD', 'Mysql.oznerol06'),
    'database': os.environ.get('MYSQL_DATABASE', 'green_taxi_dw'),
    'autocommit': True,
}

def get_connection():
    return mysql.connector.connect(**DB_CONFIG)

def map_mysql_type(type_code):
    int_types = {
        FieldType.TINY, FieldType.SHORT, FieldType.LONG,
        FieldType.LONGLONG, FieldType.INT24, FieldType.YEAR
    }
    numeric_types = {
        FieldType.DECIMAL, FieldType.NEWDECIMAL, FieldType.FLOAT, FieldType.DOUBLE
    }
    date_types = {
        FieldType.TIMESTAMP, FieldType.DATE, FieldType.DATETIME, FieldType.NEWDATE
    }
    time_types = {FieldType.TIME}

    if type_code in int_types:
        return 'INTEGER'
    elif type_code in numeric_types:
        return 'NUMERIC'
    elif type_code in date_types:
        return 'TIMESTAMP'
    elif type_code in time_types:
        return 'TIME'
    return 'VARCHAR'

def serialize_val(val):
    if val is None:
        return None
    if isinstance(val, decimal.Decimal):
        return float(val)
    if isinstance(val, (datetime.date, datetime.datetime, datetime.time)):
        return val.isoformat()
    if isinstance(val, (bytes, bytearray)):
        return val.decode('utf-8', errors='replace')
    return val

class OlapApiHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        if self.path in ('/api/status', '/api/health'):
            try:
                conn = get_connection()
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*) FROM fact_green_trips;")
                total_rows = cur.fetchone()[0]
                cur.close()
                conn.close()

                response = {
                    "status": "connected",
                    "engine": "MySQL Warehouse (Local Server)",
                    "database": DB_CONFIG['database'],
                    "totalRows": total_rows,
                    "connectedAt": datetime.datetime.now().isoformat()
                }
                self._set_headers(200)
                self.wfile.write(json.dumps(response).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not Found"}).encode('utf-8'))

    def do_POST(self):
        if self.path == '/api/query':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
                sql = data.get('sql', '').strip()
                if not sql:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": "SQL statement is required"}).encode('utf-8'))
                    return

                # Remove trailing semicolon if present
                clean_sql = sql.rstrip(';')

                print("\n" + "=" * 70, flush=True)
                print(f">> [SQL REQUEST RECEIVED]:\n{clean_sql}\n", flush=True)

                t0 = time.perf_counter()
                conn = get_connection()
                cur = conn.cursor()
                try:
                    # Set max execution time to 60s to prevent hung queries
                    try:
                        cur.execute("SET SESSION max_execution_time=60000;")
                    except Exception:
                        pass
                    cur.execute(clean_sql)

                    col_names = [col[0] for col in cur.description] if cur.description else []
                    col_types = [map_mysql_type(col[1]) for col in cur.description] if cur.description else []

                    raw_rows = cur.fetchall()
                    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
                    print(f">> [SQL SUCCESS]: {len(raw_rows)} rows returned in {elapsed_ms}ms", flush=True)
                    print("=" * 70 + "\n", flush=True)
                finally:
                    cur.close()
                    conn.close()

                # Build columns metadata
                columns = [{"name": name, "type": ctype} for name, ctype in zip(col_names, col_types)]

                # Build rows list of dicts
                rows = []
                for raw_r in raw_rows:
                    row_dict = {}
                    for name, val in zip(col_names, raw_r):
                        row_dict[name] = serialize_val(val)
                    rows.append(row_dict)

                response = {
                    "columns": columns,
                    "rows": rows,
                    "rowCount": len(rows),
                    "executionTimeMs": elapsed_ms,
                    "compiledSql": sql,
                    "sourceEngine": f"MySQL Warehouse ({elapsed_ms}ms • 1.05M Rows)"
                }

                self._set_headers(200)
                self.wfile.write(json.dumps(response).encode('utf-8'))

            except Exception as e:
                self._set_headers(400)
                err_msg = str(e)
                print(f">> [SQL ERROR]: {err_msg}", file=sys.stderr, flush=True)
                print("=" * 70 + "\n", file=sys.stderr, flush=True)
                self.wfile.write(json.dumps({"error": err_msg, "compiledSql": sql if 'sql' in locals() else ""}).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not Found"}).encode('utf-8'))

def run_server(port=5000):
    server_address = ('127.0.0.1', port)
    httpd = ThreadingHTTPServer(server_address, OlapApiHandler)
    print(f">> OLAP MySQL API Server listening on http://127.0.0.1:{port}", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == '__main__':
    port = int(os.environ.get('API_PORT', 5000))
    run_server(port)
