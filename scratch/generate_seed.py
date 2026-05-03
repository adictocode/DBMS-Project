import random

def generate_sql():
    sql = []
    
    # 1. Admin
    sql.append("-- 1. Admin for election management")
    sql.append("INSERT INTO Admins (name, email, password_hash, role) VALUES")
    sql.append("('Election Controller', 'controller@admin.com', 'securepass123', 'Election Manager');\n")
    
    # 2. Elections
    sql.append("-- 2. Two new elections (Upcoming status)")
    sql.append("INSERT INTO Elections (election_name, election_type, start_date, end_date, state_id, status) VALUES")
    sql.append("('Maharashtra Assembly Election 2026', 'State', '2026-10-15 08:00:00', '2026-10-15 18:00:00', 2, 'Upcoming'),")
    sql.append("('Karnataka General Election 2026', 'General', '2026-11-20 08:00:00', '2026-11-20 18:00:00', 3, 'Upcoming');\n")
    
    # Map constituencies to elections
    # For Maharashtra (ID 2), let's pick Pune (ID 47)
    # For Karnataka (ID 3), let's pick Bangalore South (ID 87)
    sql.append("-- Mapping constituencies to the new elections")
    sql.append("INSERT INTO Election_Constituencies (election_id, constituency_id) VALUES")
    sql.append("(2, 47), -- Maharashtra Election -> Pune")
    sql.append("(3, 87); -- Karnataka Election -> Bangalore South\n")
    
    # 3. Candidates
    # 3 candidates per party (ID 1, 2, 3) for the selected constituencies
    sql.append("-- 3. Candidates (3 per constituency representing each party)")
    sql.append("INSERT INTO Candidates (name, party_id, date_of_birth, manifesto) VALUES")
    
    candidates = [
        # Pune (Const 47, Elec 2)
        ('Vikram Deshmukh', 1, '1970-05-20', 'Development for Pune'),
        ('Anjali Kulkarni', 2, '1982-11-12', 'Social welfare and health'),
        ('Suresh Mane', 3, '1965-03-08', 'Local issues priority'),
        # Bangalore South (Const 87, Elec 3)
        ('Karthik Reddy', 1, '1978-01-30', 'Tech infrastructure growth'),
        ('Meera Hegde', 2, '1985-09-14', 'Education for all'),
        ('Raghu Gowda', 3, '1972-06-25', 'Farmers support')
    ]
    
    for i, cand in enumerate(candidates):
        comma = "," if i < len(candidates) - 1 else ";"
        sql.append(f"('{cand[0]}', {cand[1]}, '{cand[2]}', '{cand[3]}'){comma}")
    
    sql.append("\n-- Assigning candidates to contests")
    sql.append("INSERT INTO Candidate_Contests (candidate_id, constituency_id, election_id) VALUES")
    # Candidate IDs will likely be 5, 6, 7, 8, 9, 10 if there are 4 existing
    # But better to use subqueries or assume sequence if IDs start from 5
    sql.append("(5, 47, 2), (6, 47, 2), (7, 47, 2),")
    sql.append("(8, 87, 3), (9, 87, 3), (10, 87, 3);\n")
    
    # 4. Voters
    # 20 voters for Pune (47) and 20 for Bangalore South (87)
    sql.append("-- 4. Voters (20 per constituency)")
    sql.append("INSERT INTO Voters (name, date_of_birth, gender, email, constituency_id) VALUES")
    
    voter_data = []
    
    # Generate 20 for Pune
    for i in range(1, 21):
        voter_data.append((f"Pune Voter {i}", f"{random.randint(1960, 2005)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}", random.choice(['Male', 'Female']), f"pune_voter{i}@example.com", 47))
        
    # Generate 20 for Bangalore South
    for i in range(1, 21):
        voter_data.append((f"Bangalore Voter {i}", f"{random.randint(1960, 2005)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}", random.choice(['Male', 'Female']), f"blr_voter{i}@example.com", 87))
        
    for i, voter in enumerate(voter_data):
        comma = "," if i < len(voter_data) - 1 else ";"
        sql.append(f"('{voter[0]}', '{voter[1]}', '{voter[2]}', '{voter[3]}', {voter[4]}){comma}")
        
    return "\n".join(sql)

print(generate_sql())
