'use client';

// import { usePathname } from 'next/navigation';
import { Header } from "@/components/header";

export function ClientHeader() {
  // const pathname = usePathname();

  // Show header on all pages now including V10

  // Add padding only to pages with header
  return (
    <>
      <Header />
      <div className="pt-8"></div>
    </>
  );
}