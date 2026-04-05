/** テストケースのカテゴリ（6分類） */
export type TestCategory =
  | "education" // 高校関連
  | "garbage" // ゴミ関連
  | "facility" // 公共施設関連
  | "village" // 村全体
  | "admin" // 行政・PDF
  | "kouhou"; // 広報

/** テストケースのタイプ */
export type TestType = "positive" | "negative";

/** V2 用の簡易型（input/groundTruth のみ） */
export type TestCase = {
  input: string;
  groundTruth: string;
};

/** V3 用の完全型（スコアリング・自動合否判定付き） */
export type TestCaseV3 = {
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
  /** URL検証: 期待される正確なURL（完全一致） */
  expectedUrl?: string;
  /** URL検証: URLを含むべきでない場合 true */
  noUrlExpected?: boolean;
};

/** マスターテストケース（66個） */
export const evalTestCases: TestCaseV3[] = [
  // ─── education: 高校関連（12個） ─────────────────────────

  {
    id: "ed-01",
    category: "education",
    type: "positive",
    input: "おと高の寮費はいくらですか？",
    groundTruth:
      "月額30,000円。食費（3食）や光熱費等を含む。学級費やPTA会費等の諸納金は別途前期に納入",
    requiredKeywords: ["月額", "食費"],
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
    threshold: 0.1,
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
    requiredKeywords: [
      "美術部",
      "工芸部",
      "バドミントン部",
      "アルペンスキー部",
    ],
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
    requiredKeywords: ["全寮制", "帰省"],
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
    requiredKeywords: ["Wi-Fi", "利用時間"],
    threshold: 0.5,
  },
  {
    id: "ed-09",
    category: "education",
    type: "positive",
    input: "おと高はどこにありますか？駅から近いですか？",
    groundTruth:
      "北海道の北部（道北地方）の音威子府村にある。JR音威子府駅から歩いて10分ほどの距離。札幌駅から音威子府駅までは特急で3時間10分程度",
    requiredKeywords: ["音威子府駅", "10分"],
    threshold: 0.5,
  },
  {
    id: "ed-10",
    category: "education",
    type: "positive",
    input: "ホームシックになったらどうしますか？",
    groundTruth:
      "多くの生徒が最初はホームシックになることもあるが、次第に寮での生活に慣れ、仲間と支え合いながら楽しく過ごせるようになっている。寮職員や先輩が生活面で支えとなりサポート。保護者との連携も大切にしている",
    requiredKeywords: ["ホームシック"],
    threshold: 0.5,
  },
  {
    id: "ed-11",
    category: "education",
    type: "negative",
    input: "推薦入試の面接ではどんな質問が聞かれますか？",
    groundTruth: "面接の質問内容を公表することはできません",
    requiredKeywords: ["非公開"],
    threshold: 0.1,
  },
  {
    id: "ed-12",
    category: "education",
    type: "negative",
    input: "推薦入試の合格基準を教えてください",
    groundTruth:
      "調査書、自己推薦書、面接内容などをもとに総合的に判断するが、細かい評価方法や審査基準は非公開",
    requiredKeywords: ["非公開", "総合的"],
    threshold: 0.1,
  },

  // ─── garbage: ゴミ関連（14個） ───────────────────────────

  {
    id: "gb-01",
    category: "garbage",
    type: "positive",
    input: "ペットボトルの出し方のルールを教えてください",
    groundTruth:
      "令和7年1月10日より市販の白色半透明袋での収集に変更。旧指定袋（オレンジ色の半透明袋）も引き続き使用可。ペットボトルとプラスチック製容器包装は必ず袋を分けて出す。混ぜて捨てた場合は収集されない",
    requiredKeywords: ["白色", "半透明", "オレンジ"],
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
    type: "positive",
    input: "今日3月18日は何のゴミの日ですか？",
    groundTruth: "3月18日は水曜日なので、紙製容器包装・その他紙の収集日です",
    requiredKeywords: ["紙製容器包装", "水曜"],
    threshold: 0.5,
  },
  {
    id: "gb-05",
    category: "garbage",
    type: "positive",
    input: "生ごみは何曜日に出せますか？",
    groundTruth:
      "生ごみは火曜日と金曜日の毎週収集です。炭化ごみも同時に収集されます",
    requiredKeywords: ["火曜", "金曜"],
    threshold: 0.5,
  },
  {
    id: "gb-06",
    category: "garbage",
    type: "positive",
    input: "ペットボトルのゴミ袋は何色ですか？",
    groundTruth:
      "令和7年1月10日より市販の白色半透明袋での収集に変更。旧指定袋（オレンジ色の半透明袋）も引き続き使用可",
    requiredKeywords: ["白色", "半透明", "オレンジ"],
    threshold: 0.5,
  },
  {
    id: "gb-07",
    category: "garbage",
    type: "positive",
    input: "粗大ごみはいつ出せますか？",
    groundTruth:
      "基本は毎月第1土曜日に収集。ただし12月と1月は粗大ごみの収集なし。3月は第3・第4土曜に収集。粗大ごみは役場で処理券を購入する必要がある",
    requiredKeywords: ["第1土曜", "処理券"],
    threshold: 0.5,
  },
  {
    id: "gb-08",
    category: "garbage",
    type: "positive",
    input: "年末年始のゴミ収集はどうなりますか？",
    groundTruth: "令和8年度（2026年12月31日〜2027年1月4日）は収集休みです",
    requiredKeywords: ["12月31日", "1月4日", "収集休み"],
    threshold: 0.5,
  },
  {
    id: "gb-09",
    category: "garbage",
    type: "positive",
    input: "カン・ビンは何曜日に出せますか？",
    groundTruth:
      "カン・ビンは金曜日の隔週で収集。ペットボトルと交互に隔週で金曜日に収集される。村指定の専用ごみ袋を使用",
    requiredKeywords: ["金曜", "隔週"],
    threshold: 0.5,
  },
  {
    id: "gb-10",
    category: "garbage",
    type: "positive",
    input: "来週の月曜日3月23日は何のゴミの日ですか？",
    groundTruth: "月曜日はゴミの収集がありません。日曜・月曜は収集なしです",
    requiredKeywords: ["月曜", "収集なし"],
    threshold: 0.5,
  },
  {
    id: "gb-11",
    category: "garbage",
    type: "positive",
    input: "引っ越しで大量のゴミが出たのですが、どうすればいいですか？",
    groundTruth:
      "名寄地区広域最終処分場（TEL:01654-2-1598）へ直接搬入してください。受入時間は8:45〜16:30。または音威子府村の許可業者である旭光運輸（TEL:5-3141）へ依頼",
    requiredKeywords: ["名寄", "処分場", "01654-2-1598"],
    threshold: 0.5,
  },
  {
    id: "gb-12",
    category: "garbage",
    type: "positive",
    input: "プラスチック製の容器包装は何の袋に入れて出せばいいですか？",
    groundTruth:
      "市販の白色の半透明のごみ袋又はレジ袋に入れて出す。木曜日に毎週収集",
    requiredKeywords: ["白色", "半透明", "木曜"],
    threshold: 0.5,
  },
  {
    id: "gb-13",
    category: "garbage",
    type: "positive",
    input: "4月の粗大ごみ収集日はいつですか？",
    groundTruth:
      "令和8年度（2026年4月）の粗大ごみ収集日は4月4日（土）第1土曜日です。使用済み小型家電も同時に収集",
    requiredKeywords: ["4月4日", "第1土曜"],
    threshold: 0.5,
  },

  // ─── village: 村全体（6個） ──────────────────────────────

  {
    id: "vl-01",
    category: "village",
    type: "positive",
    input: "村長さんについて教えてください",
    groundTruth:
      "令和5年5月1日付で音威子府村長に就任した遠藤貴幸。産業の振興や大自然の保全と活用を図り、全世代が支えあい、子どもには夢を、大人には希望を、高齢者には安心を、村全体に笑顔があふれる村づくりを目指している",
    requiredKeywords: ["遠藤貴幸"],
    threshold: 0.5,
  },
  {
    id: "vl-02",
    category: "village",
    type: "positive",
    input: "村に泊まれるところはありますか？",
    groundTruth:
      "天塩川温泉（5,200円〜）、青少年宿泊研修施設トムテ（素泊まり4,400円、1泊2食付6,600円）、ブルーベリーハウス（3,630円〜、素泊まりのみ）、ゲストハウスイケレ、天塩川リバーサイドキャンプ場（無料）などがある",
    requiredKeywords: ["天塩川温泉", "トムテ", "ゲストハウスイケレ"],
    threshold: 0.5,
  },
  {
    id: "vl-03",
    category: "village",
    type: "positive",
    input: "お昼ご飯を食べるならどこがおすすめですか？",
    groundTruth:
      "お食事処咲来（自家製そば、11:00-18:30）、天塩川温泉レストラン（源泉ラーメン・源泉そば、11:00-14:00/17:00-19:30）、満腹イケレ（丼もの・そば、11:30-15:00）がある。音威子府はそばが特産",
    requiredKeywords: ["咲来", "そば"],
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
    requiredKeywords: ["医療費", "助成"],
    threshold: 0.5,
  },
  {
    id: "vl-06",
    category: "village",
    type: "positive",
    input: "冬にスキーできる場所はありますか？",
    groundTruth:
      "音威富士スキー場。2025-2026シーズンは12月19日〜3月下旬。月曜定休。リフト1日券:大人2,500円/小人2,000円。パウダースノーで初心者から上級者まで楽しめる。JR音威子府駅から徒歩約15分",
    requiredKeywords: ["音威富士スキー場"],
    threshold: 0.5,
  },

  // ─── garbage: ゴミ関連 追加（10個, gb-15〜gb-24） ─────────

  {
    id: "gb-15",
    category: "garbage",
    type: "positive",
    input: "12月のゴミ収集日を教えてください",
    groundTruth:
      "令和8年度12月（2026年）は、火曜に生ごみ・炭化ごみ、水曜に紙製容器包装、木曜にプラ容器包装、金曜に生ごみ・炭化ごみ+カン・ビンorペットボトル、土曜に一般ごみ。12月31日〜1月4日は収集休み。粗大ごみ収集なし",
    requiredKeywords: ["2026年", "12月", "粗大ごみ"],
    threshold: 0.5,
  },
  {
    id: "gb-16",
    category: "garbage",
    type: "positive",
    input: "1月のゴミの日はいつですか？",
    groundTruth:
      "令和8年度1月（2027年）は、1月1日〜4日は収集休み。1月5日（火）から収集開始。火曜に生ごみ・炭化ごみ、水曜に紙製容器包装、木曜にプラ容器包装、金曜に生ごみ・炭化ごみ、土曜に一般ごみ。粗大ごみ収集なし",
    requiredKeywords: ["1月", "収集休み"],
    threshold: 0.5,
  },
  {
    id: "gb-17",
    category: "garbage",
    type: "positive",
    input: "12月の年末はゴミ収集ありますか？",
    groundTruth:
      "12月30日（水）が最後の収集日です。12月31日〜1月4日は収集休みです",
    requiredKeywords: ["12月31日", "収集休み"],
    threshold: 0.5,
  },
  {
    id: "gb-18",
    category: "garbage",
    type: "positive",
    input: "1月の正月期間のゴミ収集はお休みですか？",
    groundTruth:
      "はい、1月1日〜4日が収集休みです。1月5日（火）から通常収集が再開します。1月は粗大ごみの収集もありません",
    requiredKeywords: ["1月", "収集休み"],
    threshold: 0.5,
  },
  {
    id: "gb-19",
    category: "garbage",
    type: "positive",
    input: "令和8年度の12月のゴミ収集日は？",
    groundTruth:
      "令和8年度の12月（2026年）は、1日（火）から30日（水）まで収集。火曜に生ごみ・炭化ごみ、水曜に紙製容器包装、木曜にプラ容器包装、金曜に生ごみ・炭化ごみ、土曜に一般ごみ。12月31日〜1月4日は収集休み。12月は粗大ごみの収集なし",
    requiredKeywords: ["令和8年度", "12月"],
    threshold: 0.5,
  },
  {
    id: "gb-20",
    category: "garbage",
    type: "positive",
    input: "令和8年度の1月のゴミ収集日は？",
    groundTruth:
      "令和8年度の1月（2027年）は、1月1日〜4日が収集休み。1月5日（火）から収集開始。火曜に生ごみ・炭化ごみ、水曜に紙製容器包装、木曜にプラ容器包装、金曜に生ごみ・炭化ごみ、土曜に一般ごみ。1月は粗大ごみの収集なし",
    requiredKeywords: ["令和8年度", "1月", "収集休み"],
    threshold: 0.5,
  },
  {
    id: "gb-21",
    category: "garbage",
    type: "positive",
    input: "ごみ袋の種類を教えてください",
    groundTruth:
      "紙製容器包装は市販の黄色半透明袋、プラ容器包装は市販の白色半透明袋またはレジ袋、ペットボトルは市販の白色半透明袋、カン・ビンはそれぞれ村指定の専用袋、生ごみ・炭化ごみ・一般ごみは村指定の専用袋、粗大ごみは役場で処理券を購入。青・黒い袋・段ボール等は回収不可",
    requiredKeywords: ["黄色", "白色", "村指定"],
    threshold: 0.5,
  },
  {
    id: "gb-22",
    category: "garbage",
    type: "positive",
    input: "ゴミの分別ルールは？",
    groundTruth:
      "火曜と金曜に生ごみ・炭化ごみ（毎週）、水曜に紙製容器包装（毎週）、木曜にプラ容器包装（毎週）、金曜にカン・ビンとペットボトル（隔週交互）、土曜に一般ごみ（毎週）。日曜・月曜は収集なし",
    requiredKeywords: ["火曜", "水曜", "木曜", "金曜"],
    threshold: 0.5,
  },
  {
    id: "gb-23",
    category: "garbage",
    type: "positive",
    input: "燃やせるゴミの袋はどれを使えばいいですか？",
    groundTruth:
      "一般ごみ（燃やせるごみ）は村指定の専用ごみ袋を使用してください。土曜日に毎週収集されます。青・黒い袋・段ボール等を使用している場合は回収されません",
    requiredKeywords: ["村指定", "専用"],
    threshold: 0.5,
  },
  {
    id: "gb-24",
    category: "garbage",
    type: "positive",
    input: "12月の粗大ごみ収集日はいつですか？",
    groundTruth:
      "12月は粗大ごみの収集がありません。粗大ごみは基本的に毎月第1土曜日に収集されますが、12月と1月は収集なしです",
    requiredKeywords: ["12月", "粗大ごみ", "ありません"],
    threshold: 0.5,
  },

  // ─── facility: 公共施設関連（4個, fc-01〜fc-04） ──────────

  {
    id: "fc-01",
    category: "facility",
    type: "positive",
    input: "公民館の第１研修室の広さはどれくらいですか？",
    groundTruth:
      "第１研修室は広さ34.75平米で、机8個とイス18個が設備されています",
    requiredKeywords: ["34.75", "机8", "イス18"],
    threshold: 0.5,
  },
  {
    id: "fc-02",
    category: "facility",
    type: "positive",
    input: "公民館の大ホールは何人くらい入れますか？",
    groundTruth:
      "2F大ホール（大会議室）は広さ396.36平米で、机46個・イス200個が設備されています。音響施設、マイク、ピアノもあります",
    requiredKeywords: ["396.36", "イス200", "音響"],
    threshold: 0.5,
  },
  {
    id: "fc-03",
    category: "facility",
    type: "positive",
    input: "公民館の調理室は利用できますか？",
    groundTruth:
      "はい、調理室があります。広さ50.14平米で、調理器具全般・冷蔵庫・ガス台が設備されています。利用料金は公民館の利用料金表をご確認ください",
    requiredKeywords: ["50.14", "調理器具", "冷蔵庫"],
    threshold: 0.5,
  },
  {
    id: "fc-04",
    category: "facility",
    type: "positive",
    input: "公民館の和室を借りたいのですが",
    groundTruth:
      "和室は2部屋あります。和室研修室（79.81平米、机14個・座布団）と和室会議室（66.22平米、机6個・イス7個・座布団）です。利用申請は教育委員会窓口または音威子府公式LINE（@otoineppu_1962）から可能です",
    requiredKeywords: ["和室研修室", "和室会議室", "79.81"],
    threshold: 0.5,
  },

  // ─── village: 村全体 追加（6個, vl-07〜vl-12） ────────────

  {
    id: "vl-07",
    category: "village",
    type: "positive",
    input: "国保税の医療分の税率を教えてください",
    groundTruth:
      "国保税の医療分は、所得割（加入者の所得に応じた額）、均等割（加入者1人あたりの額）、平等割（1世帯あたりの額）の3つで算定されます。問い合わせ先は住民課住民生活室（01656-5-3312）",
    requiredKeywords: ["所得割", "均等割", "平等割"],
    threshold: 0.5,
  },
  {
    id: "vl-08",
    category: "village",
    type: "positive",
    input: "国保税の介護分はいくらですか？",
    groundTruth:
      "介護分は40歳以上65歳未満の方が対象で、所得割（所得に応じた額）、均等割（1人あたりの額）、平等割（1世帯あたりの額）で算定されます。世帯の所得に応じて7割・5割・2割の軽減制度もあります",
    requiredKeywords: ["所得割", "均等割", "平等割"],
    threshold: 0.5,
  },
  {
    id: "vl-09",
    category: "village",
    type: "positive",
    input: "音威子府村への鉄道でのアクセス方法は？",
    groundTruth:
      "1日特急3往復。札幌駅〜音威子府駅は3時間10分、旭川駅〜音威子府駅は1時間41分、稚内駅〜音威子府駅は2時間01分。特急宗谷・サロベツが利用可能",
    requiredKeywords: ["3時間10分", "1時間41分", "サロベツ"],
    threshold: 0.5,
  },
  {
    id: "vl-10",
    category: "village",
    type: "positive",
    input: "都市間バスで音威子府に行くにはどうすればいいですか？",
    groundTruth:
      "札幌市〜音威子府村は3時間50分、旭川市〜音威子府村は2時間40分、稚内市〜音威子府村は3時間12分（オホーツク海側経由）。特急わっかない号（札幌〜音威子府、要予約）や特急えさし号（旭川〜音威子府、要予約）が利用できます",
    requiredKeywords: ["3時間50分", "2時間40分"],
    threshold: 0.5,
  },
  {
    id: "vl-11",
    category: "village",
    type: "positive",
    input: "地域バスの時刻表を教えてください",
    groundTruth:
      "地域バスは運賃無料。夏ダイヤ（5月〜10月）と冬ダイヤ（11月〜4月）があり、時刻表はPDFで公開されています。令和6年5月1日ダイヤ改正により「高齢者センター」停留所が廃止、「セイコーマート横」停留所が追加。問い合わせは経済課産業振興室（01656-5-3313）",
    requiredKeywords: ["無料", "夏ダイヤ", "冬ダイヤ"],
    threshold: 0.5,
  },
  {
    id: "vl-12",
    category: "village",
    type: "positive",
    input: "音威子府村の村名の由来は何ですか？",
    groundTruth:
      "アイヌ語で「濁りたる泥川」「漂木の堆積する川口」または「切れ曲がる川尻」の意。昭和38年に「常盤村」から「音威子府村」に改称された",
    requiredKeywords: ["アイヌ", "常盤村"],
    threshold: 0.5,
  },

  // ─── admin: PDF解析・実用的（10個, ad-01〜ad-10） ──────────

  {
    id: "ad-01",
    category: "admin",
    type: "positive",
    input: "音威子府村で宿泊できる場所はどこですか？",
    groundTruth:
      "青少年宿泊研修施設トムテ（素泊まり4,400円、1泊2食付き6,600円）、BlueberryHouse（3,630円～、素泊まりのみ）、天塩川温泉（5,200円～）、ゲストハウスイケレ、天塩川リバーサイドキャンプ場（無料）、ライダーハウス咲来、ちょっと暮らし住宅がある",
    requiredKeywords: ["トムテ", "天塩川温泉", "ゲストハウスイケレ"],
    threshold: 0.5,
  },
  {
    id: "ad-02",
    category: "admin",
    type: "positive",
    input: "音威子府村のお土産は何がありますか？",
    groundTruth:
      "新音威子府そば（三浦家製麺）、おといねっぷそば（立川農園）、咲来そば（大地の恵み食品工房）、木工クラフト（ecoおといねっぷ）、命名之地羊羹、源泉ラーメン（天塩川温泉）、ジェラートセット（グリーングラス）、おとっきーグッズなどがある",
    requiredKeywords: ["音威子府そば", "木工クラフト"],
    threshold: 0.5,
  },
  {
    id: "ad-03",
    category: "admin",
    type: "positive",
    input: "音威子府村で食事できるお店は？",
    groundTruth:
      "お食事処咲来（そばや丼もの、11:00～18:30）、居酒屋潤ちゃん（村内唯一の居酒屋、18:00～23:00）、天塩川温泉レストラン（源泉ラーメン・源泉そば）、満腹イケレ（ゲストハウスイケレ内、11:30～15:00）、Gelateria the GreenGrass（牧場直営ジェラート）がある",
    requiredKeywords: ["咲来", "潤ちゃん"],
    threshold: 0.5,
  },
  {
    id: "ad-04",
    category: "admin",
    type: "positive",
    input: "音威子府村の観光スポットを教えてください",
    groundTruth:
      "そば畑（キタワセそば、7月下旬～8月中旬）、音威子府村交通ターミナル（天北線資料室）、音威富士スキー場、エコミュージアムおさしまセンター（砂澤ビッキの作品100点以上展示、入館料300円）、北海道命名之地（松浦武四郎ゆかり）、木遊館（木工体験施設）がある",
    requiredKeywords: ["エコミュージアム", "北海道命名之地"],
    threshold: 0.5,
  },
  {
    id: "ad-05",
    category: "admin",
    type: "positive",
    input: "令和7年度の公共工事の発注予定を教えてください",
    groundTruth:
      "令和7年4月1日時点の発注見通しとして、教員住宅浴室改修工事、村有林整備事業、役場庁舎・消防庁舎LED化改修工事、防犯灯LED化改修工事、天塩川温泉女子浴室天井改修工事、橋梁点検委託業務、おといねっぷ美術工芸高等学校LED化工事、水道メーター交換工事などがある。予定価格250万円超のものを公表",
    requiredKeywords: ["令和7年", "LED化", "指名競争入札"],
    threshold: 0.5,
  },
  {
    id: "ad-06",
    category: "admin",
    type: "positive",
    input: "教員住宅の改修工事について教えてください",
    groundTruth:
      "教員住宅浴室改修工事は音威子府村字音威子府で実施予定。期間は4月上旬～5月下旬、建築工事としてユニットバス改修工事2戸を行う。入札方法は指名競争入札で、入札時期は第1四半期",
    requiredKeywords: ["ユニットバス", "2戸", "指名競争入札"],
    threshold: 0.5,
  },
  {
    id: "ad-07",
    category: "admin",
    type: "positive",
    input: "一般廃棄物の許可業者を教えてください",
    groundTruth:
      "令和7年9月26日現在の許可業者は、斎藤建設工業、久保重機工業、岩守産業、五十嵐運輸、中川建設、音威子府建設、村西運輸、旭光運輸、名寄トラックの9社。家庭系一般廃棄物を扱えるのは岩守産業、音威子府建設、旭光運輸、名寄トラック",
    requiredKeywords: ["岩守産業", "音威子府建設", "旭光運輸"],
    threshold: 0.5,
  },
  {
    id: "ad-08",
    category: "admin",
    type: "positive",
    input: "斎藤建設工業の許可情報は？",
    groundTruth:
      "斎藤建設工業株式会社（許可番号第5-8号）。住所は士別市大通西7丁目711番地24、電話0165-26-7575。主に取り扱う廃棄物は事業系一般廃棄物（伐採木枝・伐根・剪定木・刈草・すきとり物の収集運搬）。許可期限は令和8年2月20日",
    requiredKeywords: ["士別市", "事業系一般廃棄物", "令和8年"],
    threshold: 0.5,
  },
  {
    id: "ad-09",
    category: "admin",
    type: "positive",
    input: "行政報告書の給与情報を教えてください",
    groundTruth:
      "令和5年度の人件費は503,607千円（人件費率24.6%）。職員数57人、職員給与費計346,384千円、一人当たり給与費6,077千円。一般行政職の平均給料月額292,600円、平均給与月額323,561円（令和6年4月1日現在、平均年齢38.7歳）。ラスパイレス指数は98.2",
    requiredKeywords: ["503,607", "57人"],
    threshold: 0.5,
  },
  {
    id: "ad-10",
    category: "admin",
    type: "positive",
    input: "音威子府村の総合戦略の内容は？",
    groundTruth:
      "音威子府村まち・ひと・しごと創生総合戦略は、おといねっぷ美術工芸高等学校を中心に4つの基本目標を設定。(1)高校の機能強化（入学者数年40人）、(2)卒業生の雇用創出（バイオガスプラント・高齢者複合型施設）、(3)高校を軸とした人の流れ促進（Uターン・定住促進）、(4)高校生参加による村づくり。対象期間は2015～2019年度",
    requiredKeywords: ["基本目標", "美術工芸高等学校"],
    threshold: 0.5,
  },

  // ─── admin: PDF解析・大規模（10個, ad-11〜ad-20） ──────────

  {
    id: "ad-11",
    category: "admin",
    type: "positive",
    input: "音威子府村の避難場所はどこですか？",
    groundTruth:
      "指定緊急避難場所は15箇所あり、主な施設は音威子府小中学校、咲来公民館、おといねっぷ美術工芸高等学校、音威子府村山村広場、道の駅おといねっぷ駐車場、音威子府村地域交流センター、音威富士スキー場ロッジ、筬島会館、音威子府村公民館、福祉交流拠点ときわ。洪水・土砂災害・地震・大規模火事・内水氾濫に対応",
    requiredKeywords: ["音威子府小中学校", "咲来公民館", "美術工芸高等学校"],
    threshold: 0.5,
  },
  {
    id: "ad-12",
    category: "admin",
    type: "positive",
    input: "地震が起きたらどうすればいいですか？",
    groundTruth:
      "まずわが身の安全を図る。揺れがおさまったら落ち着いてすばやく火の始末をする。火が出たらまず消火。避難は徒歩で持物は最小限に。みんなが協力しあって応急救護を行う。平常時から避難場所・避難経路・家族の集合場所を確認しておくことが大切",
    requiredKeywords: ["身の安全", "火の始末", "避難"],
    threshold: 0.5,
  },
  {
    id: "ad-13",
    category: "admin",
    type: "positive",
    input: "防災マップはありますか？",
    groundTruth:
      "音威子府村地域防災マップ（2020年3月版）がある。大雨・洪水・土砂災害・暴風雪への備え、避難行動の確認、避難場所一覧表（指定緊急避難場所15箇所）、地域防災マップ（索引図・No.1～No.7）、非常持出品・備蓄品リストなどが掲載されている",
    requiredKeywords: ["防災マップ", "避難場所"],
    threshold: 0.5,
  },
  {
    id: "ad-14",
    category: "admin",
    type: "positive",
    input: "洪水時の避難経路は？",
    groundTruth:
      "村内の指定河川は天塩川で、国土交通省（旭川開発建設部）と気象庁が共同で洪水予報を発表する。警戒レベルに応じて避難行動をとる。防災マップで浸水想定区域と指定緊急避難場所を確認し、避難は徒歩で最小限の持物で行動する",
    requiredKeywords: ["天塩川", "警戒レベル", "避難場所"],
    threshold: 0.5,
  },
  {
    id: "ad-15",
    category: "admin",
    type: "positive",
    input: "音威子府村の将来人口の推計はどうなっていますか？",
    groundTruth:
      "2010年の総人口995人から、趨勢人口では2060年に240人程度まで減少する見込み。戦略人口として2040年に610人程度、2060年に500人程度の維持をめざす。おといねっぷ美術工芸高等学校の生徒約120人が人口の1割以上を占め、村の最大の強み",
    requiredKeywords: ["500人"],
    threshold: 0.5,
  },
  {
    id: "ad-16",
    category: "admin",
    type: "positive",
    input: "平成22年の人口は何人でしたか？",
    groundTruth:
      "平成22年（2010年）の人口は995人で、初めて1,000人を割り込んだ。国鉄合理化に伴う人員削減や平成元年の天北線廃止等の影響により人口減少が進んだ",
    requiredKeywords: ["995人"],
    threshold: 0.5,
  },
  {
    id: "ad-17",
    category: "admin",
    type: "positive",
    input: "簡易水道の経営戦略について教えてください",
    groundTruth:
      "音威子府村簡易水道事業経営戦略（平成30年3月策定、計画期間平成29～38年度）。昭和31年供用開始、計画給水人口1,070人に対し現在給水人口675人。一般用基本料金は1,840円（10立方メートルまで）。人口減少に伴い持続可能な事業運営が課題",
    requiredKeywords: ["簡易水道"],
    threshold: 0.5,
  },
  {
    id: "ad-18",
    category: "admin",
    type: "positive",
    input: "水道料金の将来見通しは？",
    groundTruth:
      "給水人口の減少と節水意識の高揚により料金収入は減少していく見込み。浄水場の機械・電気計装設備は整備から17年以上経過し更新が必要。料金の見直しは慎重に判断する。最終改定は平成19年4月1日",
    requiredKeywords: ["料金収入", "減少"],
    threshold: 0.5,
  },
  {
    id: "ad-19",
    category: "admin",
    type: "positive",
    input: "農業集落排水事業とは何ですか？",
    groundTruth:
      "音威子府村の農業集落排水事業は平成12年7月供用開始。音威子府地区1処理区で音威子府浄化センター1箇所を運用。一般家庭用使用料は10立方メートルまで1,650円（超過分は1立方メートルにつき180円）。汚泥は堆肥化後公共施設花壇等に利用",
    requiredKeywords: ["農業集落排水", "浄化センター"],
    threshold: 0.5,
  },
  {
    id: "ad-20",
    category: "admin",
    type: "positive",
    input: "音威子府村の河川情報を教えてください",
    groundTruth:
      "村の中央を天塩川が流れており、洪水予報の指定河川。天塩川リバーサイドキャンプ場やパークゴルフ場が河川沿いにあり、北海道命名之地は天塩川河川敷内に位置する。カヌーポートとしても利用されている",
    requiredKeywords: ["天塩川"],
    threshold: 0.5,
  },

  // ─── kouhou: 広報パターン（10個, kh-01〜kh-10） ──────────

  {
    id: "kh-01",
    category: "kouhou",
    type: "positive",
    input: "6月の専門外来の診療日はいつですか？",
    groundTruth:
      "令和5年6月の音威子府村立診療所の専門外来は、整形外科が6月2日・9日・16日・17日・23日・30日、皮膚科（予約制）が6月19日、眼科（予約制）が6月28日です",
    requiredKeywords: ["整形外科", "皮膚科", "眼科"],
    threshold: 0.5,
  },
  {
    id: "kh-02",
    category: "kouhou",
    type: "positive",
    input: "7月の整形外科の診療日は？",
    groundTruth:
      "令和5年7月の整形外科の診療日は7月7日（金）・14日（金）・15日（土）・21日（金）・28日（金）です。診療時間は金曜日が11:30〜12:30と14:00〜17:00、土曜日が9:00〜11:00です",
    requiredKeywords: ["7月", "整形外科", "金曜"],
    threshold: 0.5,
  },
  {
    id: "kh-03",
    category: "kouhou",
    type: "positive",
    input: "眼科の診療日を教えてください",
    groundTruth:
      "音威子府村立診療所の眼科は予約制で、月1回程度の診療です。例えば令和5年7月は7月26日（水）、診療時間は9:00〜11:30です",
    requiredKeywords: ["眼科", "予約制"],
    threshold: 0.5,
  },
  {
    id: "kh-04",
    category: "kouhou",
    type: "positive",
    input: "音威子府村の最新の人口は何人ですか？",
    groundTruth:
      "令和7年12月末現在の音威子府村の人口は588人（前月比-6人）で、うち男性309人、女性279人、世帯数は424戸です",
    requiredKeywords: ["588", "424"],
    threshold: 0.5,
  },
  {
    id: "kh-05",
    category: "kouhou",
    type: "positive",
    input: "令和7年3月の人口は？",
    groundTruth:
      "令和7年3月末現在の音威子府村の人口は549人（前月比-16人）で、うち男性296人、女性253人、世帯数は373戸です",
    requiredKeywords: ["549人", "373戸"],
    threshold: 0.5,
  },
  {
    id: "kh-06",
    category: "kouhou",
    type: "positive",
    input: "世帯数はどれくらいですか？",
    groundTruth:
      "令和7年12月末現在の音威子府村の世帯数は424戸です。人口は588人（男性309人、女性279人）です",
    requiredKeywords: ["424", "世帯"],
    threshold: 0.5,
  },
  {
    id: "kh-07",
    category: "kouhou",
    type: "positive",
    input: "4月のイベント予定を教えてください",
    groundTruth:
      "令和7年4〜5月のイベントとして、4月26日からエコミュージアムおさしまセンター高橋昭五郎彫刻の館がオープン（開館09:00〜16:30、月曜休館）、5月10日〜6月1日に観光列車「花たびそうや」号が運行されます。音威子府駅停車日は5月11日・18日・25日・6月1日（全て日曜・上りのみ）",
    requiredKeywords: ["エコミュージアム", "花たびそうや"],
    threshold: 0.5,
  },
  {
    id: "kh-08",
    category: "kouhou",
    type: "positive",
    input: "12月のイベントカレンダーは？",
    groundTruth:
      "令和7年12月〜1月のイベントは、12月17〜18日に村議会第4回定例会、12月25〜27日に第43回クロスカントリー音威子府大会、1月2日に二十歳を祝う会、1月26日におと高卒業制作発表があります",
    requiredKeywords: ["クロスカントリー"],
    threshold: 0.5,
  },
  {
    id: "kh-09",
    category: "kouhou",
    type: "positive",
    input: "保健福祉センターの健診情報は？",
    groundTruth:
      "令和7年度の総合健診は7月8日（火）6:00〜10:00に保健福祉センターで実施されます。対象はサーティ健診（30〜39歳）、国保特定健診（40〜75歳）、後期高齢者健診（75歳以上）で、いずれも自己負担は無料です",
    requiredKeywords: ["総合健診", "無料"],
    threshold: 0.5,
  },
  {
    id: "kh-10",
    category: "kouhou",
    type: "positive",
    input: "5月のお知らせは何がありますか？",
    groundTruth:
      "令和7年5月のイベントとして、5月20日に健康料理教室、5月24日〜6月1日に観光列車「花たびそうや」号運行、5月25日にクリーンおといねっぷと春季消防演習、5月27日にヘルシーフィットネスなどがあります",
    requiredKeywords: ["花たびそうや", "クリーン"],
    threshold: 0.5,
  },

  // ─── education: 高校サイト追加（10個, ed-13〜ed-22） ────────

  {
    id: "ed-13",
    category: "education",
    type: "positive",
    input: "おと高の資料請求はどうすればいいですか？",
    groundTruth:
      "おといねっぷ美術工芸高等学校の資料請求は、公式サイトの資料請求フォーム（https://www.otoineppu-h.ed.jp/contact/shiryou.html）から行えます。ガイダンス資料と学校パンフレットが送付されます",
    requiredKeywords: ["資料請求", "パンフレット"],
    threshold: 0.5,
  },
  {
    id: "ed-14",
    category: "education",
    type: "positive",
    input: "資料請求に必要な情報は何ですか？",
    groundTruth:
      "資料請求フォームではお名前、ふりがな、小中学校名、郵便番号、住所、部数が必須項目です。ガイダンス資料と学校パンフレットが送付されます",
    requiredKeywords: ["パンフレット", "ガイダンス"],
    threshold: 0.5,
  },
  {
    id: "ed-15",
    category: "education",
    type: "positive",
    input: "おと高へのお問い合わせ方法は？",
    groundTruth:
      "おといねっぷ美術工芸高等学校への問い合わせは、公式サイトのお問い合わせフォーム（https://www.otoineppu-h.ed.jp/contact/otoiawase.html）から行えます。お名前、メールアドレス、お問い合わせ内容を入力して送信します",
    requiredKeywords: ["電話", "フォーム"],
    threshold: 0.5,
  },
  {
    id: "ed-16",
    category: "education",
    type: "positive",
    input: "お問い合わせフォームの入力項目は？",
    groundTruth:
      "お問い合わせフォームの必須入力項目は、お名前、メールアドレス（半角英数字のみ）、お問い合わせ内容の3つです",
    requiredKeywords: ["お名前", "メールアドレス"],
    threshold: 0.5,
  },
  {
    id: "ed-17",
    category: "education",
    type: "positive",
    input: "卒業制作の工芸作品はどんなものがありますか？",
    groundTruth:
      "おといねっぷ美術工芸高等学校の卒業制作として工芸研究作品があり、公式サイトのギャラリーページ（https://www.otoineppu-h.ed.jp/gallery/crafts.html）で写真が公開されています。木工作品を中心とした作品が展示されています",
    requiredKeywords: ["工芸", "ギャラリー"],
    threshold: 0.5,
  },
  {
    id: "ed-18",
    category: "education",
    type: "positive",
    input: "卒業制作の美術作品を見たい",
    groundTruth:
      "おといねっぷ美術工芸高等学校の卒業制作の美術研究作品は、公式サイトのギャラリーページ（https://www.otoineppu-h.ed.jp/gallery/art.html）で写真が公開されています",
    requiredKeywords: ["美術", "ギャラリー"],
    threshold: 0.5,
  },
  {
    id: "ed-19",
    category: "education",
    type: "positive",
    input: "卒業制作の課題研究作品について教えてください",
    groundTruth:
      "おといねっぷ美術工芸高等学校の卒業制作として課題研究作品があり、公式サイトのギャラリーページ（https://www.otoineppu-h.ed.jp/gallery/2021-0329-1508-10.html）で多数の写真が公開されています。工芸研究作品、美術研究作品とともに3カテゴリで構成されています",
    requiredKeywords: ["課題研究", "ギャラリー"],
    threshold: 0.5,
  },
  {
    id: "ed-20",
    category: "education",
    type: "positive",
    input: "木の手づくり展はいつ開催されますか？",
    groundTruth:
      "令和7年度の木の手づくり展は、旭川展が令和7年6月28日（土）〜29日（日）10:00〜17:00、札幌展が7月25日（金）〜27日（日）に開催されます。卒業制作を中心に木工作品や絵画作品など200点ほどが展示されます",
    requiredKeywords: ["6月", "7月", "令和7年度"],
    threshold: 0.5,
  },
  {
    id: "ed-21",
    category: "education",
    type: "positive",
    input: "木の手づくり展の旭川展の会場はどこですか？",
    groundTruth:
      "木の手づくり展の旭川展の会場は旭川市民文化会館（旭川市7条通9丁目）の展示室です。令和7年度は6月28日（土）〜29日（日）10:00〜17:00に開催されます",
    requiredKeywords: ["旭川市民文化会館", "7条通9丁目"],
    threshold: 0.5,
  },
  {
    id: "ed-22",
    category: "education",
    type: "positive",
    input: "木の手づくり展の札幌展の日程は？",
    groundTruth:
      "令和7年度の木の手づくり展の札幌展は、7月25日（金）〜27日（日）に、かでる2・7（札幌市中央区北2条西7丁目 道民活動センタービル）の展示ホールで開催されます。7月26日（土）には学校説明会とワークショップも行われます",
    requiredKeywords: ["7月25日", "7月27日"],
    threshold: 0.5,
  },

  // ─── URL検証: 正しいURLを返すべき（10個） ────────────────

  {
    id: "ur-01",
    category: "education",
    type: "positive",
    input: "おと高の資料請求ページのURLを教えてください",
    groundTruth:
      "おと高の資料請求ページはこちらです: https://www.otoineppu-h.ed.jp/contact/shiryou.html",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/contact/shiryou.html"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/contact/shiryou.html",
  },
  {
    id: "ur-02",
    category: "education",
    type: "positive",
    input: "おと高のお問い合わせフォームはどこですか？",
    groundTruth:
      "お問い合わせフォームはこちらです: https://www.otoineppu-h.ed.jp/contact/otoiawase.html",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/contact/otoiawase.html"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/contact/otoiawase.html",
  },
  {
    id: "ur-03",
    category: "education",
    type: "positive",
    input: "おと高の入試情報のページはありますか？",
    groundTruth:
      "入試情報のページはこちらです: https://www.otoineppu-h.ed.jp/entrance/",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/entrance/"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/entrance/",
  },
  {
    id: "ur-04",
    category: "education",
    type: "positive",
    input: "中学生向けのQ&Aページを教えてください",
    groundTruth:
      "中学生向けQ&Aページはこちらです: https://www.otoineppu-h.ed.jp/junior/qa.html",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/junior/qa.html"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/junior/qa.html",
  },
  {
    id: "ur-05",
    category: "education",
    type: "positive",
    input: "おと高の体験入学の情報はどこで見られますか？",
    groundTruth:
      "体験入学の情報はこちらです: https://www.otoineppu-h.ed.jp/junior/taiken/",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/junior/taiken/"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/junior/taiken/",
  },
  {
    id: "ur-06",
    category: "education",
    type: "positive",
    input: "おと高の学校見学について知りたいのですが、ページはありますか？",
    groundTruth:
      "学校見学のページはこちらです: https://www.otoineppu-h.ed.jp/junior/kengaku.html",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/junior/kengaku.html"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/junior/kengaku.html",
  },
  {
    id: "ur-07",
    category: "education",
    type: "positive",
    input: "おと高の寮生活の情報ページはありますか？",
    groundTruth:
      "寮生活の情報はこちらです: https://www.otoineppu-h.ed.jp/ryou/",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/ryou/"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/ryou/",
  },
  {
    id: "ur-08",
    category: "education",
    type: "positive",
    input: "おと高のギャラリーで工芸作品を見たいのですが",
    groundTruth:
      "工芸作品のギャラリーはこちらです: https://www.otoineppu-h.ed.jp/gallery/crafts.html",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/gallery/crafts.html"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/gallery/crafts.html",
  },
  {
    id: "ur-09",
    category: "education",
    type: "positive",
    input: "おと高のホームページのURLは？",
    groundTruth:
      "おと高のホームページはこちらです: https://www.otoineppu-h.ed.jp/",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/",
  },
  {
    id: "ur-10",
    category: "education",
    type: "positive",
    input: "おと高のイベント情報はどこで確認できますか？",
    groundTruth:
      "イベント情報はこちらです: https://www.otoineppu-h.ed.jp/event/",
    requiredKeywords: ["https://www.otoineppu-h.ed.jp/event/"],
    threshold: 0.3,
    expectedUrl: "https://www.otoineppu-h.ed.jp/event/",
  },

  // ─── URL検証: URLを返すべきでない（5個） ─────────────────

  {
    id: "ur-11",
    category: "garbage",
    type: "negative",
    input: "ゴミカレンダーのURLを教えてください",
    groundTruth:
      "申し訳ありませんが、ゴミカレンダーのURLの情報は持っていません",
    requiredKeywords: ["わかりません", "ありません", "持っていません"],
    threshold: 0.1,
    noUrlExpected: true,
  },
  {
    id: "ur-12",
    category: "village",
    type: "negative",
    input: "音威子府村役場のホームページは？",
    groundTruth:
      "申し訳ありませんが、村役場のホームページURLの情報は持っていません",
    requiredKeywords: ["わかりません", "ありません", "持っていません"],
    threshold: 0.1,
    noUrlExpected: true,
  },
  {
    id: "ur-13",
    category: "admin",
    type: "negative",
    input: "防災マップのダウンロードURLは？",
    groundTruth:
      "申し訳ありませんが、防災マップのダウンロードURLの情報は持っていません",
    requiredKeywords: ["わかりません", "ありません", "持っていません"],
    threshold: 0.1,
    noUrlExpected: true,
  },
  {
    id: "ur-14",
    category: "facility",
    type: "negative",
    input: "公民館の予約ページのURLは？",
    groundTruth:
      "申し訳ありませんが、公民館の予約ページURLの情報は持っていません",
    requiredKeywords: ["わかりません", "ありません", "持っていません"],
    threshold: 0.1,
    noUrlExpected: true,
  },
  {
    id: "ur-15",
    category: "kouhou",
    type: "negative",
    input: "広報おといねっぷのバックナンバーのURLは？",
    groundTruth:
      "申し訳ありませんが、広報のバックナンバーのURLの情報は持っていません",
    requiredKeywords: ["わかりません", "ありません", "持っていません"],
    threshold: 0.1,
    noUrlExpected: true,
  },

  // ─── URL検証: villotoinep（村公式サイト）の正しいURLを返すべき（10個） ──

  {
    id: "ur-16",
    category: "village",
    type: "positive",
    input: "音威子府村へのアクセス方法のページはありますか？",
    groundTruth:
      "アクセス情報のページはこちらです: https://www.vill.otoineppu.hokkaido.jp/about/access.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/about/access.html",
    ],
    threshold: 0.3,
    expectedUrl: "https://www.vill.otoineppu.hokkaido.jp/about/access.html",
  },
  {
    id: "ur-17",
    category: "village",
    type: "positive",
    input: "音威子府村のふるさと納税のページを教えてください",
    groundTruth:
      "ふるさと納税のページはこちらです: https://www.vill.otoineppu.hokkaido.jp/kakuka/chiikishinkou/oshirase/202306_onseneki.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/chiikishinkou/oshirase/202306_onseneki.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/chiikishinkou/oshirase/202306_onseneki.html",
  },
  {
    id: "ur-18",
    category: "facility",
    type: "positive",
    input: "音威子府村の公民館のページはありますか？",
    groundTruth:
      "公民館のページはこちらです: https://www.vill.otoineppu.hokkaido.jp/kakuka/kyouikuiin/2020-0424-1654-21.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/kyouikuiin/2020-0424-1654-21.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/kyouikuiin/2020-0424-1654-21.html",
  },
  {
    id: "ur-19",
    category: "village",
    type: "positive",
    input: "音威子府村の職員採用情報のURLは？",
    groundTruth:
      "職員採用情報のページはこちらです: https://www.vill.otoineppu.hokkaido.jp/kakuka/soumuzaisei/oshirase/2025-0701-1217-14.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/soumuzaisei/oshirase/2025-0701-1217-14.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/soumuzaisei/oshirase/2025-0701-1217-14.html",
  },
  {
    id: "ur-20",
    category: "village",
    type: "positive",
    input: "音威子府村の子育て支援のページはありますか？",
    groundTruth:
      "子育て支援のページはこちらです: https://www.vill.otoineppu.hokkaido.jp/lifeevent/kosodate.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/lifeevent/kosodate.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/lifeevent/kosodate.html",
  },
  {
    id: "ur-21",
    category: "village",
    type: "positive",
    input: "音威子府村の地域バスの情報ページはどこですか？",
    groundTruth:
      "地域バスの情報はこちらです: https://www.vill.otoineppu.hokkaido.jp/kakuka/sangyoushinkou/oshirase/2024-0507-1503-14.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/sangyoushinkou/oshirase/2024-0507-1503-14.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/sangyoushinkou/oshirase/2024-0507-1503-14.html",
  },
  {
    id: "ur-22",
    category: "facility",
    type: "positive",
    input: "木遊館のページはありますか？",
    groundTruth:
      "木遊館のページはこちらです: https://www.vill.otoineppu.hokkaido.jp/shisetsu/mokuyukan.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/shisetsu/mokuyukan.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/shisetsu/mokuyukan.html",
  },
  {
    id: "ur-23",
    category: "village",
    type: "positive",
    input: "音威子府村の地域おこし協力隊（福祉）の募集ページはありますか？",
    groundTruth:
      "地域おこし協力隊（福祉）の募集ページはこちらです: https://www.vill.otoineppu.hokkaido.jp/kakuka/hokenfukushi/oshirase/2025-0401-0917-18.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/hokenfukushi/oshirase/2025-0401-0917-18.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/kakuka/hokenfukushi/oshirase/2025-0401-0917-18.html",
  },
  {
    id: "ur-24",
    category: "village",
    type: "positive",
    input: "音威子府村の健康・福祉のページはありますか？",
    groundTruth:
      "健康・福祉のページはこちらです: https://www.vill.otoineppu.hokkaido.jp/kurashi/kenkou_fukushi/index.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/kurashi/kenkou_fukushi/index.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/kurashi/kenkou_fukushi/index.html",
  },
  {
    id: "ur-25",
    category: "village",
    type: "positive",
    input: "音威子府村の人口と面積のページはどこですか？",
    groundTruth:
      "人口と面積のページはこちらです: https://www.vill.otoineppu.hokkaido.jp/about/jinkou_kokudo.html",
    requiredKeywords: [
      "https://www.vill.otoineppu.hokkaido.jp/about/jinkou_kokudo.html",
    ],
    threshold: 0.3,
    expectedUrl:
      "https://www.vill.otoineppu.hokkaido.jp/about/jinkou_kokudo.html",
  },

  // ─── kouhou: 広報 追加（kh-11〜kh-14） ─────────

  {
    id: "kh-11",
    category: "kouhou",
    type: "positive",
    input: "音威子府道路（音中道路）はいつ開通しますか？",
    groundTruth:
      "音中道路は2026年3月22日（日）16:00に開通予定です。音威子府バイパスの音中トンネルは2020年11月に貫通しており、長年の工事を経て開通を迎えます。",
    requiredKeywords: ["3月22日", "開通"],
    threshold: 0.5,
  },
  {
    id: "kh-12",
    category: "kouhou",
    type: "positive",
    input: "音威子府バイパスの音中トンネルについて教えてください",
    groundTruth:
      "音威子府バイパスの音中トンネルは2020年11月20日に貫通しました。平成22年（2010年）の掘削開始以来、難航する工事が続き、着工から11年目の悲願の貫通となりました。",
    requiredKeywords: ["音中トンネル", "貫通"],
    threshold: 0.5,
  },
  {
    id: "kh-13",
    category: "kouhou",
    type: "positive",
    input: "道の駅おといねっぷはいつ再開しますか？",
    groundTruth:
      "道の駅おといねっぷは2026年3月13日からセイコーマートにより再開予定です。地域特産品の販売も検討されています。",
    requiredKeywords: ["3月13日", "セイコーマート"],
    threshold: 0.5,
  },
  {
    id: "kh-14",
    category: "kouhou",
    type: "positive",
    input: "道の駅おといねっぷの運営はどこがやっていますか？",
    groundTruth:
      "道の駅おといねっぷは2026年3月13日からセイコーマートによる運営で再開予定です。「道の駅おといねっぷ」地方創生プロジェクトとして管理・運営委託事業が進められています。",
    requiredKeywords: ["セイコーマート"],
    threshold: 0.5,
  },
];
