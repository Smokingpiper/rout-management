// 利用者向けの更新履歴。新しいものを上に追記する（日付は「その機能を公開した日」）。
// 内部の作業（リファクタ・デバッグ等）は載せず、画面や操作が変わったことだけを書く。

export type ChangeAudience = 'driver' | 'admin' | 'union' | 'all'
export type ChangeKind = 'new' | 'improve' | 'fix'
export type ChangeItem = { audience: ChangeAudience; kind: ChangeKind; text: string }
export type ChangeEntry = { date: string; title: string; items: ChangeItem[] }

export const AUDIENCE_LABEL: Record<ChangeAudience, string> = {
  all: '全員',
  driver: 'ドライバー',
  admin: '会社管理者',
  union: '協会管理者',
}
export const KIND_LABEL: Record<ChangeKind, string> = { new: '新機能', improve: '改善', fix: '修正' }

export const CHANGELOG: ChangeEntry[] = [
  {
    date: '2026-10-16',
    title: '作業前点検・早朝回収・日報の印刷と電子印鑑',
    items: [
      { audience: 'driver', kind: 'new', text: '「今日のルート」のトップに［通常回収］［早朝回収］の2つのボタンを追加。選ぶと作業前点検を経て、通常回収は担当ルートの画面、早朝回収は早朝回収の画面に進みます。' },
      { audience: 'driver', kind: 'new', text: '早朝回収に対応。ルートはなく、現在地の周辺スポットが地図に出て、40m以内に近づくと自動で「回った」に記録されます。地図のタップや「近くのスポット」から手動で追加、「外す」で取り消しもできます。持ち去り車両（車両番号・業者名・確認時間）も記録できます。' },
      { audience: 'driver', kind: 'new', text: '作業前点検（紙の「日常点検・点呼表」）をスマホで入力できるように。車両点検・作業者・掲出を○/×、始業・終業点呼、ヒヤリハット共有。入力は自動保存、通常回収と早朝回収は別々に記録します。' },
      { audience: 'driver', kind: 'improve', text: '作業前点検が済むまでは、ルート画面やスポット詳細に入れなくなりました（どこから入っても点検画面に切り替わります）。完了するとルートが始まり、GPS記録が自動でONになります。' },
      { audience: 'driver', kind: 'fix', text: '地図を拡大・移動しても現在地に引き戻されていた問題を修正。触った後は自動で動かず、地図左下の「📍 現在地」ボタンで戻れます。' },
      { audience: 'admin', kind: 'new', text: '日報の一括印刷。日報一覧で期間・状態・区分・キーワードを絞って「🖨 一括印刷」を押すと、紙の作業日報・点呼点検表と同じ体裁（A4・1日報1枚）で印刷できます。日報詳細からは1件だけの印刷もできます。' },
      { audience: 'admin', kind: 'new', text: '会社管理者に課長／係長のランクを設定でき、日報に「課長・係長・担当者」の電子印鑑（朱色の丸印）が押されます。担当者はドライバーの提出時に自動、係長は係長が押印、課長が承認すると押印されて「承認済み」になります。ユーザー詳細で印の文字も変更できます。' },
      { audience: 'admin', kind: 'new', text: '点検記録の一覧・詳細を追加。×の項目や点呼の異常（対面なし・検知器未使用・酒気帯び・体調不良）は赤く表示されます。日報の詳細にも、その日の作業前点検が載ります。' },
      { audience: 'admin', kind: 'fix', text: 'ユーザーを追加できなくなっていた不具合を修正しました。' },
      { audience: 'union', kind: 'improve', text: '月次集計に、承認済みの早朝回収の日報も含まれるようになりました。' },
    ],
  },
  {
    date: '2026-10-01',
    title: 'ロールの複数設定と日報一覧の改善',
    items: [
      { audience: 'admin', kind: 'new', text: 'ユーザーに複数のロール（例：会社管理者とドライバーの兼任）を設定できるように。ユーザー詳細から後でも変更できます。' },
      { audience: 'admin', kind: 'new', text: '日報の一覧と詳細に、提出したドライバーが表示されるようになりました。' },
      { audience: 'driver', kind: 'new', text: '日報一覧に「ドライバー」列と検索ボックス（ルート名・エリア名・ドライバー名）を追加。' },
      { audience: 'admin', kind: 'fix', text: 'スポット一覧の「全選択」が、表示中のページだけでなく検索条件に一致する全ページ分を対象にするようになりました。' },
    ],
  },
  {
    date: '2026-09-28',
    title: '画面内ナビ・通知音・日報提出前の確認',
    items: [
      { audience: 'driver', kind: 'improve', text: '「今日のルート」の地図で、スポットのマークが赤（未通過）から、40m以内に近づくと緑（通過済み）に変わるように。進み具合が一目で分かります。' },
      { audience: 'driver', kind: 'improve', text: '外部ナビアプリへ切り替えなくても進められるよう、「区間ナビ」を廃止しました（外部ナビは補助ボタンから使えます）。' },
      { audience: 'driver', kind: 'new', text: 'スポット通過時の通知音。「🔕 通知音を有効にする」を一度タップすると、通過のたびに音声で知らせます。' },
      { audience: 'driver', kind: 'new', text: '地図右上の「⛶」で全画面表示にできるように。' },
      { audience: 'driver', kind: 'new', text: '日報の提出前に、軌跡マップと回ったスポットの一覧で周り損ないを確認できるように。GPSの誤差で⚠️になったスポットは「クリア」で手動確認済みにできます。' },
      { audience: 'driver', kind: 'fix', text: '開始してもルート線が出ないことがあった問題を改善（現在地を素早く取得し、取得できるまで自動で再試行します）。' },
      { audience: 'all', kind: 'improve', text: '写真は保存時にAVIFへ変換し、容量を抑えるようにしました。' },
      { audience: 'all', kind: 'fix', text: 'スマホでサイドバー下部のボタンの幅が揃わず崩れていた問題を修正しました。' },
    ],
  },
  {
    date: '2026-09-27',
    title: '支払い管理・使い方ガイド',
    items: [
      { audience: 'union', kind: 'new', text: '会社ごとの品目マスタ・単価（円/kg）の登録と、承認済み日報からの月次集計・手数料控除後の配分額の自動計算、CSV出力。' },
      { audience: 'union', kind: 'new', text: '支払いダッシュボード。会社別・品目別・月次推移をグラフで確認できます。' },
      { audience: 'driver', kind: 'new', text: '「今日のルート」の地図に、現在地から次のスポットまでの道路沿いの参考ルートを表示。スポットの40m以内に近づくと自動で次のスポットに進みます。' },
      { audience: 'all', kind: 'new', text: 'スマホではメニューをハンバーガー（☰）に格納。ユーザー一覧などのスマホでの表示崩れも修正しました。' },
      { audience: 'all', kind: 'new', text: '使い方ガイド（サイドバーの「📖 使い方」）を追加。' },
      { audience: 'driver', kind: 'improve', text: '担当になっているスポットだけが、スポット一覧・日報・軌跡マップに表示されるように。' },
      { audience: 'all', kind: 'improve', text: 'パスワード変更後にアプリへ進むボタンを追加。トップページは管理画面に移動するようにしました。' },
    ],
  },
  {
    date: '2026-09-26',
    title: 'ログイン必須化・ドライバー画面の完成・周り損ないの自動検出',
    items: [
      { audience: 'all', kind: 'new', text: 'メールアドレスとパスワードでのログインを全画面で必須化。' },
      { audience: 'admin', kind: 'new', text: 'ユーザー管理（招待・詳細・曜日ごとの担当ルートのスケジュール設定）と、スポットごとの担当ドライバー割り当て（最大5人）。エリア・ルート・スポット一覧に検索と担当ドライバーでの絞り込み。' },
      { audience: 'admin', kind: 'improve', text: 'スポット一覧に、備考・要注意での絞り込み、一括編集、詳細ページ、備考の個別編集を追加。' },
      { audience: 'driver', kind: 'new', text: '今日のルート・担当ルート一覧・日報一覧と日報詳細。GPS記録の開始／終了ボタン。' },
      { audience: 'driver', kind: 'new', text: 'GPS記録から、通過できていないスポットを自動で検出して⚠️で表示。実際に通過したスポットは青い線でつながります。' },
      { audience: 'all', kind: 'improve', text: '地図をLeaflet＋MapTilerに切り替え。「今日」の判定を日本時間に修正しました。' },
    ],
  },
  {
    date: '2026-09-25',
    title: '実データでの運用開始',
    items: [
      { audience: 'all', kind: 'new', text: '斉藤商店の実データ（19ルート・5,702スポット）を取り込み、ドライバー・会社管理者・協会管理者の画面を実データに接続。' },
      { audience: 'driver', kind: 'new', text: '日報提出（総重量・品目・日報/レシート写真・メモ）と、スポットごとのナビ画面。' },
      { audience: 'admin', kind: 'new', text: '日報の一覧・詳細・承認、エリア→ルート→スポットの管理画面。' },
      { audience: 'union', kind: 'new', text: '会社登録と協会手数料ルールの設定、配分結果のCSV出力。' },
    ],
  },
  {
    date: '2026-09-23',
    title: '画面モックアップを公開',
    items: [
      { audience: 'all', kind: 'new', text: '画面モックアップ（v0.2）を公開。画面にコメントを残せる共有ピン（アノテーション）機能つきです。' },
    ],
  },
]
