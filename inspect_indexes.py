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
cur.execute('SHOW INDEX FROM fact_green_trips;')
indexes = cur.fetchall()
print(f"Total index entries on fact_green_trips: {len(indexes)}")
index_dict = {}
for idx in indexes:
    k = idx['Key_name']
    col = idx['Column_name']
    index_dict.setdefault(k, []).append(col)

for name, cols in index_dict.items():
    print(f"Index: {name} -> {', '.join(cols)}")
conn.close()
