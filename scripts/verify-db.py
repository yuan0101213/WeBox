#!/usr/bin/env python3
"""Verify real MySQL tables and constraints. Test writes are rolled back."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
COMMAND = ['docker', 'compose', 'exec', '-T', 'mysql', 'sh', '-c',
           'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --batch --skip-column-names -u"$MYSQL_USER" "$MYSQL_DATABASE"']

def query(sql):
    return subprocess.run(COMMAND, input=sql, text=True, cwd=ROOT, capture_output=True)

result = query('SHOW TABLES;')
assert result.returncode == 0, result.stderr
assert set(result.stdout.split()) == {'users', 'dishes', 'daily_menu_items', 'orders', 'order_items', 'user_preferences'}, result.stdout
print('PASS: six business tables exist')

cases = [
    ('email uniqueness', "START TRANSACTION; INSERT INTO users(email,password_hash) VALUES ('constraint-test@example.test','test'); INSERT INTO users(email,password_hash) VALUES ('constraint-test@example.test','test');", '1062'),
    ('positive quantity', "START TRANSACTION; INSERT INTO users(email,password_hash) VALUES ('constraint-test@example.test','test'); SET @uid=LAST_INSERT_ID(); INSERT INTO orders(order_no,user_id,request_id,request_hash,delivery_date,meal_period,address,total_fen) VALUES ('constraint-test',@uid,'test',REPEAT('a',64),CURRENT_DATE(),'Lunch','Test',100); SET @oid=LAST_INSERT_ID(); INSERT INTO order_items(order_id,dish_id,dish_name,options_json,unit_price_fen,quantity,subtotal_fen) VALUES (@oid,1,'Test','[]',100,0,0);", '3819'),
    ('foreign key', 'START TRANSACTION; INSERT INTO daily_menu_items(menu_date,dish_id) VALUES (CURRENT_DATE(),-1);', '1452'),
    ('nonnegative price', "START TRANSACTION; UPDATE dishes SET price_fen=-1 WHERE id=1;", '3819'),
    ('request uniqueness', "START TRANSACTION; INSERT INTO users(email,password_hash) VALUES ('constraint-test@example.test','test'); SET @uid=LAST_INSERT_ID(); INSERT INTO orders(order_no,user_id,request_id,request_hash,delivery_date,meal_period,address,total_fen) VALUES ('constraint-test-a',@uid,'test',REPEAT('a',64),CURRENT_DATE(),'Lunch','Test',100); INSERT INTO orders(order_no,user_id,request_id,request_hash,delivery_date,meal_period,address,total_fen) VALUES ('constraint-test-b',@uid,'test',REPEAT('a',64),CURRENT_DATE(),'Lunch','Test',100);", '1062'),
]
for name, sql, code in cases:
    result = query(sql)
    assert result.returncode != 0 and code in result.stderr, (name, result.stdout, result.stderr)
    print(f'PASS: {name}')
result = query("SELECT COUNT(*) FROM users WHERE email='constraint-test@example.test';")
assert result.returncode == 0 and result.stdout.strip() == '0', result.stdout
print('PASS: test transactions left no user rows')
