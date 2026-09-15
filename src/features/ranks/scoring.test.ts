import { SCORING, workoutPoints } from './scoring';

describe('workoutPoints', () => {
  it('soma presença, duração e intensidade como a regra v1', () => {
    expect(workoutPoints(50, 'moderado')).toEqual({ presence: 10, duration: 5, intensity: 2 });
    expect(workoutPoints(9, 'leve')).toEqual({ presence: 10, duration: 0, intensity: 0 });
    expect(workoutPoints(300, 'intenso')).toEqual({ presence: 10, duration: SCORING.maxDurationPoints, intensity: 4 });
  });

  it('recusa duração inválida', () => {
    expect(() => workoutPoints(-1, 'leve')).toThrow(RangeError);
    expect(() => workoutPoints(1.5, 'leve')).toThrow(RangeError);
  });
});
