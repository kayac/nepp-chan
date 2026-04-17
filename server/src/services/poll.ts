import { type Poll, pollRepository } from "~/repository/poll-repository";
import { sendPoll } from "~/services/poll-delivery";

// --- 投票作成 ---

type CreateInput = {
  title: string;
  choices: string[];
  followUpPrompt?: string;
  scheduledAt?: string;
  sendNow?: boolean;
  createdBy: string;
};

export const createPoll = async (
  env: CloudflareBindings,
  input: CreateInput,
) => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = input.scheduledAt ? "scheduled" : "draft";

  await pollRepository.create(env.DB, {
    id,
    title: input.title,
    choices: JSON.stringify(input.choices),
    followUpPrompt: input.followUpPrompt?.trim() ? input.followUpPrompt : null,
    status,
    scheduledAt: input.scheduledAt ?? null,
    createdBy: input.createdBy,
    createdAt: now,
  });

  if (input.sendNow) {
    const result = await sendPoll(env, id);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  return getPoll(env.DB, id);
};

// --- 投票更新 ---

type UpdateInput = {
  title?: string;
  choices?: string[];
  followUpPrompt?: string | null;
};

export const updatePoll = async (
  db: D1Database,
  id: string,
  input: UpdateInput,
) => {
  const updateData: Parameters<typeof pollRepository.update>[2] = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.choices !== undefined)
    updateData.choices = JSON.stringify(input.choices);
  if (input.followUpPrompt !== undefined) {
    updateData.followUpPrompt =
      input.followUpPrompt === null || input.followUpPrompt.trim() === ""
        ? null
        : input.followUpPrompt;
  }

  if (Object.keys(updateData).length > 0) {
    await pollRepository.update(db, id, updateData);
  }

  return getPoll(db, id);
};

// --- 投票取得 ---

export const getPoll = async (db: D1Database, id: string) => {
  const poll = await pollRepository.findById(db, id);
  if (!poll) return null;
  return formatPollResponse(poll);
};

export const formatPollResponse = (p: Poll) => ({
  id: p.id,
  title: p.title,
  choices: JSON.parse(p.choices) as string[],
  followUpPrompt: p.followUpPrompt,
  status: p.status,
  createdBy: p.createdBy,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  scheduledAt: p.scheduledAt,
  sentAt: p.sentAt,
  closedAt: p.closedAt,
});
