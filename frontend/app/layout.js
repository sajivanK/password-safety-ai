import "./globals.css";
import Sidebar from "./Sidebar";

export const metadata = {
  title: "Password Safety AI",
  description: "AI-powered password safety dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-blue-900 via-purple-900 to-gray-900 text-white min-h-screen flex">
        {/* Sidebar as client component */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
