ALTER TABLE channels ADD COLUMN scoring_rules_json TEXT NOT NULL DEFAULT '{"schemaVersion":1,"preset":"arcade","team":{"challengeWinPoints":100,"sessionWinBonus":0,"cleanSweep":{"enabled":false,"multiplierPercent":150,"label":"Clean Sweep"}},"challenger":{"selectedPoints":100,"defeatedStreamerPoints":100},"voting":{"shortlistSize":10,"winnersCount":5,"votesPerViewer":3,"durationSeconds":600},"streaks":{"trackChallengeWins":true,"trackSessionWins":true,"trackCleanSweeps":true,"showOnOverlay":true}}';

ALTER TABLE sessions ADD COLUMN phase TEXT NOT NULL DEFAULT 'collecting';
ALTER TABLE sessions ADD COLUMN scoring_rules_json TEXT NOT NULL DEFAULT '{"schemaVersion":1,"preset":"classic","team":{"challengeWinPoints":1,"sessionWinBonus":0,"cleanSweep":{"enabled":false,"multiplierPercent":150,"label":"Clean Sweep"}},"challenger":{"selectedPoints":1,"defeatedStreamerPoints":1},"voting":{"shortlistSize":10,"winnersCount":5,"votesPerViewer":3,"durationSeconds":600},"streaks":{"trackChallengeWins":true,"trackSessionWins":true,"trackCleanSweeps":true,"showOnOverlay":true}}';
ALTER TABLE sessions ADD COLUMN selected_challenge_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN winner TEXT CHECK (winner IN ('streamer', 'chat'));
ALTER TABLE sessions ADD COLUMN sweep_winner TEXT CHECK (sweep_winner IN ('streamer', 'chat'));
ALTER TABLE sessions ADD COLUMN sweep_label TEXT;
ALTER TABLE sessions ADD COLUMN completed_at TEXT;

ALTER TABLE ballots ADD COLUMN winners_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ballots ADD COLUMN votes_per_viewer INTEGER NOT NULL DEFAULT 1;

ALTER TABLE votes RENAME TO legacy_votes;
DROP INDEX IF EXISTS votes_ballot_challenge_idx;
CREATE TABLE votes (
  ballot_id TEXT NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ballot_id, voter_id, challenge_id)
);
INSERT INTO votes (ballot_id, voter_id, challenge_id, created_at)
SELECT ballot_id, voter_id, challenge_id, created_at FROM legacy_votes;
DROP TABLE legacy_votes;
CREATE INDEX votes_ballot_challenge_idx ON votes(ballot_id, challenge_id);
