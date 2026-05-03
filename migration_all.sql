-- ================================================================
--  MIGRATION COMBINED
--  Run this AFTER the base DbmsProject_Final.sql schema is applied.
-- ================================================================

USE online_voting_system;

-- ----------------------------------------------------------------
-- From migration_v2.sql
-- ----------------------------------------------------------------
-- 1. Add is_active column to Candidates (if not already present).
ALTER TABLE Candidates
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Election History — stores result snapshots before election restart.
CREATE TABLE IF NOT EXISTS Election_History (
    history_id   INT          PRIMARY KEY AUTO_INCREMENT,
    election_id  INT          NOT NULL,
    snapshot_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    results_json JSON         NOT NULL,

    CONSTRAINT fk_eh_election
        FOREIGN KEY (election_id) REFERENCES Elections(election_id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_eh_election ON Election_History(election_id, snapshot_at DESC);

-- ----------------------------------------------------------------
-- From migration_candidates.sql
-- ----------------------------------------------------------------
-- Add the column if it does not exist (MySQL 8+ supports IF NOT EXISTS for columns, but we can just use ALTER TABLE)
-- Since we might need to handle this robustly in MariaDB:
ALTER TABLE Candidates
ADD COLUMN IF NOT EXISTS constituency_id INT;

ALTER TABLE Candidates
ADD CONSTRAINT fk_cand_constituency FOREIGN KEY (constituency_id) REFERENCES Constituencies(constituency_id);

ALTER TABLE Candidates
ADD CONSTRAINT uq_constituency_party UNIQUE (constituency_id, party_id);

-- ----------------------------------------------------------------
-- From migration_v3.sql
-- ----------------------------------------------------------------
-- 1. Fix register_voter stored procedure to explicitly return the exact voter_id
-- 2. Fix trg_vote_validation trigger to remove time-based constraints

DROP TRIGGER IF EXISTS trg_vote_validation;

DELIMITER $$

CREATE TRIGGER trg_vote_validation
BEFORE INSERT ON Votes
FOR EACH ROW
BEGIN
    DECLARE v_dob      DATE;
    DECLARE v_active   BOOLEAN;
    DECLARE v_const    INT;
    DECLARE c_const    INT;
    DECLARE v_state    INT;
    DECLARE e_state    INT;
    DECLARE v_status   VARCHAR(20);

    -- 1. Election must be Active (Time restrictions removed)
    SELECT status INTO v_status
    FROM Elections WHERE election_id = NEW.election_id;

    IF v_status != 'Active' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Election is not currently active';
    END IF;

    -- 2. Voter must be active and at least 18
    SELECT date_of_birth, is_active INTO v_dob, v_active
    FROM Voters WHERE voter_id = NEW.voter_id;

    IF TIMESTAMPDIFF(YEAR, v_dob, CURDATE()) < 18 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter is under 18 years of age';
    END IF;

    IF v_active = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter account is inactive or suspended';
    END IF;

    -- 3. Voter state must match election state
    SELECT c.state_id INTO v_state
    FROM Voters vr
    JOIN Constituencies c ON vr.constituency_id = c.constituency_id
    WHERE vr.voter_id = NEW.voter_id;

    SELECT state_id INTO e_state
    FROM Elections WHERE election_id = NEW.election_id;

    IF v_state != e_state THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter is not registered in the election state';
    END IF;

    -- 4. Voter constituency must match candidate's contested constituency
    SELECT constituency_id INTO v_const
    FROM Voters WHERE voter_id = NEW.voter_id;

    SELECT constituency_id INTO c_const
    FROM Candidate_Contests
    WHERE candidate_id = NEW.candidate_id AND election_id = NEW.election_id;

    IF v_const != c_const THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter constituency does not match candidate constituency';
    END IF;
END$$


DROP PROCEDURE IF EXISTS register_voter$$

CREATE PROCEDURE register_voter(
    IN p_name    VARCHAR(100),
    IN p_dob     DATE,
    IN p_gender  VARCHAR(10),
    IN p_email   VARCHAR(150),
    IN p_phone   VARCHAR(15),
    IN p_const   INT
)
BEGIN
    DECLARE new_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF TIMESTAMPDIFF(YEAR, p_dob, CURDATE()) < 18 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter must be at least 18 years old to register';
    END IF;

    START TRANSACTION;

    INSERT INTO Voters (name, date_of_birth, gender, email, phone, constituency_id)
    VALUES (p_name, p_dob, p_gender, p_email, p_phone, p_const);

    SET new_id = LAST_INSERT_ID();

    INSERT INTO Audit_Log (event_type, actor_id, target_id, details)
    VALUES ('VOTER_REGISTERED', new_id, new_id, CONCAT('email=', IFNULL(p_email,'NULL')));

    -- Expose the exact inserted voter_id to the Python caller instead of relying on session LAST_INSERT_ID()
    SELECT new_id AS voter_id;

    COMMIT;
END$$

DELIMITER ;
