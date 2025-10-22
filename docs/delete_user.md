-- Delete test user from S2 therapist profiles (this will cascade to related S2 tables)
DELETE FROM s2_therapist_profiles WHERE user_id = 'irLc5tDhZSbhV8Iqyx61MuhDfSr2';

-- Delete from other main tables
DELETE FROM s2_complete_profiles WHERE user_id = 'irLc5tDhZSbhV8Iqyx61MuhDfSr2';
DELETE FROM s2_license_verifications WHERE user_id = 'irLc5tDhZSbhV8Iqyx61MuhDfSr2';
DELETE FROM user_profiles WHERE user_id = 'irLc5tDhZSbhV8Iqyx61MuhDfSr2';
DELETE FROM admin_users WHERE user_id = 'irLc5tDhZSbhV8Iqyx61MuhDfSr2';

-- Clean up any other test data
DELETE FROM bookmarks WHERE user_id = 'irLc5tDhZSbhV8Iqyx61MuhDfSr2';
DELETE FROM usage_sessions WHERE user_id = 'irLc5tDhZSbhV8Iqyx61MuhDfSr2';
DELETE FROM v17_session_metrics WHERE user_id = 'irLc5tDhZSbhV8Iqyx61MuhDfSr2';