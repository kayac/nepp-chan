import { makeAssistantToolUI } from "@assistant-ui/react";
import {
  CloudIcon,
  CloudRainIcon,
  CloudSnowIcon,
  SunIcon,
  WindIcon,
} from "lucide-react";
import type { FC } from "react";

type WeatherArgs = {
  location: string;
};

type WeatherResult = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust: number;
  conditions: string;
  location: string;
};

const getWeatherIcon = (conditions: string) => {
  const lower = conditions.toLowerCase();
  if (lower.includes("rain") || lower.includes("drizzle")) {
    return <CloudRainIcon className="size-12 text-blue-500" />;
  }
  if (lower.includes("snow")) {
    return <CloudSnowIcon className="size-12 text-blue-300" />;
  }
  if (lower.includes("cloud") || lower.includes("overcast")) {
    return <CloudIcon className="size-12 text-gray-500" />;
  }
  if (lower.includes("clear") || lower.includes("sunny")) {
    return <SunIcon className="size-12 text-yellow-500" />;
  }
  return <CloudIcon className="size-12 text-gray-400" />;
};

const conditionsJa: Record<string, string> = {
  "Clear sky": "快晴",
  "Mainly clear": "ほぼ晴れ",
  "Partly cloudy": "晴れ時々曇り",
  Overcast: "曇り",
  Foggy: "霧",
  "Depositing rime fog": "霧氷",
  "Light drizzle": "小雨",
  "Moderate drizzle": "霧雨",
  "Dense drizzle": "強い霧雨",
  "Light freezing drizzle": "弱い凍雨",
  "Dense freezing drizzle": "強い凍雨",
  "Slight rain": "小雨",
  "Moderate rain": "雨",
  "Heavy rain": "大雨",
  "Light freezing rain": "弱い凍雨",
  "Heavy freezing rain": "強い凍雨",
  "Slight snow fall": "小雪",
  "Moderate snow fall": "雪",
  "Heavy snow fall": "大雪",
  "Snow grains": "雪あられ",
  "Slight rain showers": "にわか雨",
  "Moderate rain showers": "にわか雨",
  "Violent rain showers": "激しいにわか雨",
  "Slight snow showers": "にわか雪",
  "Heavy snow showers": "激しいにわか雪",
  Thunderstorm: "雷雨",
  "Thunderstorm with slight hail": "雷雨（小さな雹）",
  "Thunderstorm with heavy hail": "雷雨（大きな雹）",
};

const LoadingState: FC<{ location: string }> = ({ location }) => (
  <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-blue-50 to-sky-50 p-4">
    <div className="size-12 animate-pulse rounded-full bg-blue-200" />
    <div className="flex-1">
      <div className="h-4 w-24 animate-pulse rounded bg-blue-200" />
      <div className="mt-2 h-3 w-32 animate-pulse rounded bg-blue-100" />
    </div>
    <span className="text-sm text-(--color-text-muted)">
      {location} の天気を取得中...
    </span>
  </div>
);

const WeatherCard: FC<{ result: WeatherResult }> = ({ result }) => (
  <div className="rounded-xl bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 p-4 shadow-sm">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        {getWeatherIcon(result.conditions)}
        <div>
          <div className="text-3xl font-bold text-gray-800">
            {Math.round(result.temperature)}°C
          </div>
          <div className="text-sm text-gray-600">
            {conditionsJa[result.conditions] || result.conditions}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-gray-700">{result.location}</div>
        <div className="text-xs text-gray-500">現在の天気</div>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-blue-100 pt-4">
      <div className="text-center">
        <div className="text-xs text-gray-500">体感温度</div>
        <div className="font-semibold text-gray-700">
          {Math.round(result.feelsLike)}°C
        </div>
      </div>
      <div className="text-center">
        <div className="text-xs text-gray-500">湿度</div>
        <div className="font-semibold text-gray-700">{result.humidity}%</div>
      </div>
      <div className="flex items-center justify-center gap-1 text-center">
        <WindIcon className="size-3 text-gray-400" />
        <div>
          <div className="text-xs text-gray-500">風速</div>
          <div className="font-semibold text-gray-700">
            {result.windSpeed}m/s
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const WeatherToolUI = makeAssistantToolUI<WeatherArgs, WeatherResult>({
  toolName: "get-weather",
  render: ({ args, result, status }) => {
    if (status.type === "running") {
      return (
        <div className="my-4">
          <LoadingState location={args.location} />
        </div>
      );
    }

    if (status.type === "incomplete") {
      return (
        <div className="my-4 rounded-xl bg-red-50 p-4 text-red-600">
          天気情報の取得に失敗しました
        </div>
      );
    }

    if (!result) return null;

    return (
      <div className="my-4">
        <WeatherCard result={result} />
      </div>
    );
  },
});
