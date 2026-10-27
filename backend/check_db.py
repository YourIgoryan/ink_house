import sqlite3
from pathlib import Path

db_path = Path("ink_house.db")

print("Путь к базе:", db_path.resolve())
print("Файл существует:", db_path.exists())

if db_path.exists():
    conn = sqlite3.connect(str(db_path))
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()

    print("\nТаблицы базы данных:")
    for table in tables:
        print("-", table[0])

    conn.close()