-- SQL Script to update device_id in tool_inventory table
-- Changes all entries from device_id '16C5874D-EEE3-48AD-B143-D52ED30F2CD9'
-- to device_id '6D99D9A9-A7AD-4077-961D-471655DFF764'

-- First, let's see how many rows will be affected (optional - for verification)
SELECT COUNT(*) as affected_rows 
FROM tool_inventory 
WHERE device_id = '16C5874D-EEE3-48AD-B143-D52ED30F2CD9';

-- Update all rows with the old device_id to the new device_id
UPDATE tool_inventory
SET device_id = '6D99D9A9-A7AD-4077-961D-471655DFF764'
WHERE device_id = '16C5874D-EEE3-48AD-B143-D52ED30F2CD9';

-- Verify the update (optional - uncomment to check results)
SELECT COUNT(*) as updated_rows 
FROM tool_inventory 
WHERE device_id = '6D99D9A9-A7AD-4077-961D-471655DFF764';

