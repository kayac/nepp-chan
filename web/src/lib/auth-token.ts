const TOKEN_KEY = "auth_token";
const SESSION_TOKEN_KEY = "nepp_chan_session_token";

export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getSessionToken = () => {
  return localStorage.getItem(SESSION_TOKEN_KEY);
};

export const setSessionToken = (token: string) => {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
};

export const removeSessionToken = () => {
  localStorage.removeItem(SESSION_TOKEN_KEY);
};

/** Authorization: Bearer に送るトークンを取得。admin token を優先。 */
export const getBearerToken = () => {
  return getAuthToken() ?? getSessionToken();
};
