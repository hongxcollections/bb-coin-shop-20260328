ALTER TABLE `merchantApplications`
  ADD COLUMN `merchantIcon` varchar(500) NULL AFTER `yearsExperience`,
  MODIFY COLUMN `categories` text NULL,
  MODIFY COLUMN `samplePhotos` text NULL;
