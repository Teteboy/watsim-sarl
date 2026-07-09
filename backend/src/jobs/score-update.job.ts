import { recomputeScore } from '../services/credit-scoring.service';

export async function processScoreUpdateJob(data: { userId: string }): Promise<void> {
  await recomputeScore(data.userId);
}
