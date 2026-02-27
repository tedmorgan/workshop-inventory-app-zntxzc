-- SQL Script to update device_id in tool_inventory table
-- Changes all entries from device_id '6D99D9A9-A7AD-4077-961D-471655DFF764'
-- to device_id '2ACEEF79-EE10-4ABC-8367-AFAB75323452'

-- First, let's see how many rows will be affected (optional - for verification)
SELECT COUNT(*) as affected_rows 
FROM tool_inventory 
WHERE device_id = '6D99D9A9-A7AD-4077-961D-471655DFF764';

-- Update all rows with the old device_id to the new device_id
UPDATE tool_inventory
SET device_id = '2ACEEF79-EE10-4ABC-8367-AFAB75323452'
WHERE device_id = '6D99D9A9-A7AD-4077-961D-471655DFF764';

-- Verify the update (optional - uncomment to check results)
SELECT COUNT(*) as updated_rows 
FROM tool_inventory 
WHERE device_id = '2ACEEF79-EE10-4ABC-8367-AFAB75323452';

