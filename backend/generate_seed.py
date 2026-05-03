import mariadb
import random
from faker import Faker
import sys

def seed_candidates():
    try:
        db = mariadb.connect(
            host="localhost",
            user="root",
            password="ketubh1122",
            database="online_voting_system"
        )
    except mariadb.Error as e:
        print(f"Error connecting to MariaDB Platform: {e}")
        sys.exit(1)
        
    cursor = db.cursor()
    fake = Faker()

    # Get all constituencies
    cursor.execute("SELECT constituency_id FROM Constituencies")
    constituencies = [row[0] for row in cursor.fetchall()]

    # Get all parties
    cursor.execute("SELECT party_id FROM Parties")
    parties = [row[0] for row in cursor.fetchall()]

    for c_id in constituencies:
        for p_id in parties:
            cursor.execute("""
                SELECT candidate_id FROM Candidates 
                WHERE constituency_id = ? AND party_id = ?
            """, (c_id, p_id))
            
            if not cursor.fetchone():
                name = fake.name()
                dob = fake.date_of_birth(minimum_age=25, maximum_age=70)
                
                try:
                    cursor.execute("""
                        INSERT INTO Candidates (name, party_id, date_of_birth, constituency_id)
                        VALUES (?, ?, ?, ?)
                    """, (name, p_id, dob, c_id))
                    db.commit()
                except mariadb.IntegrityError:
                    db.rollback()

    # Link constituencies to elections in their state, and candidates to contests
    cursor.execute("SELECT election_id, state_id FROM Elections WHERE status IN ('Upcoming', 'Active')")
    elections = cursor.fetchall()
    
    for e_id, s_id in elections:
        cursor.execute("SELECT constituency_id FROM Constituencies WHERE state_id = ?", (s_id,))
        state_constituencies = [row[0] for row in cursor.fetchall()]
        
        for c_id in state_constituencies:
            # Add to Election_Constituencies
            try:
                cursor.execute("INSERT INTO Election_Constituencies (election_id, constituency_id) VALUES (?, ?)", (e_id, c_id))
                db.commit()
            except mariadb.IntegrityError:
                db.rollback()
                
            # Add candidates to Candidate_Contests
            cursor.execute("SELECT candidate_id FROM Candidates WHERE constituency_id = ?", (c_id,))
            cands = [row[0] for row in cursor.fetchall()]
            for cand_id in cands:
                try:
                    cursor.execute("INSERT INTO Candidate_Contests (candidate_id, constituency_id, election_id) VALUES (?, ?, ?)", (cand_id, c_id, e_id))
                    db.commit()
                except mariadb.IntegrityError:
                    db.rollback()

    cursor.close()
    db.close()

if __name__ == "__main__":
    seed_candidates()
