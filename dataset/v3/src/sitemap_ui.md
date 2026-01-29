# 音威子府村サイト - UI目線サイトマップ

> このファイルは、Webサイトの**UIナビゲーション構造**を基にしたMD配置の設計図です。
> 実際のURL構造とは異なる場合があります（詳細は structure_issues.md 参照）。

## トップレベルカテゴリ

```
villotoinep/
├── about/              音威子府村について
├── gyousei/            行政情報
├── kurashi/            くらしの情報
├── sangyou/            産業情報
├── shisetsu/           施設案内
├── lifeevent/          ライフイベント
├── bousai/             防災情報
└── village_mayor/      村長の部屋
```

---

## 詳細構造

### about/ - 音威子府村について
```
about/
├── index.md            トップ
├── gaiyou.md           村の概要
├── ichi_kisyou.md      位置・気象
├── jinkou_kokudo.md    人口推移・国土利用
├── access.md           アクセス
└── kouhou.md           広報誌「おといねっぷ」
```

### gyousei/ - 行政情報
```
gyousei/
├── index.md            トップ（ナビゲーション）
├── gyouzaisei/         行財政情報
│   ├── index.md        概要・人事行政
│   ├── gyouzaiseihoukoku.md  行財政報告
│   ├── jinji.md        人事行政の運営等
│   ├── service-reform.md     地方行政サービス改革
│   ├── enterprise-reform.md  地方公営企業改革
│   ├── action-plan.md  特定事業主行動計画
│   ├── facility-plan.md      公共施設等総合管理計画
│   ├── population-vision.md  人口ビジョン・総合戦略
│   ├── mynumber.md     マイナンバー制度
│   └── covid-grant.md  地方創生臨時交付金
├── keikaku/            各種計画
│   ├── index.md
│   ├── general-plan-5th.md   第5次総合計画
│   └── general-plan-6th.md   第6次総合計画
├── nyusatsu/           入札情報
│   └── index.md
├── saiyou.md           職員採用
└── muraokoshi.md       地域おこし協力隊
```

### kurashi/ - くらしの情報
```
kurashi/
├── index.md            トップ（ナビゲーション）
├── tetsuduki.md        手続き・相談
│   └── ※実コンテンツはkakuka/soumuzaisei/等に分散
├── kenkou_fukushi/     健康・福祉
│   ├── index.md
│   ├── nyuuyouji_josei.md    乳幼児医療費助成
│   └── syugaku_kashitsuke.md 修学資金貸付
│   └── ※実コンテンツはkakuka/hokenfukushi/に分散
├── hoken_nenkin.md     保険・年金
│   └── ※実コンテンツはkakuka/juuminseikatsu/に分散
├── manabi.md           学び
│   └── ※実コンテンツはkakuka/kyouikuiin/に分散
├── zeikin.md           税金
│   └── ※実コンテンツはkakuka/juuminseikatsu/に分散
├── gomi_kankyou/       くらし・環境
│   ├── index.md
│   ├── gomi_calendar.md      ごみカレンダー
│   ├── bunbetu.md      ごみの分け方
│   ├── hurugi.md       古着・古布回収
│   └── kaitai.md       解体廃棄物
│   └── ※ペット・環境・地域安全はkakuka/juuminseikatsu/
└── sports/             スポーツ
    ├── index.md
    ├── baseball.md
    ├── cross_country.md
    └── alpine.md
```

### sangyou/ - 産業情報
```
sangyou/
├── index.md            トップ
├── nougyou.md          農業
└── ringyou.md          林業
└── ※実コンテンツはkakuka/sangyoushinkou/に分散
```

### shisetsu/ - 施設案内
```
shisetsu/
├── index.md            トップ
├── eco_museum.md       エコミュージアムおさしまセンター
├── chokoku.md          彫刻の館（砂澤ビッキ）
├── hoken_fukushi.md    保健福祉センター
├── ski.md              音威富士スキー場
└── ...
```

### lifeevent/ - ライフイベント
```
lifeevent/
├── index.md            トップ
├── ninshin.md          妊娠・出産
├── kosodate.md         子育て
├── kyouiku.md          教育・文化
├── shushoku.md         就職・退職
├── kekkon.md           結婚・離婚
├── hikkoshi.md         引越し・住まい
├── kourei.md           高齢・介護
└── okuyami.md          おくやみ
```

---

## kakuka/ - 課別ページ（実コンテンツ配置先）

> UIカテゴリには表示されないが、実際のコンテンツが配置されているディレクトリ。
> Cアプローチでは、これらのコンテンツを上記UIカテゴリにマージする。

```
kakuka/
├── soumuzaisei/        総務課総務財政室
│   └── → gyousei/, kurashi/tetsuduki/ にマージ
├── chiikishinkou/      総務課地域振興室
│   └── → kurashi/tetsuduki/ にマージ
├── juuminseikatsu/     住民課住民生活室
│   └── → kurashi/zeikin/, hoken_nenkin/, gomi_kankyou/ にマージ
├── hokenfukushi/       住民課保健福祉室
│   └── → kurashi/kenkou_fukushi/ にマージ
├── sangyoushinkou/     経済課産業振興室
│   └── → sangyou/ にマージ
├── kankyouseibi/       経済課環境整備室
│   └── → shisetsu/, kurashi/ にマージ
├── kyouikuiin/         教育委員会
│   └── → kurashi/manabi/, sports/ にマージ
├── suitoushitsu/       会計課
│   └── → kurashi/tetsuduki/ にマージ
└── ...
```

---

## マッピング表

| UIカテゴリ | 実コンテンツ配置先 | 対応状況 |
|-----------|------------------|---------|
| kurashi/tetsuduki | kakuka/soumuzaisei/, chiikishinkou/, suitoushitsu/ | リンクのみ |
| kurashi/kenkou_fukushi | kakuka/hokenfukushi/, kurashi/kenkou_fukushi/ | 部分マージ済み |
| kurashi/hoken_nenkin | kakuka/juuminseikatsu/ | リンクのみ |
| kurashi/manabi | kakuka/kyouikuiin/ | リンクのみ |
| kurashi/zeikin | kakuka/juuminseikatsu/ | リンクのみ |
| kurashi/gomi_kankyou | kurashi/gomi_kankyou/, kakuka/juuminseikatsu/ | 部分マージ済み |
| sangyou/ | kakuka/sangyoushinkou/ | リンクのみ |
| shisetsu/ | 各施設ページ | 未着手 |

---

更新日: 2026-01-26
