'use client';

import { useState, useEffect, useCallback } from 'react';

type ProcessingType = 'viewBookData' | 'exportBookData' | 'none';

// Define TypeScript interfaces for the various result structures
interface BookInfo {
  id: string;
  title: string;
  author?: string;
}

interface KeyConcept {
  concept: string;
  description: string;
}

interface CharacterProfile {
  character_name: string;
  character_profile: string;
}

interface OpeningLine {
  character_name: string;
  type: string;
  opening_line: string;
  related_concepts?: string[];
  example_conversation?: {
    speaker: string;
    text: string;
  }[];
}

interface Quest {
  quest_title: string;
  introduction: string;
  challenge: string;
  reward: string;
  starting_question: string;
  chapter_number: number;
  chapter_title: string;
}

interface ProcessingResult {
  success: boolean;
  message: string;
  book?: BookInfo;
  concept_count?: number;
  concepts?: KeyConcept[];
  character_count?: number;
  character_profiles?: CharacterProfile[];
  line_count?: number;
  opening_lines?: OpeningLine[];
  quest_count?: number;
  quests?: Quest[];
  upload_url?: string; // URL for uploaded/shared content
  upload_filename?: string; // Filename for uploaded content
}

export default function BookDataPage() {
  const [bookId, setBookId] = useState('');
  const [processingType, setProcessingType] = useState<ProcessingType>('none');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const isLoading = processingType !== 'none';

  const handleShowBookData = useCallback(async (id?: string) => {
    const bookIdToUse = id || bookId;

    if (!bookIdToUse.trim()) {
      setError('Book ID is required');
      return;
    }

    try {
      setProcessingType('viewBookData');
      setError(null);
      setResult(null);
      setStartTime(new Date());

      // Fetch book data from Supabase
      console.log(`[Client] Fetching book data for ID: ${bookIdToUse}`);

      const response = await fetch('/api/preprocessing/export-book-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookIdToUse.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      // Set result with the complete data for display
      setResult({
        success: true,
        message: `Successfully loaded book data for "${data.book?.title}"`,
        book: data.book,
        concepts: data.concepts,
        character_profiles: data.character_profiles,
        opening_lines: data.opening_lines,
        quests: data.quests,
        concept_count: data.concepts?.length || 0,
        character_count: data.character_profiles?.length || 0,
        line_count: data.opening_lines?.length || 0,
        quest_count: data.quests?.length || 0
      });

      console.log(`[Client] Successfully loaded book data with ${data.concepts?.length || 0} concepts, ${data.character_profiles?.length || 0} profiles, ${data.opening_lines?.length || 0} opening lines, and ${data.quests?.length || 0} quests`);

    } catch (err) {
      console.error('Error loading book data:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingType('none');
    }
  }, [bookId]);

  // Handle URL parameters on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id');

      if (idParam) {
        setBookId(idParam);
        // Auto-load the book data if ID is provided in URL
        setTimeout(() => {
          handleShowBookData(idParam);
        }, 300);
      }
    }
  }, [handleShowBookData]);

  const handleGenerateAndExportHtml = async () => {
    if (!result || !result.book) {
      setError('No book data available for export. Please load book data first.');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      setExportUrl(null);

      // Generate HTML content
      const htmlContent = generateStandaloneHtml({
        book: result.book,
        concepts: result.concepts || [],
        character_profiles: result.character_profiles || [],
        opening_lines: result.opening_lines || [],
        quests: result.quests || []
      });

      // Generate filename
      const filename = `${result.book.title.replace(/\s+/g, '_').toLowerCase()}_${result.book.id.substring(0, 8)}.html`;

      // Upload to Supabase
      const uploadResponse = await fetch('/api/preprocessing/upload-book-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: result.book.id,
          filename,
          html_content: htmlContent
        }),
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || `API error: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();

      // Set the exported URL
      setExportUrl(uploadData.url);
      console.log(`[Client] Successfully uploaded HTML export: ${uploadData.url}`);

    } catch (err) {
      console.error('Error generating and exporting HTML:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">

        <div className="bg-gray-900/50 p-6 rounded-lg mb-8">

          <div className="mb-4">
            <label htmlFor="bookId" className="block text-sm font-medium text-gray-400 mb-1">
              Book ID
            </label>
            <div className="flex gap-4">
              <input
                type="text"
                id="bookId"
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
                placeholder="Enter book ID (UUID)"
                className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-md border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                onClick={() => handleShowBookData()}
                disabled={isLoading || !bookId.trim()}
                className={`flex items-center justify-center px-6 py-2 rounded-md ${isLoading || !bookId.trim() ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {isLoading && processingType === 'viewBookData' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                    {startTime && (
                      <span className="ml-2 text-xs">
                        ({Math.floor((new Date().getTime() - startTime.getTime()) / 60000)}m {Math.floor(((new Date().getTime() - startTime.getTime()) % 60000) / 1000)}s)
                      </span>
                    )}
                  </>
                ) : (
                  'Load Book Data'
                )}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Enter the UUID of the book to view its data
            </p>
          </div>

          {error && (
            <div className="mt-4 bg-red-900/25 border border-red-800/50 p-4 rounded-md">
              <h3 className="font-semibold text-red-400 mb-2">Error</h3>
              <p className="text-red-200">{error}</p>
            </div>
          )}
        </div>

        {result && result.book && (
          <div className="mb-8" id="bookDataViewer">
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-medium text-blue-300 mb-4">{result.book.title}</h2>
                  <p className="text-gray-400 mb-1">
                    <span className="font-medium">Author:</span> {result.book.author || 'Unknown'}
                  </p>
                  <p className="text-gray-400 mb-1">
                    <span className="font-medium">Book ID:</span> {result.book.id}
                  </p>
                </div>

                <button
                  onClick={handleGenerateAndExportHtml}
                  disabled={generating}
                  className={`flex items-center justify-center px-4 py-2 rounded-md ${generating ? 'opacity-60 cursor-not-allowed bg-gray-700 text-gray-300' : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                >
                  {generating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating HTML...
                    </>
                  ) : (
                    'Export as HTML'
                  )}
                </button>
              </div>

              {exportUrl && (
                <div className="mt-6 bg-green-900/20 border border-green-800/30 p-4 rounded-md">
                  <h3 className="font-medium text-green-300 mb-2">Export Successful!</h3>
                  <p className="text-gray-300 mb-3">Your book data has been exported as an HTML file.</p>
                  <div className="flex items-center">
                    <a
                      href={exportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center px-4 py-2 rounded-md bg-green-700 hover:bg-green-800 text-white"
                    >
                      Open HTML File
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col lg:flex-row gap-8 flex-wrap">
              <div className="w-full lg:w-1/4">
                <div className="bg-gray-900/80 rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-medium text-purple-300 mb-4">Key Concepts ({result.concept_count})</h3>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {result.concepts && result.concepts.length > 0 ? (
                      result.concepts.map((concept, index) => {
                        const typedConcept = concept as KeyConcept;
                        return (
                          <div key={index} className="bg-gray-800 p-4 rounded-md">
                            <h4 className="font-medium text-purple-200 mb-2">{typedConcept.concept}</h4>
                            <p className="text-gray-300 text-sm">{typedConcept.description}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-400 italic">No concepts available</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-1/4">
                <div className="bg-gray-900/80 rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-medium text-green-300 mb-4">Characters ({result.character_count})</h3>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {result.character_profiles && result.character_profiles.length > 0 ? (
                      result.character_profiles.map((profile, index) => {
                        const typedProfile = profile as CharacterProfile;
                        return (
                          <div key={index} className="bg-gray-800 p-4 rounded-md">
                            <h4 className="font-medium text-green-200 mb-2">{typedProfile.character_name}</h4>
                            <div
                              className="text-gray-300 text-sm"
                              dangerouslySetInnerHTML={{
                                __html: formatCharacterProfile(typedProfile.character_profile)
                              }}
                            />
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-400 italic">No character profiles available</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-1/4">
                <div className="bg-gray-900/80 rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-medium text-amber-300 mb-4">Opening Lines ({result.line_count})</h3>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {result.opening_lines && result.opening_lines.length > 0 ? (
                      result.opening_lines.map((line, index) => {
                        const typedLine = line as OpeningLine;
                        return (
                          <div key={index} className="bg-gray-800 p-4 rounded-md">
                            <h4 className="font-medium text-amber-200 mb-2">
                              {typedLine.character_name}
                              {typedLine.type && <span className="ml-2 text-xs text-gray-400">({typedLine.type})</span>}
                            </h4>
                            <blockquote className="border-l-4 border-amber-700 pl-4 py-1 italic">
                              {typedLine.opening_line}
                            </blockquote>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-400 italic">No opening lines available</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-1/4">
                <div className="bg-gray-900/80 rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-medium text-blue-300 mb-4">Quests ({result.quest_count})</h3>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {result.quests && result.quests.length > 0 ? (
                      result.quests.map((quest, index) => {
                        const typedQuest = quest as Quest;
                        return (
                          <div key={index} className="bg-gray-800 p-4 rounded-md">
                            <h4 className="font-medium text-blue-200 mb-2">
                              {typedQuest.quest_title}
                              <span className="ml-2 text-xs text-gray-400">(Ch {typedQuest.chapter_number})</span>
                            </h4>
                            <p className="text-gray-300 text-sm mb-2"><span className="font-medium text-blue-300">Introduction:</span> {typedQuest.introduction}</p>
                            <p className="text-gray-300 text-sm mb-2"><span className="font-medium text-blue-300">Challenge:</span> {typedQuest.challenge}</p>
                            <p className="text-gray-300 text-sm mb-2"><span className="font-medium text-blue-300">Reward:</span> {typedQuest.reward}</p>
                            <p className="text-gray-300 text-sm font-medium text-blue-300">Starting Question:</p>
                            <blockquote className="border-l-4 border-blue-700 pl-4 py-1 italic text-gray-300 text-sm">
                              {typedQuest.starting_question}
                            </blockquote>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-400 italic">No quests available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format character profiles nicely
function formatCharacterProfile(profile: string): string {
  if (!profile) return '';

  // Handle both inline bold format (**SECTION:**) and older format on separate lines
  if (profile.includes('**')) {
    // New format: process markdown-style bold section headers
    return profile.replace(/\*\*(IDENTITY|PSYCHOLOGY|COMMUNICATION|RELATIONSHIPS|CHARACTER ARC|THEMATIC SIGNIFICANCE|RESPONSE PATTERNS|KNOWLEDGE BOUNDARIES):\*\*/gi,
      (match, section) => `<div class="font-medium text-green-300 mt-3 mb-1">${section}:</div>`);
  } else {
    // Legacy format: split by double newlines and format
    let formattedProfile = '';
    const parts = profile.split(/(\n\s*\n)/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // Check if this part is a section header
      if (part.match(/^(IDENTITY|PSYCHOLOGY|COMMUNICATION|RELATIONSHIPS|CHARACTER ARC|THEMATIC SIGNIFICANCE|RESPONSE PATTERNS|KNOWLEDGE BOUNDARIES)/i)) {
        formattedProfile += `<div class="font-medium text-green-300 mt-3 mb-1">${part}</div>`;
      } else if (part.match(/\n\s*\n/)) {
        // Line break
        formattedProfile += '<br>';
      } else {
        // Regular paragraph
        formattedProfile += `<p class="mb-2">${part}</p>`;
      }
    }

    return formattedProfile;
  }
}

// Helper function to generate HTML content for book data export
function generateStandaloneHtml(data: {
  book: { title: string; id: string; author?: string };
  concepts: Array<KeyConcept> | unknown[];
  character_profiles: Array<CharacterProfile> | unknown[];
  opening_lines: Array<OpeningLine> | unknown[];
  quests?: Array<Quest> | unknown[];
}): string {
  // Extract book data
  const { book } = data;

  // Count the items
  const conceptsCount = Array.isArray(data.concepts) ? data.concepts.length : 0;
  const profilesCount = Array.isArray(data.character_profiles) ? data.character_profiles.length : 0;
  const linesCount = Array.isArray(data.opening_lines) ? data.opening_lines.length : 0;
  const questsCount = Array.isArray(data.quests) ? data.quests.length : 0;

  // Generate HTML string with inline script for interactive features
  let html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += '  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n';
  html += `  <title>Book Export: ${book.title}</title>\n`;
  html += '  <style>\n';
  html += '    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; max-width: 1100px; margin: 0 auto; padding: 30px 20px; color: #333; }\n';
  html += '    .section { margin-bottom: 3rem; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }\n';
  html += '    h1 { font-size: 2.5rem; color: #2c3e50; margin-bottom: 1rem; }\n';
  html += '    h2 { font-size: 1.8rem; color: #3498db; margin: 0 0 1.5rem; padding-bottom: 0.5rem; border-bottom: 2px solid #eee; }\n';
  html += '    h3 { font-size: 1.3rem; color: #2c3e50; margin: 1.2rem 0 0.8rem; }\n';
  html += '    .meta { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 2rem; }\n';
  html += '    .meta p { margin: 0.5rem 0; }\n';
  html += '    .concept, .character-profile, .opening-line { margin-bottom: 1.8rem; padding-bottom: 1.8rem; border-bottom: 1px solid #eee; }\n';
  html += '    .concept:last-child, .character-profile:last-child, .opening-line:last-child { border-bottom: none; }\n';
  html += '    .section-nav { background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 2rem; text-align: center; }\n';
  html += '    .section-nav a { color: #3498db; text-decoration: none; padding: 5px 10px; font-weight: 500; }\n';
  html += '    .section-nav a:hover { text-decoration: underline; }\n';
  html += '    blockquote { border-left: 4px solid #3498db; margin: 0; padding: 0.5rem 0 0.5rem 1rem; font-style: italic; background-color: #f8f9fa; }\n';
  html += '    .profile-section { font-weight: bold; color: #2c3e50; margin-top: 1rem; margin-bottom: 0.5rem; }\n';
  html += '    .footer { text-align: center; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; color: #7f8c8d; font-size: 0.9rem; }\n';
  html += '    @media (max-width: 768px) { body { padding: 15px 10px; } .section { padding: 1rem; } }\n';
  html += '    .search-box { margin-bottom: 20px; padding: 10px; background-color: #f8f9fa; border-radius: 6px; }\n';
  html += '    .search-box input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }\n';
  html += '    .highlight { background-color: yellow; }\n';
  html += '    .item-hidden { display: none; }\n';
  html += '  </style>\n';
  html += '</head>\n<body>\n';

  // Book header
  html += `  <h1>${book.title}</h1>\n`;
  html += '  <div class="meta">\n';
  html += `    <p><strong>Book ID:</strong> ${book.id}</p>\n`;
  if (book.author) {
    html += `    <p><strong>Author:</strong> ${book.author}</p>\n`;
  }
  html += `    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>\n`;
  html += `    <p><strong>Key Concepts:</strong> ${conceptsCount}</p>\n`;
  html += `    <p><strong>Character Profiles:</strong> ${profilesCount}</p>\n`;
  html += `    <p><strong>Opening Lines:</strong> ${linesCount}</p>\n`;
  html += `    <p><strong>Educational Quests:</strong> ${questsCount}</p>\n`;
  html += '  </div>\n\n';

  // Add search box
  html += '  <div class="search-box">\n';
  html += '    <input type="text" id="searchInput" placeholder="Search in all content..." onkeyup="searchContent()">\n';
  html += '  </div>\n\n';

  // Navigation
  html += '  <div class="section-nav">\n';
  html += `    <a href="#concepts">Key Concepts (${conceptsCount})</a> | \n`;
  html += `    <a href="#characters">Character Profiles (${profilesCount})</a> | \n`;
  html += `    <a href="#opening-lines">Opening Lines (${linesCount})</a> | \n`;
  html += `    <a href="#quests">Educational Quests (${questsCount})</a>\n`;
  html += '  </div>\n\n';

  // Concepts section
  html += '  <div id="concepts" class="section">\n';
  html += `    <h2>Key Concepts (${conceptsCount})</h2>\n`;

  if (Array.isArray(data.concepts) && data.concepts.length > 0) {
    data.concepts.forEach((concept, index) => {
      const typedConcept = concept as KeyConcept;
      html += `    <div class="concept" id="concept-${index}">\n`;
      html += `      <h3>${typedConcept.concept}</h3>\n`;
      html += `      <p>${typedConcept.description}</p>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No concepts available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Character profiles section
  html += '  <div id="characters" class="section">\n';
  html += `    <h2>Character Profiles (${profilesCount})</h2>\n`;

  if (Array.isArray(data.character_profiles) && data.character_profiles.length > 0) {
    data.character_profiles.forEach((profile, index) => {
      const typedProfile = profile as CharacterProfile;
      html += `    <div class="character-profile" id="profile-${index}">\n`;
      html += `      <h3>${typedProfile.character_name}</h3>\n`;
      html += `      <div>${formatCharacterProfileForExport(typedProfile.character_profile)}</div>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No character profiles available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Opening lines section
  html += '  <div id="opening-lines" class="section">\n';
  html += `    <h2>Opening Lines (${linesCount})</h2>\n`;

  if (Array.isArray(data.opening_lines) && data.opening_lines.length > 0) {
    data.opening_lines.forEach((line, index) => {
      const typedLine = line as OpeningLine;
      html += `    <div class="opening-line" id="line-${index}">\n`;
      html += `      <h3>${typedLine.character_name}${typedLine.type ? ` (${typedLine.type})` : ''}</h3>\n`;
      html += `      <blockquote>"${typedLine.opening_line}"</blockquote>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No opening lines available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Quests section
  html += '  <div id="quests" class="section">\n';
  html += `    <h2>Educational Quests (${questsCount})</h2>\n`;

  if (Array.isArray(data.quests) && data.quests.length > 0) {
    data.quests.forEach((quest, index) => {
      const typedQuest = quest as Quest;
      html += `    <div class="quest" id="quest-${index}">\n`;
      html += `      <h3>${typedQuest.quest_title} <span style="font-size: 0.8rem; color: #666;">(Chapter ${typedQuest.chapter_number}: ${typedQuest.chapter_title})</span></h3>\n`;
      html += `      <p><strong>Introduction:</strong> ${typedQuest.introduction}</p>\n`;
      html += `      <p><strong>Challenge:</strong> ${typedQuest.challenge}</p>\n`;
      html += `      <p><strong>Reward:</strong> ${typedQuest.reward}</p>\n`;
      html += `      <p><strong>Starting Question:</strong></p>\n`;
      html += `      <blockquote>${typedQuest.starting_question}</blockquote>\n`;
      html += '    </div>\n';
    });
  } else {
    html += '    <p>No educational quests available for this book.</p>\n';
  }
  html += '  </div>\n\n';

  // Footer
  html += '  <div class="footer">\n';
  html += `    <p>Generated by RiseTwice on ${new Date().toLocaleString()}</p>\n`;
  html += '    <p>This is a standalone HTML file that can be opened directly in your browser.</p>\n';
  html += '  </div>\n';

  // Add search script
  html += '  <script>\n';
  html += '    function searchContent() {\n';
  html += '      const searchInput = document.getElementById("searchInput");\n';
  html += '      const filter = searchInput.value.toUpperCase();\n';
  html += '      const concepts = document.querySelectorAll(".concept");\n';
  html += '      const profiles = document.querySelectorAll(".character-profile");\n';
  html += '      const lines = document.querySelectorAll(".opening-line");\n';
  html += '      const quests = document.querySelectorAll(".quest");\n';
  html += '      let totalVisible = 0;\n';
  html += '\n';
  html += '      // Clear previous highlights\n';
  html += '      document.querySelectorAll(".highlight").forEach(el => {\n';
  html += '        el.outerHTML = el.innerHTML;\n';
  html += '      });\n';
  html += '\n';
  html += '      // Helper function to check and highlight text\n';
  html += '      function checkAndHighlight(element) {\n';
  html += '        const text = element.innerText.toUpperCase();\n';
  html += '        if (filter && text.includes(filter)) {\n';
  html += '          element.classList.remove("item-hidden");\n';
  html += '          totalVisible++;\n';
  html += '\n';
  html += '          // Highlight matching text\n';
  html += '          if (filter.length > 2) { // Only highlight for searches with 3+ chars\n';
  html += '            const html = element.innerHTML;\n';
  html += '            const regex = new RegExp(filter, "gi");\n';
  html += '            element.innerHTML = html.replace(regex, match => `<span class="highlight">${match}</span>`);\n';
  html += '          }\n';
  html += '          return true;\n';
  html += '        } else if (!filter) {\n';
  html += '          element.classList.remove("item-hidden");\n';
  html += '          totalVisible++;\n';
  html += '          return true;\n';
  html += '        } else {\n';
  html += '          element.classList.add("item-hidden");\n';
  html += '          return false;\n';
  html += '        }\n';
  html += '      }\n';
  html += '\n';
  html += '      // Search in concepts\n';
  html += '      concepts.forEach(concept => {\n';
  html += '        checkAndHighlight(concept);\n';
  html += '      });\n';
  html += '\n';
  html += '      // Search in profiles\n';
  html += '      profiles.forEach(profile => {\n';
  html += '        checkAndHighlight(profile);\n';
  html += '      });\n';
  html += '\n';
  html += '      // Search in opening lines\n';
  html += '      lines.forEach(line => {\n';
  html += '        checkAndHighlight(line);\n';
  html += '      });\n';
  html += '\n';
  html += '      // Search in quests\n';
  html += '      quests.forEach(quest => {\n';
  html += '        checkAndHighlight(quest);\n';
  html += '      });\n';
  html += '    }\n';
  html += '  </script>\n';
  html += '</body>\n</html>';

  return html;
}

// Helper function to format character profiles for HTML export
function formatCharacterProfileForExport(profile: string): string {
  if (!profile) return '';

  // Handle both inline bold format (**SECTION:**) and older format on separate lines
  if (profile.includes('**')) {
    // New format: process markdown-style bold section headers
    return profile.replace(/\*\*(IDENTITY|PSYCHOLOGY|COMMUNICATION|RELATIONSHIPS|CHARACTER ARC|THEMATIC SIGNIFICANCE|RESPONSE PATTERNS|KNOWLEDGE BOUNDARIES):\*\*/gi,
      (match, section) => `<div class="profile-section">${section}:</div>`);
  } else {
    // Legacy format: split by double newlines and format
    let formattedProfile = '';
    const parts = profile.split(/(\n\s*\n)/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      // Check if this part is a section header
      if (part.match(/^(IDENTITY|PSYCHOLOGY|COMMUNICATION|RELATIONSHIPS|CHARACTER ARC|THEMATIC SIGNIFICANCE|RESPONSE PATTERNS|KNOWLEDGE BOUNDARIES)/i)) {
        formattedProfile += `<div class="profile-section">${part}</div>`;
      } else if (part.match(/\n\s*\n/)) {
        // Line break
        formattedProfile += '<br>';
      } else {
        // Regular paragraph
        formattedProfile += `<p>${part}</p>`;
      }
    }

    return formattedProfile;
  }
}