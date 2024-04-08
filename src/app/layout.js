import "./globals.css";

export const metadata = {
  title: "CHATAPP",
  description: "CHATAPP",
};



export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-black font-cascadia text-2xl text-white">
        {children}
      </body>
    </html>
  );
}
