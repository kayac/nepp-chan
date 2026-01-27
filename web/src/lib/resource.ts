const RESOURCE_ID_KEY = "nepp_chan_resource_id";

export const getResourceId = (): string => {
  let id = localStorage.getItem(RESOURCE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(RESOURCE_ID_KEY, id);
  }
  return id;
};
