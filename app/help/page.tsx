import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function HelpPage() {
  const user = await getCurrentUser()
  const roles = (user?.roles as string[] | undefined) ?? []

  return (
    <>
      <div className="breadcrumb">使い方</div>
      <div className="page-title">📖 使い方ガイド</div>
      <div className="page-desc">ご自身の役割のセクションを開いてください。操作で迷ったらここに戻ってきてください。</div>

      <details className="card" open={roles.includes('driver') || roles.length === 0}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>🚚 ドライバー向け</summary>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>

          <Section title="1. 今日のルートを開く">
            <p>ログイン後、「今日のルート」画面に本日担当のルート（曜日ごとに会社管理者が設定）が表示されます。ルートを選んで「収集を開始する」を押してください。</p>
          </Section>

          <Section title="2. GPS記録をON/OFFする">
            <p>ルート画面の「▶ 収集開始」でGPS記録が始まり、「⏸ 収集終了」で止まります。休憩などで一時的に止めたいときにご利用ください。記録した位置情報は、あとで「周り損ない」の自動チェックに使われます。</p>
          </Section>

          <Section title="3. 画面を開いたままナビする">
            <p>マップには現在地（丸）と、次に回るべきスポット（青丸）、その間の道路沿いの参考ルート線が自動で表示されます。スポットは未通過が🔴、40m以内まで近づくと自動で🟢に変わり、次のスポットに切り替わります。切り替わる瞬間に通知音も鳴ります（GPSステータスのカードにある「🔕 通知音を有効にする」を一度タップしておいてください。タップでテスト再生もできます）。</p>
            <p>地図右上の「⛶」で全画面表示にできます（この機能はスポット詳細・軌跡マップなど地図が出てくる画面すべてで使えます）。</p>
            <p style={{ color: 'var(--warn)' }}>⚠ Google/Apple Mapsなど外部のナビアプリに切り替えると、ブラウザがバックグラウンドになりGPS記録が一時停止します。できるだけこの画面を開いたままにしてください。外部ナビは「🧭 外部ナビアプリを開く」から補助的に使えます。</p>
          </Section>

          <Section title="4. スポット一覧・要注意スポット">
            <p>スポット一覧はタップで開閉します（担当になっているスポットのみ表示されます）。要注意スポットには⚠️が付き、到達時に内容を確認して「確認しました」を押してください。備考はスポット詳細画面から編集できます。</p>
          </Section>

          <Section title="5. 日報を提出する">
            <p>1日のルートが終わったら「📝 日報提出」から提出します。入力フォームの上に軌跡マップと回ったスポット一覧が表示されるので、提出前に周り損ないがないか確認できます。GPSの誤差などで実際は通過しているのに⚠️になっている場合は、一覧の「クリア」ボタンで手動確認済み（☑️）にできます（間違えたら「元に戻す」で取り消せます）。確認したら総重量・品目・写真（日報用／領収書用）・メモを入力して提出してください。提出後は会社管理者の承認待ちになります。</p>
          </Section>

          <Section title="6. 軌跡・日報の確認">
            <p>「日報一覧」には、同じルートを担当する他のドライバーの日報も表示されます（誰が提出したかは一覧の「ドライバー」列で確認でき、ルート名・エリア名・ドライバー名で検索もできます）。日報詳細では、実際に通過したスポットを結んだ青い線と、近づけなかったスポットの⚠️マークで、周り損ないがないかを確認できます。</p>
          </Section>

        </div>
      </details>

      <details className="card" open={roles.includes('company_admin')}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>🏢 会社管理者向け</summary>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>

          <Section title="1. エリア・ルート・スポットの管理">
            <p>「エリア一覧」→エリアを選んで「ルート一覧」→ルートを選んで「スポット一覧」と辿ります。各一覧には検索ボックスと「担当ドライバーで絞り込み」フィルタがあります。</p>
          </Section>

          <Section title="2. スポットの編集・担当割り当て">
            <p>スポット一覧はアコーディオンで開閉でき、備考ありや要注意スポットだけに絞り込むこともできます。スポット詳細画面では、備考の追加・編集、要注意設定、担当ドライバーの割り当て（1スポットにつき最大5人）ができます。複数スポットをまとめて編集する一括修正機能もあり、見出しのチェックボックスで「全選択」すると、検索条件に一致する全件（表示中のページだけでなく他のページの分も含む）が対象になります。</p>
          </Section>

          <Section title="3. 日報の承認">
            <p>「日報一覧・承認」で、ドライバーが提出した日報（提出したドライバー・総重量・品目・写真・GPS軌跡）を確認し、「日報を承認する」で承認します。軌跡マップでは周り損ないの可能性があるスポットが⚠️で表示されます（ドライバーが手動確認済みにしたスポットは☑️）。承認は「承認を取り消す」でやり直せます。</p>
          </Section>

          <Section title="4. ユーザー管理">
            <p>「ユーザー管理」からユーザーを招待する際、ロール（ドライバー／会社管理者）は複数選択できます。たとえば配送も行うマネージャーには両方チェックしてください。既存ユーザーのロールは、ユーザー詳細ページの「ロール設定」カードから後からでも変更できます。</p>
            <p>ユーザー詳細では担当ルート一覧も確認できます。「スケジュール設定」から、曜日ごとにどのルートを担当するかを設定してください（ここで設定した曜日が、ドライバー側の「今日のルート」に反映されます）。</p>
          </Section>

        </div>
      </details>

      <details className="card" open={roles.includes('union_admin')}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>🤝 協会管理者向け</summary>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>

          <Section title="1. 会社の手数料ルール">
            <p>「会社登録」から各会社を選ぶと、協会が徴収する手数料（定率％または固定額）を設定できます。適用開始日を指定して履歴として登録され、月次計算のときはその時点で有効なルールが自動で使われます。</p>
          </Section>

          <Section title="2. 品目マスタ・単価設定">
            <p>同じ画面の「品目マスタ・単価を登録」から、会社ごとの品目（古紙・缶など）と、その単価（円/kg）を登録できます。単価も履歴として保持され、日報の実施日時点で有効だった単価が自動で使われるため、後から値上げしても過去分の金額は変わりません。</p>
          </Section>

          <Section title="3. 月次集計・支払い配分">
            <p>「🔄 月次集計を再計算する」を押すと、承認済みの日報×品目単価から重量・金額を自動計算し、品目別内訳・会社合計・手数料控除後の配分額まで一括で更新されます。結果はCSV（配分結果／品目別内訳）でダウンロードできます。</p>
          </Section>

          <Section title="4. 支払いダッシュボード">
            <p>サイドバーの「支払いダッシュボード」では、会社別総額・品目別総額（全社横断）・月次推移をグラフでまとめて確認できます。</p>
          </Section>

        </div>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>⚙️ 共通</summary>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Section title="ログイン・パスワード">
            <p>メールアドレスとパスワードでログインします。初回ログイン時は仮パスワードのため、パスワード変更が必須です。パスワードはサイドバーの「🔑 パスワード変更」からいつでも変更できます。</p>
          </Section>
          <Section title="表示テーマ">
            <p>サイドバーの「🌓 ライト/ダーク切替」で画面の配色を切り替えられます。</p>
          </Section>
        </div>
      </details>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}
