export default function BookdataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}

export const metadata = {
  title: 'Book Data | LiveBooks.ai',
  description: 'View and export generated book data',
};