import { useCallback, useEffect, useState } from "react";
import {
  clearTuning,
  loadStoredTuning,
  saveTuning,
  type TuningValues,
} from "./tuning";

export const useTuning = (defaults?: TuningValues) => {
  const [values, setValues] = useState<TuningValues | null>(null);

  useEffect(() => {
    if (defaults) setValues(loadStoredTuning(defaults));
  }, [defaults]);

  const update = useCallback((patch: TuningValues) => {
    setValues((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveTuning(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    if (!defaults) return;
    clearTuning();
    setValues({ ...defaults });
  }, [defaults]);

  return { values, update, reset };
};
