const ScoringEngine = require('../src/services/scoringEngine');

describe('ScoringEngine', () => {
    let baseState;

    beforeEach(() => {
        baseState = {
            runs: 10,
            wickets: 0,
            balls_bowled: 5,
            extras: 1,
            innings: 1,
            total_overs: 2, // 12 balls total
            is_completed: false
        };
    });

    test('should process normal legal ball with 0 runs', () => {
        const event = { runs_scored: 0 };
        const result = ScoringEngine.processBall(baseState, event);

        expect(result.updatedScore.runs).toBe(10); // 10 + 0
        expect(result.updatedScore.balls_bowled).toBe(6); // 5 + 1
        expect(result.updatedScore.is_completed).toBe(false); // Only 6 balls (1 over), wait, it's 2 overs total, so false.
    });

    test('should process normal legal ball with 6 runs', () => {
        const event = { runs_scored: 6 };
        const result = ScoringEngine.processBall(baseState, event);

        expect(result.updatedScore.runs).toBe(16); // 10 + 6
        expect(result.updatedScore.balls_bowled).toBe(6);
        expect(result.updatedScore.is_completed).toBe(false);
    });

    test('should process wide + runs', () => {
        const event = { runs_scored: 2, is_wide: true }; // e.g. w+2 bye
        const result = ScoringEngine.processBall(baseState, event);

        expect(result.updatedScore.runs).toBe(13); // 10 + 2 (runs) + 1 (wide penalty)
        expect(result.updatedScore.extras).toBe(2); // 1 + 1 (wide penalty)
        expect(result.updatedScore.balls_bowled).toBe(5); // illegal ball, balls not incremented
        expect(result.updatedScore.is_completed).toBe(false);
    });

    test('should process no-ball + runs', () => {
        const event = { runs_scored: 4, is_no_ball: true }; // e.g. nb+4 off bat
        const result = ScoringEngine.processBall(baseState, event);

        expect(result.updatedScore.runs).toBe(15); // 10 + 4 (runs) + 1 (nb penalty)
        expect(result.updatedScore.extras).toBe(2); // 1 + 1 penalty
        expect(result.updatedScore.balls_bowled).toBe(5); // illegal, balls not incremented
        expect(result.updatedScore.is_completed).toBe(false);
    });

    test('should process wicket on legal ball', () => {
        const event = { runs_scored: 0, is_wicket: true, wicket_type: 'bowled' };
        const result = ScoringEngine.processBall(baseState, event);

        expect(result.updatedScore.runs).toBe(10);
        expect(result.updatedScore.wickets).toBe(1);
        expect(result.updatedScore.balls_bowled).toBe(6);
        expect(result.updatedScore.is_completed).toBe(false);
    });

    test('should complete innings when 2 wickets fall', () => {
        baseState.wickets = 1; // 1 down already
        const event = { runs_scored: 0, is_wicket: true };
        const result = ScoringEngine.processBall(baseState, event);

        expect(result.updatedScore.wickets).toBe(2);
        expect(result.updatedScore.balls_bowled).toBe(6);
        expect(result.updatedScore.is_completed).toBe(true); // Innings ends on 2nd wicket
    });

    test('should complete innings when total overs reached', () => {
        baseState.balls_bowled = 11; // 1 ball remaining
        const event = { runs_scored: 1 };
        const result = ScoringEngine.processBall(baseState, event);

        expect(result.updatedScore.balls_bowled).toBe(12); // Now 12 balls (2 overs * 6)
        expect(result.updatedScore.is_completed).toBe(true);
    });

    test('should undo a legal ball with runs', () => {
        const state = { runs: 15, wickets: 0, balls_bowled: 5, extras: 1, innings: 1 };
        const lastBallRecord = { runs_scored: 4, is_wide: false, is_no_ball: false, is_wicket: false, extras: 0 };
        const result = ScoringEngine.undoBall(state, lastBallRecord);

        expect(result.updatedScore.runs).toBe(11); // 15 - 4
        expect(result.updatedScore.extras).toBe(1);
        expect(result.updatedScore.balls_bowled).toBe(4); // 5 - 1
    });

    test('should undo a wide + runs', () => {
        const state = { runs: 13, wickets: 0, balls_bowled: 5, extras: 2, innings: 1 };
        const lastBallRecord = { runs_scored: 2, is_wide: true, is_no_ball: false, is_wicket: false, extras: 1 }; // wide gives 1 extra
        const result = ScoringEngine.undoBall(state, lastBallRecord);

        expect(result.updatedScore.runs).toBe(10); // 13 - (2 runs_scored + 1 extra)
        expect(result.updatedScore.extras).toBe(1); // 2 - 1
        expect(result.updatedScore.balls_bowled).toBe(5); // Since illegal ball undo won't decrement balls_bowled
    });

    test('should undo a wicket', () => {
        const state = { runs: 10, wickets: 1, balls_bowled: 6, extras: 1, innings: 1 };
        const lastBallRecord = { runs_scored: 0, is_wide: false, is_no_ball: false, is_wicket: true, extras: 0 };
        const result = ScoringEngine.undoBall(state, lastBallRecord);

        expect(result.updatedScore.wickets).toBe(0); // 1 - 1
        expect(result.updatedScore.balls_bowled).toBe(5); // 6 - 1
    });
});
