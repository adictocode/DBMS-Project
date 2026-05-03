-- ================================================================
--  ONLINE VOTING SYSTEM  –  Final Enhanced Version
--  College DBMS Project
--
--  VERDICT
--  ───────
--  DbmsProject.sql  (v3 / "Hardened") is significantly better.
--  DbmsProject1.sql ("Improved Schema") contains several critical
--  bugs that v3 already fixed.  This file starts from v3 as the
--  base and adds new features on top.
--
--  BUGS FIXED FROM DbmsProject1.sql (the weaker file)
--  ────────────────────────────────────────────────────
--  [B1]  ON DELETE CASCADE on Elections FK in Votes — silently
--        wipes all vote records when an election is deleted.
--        Changed to RESTRICT everywhere on integrity-critical FKs.
--
--  [B2]  DETERMINISTIC on is_eligible(), has_voted(),
--        election_status() — these read live table data so they
--        are NOT deterministic. Wrong flag corrupts the query cache.
--        Fixed to NOT DETERMINISTIC + READS SQL DATA.
--
--  [B3]  CHECK (date_of_birth < CURDATE()) on Voters — MySQL
--        evaluates CHECK at DDL time (constant), not per-row.
--        Removed; enforced correctly by BEFORE INSERT/UPDATE trigger.
--
--  [B4]  Candidate date_of_birth is nullable in DbmsProject1 —
--        age cannot be verified. Made NOT NULL.
--
--  [B5]  register_voter() / create_election() have no transaction
--        in DbmsProject1 — a partial failure leaves orphan rows.
--        Both wrapped in explicit transactions.
--
--  [B6]  Audit_Log has no tamper protection in DbmsProject1 —
--        any user can UPDATE or DELETE audit records. Added triggers.
--
--  [B7]  No cross-state checks — a Punjab election could contain
--        a Maharashtra constituency/candidate/voter. Added triggers
--        trg_ec_state_match, trg_cc_state_match, trg_voter_state_match.
--
--  [B8]  Voter constituency not locked after vote — constituency
--        could change post-vote, breaking the audit trail.
--        Added trg_voter_const_lock.
--
--  [B9]  Trailing comma after last column in Parties table
--        (DbmsProject.sql line ~45) — syntax error. Removed.
--
--  [B10] trg_cand_age_insert checks < 18 but trg_cand_age_update
--        checks < 25 — inconsistent minimum age. Both now use 25
--        (standard legislative requirement).
--
--  NEW FEATURES ADDED
--  ──────────────────
--  [F1]  Elections.created_at timestamp (was missing in v1).
--  [F2]  Parties.founded_on date column.
--  [F3]  vw_pending_voters — voters who haven't voted yet in an
--        active election (useful for follow-up / monitoring).
--  [F4]  vw_party_performance — seat wins per party per election.
--  [F5]  activate_election() and close_election() stored procedures
--        with status-guard and audit trail.
--  [F6]  total_votes_cast() scalar function.
--  [F7]  deactivate_voter() procedure (soft-delete with audit).
--  [F8]  cancel_election() procedure (Upcoming/Active → Cancelled).
--  [F9]  idx_audit_actor index on Audit_Log for actor lookups.
--  [F10] idx_elec_status index on Elections for status-filtered queries.
--  [F11] Regression / sanity test block at the end (commented-out
--        INSERT tests for each trigger).
-- ================================================================

-- ================================================================
-- SECTION 1 : CORE LOOKUP TABLES
-- ================================================================
CREATE DATABASE IF NOT EXISTS online_voting_system;

