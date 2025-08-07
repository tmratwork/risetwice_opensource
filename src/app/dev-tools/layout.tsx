'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DevToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  const navLinks = [
    { href: '/dev-tools', label: 'Home', exact: true },
    { href: '/dev-tools/pinecone-test', label: 'Pinecone Test' },
    { href: '/dev-tools/schema-extraction', label: 'Database Structure' },
  ];
  
  const isActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="p-4 bg-gray-900 border-b border-gray-800">
        <div className="text-white font-mono mb-2">DEVELOPER TOOLS - NOT FOR PRODUCTION</div>
        
        <div className="flex flex-wrap gap-2 mt-2">
          {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                isActive(link.href, link.exact) 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}