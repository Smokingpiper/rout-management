export const metadata = {
  title: "ゴミ収支管理アプリ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
