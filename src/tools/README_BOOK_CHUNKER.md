# Book Structure Analysis Tool

This tool analyzes a book's content structure to help determine the best approach for chunking the text for further processing.

## Purpose

When processing large texts for embedding or other NLP tasks, it's often necessary to break the content into smaller, semantically meaningful chunks. This tool helps by:

1. Identifying natural section and chapter boundaries in the book
2. Calculating the size of each section
3. Analyzing the distribution of chapters across sections
4. Providing recommendations on the best chunking strategy

## Usage

1. Ensure your book content is available at:
   ```
   /Users/tmr/github/living_books/src/tools/complete_book.txt
   ```

2. Run the analysis tool:
   ```
   cd /Users/tmr/github/living_books
   node src/tools/chunk_book.mjs
   ```

3. Review the console output for a summary of the book structure
4. For detailed analysis, check the generated JSON report at:
   ```
   /Users/tmr/github/living_books/src/tools/book_structure_analysis.json
   ```

## What The Tool Detects

The tool identifies:

- **Sections**: Major divisions (e.g., "Section 1 Conceptual frameworks")
- **Chapters**: Smaller divisions within sections (e.g., "Chapter 1 Normal psychological development")
- **Potential subsections**: Possible subsection headers based on text patterns

## Chunking Strategies

Based on the analysis, you can choose from several chunking strategies:

1. **By Section**: Create large chunks based on the major sections of the book.
   - Pros: Preserves high-level context
   - Cons: May create chunks that are too large for some embedding models

2. **By Chapter**: Create medium-sized chunks based on chapters.
   - Pros: More granular, likely within token limits of most embedding models
   - Cons: May lose some cross-chapter context

3. **Hybrid Approach**: Use sections as primary divisions, then subdivide by chapter when needed.
   - Pros: Flexible, preserves context while managing size
   - Cons: More complex implementation

4. **Custom Chunking**: Use the structural information to implement custom chunking logic.
   - For example, you might merge small chapters or split very large ones

## Example Implementation

After analyzing the structure, you can create a chunking script that:

1. Reads the book content
2. Splits it at the identified section or chapter boundaries
3. Processes each chunk separately for embedding or other tasks

## Next Steps

After using this tool to understand the book's structure:

1. Review the recommended chunking strategy in the console output
2. Examine the detailed analysis in the JSON report
3. Implement your chosen chunking approach in a follow-up script