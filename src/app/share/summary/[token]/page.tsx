"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { ClientHeader } from '@/components/client-header';
import { MobileFooterNavV15 } from '@/app/chatbotV16/components/MobileFooterNavV15';
import '@/app/chatbotV16/chatbotV15.css';

// Define the shape of what the params Promise will resolve to
interface RouteParams {
  token: string;
}

// Correctly type the component props according to Next.js 15
interface SummaryPageProps {
  params: Promise<RouteParams>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface SummarySheet {
  title: string;
  generatedAt: string;
  userId: string;
  content: string;
  categories: string[];
  stats: {
    conversationCount: number;
    messageCount: number;
  };
  footer: string;
  customNotes?: string;
}

export default function SummarySharePage({ params }: SummaryPageProps) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummarySheet | null>(null);
  const [expired, setExpired] = useState(false);

  // First effect to resolve the params Promise
  useEffect(() => {
    const resolveParams = async () => {
      try {
        // Await the entire params object
        const resolvedParams = await params;
        setToken(resolvedParams.token);
      } catch (err) {
        console.error('Error resolving params:', err);
        setError('Failed to load page parameters.');
        setLoading(false);
      }
    };
    
    resolveParams();
  }, [params]);

  // Once token is resolved, fetch the summary
  useEffect(() => {
    if (!token) return;

    async function fetchSummary() {
      try {
        setLoading(true);
        
        // Fetch the summary using the sharing token
        const { data, error } = await supabase
          .from('user_summary_sheets')
          .select('summary_content, expires_at')
          .eq('sharing_token', token)
          .single();

        if (error) {
          console.error('Error fetching summary:', error);
          setError('The summary sheet could not be found or has expired.');
          return;
        }

        // Check if the summary has expired
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        
        if (now > expiresAt) {
          setExpired(true);
          setError('This summary sheet has expired.');
          return;
        }

        // Set the summary data
        setSummary(data.summary_content as SummarySheet);
      } catch (err) {
        console.error('Unexpected error:', err);
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [token]);

  // Function to handle printing the summary
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Summary Sheet</h1>
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <p className="text-gray-700 dark:text-gray-300">Loading summary sheet...</p>
        </div>
      </div>
    );
  }

  if (error || expired) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Summary Sheet</h1>
        <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg shadow-md">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          {expired && (
            <p className="text-red-700 dark:text-red-300 mt-2">
              Summary sheets expire after 30 days for privacy protection.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Function to format the content properly with sections and bullet points
  const formatContent = (content: string) => {
    // Split by headings (using ## or starting with uppercase followed by colon)
    const sections = content.split(/(?:^|\n)(?:#{1,3} |[A-Z][^:\n]+:)/g).filter(Boolean);
    const headings = content.match(/(?:^|\n)(?:#{1,3} |[A-Z][^:\n]+:)/g) || [];
    
    return (
      <div>
        {headings.map((heading, index) => {
          // Clean up the heading
          const cleanHeading = heading.replace(/^[\n#\s]+/, '').trim();
          const sectionContent = sections[index] || '';
          
          // Process section content to find bullet points
          const contentLines = sectionContent.split('\n').filter(line => line.trim());
          
          return (
            <div key={index} className="mb-6">
              <h3 className="text-lg font-medium mb-3">{cleanHeading}</h3>
              <div className="ml-6">
                {contentLines.map((line, i) => {
                  // Check if line starts with a bullet point
                  const isBullet = line.trim().startsWith('-') || line.trim().startsWith('•');
                  const cleanLine = line.replace(/^[\s•-]+/, '').trim();
                  
                  return (
                    <div key={i} className={`${isBullet ? 'flex' : ''} mb-2`}>
                      {isBullet && <span className="mr-2">•</span>}
                      <p className="text-gray-700 dark:text-gray-300">{cleanLine}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="v11-layout-root">
          {/* Header Row - Same as V16 */}
          <div className="header-row">
            <ClientHeader />
          </div>

          {/* Main Content Row */}
          <div className="main-content-row">
            <div className="container mx-auto px-4 py-8">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md print:shadow-none">
                <div className="flex justify-between items-center mb-6 print:mb-2">
                  <h1 className="text-2xl font-bold">{summary?.title}</h1>
                  <button 
                    onClick={handlePrint}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded print:hidden"
                  >
                    Print
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 print:mb-4">
                  Generated on {new Date(summary?.generatedAt || '').toLocaleDateString()}
                </p>

                <div className="prose prose-blue dark:prose-invert max-w-none">
                  {summary?.content ? formatContent(summary.content) : (
                    <p className="text-gray-700 dark:text-gray-300">No content available</p>
                  )}
                </div>
                
                {summary?.customNotes && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-medium mb-3">Additional Notes</h3>
                    <p className="text-gray-700 dark:text-gray-300">{summary.customNotes}</p>
                  </div>
                )}

                {summary?.stats && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-6 print:mt-4">
                    Based on {summary.stats.conversationCount} conversations and {summary.stats.messageCount} messages.
                  </div>
                )}

                <div className="mt-10 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                  {summary?.footer}
                </div>
              </div>

              <div className="mt-8 text-center print:hidden">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This summary contains privacy-conscious information that has been explicitly approved for sharing.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  For privacy protection, this link will expire in 30 days.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Row - Same as V16 */}
          <div className="footer-row">
            <MobileFooterNavV15 />
          </div>
        </div>
        
        {/* Print-specific styles */}
        <style jsx global>{`
          @media print {
            body {
              font-size: 12pt;
              color: #000;
              background: #fff;
            }
            .container {
              max-width: 100%;
              padding: 0;
            }
            h1 {
              font-size: 18pt;
            }
            h3 {
              font-size: 14pt;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print\\:shadow-none {
              box-shadow: none !important;
            }
            .print\\:mb-2 {
              margin-bottom: 0.5rem !important;
            }
            .print\\:mb-4 {
              margin-bottom: 1rem !important;
            }
            .print\\:mt-4 {
              margin-top: 1rem !important;
            }
            .v11-layout-root .header-row,
            .v11-layout-root .footer-row {
              display: none !important;
            }
          }
        `}</style>
      </ThemeProvider>
    </AuthProvider>
  );
}