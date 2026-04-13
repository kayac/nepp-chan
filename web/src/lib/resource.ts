const RESOURCE_ID_KEY = "nepp_chan_resource_id";

export const getResourceId = (): string | null =>
  localStorage.getItem(RESOURCE_ID_KEY);

export const setResourceId = (id: string) =>
  localStorage.setItem(RESOURCE_ID_KEY, id);
