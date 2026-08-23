import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://avjieoadkfuatellrszz.supabase.co';
const supabaseAnonKey = 'sb_publishable_pfrri1_ZsGk7-l_cNWNn4A_L3JxJwal'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);