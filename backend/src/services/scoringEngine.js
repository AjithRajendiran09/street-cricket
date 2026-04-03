class ScoringEngine {
    /**
     * Process a ball event and return the updated state.
     * 
     * @param {Object} state - The current state of the innings/match.
     * @param {Object} event - The ball event details.
     * @returns {Object} - The resulting changes.
     */
    static processBall(state, event) {
        const { runs, wickets, balls_bowled, extras, innings, target } = state;
        const { total_overs } = state; // Max overs
        const { runs_scored = 0, is_wide = false, is_no_ball = false, is_wicket = false } = event;

        let newRuns = runs;
        let newWickets = wickets;
        let newBallsBowled = balls_bowled;
        let newExtras = extras;
        
        const maxWicketsAllowed = state.max_wickets || 3;

        // Validation: cannot score if match/innings completed or wickets >= available players
        if (state.is_completed || wickets >= maxWicketsAllowed || balls_bowled >= total_overs * 6) {
            throw new Error("Cannot add ball. Innings already completed.");
        }

        // Penalty for wide or no-ball is usually 1 run in street cricket.
        // Assuming user rule: wide = 1 extra run, no-ball = 1 extra run.
        let ballExtras = 0;
        let isLegalBall = true;

        if (is_wide) {
            ballExtras += 1;
            isLegalBall = false;
        } else if (is_no_ball) {
            ballExtras += 1;
            isLegalBall = false;
        }

        const totalRunsForBall = runs_scored + ballExtras;

        newRuns += totalRunsForBall;
        newExtras += ballExtras;

        if (is_wicket && !is_no_ball && !is_wide) { // Usually can't cleanly get a normal wicket on a wide/no-ball (run outs exist though). For street cricket, let's allow run-outs, but assume user means general wicket.
            newWickets += 1;
        } else if (is_wicket && (is_no_ball || is_wide)) {
            // Assume it can be a run out, which is a wicket.
            newWickets += 1;
        }

        if (isLegalBall) {
            newBallsBowled += 1;
        }

        // Dynamic Termination -> ends instantly precisely when the exact number of physical team players are exhausted natively!
        if (newWickets >= maxWicketsAllowed || newBallsBowled >= total_overs * 6) {
            isCompleted = true;
        }

        // Target reached for 2nd innings
        if (innings === 2 && target !== undefined && newRuns >= target) {
            isCompleted = true; // Match ends
        }

        return {
            updatedScore: {
                runs: newRuns,
                wickets: newWickets,
                balls_bowled: newBallsBowled,
                extras: newExtras,
                is_completed: isCompleted,
                innings
            },
            ballRecord: {
                ...event,
                runs_scored,
                extras: ballExtras,
                is_wide,
                is_no_ball,
                is_wicket
            }
        };
    }

    /**
     * Process an undo ball event.
     * 
     * @param {Object} state - Current score state
     * @param {Object} lastBallRecord - The exact record of the last ball
     * @returns {Object} 
     */
    static undoBall(state, lastBallRecord) {
        if (!lastBallRecord) throw new Error("No ball to undo.");

        let { runs, wickets, balls_bowled, extras, innings } = state;
        
        runs -= (lastBallRecord.runs_scored + lastBallRecord.extras);
        extras -= lastBallRecord.extras;

        if (lastBallRecord.is_wicket) {
            wickets -= 1;
        }

        const isLegalBall = !lastBallRecord.is_wide && !lastBallRecord.is_no_ball;
        if (isLegalBall) {
            balls_bowled -= 1;
        }

        return {
            updatedScore: {
                runs: Math.max(0, runs),
                wickets: Math.max(0, wickets),
                balls_bowled: Math.max(0, balls_bowled),
                extras: Math.max(0, extras),
                is_completed: false, // Reverting definitely opens up the innings
                innings
            }
        };
    }
}

module.exports = ScoringEngine;
