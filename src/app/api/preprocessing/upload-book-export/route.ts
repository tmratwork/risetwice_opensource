import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Upload-Book-Export][${requestId}]`;
  
  console.log(`${logPrefix} === STARTING BOOK EXPORT UPLOAD ===`);
  
  try {
    // Parse request body
    const body = await req.json();
    const { book_id, filename, html_content } = body;
    
    if (!book_id || !filename || !html_content) {
      return NextResponse.json({ error: 'Book ID, filename and HTML content are required' }, { status: 400 });
    }
    
    console.log(`${logPrefix} Processing book export for book ID: ${book_id}, filename: ${filename}`);
    console.log(`${logPrefix} HTML content length: ${html_content.length} characters`);
    
    // Validate HTML content has proper structure
    if (!html_content.includes('<!DOCTYPE html>') || !html_content.includes('</html>')) {
      console.warn(`${logPrefix} Warning: HTML content may not be properly formatted.`);
    }
    
    // Create a timestamp and random string for uniqueness
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    
    // Create a simplified filename that's still unique enough
    const sanitizedBookId = book_id.substring(0, 8); // Just use first 8 characters of UUID
    const uniqueFilename = `${sanitizedBookId}_book_export_${book_id}_${timestamp}_${randomString}_${new Date().toISOString().split('T')[0].replace(/-/g, '-')}.html`;
    
    // Create blob from HTML content
    const blob = new Blob([html_content], { type: 'text/html' });
    
    // Upload to Supabase Storage with explicit content type
    const { data, error } = await supabase
      .storage
      .from('book-exports')
      .upload(uniqueFilename, blob, {
        contentType: 'text/html; charset=utf-8',
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error(`${logPrefix} Error uploading to Supabase:`, error);
      throw new Error(`Error uploading to Supabase: ${error.message}`);
    }
    
    // Get the public URL from Supabase
    const { data: publicUrlData } = supabase
      .storage
      .from('book-exports')
      .getPublicUrl(uniqueFilename);
    
    const publicUrl = publicUrlData.publicUrl;
    
    // Note: Bucket configuration is now handled through the Supabase dashboard
    // The API has changed and updateBucket is no longer available
    // Bucket should be pre-configured as public with appropriate settings
    console.log(`${logPrefix} Using pre-configured bucket 'book-exports' for HTML file storage`);
    
    // Set expiration info (purely for UI purposes)
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30); // 30 days
    
    console.log(`${logPrefix} ========== BOOK EXPORT UPLOAD COMPLETE ==========`);
    console.log(`${logPrefix} Book ID: ${book_id}`);
    console.log(`${logPrefix} Filename: ${uniqueFilename}`);
    console.log(`${logPrefix} Storage Path: ${data?.path || 'unknown'}`);
    console.log(`${logPrefix} Public URL: ${publicUrl}`);
    console.log(`${logPrefix} HTML Content Size: ${(html_content.length / 1024).toFixed(2)} KB`);
    console.log(`${logPrefix} =======================================`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully saved book export to Supabase Storage`,
      url: publicUrl,
      path: data?.path,
      expires: expireDate.toISOString(), // This is just for show
      content_size_kb: (html_content.length / 1024).toFixed(2)
    });
    
  } catch (error) {
    console.error(`[Upload-Book-Export][${requestId}] Error processing book export:`, error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}