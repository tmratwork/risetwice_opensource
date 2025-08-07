// src/tools/chunk_book.mjs
/**
 * Section Detector Tool
 * 
 * This script analyzes a book's content to detect section and chapter patterns
 * for potential chunking. It helps identify natural breakpoints in the text.
 * 
 * Usage:
 * node src/tools/chunk_book.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const BOOK_CONTENT_PATH = path.join(__dirname, 'complete_book.txt');

// Regular expressions for detecting structure
const SECTION_REGEX = /^Section\s+(\d+)\s+(.+)$/;
const CHAPTER_REGEX = /^Chapter\s+(\d+)\s+(.+)$/;
const POSSIBLE_SUBSECTION_REGEX = /^([A-Z][a-z]+(\s+[a-z]+){0,3})$/; // Potential subsection headers

// Helper function to format size in KB with 1 decimal place
function formatKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

async function main() {
  console.log(`[BookChunker] Starting book structure analysis...`);
  
  try {
    // Check if the content file exists
    if (!fs.existsSync(BOOK_CONTENT_PATH)) {
      throw new Error(`Content file not found: ${BOOK_CONTENT_PATH}`);
    }
    
    // Read file content
    const content = fs.readFileSync(BOOK_CONTENT_PATH, 'utf8');
    const lines = content.split('\n');
    
    console.log(`[BookChunker] Successfully read ${formatKB(content.length)} (${lines.length} lines)`);
    
    // Find all section headers
    const sections = [];
    const chapters = [];
    const possibleSubsections = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for section headers
      const sectionMatch = line.match(SECTION_REGEX);
      if (sectionMatch) {
        sections.push({
          lineNumber: i + 1,
          sectionNumber: sectionMatch[1],
          title: sectionMatch[2],
          line: line
        });
        continue;
      }
      
      // Check for chapter headers
      const chapterMatch = line.match(CHAPTER_REGEX);
      if (chapterMatch) {
        chapters.push({
          lineNumber: i + 1,
          chapterNumber: chapterMatch[1],
          title: chapterMatch[2],
          line: line
        });
        continue;
      }
      
      // Check for possible subsections (for analysis purposes)
      if (line.length > 0 && line.length < 50) {
        const subsectionMatch = line.match(POSSIBLE_SUBSECTION_REGEX);
        if (subsectionMatch && !line.includes(':')) {
          possibleSubsections.push({
            lineNumber: i + 1,
            title: line,
            context: lines.slice(Math.max(0, i-1), Math.min(lines.length, i+2)).join(' | ')
          });
        }
      }
    }
    
    // Calculate section sizes
    const sectionSizes = [];
    for (let i = 0; i < sections.length; i++) {
      const currentSection = sections[i];
      const nextSection = sections[i + 1];
      
      const startLine = currentSection.lineNumber;
      const endLine = nextSection ? nextSection.lineNumber - 1 : lines.length;
      
      const sectionContent = lines.slice(startLine - 1, endLine).join('\n');
      const sectionWords = sectionContent.split(/\s+/).length;
      const sectionChars = sectionContent.length;
      
      sectionSizes.push({
        section: currentSection.sectionNumber,
        title: currentSection.title,
        lines: endLine - startLine + 1,
        words: sectionWords,
        characters: sectionChars,
        sizeKB: formatKB(sectionChars)
      });
    }
    
    // Find chapters per section and calculate chapter sizes
    const chaptersPerSection = [];
    const chapterSizes = [];
    let currentSectionIndex = 0;
    
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const nextChapter = chapters[i + 1];
      
      // Determine which section this chapter belongs to
      while (
        currentSectionIndex < sections.length - 1 && 
        chapter.lineNumber >= sections[currentSectionIndex + 1].lineNumber
      ) {
        currentSectionIndex++;
      }
      
      const sectionNumber = currentSectionIndex < sections.length ? 
        sections[currentSectionIndex].sectionNumber : 'unknown';
      
      // Add to chapters per section list
      chaptersPerSection.push({
        chapter: chapter.chapterNumber,
        title: chapter.title,
        section: sectionNumber
      });
      
      // Calculate chapter size
      const startLine = chapter.lineNumber;
      let endLine;
      
      if (nextChapter) {
        // If there's a next chapter, end at the line before it
        endLine = nextChapter.lineNumber - 1;
      } else if (currentSectionIndex < sections.length - 1) {
        // If this is the last chapter in section, end at the next section
        endLine = sections[currentSectionIndex + 1].lineNumber - 1;
      } else {
        // If this is the last chapter in the book, end at the last line
        endLine = lines.length;
      }
      
      const chapterContent = lines.slice(startLine - 1, endLine).join('\n');
      const chapterWords = chapterContent.split(/\s+/).length;
      const chapterChars = chapterContent.length;
      
      chapterSizes.push({
        chapter: chapter.chapterNumber,
        title: chapter.title,
        section: sectionNumber,
        lines: endLine - startLine + 1,
        words: chapterWords,
        characters: chapterChars,
        sizeKB: formatKB(chapterChars)
      });
    }
    
    // Output results
    console.log('\n=== SECTION ANALYSIS ===');
    console.log(`Found ${sections.length} sections in the book:`);
    
    sections.forEach(section => {
      console.log(`- Section ${section.sectionNumber}: ${section.title} (Line ${section.lineNumber})`);
    });
    
    console.log('\n=== SECTION SIZES ===');
    sectionSizes.forEach(size => {
      console.log(`- Section ${size.section}: ${size.lines} lines, ~${size.words} words, ${size.sizeKB}`);
    });
    
    console.log('\n=== CHAPTER ANALYSIS ===');
    console.log(`Found ${chapters.length} chapters in the book`);
    
    console.log('\n=== CHAPTER SIZES ===');
    chapterSizes.forEach(size => {
      console.log(`- Chapter ${size.chapter} (Section ${size.section}): ${size.lines} lines, ${size.sizeKB}`);
    });
    
    console.log('\n=== CHAPTERS PER SECTION ===');
    let prevSection = null;
    chaptersPerSection.forEach(chapter => {
      if (prevSection !== chapter.section) {
        console.log(`\nSection ${chapter.section}:`);
        prevSection = chapter.section;
      }
      
      // Find size info for this chapter
      const sizeInfo = chapterSizes.find(s => s.chapter === chapter.chapter && s.section === chapter.section);
      const sizeText = sizeInfo ? ` (${sizeInfo.sizeKB})` : '';
      
      console.log(`- Chapter ${chapter.chapter}: ${chapter.title}${sizeText}`);
    });
    
    console.log('\n=== CHUNKING RECOMMENDATION ===');
    console.log('Based on the analysis, the book can be chunked in these ways:');
    console.log('1. By Section - Creates large chunks based on major topic areas');
    console.log('2. By Chapter - Creates medium-sized chunks for more granular processing');
    console.log('3. Hybrid Approach - Use sections as the main divisions with chapters as sub-chunks');
    
    // Calculate average sizes
    const totalSectionChars = sectionSizes.reduce((sum, size) => sum + size.characters, 0);
    const totalChapterChars = chapterSizes.reduce((sum, size) => sum + size.characters, 0);
    
    const averageSectionSizeKB = (totalSectionChars / sectionSizes.length / 1024).toFixed(1);
    const averageChapterSizeKB = (totalChapterChars / chapterSizes.length / 1024).toFixed(1);
    
    console.log(`\nAverage section size: ${averageSectionSizeKB} KB`);
    console.log(`Average chapter size: ${averageChapterSizeKB} KB`);
    
    // Token estimates (rough approximation: 1 token ≈ 4 characters)
    const avgSectionTokens = Math.round(totalSectionChars / sectionSizes.length / 4);
    const avgChapterTokens = Math.round(totalChapterChars / chapterSizes.length / 4);
    
    console.log(`\nEstimated average tokens per section: ~${avgSectionTokens} tokens`);
    console.log(`Estimated average tokens per chapter: ~${avgChapterTokens} tokens`);
    
    // Recommendations based on token limits for common embedding models
    if (avgSectionTokens > 8000) {
      console.log('\nRECOMMENDATION: Sections exceed 8K tokens (common embedding model limit).');
      console.log('Consider chunking by chapters for better processing.');
    } else if (avgSectionTokens > 4000) {
      console.log('\nRECOMMENDATION: Sections average 4K-8K tokens.');
      console.log('Consider chunking by sections for models with 8K+ token limits (e.g., text-embedding-3-large).');
      console.log('For models with 4K token limits, use chapter-based chunking.');
    } else {
      console.log('\nRECOMMENDATION: Sections are under 4K tokens on average.');
      console.log('Chunking by section should work well for most embedding models.');
    }
    
    // Identify any outliers (very large chapters/sections)
    const largeChapters = chapterSizes.filter(c => c.characters > 50000);
    const largeSections = sectionSizes.filter(s => s.characters > 200000);
    
    if (largeChapters.length > 0) {
      console.log('\n⚠️ OUTLIER WARNING: Some chapters are exceptionally large:');
      largeChapters.forEach(c => {
        console.log(`- Chapter ${c.chapter} (Section ${c.section}): ${c.sizeKB}`);
      });
      console.log('These chapters may need to be further subdivided.');
    }
    
    if (largeSections.length > 0) {
      console.log('\n⚠️ OUTLIER WARNING: Some sections are exceptionally large:');
      largeSections.forEach(s => {
        console.log(`- Section ${s.section}: ${s.sizeKB}`);
      });
      console.log('Consider using chapter-based chunking for these sections.');
    }
    
    // Write analysis to a report file
    const reportPath = path.join(__dirname, 'book_structure_analysis.json');
    const report = {
      bookPath: BOOK_CONTENT_PATH,
      totalLines: lines.length,
      totalCharacters: content.length,
      totalSizeKB: formatKB(content.length),
      averageSectionSizeKB,
      averageChapterSizeKB,
      sections,
      sectionSizes,
      chapters,
      chapterSizes,
      chaptersPerSection,
      possibleSubsections: possibleSubsections.slice(0, 20) // Just include a sample
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n[BookChunker] Full analysis saved to: ${reportPath}`);
    
  } catch (error) {
    console.error(`[BookChunker] ❌ Error:`, error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch(err => {
  console.error(`[BookChunker] Unhandled error:`, err.message);
  process.exit(1);
});