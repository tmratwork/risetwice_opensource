const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCircles() {
  console.log('Checking circles table in Supabase...');
  console.log('=' .repeat(80));
  
  // Get all circles
  const { data: circles, error } = await supabase
    .from('circles')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching circles:', error);
    return;
  }
  
  if (circles && circles.length > 0) {
    console.log(`Found ${circles.length} circles\n`);
    
    // Check first circle in detail
    const firstCircle = circles[0];
    console.log('First Circle Details:');
    console.log('-'.repeat(40));
    Object.entries(firstCircle).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('Summary of ALL circles:');
    console.log('-'.repeat(40));
    
    circles.forEach(circle => {
      console.log(`\nCircle: "${circle.display_name}"`);
      console.log(`  ID: ${circle.id}`);
      console.log(`  requires_approval: ${circle.requires_approval}`);
      console.log(`  is_private: ${circle.is_private}`);
      console.log(`  member_count: ${circle.member_count}`);
    });
    
    // Check if requires_approval field exists
    console.log('\n' + '='.repeat(80));
    console.log('Field Analysis:');
    const hasRequiresApproval = 'requires_approval' in firstCircle;
    console.log(`  'requires_approval' field exists: ${hasRequiresApproval}`);
    if (hasRequiresApproval) {
      const approvalValues = circles.map(c => c.requires_approval);
      console.log(`  Values found: ${[...new Set(approvalValues)].join(', ')}`);
      console.log(`  Circles requiring approval: ${circles.filter(c => c.requires_approval === true).length}`);
      console.log(`  Circles NOT requiring approval: ${circles.filter(c => c.requires_approval !== true).length}`);
    }
  } else {
    console.log('No circles found in database');
  }
  
  process.exit(0);
}

checkCircles().catch(console.error);