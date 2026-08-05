-- ローカルの管理画面ホームを目視確認するための seed。
-- 日付は datetime('now') 起点なので、いつ流しても直近3日 / 直近7日の窓に入る。
-- id は seed- プレフィックス。取り消しは DELETE FROM <table> WHERE id LIKE 'seed-%'。

-- 新しい声（直近3日）と今週の話題（直近7日）用のペルソナ
-- 観光 8（困りごと1）/ 生活 6（5）/ 行政 4（2）/ 教育 3（1）/ 医療 2（1）
INSERT OR REPLACE INTO persona
  (id, category, tags, content, source, topic, sentiment, demographic_summary, created_at, conversation_ended_at)
VALUES
  -- 直近3日（新しい声に出る）
  ('seed-p01','request','移住補助金','移住補助金のページが見つけにくい','chat','行政','request','20代,移住検討者',datetime('now','-4 hours'),datetime('now','-4 hours')),
  ('seed-p02','complaint','粗大ごみ','粗大ごみの出し方がわかりにくい','chat','生活','negative','40代,村人',datetime('now','-1 days'),datetime('now','-1 days')),
  ('seed-p03','impression','そば,駅','音威子府そばがとても美味しかった','chat','観光','positive','30代,観光客',datetime('now','-2 days'),datetime('now','-2 days')),
  -- 直近7日
  ('seed-p04','question','見どころ','駅の周りで昼に食べられる場所を知りたい','chat','観光','neutral','50代,観光客',datetime('now','-3 days'),datetime('now','-3 days')),
  ('seed-p05','impression','天塩川','天塩川の景色がよかった','chat','観光','positive','60代,観光客',datetime('now','-3 days'),datetime('now','-3 days')),
  ('seed-p06','impression','キャンプ場','キャンプ場が静かで快適だった','chat','観光','positive','30代,観光客',datetime('now','-4 days'),datetime('now','-4 days')),
  ('seed-p07','impression','物産','物産センターで買い物を楽しめた','chat','観光','positive','40代,観光客',datetime('now','-4 days'),datetime('now','-4 days')),
  ('seed-p08','impression','ダム','ダムまでの道が分かりやすかった','chat','観光','positive','50代,観光客',datetime('now','-5 days'),datetime('now','-5 days')),
  ('seed-p09','question','駐車場','観光案内所の駐車場はどこ','chat','観光','neutral','30代,観光客',datetime('now','-5 days'),datetime('now','-5 days')),
  ('seed-p10','complaint','案内看板','案内看板が古くて読めない','chat','観光','negative','40代,観光客',datetime('now','-6 days'),datetime('now','-6 days')),
  ('seed-p11','complaint','ゴミ収集','収集日が変わったのを知らなかった','chat','生活','negative','60代,村人',datetime('now','-3 days'),datetime('now','-3 days')),
  ('seed-p12','complaint','分別','プラごみの分別が細かすぎる','chat','生活','negative','50代,村人',datetime('now','-4 days'),datetime('now','-4 days')),
  ('seed-p13','complaint','水道','水道の元栓の場所がわからない','chat','生活','negative','70代,村人',datetime('now','-5 days'),datetime('now','-5 days')),
  ('seed-p14','request','分別表','分別表を配ってほしい','chat','生活','request','40代,村人',datetime('now','-6 days'),datetime('now','-6 days')),
  ('seed-p15','question','町内会','町内会の連絡先を知りたい','chat','生活','neutral','50代,村人',datetime('now','-6 days'),datetime('now','-6 days')),
  ('seed-p16','request','窓口','窓口の待ち時間を短くしてほしい','chat','行政','request','30代,村人',datetime('now','-4 days'),datetime('now','-4 days')),
  ('seed-p17','question','転入手続き','転入手続きに必要なものは','chat','行政','neutral','20代,移住検討者',datetime('now','-5 days'),datetime('now','-5 days')),
  ('seed-p18','question','証明書','住民票をコンビニで取れるか','chat','行政','neutral','40代,村人',datetime('now','-6 days'),datetime('now','-6 days')),
  ('seed-p19','complaint','通学路','通学路の見通しが悪い','chat','教育','negative','40代,村人',datetime('now','-3 days'),datetime('now','-3 days')),
  ('seed-p20','question','学童','学童保育の受け入れ時間は','chat','教育','neutral','30代,村人',datetime('now','-5 days'),datetime('now','-5 days')),
  ('seed-p21','question','給食','給食のアレルギー対応について','chat','教育','neutral','30代,村人',datetime('now','-6 days'),datetime('now','-6 days')),
  ('seed-p22','complaint','診療所','診療所の予約が取りづらい','chat','医療','negative','70代,村人',datetime('now','-4 days'),datetime('now','-4 days')),
  ('seed-p23','question','休日診療','休日に診てもらえる場所は','chat','医療','neutral','60代,村人',datetime('now','-6 days'),datetime('now','-6 days'));

-- 緊急バナー（直近3日）
INSERT OR REPLACE INTO emergency_reports (id, type, description, location, reported_at)
VALUES ('seed-e01','熊の出没','物満内地区の農道付近で子熊を目撃','物満内',datetime('now','-1 days'));

-- 先週のまとめ（週次レポートは火曜 5:00 JST 生成・内容は前週分）
INSERT OR REPLACE INTO weekly_reports (id, period_start, period_end, stats, summary, created_at)
VALUES (
  'seed-r01',
  date('now','-13 days'),
  date('now','-7 days'),
  '{"conversationCount":41,"messageCount":210,"hourly":[],"platforms":[],"usageByModel":[]}',
  '先週は観光の声がいちばん多く、そばと天塩川の話題が続きました。生活では粗大ごみの出し方について困りごとが重なっており、分別表を配ってほしいという要望も出ています。行政の窓口は待ち時間の指摘がありました。',
  datetime('now','-6 days')
);
