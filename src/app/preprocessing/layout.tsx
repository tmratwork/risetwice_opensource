export default function PreprocessingLayout({
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
  title: 'Book Preprocessing | LiveBooks.ai',
  description: 'Admin tools for embedding book content into vector database',
};