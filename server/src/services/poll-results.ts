import { pollRepository } from "~/repository/poll-repository";

export const getPollResults = async (db: D1Database, pollId: string) => {
  const poll = await pollRepository.findById(db, pollId);
  if (!poll) return null;

  const submissions = await pollRepository.findSubmissionsByPoll(db, pollId);
  const choices = JSON.parse(poll.choices) as string[];

  const counts: Record<string, number> = {};
  for (const c of choices) counts[c] = 0;
  for (const s of submissions) {
    if (s.selectedChoice in counts) {
      counts[s.selectedChoice] = (counts[s.selectedChoice] ?? 0) + 1;
    }
  }

  const total = submissions.length;
  const choiceResults = choices.map((choice) => ({
    choice,
    count: counts[choice] ?? 0,
    percentage:
      total > 0 ? Math.round(((counts[choice] ?? 0) / total) * 100) : 0,
  }));

  return {
    pollId,
    title: poll.title,
    totalSubmissions: total,
    choiceResults,
  };
};
