The error is because you copied the SQL comment. Here's the correct SQL without the comment:
DELETE FROM audio_combination_jobs 
WHERE conversation_id = '674b7ee2-ec2e-43b4-bea0-b0df3085256e'
AND status = 'failed';
Or if you want to clear ALL failed jobs (not just this conversation):
DELETE FROM audio_combination_jobs 
WHERE status = 'failed';

---

-- Delete test user therapist profile from S2 therapist profiles (this will cascade to related S2 tables)
DELETE FROM s2_therapist_profiles WHERE user_id = 'wo8lLHQzNThLRQkbZIuC1AmXkpD2';

-- Delete from other main tables
DELETE FROM s2_complete_profiles WHERE user_id = 'wo8lLHQzNThLRQkbZIuC1AmXkpD2';
DELETE FROM s2_license_verifications WHERE user_id = 'wo8lLHQzNThLRQkbZIuC1AmXkpD2';
DELETE FROM user_profiles WHERE user_id = 'wo8lLHQzNThLRQkbZIuC1AmXkpD2';
DELETE FROM admin_users WHERE user_id = 'wo8lLHQzNThLRQkbZIuC1AmXkpD2';

-- Clean up any other test data
DELETE FROM bookmarks WHERE user_id = 'wo8lLHQzNThLRQkbZIuC1AmXkpD2';
DELETE FROM usage_sessions WHERE user_id = 'wo8lLHQzNThLRQkbZIuC1AmXkpD2';
DELETE FROM v17_session_metrics WHERE user_id = 'wo8lLHQzNThLRQkbZIuC1AmXkpD2';