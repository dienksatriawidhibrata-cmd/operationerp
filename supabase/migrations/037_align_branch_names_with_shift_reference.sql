-- Align branch names with the canonical store names used in Shift.xlsx.
-- This keeps frontend shift mapping and backend branch data in sync.

update branches
set name = 'Bagi Kopi - Cimahi Tengah'
where name = 'Bagi Kopi Cimahi';

update branches
set name = 'Bagi Kopi - Margonda Raya'
where name = 'Bagi Kopi Margonda';
