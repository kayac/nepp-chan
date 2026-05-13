import { useCallback, useState } from "react";
import {
  type ChoiceFormState,
  collectValidChoices,
  isPollFormValid,
} from "~/app/dashboard/components/poll/helpers";
import { useCreatePoll, useUpdatePoll } from "~/app/dashboard/hooks/usePolls";
import { confirmDialog } from "~/lib/dialog";
import type { CreatePollRequest, Poll } from "~/types";

const emptyChoice = (): ChoiceFormState => ({
  id: crypto.randomUUID(),
  value: "",
});

type Options = {
  poll?: Poll;
  onClose: () => void;
};

export const usePollForm = ({ poll, onClose }: Options) => {
  const [title, setTitle] = useState(poll?.title ?? "");
  const [choices, setChoices] = useState<ChoiceFormState[]>(() => {
    if (poll?.choices?.length) {
      return poll.choices.map((c) => ({ id: crypto.randomUUID(), value: c }));
    }
    return [emptyChoice(), emptyChoice()];
  });
  const [followUpPrompt, setFollowUpPrompt] = useState(
    poll?.followUpPrompt ?? "",
  );

  const createMutation = useCreatePoll();
  const updateMutation = useUpdatePoll();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isEditMode = !!poll;

  const validChoices = collectValidChoices(choices);
  const isValid = isPollFormValid(title, validChoices);

  const addChoice = useCallback(
    () => setChoices((prev) => [...prev, emptyChoice()]),
    [],
  );

  const removeChoice = useCallback(
    (id: string) => setChoices((prev) => prev.filter((c) => c.id !== id)),
    [],
  );

  const updateChoice = useCallback(
    (id: string, value: string) =>
      setChoices((prev) =>
        prev.map((c) => (c.id === id ? { ...c, value } : c)),
      ),
    [],
  );

  const handleSubmit = useCallback(
    async (sendNow: boolean) => {
      if (sendNow && !isEditMode) {
        if (!confirmDialog("この投票をLINE全フォロワーに即時配信しますか？"))
          return;
      }
      const payload: CreatePollRequest = {
        title: title.trim(),
        choices: validChoices,
        followUpPrompt: followUpPrompt.trim() || undefined,
        ...(!isEditMode && sendNow && { sendNow: true }),
      };
      if (isEditMode && poll) {
        await updateMutation.mutateAsync({ id: poll.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    },
    [
      title,
      validChoices,
      followUpPrompt,
      isEditMode,
      poll,
      createMutation,
      updateMutation,
      onClose,
    ],
  );

  return {
    title,
    setTitle,
    choices,
    addChoice,
    removeChoice,
    updateChoice,
    followUpPrompt,
    setFollowUpPrompt,
    isValid,
    isSubmitting,
    isEditMode,
    handleSubmit,
  };
};
