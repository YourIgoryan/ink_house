import sqlite3
from pathlib import Path

db_path = Path("ink_house.db").resolve()
conn = sqlite3.connect(str(db_path))

try:
    count = conn.execute(
        "SELECT COUNT(*) FROM appointments"
    ).fetchone()[0]

    print("База данных:", db_path)
    print("Записей на удаление:", count)

    confirm = input(
        "Удалить ВСЕ записи из appointments? Введи YES для подтверждения: "
    )

    if confirm == "YES":
        conn.execute("DELETE FROM appointments")
        conn.commit()
        print("Записи удалены.")
    else:
        print("Отменено. База не изменена.")

finally:
    conn.close()