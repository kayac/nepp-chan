export const redirectTo = (path: string) => {
  window.location.href = path;
};

export const getCurrentSearchParams = () =>
  new URLSearchParams(window.location.search);
