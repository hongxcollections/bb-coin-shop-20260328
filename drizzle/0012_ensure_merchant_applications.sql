-- Safe migration: ensure merchantApplications table exists with all required columns
-- Uses IF NOT EXISTS so it is safe to run even if columns already exist (MySQL 8.0+)

CREATE TABLE IF NOT EXISTS `merchantApplications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `contactName` varchar(100),
  `merchantName` varchar(100) NOT NULL,
  `selfIntro` text NOT NULL,
  `whatsapp` varchar(30) NOT NULL,
  `yearsExperience` varchar(20),
  `merchantIcon` varchar(500),
  `categories` text,
  `samplePhotos` text,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `adminNote` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `merchantApplications_id` PRIMARY KEY(`id`)
);

ALTER TABLE `merchantApplications` ADD COLUMN IF NOT EXISTS `contactName` varchar(100) NULL AFTER `userId`;
ALTER TABLE `merchantApplications` MODIFY COLUMN `yearsExperience` varchar(20) NULL;
ALTER TABLE `merchantApplications` ADD COLUMN IF NOT EXISTS `merchantIcon` varchar(500) NULL AFTER `yearsExperience`;
ALTER TABLE `merchantApplications` MODIFY COLUMN `categories` text NULL;
ALTER TABLE `merchantApplications` MODIFY COLUMN `samplePhotos` text NULL;
