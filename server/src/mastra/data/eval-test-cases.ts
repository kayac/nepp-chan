/** テストケースのカテゴリ（3分類） */
export type TestCategory =
  | "education" // 高校関連
  | "garbage" // ゴミ関連
  | "village"; // 村全体

/** テストケースのタイプ */
export type TestType = "positive" | "negative";

/** V2 用の簡易型（input/groundTruth のみ） */
export interface TestCase {
  input: string;
  groundTruth: string;
}

/** V3 用の完全型（スコアリング・自動合否判定付き） */
export interface TestCaseV3 {
  /** テストケース ID（重複不可） */
  id: string;
  /** カテゴリ */
  category: TestCategory;
  /** テストタイプ（positive: 正しく回答すべき / negative: 「わからない」と答えるべき） */
  type: TestType;
  /** 質問テキスト */
  input: string;
  /** 期待される回答（正解テキスト） */
  groundTruth: string;
  /** 必須キーワード（positive=AND条件, negative=OR条件） */
  requiredKeywords: string[];
  /** 合格閾値（similarity スコアがこの値以上で pass） */
  threshold: number;
}

/** マスターテストケース（22個） */
export const evalTestCases: TestCaseV3[] = [
  // ─── education: 高校関連（12個） ─────────────────────────

  {
    id: "ed-01",
    category: "education",
    type: "positive",
    input: "おと高の寮費はいくらですか？",
    groundTruth:
      "月額30,000円。食費（3食）や光熱費等を含む。学級費やPTA会費等の諸納金は別途前期に納入",
    requiredKeywords: ["3万", "月額", "食費"],
    threshold: 0.5,
  },
  {
    id: "ed-02",
    category: "education",
    type: "negative",
    input: "おと高の入試に実技試験はありますか？",
    groundTruth:
      "実技試験はありません。推薦入試では面接のみ、一般入試は5教科の筆記試験のみ",
    requiredKeywords: ["実技試験", "ありません"],
    threshold: 0.5,
  },
  {
    id: "ed-03",
    category: "education",
    type: "positive",
    input: "不登校で欠席日数が多いのですが、受験で不利になりますか？",
    groundTruth:
      "推薦入試および一般入試において、中学校での欠席日数が多いという理由で、生徒よりも不利になることはありません",
    requiredKeywords: ["不利", "ありません"],
    threshold: 0.5,
  },
  {
    id: "ed-04",
    category: "education",
    type: "positive",
    input: "おと高にはどんな部活動がありますか？",
    groundTruth:
      "7つの部活動：美術部、工芸部、バドミントン部、アルペンスキー部、軽音学部、家政部、文芸部。美術部・工芸部は高校総合文化祭（全国大会）の常連",
    requiredKeywords: ["美術部", "工芸部", "7"],
    threshold: 0.5,
  },
  {
    id: "ed-05",
    category: "education",
    type: "positive",
    input: "道外（本州）から推薦入試を受けられますか？",
    groundTruth:
      "はい。平成31年度入学生の入試から道外からの推薦入学者選抜の出願が可能",
    requiredKeywords: ["道外", "可能"],
    threshold: 0.5,
  },
  {
    id: "ed-06",
    category: "education",
    type: "positive",
    input: "寮は全寮制ですか？帰省はできますか？",
    groundTruth:
      "全寮制ではない。通学可能であれば通える。年4回の休業日（夏・冬・春・GW）は寮閉鎖で全員帰省。週末は帰省願を届けて帰省も可能",
    requiredKeywords: ["全寮制", "年4回", "帰省"],
    threshold: 0.5,
  },
  {
    id: "ed-07",
    category: "education",
    type: "positive",
    input: "美術コースで揃える道具はどのくらい必要ですか？",
    groundTruth:
      "素描・油彩道具が必要で最低限でおおむね1万円程度。工芸コースは基本的に個別に必要なものはない",
    requiredKeywords: ["1万円", "道具"],
    threshold: 0.5,
  },
  {
    id: "ed-08",
    category: "education",
    type: "positive",
    input: "寮にWi-Fiはありますか？",
    groundTruth:
      "学校と寮の両方にWi-Fi環境が整備されている。寮内では生活リズムの保持と学業に集中できる環境を保つため、利用時間に一定の制限あり",
    requiredKeywords: ["Wi-Fi", "制限"],
    threshold: 0.5,
  },
  {
    id: "ed-09",
    category: "education",
    type: "positive",
    input: "おと高はどこにありますか？駅から近いですか？",
    groundTruth:
      "北海道の北部（道北地方）の音威子府村にある。JR音威子府駅から歩いて10分ほどの距離。札幌駅から音威子府駅までは特急で3時間10分程度",
    requiredKeywords: ["音威子府駅", "10分", "歩いて"],
    threshold: 0.5,
  },
  {
    id: "ed-10",
    category: "education",
    type: "positive",
    input: "ホームシックになったらどうしますか？",
    groundTruth:
      "多くの生徒が最初はホームシックになることもあるが、次第に寮での生活に慣れ、仲間と支え合いながら楽しく過ごせるようになっている。寮職員や先輩が生活面で支えとなりサポート。保護者との連携も大切にしている",
    requiredKeywords: ["ホームシック", "慣れ", "サポート"],
    threshold: 0.5,
  },
  {
    id: "ed-11",
    category: "education",
    type: "negative",
    input: "推薦入試の面接ではどんな質問が聞かれますか？",
    groundTruth: "面接の質問内容を公表することはできません",
    requiredKeywords: ["公表", "できません"],
    threshold: 0.5,
  },
  {
    id: "ed-12",
    category: "education",
    type: "negative",
    input: "推薦入試の合格基準を教えてください",
    groundTruth:
      "調査書、自己推薦書、面接内容などをもとに総合的に判断するが、細かい評価方法や審査基準は非公開",
    requiredKeywords: ["非公開", "総合的"],
    threshold: 0.5,
  },

  // ─── garbage: ゴミ関連（4個） ────────────────────────────

  {
    id: "gb-01",
    category: "garbage",
    type: "positive",
    input: "ペットボトルの出し方のルールを教えてください",
    groundTruth:
      "令和7年1月10日より市販の白色半透明袋での収集に変更。旧指定袋（オレンジ色の半透明袋）も引き続き使用可。ペットボトルとプラスチック製容器包装は必ず袋を分けて出す。混ぜて捨てた場合は収集されない",
    requiredKeywords: ["白色", "半透明", "分けて"],
    threshold: 0.5,
  },
  {
    id: "gb-02",
    category: "garbage",
    type: "positive",
    input: "ゴミの分別がわからない場合、どこに問い合わせればいいですか？",
    groundTruth:
      "住民課住民生活室 生活環境係（電話:01656-5-3312、内線35）。「家庭ごみの分け方、出し方」PDFもダウンロード可能",
    requiredKeywords: ["住民課", "01656-5-3312"],
    threshold: 0.5,
  },
  {
    id: "gb-03",
    category: "garbage",
    type: "positive",
    input: "ゴミカレンダーはどこで確認できますか？",
    groundTruth:
      "令和7年度のゴミカレンダーが家庭用配布版（A3横両面6ヶ月タイプ）と事業所配布版（A3縦両面1年タイプ）のPDFで公開されている。問い合わせ:住民課住民生活室 生活環境係 01656-5-3312",
    requiredKeywords: ["カレンダー", "PDF"],
    threshold: 0.5,
  },
  {
    id: "gb-04",
    category: "garbage",
    type: "negative",
    input: "今日は何のゴミの日ですか？",
    groundTruth:
      "ゴミカレンダーはPDFで公開されているが、具体的な日別の収集スケジュールはナレッジにない。最新のゴミカレンダーPDFを確認してほしい旨を回答すべき",
    requiredKeywords: ["カレンダー", "確認"],
    threshold: 0.3,
  },

  // ─── village: 村全体（6個） ──────────────────────────────

  {
    id: "vl-01",
    category: "village",
    type: "positive",
    input: "村長さんについて教えてください",
    groundTruth:
      "令和5年5月1日付で音威子府村長に就任した遠藤貴幸。産業の振興や大自然の保全と活用を図り、全世代が支えあい、子どもには夢を、大人には希望を、高齢者には安心を、村全体に笑顔があふれる村づくりを目指している",
    requiredKeywords: ["遠藤貴幸", "令和5年"],
    threshold: 0.5,
  },
  {
    id: "vl-02",
    category: "village",
    type: "positive",
    input: "村に泊まれるところはありますか？",
    groundTruth:
      "天塩川温泉（5,200円〜）、青少年宿泊研修施設トムテ（素泊まり4,400円、1泊2食付6,600円）、ブルーベリーハウス（3,630円〜、素泊まりのみ）、ゲストハウスイケレ、天塩川リバーサイドキャンプ場（無料）などがある",
    requiredKeywords: ["天塩川温泉", "トムテ"],
    threshold: 0.5,
  },
  {
    id: "vl-03",
    category: "village",
    type: "positive",
    input: "お昼ご飯を食べるならどこがおすすめですか？",
    groundTruth:
      "お食事処咲来（自家製そば、11:00-18:30）、天塩川温泉レストラン（源泉ラーメン・源泉そば、11:00-14:00/17:00-19:30）、満腹イケレ（丼もの・そば、11:30-15:00）がある。音威子府はそばが特産",
    requiredKeywords: ["咲来", "天塩川温泉", "そば"],
    threshold: 0.5,
  },
  {
    id: "vl-04",
    category: "village",
    type: "positive",
    input: "東京から村に行くにはどうすればいいですか？",
    groundTruth:
      "羽田空港→旭川空港（1時間35分）→空港連絡バスで旭川駅→特急宗谷で音威子府駅（旭川発13:35→音威子府着15:15）。トータル約8時間。都市間バスもあり（札幌〜音威子府3時間50分）",
    requiredKeywords: ["旭川空港", "特急", "音威子府駅"],
    threshold: 0.5,
  },
  {
    id: "vl-05",
    category: "village",
    type: "positive",
    input: "子供が生まれました。村の支援制度はありますか？",
    groundTruth:
      "乳幼児等医療費助成制度があり、対象は高校生まで（18歳に達する日以後の最初の3月31日まで）に拡大。村内医療機関（診療所・歯科医院・すずらん薬局）の受診が対象。問い合わせ:住民課保健福祉室 保健推進係 01656-9-3050",
    requiredKeywords: ["医療費助成", "高校生"],
    threshold: 0.5,
  },
  {
    id: "vl-06",
    category: "village",
    type: "positive",
    input: "冬にスキーできる場所はありますか？",
    groundTruth:
      "音威富士スキー場。2025-2026シーズンは12月19日〜3月下旬。月曜定休。リフト1日券:大人2,500円/小人2,000円。パウダースノーで初心者から上級者まで楽しめる。JR音威子府駅から徒歩約15分",
    requiredKeywords: ["音威富士", "スキー場", "12月"],
    threshold: 0.5,
  },
];
