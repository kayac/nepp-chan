# 物理モデル音声合成でねっぷちゃんを喋らせる試作

声道を物理シミュレーションして声を作るブラウザ向けシンセサイザー [CHIMERA](https://github.com/jamesondh/chimera-vocal-synth) を改造し、ねっぷちゃんが日本語で喋る・歌うところまで試したもの。**保留中の試作**で、本体（server / web / lp / widget）には組み込んでいない。

このディレクトリには、上流への差分だけを置いている。上流のソース・辞書・フォントは含まない。

| ファイル | 内容 |
|---|---|
| `nepp-look.patch` | 上流コミット `eed4a5ff2695ad151df2210d012b2a4ab584f099` に対する差分（29 ファイル） |
| `LICENSE-CHIMERA.txt` | 上流のライセンス（MIT）。差分には上流のコード片が含まれるため同梱している |

## できること

- 日本語の発話: モーラを等拍に並べ、ピッチアクセントで高さを付ける。英語向けの強い帯気を弱める後処理つき
- 漢字まじりの文: ブラウザ内の形態素解析（OpenJTalk の WebAssembly 版）で読みとアクセントを付ける
- チャット: ローカルで起動した API に質問を送り、返答を文ごとに区切って届いた順に喋る
- 見た目: 紙色の地と本リポジトリのデザイントークン。2D・3D の頭をねっぷちゃんに寄せている
- 歌: かなの歌詞で歌える。「この道」を登録済み

## 動かし方

Rust（`wasm32-unknown-unknown` ターゲット）と Bun が必要。

```bash
git clone https://github.com/jamesondh/chimera-vocal-synth.git
cd chimera-vocal-synth
git checkout eed4a5ff2695ad151df2210d012b2a4ab584f099
git apply /path/to/nepp-look.patch

# 依存パッケージ。インストール時スクリプトは走らせない
bun install --ignore-scripts

# 形態素解析の辞書（約 100MB）を取得する
mkdir -p public/ojt
(cd public/ojt && bun ../../node_modules/@keanu-thakalath/openjtalkjs/scripts/fetch-assets.mjs)

bun run dev   # http://127.0.0.1:5317
bun test
```

チャットを使うときは、本リポジトリで `pnpm server:dev` を起動しておく（`http://localhost:8787` に Vite の proxy 越しでつなぐ）。チャットは LLM を呼ぶので費用が発生する。

## 既知の制約

- 3D は線しか描けないため、塗りや毛並みが出せず、2D ほどキャラクターに似ない
- アクセントは辞書どおりで、地名や複合語は不自然な箇所がある
- 母音の無声化（「です」の「す」など）は扱っていない
- 口・舌・気道は上流のエンジンが出す人間の形のまま。音と直結するので変えていない
- female ボディ、口を大きく開けたときの見た目、Speak / Sing 以外の画面は未確認

## ライセンス

- **上流（CHIMERA）**: MIT。`LICENSE-CHIMERA.txt` を参照
- **この差分で追加した部分**: 本リポジトリのライセンス（AGPLv3）に従う
- **形態素解析のパッケージ**（`@keanu-thakalath/openjtalkjs` 0.1.0）: BSD-3-Clause。依存として参照するだけで、本リポジトリには含めていない。このパッケージは内部に含む Open JTalk などの第三者表記をまだ整えていないため、wasm を配信する形で使う場合は、利用側で表記を補う必要がある
- **辞書と音声データ**: 上の手順で各配布元から取得する。本リポジトリには含めていない。辞書（NAIST Japanese Dictionary）は修正 BSD 系。同時に取得される音声データは解析器の初期化にだけ使い、ライセンスは未確認
- **「この道」**: 詞 北原白秋（1942 年没）、曲 山田耕筰（1965 年没）。保護期間は満了している。旋律と歌詞の割り付けは、日本語版 Wikipedia「この道」に掲載の譜を参照した
- **ねっぷちゃんの造形**: `identity/` のビジュアルアセット（CC BY 4.0）を参照して描いている
