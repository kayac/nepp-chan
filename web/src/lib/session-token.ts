const SESSION_TOKEN_KEY = "nepp_chan_session_token";

export const getSessionToken = () => {
  return localStorage.getItem(SESSION_TOKEN_KEY);
};

export const setSessionToken = (token: string) => {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
};

export const removeSessionToken = () => {
  localStorage.removeItem(SESSION_TOKEN_KEY);
};
