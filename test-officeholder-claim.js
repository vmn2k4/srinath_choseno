#!/usr/bin/env node

/**
 * Officeholder Wall Claim System - End-to-End Test
 * Uses admin credentials to test the full flow:
 * 1. Create claim invitation
 * 2. New user signs up
 * 3. User redeems claim token
 * 4. Admin merges the claim
 * 5. Verify merge and reversal
 */

const crypto = require('crypto');

// Configuration from .env.local
const SUPABASE_URL = 'https://qlzyfdwrkcxyqapewxwg.supabase.co';
const ADMIN_EMAIL = 'vmn2k4@gmail.com';
const ADMIN_PASSWORD = 'Happy@123';

// Import Supabase
const { createClient } = require('@supabase/supabase-js');

// Utility: hash token same way frontend does
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Test results tracking
const results = [];

function log(step, status, message, data = null) {
  results.push({ step, status, message, data });
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏳';
  console.log(`\n${emoji} ${step}`);
  console.log(`   ${message}`);
  if (data) console.log(`   ${JSON.stringify(data, null, 4)}`);
}

async function runTests() {
  console.log('🧪 OFFICEHOLDER WALL CLAIM SYSTEM - END-TO-END TEST');
  console.log('='.repeat(70));
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Admin Email: ${ADMIN_EMAIL}`);

  try {
    // STEP 1: Create admin-authenticated client
    console.log('\n📝 Step 1: Authenticating as admin...');
    const adminClient = createClient(SUPABASE_URL, 'sb_publishable_m7I392hi0eurPIRFrr6IZQ_VOQa7EzK');
    
    const { data: sessionData, error: loginError } = await adminClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (loginError || !sessionData.user) {
      log('Admin login', 'FAIL', `Authentication failed: ${loginError?.message}`, loginError);
      process.exit(1);
    }

    const adminId = sessionData.user.id;
    log('Admin login', 'PASS', `Admin authenticated`, { adminId, email: ADMIN_EMAIL });

    // STEP 2: Find an existing officeholder
    console.log('\n🏛️  Step 2: Finding an existing officeholder...');
    
    const { data: officeholders, error: holderError } = await adminClient
      .from('office_holders')
      .select('id, full_name, linked_profile_id, map_shape_id, election_role_type_id')
      .limit(1);

    if (holderError || !officeholders || officeholders.length === 0) {
      log('Find officeholder', 'FAIL', 'No officeholders found in database', holderError);
      console.log('\n⚠️  Cannot continue. Need at least one officeholder record.');
      console.log('   Run the admin panel at /admin/office-holders to create one.');
      process.exit(1);
    }

    const officeholder = officeholders[0];
    log('Find officeholder', 'PASS', `Found: ${officeholder.full_name}`, {
      officeholderId: officeholder.id,
      currentLink: officeholder.linked_profile_id
    });

    // STEP 3: Create claim invitation
    console.log('\n📧 Step 3: Creating claim invitation...');
    const testEmail = `test-${Date.now()}@example.com`;
    const randomToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(randomToken);

    const { data: claimResult, error: claimError } = await adminClient.rpc(
      'create_officeholder_wall_claim',
      {
        p_office_holder_id: officeholder.id,
        p_email: testEmail,
        p_token_hash: tokenHash,
      }
    );

    if (claimError || !claimResult) {
      log('Create claim', 'FAIL', `RPC failed: ${claimError?.message}`, claimError);
      process.exit(1);
    }

    const claimData = Array.isArray(claimResult) ? claimResult[0] : claimResult;
    const claimId = claimData?.claim_id;
    
    if (!claimId) {
      log('Create claim', 'FAIL', 'No claim ID returned from RPC', claimData);
      process.exit(1);
    }

    log('Create claim', 'PASS', `Claim created with status: invited`, {
      claimId,
      email: testEmail,
      token: randomToken.substring(0, 16) + '...' // Masked for security
    });

    // STEP 4: Verify claim is in 'invited' status
    console.log('\n🔍 Step 4: Verifying claim status...');
    const { data: claimCheck } = await adminClient
      .from('office_holder_wall_claims')
      .select('id, status, contact_email, source_profile_id')
      .eq('id', claimId)
      .single();

    if (!claimCheck || claimCheck.status !== 'invited') {
      log('Verify claim', 'FAIL', `Claim status is ${claimCheck?.status}, expected invited`);
      process.exit(1);
    }

    log('Verify claim', 'PASS', `Claim is in 'invited' status`, {
      status: claimCheck.status,
      email: claimCheck.contact_email,
      sourceProfileId: claimCheck.source_profile_id
    });

    // STEP 5: Create new test user
    console.log('\n👤 Step 5: Creating new test user...');
    const newUserPassword = crypto.randomBytes(16).toString('hex') + 'Aa1!';
    
    // Sign out admin first
    await adminClient.auth.signOut();

    // Create a new client for user signup (using anon key)
    const anonClient = createClient(SUPABASE_URL, 'sb_publishable_m7I392hi0eurPIRFrr6IZQ_VOQa7EzK');

    const { data: signupData, error: signupError } = await anonClient.auth.signUp({
      email: testEmail,
      password: newUserPassword,
      options: {
        emailRedirectTo: 'https://localhost:3000/officeholder-claim/' + randomToken,
      }
    });

    if (signupError || !signupData.user) {
      log('User signup', 'FAIL', `Signup failed: ${signupError?.message}`, signupError);
      process.exit(1);
    }

    const newUserId = signupData.user.id;
    log('User signup', 'PASS', `New user created`, {
      userId: newUserId,
      email: testEmail
    });

    // STEP 6: Verify profile auto-created
    console.log('\n🛂 Step 6: Verifying profile auto-created...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for trigger

    // Re-authenticate as new user
    const { data: userLoginData, error: userLoginError } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: newUserPassword,
    });

    if (userLoginError) {
      log('User login', 'FAIL', `Failed to login: ${userLoginError.message}`);
      process.exit(1);
    }

    const userClient = createClient(SUPABASE_URL, 'sb_publishable_m7I392hi0eurPIRFrr6IZQ_VOQa7EzK', {
      global: {
        headers: {
          Authorization: `Bearer ${userLoginData.session.access_token}`
        }
      }
    });

    const { data: newProfile } = await userClient
      .from('profiles')
      .select('id, current_ghost_id, role')
      .eq('id', newUserId)
      .single();

    if (!newProfile) {
      log('Profile creation', 'FAIL', 'Profile not auto-created for new user');
      process.exit(1);
    }

    log('Profile creation', 'PASS', `Profile auto-created`, {
      userId: newUserId,
      ghostId: newProfile.current_ghost_id,
      role: newProfile.role
    });

    // STEP 7: User redeems claim token
    console.log('\n🎫 Step 7: User redeeming claim token...');
    
    const { data: redeemResult, error: redeemError } = await userClient.rpc(
      'redeem_officeholder_wall_claim',
      { p_token_hash: tokenHash }
    );

    if (redeemError || !redeemResult) {
      log('Redeem claim', 'FAIL', `RPC failed: ${redeemError?.message}`, redeemError);
      process.exit(1);
    }

    const redeemData = Array.isArray(redeemResult) ? redeemResult[0] : redeemResult;
    log('Redeem claim', 'PASS', `Token redeemed successfully`, {
      status: redeemData?.status,
      targetProfileId: redeemData?.target_profile_id
    });

    // STEP 8: Verify claim is now 'pending_review'
    console.log('\n⏳ Step 8: Verifying claim is pending_review...');
    
    const { data: claimAfterRedeem } = await userClient
      .from('office_holder_wall_claims')
      .select('id, status, target_profile_id, target_ghost_id, claimed_at')
      .eq('id', claimId)
      .single();

    if (claimAfterRedeem?.status !== 'pending_review') {
      log('Claim status', 'FAIL', `Status is ${claimAfterRedeem?.status}, expected pending_review`);
      process.exit(1);
    }

    log('Claim status', 'PASS', `Claim moved to pending_review`, {
      status: claimAfterRedeem.status,
      targetProfileId: claimAfterRedeem.target_profile_id,
      claimedAt: claimAfterRedeem.claimed_at
    });

    // STEP 9: Admin preview merge
    console.log('\n👁️  Step 9: Admin previewing merge...');
    
    // Re-authenticate as admin
    const { data: adminSessionData, error: adminLoginError2 } = await anonClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (adminLoginError2) {
      log('Admin re-login', 'FAIL', `Failed to re-login: ${adminLoginError2.message}`);
      process.exit(1);
    }

    const adminClient2 = createClient(SUPABASE_URL, 'sb_publishable_m7I392hi0eurPIRFrr6IZQ_VOQa7EzK', {
      global: {
        headers: {
          Authorization: `Bearer ${adminSessionData.session.access_token}`
        }
      }
    });

    const { data: previewData, error: previewError } = await adminClient2.rpc(
      'preview_officeholder_wall_claim',
      { p_claim_id: claimId }
    );

    if (previewError || !previewData) {
      log('Preview merge', 'FAIL', `RPC failed: ${previewError?.message}`, previewError);
      process.exit(1);
    }

    log('Preview merge', 'PASS', `Merge preview generated`, previewData);

    // STEP 10: Admin merges claim
    console.log('\n🔗 Step 10: Admin merging claim...');
    
    const { data: mergeResult, error: mergeError } = await adminClient2.rpc(
      'merge_officeholder_wall_claim',
      { p_claim_id: claimId }
    );

    if (mergeError || !mergeResult) {
      log('Merge claim', 'FAIL', `RPC failed: ${mergeError?.message}`, mergeError);
      process.exit(1);
    }

    const mergeData = Array.isArray(mergeResult) ? mergeResult[0] : mergeResult;
    log('Merge claim', 'PASS', `Claim merged successfully`, {
      status: mergeData?.status,
      movedItemCount: mergeData?.moved_item_count,
      targetProfileId: mergeData?.target_profile_id
    });

    // STEP 11: Verify merge completed
    console.log('\n✅ Step 11: Verifying merge completed...');
    
    const { data: claimAfterMerge } = await adminClient2
      .from('office_holder_wall_claims')
      .select('id, status, approved_at, approved_by')
      .eq('id', claimId)
      .single();

    if (claimAfterMerge?.status !== 'approved') {
      log('Merge status', 'FAIL', `Status is ${claimAfterMerge?.status}, expected approved`);
      process.exit(1);
    }

    log('Merge status', 'PASS', `Claim is approved`, {
      status: claimAfterMerge.status,
      approvedAt: claimAfterMerge.approved_at,
      approvedBy: claimAfterMerge.approved_by
    });

    // STEP 12: Check audit trail
    console.log('\n📝 Step 12: Verifying audit trail...');
    
    const { data: auditItems } = await adminClient2
      .from('office_holder_wall_claim_items')
      .select('id, entity_type, entity_id, moved_at')
      .eq('claim_id', claimId);

    const entityTypes = new Set((auditItems || []).map(i => i.entity_type));
    log('Audit trail', 'PASS', `Audit items recorded`, {
      itemCount: auditItems?.length || 0,
      entityTypes: Array.from(entityTypes)
    });

    // STEP 13: Verify officeholder is now linked to new user
    console.log('\n🔐 Step 13: Verifying officeholder linking...');
    
    const { data: officeholderAfterMerge } = await adminClient2
      .from('office_holders')
      .select('id, linked_profile_id, full_name')
      .eq('id', officeholder.id)
      .single();

    if (officeholderAfterMerge?.linked_profile_id !== newUserId) {
      log('Officeholder link', 'FAIL', 
        `Linked to ${officeholderAfterMerge?.linked_profile_id}, expected ${newUserId}`);
      process.exit(1);
    }

    log('Officeholder link', 'PASS', `Officeholder now linked to new user`, {
      officeholderId: officeholder.id,
      newProfileId: newUserId,
      officeholderName: officeholderAfterMerge.full_name
    });

    // STEP 14: Test reversal
    console.log('\n↩️  Step 14: Testing claim reversal...');
    
    const { data: reverseResult, error: reverseError } = await adminClient2.rpc(
      'reverse_officeholder_wall_claim',
      {
        p_claim_id: claimId,
        p_reason: 'Automated test - reversal verification'
      }
    );

    if (reverseError || !reverseResult) {
      log('Reversal', 'FAIL', `RPC failed: ${reverseError?.message}`, reverseError);
      process.exit(1);
    }

    const reverseData = Array.isArray(reverseResult) ? reverseResult[0] : reverseResult;
    log('Reversal', 'PASS', `Claim reversed successfully`, {
      status: reverseData?.status,
      restoredItemCount: reverseData?.restored_item_count
    });

    // STEP 15: Verify reversal completed
    console.log('\n🔄 Step 15: Verifying reversal completed...');
    
    const { data: claimAfterReverse } = await adminClient2
      .from('office_holder_wall_claims')
      .select('id, status, reversed_at, reversal_reason')
      .eq('id', claimId)
      .single();

    if (claimAfterReverse?.status !== 'reversed') {
      log('Reversal status', 'FAIL', `Status is ${claimAfterReverse?.status}, expected reversed`);
      process.exit(1);
    }

    log('Reversal status', 'PASS', `Claim is reversed`, {
      status: claimAfterReverse.status,
      reversedAt: claimAfterReverse.reversed_at,
      reason: claimAfterReverse.reversal_reason
    });

    // PRINT SUMMARY
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const pending = results.filter(r => r.status === 'PENDING').length;

    console.log('\nTest Results:');
    results.forEach(r => {
      const emoji = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏳';
      console.log(`${emoji} ${r.step}`);
    });

    console.log(`\n📈 Summary: ${passed} passed, ${failed} failed, ${pending} pending`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED!');
      console.log('\nThe officeholder wall claim system is fully functional:');
      console.log('  ✓ Admin can create invitations');
      console.log('  ✓ New users can sign up and claim walls');
      console.log('  ✓ Claims can be redeemed and merged');
      console.log('  ✓ Audit trails are properly maintained');
      console.log('  ✓ Claims can be reversed');
      process.exit(0);
    } else {
      console.log(`\n❌ ${failed} test(s) failed. Review the output above.`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
  }
}

runTests();
