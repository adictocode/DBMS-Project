-- 1. Admin for election management
INSERT INTO Admins (name, email, password_hash, role) VALUES
('Election Controller', 'controller@admin.com', 'securepass123', 'Election Manager');

-- 2. Two new elections (Upcoming status)
INSERT INTO Elections (election_name, election_type, start_date, end_date, state_id, status) VALUES
('Maharashtra Assembly Election 2026', 'State', '2026-10-15 08:00:00', '2026-10-15 18:00:00', 2, 'Upcoming'),
('Karnataka General Election 2026', 'General', '2026-11-20 08:00:00', '2026-11-20 18:00:00', 3, 'Upcoming');

-- Mapping constituencies to the new elections
INSERT INTO Election_Constituencies (election_id, constituency_id) VALUES
(2, 47), -- Maharashtra Election -> Pune
(3, 87); -- Karnataka Election -> Bangalore South

-- 3. Candidates (3 per constituency representing each party)
INSERT INTO Candidates (name, party_id, date_of_birth, manifesto) VALUES
('Vikram Deshmukh', 1, '1970-05-20', 'Development for Pune'),
('Anjali Kulkarni', 2, '1982-11-12', 'Social welfare and health'),
('Suresh Mane', 3, '1965-03-08', 'Local issues priority'),
('Karthik Reddy', 1, '1978-01-30', 'Tech infrastructure growth'),
('Meera Hegde', 2, '1985-09-14', 'Education for all'),
('Raghu Gowda', 3, '1972-06-25', 'Farmers support');

-- Assigning candidates to contests
INSERT INTO Candidate_Contests (candidate_id, constituency_id, election_id) VALUES
(5, 47, 2), (6, 47, 2), (7, 47, 2),
(8, 87, 3), (9, 87, 3), (10, 87, 3);

-- 4. Voters (20 per constituency)
INSERT INTO Voters (name, date_of_birth, gender, email, constituency_id) VALUES
('Pune Voter 1', '1987-07-15', 'Male', 'pune_voter1@example.com', 47),
('Pune Voter 2', '1961-10-27', 'Male', 'pune_voter2@example.com', 47),
('Pune Voter 3', '1977-06-23', 'Male', 'pune_voter3@example.com', 47),
('Pune Voter 4', '1993-09-19', 'Female', 'pune_voter4@example.com', 47),
('Pune Voter 5', '1982-01-13', 'Male', 'pune_voter5@example.com', 47),
('Pune Voter 6', '1969-12-12', 'Female', 'pune_voter6@example.com', 47),
('Pune Voter 7', '1973-05-16', 'Female', 'pune_voter7@example.com', 47),
('Pune Voter 8', '1971-11-04', 'Male', 'pune_voter8@example.com', 47),
('Pune Voter 9', '1989-10-21', 'Female', 'pune_voter9@example.com', 47),
('Pune Voter 10', '1981-04-20', 'Male', 'pune_voter10@example.com', 47),
('Pune Voter 11', '1977-01-02', 'Male', 'pune_voter11@example.com', 47),
('Pune Voter 12', '1972-11-16', 'Male', 'pune_voter12@example.com', 47),
('Pune Voter 13', '1985-12-24', 'Female', 'pune_voter13@example.com', 47),
('Pune Voter 14', '1985-08-21', 'Male', 'pune_voter14@example.com', 47),
('Pune Voter 15', '1974-04-24', 'Male', 'pune_voter15@example.com', 47),
('Pune Voter 16', '1985-07-01', 'Male', 'pune_voter16@example.com', 47),
('Pune Voter 17', '2003-12-07', 'Male', 'pune_voter17@example.com', 47),
('Pune Voter 18', '1961-02-16', 'Male', 'pune_voter18@example.com', 47),
('Pune Voter 19', '1971-12-24', 'Male', 'pune_voter19@example.com', 47),
('Pune Voter 20', '1962-01-22', 'Male', 'pune_voter20@example.com', 47),
('Bangalore Voter 1', '1977-12-04', 'Female', 'blr_voter1@example.com', 87),
('Bangalore Voter 2', '1998-01-11', 'Male', 'blr_voter2@example.com', 87),
('Bangalore Voter 3', '1984-06-01', 'Female', 'blr_voter3@example.com', 87),
('Bangalore Voter 4', '1986-06-19', 'Male', 'blr_voter4@example.com', 87),
('Bangalore Voter 5', '1972-04-19', 'Male', 'blr_voter5@example.com', 87),
('Bangalore Voter 6', '1980-07-22', 'Male', 'blr_voter6@example.com', 87),
('Bangalore Voter 7', '1987-03-01', 'Male', 'blr_voter7@example.com', 87),
('Bangalore Voter 8', '1999-01-08', 'Female', 'blr_voter8@example.com', 87),
('Bangalore Voter 9', '1966-07-18', 'Female', 'blr_voter9@example.com', 87),
('Bangalore Voter 10', '2000-05-07', 'Male', 'blr_voter10@example.com', 87),
('Bangalore Voter 11', '1967-09-24', 'Female', 'blr_voter11@example.com', 87),
('Bangalore Voter 12', '1981-02-08', 'Female', 'blr_voter12@example.com', 87),
('Bangalore Voter 13', '1966-09-14', 'Male', 'blr_voter13@example.com', 87),
('Bangalore Voter 14', '1999-10-13', 'Male', 'blr_voter14@example.com', 87),
('Bangalore Voter 15', '2000-09-17', 'Female', 'blr_voter15@example.com', 87),
('Bangalore Voter 16', '1968-01-21', 'Female', 'blr_voter16@example.com', 87),
('Bangalore Voter 17', '1992-01-28', 'Male', 'blr_voter17@example.com', 87),
('Bangalore Voter 18', '1965-06-09', 'Female', 'blr_voter18@example.com', 87),
('Bangalore Voter 19', '2000-07-19', 'Female', 'blr_voter19@example.com', 87),
('Bangalore Voter 20', '1971-10-15', 'Male', 'blr_voter20@example.com', 87);