USE online_voting_system;
CREATE TABLE States (
    state_id   INT          PRIMARY KEY AUTO_INCREMENT,
    state_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Constituencies (
    constituency_id   INT          PRIMARY KEY AUTO_INCREMENT,
    constituency_name VARCHAR(100) NOT NULL,
    state_id          INT          NOT NULL,

    CONSTRAINT fk_const_state
        FOREIGN KEY (state_id) REFERENCES States(state_id)
        ON DELETE RESTRICT,   -- never silently delete a state that has constituencies

    CONSTRAINT uq_const_state UNIQUE (constituency_name, state_id)
);

CREATE TABLE Parties (
    party_id   INT          PRIMARY KEY AUTO_INCREMENT,
    party_name VARCHAR(100) NOT NULL UNIQUE,
    symbol     VARCHAR(100) NOT NULL UNIQUE,  -- election symbol (required)
    founded_on DATE                            -- [F2] optional founding date
    -- NOTE: no trailing comma after last column — was a syntax error in v1
);

-- ================================================================
-- SECTION 2 : ELECTIONS
-- ================================================================

CREATE TABLE Elections (
    election_id   INT          PRIMARY KEY AUTO_INCREMENT,
    election_name VARCHAR(150) NOT NULL,
    election_type ENUM('General','State','By-election') NOT NULL DEFAULT 'State',
    start_date    DATETIME     NOT NULL,
    end_date      DATETIME     NOT NULL,
    state_id      INT          NOT NULL,
    status        ENUM('Upcoming','Active','Completed','Cancelled')
                               NOT NULL DEFAULT 'Upcoming',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- [F1]

    CONSTRAINT chk_dates CHECK (end_date > start_date),

    CONSTRAINT fk_elec_state
        FOREIGN KEY (state_id) REFERENCES States(state_id)
        ON DELETE RESTRICT    -- [B1] never silently cascade-delete elections
);

-- Maps which constituencies participate in an election
-- [B7] cross-state check enforced by trigger trg_ec_state_match
CREATE TABLE Election_Constituencies (
    election_id      INT NOT NULL,
    constituency_id  INT NOT NULL,

    PRIMARY KEY (election_id, constituency_id),

    CONSTRAINT fk_ec_election
        FOREIGN KEY (election_id) REFERENCES Elections(election_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_ec_const
        FOREIGN KEY (constituency_id) REFERENCES Constituencies(constituency_id)
        ON DELETE RESTRICT
);

-- ================================================================
-- SECTION 2.5 : ADMINS
-- ================================================================

CREATE TABLE Admins (
    admin_id        INT          PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  NOT NULL DEFAULT 'System Admin',
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ================================================================
-- SECTION 3 : VOTERS
-- ================================================================

CREATE TABLE Voters (
    voter_id        INT          PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    date_of_birth   DATE         NOT NULL,
    gender          ENUM('Male','Female','Other'),
    email           VARCHAR(150) UNIQUE,
    phone           VARCHAR(15)  UNIQUE,
    constituency_id INT          NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    registered_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- [B3] DOB < today enforced by trigger (NOT a CHECK), because MySQL
    --       evaluates CHECK at DDL time — it would become a constant.

    CONSTRAINT fk_voter_const
        FOREIGN KEY (constituency_id) REFERENCES Constituencies(constituency_id)
        ON DELETE RESTRICT
);

-- ================================================================
-- SECTION 4 : CANDIDATES
-- ================================================================

CREATE TABLE Candidates (
    candidate_id  INT          PRIMARY KEY AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    party_id      INT          NOT NULL,
    date_of_birth DATE         NOT NULL,  -- [B4] NOT NULL so age can be verified
    manifesto     TEXT,

    CONSTRAINT fk_cand_party
        FOREIGN KEY (party_id) REFERENCES Parties(party_id)
        ON DELETE RESTRICT
);

-- One candidate per constituency per election.
-- [B7] cross-state check enforced by trigger trg_cc_state_match.
CREATE TABLE Candidate_Contests (
    candidate_id    INT NOT NULL,
    constituency_id INT NOT NULL,
    election_id     INT NOT NULL,

    PRIMARY KEY (candidate_id, election_id),       -- one seat per candidate per election
    -- REMOVED uq_one_per_seat: a constituency must allow multiple candidates!

    CONSTRAINT fk_cc_candidate
        FOREIGN KEY (candidate_id) REFERENCES Candidates(candidate_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_cc_const
        FOREIGN KEY (constituency_id) REFERENCES Constituencies(constituency_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_cc_election
        FOREIGN KEY (election_id) REFERENCES Elections(election_id)
        ON DELETE RESTRICT
);

-- ================================================================
-- SECTION 5 : VOTES  (most integrity-critical table)
-- ================================================================

CREATE TABLE Votes (
    vote_id      INT       PRIMARY KEY AUTO_INCREMENT,
    voter_id     INT       NOT NULL,
    candidate_id INT       NOT NULL,
    election_id  INT       NOT NULL,
    vote_time    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_one_vote UNIQUE (voter_id, election_id),   -- no double-voting

    CONSTRAINT fk_vote_voter
        FOREIGN KEY (voter_id) REFERENCES Voters(voter_id)
        ON DELETE RESTRICT,   -- [B1] never cascade-delete votes

    -- Ensures (candidate, election) pair exists in Candidate_Contests
    CONSTRAINT fk_vote_contest
        FOREIGN KEY (candidate_id, election_id)
        REFERENCES Candidate_Contests(candidate_id, election_id)
        ON DELETE RESTRICT    -- [B1] hard block; use status flags to cancel elections
);

-- ================================================================
-- SECTION 6 : AUDIT LOG  (tamper-evident)
-- ================================================================

CREATE TABLE Audit_Log (
    log_id     INT          PRIMARY KEY AUTO_INCREMENT,
    event_type VARCHAR(60)  NOT NULL,
    actor_id   INT,                      -- NULL only for pure system events
    target_id  INT          NOT NULL,    -- always an election_id or voter_id
    details    TEXT,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    -- UPDATE and DELETE blocked by triggers below [B6]
);

-- ================================================================
-- SECTION 7 : INDEXES
-- ================================================================

CREATE INDEX idx_voter_const        ON Voters(constituency_id);
CREATE INDEX idx_voter_active       ON Voters(is_active);
CREATE INDEX idx_contest_elec_const ON Candidate_Contests(election_id, constituency_id);
CREATE INDEX idx_votes_candidate    ON Votes(candidate_id);
CREATE INDEX idx_votes_election     ON Votes(election_id);
CREATE INDEX idx_audit_event        ON Audit_Log(event_type, created_at);
CREATE INDEX idx_audit_actor        ON Audit_Log(actor_id);        -- [F9]
CREATE INDEX idx_elec_status        ON Elections(status);           -- [F10]

-- ================================================================
-- SECTION 8 : VIEWS
-- ================================================================

-- Live vote tally per candidate per constituency
CREATE VIEW vw_live_tally AS
SELECT
    e.election_id,
    e.election_name,
    e.status          AS election_status,
    c.constituency_id,
    c.constituency_name,
    cd.candidate_id,
    cd.name           AS candidate_name,
    p.party_name,
    COUNT(v.vote_id)  AS total_votes
FROM Candidate_Contests cc
JOIN Elections      e  ON cc.election_id     = e.election_id
JOIN Constituencies c  ON cc.constituency_id = c.constituency_id
JOIN Candidates     cd ON cc.candidate_id    = cd.candidate_id
JOIN Parties        p  ON cd.party_id        = p.party_id
LEFT JOIN Votes     v  ON v.candidate_id     = cc.candidate_id
                      AND v.election_id       = cc.election_id
GROUP BY
    e.election_id, e.election_name, e.status,
    c.constituency_id, c.constituency_name,
    cd.candidate_id, cd.name,
    p.party_name;

-- Voter turnout summary per constituency per election
CREATE VIEW vw_turnout AS
SELECT
    e.election_id,
    e.election_name,
    c.constituency_id,
    c.constituency_name,
    COUNT(DISTINCT vr.voter_id)   AS registered_voters,
    COUNT(DISTINCT v.voter_id)    AS votes_cast,
    ROUND(
        COUNT(DISTINCT v.voter_id) * 100.0
        / NULLIF(COUNT(DISTINCT vr.voter_id), 0), 2
    )                             AS turnout_pct
FROM Election_Constituencies ec
JOIN Elections      e  ON ec.election_id     = e.election_id
JOIN Constituencies c  ON ec.constituency_id = c.constituency_id
JOIN Voters         vr ON vr.constituency_id = c.constituency_id
                      AND vr.is_active        = TRUE
LEFT JOIN Votes     v  ON v.voter_id          = vr.voter_id
                      AND v.election_id        = e.election_id
GROUP BY
    e.election_id, e.election_name,
    c.constituency_id, c.constituency_name;

-- Voters who have NOT yet voted in any active election [F3]
CREATE VIEW vw_pending_voters AS
SELECT
    e.election_id,
    e.election_name,
    vr.voter_id,
    vr.name          AS voter_name,
    c.constituency_name
FROM Elections      e
JOIN Election_Constituencies ec ON ec.election_id     = e.election_id
JOIN Constituencies c           ON ec.constituency_id = c.constituency_id
JOIN Voters         vr          ON vr.constituency_id = c.constituency_id
                               AND vr.is_active        = TRUE
LEFT JOIN Votes     v           ON v.voter_id          = vr.voter_id
                               AND v.election_id        = e.election_id
WHERE v.vote_id IS NULL
  AND e.status = 'Active';

-- Seats won per party per election [F4]
CREATE VIEW vw_party_performance AS
SELECT
    e.election_id,
    e.election_name,
    p.party_id,
    p.party_name,
    COUNT(*)          AS seats_won
FROM (
    SELECT
        cc.constituency_id,
        cc.candidate_id,
        cc.election_id,
        RANK() OVER (
            PARTITION BY cc.constituency_id, cc.election_id
            ORDER BY COUNT(v.vote_id) DESC
        ) AS rnk
    FROM Candidate_Contests cc
    LEFT JOIN Votes v ON v.candidate_id = cc.candidate_id
                     AND v.election_id  = cc.election_id
    GROUP BY cc.constituency_id, cc.candidate_id, cc.election_id
) ranked
JOIN Candidates  cd ON ranked.candidate_id = cd.candidate_id
JOIN Parties      p ON cd.party_id         = p.party_id
JOIN Elections    e ON ranked.election_id  = e.election_id
WHERE ranked.rnk = 1
GROUP BY e.election_id, e.election_name, p.party_id, p.party_name
ORDER BY e.election_id, seats_won DESC;

-- ================================================================
-- SECTION 9 : TRIGGERS
-- ================================================================

DELIMITER $$

-- ── Admin integrity ─────────────────────────────────────────────

CREATE TRIGGER trg_admin_email_insert
BEFORE INSERT ON Admins
FOR EACH ROW
BEGIN
    IF NEW.email NOT LIKE '%@admin.com' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Admin email must be an @admin.com domain';
    END IF;
END$$

-- ── Voter integrity ─────────────────────────────────────────────

-- [T1] Voter DOB must be in the past — BEFORE INSERT
-- [B3] Cannot use CHECK(CURDATE()) — MySQL evaluates it at DDL time
CREATE TRIGGER trg_voter_dob_insert
BEFORE INSERT ON Voters
FOR EACH ROW
BEGIN
    IF NEW.date_of_birth >= CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'date_of_birth must be in the past';
    END IF;
END$$

-- [T1b] Same DOB check on UPDATE
CREATE TRIGGER trg_voter_dob_update
BEFORE UPDATE ON Voters
FOR EACH ROW
BEGIN
    IF NEW.date_of_birth >= CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'date_of_birth must be in the past';
    END IF;
END$$

-- [T2] Lock voter constituency once they have cast a vote [B8]
CREATE TRIGGER trg_voter_const_lock
BEFORE UPDATE ON Voters
FOR EACH ROW
BEGIN
    DECLARE vote_cnt INT DEFAULT 0;

    IF NEW.constituency_id != OLD.constituency_id THEN
        SELECT COUNT(*) INTO vote_cnt
        FROM Votes
        WHERE voter_id = OLD.voter_id;

        IF vote_cnt > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot change constituency of a voter who has already voted';
        END IF;
    END IF;
END$$

-- ── Candidate integrity ─────────────────────────────────────────

-- [T3] Candidate minimum age ≥ 25 on INSERT [B10]
CREATE TRIGGER trg_cand_age_insert
BEFORE INSERT ON Candidates
FOR EACH ROW
BEGIN
    IF TIMESTAMPDIFF(YEAR, NEW.date_of_birth, CURDATE()) < 25 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Candidate must be at least 25 years old';
    END IF;
END$$

-- [T3b] Same minimum age on UPDATE [B10]
CREATE TRIGGER trg_cand_age_update
BEFORE UPDATE ON Candidates
FOR EACH ROW
BEGIN
    IF TIMESTAMPDIFF(YEAR, NEW.date_of_birth, CURDATE()) < 25 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Candidate must be at least 25 years old';
    END IF;
END$$

-- ── Election_Constituencies integrity ───────────────────────────

-- [T4] Constituency must belong to the same state as the election [B7]
CREATE TRIGGER trg_ec_state_match
BEFORE INSERT ON Election_Constituencies
FOR EACH ROW
BEGIN
    DECLARE elec_state  INT;
    DECLARE const_state INT;

    SELECT state_id INTO elec_state
    FROM Elections WHERE election_id = NEW.election_id;

    SELECT state_id INTO const_state
    FROM Constituencies WHERE constituency_id = NEW.constituency_id;

    IF elec_state != const_state THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Constituency state does not match election state';
    END IF;
END$$

-- ── Candidate_Contests integrity ────────────────────────────────

-- [T5] Constituency must be linked to the election
CREATE TRIGGER trg_valid_const
BEFORE INSERT ON Candidate_Contests
FOR EACH ROW
BEGIN
    DECLARE cnt INT DEFAULT 0;

    SELECT COUNT(*) INTO cnt
    FROM Election_Constituencies
    WHERE election_id      = NEW.election_id
      AND constituency_id  = NEW.constituency_id;

    IF cnt = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Constituency is not part of this election';
    END IF;
END$$

-- [T6] REMOVED — redundant with T4 (trg_ec_state_match) + T5 (trg_valid_const).
-- If a constituency is verified as part of the election (T5), its state already
-- matches the election's state because T4 enforced that at EC-insert time.

-- ── Vote integrity ───────────────────────────────────────────────

-- [T7–T11] CONSOLIDATED: single BEFORE INSERT trigger on Votes
-- Guarantees deterministic validation order (was 5 separate triggers
-- with undefined MySQL execution order).
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
    DECLARE v_start    DATETIME;
    DECLARE v_end      DATETIME;
    DECLARE v_status   VARCHAR(20);

    -- 1. Election must be Active and within the voting window
    SELECT start_date, end_date, status
    INTO   v_start, v_end, v_status
    FROM   Elections
    WHERE  election_id = NEW.election_id;

    IF v_status != 'Active' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Election is not currently active';
    END IF;

    IF NOW() NOT BETWEEN v_start AND v_end THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Vote submitted outside the allowed voting window';
    END IF;

    -- 2. Voter must be active and at least 18
    SELECT date_of_birth, is_active
    INTO   v_dob, v_active
    FROM   Voters
    WHERE  voter_id = NEW.voter_id;

    IF TIMESTAMPDIFF(YEAR, v_dob, CURDATE()) < 18 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter is under 18 years of age';
    END IF;

    IF v_active = FALSE THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter account is inactive or suspended';
    END IF;

    -- 3. Voter state must match election state [B7]
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
    WHERE candidate_id = NEW.candidate_id
      AND election_id  = NEW.election_id;

    IF v_const != c_const THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter constituency does not match candidate constituency';
    END IF;
END$$

-- [T12] Write to audit log after every successful vote (AFTER INSERT)
CREATE TRIGGER trg_audit_vote
AFTER INSERT ON Votes
FOR EACH ROW
BEGIN
    INSERT INTO Audit_Log (event_type, actor_id, target_id, details)
    VALUES (
        'VOTE_CAST',
        NEW.voter_id,
        NEW.election_id,
        CONCAT('candidate_id=', NEW.candidate_id,
               ' | constituency via Candidate_Contests')
    );
END$$

-- ── Audit Log tamper protection [B6] ─────────────────────────────

-- [T13] Block UPDATE on Audit_Log
CREATE TRIGGER trg_audit_no_update
BEFORE UPDATE ON Audit_Log
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit log records cannot be modified';
END$$

-- [T14] Block DELETE on Audit_Log
CREATE TRIGGER trg_audit_no_delete
BEFORE DELETE ON Audit_Log
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Audit log records cannot be deleted';
END$$

DELIMITER ;

-- ================================================================
-- SECTION 10 : STORED PROCEDURES
-- ================================================================

DELIMITER $$

-- [P1] Create an election (transactional + audited) [B5]
CREATE PROCEDURE create_election(
    IN p_name  VARCHAR(150),
    IN p_type  VARCHAR(20),
    IN p_start DATETIME,
    IN p_end   DATETIME,
    IN p_state INT
)
BEGIN
    DECLARE new_id INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_end <= p_start THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'end_date must be after start_date';
    END IF;

    IF p_start <= NOW() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'start_date must be in the future';
    END IF;

    START TRANSACTION;

    INSERT INTO Elections (election_name, election_type, start_date, end_date, state_id, status)
    VALUES (p_name, p_type, p_start, p_end, p_state, 'Upcoming');

    SET new_id = LAST_INSERT_ID();

    INSERT INTO Audit_Log (event_type, target_id, details)
    VALUES ('ELECTION_CREATED', new_id, p_name);

    COMMIT;
END$$

-- [P2] Cast a vote — atomic with clean error propagation
CREATE PROCEDURE cast_vote(
    IN p_voter     INT,
    IN p_candidate INT,
    IN p_election  INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;  -- preserves original SQLSTATE and MESSAGE_TEXT
    END;

    START TRANSACTION;

    INSERT INTO Votes (voter_id, candidate_id, election_id)
    VALUES (p_voter, p_candidate, p_election);

    COMMIT;
END$$

-- [P3] Get winner(s) for a constituency — tie-safe (rewritten with CTE)
CREATE PROCEDURE get_winner(
    IN p_const_id    INT,
    IN p_election_id INT
)
BEGIN
    WITH vote_counts AS (
        SELECT
            cd.candidate_id,
            cd.name          AS candidate_name,
            p.party_name,
            COUNT(v.vote_id) AS votes_received,
            RANK() OVER (ORDER BY COUNT(v.vote_id) DESC) AS rnk
        FROM Candidate_Contests cc
        JOIN Candidates cd ON cc.candidate_id = cd.candidate_id
        JOIN Parties    p  ON cd.party_id     = p.party_id
        LEFT JOIN Votes v  ON v.candidate_id  = cc.candidate_id
                          AND v.election_id   = cc.election_id
        WHERE cc.constituency_id = p_const_id
          AND cc.election_id     = p_election_id
        GROUP BY cd.candidate_id, cd.name, p.party_name
    )
    SELECT candidate_id, candidate_name, party_name, votes_received
    FROM vote_counts
    WHERE rnk = 1;
END$$

-- [P4] Full election results using window function
CREATE PROCEDURE get_election_results(
    IN p_election_id INT
)
BEGIN
    SELECT
        c.constituency_name,
        cd.name          AS winner,
        p.party_name,
        t.total_votes
    FROM (
        SELECT
            cc.constituency_id,
            cc.candidate_id,
            COUNT(v.vote_id) AS total_votes,
            RANK() OVER (
                PARTITION BY cc.constituency_id
                ORDER BY COUNT(v.vote_id) DESC
            ) AS rnk
        FROM Candidate_Contests cc
        LEFT JOIN Votes v ON v.candidate_id = cc.candidate_id
                         AND v.election_id  = cc.election_id
        WHERE cc.election_id = p_election_id
        GROUP BY cc.constituency_id, cc.candidate_id
    ) t
    JOIN Constituencies c  ON t.constituency_id = c.constituency_id
    JOIN Candidates    cd  ON t.candidate_id    = cd.candidate_id
    JOIN Parties        p  ON cd.party_id       = p.party_id
    WHERE t.rnk = 1
    ORDER BY c.constituency_name;
END$$

-- [P5] Register a voter — transactional [B5]
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
    VALUES ('VOTER_REGISTERED', new_id, new_id,
            CONCAT('email=', IFNULL(p_email,'NULL')));

    COMMIT;
END$$

-- [P6] Activate an election: Upcoming → Active [F5]
CREATE PROCEDURE activate_election(IN p_election_id INT)
BEGIN
    DECLARE cur_status VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT status INTO cur_status
    FROM Elections WHERE election_id = p_election_id;

    IF cur_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Election not found';
    END IF;

    IF cur_status != 'Upcoming' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only Upcoming elections can be activated';
    END IF;

    START TRANSACTION;

    UPDATE Elections
    SET status = 'Active'
    WHERE election_id = p_election_id;

    INSERT INTO Audit_Log (event_type, target_id, details)
    VALUES ('ELECTION_ACTIVATED', p_election_id, NULL);

    COMMIT;
END$$

-- [P7] Close an election: Active → Completed [F5]
CREATE PROCEDURE close_election(IN p_election_id INT)
BEGIN
    DECLARE cur_status VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT status INTO cur_status
    FROM Elections WHERE election_id = p_election_id;

    IF cur_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Election not found';
    END IF;

    IF cur_status != 'Active' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only Active elections can be closed';
    END IF;

    START TRANSACTION;

    UPDATE Elections
    SET status = 'Completed'
    WHERE election_id = p_election_id;

    INSERT INTO Audit_Log (event_type, target_id, details)
    VALUES ('ELECTION_CLOSED', p_election_id, NULL);

    COMMIT;
END$$

-- [P8] Cancel an election: Upcoming or Active → Cancelled [F8]
CREATE PROCEDURE cancel_election(
    IN p_election_id INT,
    IN p_reason      VARCHAR(255)
)
BEGIN
    DECLARE cur_status VARCHAR(20);
    DECLARE vote_cnt   INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT status INTO cur_status
    FROM Elections WHERE election_id = p_election_id;

    IF cur_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Election not found';
    END IF;

    IF cur_status NOT IN ('Upcoming', 'Active') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Only Upcoming or Active elections can be cancelled';
    END IF;

    -- Warn if votes already exist (they are preserved, not deleted)
    SELECT COUNT(*) INTO vote_cnt
    FROM Votes WHERE election_id = p_election_id;

    START TRANSACTION;

    UPDATE Elections
    SET status = 'Cancelled'
    WHERE election_id = p_election_id;

    INSERT INTO Audit_Log (event_type, target_id, details)
    VALUES (
        'ELECTION_CANCELLED',
        p_election_id,
        CONCAT('reason=', IFNULL(p_reason, 'unspecified'),
               ' | votes_preserved=', vote_cnt)
    );

    COMMIT;
END$$

-- [P9] Soft-delete / suspend a voter [F7]
CREATE PROCEDURE deactivate_voter(
    IN p_voter_id INT,
    IN p_reason   VARCHAR(255)
)
BEGIN
    DECLARE voter_exists INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SELECT COUNT(*) INTO voter_exists
    FROM Voters WHERE voter_id = p_voter_id;

    IF voter_exists = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Voter not found';
    END IF;

    START TRANSACTION;

    UPDATE Voters
    SET is_active = FALSE
    WHERE voter_id = p_voter_id;

    INSERT INTO Audit_Log (event_type, actor_id, target_id, details)
    VALUES (
        'VOTER_DEACTIVATED',
        p_voter_id,
        p_voter_id,
        CONCAT('reason=', IFNULL(p_reason, 'unspecified'))
    );

    COMMIT;
END$$

DELIMITER ;

-- ================================================================
-- SECTION 11 : FUNCTIONS
-- ================================================================

DELIMITER $$

-- Check if a voter is eligible to vote
-- [B2] NOT DETERMINISTIC + READS SQL DATA (reads live table data)
CREATE FUNCTION is_eligible(v_id INT)
RETURNS BOOLEAN
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_dob    DATE;
    DECLARE v_active BOOLEAN;

    SELECT date_of_birth, is_active
    INTO   v_dob, v_active
    FROM   Voters
    WHERE  voter_id = v_id;

    IF v_dob IS NULL THEN
        RETURN FALSE;   -- voter not found
    END IF;

    RETURN (
        v_active = TRUE
        AND TIMESTAMPDIFF(YEAR, v_dob, CURDATE()) >= 18
    );
END$$

-- Check if a voter has already voted in an election [B2]
CREATE FUNCTION has_voted(v_id INT, e_id INT)
RETURNS BOOLEAN
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE cnt INT DEFAULT 0;

    SELECT COUNT(*) INTO cnt
    FROM Votes
    WHERE voter_id    = v_id
      AND election_id = e_id;

    RETURN cnt > 0;
END$$

-- Return the current status string for an election [B2]
CREATE FUNCTION election_status(e_id INT)
RETURNS VARCHAR(20)
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_status VARCHAR(20);

    SELECT status INTO v_status
    FROM Elections
    WHERE election_id = e_id;

    RETURN IFNULL(v_status, 'Not Found');
END$$

-- Total votes cast in an election [F6]
CREATE FUNCTION total_votes_cast(e_id INT)
RETURNS INT
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE cnt INT DEFAULT 0;

    SELECT COUNT(*) INTO cnt
    FROM Votes
    WHERE election_id = e_id;

    RETURN cnt;
END$$

DELIMITER ;

-- ================================================================
-- SECTION 12 : SAMPLE DATA
-- ================================================================

-- Admins (password: admin123 hashed via some method, but for this demo we'll just store plaintext or a placeholder hash and check it)
-- Note: In a real app this would be a bcrypt hash. For the demo: admin123
INSERT INTO Admins (name, email, password_hash, role)
VALUES ('Super Admin', 'super@admin.com', 'admin123', 'System Admin');

-- States
INSERT INTO States (state_name)
VALUES ('Punjab'), ('Maharashtra'), ('Karnataka');

-- Constituencies (Lok Sabha Constituencies for realistic data)
INSERT INTO Constituencies (constituency_name, state_id) VALUES
    -- Punjab (State ID: 1) - 13 Constituencies
    ('Gurdaspur', 1), ('Amritsar', 1), ('Khadoor Sahib', 1), ('Jalandhar', 1),
    ('Hoshiarpur', 1), ('Anandpur Sahib', 1), ('Ludhiana', 1), ('Fatehgarh Sahib', 1),
    ('Faridkot', 1), ('Firozpur', 1), ('Bathinda', 1), ('Sangrur', 1), ('Patiala', 1),

    -- Maharashtra (State ID: 2) - 48 Constituencies
    ('Nandurbar', 2), ('Dhule', 2), ('Jalgaon', 2), ('Raver', 2), ('Buldhana', 2),
    ('Akola', 2), ('Amravati', 2), ('Wardha', 2), ('Ramtek', 2), ('Nagpur', 2),
    ('Bhandara-Gondiya', 2), ('Gadchiroli-Chimur', 2), ('Chandrapur', 2), ('Yavatmal-Washim', 2),
    ('Hingoli', 2), ('Nanded', 2), ('Parbhani', 2), ('Jalna', 2), ('Aurangabad', 2),
    ('Dindori', 2), ('Nashik', 2), ('Palghar', 2), ('Bhiwandi', 2), ('Kalyan', 2),
    ('Thane', 2), ('Mumbai North', 2), ('Mumbai North West', 2), ('Mumbai North East', 2),
    ('Mumbai North Central', 2), ('Mumbai South Central', 2), ('Mumbai South', 2), ('Raigad', 2),
    ('Maval', 2), ('Pune', 2), ('Baramati', 2), ('Shirur', 2), ('Ahmednagar', 2),
    ('Shirdi', 2), ('Beed', 2), ('Osmanabad', 2), ('Latur', 2), ('Solapur', 2),
    ('Madha', 2), ('Sangli', 2), ('Satara', 2), ('Ratnagiri-Sindhudurg', 2), ('Kolhapur', 2),
    ('Hatkanangle', 2),

    -- Karnataka (State ID: 3) - 28 Constituencies
    ('Chikkodi', 3), ('Belagavi', 3), ('Bagalkot', 3), ('Bijapur', 3), ('Gulbarga', 3),
    ('Raichur', 3), ('Bidar', 3), ('Koppal', 3), ('Bellary', 3), ('Haveri', 3),
    ('Dharwad', 3), ('Uttara Kannada', 3), ('Davanagere', 3), ('Shimoga', 3),
    ('Udupi Chikmagalur', 3), ('Hassan', 3), ('Dakshina Kannada', 3), ('Chitradurga', 3),
    ('Tumkur', 3), ('Mandya', 3), ('Mysore', 3), ('Chamarajanagar', 3), ('Bangalore Rural', 3),
    ('Bangalore North', 3), ('Bangalore Central', 3), ('Bangalore South', 3), ('Chikkballapur', 3),
    ('Kolar', 3);

-- Parties
INSERT INTO Parties (party_name, symbol, founded_on) VALUES
    ('Progressive Party',   'Lotus', '1952-01-15'),
    ('Democratic Alliance', 'Hand',  '1969-06-01'),
    ('Independent',         'Star',  NULL);

-- Candidates (all born ≥ 25 years ago)
INSERT INTO Candidates (name, party_id, date_of_birth) VALUES
    ('Rajiv Sharma', 1, '1975-04-10'),
    ('Priya Kaur',   2, '1980-07-22'),
    ('Anil Mehta',   1, '1968-01-15'),
    ('Sunita Rao',   2, '1972-09-30');

-- Elections (use explicit election_id so FK references below are predictable)
INSERT INTO Elections
    (election_id, election_name, election_type, start_date, end_date, state_id, status)
VALUES
    (1, 'Punjab Assembly Election 2025', 'State',
     '2025-11-01 08:00:00', '2025-11-01 18:00:00', 1, 'Completed');

-- Constituency → election mapping (both constituencies are in Punjab = state 1)
INSERT INTO Election_Constituencies (election_id, constituency_id)
VALUES (1, 1), (1, 2);

-- Candidate contests
INSERT INTO Candidate_Contests (candidate_id, constituency_id, election_id) VALUES
    (1, 1, 1),
    (2, 1, 1),
    (3, 2, 1),
    (4, 2, 1);

-- Voters
INSERT INTO Voters (name, date_of_birth, gender, email, constituency_id) VALUES
    ('Harpreet Singh', '1990-03-14', 'Male',   'h.singh@example.com', 1),
    ('Gurleen Kaur',   '1985-08-25', 'Female', 'g.kaur@example.com',  1),
    ('Mandeep Brar',   '2008-01-01', 'Male',   'm.brar@example.com',  1),  -- underage (trigger test)
    ('Arjun Patel',    '1993-11-11', 'Male',   'a.patel@example.com', 2);

-- ── ADDITIONAL SEED DATA ────────────────────────────────────────

-- 1. Admin for election management (Must have @admin.com email)
INSERT INTO Admins (name, email, password_hash, role) VALUES
('Election Controller', 'controller@admin.com', 'securepass123', 'Election Manager');

-- 2. Two new election headings (Upcoming status)
INSERT INTO Elections (election_name, election_type, start_date, end_date, state_id, status) VALUES
('Maharashtra Assembly Election 2026', 'State', '2026-10-15 08:00:00', '2026-10-15 18:00:00', 2, 'Upcoming'),
('Karnataka General Election 2026', 'General', '2026-11-20 08:00:00', '2026-11-20 18:00:00', 3, 'Upcoming');

-- Mapping constituencies to the new elections
-- Picking 'Pune' (ID 47) for Maharashtra and 'Bangalore South' (ID 87) for Karnataka
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
(5, 47, 2), (6, 47, 2), (7, 47, 2), -- Pune
(8, 87, 3), (9, 87, 3), (10, 87, 3); -- Bangalore South

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


-- ================================================================
-- SECTION 13 : SANITY / REGRESSION TESTS
-- (Safe SELECT checks run immediately; destructive tests are
--  commented out — uncomment during demo/grading.)
-- ================================================================

-- Basic schema check
SHOW TABLES;

-- View previews
SELECT * FROM vw_live_tally     LIMIT 10;
SELECT * FROM vw_turnout        LIMIT 10;
SELECT * FROM vw_pending_voters LIMIT 10;
SELECT * FROM vw_party_performance LIMIT 10;

-- Function tests
SELECT is_eligible(1)        AS voter1_eligible;    -- 1 (adult, active)
SELECT is_eligible(3)        AS voter3_eligible;    -- 1 (adult by DOB, but trigger blocks underage vote)
SELECT has_voted(1, 1)       AS voter1_voted;       -- 0 (no votes inserted yet)
SELECT election_status(1)    AS elec1_status;       -- 'Completed'
SELECT total_votes_cast(1)   AS total_votes;        -- 0

-- ── Trigger regression tests (each SHOULD raise an error) ──────
-- Uncomment one at a time during demo:

-- 1. Underage voter trying to vote
-- INSERT INTO Votes (voter_id, candidate_id, election_id) VALUES (3, 1, 1);

-- 2. Inactive voter trying to vote
-- UPDATE Voters SET is_active = FALSE WHERE voter_id = 1;
-- INSERT INTO Votes (voter_id, candidate_id, election_id) VALUES (1, 1, 1);

-- 3. Audit log tamper attempts
-- UPDATE Audit_Log SET details = 'hacked' WHERE log_id = 1;
-- DELETE FROM Audit_Log WHERE log_id = 1;

-- 4. Cross-state constituency in a Punjab election (Maharashtra const)
-- INSERT INTO Election_Constituencies (election_id, constituency_id) VALUES (1, 3);

-- 5. Too-young candidate
-- INSERT INTO Candidates (name, party_id, date_of_birth) VALUES ('Young Cand', 1, '2005-01-01');

-- 6. Change constituency of a voter who has voted
-- INSERT INTO Votes (voter_id, candidate_id, election_id) VALUES (1, 1, 1); -- cast first
-- UPDATE Voters SET constituency_id = 2 WHERE voter_id = 1;                 -- then try to move

-- 7. Cancel a completed election (should fail)
-- CALL cancel_election(1, 'test');

-- 8. Deactivate non-existent voter
-- CALL deactivate_voter(999, 'test');
