import mariadb
import sys

try:
    conn = mariadb.connect(
        host="localhost",
        port=3306,
        user="root",
        password="ketubh1122",
        database="online_voting_system"
    )
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE Candidates ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;")
    conn.commit()
    print("Migration successful: Added is_active column to Candidates table.")
    conn.close()
except mariadb.Error as e:
    print(f"Error connecting to MariaDB: {e}")
    sys.exit(1)
