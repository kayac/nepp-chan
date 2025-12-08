import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { LibSQLVector } from '@mastra/libsql';
import { google } from '@ai-sdk/google';
import { connectionUrl } from './db';

/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
export const storage = new LibSQLStore({
    id: 'nep-chan-storage',
    url: connectionUrl,
});

export const memory = new Memory({
    storage,
    vector: new LibSQLVector({
        id: 'nep-chan-vector',
        connectionUrl: connectionUrl,
    }),
    embedder: google.textEmbeddingModel('text-embedding-004'),
    options: {
        lastMessages: 10,
        semanticRecall: {
            topK: 3,
            messageRange: 2,
        },
        workingMemory: {
            enabled: false,
            template: `
# ユーザープロフィール

## 属性
- 年齢: [推測値含む]
- 居住地／出身地: [村内/村外/他地域]
- 関係性: [観光客/村人/学生/職員]
- 関心テーマ: [自然/アート/暮らし/人間関係]
- 感情傾向: [元気/悩み中/挑戦期]
- 行動パターン: [創作中心/旅行中/仕事中]

## 重要情報
- [重要と認識する項目をカンマ区切りで]
`,
        },
    },
});
