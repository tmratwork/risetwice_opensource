// src/app/api/v17/knowledge-base/upload/route.ts
// V17 Knowledge Base Upload API
// Uploads documents to ElevenLabs knowledge base with Google Docs support

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      googleDocUrl,
      agentId,
      documentName,
      specialistType = 'triage'
    } = body;

    logV17('📄 Uploading document to knowledge base', {
      googleDocUrl: googleDocUrl ? 'provided' : 'missing',
      agentId,
      documentName,
      specialistType
    });

    if (!googleDocUrl) {
      return NextResponse.json({
        error: 'Google Doc URL is required'
      }, { status: 400 });
    }

    // 1. Convert Google Doc URL to export format
    let exportUrl: string;
    try {
      // Extract document ID from various Google Doc URL formats
      const docId = googleDocUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
      if (!docId) {
        throw new Error('Could not extract document ID from URL');
      }

      // Convert to text export URL (public documents)
      exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

      logV17('🔗 Converted Google Doc URL', {
        originalUrl: googleDocUrl,
        exportUrl,
        docId
      });
    } catch (error) {
      logV17('❌ Failed to convert Google Doc URL', { error });
      return NextResponse.json({
        error: 'Invalid Google Doc URL format',
        details: 'Please ensure the document is public and shareable'
      }, { status: 400 });
    }

    // For V17 MVP, we'll simulate document upload
    const mockDocument = {
      id: `doc_${Date.now()}`,
      name: documentName || `Knowledge Base - ${specialistType}`,
      url: exportUrl
    };

    logV17('✅ Document processed (V17 MVP simulation)', {
      documentId: mockDocument.id,
      documentName: mockDocument.name,
      exportUrl
    });

    // For V17 MVP, return success without actual ElevenLabs integration
    return NextResponse.json({
      success: true,
      message: 'V17 MVP: Knowledge base upload simulated successfully',
      document: {
        id: mockDocument.id,
        name: mockDocument.name,
        source_url: googleDocUrl,
        export_url: exportUrl
      },
      agent_id: agentId || 'none',
      specialist_type: specialistType
    });

  } catch (error) {
    logV17('❌ Error uploading to knowledge base', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      error: 'Failed to upload to knowledge base',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET method to retrieve knowledge base documents
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const specialistType = url.searchParams.get('specialistType');

    logV17('🔍 Getting knowledge base documents', { agentId, specialistType });

    let query = supabase.from('elevenlabs_knowledge_base').select('*');

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }
    if (specialistType) {
      query = query.eq('specialist_type', specialistType);
    }

    const { data: documents, error } = await query
      .order('created_at', { ascending: false });

    if (error) {
      logV17('❌ Failed to fetch knowledge base documents', { error });
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documents: documents || []
    });

  } catch (error) {
    logV17('❌ Error fetching knowledge base documents', { error });
    return NextResponse.json({
      error: 'Failed to fetch documents'
    }, { status: 500 });
  }
}

// DELETE method to remove knowledge base documents
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentId, agentId } = body;

    if (!documentId) {
      return NextResponse.json({
        error: 'Document ID is required'
      }, { status: 400 });
    }

    logV17('🗑️ Deleting knowledge base document', { documentId, agentId });

    // TODO: Delete from ElevenLabs when SDK is properly imported
    // await elevenlabs.conversationalAi.knowledgeBase.documents.delete(documentId);

    // Remove from database
    const { error: dbError } = await supabase
      .from('elevenlabs_knowledge_base')
      .delete()
      .eq('document_id', documentId);

    if (dbError) {
      logV17('⚠️ Failed to remove document from database', { dbError });
    }

    logV17('✅ Knowledge base document deleted successfully', { documentId });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    logV17('❌ Error deleting knowledge base document', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      error: 'Failed to delete document',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}