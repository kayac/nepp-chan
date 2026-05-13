export const getSentimentStyle = (sentiment: string | null) => {
  if (!sentiment) return "";
  switch (sentiment) {
    case "positive":
      return "bg-green-50 text-green-700";
    case "negative":
      return "bg-red-50 text-red-700";
    case "request":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-stone-100 text-stone-600";
  }
};
