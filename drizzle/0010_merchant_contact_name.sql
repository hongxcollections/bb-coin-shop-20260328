ALTER TABLE `merchantApplications`
  ADD COLUMN `contactName` varchar(100) NULL AFTER `userId`,
  MODIFY COLUMN `yearsExperience` varchar(20) NULL;
