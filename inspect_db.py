import os
import mysql.connector

def load_env(env_path):
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith('#') or '=' not in stripped:
                continue
            k, v = stripped.split('=', 1)
            os.environ[k.strip()] = v.strip().strip("'\"")

load_env('.env')

conn = mysql.connector.connect(
    host=os.environ.get('MYSQL_HOST', '127.0.0.1'),
    port=int(os.environ.get('MYSQL_PORT', 3306)),
    user=os.environ.get('MYSQL_USER', 'root'),
    password=os.environ.get('MYSQL_PASSWORD', 'Mysql.oznerol06'),
    database=os.environ.get('MYSQL_DATABASE', 'green_taxi_dw')
)
cur = conn.cursor(dictionary=True)
cur.execute('SHOW FULL PROCESSLIST;')
processes = cur.fetchall()
print(f"Total processes: {len(processes)}")
for p in processes:
    if p['Info'] and 'PROCESSLIST' not in p['Info']:
        print(f"PID: {p['Id']} | Time: {p['Time']}s | Command: {p['Command']} | State: {p['State']}")
        print(f"Query: {p['Info']}")
        print("-" * 50)
conn.close()
